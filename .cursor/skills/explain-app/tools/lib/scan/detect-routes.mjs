// Screens and endpoints from file-system routing (Next, Nuxt, Astro, SvelteKit, Remix, TanStack, Expo, Gatsby)
// and from client-router declarations (<Route path>, { path, component }).
import { JS_EXT } from "./files.mjs";
import { exportedMethods, inferMethods } from "./facts.mjs";
import { normSegment, normRoutePath } from "./routes.mjs";
import { routeName } from "./names.mjs";
import { extname, pub } from "./util.mjs";

const NEXT_CONFIGS = ["next.config.js", "next.config.mjs", "next.config.ts", "next.config.cjs"];

function frameworks(ctx, pkg) {
  const c = ctx._fw || (ctx._fw = new Map());
  if (c.has(pkg)) return c.get(pkg);
  const { pkgIndex, allPathSet } = ctx;
  const f = {
    next: pkgIndex.hasDep(pkg, "next") || NEXT_CONFIGS.some((n) => allPathSet.has(pkg ? `${pkg}/${n}` : n)),
    nuxt: pkgIndex.hasDep(pkg, "nuxt") || pkgIndex.hasDep(pkg, "nuxt3") || pkgIndex.hasDepLike(pkg, /^@nuxt\//),
    astro: pkgIndex.hasDep(pkg, "astro"),
    svelte: pkgIndex.hasDep(pkg, "@sveltejs/kit"),
    remix: pkgIndex.hasDepLike(pkg, /^@remix-run\/(react|node|serve|dev|cloudflare|express)$/) || pkgIndex.hasDep(pkg, "@react-router/dev") || pkgIndex.hasDep(pkg, "@react-router/fs-routes"),
    tanstack: pkgIndex.hasDepLike(pkg, /^@tanstack\/(react-router|solid-router|react-start|solid-start|start|router-plugin|router-cli|router-vite-plugin)$/),
    expo: pkgIndex.hasDep(pkg, "expo-router"),
    gatsby: pkgIndex.hasDep(pkg, "gatsby"),
  };
  c.set(pkg, f);
  return f;
}

const idOf = (segs) => "/" + segs.join("/");

function addScreen(ctx, segs, file, pkg) {
  const id = "screen:" + idOf(segs);
  ctx.facts.add("screen", id, { name: routeName(idOf(segs)), file, meta: { package: pub(pkg) } });
}

function addEndpoint(ctx, segs, file, pkg, methods) {
  const id = "endpoint:" + idOf(segs);
  ctx.facts.add("endpoint", id, { name: routeName(idOf(segs)), file, meta: { package: pub(pkg), methods } });
}

// Next: drop route groups, skip parallel slots / intercepting / private folders.
function nextSegments(dirSegs) {
  const out = [];
  for (const s of dirSegs) {
    if (s.startsWith("@")) return null;
    if (/^\(\.{1,3}\)/.test(s)) return null;
    if (s.startsWith("_")) return null;
    if (/^\(.*\)$/.test(s)) continue;
    out.push(normSegment(s));
  }
  return out;
}

// Generic file-route segments: groups removed, index dropped.
function plainSegments(parts, { dropUnderscore = false } = {}) {
  const out = [];
  for (const s of parts) {
    if (/^\(.*\)$/.test(s)) continue;
    if (dropUnderscore && s.startsWith("_")) continue;
    out.push(normSegment(s));
  }
  return out;
}

export function detectFileRoutes(ctx) {
  const { sources } = ctx;
  const dirsWithFiles = new Set();
  for (const p of sources.keys()) {
    const i = p.lastIndexOf("/");
    if (i > 0) dirsWithFiles.add(p.slice(0, i));
  }

  for (const [p, src] of sources) {
    const ext = extname(p);
    if (!JS_EXT.has(ext)) continue;
    const pkg = ctx.pkgIndex.pkgOf(p);
    const rel = pkg ? p.slice(pkg.length + 1) : p;
    const F = frameworks(ctx, pkg);
    let m;

    // ---- Next.js ----
    if (F.next) {
      if ((m = /^(?:src\/)?app\/(?:(.*)\/)?(page|route)\.(?:tsx|ts|jsx|js|mjs)$/.exec(rel)) || (m = /^(?:src\/)?app\/()(page|route)\.(?:tsx|ts|jsx|js|mjs)$/.exec(rel))) {
        const segs = nextSegments(m[1] ? m[1].split("/") : []);
        if (segs) {
          if (m[2] === "page") addScreen(ctx, segs, p, pkg);
          else addEndpoint(ctx, segs, p, pkg, exportedMethods(src.code));
        }
        continue;
      }
      if ((m = /^(?:src\/)?pages\/(.+)\.(?:tsx|ts|jsx|js|mjs)$/.exec(rel))) {
        const parts = m[1].split("/");
        const last = parts[parts.length - 1];
        if (last.startsWith("_") || /^(404|500)$/.test(last) || parts.slice(0, -1).some((s) => s.startsWith("_"))) continue;
        const dir = parts.slice(0, -1);
        const segs = plainSegments(last === "index" ? dir : [...dir, last]);
        if (parts[0] === "api") addEndpoint(ctx, segs, p, pkg, inferMethods(src.code).concat(exportedMethods(src.code)));
        else if (!/\.(ts|js|mjs)$/.test(rel) || /export\s+default/.test(src.code)) addScreen(ctx, segs, p, pkg);
        continue;
      }
    }

    // ---- SvelteKit ----
    if (F.svelte && (m = /^src\/routes\/(?:(.*)\/)?\+(page\.svelte|server\.(?:ts|js))$/.exec(rel))) {
      const segs = plainSegments(m[1] ? m[1].split("/") : []);
      if (m[2] === "page.svelte") addScreen(ctx, segs, p, pkg);
      else addEndpoint(ctx, segs, p, pkg, exportedMethods(src.code));
      continue;
    }

    // ---- Nuxt ----
    if (F.nuxt) {
      if (ext === ".vue" && (m = /^(?:app\/)?pages\/(.+)\.vue$/.exec(rel))) {
        const parts = m[1].split("/");
        const last = parts.pop();
        const segs = plainSegments(last === "index" ? parts : [...parts, last.replace(/^_/, "$")]);
        addScreen(ctx, segs, p, pkg);
        continue;
      }
      if ((m = /^server\/(api|routes)\/(.+)\.(?:ts|js|mjs)$/.exec(rel))) {
        const parts = m[2].split("/");
        let last = parts.pop();
        let methods = [];
        const mm = /^(.*)\.(get|post|put|patch|delete|head|options)$/.exec(last);
        if (mm) {
          last = mm[1];
          methods = [mm[2].toUpperCase()];
        }
        const segs = plainSegments(last === "index" ? parts : [...parts, last]);
        if (m[1] === "api") segs.unshift("api");
        addEndpoint(ctx, segs, p, pkg, methods);
        continue;
      }
    }

    // ---- Astro ----
    if (F.astro && (m = /^src\/pages\/(.+)\.(astro|ts|js|mjs)$/.exec(rel))) {
      const parts = m[1].split("/");
      if (parts.some((s) => s.startsWith("_"))) continue;
      const last = parts.pop();
      const segs = plainSegments(last === "index" ? parts : [...parts, last]);
      if (m[2] === "astro") addScreen(ctx, segs, p, pkg);
      else addEndpoint(ctx, segs, p, pkg, exportedMethods(src.code));
      continue;
    }

    // ---- TanStack Router / Start ----
    if (F.tanstack && (m = /^(?:src\/|app\/)?routes\/(.+)\.(?:tsx|ts|jsx|js)$/.exec(rel))) {
      if (/\.gen$/.test(m[1]) || m[1] === "__root") continue;
      const parts = m[1].split("/");
      if (parts.some((s) => s.startsWith("-"))) continue;
      const flat = [];
      parts.forEach((part, i) => {
        if (i < parts.length - 1) flat.push(part);
        else for (const seg of part.replace(/\.lazy$/, "").split(".")) flat.push(seg);
      });
      let last = flat[flat.length - 1];
      if (flat.length && flat[0] === "__root") continue;
      // a pathless layout file with a directory of the same name only wraps its children
      const dirOfRoutes = rel.slice(0, rel.indexOf("routes/") + 7);
      const isLayoutFile = last.startsWith("_") && parts.length === 1 && dirsWithFiles.has((pkg ? pkg + "/" : "") + dirOfRoutes + last);
      if (isLayoutFile || last === "route") continue;
      const isServer = /createAPIFileRoute|createServerFileRoute|server:\s*\{[\s\S]{0,200}handlers/.test(src.code);
      let segs = flat.filter((s) => !(s.startsWith("_") && s !== "_"));
      segs = segs.map((s) => (s === "$" ? "[...splat]" : s.replace(/_$/, "")));
      segs = segs.filter((s) => s !== "index");
      segs = plainSegments(segs);
      if (isServer) {
        const methods = [];
        for (const mm of src.code.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s*:/g)) methods.push(mm[1]);
        addEndpoint(ctx, segs, p, pkg, methods);
      } else addScreen(ctx, segs, p, pkg);
      continue;
    }

    // ---- Remix / React Router framework mode ----
    if (F.remix && (m = /^app\/routes\/(.+)\.(?:tsx|ts|jsx|js)$/.exec(rel))) {
      let name = m[1];
      const parts = name.split("/");
      if (parts.length > 1) {
        if (parts[parts.length - 1] !== "route") continue;
        name = parts.slice(0, -1).join(".");
      }
      const flat = name.split(".").map((s) => s.replace(/_$/, ""));
      const segs = [];
      for (const s of flat) {
        if (s === "_index" || s === "") continue;
        if (s.startsWith("_") || s.startsWith("__")) continue;
        if (s === "$") segs.push("[...splat]");
        else if (/^\(\$?.*\)$/.test(s)) segs.push(normSegment(s.replace(/^\((.*)\)$/, "$1")));
        else segs.push(normSegment(s));
      }
      const isResource = !/export\s+default/.test(src.code) && /export\s+(?:async\s+)?(?:function|const)\s+(loader|action)\b/.test(src.code);
      if (isResource) addEndpoint(ctx, segs, p, pkg, []);
      else addScreen(ctx, segs, p, pkg);
      continue;
    }

    // ---- Expo Router ----
    if (F.expo && !F.next && (m = /^(?:src\/)?app\/(.+)\.(?:tsx|ts|jsx|js)$/.exec(rel))) {
      const parts = m[1].split("/");
      const last = parts.pop();
      if (/^[_+]/.test(last) || last.endsWith("+api") || parts.some((s) => /^[_+]/.test(s))) continue;
      addScreen(ctx, plainSegments(last === "index" ? parts : [...parts, last]), p, pkg);
      continue;
    }

    // ---- Gatsby ----
    if (F.gatsby && (m = /^src\/pages\/(.+)\.(?:tsx|ts|jsx|js)$/.exec(rel))) {
      const parts = m[1].split("/");
      const last = parts.pop();
      if (/^(404|500)$/.test(last) || last.startsWith("_")) continue;
      addScreen(ctx, plainSegments(last === "index" ? parts : [...parts, last]), p, pkg);
      continue;
    }

  }
}

const ROUTER_IMPORT = /from\s*['"](react-router(?:-dom)?|vue-router|wouter|@solidjs\/router|@angular\/router|@reach\/router)['"]|require\(\s*['"](react-router(?:-dom)?|vue-router)['"]\s*\)/;

// <Route path="/x" …> and { path: "/x", element|component: … } in files that import a client router.
export function detectClientRoutes(ctx) {
  for (const [p, src] of ctx.sources) {
    if (!JS_EXT.has(extname(p))) continue;
    const pkg = ctx.pkgIndex.pkgOf(p);
    const F = frameworks(ctx, pkg);
    if (F.next || F.remix || F.tanstack || F.svelte || F.nuxt || F.astro) continue;
    if (!ROUTER_IMPORT.test(src.code)) continue;
    const found = new Set();
    for (const m of src.code.matchAll(/<Route\b[^>]*?\bpath=(?:"([^"]*)"|'([^']*)'|\{\s*["'`]([^"'`]*)["'`]\s*\})/g)) found.add(m[1] ?? m[2] ?? m[3]);
    for (const m of src.code.matchAll(/\bpath:\s*(["'`])([^"'`\n]*)\1\s*,/g)) {
      const after = src.code.slice(m.index, m.index + 220);
      if (/\b(element|Component|component|lazy|loadComponent|children|redirectTo)\b/.test(after)) found.add(m[2]);
    }
    for (let raw of found) {
      if (raw == null) continue;
      raw = raw.trim();
      if (raw === "*" || raw === "") continue;
      if (/\s/.test(raw)) continue;
      const id = normRoutePath(raw.startsWith("/") ? raw : "/" + raw);
      addScreen(ctx, id.split("/").filter(Boolean), p, pkg);
    }
  }
}
