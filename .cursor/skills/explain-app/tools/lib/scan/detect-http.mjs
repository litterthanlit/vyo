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

export function detectHttpEndpoints(ctx) {
  detectExpressLike(ctx);
  detectTrpc(ctx);
  detectOtherLanguages(ctx);
}

function detectExpressLike(ctx) {
  const { sources, named, pkgIndex, facts } = ctx;
  const nodes = new Map(); // file::var -> { file, var, own, routes:[{path,methods}] }
  const byFile = new Map(); // file -> [keys]
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
      const tail = code.slice(m.index, m.index + 300);
      const bp = /\.basePath\(\s*["'`]([^"'`]*)["'`]/.exec(tail) || /\bprefix\s*:\s*["'`]([^"'`]*)["'`]/.exec(tail);
      if (bp) own = bp[1];
      receivers.set(m[1], own);
    }
    for (const g of ["app", "router", "fastify", "server"]) if (!receivers.has(g) && hasServerDep) receivers.set(g, "");
    if (receivers.size === 0) continue;
    const names = [...receivers.keys()].filter((n) => !NOT_SERVER.has(n));
    if (names.length === 0) continue;
    const re = new RegExp(`\\b(${names.map((n) => n.replace(/\$/g, "\\$")).join("|")})\\s*\\.(${VERB})\\s*\\(\\s*(["'\`])(\\/[^"'\`\\n]*)\\3`, "g");
    const keys = [];
    for (const [n, own] of receivers) {
      const k = key(file, n);
      nodes.set(k, { file, var: n, own, routes: [] });
      keys.push(k);
    }
    byFile.set(file, keys);
    let m;
    while ((m = re.exec(code))) {
      const node = nodes.get(key(file, m[1]));
      node.routes.push({ path: m[4], methods: m[2] === "all" ? [] : [m[2].toUpperCase()] });
    }
    // chained: router.route('/x').get(...).post(...)
    for (const mm of code.matchAll(new RegExp(`\\b(${names.join("|")})\\s*\\.route\\s*\\(\\s*(["'\`])(\\/[^"'\`\\n]*)\\2\\s*\\)`, "g"))) {
      const node = nodes.get(key(file, mm[1]));
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
    // mounts: app.use('/api', usersRouter)
    const requireBind = new Map();
    for (const rm of code.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*["'](\.[^"']*)["']\s*\)/g)) {
      const f = ctx.resolveSpec(file, rm[2]);
      if (f) requireBind.set(rm[1], f);
    }
    for (const um of code.matchAll(new RegExp(`\\b(${names.join("|")})\\s*\\.(use|route|register)\\s*\\(\\s*(?:(["'\`])(\\/[^"'\`\\n]*)\\3\\s*,\\s*)?([\\w$.]+)`, "g"))) {
      const [, parent, verb, , prefix, expr] = um;
      if (verb === "route" && !prefix) continue;
      let childFile = requireBind.get(expr.split(".")[0]) || null;
      let childVar = null;
      if (!childFile) {
        for (const nm of named.get(file) || []) for (const n of nm.names) if (n.local === expr.split(".")[0]) childFile = nm.to;
      }
      if (!childFile && receivers.has(expr)) {
        childFile = file;
        childVar = expr;
      }
      if (!childFile) continue;
      const pk = key(file, parent);
      edges.set(`pending:${childFile}:${childVar ?? "*"}:${pk}:${prefix ?? ""}`, [{ pending: true, childFile, childVar, parent: pk, prefix: prefix ?? "" }]);
    }
  }

  // resolve pending edges now that every file's nodes exist
  const parents = new Map();
  for (const [, list] of edges) {
    for (const e of list) {
      const targets = e.childVar ? [key(e.childFile, e.childVar)] : byFile.get(e.childFile) || [];
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
