// Package (app root) detection, dependency lookup and tsconfig/jsconfig path aliases.
import { readSmall } from "./files.mjs";
import { parseJsonc } from "./tokenize.mjs";
import { basename, dirname, joinPath, cmp } from "./util.mjs";

const MANIFESTS = new Set([
  "package.json", "pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "Pipfile", "go.mod",
  "Cargo.toml", "Gemfile", "composer.json", "pom.xml", "build.gradle", "build.gradle.kts", "Package.swift",
]);
const SKIP_SEGS = new Set(["node_modules", "vendor", "venv", ".venv", "dist", "build", "out", "__pycache__", "site-packages", "bower_components", "test", "tests", "__tests__", "e2e", "public", "static", "assets"]);

function underSkipped(rel) {
  const segs = rel.split("/");
  for (let i = 0; i < segs.length - 1; i++) if (SKIP_SEGS.has(segs[i]) || segs[i].startsWith(".")) return true;
  return false;
}

export function buildPackageIndex(dir, allPaths) {
  const failures = []; // manifests we could not parse
  const manifests = new Map(); // dir -> { kinds:Set, json }
  for (const p of allPaths) {
    const b = basename(p);
    if (!MANIFESTS.has(b) || underSkipped(p)) continue;
    const d = dirname(p);
    let m = manifests.get(d);
    if (!m) manifests.set(d, (m = { kinds: new Set(), json: null }));
    if (b === "package.json") {
      const text = readSmall(dir, p);
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
        failures.push(p);
      }
      const isMarker = !json || (!json.name && !json.dependencies && !json.devDependencies && !json.scripts && !json.workspaces);
      if (isMarker) continue;
      m.json = json;
    }
    m.kinds.add(b);
  }
  for (const [d, m] of [...manifests]) if (m.kinds.size === 0) manifests.delete(d);

  const pkgCache = new Map();
  function pkgOfDir(d) {
    if (pkgCache.has(d)) return pkgCache.get(d);
    let r;
    if (manifests.has(d)) r = d;
    else if (d === "") r = "";
    else r = pkgOfDir(dirname(d));
    pkgCache.set(d, r);
    return r;
  }
  const pkgOf = (file) => pkgOfDir(dirname(file));

  const depCache = new Map();
  // Dependencies declared by this package and any package above it (monorepo hoisting).
  function depsOf(root) {
    if (depCache.has(root)) return depCache.get(root);
    const set = new Set();
    let d = root;
    for (;;) {
      const m = manifests.get(d);
      if (m && m.json) {
        for (const k of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
          for (const name of Object.keys(m.json[k] || {})) set.add(name);
        }
      }
      if (d === "") break;
      d = dirname(d);
    }
    depCache.set(root, set);
    return set;
  }
  const hasDep = (root, name) => depsOf(root).has(name);
  const hasDepLike = (root, re) => [...depsOf(root)].some((n) => re.test(n));

  const workspaces = new Map(); // package.json "name" -> root dir
  for (const [d, m] of manifests) if (m.json && m.json.name) workspaces.set(m.json.name, d);

  return { manifests, pkgOf, pkgOfDir, depsOf, hasDep, hasDepLike, workspaces, failures };
}

// ---- tsconfig / jsconfig ----

export function buildTsconfigResolver(dir, allPathSet) {
  const failures = [];
  const cfgCache = new Map();
  const nearestCache = new Map();

  function loadConfig(file, depth = 0) {
    if (cfgCache.has(file)) return cfgCache.get(file);
    cfgCache.set(file, null);
    const text = depth < 8 ? readSmall(dir, file) : null;
    const json = text ? parseJsonc(text) : null;
    if (!json || typeof json !== "object") {
      if (text) failures.push(file);
      return null;
    }
    const here = dirname(file);
    let eff = { baseUrl: null, paths: null, pathsDir: here };
    const ext = Array.isArray(json.extends) ? json.extends : json.extends ? [json.extends] : [];
    for (const e of ext) {
      if (typeof e !== "string" || !e.startsWith(".")) continue;
      let target = joinPath(here, e);
      if (target == null) continue;
      if (!/\.json$/.test(target)) target += ".json";
      const parent = loadConfig(target, depth + 1);
      if (parent) eff = { ...eff, ...parent };
    }
    const co = json.compilerOptions || {};
    if (typeof co.baseUrl === "string") eff.baseUrl = joinPath(here, co.baseUrl);
    if (co.paths && typeof co.paths === "object") {
      eff.paths = co.paths;
      eff.pathsDir = here;
    }
    if (eff.paths == null && eff.baseUrl == null && Array.isArray(json.references)) {
      for (const ref of json.references) {
        if (!ref || typeof ref.path !== "string") continue;
        let rp = joinPath(here, ref.path);
        if (rp == null) continue;
        if (!/\.json$/.test(rp)) rp += "/tsconfig.json";
        const sub = loadConfig(rp, depth + 1);
        if (sub && (sub.paths || sub.baseUrl != null)) {
          eff = { ...eff, baseUrl: sub.baseUrl, paths: sub.paths, pathsDir: sub.pathsDir };
          break;
        }
      }
    }
    cfgCache.set(file, eff);
    return eff;
  }

  function compile(eff, cfgDir) {
    const base = eff.baseUrl != null ? eff.baseUrl : eff.pathsDir;
    const rules = [];
    for (const [key, targets] of Object.entries(eff.paths || {})) {
      if (!Array.isArray(targets)) continue;
      const star = key.indexOf("*");
      const rule = {
        prefix: star < 0 ? key : key.slice(0, star),
        suffix: star < 0 ? "" : key.slice(star + 1),
        exact: star < 0,
        targets: targets.map((t) => joinPath(base, t)).filter((t) => t != null),
      };
      rules.push(rule);
    }
    rules.sort((a, b) => b.prefix.length - a.prefix.length || cmp(a.prefix, b.prefix));
    return { dir: cfgDir, baseUrl: eff.baseUrl, rules };
  }

  function nearest(dirRel) {
    if (nearestCache.has(dirRel)) return nearestCache.get(dirRel);
    let result = null;
    for (const name of ["tsconfig.json", "jsconfig.json"]) {
      const f = dirRel ? `${dirRel}/${name}` : name;
      if (allPathSet.has(f)) {
        const eff = loadConfig(f);
        if (eff) {
          result = compile(eff, dirRel);
          break;
        }
      }
    }
    if (!result && dirRel !== "") result = nearest(dirname(dirRel));
    nearestCache.set(dirRel, result);
    return result;
  }

  return { nearest, failures };
}
