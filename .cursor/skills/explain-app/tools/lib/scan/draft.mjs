// `draft`: a suggested PARTS array from facts. A starting point only: the agent rewrites names and lines.
import { MAX_NAME, clip, isJargon, plainAreaName } from "./names.mjs";
import { cmp, isUnder } from "./util.mjs";

const MAX_PARTS = 7;
const MAX_FEATURE = 4;
const CONVENTION_FILE = /(^|\/)(layout|loading|error|not-found|template|default|global-error)\.[^/]+$/;

const areaDir = (id) => (id === "area:." ? "" : id.slice(5));
// folders that hold plumbing rather than something a person would call a part of the app
const PLUMBING = /^(ui|primitives|icons|styles|theme|types|utils|config|constants|hooks|shared|common|assets|mocks|fixtures)$/i;

const lower = (s) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const list = (names) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`);

export function draftParts(facts) {
  const of = (k) => facts.facts.filter((f) => f.kind === k);
  const screens = of("screen");
  const endpoints = of("endpoint");
  const tables = of("table");
  const services = of("service");
  const ais = of("ai");
  const jobs = of("job");
  const areas = of("area");

  const jobFiles = new Set(jobs.flatMap((j) => j.files));
  const apiEndpoints = endpoints.filter((e) => !e.files.some((f) => jobFiles.has(f)));
  const excluded = endpoints.filter((e) => !apiEndpoints.includes(e));
  const wantApi = apiEndpoints.length > 0 && (screens.length === 0 || apiEndpoints.length >= 8);

  const parts = { screens: null, api: null, feature: [], ai: null, jobs: null, data: null, service: null };
  if (screens.length) {
    parts.screens = {
      name: "What you see",
      role: "screens",
      line: `When you move around, the app shows ${plural(screens.length, "screen", "screens")}.`,
      from: ["screen:**"],
    };
  }
  if (wantApi) {
    parts.api = {
      name: "Requests",
      role: "api",
      line: `When you ask for something, the app answers ${plural(apiEndpoints.length, "kind", "kinds")} of request.`,
      from: ["endpoint:**", ...excluded.map((e) => "!" + e.id)],
    };
  }
  if (ais.length) {
    parts.ai = {
      name: ais.length === 1 && `${ais[0].name} helper`.length <= MAX_NAME && !isJargon(ais[0].name) ? `${ais[0].name} helper` : ais.length === 1 ? "AI helper" : "AI helpers",
      role: "ai",
      line: `When you ask for help, the app asks ${list(ais.map((a) => a.name))}.`,
      from: ["ai:*"],
    };
  }
  if (jobs.length) {
    parts.jobs = {
      name: "Runs on its own",
      role: "jobs",
      line: `When you are away, the app runs ${plural(jobs.length, "job", "jobs")} by itself.`,
      from: ["job:**"],
    };
  }
  if (tables.length) {
    parts.data = {
      name: "Saved records",
      role: "data",
      line: `When you save something, the app keeps it as ${plural(tables.length, "kind", "kinds")} of record.`,
      from: ["table:*"],
    };
  }
  if (services.length) {
    parts.service = {
      name: "Outside services",
      role: "service",
      line: `When you use the app, the app leans on ${list(services.map((s) => s.name))}.`,
      from: ["service:*"],
    };
  }

  const others = ["screens", "api", "ai", "jobs", "data", "service"].filter((k) => parts[k]).length;
  const maxFeature = Math.max(0, Math.min(MAX_FEATURE, MAX_PARTS - others));

  // ---- feature candidates ----
  const fileEntries = Object.entries(facts.files);
  let totalLoc = 0;
  for (const [, f] of fileEntries) if (!f.gen) totalLoc += f.loc;
  const routeFacts = new Set([...screens, ...endpoints, ...jobs].map((f) => f.id));
  const stats = (dir) => {
    let loc = 0;
    let kit = 0;
    let covered = 0;
    for (const [file, f] of fileEntries) {
      if (f.gen || !isUnder(file, dir)) continue;
      loc += f.loc;
      if (f.kit) kit += f.loc;
      if ((f.defines || []).some((id) => routeFacts.has(id)) || CONVENTION_FILE.test(file)) covered += f.loc;
    }
    return { loc, kit, covered };
  };
  const leaves = areas.filter((a) => a.meta && a.meta.leaf);
  const scored = leaves.map((a) => ({ a, dir: areaDir(a.id), s: stats(areaDir(a.id)) })).sort((x, y) => y.s.loc - x.s.loc || cmp(x.a.id, y.a.id));
  const chosen = [];
  const take = (c) => {
    if (chosen.length >= maxFeature) return false;
    if (chosen.some((o) => isUnder(o.dir, c.dir) || isUnder(c.dir, o.dir))) return false;
    chosen.push(c);
    return true;
  };
  for (const c of scored) {
    if (c.s.loc === 0) continue;
    if (PLUMBING.test(c.dir.slice(c.dir.lastIndexOf("/") + 1))) continue;
    if (totalLoc > 0 && c.s.loc / totalLoc < 0.03) continue;
    if (c.s.kit / c.s.loc >= 0.5) continue;
    if (c.s.covered / c.s.loc >= 0.5) continue;
    take(c);
  }
  const have = () => others + chosen.length;
  if (have() < 2) {
    for (const c of scored) {
      if (have() >= 2) break;
      if (c.s.loc === 0) continue;
      take(c);
    }
  }
  const used = new Set();
  for (const c of chosen) {
    const base = plainAreaName(c.dir, facts.repo && facts.repo.name);
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${clip(base, MAX_NAME - 2)} ${n}`;
    used.add(name.toLowerCase());
    parts.feature.push({
      name,
      role: "feature",
      line: `When you use ${lower(name)}, the app handles it here.`,
      from: [c.a.id],
    });
  }

  return [parts.screens, parts.api, ...parts.feature, parts.ai, parts.jobs, parts.data, parts.service].filter(Boolean);
}
