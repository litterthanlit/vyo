// Endpoints declared in code: Express / Koa / Fastify / Hono / Elysia, tRPC procedures, plus light
// Go, Spring, Laravel and Rails support.
import { JS_EXT } from "./files.mjs";
import { joinRoute, normRoutePath } from "./routes.mjs";
import { routeName } from "./names.mjs";
import { cmp, extname, pub } from "./util.mjs";

const SERVER_DEPS = ["express", "fastify", "hono", "koa", "@koa/router", "koa-router", "elysia", "@hapi/hapi", "restify", "polka", "itty-router", "@fastify/express"];
const NOT_SERVER = new Set(["axios", "http", "https", "client", "fetch", "request", "supertest", "ky", "got", "superagent", "$http", "$axios", "http_client", "ctx", "cy", "page"]);
const VERB = "get|post|put|patch|delete|all|options|head";

// index of the matching close for the opener at code[open]
export function matchClose(code, open) {
  const o = code[open];
  const c = o === "{" ? "}" : o === "(" ? ")" : "]";
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      for (i++; i < code.length; i++) {
        if (code[i] === "\\") i++;
        else if (code[i] === ch) break;
      }
      continue;
    }
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") {
      depth--;
      if (depth === 0) return ch === c ? i : -1;
    }
  }
  return -1;
}

function splitTopJs(text) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      for (; j < text.length; j++) {
        if (text[j] === "\\") j++;
        else if (text[j] === ch) break;
      }
      cur += text.slice(i, j + 1);
      i = j;
      continue;
    }
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function topOptionString(arg, prop) {
  const s = arg.trim();
  if (!s.startsWith("{") || !s.endsWith("}")) return "";
  for (const entry of splitTopJs(s.slice(1, -1))) {
    const m = /^\s*(?:["']?(\w+)["']?)\s*:\s*["'`]([^"'`]*)["'`]/.exec(entry);
    if (m && m[1] === prop) return m[2];
  }
  return "";
}

function argsOptionString(argsText, prop, startIdx = 0) {
  for (const arg of splitTopJs(argsText).slice(startIdx)) {
    const v = topOptionString(arg, prop);
    if (v) return v;
  }
  return "";
}

export function detectHttpEndpoints(ctx) {
  detectExpressLike(ctx);
  detectTrpc(ctx);
  detectOtherLanguages(ctx);
}

function detectExpressLike(ctx) {
  const { sources, named, pkgIndex, facts } = ctx;
  const nodes = new Map(); // file::var -> { file, var, own, routes:[{path,methods}] }
  const byFile = new Map(); // file -> [keys]
  const defaultExports = new Map(); // file -> var name
  const exportAliases = new Map(); // file::exported -> local var name
  const edges = new Map(); // child key -> [{ parent, prefix }]
  const key = (f, v) => `${f}::${v}`;

  for (const [file, src] of sources) {
    if (!JS_EXT.has(extname(file))) continue;
    const pkg = pkgIndex.pkgOf(file);
    const hasServerDep = SERVER_DEPS.some((d) => pkgIndex.hasDep(pkg, d));
    const code = src.code;
    if (!hasServerDep && !/from\s*["'](express|fastify|hono|koa|elysia|@koa\/router|koa-router)["']|require\(\s*["'](express|fastify|hono|koa)["']\)/.test(code)) continue;
    const receivers = new Map(); // name -> own prefix
    for (const m of code.matchAll(/\b(?:const|let|var)\s+(\w+)\s*(?::[^=\n]+)?=\s*(?:new\s+)?(?:express\s*\(|express\.Router\s*\(|Router\s*\(|(?:Fastify|fastify)\s*\(|Hono\b|Elysia\b|KoaRouter\b|Koa\b|createRouter\b)/g)) {
      let own = "";
      let open = m[0].endsWith("(") ? m.index + m[0].length - 1 : -1;
      if (open < 0) {
        const rest = code.slice(m.index + m[0].length, m.index + m[0].length + 120);
        const call = /^\s*(?:<[^>\n]*>)?\s*\(/.exec(rest);
        if (call) open = m.index + m[0].length + call[0].length - 1;
      }
      const close = open >= 0 ? matchClose(code, open) : -1;
      if (close > open) {
        const pf = argsOptionString(code.slice(open + 1, close), "prefix");
        if (pf) own = pf;
        let pos = close + 1;
        for (;;) {
          const cm = /^\s*\.\s*(\w+)\s*\(/.exec(code.slice(pos, pos + 80));
          if (!cm) break;
          const cOpen = pos + cm[0].length - 1;
          const cClose = matchClose(code, cOpen);
          if (cClose < 0) break;
          if (cm[1] === "basePath") {
            const bp = /^\s*["'`]([^"'`]*)["'`]/.exec(code.slice(cOpen + 1, cClose));
            if (bp) own = bp[1];
          }
          pos = cClose + 1;
        }
      }
      receivers.set(m[1], own);
    }
    for (const g of ["app", "router", "fastify", "server"]) if (!receivers.has(g) && hasServerDep) receivers.set(g, "");
    // Plugin functions: async function catalog(fastify) { ... } or const catalog = async (fastify) => { ... }
    const pluginSpans = [];
    const pluginNames = new Set();
    const addPlugin = (fnName, param, bodyOpen, isDefault) => {
      if (!param || NOT_SERVER.has(param) || bodyOpen < 0) return;
      const bodyClose = matchClose(code, bodyOpen);
      if (bodyClose < 0) return;
      const body = code.slice(bodyOpen + 1, bodyClose);
      const esc = param.replace(/\$/g, "\\$");
      if (!new RegExp(`\\b${esc}\\s*\\.(?:${VERB}|route|use|register)\\s*\\(`).test(body)) return;
      pluginSpans.push({ name: fnName, param, start: bodyOpen, end: bodyClose });
      pluginNames.add(fnName);
      if (isDefault) defaultExports.set(file, fnName);
    };
    for (const fm of code.matchAll(/\b(export\s+default\s+)?(?:export\s+)?(?:async\s+)?function\s*(\w+)?\s*\(\s*(\w+)/g)) {
      const fnName = fm[2] || (fm[1] ? "default" : "");
      if (!fnName) continue;
      const pOpen = code.indexOf("(", fm.index);
      const pClose = pOpen >= 0 ? matchClose(code, pOpen) : -1;
      if (pClose < 0) continue;
      const brace = /^\s*(?::[^{;\n]+)?\{/.exec(code.slice(pClose + 1, pClose + 120));
      if (brace) addPlugin(fnName, fm[3], pClose + 1 + brace[0].length - 1, !!fm[1]);
    }
    for (const am of code.matchAll(/\b(?:const|let|var)\s+(\w+)\s*(?::[^=\n]+)?=\s*(?:async\s+)?(?:function\s*\w*\s*\(\s*(\w+)|\(\s*(\w+)[^)\n]*\)\s*(?::[^={\n]+)?=>|(\w+)\s*=>)/g)) {
      const fnName = am[1];
      const param = am[2] || am[3] || am[4];
      let after = am.index + am[0].length;
      if (am[2]) {
        const pOpen = code.indexOf("(", am.index + am[0].indexOf("function"));
        const pClose = pOpen >= 0 ? matchClose(code, pOpen) : -1;
        if (pClose < 0) continue;
        after = pClose + 1;
      }
      const brace = /^\s*(?::[^{;\n]+)?\{/.exec(code.slice(after, after + 120));
      if (brace) addPlugin(fnName, param, after + brace[0].length - 1, false);
    }
    if (!defaultExports.has(file)) {
      const dm = /\bexport\s+default\s+(\w+)\b/.exec(code);
      if (dm && (receivers.has(dm[1]) || pluginNames.has(dm[1]))) defaultExports.set(file, dm[1]);
    }
    for (const em of code.matchAll(/\bexport\s*\{([^}]+)\}/g)) {
      for (const part of em[1].split(",")) {
        const am = /^\s*(\w+)\s+as\s+(\w+)\s*$/.exec(part);
        if (am) exportAliases.set(key(file, am[2]), am[1]);
      }
    }
    if (receivers.size === 0 && pluginNames.size === 0) continue;
    const names = [...receivers.keys()].filter((n) => !NOT_SERVER.has(n));
    const allNames = [...new Set([...names, ...pluginSpans.map((s) => s.param)])];
    if (allNames.length === 0) continue;
    const keys = [];
    for (const [n, own] of receivers) {
      const k = key(file, n);
      nodes.set(k, { file, var: n, own, routes: [] });
      keys.push(k);
    }
    for (const fnName of pluginNames) {
      const k = key(file, fnName);
      if (!nodes.has(k)) {
        nodes.set(k, { file, var: fnName, own: "", routes: [] });
        keys.push(k);
      }
    }
    byFile.set(file, keys);
    const ownerAt = (pos, varName) => {
      let best = null;
      for (const s of pluginSpans) {
        if (s.param === varName && pos >= s.start && pos <= s.end && (!best || s.end - s.start < best.end - best.start)) best = s;
      }
      if (best) return key(file, best.name);
      return receivers.has(varName) ? key(file, varName) : null;
    };
    const namePat = allNames.map((n) => n.replace(/\$/g, "\\$")).join("|");
    const re = new RegExp(`\\b(${namePat})\\s*\\.(${VERB})\\s*\\(\\s*(["'\`])(\\/[^"'\`\\n]*)\\3`, "g");
    let m;
    while ((m = re.exec(code))) {
      const owner = ownerAt(m.index, m[1]);
      if (!owner) continue;
      nodes.get(owner).routes.push({ path: m[4], methods: m[2] === "all" ? [] : [m[2].toUpperCase()] });
    }
    // chained: router.route('/x').get(...).post(...)
    for (const mm of code.matchAll(new RegExp(`\\b(${namePat})\\s*\\.route\\s*\\(\\s*(["'\`])(\\/[^"'\`\\n]*)\\2\\s*\\)`, "g"))) {
      const owner = ownerAt(mm.index, mm[1]);
      if (!owner) continue;
      const node = nodes.get(owner);
      const methods = [];
      let i = mm.index + mm[0].length;
      for (;;) {
        const cm = /^\s*\.\s*(\w+)\s*\(/.exec(code.slice(i, i + 80));
        if (!cm) break;
        const open = i + cm[0].length - 1;
        const close = matchClose(code, open);
        if (close < 0) break;
        if (new RegExp(`^(${VERB})$`).test(cm[1]) && cm[1] !== "all") methods.push(cm[1].toUpperCase());
        i = close + 1;
      }
      node.routes.push({ path: mm[3], methods });
    }
    // mounts: app.use('/api', usersRouter) or fastify.register(plugin, { prefix: '/api' })
    const requireBind = new Map(); // local -> { file, exportName }
    for (const rm of code.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'](\.[^"']*)["']\s*\)/g)) {
      const f = ctx.resolveSpec(file, rm[2]);
      if (f) requireBind.set(rm[1], { file: f, exportName: null });
    }
    for (const rm of code.matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\(\s*["'](\.[^"']*)["']\s*\)/g)) {
      const f = ctx.resolveSpec(file, rm[2]);
      if (!f) continue;
      for (const part of rm[1].split(",")) {
        const pm = /^\s*(\w+)(?:\s*:\s*(\w+))?\s*$/.exec(part);
        if (pm) requireBind.set(pm[2] || pm[1], { file: f, exportName: pm[1] });
      }
    }
    for (const um of code.matchAll(new RegExp(`\\b(${namePat})\\s*\\.(use|route|register)\\s*\\(\\s*(?:(["'\`])(\\/[^"'\`\\n]*)\\3\\s*,\\s*)?([\\w$.]+)`, "g"))) {
      const [, parent, verb, , rawPrefix, expr] = um;
      const pk = ownerAt(um.index, parent);
      if (!pk) continue;
      let prefix = rawPrefix ?? "";
      if (!prefix && verb === "register") {
        const open = code.indexOf("(", um.index + parent.length);
        const close = open >= 0 ? matchClose(code, open) : -1;
        if (close > open) prefix = argsOptionString(code.slice(open + 1, close), "prefix", 1);
      }
      if (verb === "route" && !prefix) continue;
      const [base, prop] = expr.split(".");
      let childFile = null;
      let childVar = null;
      const req = requireBind.get(base);
      if (req) {
        childFile = req.file;
        childVar = req.exportName || prop || null;
      }
      if (!childFile) {
        for (const nm of named.get(file) || []) {
          for (const n of nm.names) {
            if (n.local !== base) continue;
            childFile = nm.to;
            childVar = n.imported === "*" ? prop || null : n.imported;
          }
        }
      }
      if (!childFile && (receivers.has(expr) || pluginNames.has(expr))) {
        childFile = file;
        childVar = expr;
      }
      if (!childFile) continue;
      edges.set(`pending:${childFile}:${childVar ?? "*"}:${pk}:${prefix}`, [{ pending: true, childFile, childVar, parent: pk, prefix }]);
    }
  }

  // resolve pending edges now that every file's nodes exist
  const parents = new Map();
  for (const [, list] of edges) {
    for (const e of list) {
      let targets;
      if (e.childVar) {
        const resolved = e.childVar === "default" ? defaultExports.get(e.childFile) || "default" : exportAliases.get(key(e.childFile, e.childVar)) || e.childVar;
        const exact = key(e.childFile, resolved);
        targets = nodes.has(exact) ? [exact] : byFile.get(e.childFile) || [];
      } else {
        targets = byFile.get(e.childFile) || [];
      }
      for (const t of targets) {
        if (t === e.parent) continue;
        if (!parents.has(t)) parents.set(t, []);
        parents.get(t).push({ parent: e.parent, prefix: e.prefix });
      }
    }
  }
  const cache = new Map();
  const fulls = (k, seen = new Set()) => {
    if (cache.has(k)) return cache.get(k);
    if (seen.has(k)) return [""];
    seen.add(k);
    const own = nodes.get(k)?.own || "";
    const ps = parents.get(k);
    let out;
    if (!ps) out = [own];
    else {
      out = [];
      for (const { parent, prefix } of ps) for (const pf of fulls(parent, new Set(seen))) out.push(joinRoute(pf, prefix, own));
    }
    out = [...new Set(out)].sort(cmp);
    cache.set(k, out);
    return out;
  };
  for (const [k, n] of nodes) {
    for (const r of n.routes) {
      for (const pf of fulls(k)) {
        const path = joinRoute(pf, r.path);
        facts.add("endpoint", "endpoint:" + path, {
          name: routeName(path),
          file: n.file,
          meta: { package: pub(pkgIndex.pkgOf(n.file)), methods: r.methods },
        });
      }
    }
  }
}

function detectTrpc(ctx) {
  const { sources, facts, pkgIndex } = ctx;
  for (const [file, src] of sources) {
    if (!JS_EXT.has(extname(file))) continue;
    const code = src.code;
    if (!/\b(createTRPCRouter|initTRPC|createTRPCRouter|t\.router|trpc\.router)\b/.test(code) || !/\.(query|mutation|subscription)\s*\(/.test(code)) continue;
    for (const m of code.matchAll(/\b(?:const|let)\s+(\w+)\s*=\s*(?:createTRPCRouter|t\.router|trpc\.router|router|createRouter)\s*\(\s*\{/g)) {
      const open = m.index + m[0].length - 1;
      const close = matchClose(code, open);
      if (close < 0) continue;
      const body = code.slice(open + 1, close);
      let ns = m[1].replace(/Router$/, "").replace(/^router$/i, "");
      if (/^app$/i.test(ns)) ns = "";
      for (const entry of splitTopJs(body)) {
        const em = /^\s*(\w+)\s*:\s*([\s\S]*)$/.exec(entry);
        if (!em) continue;
        const kind = /\.(query|mutation|subscription)\s*\(/.exec(em[2]);
        if (!kind || /^\s*(createTRPCRouter|router|t\.router)/.test(em[2])) continue;
        const proc = ns ? `${ns}.${em[1]}` : em[1];
        const id = `/trpc/${proc}`;
        facts.add("endpoint", `endpoint:${id}`, {
          name: routeName(id),
          file,
          meta: { package: pub(pkgIndex.pkgOf(file)), methods: [kind[1] === "mutation" ? "POST" : "GET"] },
        });
      }
    }
  }
}

function detectOtherLanguages(ctx) {
  const { sources, facts, pkgIndex } = ctx;
  const add = (path, file, methods) => {
    const p = normRoutePath(path);
    facts.add("endpoint", "endpoint:" + p, { name: routeName(p), file, meta: { package: pub(pkgIndex.pkgOf(file)), methods } });
  };
  for (const [file, src] of sources) {
    const ext = extname(file);
    const code = src.code;
    let m;
    if (ext === ".go" && /gin-gonic|labstack\/echo|go-chi|gorilla\/mux|gofiber|net\/http/.test(code)) {
      for (m of code.matchAll(/\.(GET|POST|PUT|PATCH|DELETE|Get|Post|Put|Patch|Delete)\(\s*"(\/[^"]*)"/g)) add(m[2], file, [m[1].toUpperCase()]);
      for (m of code.matchAll(/\b(?:HandleFunc|Handle)\(\s*"(?:(GET|POST|PUT|PATCH|DELETE)\s+)?(\/[^"\s]*)"/g)) add(m[2], file, m[1] ? [m[1]] : []);
    } else if ((ext === ".java" || ext === ".kt") && /@(RestController|Controller|RequestMapping)/.test(code)) {
      const base = /@RequestMapping\(\s*(?:value\s*=\s*)?(?:\{\s*)?"([^"]*)"/.exec(code);
      for (m of code.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping(?:\(\s*(?:value\s*=\s*|path\s*=\s*)?(?:\{\s*)?"([^"]*)")?/g)) {
        add(joinRoute(base ? base[1] : "", m[2] || ""), file, [m[1].toUpperCase()]);
      }
    } else if (ext === ".php" && /Route::/.test(code)) {
      const api = /(^|\/)routes\/api\.php$/.test(file) ? "/api" : "";
      for (m of code.matchAll(/Route::(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) add(joinRoute(api, m[2]), file, [m[1].toUpperCase()]);
      for (m of code.matchAll(/Route::(?:api)?[Rr]esource\(\s*['"]([^'"]+)['"]/g)) {
        add(joinRoute(api, m[1]), file, ["GET", "POST"]);
        add(joinRoute(api, m[1], "[id]"), file, ["DELETE", "GET", "PUT"]);
      }
    } else if (ext === ".rb" && /(^|\/)config\/routes\.rb$/.test(file)) {
      for (m of code.matchAll(/^\s*(get|post|put|patch|delete)\s+['"]\/?([^'"]+)['"]/gm)) add(m[2], file, [m[1].toUpperCase()]);
      for (m of code.matchAll(/^\s*resources\s+:(\w+)/gm)) {
        add(m[1], file, ["GET", "POST"]);
        add(joinRoute(m[1], "[id]"), file, ["DELETE", "GET", "PATCH", "PUT"]);
      }
    }
  }
}
