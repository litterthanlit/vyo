// Import parsing and resolution (CONTRACTS §2.3). Regex based; never throws.
import { JS_EXT } from "./files.mjs";
import { bump, dirname, extname, joinPath } from "./util.mjs";

const TRY_EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte", ".py", ".mts", ".cts", ".astro"];
const JS_TO_TS = [".ts", ".tsx", ".mts", ".cts"];
const ASSET_EXT = new Set([
  ".css", ".scss", ".sass", ".less", ".styl", ".json", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico",
  ".md", ".mdx", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".txt", ".yaml", ".yml", ".html", ".wasm", ".csv", ".mp3",
  ".mp4", ".webm", ".pdf", ".graphql", ".gql", ".node", ".toml", ".xml", ".lock",
]);

const DATA_JS = [/^@prisma\/client(\/|$)/, /^drizzle-orm(\/|$)/, /^mongoose$/, /^@supabase\/supabase-js$/, /^kysely$/, /^pg$/, /^mysql2(\/|$)/, /^better-sqlite3$/,
  /^postgres$/, /^@neondatabase\/serverless$/, /^@vercel\/postgres$/, /^@libsql\/client/, /^@planetscale\/database$/, /^typeorm$/, /^sequelize$/, /^knex$/, /^mongodb$/, /^sqlite3$/, /^@prisma\/adapter/];
const DATA_PY = ["sqlmodel", "sqlalchemy", "django.db", "peewee", "tortoise", "motor", "pymongo", "psycopg", "psycopg2", "asyncpg", "databases", "mongoengine", "beanie", "odmantic"];

// `import { Post } from "@prisma/client"` only brings in a model type; the runtime is PrismaClient.
function usesDbRuntime(rec) {
  if (!/^@prisma\/client(\/|$)/.test(rec.spec)) return true;
  return rec.names.length === 0 || rec.names.some((n) => n.imported === "PrismaClient" || n.imported === "*");
}

export function isDataSpec(spec, lang) {
  if (lang === "py") return DATA_PY.some((m) => spec === m || spec.startsWith(m + "."));
  return DATA_JS.some((re) => re.test(spec));
}

// ---- parsing ----

const RE_JS_FROM = /\b(import|export)\s+(type\s+|typeof\s+)?([\w$]+\s*,?\s*)?(\*(?:\s*as\s+[\w$]+)?\s*|\{[^}]*\}\s*)?from\s*(['"])([^'"\n]+)\5/g;
const RE_JS_SIDE = /\bimport\s*(['"])([^'"\n]+)\1/g;
const RE_JS_DYN = /\bimport\s*\(\s*(['"`])([^'"`\n$]+)\1\s*[,)]/g;
const RE_JS_REQ = /\brequire\s*\(\s*(['"`])([^'"`\n$]+)\1\s*\)/g;

function parseNamed(clause, def) {
  const names = [];
  if (def) names.push({ imported: "default", local: def.replace(/[\s,]/g, "") });
  if (!clause) return names;
  const c = clause.trim();
  if (c.startsWith("*")) {
    const m = /as\s+([\w$]+)/.exec(c);
    if (m) names.push({ imported: "*", local: m[1] });
  } else if (c.startsWith("{")) {
    for (let part of c.slice(1, c.lastIndexOf("}")).split(",")) {
      part = part.trim();
      const isType = /^type\s+/.test(part);
      part = part.replace(/^type\s+/, "");
      if (!part) continue;
      const m = /^([\w$]+)(?:\s+as\s+([\w$]+))?$/.exec(part);
      if (m) names.push({ imported: m[1], local: m[2] || m[1], type: isType });
    }
  }
  return names;
}

// -> [{ spec, names, typeOnly }]
export function parseJsImports(code) {
  const out = [];
  let m;
  RE_JS_FROM.lastIndex = 0;
  while ((m = RE_JS_FROM.exec(code))) {
    const names = parseNamed(m[4], m[3]);
    const typeOnly = (!!m[2] && m[2].startsWith("type")) || (names.length > 0 && names.every((n) => n.type));
    out.push({ spec: m[6], names, typeOnly });
  }
  RE_JS_SIDE.lastIndex = 0;
  while ((m = RE_JS_SIDE.exec(code))) out.push({ spec: m[2], names: [], typeOnly: false });
  RE_JS_DYN.lastIndex = 0;
  while ((m = RE_JS_DYN.exec(code))) out.push({ spec: m[2], names: [], typeOnly: false });
  RE_JS_REQ.lastIndex = 0;
  while ((m = RE_JS_REQ.exec(code))) out.push({ spec: m[2], names: [], typeOnly: false });
  return out;
}

const RE_PY_FROM = /^[ \t]*from[ \t]+(\.*)([\w.]*)[ \t]+import[ \t]+(\([^)]*\)|[^\n]*)/gm;
const RE_PY_IMPORT = /^[ \t]*import[ \t]+([^\n]+)/gm;

// -> [{ level, module, names:[{imported,local}], plain }]  (plain = `import a.b`, names empty)
export function parsePyImports(code) {
  const out = [];
  let m;
  RE_PY_FROM.lastIndex = 0;
  while ((m = RE_PY_FROM.exec(code))) {
    const names = [];
    for (let part of m[3].replace(/[()\\]/g, " ").split(",")) {
      part = part.trim();
      if (!part) continue;
      const mm = /^([\w*]+)(?:\s+as\s+(\w+))?/.exec(part);
      if (mm) names.push({ imported: mm[1], local: mm[2] || mm[1] });
    }
    out.push({ level: m[1].length, module: m[2], names, plain: false });
  }
  RE_PY_IMPORT.lastIndex = 0;
  while ((m = RE_PY_IMPORT.exec(code))) {
    for (const part of m[1].split(",")) {
      const mm = /^\s*([\w.]+)(?:\s+as\s+(\w+))?/.exec(part);
      if (mm) out.push({ level: 0, module: mm[1], names: [], plain: true, alias: mm[2] || null });
    }
  }
  return out;
}

// Package name of a bare specifier: "@a/b/c" -> "@a/b", "a/b" -> "a".
export function pkgNameOf(spec) {
  if (spec.startsWith("@")) return spec.split("/").slice(0, 2).join("/");
  return spec.split("/")[0];
}

// ---- resolution ----

// sources: Map<rel, { code, ext, pkg }>; allPathSet: every listed path (including excluded ones).
export function resolveAll({ sources, allPathSet, pkgIndex, tsconfig }) {
  const imports = new Set();
  const unresolved = new Map();
  const ext = new Map(); // file -> { js:Set, py:Set }
  const named = new Map(); // file -> [{ to, names }]
  const data = new Set();
  const stats = { files: 0, edges: 0 };

  const pyDirs = new Set();
  for (const f of sources.keys()) {
    if (!f.endsWith(".py")) continue;
    let d = dirname(f);
    while (!pyDirs.has(d)) {
      pyDirs.add(d);
      if (d === "") break;
      d = dirname(d);
    }
  }

  // Resolve a repo-relative path stem to a kept file. Returns { file } | { excluded:true } | null.
  function tryAny(p) {
    if (p == null) return null;
    if (sources.has(p)) return { file: p };
    const m = /\.(m|c)?jsx?$/.exec(p);
    if (m) {
      const stem = p.slice(0, -m[0].length);
      for (const e of JS_TO_TS) if (sources.has(stem + e)) return { file: stem + e };
    }
    for (const e of TRY_EXT) if (sources.has(p + e)) return { file: p + e };
    for (const e of TRY_EXT) if (sources.has(`${p}/index${e}`)) return { file: `${p}/index${e}` };
    if (allPathSet.has(p)) return { excluded: true };
    for (const e of TRY_EXT) if (allPathSet.has(p + e)) return { excluded: true };
    for (const e of TRY_EXT) if (allPathSet.has(`${p}/index${e}`)) return { excluded: true };
    return null;
  }

  const addEdge = (from, to) => {
    if (from !== to) imports.add(from + "\0" + to);
  };
  const miss = (spec) => bump(unresolved, spec);

  function resolveJs(from, spec, pkgRoot) {
    const q = spec.indexOf("?");
    if (q > 0) spec = spec.slice(0, q);
    const last = spec.slice(spec.lastIndexOf("/") + 1);
    const dot = last.lastIndexOf(".");
    if (dot > 0 && ASSET_EXT.has(last.slice(dot).toLowerCase())) return { kind: "asset" };
    if (spec === "." || spec === ".." || spec.startsWith("./") || spec.startsWith("../")) {
      const r = tryAny(joinPath(dirname(from), spec));
      if (r && r.file) return { kind: "file", file: r.file };
      if (r) return { kind: "excluded" };
      return { kind: "unresolved" };
    }
    if (spec.startsWith("/")) {
      for (const base of [pkgRoot, ""]) {
        const r = tryAny(joinPath(base, spec));
        if (r && r.file) return { kind: "file", file: r.file };
        if (r) return { kind: "excluded" };
      }
      return { kind: "external" };
    }
    const cfg = tsconfig.nearest(dirname(from));
    if (cfg) {
      for (const rule of cfg.rules) {
        const ok = rule.exact
          ? spec === rule.prefix
          : spec.startsWith(rule.prefix) && spec.endsWith(rule.suffix) && spec.length >= rule.prefix.length + rule.suffix.length;
        if (!ok) continue;
        const star = rule.exact ? "" : spec.slice(rule.prefix.length, spec.length - rule.suffix.length);
        for (const t of rule.targets) {
          const r = tryAny(t.replace("*", star));
          if (r && r.file) return { kind: "file", file: r.file };
          if (r) return { kind: "excluded" };
        }
        if (rule.prefix === "") break; // a bare "*" rule: keep looking (it matches every package name)
        return { kind: "unresolved" };
      }
    }
    // common aliases when the config does not declare them
    const alias = /^(@|~)\//.exec(spec);
    if (alias) {
      const rest = spec.slice(2);
      for (const base of [pkgRoot, joinPath(pkgRoot, "src"), joinPath(pkgRoot, "app")]) {
        const r = tryAny(joinPath(base, rest));
        if (r && r.file) return { kind: "file", file: r.file };
        if (r) return { kind: "excluded" };
      }
      return { kind: "unresolved" };
    }
    if (spec.startsWith("$lib/") || spec === "$lib") {
      const r = tryAny(joinPath(pkgRoot, "src/lib", spec.slice(5)));
      if (r && r.file) return { kind: "file", file: r.file };
      if (r) return { kind: "excluded" };
      return { kind: "unresolved" };
    }
    if (cfg && cfg.baseUrl != null) {
      const r = tryAny(joinPath(cfg.baseUrl, spec));
      if (r && r.file) return { kind: "file", file: r.file };
    }
    // sibling workspace package
    const name = pkgNameOf(spec);
    const wroot = pkgIndex.workspaces.get(name);
    if (wroot != null && wroot !== pkgRoot) {
      const sub = spec.slice(name.length + 1);
      const cands = sub ? [joinPath(wroot, "src", sub), joinPath(wroot, sub)] : [joinPath(wroot, "src/index"), joinPath(wroot, "index"), joinPath(wroot, "src")];
      for (const c of cands) {
        const r = tryAny(c);
        if (r && r.file) return { kind: "file", file: r.file };
      }
      return { kind: "external" };
    }
    // implicit root-relative imports (e.g. "components/ui/button" with baseUrl ".")
    if (spec.includes("/")) {
      for (const base of [pkgRoot, joinPath(pkgRoot, "src")]) {
        const r = tryAny(joinPath(base, spec));
        if (r && r.file) return { kind: "file", file: r.file };
      }
    }
    return { kind: "external" };
  }

  function pyModuleFile(base, parts) {
    if (parts.length === 0) return sources.has(joinPath(base, "__init__.py")) ? joinPath(base, "__init__.py") : null;
    const p = joinPath(base, parts.join("/"));
    if (p == null) return null;
    if (sources.has(p + ".py")) return p + ".py";
    if (sources.has(p + "/__init__.py")) return p + "/__init__.py";
    return null;
  }

  function resolvePy(from, rec, pkgRoot) {
    const parts = rec.module ? rec.module.split(".") : [];
    const targets = [];
    let internal = false;
    const submodules = (base, modParts) => {
      // `from pkg import name` may name a submodule
      const hits = [];
      for (const n of rec.names) {
        if (n.imported === "*") continue;
        const f = pyModuleFile(base, [...modParts, n.imported]);
        if (f) hits.push([n, f]);
      }
      return hits;
    };
    const handle = (base, modParts) => {
      const modFile = pyModuleFile(base, modParts);
      const subs = rec.plain ? [] : submodules(base, modParts);
      for (const [n, f] of subs) targets.push({ file: f, names: [], module: n.local });
      const plainNames = rec.names.filter((n) => n.imported !== "*");
      if (modFile && (rec.plain || plainNames.length === 0 || subs.length < plainNames.length)) {
        targets.push({ file: modFile, names: rec.names.filter((n) => !subs.some(([m]) => m === n)), module: rec.plain ? rec.alias || null : null });
      }
      return !!modFile || subs.length > 0;
    };
    if (rec.level > 0) {
      let base = dirname(from);
      for (let i = 1; i < rec.level; i++) {
        if (base === "") return { internal: true, targets: [], bad: true };
        base = dirname(base);
      }
      internal = true;
      handle(base, parts);
      return { internal, targets, bad: targets.length === 0 };
    }
    if (parts.length === 0) return { internal: false, targets: [], bad: false };
    const bases = [...new Set([pkgRoot, joinPath(pkgRoot, "src"), "", dirname(from)])];
    for (const base of bases) {
      const top = joinPath(base, parts[0]);
      if (!(pyDirs.has(top) || sources.has(top + ".py"))) continue;
      internal = true;
      if (handle(base, parts)) return { internal, targets, bad: false };
    }
    return { internal, targets, bad: internal && targets.length === 0 };
  }

  for (const [from, src] of sources) {
    const e = extname(from);
    const pkgRoot = pkgIndex.pkgOf(from);
    stats.files++;
    if (e === ".py") {
      const recs = parsePyImports(src.code);
      const entry = { js: new Set(), py: new Set() };
      const nm = [];
      for (const rec of recs) {
        const r = resolvePy(from, rec, pkgRoot);
        if (r.internal) {
          for (const t of r.targets) {
            addEdge(from, t.file);
            if (t.names.length || t.module) nm.push({ to: t.file, names: t.names, module: t.module || null });
          }
          if (r.bad) miss((rec.level ? ".".repeat(rec.level) : "") + rec.module);
        } else if (rec.module) {
          entry.py.add(rec.module);
          if (isDataSpec(rec.module, "py")) data.add(from);
        }
      }
      if (entry.py.size) ext.set(from, entry);
      if (nm.length) named.set(from, nm);
    } else if (JS_EXT.has(e)) {
      const recs = parseJsImports(src.code);
      const entry = { js: new Set(), py: new Set() };
      const nm = [];
      for (const rec of recs) {
        const r = resolveJs(from, rec.spec, pkgRoot);
        if (r.kind === "file") {
          addEdge(from, r.file);
          if (rec.names.length) nm.push({ to: r.file, names: rec.names });
        } else if (r.kind === "unresolved") miss(rec.spec);
        else if (r.kind === "external") {
          if (!rec.typeOnly) entry.js.add(rec.spec); // a type-only import is erased: no runtime link

          if (!rec.typeOnly && isDataSpec(rec.spec, "js") && usesDbRuntime(rec)) data.add(from);
        }
      }
      if (entry.js.size) ext.set(from, entry);
      if (nm.length) named.set(from, nm);
    }
  }

  const edges = [...imports].map((s) => s.split("\0")).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const resolveSpec = (from, spec) => {
    const r = resolveJs(from, spec, pkgIndex.pkgOf(from));
    return r.kind === "file" ? r.file : null;
  };
  return { imports: edges, unresolved, ext, named, data, resolveSpec };
}
