// `http` and `orm` uses (CONTRACTS §2.3). `package` uses come from detect-services.
import { JS_EXT } from "./files.mjs";
import { matchSegs, normRoutePath, segSuffixMatch } from "./routes.mjs";
import { extname } from "./util.mjs";

// Where a "/path" literal is a link, a redirect or a server-side mount rather than a request.
const NAV_BEFORE = /(?:\bhref|\bto|\bnavigate|\bredirect|\bpush|\breplace|\bpermanentRedirect|\brevalidatePath|\bredirectTo|\bcallbackUrl|\bprefetch|\.use|\.register|\.mount|\.route)\s*[=:(]?\s*\{?\s*$/;
const ASSET_TAIL = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|map|woff2?|ttf|otf|mp[34]|webm|pdf|txt|xml|html|md|zip)$/i;
const ORM_METHODS = "findMany|findUnique|findFirst|findFirstOrThrow|findUniqueOrThrow|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy";
const PRISMA_RE = new RegExp(`\\b(?:prisma|db|tx)\\.(?:query\\.)?(\\w+)\\.(?:${ORM_METHODS})\\b`, "g");
const TRPC_RE = /\b(?:api|trpc|client|utils|caller)\.(\w+)\.(\w+)\.(?:useQuery|useSuspenseQuery|useInfiniteQuery|useMutation|query|mutate|mutateAsync|fetch|prefetch|ensureData|invalidate|setData|useSubscription|subscribe)\b/g;

const tableKey = (name) => name.toLowerCase().replace(/_/g, "");
const singularKey = (k) => (k.endsWith("ies") ? k.slice(0, -3) + "y" : k.endsWith("s") ? k.slice(0, -1) : k);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// -> Set of "file\0factId\0via"
export function detectUses({ sources, facts, named, drizzleVars, pyClasses }) {
  const out = new Set();
  const add = (file, id, via) => out.add(`${file}\0${id}\0${via}`);

  // ---- http ----
  const endpoints = facts
    .filter((f) => f.kind === "endpoint")
    .map((f) => ({ id: f.id, segs: matchSegs(f.id.slice(9).replace(/#.*$/, "")), files: new Set(f.files), exact: normRoutePath(f.id.slice(9).replace(/#.*$/, "")) }));
  const screenPaths = new Set(
    facts.filter((f) => f.kind === "screen").map((f) => matchSegs(f.id.slice(7).replace(/#.*$/, "")).join("/")),
  );
  const trpcIds = new Set(endpoints.filter((e) => e.id.startsWith("endpoint:/trpc/")).map((e) => e.id));

  for (const [file, src] of sources) {
    if (!JS_EXT.has(extname(file))) continue;
    const strings = src.strings || [];
    if (endpoints.length && strings.length) {
      let n = 0;
      for (const s of strings) {
        if (++n > 400) break;
        let v = s.value;
        if (v.length < 2 || /\s/.test(v) || v.startsWith("//") || /[<>]/.test(v)) continue;
        v = v.replace(/\u0001/g, "[p]");
        const cut = v.search(/[?#]/);
        if (cut >= 0) v = v.slice(0, cut);
        if (!v.startsWith("/") || ASSET_TAIL.test(v)) continue;
        const before = src.code.slice(Math.max(0, s.pos - 40), s.pos);
        if (NAV_BEFORE.test(before)) continue;
        const segs = matchSegs(v);
        if (segs.length === 0) continue;
        if (/\[\.\.\./.test(normRoutePath(v))) continue; // "/api/:path*" is a pattern (a matcher), not a request
        const norm = normRoutePath(v);
        const isScreen = screenPaths.has(segs.join("/"));
        // among the matches, keep the tightest: "/api/users/${id}" is [userId], not the static /api/users/stripe
        let best = Infinity;
        const hits = [];
        for (const e of endpoints) {
          if (e.files.has(file)) continue;
          const swallowed = segSuffixMatch(segs, e.segs);
          if (swallowed == null) continue;
          if (isScreen && norm !== e.exact) continue;
          hits.push([e, swallowed]);
          if (swallowed < best) best = swallowed;
        }
        for (const [e, swallowed] of hits) if (swallowed === best) add(file, e.id, "http");
      }
    }
    if (trpcIds.size) {
      TRPC_RE.lastIndex = 0;
      let m;
      while ((m = TRPC_RE.exec(src.code))) {
        const id = `endpoint:/trpc/${m[1]}.${m[2]}`;
        if (trpcIds.has(id)) add(file, id, "http");
      }
    }
  }

  // ---- orm ----
  const tables = facts.filter((f) => f.kind === "table");
  const byKey = new Map();
  for (const t of tables) byKey.set(tableKey(t.id.slice(6)), t.id);
  const lookup = (accessor) => {
    const k = tableKey(accessor);
    return byKey.get(k) || byKey.get(singularKey(k)) || byKey.get(k + "s") || null;
  };
  if (tables.length) {
    for (const [file, src] of sources) {
      const ext = extname(file);
      if (JS_EXT.has(ext)) {
        if (!/\b(prisma|db|tx)\./.test(src.code)) continue;
        PRISMA_RE.lastIndex = 0;
        let m;
        while ((m = PRISMA_RE.exec(src.code))) {
          const id = lookup(m[1]);
          if (id) add(file, id, "orm");
        }
      }
    }
    // Drizzle: a table variable imported from the schema and referenced in the file
    for (const [file, list] of named) {
      const src = sources.get(file);
      if (!src || !JS_EXT.has(extname(file))) continue;
      for (const e of list) {
        const vars = drizzleVars.get(e.to);
        if (!vars || e.to === file) continue;
        for (const n of e.names) {
          const id = vars.get(n.imported);
          if (!id) continue;
          const hits = src.code.match(new RegExp(`(?<![\\w$.])${escRe(n.local)}\\b`, "g"));
          if (hits && hits.length >= 2) add(file, id, "orm");
        }
      }
    }
    // Python: model classes imported from the file that declares them
    for (const [file, list] of named) {
      if (!file.endsWith(".py")) continue;
      const src = sources.get(file);
      if (!src) continue;
      for (const e of list) {
        const classes = pyClasses.get(e.to);
        if (!classes || e.to === file) continue;
        const candidates = [];
        for (const n of e.names) if (classes.has(n.imported)) candidates.push([n.local, classes.get(n.imported)]);
        if (e.module) {
          for (const [cls, id] of classes) {
            if (new RegExp(`\\b${escRe(e.module)}\\.${escRe(cls)}\\b`).test(src.code)) add(file, id, "orm");
          }
        }
        for (const [local, id] of candidates) {
          const L = escRe(local);
          const re = new RegExp(`(?:^|[^\\w.])${L}\\s*\\(|[(,]\\s*${L}\\s*[,)]|\\b${L}\\.(?:objects|query|model_validate|select|get|filter)\\b`, "m");
          if (re.test(src.code)) add(file, id, "orm");
        }
      }
    }
  }
  return out;
}
