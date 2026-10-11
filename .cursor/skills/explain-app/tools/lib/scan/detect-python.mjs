// Python web endpoints: FastAPI / Flask / Starlette (router graph with joined prefixes) and Django urls.
import { callArgs, parseArgs, pyString, collectConsts } from "./pyutil.mjs";
import { joinRoute, normRoutePath } from "./routes.mjs";
import { routeName } from "./names.mjs";
import { cmp, pub } from "./util.mjs";

const VERBS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);

export function detectPythonEndpoints(ctx) {
  const py = [...ctx.sources].filter(([f]) => f.endsWith(".py"));
  if (!py.length) return;
  const consts = collectConsts(ctx.sources);
  const named = ctx.named;
  const nodes = new Map(); // key -> { file, var, own, decos:[{path,methods}], extra:[{path,methods}] }
  const parents = new Map(); // child key -> [{ parent, prefix }]
  const key = (file, v) => `${file}::${v}`;
  const node = (file, v) => {
    const k = key(file, v);
    let n = nodes.get(k);
    if (!n) nodes.set(k, (n = { file, var: v, own: "", decos: [] }));
    return n;
  };

  // local name in `file` -> node key (declared here or imported from another file's node)
  function bindingKey(file, name) {
    for (const nm of named.get(file) || []) {
      for (const n of nm.names) if (n.local === name) return key(nm.to, n.imported);
    }
    return key(file, name);
  }
  // `items.router` / `router` / `items_router` -> node key
  function exprKey(file, expr) {
    expr = expr.trim();
    let m = /^([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/.exec(expr);
    if (m) {
      for (const nm of named.get(file) || []) if (nm.module === m[1]) return key(nm.to, m[2]);
      return null;
    }
    m = /^([A-Za-z_]\w*)$/.exec(expr);
    if (m) return bindingKey(file, m[1]);
    return null;
  }

  const CTOR = /^[ \t]*(\w+)[ \t]*(?::[^=\n]+)?=[ \t]*(?:[\w.]+\.)?(APIRouter|FastAPI|Blueprint|Flask|Quart|Router|Starlette|Sanic|Api|Namespace)[ \t]*\(/gm;
  const DECO = /^[ \t]*@(\w+)\.(get|post|put|patch|delete|options|head|route|api_route|websocket)[ \t]*\(/gm;
  const INCL = /(\w+)\.(include_router|register_blueprint)[ \t]*\(/g;

  for (const [file, src] of py) {
    const code = src.code;
    let m;
    CTOR.lastIndex = 0;
    while ((m = CTOR.exec(code))) {
      const open = m.index + m[0].length - 1;
      const call = callArgs(code, open);
      if (!call) continue;
      const { kw } = parseArgs(call.text);
      const n = node(file, m[1]);
      const pre = kw.prefix ?? kw.url_prefix;
      if (pre != null) n.own = pyString(pre, consts) ?? "";
    }
    DECO.lastIndex = 0;
    while ((m = DECO.exec(code))) {
      const open = m.index + m[0].length - 1;
      const call = callArgs(code, open);
      if (!call) continue;
      const verb = m[2];
      if (verb === "websocket") continue;
      const { pos, kw } = parseArgs(call.text);
      const rawPath = pos[0] ?? kw.path ?? kw.rule;
      const p = pyString(rawPath, consts);
      if (p == null) continue;
      let methods;
      if (VERBS.has(verb)) methods = [verb.toUpperCase()];
      else {
        const ms = kw.methods ? [...kw.methods.matchAll(/['"](\w+)['"]/g)].map((x) => x[1].toUpperCase()) : [];
        methods = ms.length ? ms : verb === "route" ? ["GET"] : [];
      }
      // receiver: declared here, or imported
      const k = nodes.has(key(file, m[1])) ? key(file, m[1]) : bindingKey(file, m[1]);
      let n = nodes.get(k);
      if (!n) {
        const [f, v] = k.split("::");
        n = node(f, v);
      }
      n.decos.push({ file, path: p, methods });
    }
    INCL.lastIndex = 0;
    while ((m = INCL.exec(code))) {
      const open = m.index + m[0].length - 1;
      const call = callArgs(code, open);
      if (!call) continue;
      const { pos, kw } = parseArgs(call.text);
      const child = exprKey(file, pos[0] ?? kw.router ?? kw.blueprint ?? "");
      if (!child) continue;
      const parent = nodes.has(key(file, m[1])) ? key(file, m[1]) : bindingKey(file, m[1]);
      const pre = kw.prefix ?? kw.url_prefix;
      const prefix = pre != null ? pyString(pre, consts) ?? "" : "";
      if (!parents.has(child)) parents.set(child, []);
      parents.get(child).push({ parent, prefix });
      if (!nodes.has(child)) {
        const [f, v] = child.split("::");
        node(f, v);
      }
      if (!nodes.has(parent)) {
        const [f, v] = parent.split("::");
        node(f, v);
      }
    }
  }

  const fullCache = new Map();
  function fulls(k, seen = new Set()) {
    if (fullCache.has(k)) return fullCache.get(k);
    if (seen.has(k)) return [""];
    seen.add(k);
    const n = nodes.get(k);
    const own = n ? n.own : "";
    const ps = parents.get(k);
    let out;
    if (!ps || ps.length === 0) out = [own];
    else {
      out = [];
      for (const { parent, prefix } of ps) for (const pf of fulls(parent, new Set(seen))) out.push(joinRoute(pf, prefix, own));
    }
    out = [...new Set(out.map((x) => (x === "" ? "" : x)))].sort(cmp);
    fullCache.set(k, out);
    return out;
  }

  for (const [k, n] of nodes) {
    if (!n.decos.length) continue;
    const prefixes = fulls(k);
    for (const d of n.decos) {
      for (const pf of prefixes) {
        const path = joinRoute(pf, d.path);
        const pkg = ctx.pkgIndex.pkgOf(d.file);
        ctx.facts.add("endpoint", "endpoint:" + path, {
          name: routeName(path),
          file: d.file,
          meta: { package: pub(pkg), methods: d.methods },
        });
      }
    }
  }

  detectDjango(ctx, py, consts);
}

// ---- Django ----

function djangoRoute(raw) {
  let s = raw.replace(/^\^/, "").replace(/\$$/, "");
  s = s.replace(/\(\?P<(\w+)>[^)]*\)/g, "<$1>");
  s = s.replace(/<(?:\w+:)?(\w+)>/g, "<$1>");
  s = s.replace(/[\\()?*+]/g, "");
  return s;
}

function detectDjango(ctx, py, consts) {
  const urlFiles = py.filter(([f, s]) => /(^|\/)urls\.py$/.test(f) && /urlpatterns/.test(s.code));
  if (!urlFiles.length) return;
  const byModule = (mod) => {
    const tail = "/" + mod.replace(/\./g, "/");
    const hits = [...ctx.sources.keys()].filter((f) => f.endsWith(".py") && (("/" + f).endsWith(tail + ".py") || ("/" + f).endsWith(tail + "/__init__.py")));
    return hits.sort(cmp)[0] || null;
  };
  const entries = new Map(); // file -> [{ route, includeFile|null, include: 'router.urls'|null, view }]
  for (const [file, src] of urlFiles) {
    const code = src.code;
    const list = [];
    const routers = new Map(); // var -> [prefixes]
    for (const m of code.matchAll(/(\w+)\.register\s*\(/g)) {
      const call = callArgs(code, m.index + m[0].length - 1);
      if (!call) continue;
      const { pos } = parseArgs(call.text);
      const p = pyString(pos[0], consts);
      if (p == null) continue;
      if (!routers.has(m[1])) routers.set(m[1], []);
      routers.get(m[1]).push(p.replace(/^\^|\$$/g, ""));
    }
    const re = /\b(path|re_path|url)\s*\(/g;
    let m;
    while ((m = re.exec(code))) {
      const call = callArgs(code, m.index + m[0].length - 1);
      if (!call) continue;
      const { pos } = parseArgs(call.text);
      const raw = pyString(pos[0], consts);
      if (raw == null || pos.length < 2) continue;
      const route = m[1] === "path" ? raw : djangoRoute(raw);
      const v = pos[1];
      let im;
      if ((im = /^include\s*\(\s*([\s\S]*)\)$/.exec(v))) {
        const arg = parseArgs(im[1]).pos[0] || "";
        const lit = pyString(arg.replace(/^\(\s*/, ""), consts) ?? pyString(arg, consts);
        const rm = /^(\w+)\.urls$/.exec(arg.trim());
        if (lit) list.push({ route, includeFile: byModule(lit) });
        else if (rm && routers.has(rm[1])) list.push({ route, routerPrefixes: routers.get(rm[1]) });
      } else if (/\badmin\.site\.urls\b|\bstatic\s*\(/.test(v)) continue;
      else list.push({ route });
    }
    entries.set(file, list);
  }
  const included = new Set();
  for (const list of entries.values()) for (const e of list) if (e.includeFile) included.add(e.includeFile);
  const emit = (path, file) => {
    const p = normRoutePath("/" + path);
    ctx.facts.add("endpoint", "endpoint:" + p, { name: routeName(p), file, meta: { package: pub(ctx.pkgIndex.pkgOf(file)), methods: [] } });
  };
  const walk = (file, prefix, depth) => {
    if (depth > 8) return;
    for (const e of entries.get(file) || []) {
      const here = joinRoute(prefix, e.route);
      if (e.includeFile && entries.has(e.includeFile)) walk(e.includeFile, here, depth + 1);
      else if (e.routerPrefixes) {
        for (const rp of e.routerPrefixes) {
          emit(joinRoute(here, rp), file);
          emit(joinRoute(here, rp, "<pk>"), file);
        }
      } else if (!e.includeFile) emit(here, file);
    }
  };
  const roots = [...entries.keys()].filter((f) => !included.has(f)).sort(cmp);
  for (const r of roots) walk(r, "", 0);
}
