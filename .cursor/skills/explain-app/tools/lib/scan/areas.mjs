// Areas and leaf flags (CONTRACTS §2.2).
import { areaName } from "./names.mjs";
import { basename, cmp, dirname, isUnder, pub } from "./util.mjs";

const MAX_LEVEL = 3;
const segCount = (d) => (d === "" ? 0 : d.split("/").length);
const areaId = (d) => "area:" + pub(d);

// sources: Map<file,{loc,gen}>. Returns { areaOfFile: Map<file,dir>, areas: Map<dir,{dir,loc,fileCount,leaf,pkg,parent}> }.
export function computeAreas({ sources, pkgIndex }) {
  const stat = new Map(); // dir -> { loc, files }
  const touch = (d) => {
    let s = stat.get(d);
    if (!s) stat.set(d, (s = { loc: 0, files: 0 }));
    return s;
  };
  for (const [file, src] of sources) {
    let d = dirname(file);
    for (;;) {
      const s = touch(d);
      if (!src.gen) {
        s.loc += src.loc;
        s.files += 1;
      }
      if (d === "") break;
      d = dirname(d);
    }
  }
  touch("");

  // source base per package
  const baseOf = new Map();
  const pkgRoots = new Set();
  for (const file of sources.keys()) pkgRoots.add(pkgIndex.pkgOf(file));
  for (const p of pkgRoots) {
    const src = p ? `${p}/src` : "src";
    const s = stat.get(src);
    baseOf.set(p, s && s.files > 0 ? src : p);
  }

  const anchorOf = (d) => {
    const p = pkgIndex.pkgOfDir(d);
    const b = baseOf.get(p);
    if (b != null && isUnder(d, b)) return b;
    return p;
  };
  const level = (d) => segCount(d) - segCount(anchorOf(d));
  const collapse = (d) => {
    while (d !== "" && level(d) > MAX_LEVEL) d = dirname(d);
    return d;
  };

  const isArea = (d) => {
    if (d === "") return true;
    if (level(d) > MAX_LEVEL) return false;
    const s = stat.get(d);
    return !!s && (s.files >= 3 || s.loc >= 100);
  };

  const areaOfFile = new Map();
  for (const file of sources.keys()) {
    let d = collapse(dirname(file));
    while (d !== "" && !isArea(d)) d = dirname(d);
    areaOfFile.set(file, d);
  }

  const areaDirs = new Set([""]);
  for (const d of stat.keys()) if (d !== "" && isArea(d)) areaDirs.add(d);
  const areas = new Map();
  for (const d of areaDirs) {
    let parent = null;
    if (d !== "") {
      let q = dirname(d);
      while (!areaDirs.has(q)) q = dirname(q);
      parent = q;
    }
    const s = stat.get(d) || { loc: 0, files: 0 };
    areas.set(d, { dir: d, loc: s.loc, fileCount: s.files, leaf: false, pkg: pkgIndex.pkgOfDir(d), parent, children: [] });
  }
  for (const a of areas.values()) if (a.parent != null) areas.get(a.parent).children.push(a.dir);
  for (const a of areas.values()) a.children.sort(cmp);

  // leaf marking, per package
  const pkgLoc = new Map();
  for (const [file, src] of sources) {
    if (src.gen) continue;
    const p = pkgIndex.pkgOf(file);
    pkgLoc.set(p, (pkgLoc.get(p) || 0) + src.loc);
  }
  const isRouteTree = (d, p) => {
    const base = baseOf.get(p);
    const name = basename(d);
    if (/^(app|pages|routes)$/.test(name) && (dirname(d) === base || dirname(d) === p)) return true;
    return d === (p ? `${p}/app/routes` : "app/routes");
  };
  const visit = (d, p, total) => {
    const a = areas.get(d);
    const allKids = a.children.map((k) => areas.get(k));
    const kids = allKids.filter((k) => k.pkg === p);
    // a folder that mostly holds other packages (the repo root of a monorepo) is a container, not a part
    const foreign = allKids.filter((k) => k.pkg !== p).reduce((n, k) => n + k.loc, 0);
    if (foreign > 0 && foreign >= 0.5 * a.loc) {
      for (const k of kids) visit(k.dir, p, total);
      return;
    }
    const big = kids.filter((k) => k.fileCount >= 3);
    let descend = false;
    if (kids.length > 0) {
      if (a.loc > 0.2 * total && big.length >= 2) descend = true;
      else if (isRouteTree(d, p)) descend = true;
      else if (a.loc > 0 && (d === p || d === baseOf.get(p))) {
        // a package whose code sits in one child is just a wrapper (backend/ -> backend/app)
        const top = [...kids].sort((x, y) => y.loc - x.loc)[0];
        if (top.loc >= 0.8 * a.loc && top.fileCount >= 3) descend = true;
      }
    }
    if (!descend) {
      a.leaf = true;
      return;
    }
    for (const k of kids) visit(k.dir, p, total);
  };
  for (const p of [...pkgRoots].sort(cmp)) {
    const total = pkgLoc.get(p) || 0;
    if (total === 0) continue;
    let start = baseOf.get(p);
    while (!areas.has(start)) start = dirname(start);
    visit(start, p, total);
  }
  return { areaOfFile, areas };
}

export function areaFacts(areas, repoName, hintFor) {
  return [...areas.values()]
    .map((a) => ({
      id: areaId(a.dir),
      kind: "area",
      name: areaName(a.dir, repoName, hintFor ? () => hintFor(a.dir) : undefined),
      files: [],
      loc: a.loc,
      meta: { fileCount: a.fileCount, leaf: a.leaf, package: pub(a.pkg) },
    }))
    .sort((x, y) => cmp(x.id, y.id));
}

export { areaId };
