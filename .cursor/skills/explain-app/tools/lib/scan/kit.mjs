// Kit files (CONTRACTS §2.4): shared plumbing imported from many areas.
import { cmp } from "./util.mjs";

// imports: [from,to][]; info: Map<file,{area, gen, defines}>; pkgOf(file) -> package root
export function detectKit({ imports, info, pkgOf }) {
  const importersByTarget = new Map();
  const importingAreasByPkg = new Map(); // pkg -> Set(area)
  for (const [from, to] of imports) {
    const fi = info.get(from);
    const ti = info.get(to);
    if (!fi || !ti || fi.gen || ti.gen) continue;
    if (!importersByTarget.has(to)) importersByTarget.set(to, new Set());
    importersByTarget.get(to).add(fi.area);
    const p = pkgOf(from);
    if (!importingAreasByPkg.has(p)) importingAreasByPkg.set(p, new Set());
    importingAreasByPkg.get(p).add(fi.area);
  }
  const kit = new Set();
  for (const [to, areas] of [...importersByTarget].sort((a, b) => cmp(a[0], b[0]))) {
    const ti = info.get(to);
    // database access layers (data:1) stay linkable: the data part owns them (§3.2 rule 3)
    if (ti.gen || ti.data || (ti.defines && ti.defines.length)) continue;
    const A = (importingAreasByPkg.get(pkgOf(to)) || new Set()).size;
    if (areas.size >= Math.max(4, Math.ceil(0.25 * A))) kit.add(to);
  }
  return kit;
}
