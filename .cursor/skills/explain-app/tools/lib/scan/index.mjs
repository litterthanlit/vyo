// scanRepo: repo directory -> FactsFile (CONTRACTS §2). Deterministic, read-only, no dependencies.
import path from "node:path";
import { factsHash } from "../hash.mjs";
import { listFiles, readSourceFiles } from "./files.mjs";
import { scanJs, stripPy, stripSql, prepareMdx } from "./tokenize.mjs";
import { buildPackageIndex, buildTsconfigResolver } from "./packages.mjs";
import { resolveAll } from "./imports.mjs";
import { FactSet } from "./facts.mjs";
import { detectFileRoutes, detectClientRoutes } from "./detect-routes.mjs";
import { detectPythonEndpoints } from "./detect-python.mjs";
import { detectHttpEndpoints } from "./detect-http.mjs";
import { detectTables } from "./detect-tables.mjs";
import { detectJobs } from "./detect-jobs.mjs";
import { detectServices } from "./detect-services.mjs";
import { computeAreas, areaFacts, areaId } from "./areas.mjs";
import { detectUses } from "./uses.mjs";
import { detectKit } from "./kit.mjs";
import { cmp, extname, isUnder, pub, sortedUnique } from "./util.mjs";

const UNRESOLVED_CAP = 200;

// `useGit: false` lists files by walking the directory, even inside a git work tree: for a tree that was
// unpacked from a commit and must be read as it is, whatever repo its temp folder happens to sit in.
export function scanRepoDetailed(dirArg, { useGit = true } = {}) {
  const dir = path.resolve(dirArg);
  const diag = { errors: [], skipped: null, git: false, files: 0, ms: {} };
  const t0 = Date.now();
  const lap = (name, t) => (diag.ms[name] = Date.now() - t);

  let t = Date.now();
  const { paths: allPaths, git } = listFiles(dir, { useGit });
  diag.git = git;
  const allPathSet = new Set(allPaths);
  const { files: raw, skipped } = readSourceFiles(dir, allPaths);
  diag.skipped = skipped;
  lap("read", t);

  t = Date.now();
  const sources = new Map();
  for (const [rel, f] of raw) {
    const ext = extname(rel);
    const text = f.text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    let code;
    let strings = [];
    try {
      if (ext === ".py") code = stripPy(text);
      else if (ext === ".sql") code = stripSql(text);
      else if (ext === ".mdx") code = scanJs(prepareMdx(text)).code;
      else {
        const r = scanJs(text);
        code = r.code;
        strings = r.strings;
      }
    } catch (e) {
      diag.errors.push(`tokenize ${rel}: ${e.message}`);
      code = text;
    }
    sources.set(rel, { code, strings, loc: f.loc, gen: f.gen });
  }
  diag.files = sources.size;
  lap("tokenize", t);

  t = Date.now();
  const repoName = path.basename(dir);
  const pkgIndex = buildPackageIndex(dir, allPaths);
  const tsconfig = buildTsconfigResolver(dir, allPathSet);
  const res = resolveAll({ sources, allPathSet, pkgIndex, tsconfig });
  lap("imports", t);
  diag.parseFailures = [...pkgIndex.failures, ...tsconfig.failures].sort(cmp);

  const facts = new FactSet();
  const ctx = {
    dir, allPaths, allPathSet, sources, pkgIndex, facts, repoName,
    named: res.named, ext: res.ext, resolveSpec: res.resolveSpec,
  };
  const guard = (name, fn) => {
    const s = Date.now();
    try {
      return fn();
    } catch (e) {
      diag.errors.push(`${name}: ${e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ") : e}`);
      return undefined;
    } finally {
      diag.ms[name] = Date.now() - s;
    }
  };
  guard("routes", () => detectFileRoutes(ctx));
  guard("clientRoutes", () => detectClientRoutes(ctx));
  guard("python", () => detectPythonEndpoints(ctx));
  guard("http", () => detectHttpEndpoints(ctx));
  const tbl = guard("tables", () => detectTables(ctx)) || { drizzleVars: new Map(), pyClasses: new Map() };
  guard("jobs", () => detectJobs(ctx));
  const pkgUses = guard("services", () => detectServices(ctx)) || [];
  facts.splitPackageCollisions(pkgIndex.pkgOf);
  const baseFacts = facts.toFacts();

  const useSet = guard("uses", () => detectUses({ sources, facts: baseFacts, named: res.named, drizzleVars: tbl.drizzleVars, pyClasses: tbl.pyClasses })) || new Set();
  for (const [f, id, via] of pkgUses) useSet.add(`${f}\0${id}\0${via}`);

  const { areaOfFile, areas } = computeAreas({ sources, pkgIndex });

  // file records
  const defines = new Map();
  for (const f of baseFacts) {
    if (!["screen", "endpoint", "table", "job"].includes(f.kind)) continue;
    for (const file of f.files) {
      if (!defines.has(file)) defines.set(file, []);
      defines.get(file).push(f.id);
    }
  }
  const info = new Map();
  for (const [file, src] of sources) {
    const rec = { area: areaId(areaOfFile.get(file)), loc: src.loc };
    if (src.gen) rec.gen = 1;
    if (res.data.has(file)) rec.data = 1;
    if (defines.has(file)) rec.defines = defines.get(file).sort(cmp);
    info.set(file, rec);
  }
  const kit = detectKit({ imports: res.imports, info, pkgOf: pkgIndex.pkgOf });
  for (const k of kit) info.get(k).kit = 1;

  // a `routes` folder is "Pages" when its files declare screens, "Requests" when they declare endpoints
  const routesHint = (dir) => {
    let screens = 0;
    let endpoints = 0;
    for (const [file, ids] of defines) {
      if (!isUnder(file, dir)) continue;
      for (const id of ids) {
        if (id.startsWith("screen:")) screens++;
        else if (id.startsWith("endpoint:")) endpoints++;
      }
    }
    if (screens !== endpoints) return screens > endpoints ? "pages" : "requests";
    for (const file of sources.keys()) if (isUnder(file, dir) && /\.(tsx|jsx|vue|svelte|astro)$/.test(file)) return "pages";
    return "requests";
  };
  const allFacts = [...baseFacts, ...areaFacts(areas, repoName, routesHint)].sort((a, b) => cmp(a.id, b.id));

  const unresolved = {};
  [...res.unresolved].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0])).slice(0, UNRESOLVED_CAP).forEach(([k, n]) => (unresolved[k] = n));

  const pkgs = sortedUnique([...sources.keys()].map((f) => pub(pkgIndex.pkgOf(f))));
  const files = {};
  for (const [k, v] of [...info].sort((a, b) => cmp(a[0], b[0]))) files[k] = v;
  const useList = [...useSet].map((s) => s.split("\0")).sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]) || cmp(a[2], b[2]));

  const body = {
    version: 1,
    empty: !allFacts.some((f) => f.kind !== "area"),
    repo: { name: repoName, packages: pkgs.length ? pkgs : ["."] },
    facts: allFacts,
    files,
    imports: res.imports,
    uses: useList,
    unresolved,
  };
  const out = { ...body, hash: factsHash(body) };
  diag.ms.total = Date.now() - t0;
  diag.unresolvedTotal = [...res.unresolved.values()].reduce((a, b) => a + b, 0);
  diag.unresolvedTop = [...res.unresolved].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0])).slice(0, 10);
  return { facts: out, diag };
}

export function scanRepo(dir, opts) {
  return scanRepoDetailed(dir, opts).facts;
}
