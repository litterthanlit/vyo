// `show`: a plain-text summary of facts.json for the agent, with fact ids beside every item
// (the agent writes PARTS `from` patterns from these ids). CONTRACTS §2.6.
import { cmp } from "./util.mjs";

const pad = (s, n) => (s.length >= n ? s + "  " : s + " ".repeat(n - s.length) + "  ");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const noise = (s) => s === "api" || /^v\d+$/.test(s);

function groupKey(id, kind) {
  const path = id.slice(kind.length + 1).replace(/#.*$/, "");
  const segs = path.split("/").filter(Boolean);
  const real = segs.filter((s, i) => !(i < segs.length - 1 && noise(s) && segs.slice(0, i + 1).every(noise)));
  const first = real[0];
  if (!first) return "/";
  return /^\[/.test(first) ? "/" : first;
}

function section(title, lines) {
  return lines.length ? ["", title, ...lines] : [];
}

export function showFacts(facts) {
  const of = (k) => facts.facts.filter((f) => f.kind === k).sort((a, b) => cmp(a.id, b.id));
  const screens = of("screen");
  const endpoints = of("endpoint");
  const tables = of("table");
  const services = of("service");
  const ais = of("ai");
  const jobs = of("job");
  const areas = of("area");
  const out = [];
  let totalLoc = 0;
  let gen = 0;
  for (const f of Object.values(facts.files)) {
    if (f.gen) gen++;
    else totalLoc += f.loc;
  }
  out.push(`Repo: ${facts.repo.name}   hash ${facts.hash}`);
  out.push(`Packages: ${facts.repo.packages.join(", ")}`);
  out.push(`Source files: ${Object.keys(facts.files).length}${gen ? ` (${gen} generated)` : ""}   ${totalLoc} lines of code`);
  out.push(
    "Counts: " +
      [
        plural(screens.length, "screen", "screens"),
        plural(endpoints.length, "endpoint", "endpoints"),
        plural(tables.length, "table", "tables"),
        plural(services.length, "service", "services"),
        plural(ais.length, "AI provider", "AI providers"),
        plural(jobs.length, "job", "jobs"),
        plural(areas.length, "area", "areas"),
      ].join(", "),
  );
  const via = { http: 0, orm: 0, package: 0 };
  for (const u of facts.uses) via[u[2]]++;
  out.push(`Uses found: ${via.http} http, ${via.orm} orm, ${via.package} package`);
  if (facts.empty) out.push("", "No screens, endpoints, tables, services, AI or jobs were found: this repo is too small or too unusual to draw.");

  const grouped = (list, kind, render) => {
    const groups = new Map();
    for (const f of list) {
      const k = groupKey(f.id, kind);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(f);
    }
    const lines = [];
    const width = Math.max(...list.map((f) => f.id.length), 0);
    for (const [k, fs] of [...groups].sort((a, b) => cmp(a[0], b[0]))) {
      lines.push(`  ${k} (${fs.length})`);
      for (const f of fs) lines.push(`    ${pad(f.id, width)}${render(f)}`);
    }
    return lines;
  };

  out.push(...section(`SCREENS (${screens.length})  cite with screen:**`, grouped(screens, "screen", (f) => f.name)));
  out.push(...section(`ENDPOINTS (${endpoints.length})  cite with endpoint:**`, grouped(endpoints, "endpoint", (f) => `${f.name}${f.meta && f.meta.methods ? "  " + f.meta.methods.join(",") : ""}`)));

  const tw = Math.max(...tables.map((f) => f.id.length), 0);
  out.push(...section(`TABLES (${tables.length})  cite with table:*`, tables.map((f) => `  ${pad(f.id, tw)}${f.name}`)));
  const sw = Math.max(...services.map((f) => f.id.length), 0);
  out.push(
    ...section(
      `SERVICES (${services.length})  cite with service:*`,
      services.map((f) => `  ${pad(f.id, sw)}${pad(f.name, 14)}${f.meta && f.meta.vendor ? f.meta.vendor.join(", ") : ""}  (${plural(f.files.length, "file", "files")})`),
    ),
  );
  const aw = Math.max(...ais.map((f) => f.id.length), 0);
  out.push(
    ...section(
      `AI (${ais.length})  cite with ai:*`,
      ais.map((f) => `  ${pad(f.id, aw)}${pad(f.name, 14)}${f.meta && f.meta.tools ? plural(f.meta.tools, "tool", "tools") : "no tools found"}`),
    ),
  );
  const jw = Math.max(...jobs.map((f) => f.id.length), 0);
  out.push(...section(`JOBS (${jobs.length})  cite with job:**`, jobs.map((f) => `  ${pad(f.id, jw)}${pad(f.name, 18)}${f.meta && f.meta.schedule ? f.meta.schedule : "schedule unknown"}`)));

  const leaves = areas.filter((a) => a.meta && a.meta.leaf).sort((a, b) => (b.loc || 0) - (a.loc || 0) || cmp(a.id, b.id));
  const pct = (loc) => (totalLoc ? Math.max(0, Math.round((100 * loc) / totalLoc)) : 0);
  const lw = Math.max(...leaves.map((a) => a.id.length), 0);
  out.push(...section(`LEAF AREAS (${leaves.length})  cite with area:<dir>, one per feature part`, leaves.map((a) => `  ${pad(a.id, lw)}${pad(a.name, 18)}${pad(a.loc + " LOC", 9)}${pct(a.loc)}%`)));
  const dirOf = (a) => (a.id === "area:." ? "" : a.id.slice(5));
  const leafDirs = leaves.map(dirOf);
  const others = areas
    .filter((a) => !(a.meta && a.meta.leaf) && pct(a.loc || 0) >= 3 && leafDirs.some((d) => d !== dirOf(a) && (dirOf(a) === "" || d.startsWith(dirOf(a) + "/"))))
    .sort((a, b) => cmp(a.id, b.id));
  if (others.length) {
    const ow = Math.max(...others.map((a) => a.id.length), 0);
    out.push(...section(`OTHER BIG AREAS (${others.length})  folders that contain the leaves above`, others.map((a) => `  ${pad(a.id, ow)}${pad(a.name, 18)}${pad(a.loc + " LOC", 9)}${pct(a.loc)}%`)));
  }

  const kitFiles = Object.entries(facts.files).filter(([, f]) => f.kit).map(([p]) => p).sort(cmp);
  if (kitFiles.length) {
    const shown = kitFiles.slice(0, 25).map((p) => `  ${p}`);
    if (kitFiles.length > 25) shown.push(`  … and ${kitFiles.length - 25} more`);
    out.push(...section(`KIT FILES (${kitFiles.length})  shared plumbing, never counted as a link`, shown));
  }

  const pairs = new Map();
  for (const [from, to] of facts.imports) {
    const f = facts.files[from];
    const t = facts.files[to];
    if (!f || !t || f.area === t.area || f.gen || t.gen || t.kit || f.kit) continue;
    const k = `${f.area} -> ${t.area}`;
    pairs.set(k, (pairs.get(k) || 0) + 1);
  }
  const top = [...pairs].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0])).slice(0, 15);
  out.push(...section(`TOP CROSS-AREA IMPORTS (${Math.min(15, pairs.size)} of ${pairs.size})`, top.map(([k, n]) => `  ${pad(k, Math.max(...top.map((t) => t[0].length)))}${plural(n, "import", "imports")}`)));

  return out.join("\n") + "\n";
}
