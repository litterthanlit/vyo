#!/usr/bin/env node
// Vyo: repo -> facts.json -> poster spec -> poster (HTML, PNG, PDF), checked.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { pathToFileURL, fileURLToPath } from "node:url";
import { stableStringify, factsHash } from "./lib/hash.mjs";
import { scanRepoDetailed } from "./lib/scan/index.mjs";
import { showFacts, hiddenCodeHint } from "./lib/scan/show.mjs";
import { scaffoldSpec, validateSpec, THEMES, PLACEHOLDER } from "./lib/spec.mjs";
import { SHAPE_STYLES } from "./lib/fields/shape.mjs";
import { sketch, sketchImage } from "./lib/sketch.mjs";
import { SHAPE_KEYS, GRID, ADVANCE, SHEET } from "./lib/geometry.mjs";
import { SHAPE_KINDS, SHAPE_ROOM } from "./lib/mask.mjs";
import { buildPage, renderPage, PAPERS, floorFor, FLOOR_STEP, fieldSpace } from "./lib/render.mjs";
import { ROLES, FRAMES, scaffoldPlaces } from "./lib/frame.mjs";
import { cornersLine } from "./lib/geometry.mjs";
import { runChecks, CHECKS } from "./lib/check.mjs";
import { NoBrowser } from "./lib/browser.mjs";
import { init, chooseEditors, EDITORS } from "./lib/init.mjs";
import { FIELDS } from "./lib/fields/index.mjs";
import { partsFromFacts, partOptions, regionParts, accentIds, unplainName, sameNames, dominance, PART_DEFAULTS } from "./lib/parts.mjs";

const USAGE = `Usage:
  vyo init    [--cursor] [--claude] [--codex] [--dir <repo-dir>]
  vyo scan    <repo-dir> --out <dir>/<repo>-facts.json
  vyo show    <facts.json>
  vyo presets [<id>]
  vyo parts   <facts.json> [--field ${Object.keys(FIELDS).join("|")}] [--split <part id>]...
  vyo compose <facts.json> [--frame ${FRAMES.join("|")}] [--field ${Object.keys(FIELDS).join("|")}] [--accent <part id>] [--split <part id>]... [--style ${Object.keys(SHAPE_STYLES).join("|")}] [--from <preset>] [--theme light|dark] [--repo <repo-dir>] [--out <spec.json>] [--force]
  vyo sketch  <spec.json> [--facts <facts.json>]
  vyo render  <spec.json> [--facts <facts.json>] [--out <dir>] [--no-png] [--no-pdf] [--paper ${PAPERS.join("|")}]
  vyo check   <spec.json> [--facts <facts.json>]

Exit codes: 0 ok (warnings start with "! "), 1 a rule failed (lines start with "✗ "), 2 usage.`;

const err = (s) => process.stderr.write(s + "\n");
const warn = (s) => err("! " + s);
const fail = (s) => err("✗ " + s);

class Usage extends Error {}
class Failure extends Error {}

function args(argv, options, count) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options, allowPositionals: true });
  } catch (e) {
    throw new Usage(e.message);
  }
  if (parsed.positionals.length !== count) throw new Usage(`expected ${count} argument${count === 1 ? "" : "s"}, got ${parsed.positionals.length}`);
  return { pos: parsed.positionals, opt: parsed.values };
}

function readJson(file, what) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    throw new Failure(`cannot read ${file}: ${e.code || e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Failure(`${file} is not valid JSON (${what}): ${e.message}`);
  }
}

function readFacts(file) {
  const facts = readJson(file, "facts.json");
  if (!facts || facts.version !== 1 || !Array.isArray(facts.facts) || typeof facts.files !== "object") {
    throw new Failure(`${file} is not a facts.json (expected version 1 with facts and files); run vyo scan`);
  }
  if (facts.hash !== factsHash(facts)) warn(`${file}: hash does not match its content; was it edited by hand?`);
  return facts;
}

const isInside = (child, parent) => {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};
const realOrResolved = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
};

function cmdScan(argv) {
  const { pos, opt } = args(argv, { out: { type: "string" } }, 1);
  if (!opt.out) throw new Usage("scan needs --out <facts.json>");
  const dir = path.resolve(pos[0]);
  if (!fs.existsSync(dir)) throw new Failure(`${pos[0]} does not exist`);
  if (!fs.statSync(dir).isDirectory()) throw new Failure(`${pos[0]} is not a directory`);
  const out = opt.out;
  if (out !== "-") {
    const outAbs = path.resolve(out);
    const outReal = path.join(realOrResolved(path.dirname(outAbs)), path.basename(outAbs));
    const inVyo = path.dirname(outAbs) === path.join(dir, "vyo") || path.dirname(outReal) === path.join(realOrResolved(dir), "vyo");
    if (!inVyo && (isInside(outAbs, dir) || isInside(outReal, realOrResolved(dir)))) {
      throw new Failure(`--out ${out} is inside the scanned repo; the scanner never writes there, except ${pos[0]}/vyo/. Pick a path outside ${pos[0]}`);
    }
  }
  const { facts, diag } = scanRepoDetailed(dir);
  const text = stableStringify(facts, 1);
  if (out === "-") process.stdout.write(text);
  else {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, text);
  }
  const n = (k) => facts.facts.filter((f) => f.kind === k).length;
  const pl = (k, one, many) => `${n(k)} ${n(k) === 1 ? one : many}`;
  const loc = Object.values(facts.files).reduce((s, f) => s + (f.gen ? 0 : f.loc), 0);
  const summary =
    `Scanned ${facts.repo.name}: ${pl("screen", "screen", "screens")}, ${pl("endpoint", "endpoint", "endpoints")}, ${pl("table", "table", "tables")}, ` +
    `${pl("service", "service", "services")}, ${n("ai")} AI, ${pl("job", "job", "jobs")}, ${pl("area", "area", "areas")}, ` +
    `${Object.keys(facts.files).length} files, ${loc} lines${out === "-" ? "" : ` → ${out}`} (hash ${facts.hash})`;
  (out === "-" ? process.stderr : process.stdout).write(summary + "\n");
  if (facts.empty) warn("No screens, endpoints, tables, services, AI or jobs found: nothing to count.");
  const hidden = hiddenCodeHint(facts);
  if (hidden) warn(hidden);
  const x = facts.excluded;
  if (x.files) {
    const top = Object.entries(x.by).sort((a, b) => b[1].lines - a[1].lines || (a[0] < b[0] ? -1 : 1)).slice(0, 5);
    warn(`Left out ${x.files} source file${x.files === 1 ? "" : "s"} (${x.lines} lines) as tests, build output, vendored or hidden code: ${top.map(([k, v]) => `${k} ${v.files} files/${v.lines} lines`).join(", ")}${Object.keys(x.by).length > top.length ? ", …" : ""}`);
  }
  const s = diag.skipped;
  if (s.big || s.binary || s.unreadable || s.capped) warn(`Skipped files: ${s.big} over 512 KB, ${s.binary} binary, ${s.unreadable} unreadable, ${s.capped} past the 20000-file cap`);
  if (diag.parseFailures.length) warn(`Could not parse ${diag.parseFailures.length} config file(s): ${diag.parseFailures.slice(0, 3).join(", ")}`);
  if (diag.errors.length) warn(`${diag.errors.length} detector problem(s), results may be partial: ${diag.errors.slice(0, 3).join(" | ")}`);
  return 0;
}

const pct = (n) => `${n > 0 && n < 0.01 ? Math.round(n * 1000) / 10 : Math.round(n * 100)}%`;

function cmdParts(argv) {
  const { pos, opt } = args(argv, { field: { type: "string" }, split: { type: "string", multiple: true } }, 1);
  if (opt.field !== undefined && !FIELDS[opt.field]) throw new Usage(`--field ${opt.field} is not a field; use ${Object.keys(FIELDS).join(" or ")}`);
  if (opt.split && opt.field !== "shape") throw new Usage("--split cuts a part of a shape field; pass --field shape");
  const facts = readFacts(pos[0]);
  const options = partOptions({ field: opt.field, ...(opt.split ? { split: opt.split } : {}) });
  const parts = partsFromFacts(facts, options);
  const lines = parts.reduce((s, p) => s + p.loc, 0);
  const files = parts.reduce((s, p) => s + p.files, 0);
  const width = Math.max(2, ...parts.map((p) => p.id.length));
  const twin = new Map(sameNames(parts).flatMap((g) => g.map((p) => [p.id, g.filter((q) => q !== p).map((q) => q.id).join(", ")])));
  const flag = (p) => (unplainName(p.name) ? "  ! looks like a vendor or code name" : twin.has(p.id) ? `  ! same name as ${twin.get(p.id)}` : "");
  const out = [
    `${facts.repo.name}: ${parts.length} parts${opt.field ? ` of a ${opt.field}` : ""}, ${lines} lines in ${files} files (parts under ${pct(options.minShare ?? PART_DEFAULTS.minShare)} of the lines merge into their parent; at most ${options.maxParts ?? PART_DEFAULTS.maxParts})`,
    `${"id".padEnd(width)}  share  lines  files  name`,
    ...parts.map((p) =>
      `${p.id.padEnd(width)}  ${pct(lines ? p.loc / lines : 0).padStart(5)}  ${String(p.loc).padStart(5)}  ${String(p.files).padStart(5)}  ${p.name}${flag(p)}`,
    ),
    "Set a field's accent to one id. Give each flagged part a plain name in the field's names, keyed by its id.",
    ...dominantLines(facts, options, pos[0], opt.field),
  ];
  process.stdout.write(out.join("\n") + "\n");
  return 0;
}

/** The `!` lines `vyo parts` adds when one part is most of the code or there are too few parts. */
function dominantLines(facts, options, file, field) {
  const d = dominance(facts, options);
  if (!d) return [];
  const what = `! "${d.part.name}" (${d.part.id}) holds ${pct(d.share)} of the lines among ${d.count} parts; as a shape's accent it draws one slab of orange`;
  if (!d.split) return [`${what}, and it has no folders inside it to split: put the accent on a smaller part.`];
  const flags = [...(options.split ?? []), d.split.id].map((id) => `--split ${id}`).join(" ");
  return [`${what}. Split it into the folders inside it: vyo parts ${file} --field shape ${flags} gives ${d.split.count} parts, the largest ${pct(d.split.largest)}${field === "shape" ? "" : " (a shape field only)"}; then write "split": [${[...(options.split ?? []), d.split.id].map((id) => `"${id}"`).join(", ")}] in the region and put the accent on one of them.`];
}

function cmdShow(argv) {
  const { pos } = args(argv, {}, 1);
  process.stdout.write(showFacts(readFacts(pos[0])));
  return 0;
}

const PRESET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "presets");
/** @returns {Record<string, import("./lib/spec.mjs").Spec>} */
function loadPresets() {
  return Object.fromEntries(
    fs.readdirSync(PRESET_DIR).filter((f) => f.endsWith(".json")).sort().map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(PRESET_DIR, f), "utf8"))]),
  );
}

const shapeOf = (r) => (r.kind === "field" ? `${r.field} field${r.accent ? `, accent ${r.accent}` : ""}` : r.kind === "dots" ? `dots, ${r.lines.length} lines` : `${SHAPE_KEYS.find((k) => r[k] !== undefined)}${r.holes ? ` with ${r.holes.length} hole${r.holes.length === 1 ? "" : "s"}` : ""}${r.hot ? ", hot" : ""}`);

function cmdPresets(argv) {
  const { pos } = args(argv, {}, argv.filter((a) => !a.startsWith("-")).length ? 1 : 0);
  const presets = loadPresets();
  if (pos.length) {
    const p = presets[pos[0]];
    if (!p) throw new Usage(`${pos[0]} is not a preset; one of ${Object.keys(presets).join(", ")}`);
    process.stdout.write(JSON.stringify(p.figure, null, 2) + "\n");
    return 0;
  }
  const out = [];
  for (const [id, p] of Object.entries(presets)) {
    out.push(
      id,
      `  fits: ${p.figure.fits ?? p.figure.regions.find((r) => r.kind === "field").fits}`,
      `  frame: ${p.frame ?? "loose"}, theme: ${p.theme}${p.accent ? ` with accent ${p.accent}` : ""}${p.notes ? `, ${p.notes.length} notes` : ""}`,
      `  regions: ${p.figure.regions.map((r) => `${r.id} (${shapeOf(r)})`).join(", ")}`,
      `  texts: ${p.figure.texts.map((t) => `${t.id} (${t.role}${t.hot ? ", hot" : ""})`).join(", ")}`,
      "",
    );
  }
  out.push("vyo presets <id> prints its figure; vyo compose <facts.json> --from <id> starts a spec from it.");
  process.stdout.write(out.join("\n") + "\n");
  return 0;
}

/** The numbers an agent places texts and regions by, printed by compose. */
function authoringNotes(notes, field) {
  const floor = floorFor(notes, 1);
  const aside = 12;
  return [
    `floor: ${floor}`,
    `  the footer's top for ${notes} notes and a one-line not-built list; each extra not-built line raises it ${FLOOR_STEP}px. Keep every region and text above it.`,
    `  The usual figure band is y 170 to ${floor}.`,
    `masthead: ${ROLES.swiss.masthead.lh(84)}px per line at size 84; it shrinks to fit w.`,
    `headline: ${ROLES.swiss.headline.lh(22)}px per line at size 22; a 224px column wraps it to 2 or 3 lines.`,
    `aside: ${ROLES.swiss.aside.lh(aside)}px per line, ${Math.round(ADVANCE * aside * 10) / 10}px per character at size ${aside}.`,
    ...(field
      ? [`field: ${field}, ${FIELDS[field].about}. Its rows come from the scan and skip the text blocks; move a text block and the field makes room.`]
      : [
          `rows: ${GRID[12].pitch}px apart at size 12, ${GRID[11].pitch}px at size 11, on a grid from the top of the sheet.`,
          "Pick a silhouette a person would name at thumbnail size and that acts out the main moment; hearts, circles and plain boxes are the defaults to avoid.",
        ]),
  ];
}

/** The numbers an agent places the loose frame's texts by, printed by compose. */
function looseNotes(field, space) {
  const L = ROLES.loose;
  const at = (r) => `${L[r].size[0]}px (${L[r].size[1]} to ${L[r].size[2]}), ${L[r].lh(L[r].size[0])}px per line`;
  return [
    `field: ${field}, ${FIELDS[field].about}. ${field === "shape" ? "No text sits on it." : "It runs to every edge it reaches; no text sits on it."}`,
    ...(field === "shape"
      ? ["texts: no coordinates. The engine places the label, headline, legend and paragraph in the room the shape leaves, in reading order, the headline sized to fit; vyo sketch prints where. Give a block x and y only to pin it there."]
      : [cornersLine(space.corners), "  Compose put the headline in the largest corner, the label in the smallest, the list in the tallest and the legend nearest the accent part. Move them within the corners; vyo sketch prints the corners again."]),
    `label ${at("label")}: the product name in capitals.`,
    `headline ${at("headline")}: the only large type, ragged on the side that faces the field (align right in a right corner).`,
    `paragraph ${at("paragraph")}: 0 to 2 of them, at most 2 sentences and ${L.paragraph.max} characters each.`,
    `legend ${at("legend")}: exactly one, at most 2 sentences and ${L.legend.max} characters, naming the accent part and the measure.`,
    `list ${at("list")}: parts: true prints the parts' plain names, one per line. rule ${at("rule")}: one character repeated across w.`,
    "record: render writes it at the bottom edge, or up the left edge when the field covers the bottom; set record to bottom or left to choose.",
    ...(field === "shape" ? shapeNotes() : []),
  ];
}

/** The shape format in a few lines, printed by compose --field shape. */
function shapeNotes() {
  const kinds = Object.entries(SHAPE_KINDS).map(([k, keys]) => `${k} {${Object.keys(keys).join(", ")}}`).join(", ");
  const R = SHAPE_ROOM;
  return [
    'shape: replace the placeholder with your silhouette, ops painted in order into one mask: { "ops": [...], "rotate": deg, "fit": { "w", "h", "cx", "cy" } }',
    `  each op is { "add": kind, ... } or { "cut": kind, ... }, the first an add. Kinds: ${kinds}.`,
    '  example: { "add": "rect", "at": [16, 0], "size": [68, 16], "round": 3 }. ellipse r is [rx, ry]; arc from and to are degrees clockwise from twelve o\'clock; any op takes rotate about its own centre.',
    "  Coordinates are free units, y down: the engine measures what you painted and fits it.",
    `  Leave fit out: the shape is then as large as fits ${R.left}px in from the sides, ${R.top}px below the top (room for the words) and ${R.bottom}px above the bottom, and never bleeds; the engine then centres it in the room the words leave.`,
    "  fit.w or fit.h sets its share of the sheet's width or height instead (over 1 bleeds off, and the sketch says which edges), fit.cx and fit.cy its centre.",
    '  style: "bands" (the default) cuts it top to bottom and suits any outline; "rings" sets the names round the outline, ring inside ring, for a fat, round object, with "echo": 0 to 12 faded outlines; "relief" draws any outline as a lit volume.',
    '  Relief reads optional hints: "face": "lit" or "dim" on an add, { "crease": kind, ... } ops (a fold, never the outline), region "bevel" 0 to 1 and "strata" { "by": "angle", "angle" } or { "by": "depth" }.',
  ];
}

function git(dir, format) {
  try {
    return execFileSync("git", ["-C", dir, "log", "-1", `--format=${format}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
  } catch {
    return undefined;
  }
}

function cmdCompose(argv) {
  const { pos, opt } = args(
    argv,
    { frame: { type: "string" }, field: { type: "string" }, accent: { type: "string" }, split: { type: "string", multiple: true }, from: { type: "string" }, theme: { type: "string" }, style: { type: "string" }, repo: { type: "string" }, out: { type: "string" }, force: { type: "boolean" } },
    1,
  );
  const presets = loadPresets();
  const preset = opt.from === undefined ? undefined : presets[opt.from];
  if (opt.from !== undefined && !preset) throw new Usage(`--from ${opt.from} is not a preset; one of ${Object.keys(presets).join(", ")}`);
  const fieldPreset = preset?.figure.regions.find((r) => r.kind === "field");
  if (fieldPreset) throw new Usage(`--from ${opt.from} is a field preset, drawn from its own scan; use --field ${fieldPreset.field}`);
  if (preset && (opt.field !== undefined || opt.accent !== undefined)) throw new Usage("--field and --accent make a field poster; --from starts from a fill preset. Pass one or the other");
  const field = preset ? undefined : (opt.field ?? "wave");
  if (field && !FIELDS[field]) throw new Usage(`--field ${field} is not a field; use ${Object.keys(FIELDS).join(" or ")}`);
  const frame = opt.frame ?? preset?.frame ?? "loose";
  if (!FRAMES.includes(frame)) throw new Usage(`--frame ${frame} is not a frame; use ${FRAMES.join(" or ")}`);
  if (field && FIELDS[field].frames && !FIELDS[field].frames.includes(frame)) throw new Usage(`--field ${field} draws only in the ${FIELDS[field].frames.join(" or ")} frame; leave out --frame`);
  if (preset && frame !== preset.frame) throw new Usage(`--from ${opt.from} is a ${preset.frame} preset; the loose frame draws a field, so use --field`);
  const theme = opt.theme ?? preset?.theme ?? "light";
  if (!THEMES.includes(theme)) throw new Usage(`--theme ${theme} is not a theme; use ${THEMES.join(" or ")}`);
  const facts = readFacts(pos[0]);
  let commit;
  let date;
  if (opt.repo) {
    commit = git(opt.repo, "%h");
    date = git(opt.repo, "%cs");
    if (!commit) warn(`${opt.repo} has no git history; the ${frame === "loose" ? "record line" : "footer"} will show no commit`);
  } else if (frame === "loose") warn("no --repo, so no commit: the loose frame's record line needs one; set product.commit or compose again with --repo");
  date ??= new Date().toISOString().slice(0, 10);
  const out = opt.out ?? path.join(path.dirname(pos[0]), `${facts.repo.name}-poster.json`);
  if (fs.existsSync(out) && !opt.force) throw new Failure(`${out} exists; it may hold your words. Pass --force to replace it with a fresh scaffold`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  if (opt.split && field !== "shape") throw new Usage("--split cuts a part of a shape field; pass --field shape");
  if (opt.style !== undefined && field !== "shape") throw new Usage("--style picks a shape field's look; pass --field shape");
  if (opt.style !== undefined && !SHAPE_STYLES[opt.style]) throw new Usage(`--style ${opt.style} is not a style; use ${Object.keys(SHAPE_STYLES).join(", ")}`);
  const parts = partsFromFacts(facts, partOptions({ field, ...(opt.split ? { split: opt.split } : {}) }));
  if (opt.accent !== undefined && !accentIds(parts, opt.accent).size) throw new Usage(`--accent ${opt.accent} names no part; vyo parts ${pos[0]} lists the part ids`);
  if (field && !parts.length) throw new Failure(`no parts to draw; the scan found no code. Compose a fill poster instead: vyo compose ${pos[0]} --from <preset> (vyo presets lists them)`);
  const twins = new Set(sameNames(parts).flat());
  const unplain = parts.filter((p) => unplainName(p.name) || twins.has(p));
  const notes = preset ? preset.notes.length : 3;
  const o = { frame, theme, commit, date, floor: floorFor(notes, 1), preset, field, accent: opt.accent, split: opt.split, style: opt.style, parts };
  let space;
  if (frame === "loose") {
    const draft = scaffoldSpec(facts, { ...o, places: {} });
    const region = draft.figure.regions[0];
    // The names are placeholders until the agent writes them, so only a name it already gave can be quoted.
    o.accentNames = regionParts(region, facts).filter((p) => p.hot && !p.name.startsWith(PLACEHOLDER)).map((p) => p.name);
    // A shape is not drawn yet, so its words carry no coordinates: the engine places them around it.
    if (field === "shape") o.places = { label: {}, headline: {}, legend: {}, paragraph: {} };
    else {
      // Lay the field out on its own sheet, then fill the corners it leaves.
      space = fieldSpace(draft, facts);
      o.places = scaffoldPlaces(space.corners, space.accent, parts.length);
    }
  }
  fs.writeFileSync(out, JSON.stringify(scaffoldSpec(facts, o), null, 2) + "\n");
  const from = preset ? `the ${opt.from} preset's geometry and its words taken out` : `a ${field} field of ${parts.length} parts${opt.accent ? ` with ${opt.accent} in the accent` : ""}`;
  const lines = [
    `Wrote ${out}: a scaffold with ${from}. Replace every "…" value, then run vyo sketch ${out}, adjust, sketch again, then vyo render ${out}`,
    ...(field ? [`vyo parts ${pos[0]}${field === "wave" ? "" : ` --field ${field}`} lists the parts: pick the accent by its id and give every part a plain name in names${unplain.length ? ` (${unplain.length} flagged by vyo parts must not keep their scanned name)` : ""}.`] : []),
    ...(frame === "loose" ? looseNotes(field, space) : authoringNotes(notes, field)),
  ];
  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}

/** The facts file a spec was written for: --facts, or <repo>-facts.json beside the spec. */
function factsFor(specFile, spec, opt) {
  const repo = spec && spec.product && typeof spec.product.repo === "string" ? spec.product.repo : null;
  const file = opt.facts ?? (repo ? path.join(path.dirname(specFile), `${repo}-facts.json`) : null);
  if (!file) throw new Failure("product.repo is missing, so the facts file cannot be found; pass --facts");
  if (opt.facts === undefined && !fs.existsSync(file)) throw new Failure(`cannot read ${file}: ENOENT; if the facts file has another name or place, pass --facts <path>`);
  return readFacts(file);
}

function cmdSketch(argv) {
  const { pos, opt } = args(argv, { facts: { type: "string" } }, 1);
  const spec = readJson(pos[0], "poster spec");
  // Placeholder words and copy rules wait for render; the sketch needs the geometry, the texts and the notes count.
  // A drawn shape is geometry too, so its placeholder blocks the sketch.
  const blocking = validateSpec(spec).filter((e) => /^(figure\.(regions|texts)|figure:|notes:|version|product)/.test(e) && (/\.shape/.test(e) || !/still the placeholder|: (jargon|a file path|a "01|a middle dot)/.test(e)));
  if (blocking.length) {
    for (const e of blocking) fail(`spec: ${e}`);
    return 1;
  }
  const fields = spec.figure.regions.some((r) => r.kind === "field");
  const facts = fields ? factsFor(pos[0], spec, opt) : undefined;
  process.stdout.write(sketch(spec, facts));
  // Every rule that needs no browser runs here too, so a wording error costs no render. The shape checks are
  // already among the sketch's own lines, measured on its layout.
  for (const e of validateSpec(spec).filter((x) => !blocking.includes(x))) process.stdout.write(`✗ spec: ${e}\n`);
  if (facts) {
    const frame = spec.frame ?? "loose";
    for (const c of CHECKS.filter((x) => x.stage === "spec" && x.id !== "spec" && !x.id.startsWith("shape-") && (!x.frames || x.frames.includes(frame)))) {
      for (const m of c.run({ spec, facts, presets: loadPresets() })) process.stdout.write(`${c.level === "fail" ? "✗" : "!"} ${c.id}: ${m}\n`);
    }
  }
  const image = fields && sketchImage(spec, facts);
  if (image) {
    const file = path.join(path.dirname(pos[0]), `${spec.product.repo}-sketch.png`);
    fs.writeFileSync(file, image);
    process.stdout.write(`sketch PNG: ${path.resolve(file)}, the silhouette at a third of its size with its bands or its shading; open it and check it reads as the object\n`);
  }
  return 0;
}

function report(found) {
  for (const f of found) (f.level === "fail" ? fail : warn)(`${f.id}: ${f.message}`);
  return found.filter((f) => f.level === "fail").length;
}

async function poster(specFile, opt, outDir, files) {
  const spec = readJson(specFile, "poster spec");
  const facts = factsFor(specFile, spec, opt);
  const repo = spec.product.repo;
  const input = { spec, facts, presets: loadPresets() };
  const specFails = report(runChecks("spec", input));
  if (specFails) return specFails;
  const base = path.join(outDir, `${repo}-poster`);
  let html;
  try {
    html = buildPage(spec, facts);
  } catch (e) {
    throw new Failure(e.message);
  }
  const page = await renderPage({ html, base, ...files });
  return report(runChecks("page", { ...input, page }));
}

async function cmdRender(argv) {
  const { pos, opt } = args(
    argv,
    { facts: { type: "string" }, out: { type: "string" }, "no-png": { type: "boolean" }, "no-pdf": { type: "boolean" }, paper: { type: "string", default: "fit" } },
    1,
  );
  if (!PAPERS.includes(opt.paper)) throw new Usage(`--paper must be ${PAPERS.join(", ")}`);
  const outDir = opt.out ?? path.dirname(pos[0]);
  const fails = await poster(pos[0], opt, outDir, { png: !opt["no-png"], pdf: !opt["no-pdf"], paper: opt.paper });
  const code = fails ? 1 : 0;
  const repo = readJson(pos[0], "poster spec").product.repo;
  const made = ["html", ...(opt["no-png"] ? [] : ["png", "thumb"]), ...(opt["no-pdf"] ? [] : ["pdf"])]
    .map((x) => path.join(outDir, x === "thumb" ? `${repo}-poster-thumb.png` : `${repo}-poster.${x}`))
    .filter(fs.existsSync);
  if (made.length) process.stdout.write(`${code ? "Wrote, with failures" : "Wrote"}: ${made.join(", ")}\n`);
  if (!code) process.stdout.write("PASS\n");
  else err(`POSTER NOT FINISHED: fix the ${fails} ✗ line${fails === 1 ? "" : "s"} above, then run vyo render again. Any files written above are a failed draft, not the result.`);
  return code;
}

async function cmdCheck(argv) {
  const { pos, opt } = args(argv, { facts: { type: "string" } }, 1);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vyo-check-"));
  try {
    const code = (await poster(pos[0], opt, tmp, { png: false, pdf: false })) ? 1 : 0;
    if (!code) process.stdout.write("PASS\n");
    return code;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function cmdInit(argv) {
  const { opt } = args(argv, { cursor: { type: "boolean" }, claude: { type: "boolean" }, codex: { type: "boolean" }, dir: { type: "string", default: "." } }, 0);
  const repo = path.resolve(opt.dir);
  if (!fs.existsSync(repo) || !fs.statSync(repo).isDirectory()) throw new Failure(`${opt.dir} is not a directory`);
  const editors = chooseEditors(repo, Object.keys(EDITORS).filter((e) => opt[e]));
  for (const f of init(repo, { editors, codex: !!opt.codex })) process.stdout.write(`Wrote ${path.join(repo, f)}\n`);
  return 0;
}

const COMMANDS = { init: cmdInit, scan: cmdScan, show: cmdShow, parts: cmdParts, presets: cmdPresets, compose: cmdCompose, sketch: cmdSketch, render: cmdRender, check: cmdCheck };

export async function main(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === "help" || cmd === "-h" || cmd === "--help") {
    process.stdout.write(USAGE + "\n");
    return 0;
  }
  const run = COMMANDS[cmd];
  try {
    if (!run) throw new Usage(cmd ? `unknown command: ${cmd}` : "");
    return await run(rest);
  } catch (e) {
    if (e instanceof Usage) {
      if (e.message) err(e.message);
      err(USAGE);
      return 2;
    }
    if (e instanceof Failure || e instanceof NoBrowser) {
      fail(e.message);
      return 1;
    }
    throw e;
  }
}

const isMain = process.argv[1] && pathToFileURL(fs.realpathSync(process.argv[1])).href === import.meta.url;
if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      fail(e && e.stack ? e.stack : String(e));
      process.exit(1);
    },
  );
}
