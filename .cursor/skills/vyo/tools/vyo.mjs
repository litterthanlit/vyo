#!/usr/bin/env node
// Vyo: repo -> facts.json -> poster spec -> poster (HTML, PNG, PDF), checked.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { pathToFileURL, fileURLToPath } from "node:url";
import { stableStringify, factsHash } from "./lib/hash.mjs";
import { scanRepoDetailed } from "./lib/scan/index.mjs";
import { showFacts, hiddenCodeHint } from "./lib/scan/show.mjs";
import { scaffoldSpec, coverScaffold, plateScaffold, luminousScaffold, validateSpec, THEMES, PLACEHOLDER } from "./lib/spec.mjs";
import { SHAPE_STYLES, DEFAULT_STYLE } from "./lib/fields/shape.mjs";
import { sketch, sketchImage } from "./lib/sketch.mjs";
import { coverSketchLines, coverSketchFindings, coverSketchImage } from "./lib/cover-sketch.mjs";
import { COVER_LIMITS, coverWindow } from "./lib/cover-report.mjs";
import { coverOf } from "./lib/cover-render.mjs";
import { plateSketchLines, plateSketchImage } from "./lib/plate-render.mjs";
import { luminousSketchText } from "./lib/luminous-render.mjs";
import { COVER_GROUNDS, COVER_LOOKS, COVER_CROPS, COVER_LAYOUTS, COVER_FINISHES, coverLegend } from "./lib/cover.mjs";
import { PLATES, PLATE_NAMES } from "./lib/plates/index.mjs";
import { SILHOUETTES, SILHOUETTE_NAMES } from "./lib/silhouettes.mjs";
import { SHAPE_KEYS, GRID, ADVANCE, SHEET, FORMAT_NAMES } from "./lib/geometry.mjs";
import { SHAPE_KINDS, SHAPE_ROOM } from "./lib/mask.mjs";
import { buildPage, renderPage, renderLuminousSketch, GifFailure, PAPERS, floorFor, FLOOR_STEP, fieldSpace } from "./lib/render.mjs";
import { ROLES, FRAMES, RECORD_FRAMES, LUMINOUS_THEMES, scaffoldPlaces } from "./lib/frame.mjs";
import { cornersLine } from "./lib/geometry.mjs";
import { runChecks, CHECKS } from "./lib/check.mjs";
import { NoBrowser } from "./lib/browser.mjs";
import { MaskFailure, BUNDLED_MASKS } from "./lib/png-mask.mjs";
import { init, chooseEditors, EDITORS } from "./lib/init.mjs";
import { FIELDS } from "./lib/fields/index.mjs";
import { partsFromFacts, partOptions, regionParts, accentIds, unplainName, sameNames, dominance, aroundProduct, PART_DEFAULTS } from "./lib/parts.mjs";
import { pickField, pickSilhouette, readRecent, recordShape, usedAgo } from "./lib/recent.mjs";

const USAGE = `Usage:
  vyo init    [--cursor] [--claude] [--codex] [--dir <repo-dir>]
  vyo scan    <repo-dir> --out <dir>/<repo>-facts.json
  vyo show    <facts.json>
  vyo presets [<id>]
  vyo parts   <facts.json> [--field ${Object.keys(FIELDS).join("|")}] [--split <part id>]...
  vyo shapes  [--log <file>]
  vyo compose <facts.json> [--frame ${FRAMES.join("|")}] [--plate ${PLATE_NAMES.join("|")}] [--field ${Object.keys(FIELDS).join("|")}] [--style ${Object.keys(SHAPE_STYLES).join("|")}] [--look ${COVER_LOOKS.join("|")}] [--finish ${COVER_FINISHES.join("|")}] [--layout ${COVER_LAYOUTS.join("|")}] [--ground ${Object.keys(COVER_GROUNDS).join("|")}] [--format ${FORMAT_NAMES.join("|")}] [--crop ${COVER_CROPS.join("|")}] [--split <part id>]... [--seed <n>] [--accent <part id>] [--from <preset>] [--theme light|dark|obsidian|alabaster] [--repo <repo-dir>] [--out <spec.json>] [--shapes-log <file>] [--force]
  vyo sketch  <spec.json> [--facts <facts.json>]
  vyo render  <spec.json> [--facts <facts.json>] [--out <dir>] [--no-png] [--no-pdf] [--gif] [--paper ${PAPERS.join("|")}]
  vyo series  <spec1.json> <spec2.json> [...] --out <base> [--gif]
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
  return [`${what}. Split it into the ${d.split.into} inside it: vyo parts ${file} --field shape ${flags} gives ${d.split.count} parts, the largest ${pct(d.split.largest)}${field === "shape" ? "" : " (a shape field only)"}; then write "split": [${[...(options.split ?? []), d.split.id].map((id) => `"${id}"`).join(", ")}] in the region and put the accent on one of them.`];
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

/** The numbers an agent places a loose or signal frame's texts by, printed by compose. */
function looseNotes(field, space, frame) {
  const L = ROLES[frame];
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
    `  or trace it from a PNG instead of ops: { "mask": "${BUNDLED_MASKS.join('" or "')}" or a path, "fit": ... }; its dark pixels are the silhouette.`,
    `  each op is { "add": kind, ... } or { "cut": kind, ... }, the first an add. Kinds: ${kinds}.`,
    '  example: { "add": "rect", "at": [16, 0], "size": [68, 16], "round": 3 }. ellipse r is [rx, ry]; arc from and to are degrees clockwise from twelve o\'clock; any op takes rotate about its own centre.',
    "  Coordinates are free units, y down: the engine measures what you painted and fits it.",
    `  Leave fit out: the shape is then as large as fits ${R.left}px in from the sides, ${R.top}px below the top (room for the words) and ${R.bottom}px above the bottom, and never bleeds; the engine then centres it in the room the words leave.`,
    "  fit.w or fit.h sets its share of the sheet's width or height instead (over 1 bleeds off, and the sketch says which edges), fit.cx and fit.cy its centre.",
    '  style: "relief" (the default) draws any outline as a lit volume in fine type; "rings" sets the names round the outline, ring inside ring, for a fat, round object, with "echo": 0 to 12 faded outlines; "symbols" draws it in shaded clusters of - : = + #, like ASCII art.',
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

function glyphLetter(name) {
  const found = String(name ?? "").match(/[A-Za-z0-9]/);
  return found ? found[0].toUpperCase() : "A";
}

// One valid op of each kind, printed by vyo shapes; a test validates them.
export const OP_EXAMPLES = {
  circle: { add: "circle", at: [50, 50], r: 30 },
  ellipse: { add: "ellipse", at: [50, 50], r: [30, 20] },
  rect: { add: "rect", at: [20, 30], size: [60, 40], round: 6 },
  capsule: { add: "capsule", from: [20, 50], to: [80, 50], r: 8 },
  arc: { add: "arc", at: [50, 50], r: 30, from: 270, to: 90, width: 8 },
  polygon: { add: "polygon", points: [[50, 10], [90, 90], [10, 90]], round: 3 },
  path: { add: "path", d: "M10 90 L50 10 L90 90 Z" },
};

function cmdShapes(argv) {
  const { opt } = args(argv, { log: { type: "string" }, "shapes-log": { type: "string" } }, 0);
  const file = opt.log ?? opt["shapes-log"] ?? path.join(process.cwd(), "vyo", "recent-shapes.json");
  const { shapes } = readRecent(file);
  const lines = Object.entries(FIELDS).map(([name, field]) => {
    const ago = usedAgo(shapes, name);
    return `${name} — ${field.about} — ${ago === null ? "never" : `last used ${ago} ago`}`;
  });
  const width = Math.max(...SILHOUETTE_NAMES.map((n) => n.length));
  lines.push(
    "",
    'Ready silhouettes for a shape, as "shape": { "like": "<name>" }. Pick the object that fits the product; draw your own only when none does:',
    ...SILHOUETTE_NAMES.map((n) => {
      const ago = usedAgo(shapes, n);
      const used = ago === null ? "" : ago === 0 ? " Picked for the latest cover here." : ` Picked here ${ago + 1} covers ago.`;
      return `  ${n.padEnd(width)}  for ${SILHOUETTES[n].suits}; drawn as ${SILHOUETTES[n].about.replace(/^[^:]*: /, "")}.${used}`;
    }),
    "",
    'To draw your own, "shape": { "ops": [...] } in a 100-unit box, y down, the first op an add. One op of each kind:',
    ...Object.entries(OP_EXAMPLES).map(([kind, op]) => `  ${kind.padEnd(8)}  ${JSON.stringify(op)}`),
  );
  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}

/**
 * compose --frame cover: a scaffold whose only blanks are the words, the names, the accent and the shape, and the
 * parts printed with the ones that make a good outline accent marked.
 */
function composeCover(factsFile, opt) {
  for (const k of ["from", "style", "theme", "seed", "plate"]) if (opt[k] !== undefined) throw new Usage(`--${k} has no place on a cover; ${k === "theme" ? `set ground in the spec (${Object.keys(COVER_GROUNDS).join(", ")})` : `leave out --${k}`}`);
  if (opt.field !== undefined && opt.field !== "shape") throw new Usage("a cover draws a shape; leave out --field");
  const look = opt.look ?? "living";
  if (!COVER_LOOKS.includes(look)) throw new Usage(`--look ${look} is not a cover look; use ${COVER_LOOKS.join(", ")}`);
  const ground = opt.ground ?? (look === "xerox" ? "paper" : look === "spin" ? "acid" : "navy");
  if (!COVER_GROUNDS[ground]) throw new Usage(`--ground ${ground} is not a ground; use ${Object.keys(COVER_GROUNDS).join(", ")}`);
  const format = opt.format ?? "poster";
  if (!FORMAT_NAMES.includes(format)) throw new Usage(`--format ${format} is not a format; use ${FORMAT_NAMES.join(", ")}`);
  const crop = opt.crop ?? "center";
  if (!COVER_CROPS.includes(crop)) throw new Usage(`--crop ${crop} is not a crop; use ${COVER_CROPS.join(", ")}`);
  const layout = opt.layout ?? "classic";
  if (!COVER_LAYOUTS.includes(layout)) throw new Usage(`--layout ${layout} is not a layout; use ${COVER_LAYOUTS.join(", ")}`);
  const finish = opt.finish ?? "type";
  if (!COVER_FINISHES.includes(finish)) throw new Usage(`--finish ${finish} is not a cover finish; use ${COVER_FINISHES.join(", ")}`);
  const facts = readFacts(factsFile);
  const commit = opt.repo ? git(opt.repo, "%h") : undefined;
  const date = (opt.repo && git(opt.repo, "%cs")) ?? new Date().toISOString().slice(0, 10);
  if (!opt.repo) warn("no --repo, so no commit: the cover's record needs one; compose again with --repo <repo>");
  else if (!commit) warn(`${opt.repo} has no git history; the cover's record needs a commit, so use the swiss frame instead`);
  const L = COVER_LIMITS;
  const split = [...(opt.split ?? [])];
  const cut = [];
  const partsOf = (s) => partsFromFacts(facts, partOptions({ field: "shape", ...(s.length ? { split: s } : {}) }));
  let parts = partsOf(split);
  if (!parts.length) throw new Failure(`no parts to draw; the scan found no code, so a cover has nothing to show. Compose a fill poster instead: vyo compose ${factsFile} --from <preset>`);
  const linesIn = (list) => list.reduce((s, p) => s + p.loc, 0) || 1;
  for (let big; split.length < 4 && (big = parts.find((p) => p.loc / linesIn(parts) > L.share && !split.includes(p.id))); ) {
    const finer = partsOf([...split, big.id]);
    if (finer.length <= parts.length) break;
    cut.push(`${big.id} (${pct(big.loc / linesIn(parts))}) into ${finer.length - parts.length + 1} parts`);
    split.push(big.id);
    parts = finer;
  }
  if (opt.accent !== undefined && !accentIds(parts, opt.accent).size) throw new Usage(`--accent ${opt.accent} names no part; vyo parts ${factsFile} --field shape${split.map((s) => ` --split ${s}`).join("")} lists the part ids`);
  const out = opt.out ?? path.join(path.dirname(factsFile), `${facts.repo.name}-poster.json`);
  if (fs.existsSync(out) && !opt.force) throw new Failure(`${out} exists; it may hold your words. Pass --force to replace it with a fresh scaffold`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const earlier = (() => {
    try {
      return JSON.parse(fs.readFileSync(out, "utf8")).figure.regions[0].shape.like;
    } catch {
      return undefined;
    }
  })();
  const logFile = opt["shapes-log"] ?? path.join(path.dirname(path.resolve(out)), "recent-shapes.json");
  const readme = opt.repo ? fs.readdirSync(opt.repo).find((f) => /^readme/i.test(f)) : undefined;
  const text = readme ? fs.readFileSync(path.join(opt.repo, readme), "utf8").slice(0, 6000) : "";
  const hashKey = parseInt(String(facts.hash).slice(0, 8), 16) || 0;
  const pick = SILHOUETTES[earlier] ? { name: earlier, matched: null } : pickSilhouette(SILHOUETTES, text, readRecent(logFile).shapes, hashKey);
  const like = pick.name;
  if (pick.matched) recordShape(logFile, like);
  const share = (p) => p.loc / linesIn(parts);
  const around = (p) => aroundProduct(p.id);
  const probe = coverScaffold(facts, { commit, date, split: split.length ? split : undefined, parts, strata: "outline", like, ground, look, format, crop, layout, finish, accent: parts[parts.length - 1].id });
  Object.assign(probe, { product: { ...probe.product, name: facts.repo.name }, headline: "One plain sentence about what the product does for a person." });
  probe.figure.texts[0].text = coverLegend(probe.figure.regions[0], facts.repo.name, "a plain name", ground);
  const win = coverWindow(coverOf(probe, facts));
  const fits = (p, [lo, hi]) => share(p) >= lo && share(p) <= hi;
  const outline = look === "living" && !!win.ring && parts.some((p) => !around(p) && fits(p, win.ring));
  const window = outline ? win.ring : win.band;
  const scaffold = coverScaffold(facts, { commit, date, accent: opt.accent, split: split.length ? split : undefined, parts, strata: outline ? "outline" : "down", like, ground, look, format, crop, layout, finish });
  fs.writeFileSync(out, JSON.stringify(scaffold, null, 2) + "\n");
  const S = SILHOUETTES[like];
  const width = Math.max(...parts.map((p) => p.id.length));
  const color = COVER_GROUNDS[ground].colorName ?? "orange";
  const accentLabel = outline ? `${color} outer ring on the ${S.noun}` : `${color} band across the ${S.noun}`;
  const lines = [
    `Wrote ${out}. Edit that file: replace each value that starts with "…" and change nothing else.`,
    ...(cut.length ? [`Split ${cut.join(", and ")}, so no part is most of the object.`] : []),
    `parts (id, share of the code, scanned name). * marks a part that makes a good ${accentLabel}: ${pct(window[0])} to ${pct(window[1])} of the code. - marks code around the product, never the accent.`,
    ...parts.map((p) => `  ${around(p) ? "-" : fits(p, window) ? "*" : " "} ${p.id.padEnd(width)} ${pct(share(p)).padStart(4)}  ${p.name}${around(p) ? `  ${around(p)}, never the accent` : ""}${unplainName(p.name) ? "  ! needs a plain name" : ""}`),
    `accent: the id of the part the product is about. If it has no *, write it anyway: the sketch says how to make it show.`,
    `shape: compose picked the ${S.noun} ("like": "${like}"), for ${S.suits}${pick.matched?.length ? `; the README says ${pick.matched.map((w) => `"${w}…"`).join(", ")}` : ""}. If another object in vyo shapes suits the product better, write its name and put its name in the legend for "${S.noun}".`,
    `legend: the pattern is written; replace <product> and <the accent's plain name>, and delete the leading "…".`,
    `ground: ${Object.keys(COVER_GROUNDS).join(", ")}. look: ${COVER_LOOKS.join(", ")}. finish: ${COVER_FINISHES.join(", ")}. layout: ${COVER_LAYOUTS.join(", ")}. format: ${FORMAT_NAMES.join(", ")}. Names: every part, lowercase, at most 24 characters, saying what it does for a person.`,
    `Then: vyo sketch ${out}, open the sketch PNG, act on every finding, then vyo render ${out} --gif.`,
  ];
  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}

/**
 * compose --frame plate: a pure vector data-art plate (`topo` or `blueprint`) in a curated gallery
 * ground and layout, auto-splitting any dominant part over 40% so the composition has rich architectural grain.
 */
function composePlate(factsFile, opt, seed) {
  for (const k of ["from", "style", "theme", "field", "look", "crop", "finish"]) {
    if (opt[k] !== undefined) throw new Usage(`--${k} has no place on a plate; leave out --${k}`);
  }
  const plate = opt.plate ?? "topo";
  if (!PLATE_NAMES.includes(plate)) throw new Usage(`--plate ${plate} is not a plate; use ${PLATE_NAMES.join(", ")}`);
  const ground = opt.ground ?? "obsidian";
  if (!COVER_GROUNDS[ground]) throw new Usage(`--ground ${ground} is not a ground; use ${Object.keys(COVER_GROUNDS).join(", ")}`);
  const layout = opt.layout ?? "editorial";
  if (!COVER_LAYOUTS.includes(layout)) throw new Usage(`--layout ${layout} is not a layout; use ${COVER_LAYOUTS.join(", ")}`);
  const format = opt.format ?? "poster";
  if (!FORMAT_NAMES.includes(format)) throw new Usage(`--format ${format} is not a format; use ${FORMAT_NAMES.join(", ")}`);

  const facts = readFacts(factsFile);
  const commit = opt.repo ? git(opt.repo, "%h") : undefined;
  const date = (opt.repo && git(opt.repo, "%cs")) ?? new Date().toISOString().slice(0, 10);
  if (!opt.repo) warn("no --repo, so no commit: the plate's record needs one; compose again with --repo <repo>");
  else if (!commit) warn(`${opt.repo} has no git history; the plate's record needs a commit, so use the swiss frame instead`);

  const split = [...(opt.split ?? [])];
  const cut = [];
  const partsOf = (s) => partsFromFacts(facts, partOptions({ ...(s.length ? { split: s } : {}) }));
  let parts = partsOf(split);
  if (!parts.length) throw new Failure(`no parts to draw; the scan found no code, so a plate has nothing to show. Compose a fill poster instead: vyo compose ${factsFile} --from <preset>`);
  const linesIn = (list) => list.reduce((s, p) => s + p.loc, 0) || 1;
  for (let big; split.length < 4 && (big = parts.find((p) => p.loc / linesIn(parts) > 0.4 && !split.includes(p.id))); ) {
    const finer = partsOf([...split, big.id]);
    if (finer.length <= parts.length) break;
    cut.push(`${big.id} (${pct(big.loc / linesIn(parts))}) into ${finer.length - parts.length + 1} parts`);
    split.push(big.id);
    parts = finer;
  }
  if (opt.accent !== undefined && !accentIds(parts, opt.accent).size) {
    throw new Usage(`--accent ${opt.accent} names no part; vyo parts ${factsFile} lists the part ids`);
  }
  const out = opt.out ?? path.join(path.dirname(factsFile), `${facts.repo.name}-poster.json`);
  if (fs.existsSync(out) && !opt.force) throw new Failure(`${out} exists; it may hold your words. Pass --force to replace it with a fresh scaffold`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

  const scaffold = plateScaffold(facts, {
    plate,
    commit,
    date,
    accent: opt.accent,
    split: split.length ? split : undefined,
    parts,
    ground,
    layout,
    format,
    seed,
  });
  fs.writeFileSync(out, JSON.stringify(scaffold, null, 2) + "\n");

  const share = (p) => p.loc / linesIn(parts);
  const around = (p) => aroundProduct(p.id);
  const width = Math.max(...parts.map((p) => p.id.length));
  const lines = [
    `Wrote ${out} (${plate} plate on ${ground} ground, ${layout} layout). Edit that file: replace each value that starts with "…" and change nothing else.`,
    ...(cut.length ? [`Split ${cut.join(", and ")}, so no single part dominates the plate.`] : []),
    `parts (id, share of the code, scanned name). * marks a good accent candidate; - marks code around the product, never the accent.`,
    ...parts.map((p) => `  ${around(p) ? "-" : share(p) >= 0.05 && share(p) <= 0.45 ? "*" : " "} ${p.id.padEnd(width)} ${pct(share(p)).padStart(4)}  ${p.name}${around(p) ? `  ${around(p)}, never the accent` : ""}${unplainName(p.name) ? "  ! needs a plain name" : ""}`),
    `plate: ${plate} — ${PLATES[plate].about}.`,
    `legend: the pattern is written; replace <product> and <the accent's plain name>, and delete the leading "…".`,
    `plate kinds: ${PLATE_NAMES.join(", ")}. ground: ${Object.keys(COVER_GROUNDS).join(", ")}. layout: ${COVER_LAYOUTS.join(", ")}. format: ${FORMAT_NAMES.join(", ")}.`,
    `Then: vyo sketch ${out}, open the sketch PNG, act on every finding, then vyo render ${out} --gif.`,
  ];
  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}

/**
 * compose --frame luminous: bespoke soft-lit SVG optical mosaic refracted through real codebase strata.
 */
function composeLuminous(factsFile, opt, seed) {
  for (const k of ["from", "style", "field", "plate", "look", "crop", "finish", "ground", "layout", "format"]) {
    if (opt[k] !== undefined) throw new Usage(`--${k} has no place on a luminous poster; leave out --${k}`);
  }
  const theme = opt.theme ?? "obsidian";
  if (!LUMINOUS_THEMES.includes(theme)) {
    throw new Usage(`--theme ${theme} is not a luminous theme; use ${LUMINOUS_THEMES.join(" or ")}`);
  }
  const facts = readFacts(factsFile);
  const commit = opt.repo ? git(opt.repo, "%h") : undefined;
  const date = (opt.repo && git(opt.repo, "%cs")) ?? new Date().toISOString().slice(0, 10);
  const parts = partsFromFacts(facts, partOptions(opt.split ? { split: opt.split } : {}));
  if (!parts.length) {
    throw new Failure(`no parts to draw; the scan found no code, so a luminous poster has nothing to refract. Compose a fill poster instead: vyo compose ${factsFile} --from <preset>`);
  }
  if (opt.accent !== undefined) {
    const areaIds = new Set(facts.facts.filter((f) => f.kind === "area").map((f) => f.id));
    if (!accentIds(parts, opt.accent).size && !areaIds.has(opt.accent)) {
      throw new Usage(`--accent ${opt.accent} names no part or area; vyo parts ${factsFile} lists the part ids`);
    }
  }
  const out = opt.out ?? path.join(path.dirname(factsFile), `${facts.repo.name}-poster.json`);
  if (fs.existsSync(out) && !opt.force) {
    throw new Failure(`${out} exists; it may hold your words. Pass --force to replace it with a fresh scaffold`);
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

  const scaffold = luminousScaffold(facts, {
    commit,
    date,
    accent: opt.accent,
    theme,
    parts,
    split: opt.split?.length ? opt.split : undefined,
    seed,
  });
  fs.writeFileSync(out, JSON.stringify(scaffold, null, 2) + "\n");

  const totalLoc = parts.reduce((s, p) => s + p.loc, 0) || 1;
  const share = (p) => p.loc / totalLoc;
  const around = (p) => aroundProduct(p.id);
  const width = Math.max(...parts.map((p) => p.id.length));
  const sanctuaryNote = theme === "alabaster"
    ? "top-left sanctuary (x 0..540, y 0..252) stays calm alabaster for the frameless headline"
    : "left-middle sanctuary (x 0..396, y 392..742) stays quiet obsidian for the frameless headline";
  const lines = [
    `Wrote ${out} (luminous ${theme} theme). Replace every value that starts with "…" to author your bespoke soft-lit poster.`,
    `parts (id, share of the code, scanned name). * marks a good accent candidate; - marks code around the product.`,
    ...parts.map((p) => `  ${around(p) ? "-" : share(p) >= 0.05 && share(p) <= 0.45 ? "*" : " "} ${p.id.padEnd(width)} ${pct(share(p)).padStart(4)}  ${p.name}${around(p) ? `  ${around(p)}` : ""}`),
    `subject.svg: draw one evocative soft-lit visual metaphor (viewBox="0 0 840 1190") using <radialGradient>, <linearGradient>, <feGaussianBlur>, carved shadow valleys, and one glowing ${theme === "alabaster" ? "vermilion" : "crimson"} focal heart.`,
    `sanctuary: ${sanctuaryNote}.`,
    `microType: write 18 to 28 short plain-language phrases ({ text, u, v, style: "core" | "part" | "whisper" }) anchored where each part lives in your metaphor.`,
    `Then: vyo sketch ${out}, inspect the sketch PNG, act on every finding, then vyo render ${out}.`,
  ];
  process.stdout.write(lines.join("\n") + "\n");
  return 0;
}

function cmdCompose(argv) {
  const { pos, opt } = args(
    argv,
    {
      frame: { type: "string" },
      plate: { type: "string" },
      field: { type: "string" },
      style: { type: "string" },
      look: { type: "string" },
      finish: { type: "string" },
      layout: { type: "string" },
      ground: { type: "string" },
      format: { type: "string" },
      crop: { type: "string" },
      split: { type: "string", multiple: true },
      accent: { type: "string" },
      from: { type: "string" },
      theme: { type: "string" },
      repo: { type: "string" },
      out: { type: "string" },
      force: { type: "boolean" },
      seed: { type: "string" },
      "shapes-log": { type: "string" },
    },
    1,
  );
  const presets = loadPresets();
  const preset = opt.from === undefined ? undefined : presets[opt.from];
  if (opt.from !== undefined && !preset) throw new Usage(`--from ${opt.from} is not a preset; one of ${Object.keys(presets).join(", ")}`);
  const fieldPreset = preset?.figure.regions.find((r) => r.kind === "field");
  if (fieldPreset) throw new Usage(`--from ${opt.from} is a field preset, drawn from its own scan; use --field ${fieldPreset.field}`);
  if (preset && (opt.field !== undefined || opt.accent !== undefined)) throw new Usage("--field and --accent make a field poster; --from starts from a fill preset. Pass one or the other");
  if (opt.field !== undefined && !FIELDS[opt.field]) throw new Usage(`--field ${opt.field} is not a field; use ${Object.keys(FIELDS).join(" or ")}`);
  let seed;
  if (!preset && opt.seed !== undefined) {
    if (!/^\d+$/.test(opt.seed) || Number(opt.seed) > 2147483647) throw new Usage(`--seed ${opt.seed} is not a whole number from 0 to 2147483647`);
    seed = Number(opt.seed);
  }
  if (opt.style !== undefined && !SHAPE_STYLES[opt.style]) throw new Usage(`--style ${opt.style} is not a style; use ${Object.keys(SHAPE_STYLES).join(", ")}`);
  // A style is a shape's look, so --style alone asks for a shape.
  if (opt.style !== undefined && opt.field === undefined && !preset) opt.field = "shape";
  const frame = opt.frame ?? (opt.plate !== undefined ? "plate" : preset?.frame ?? "loose");
  if (!FRAMES.includes(frame)) throw new Usage(`--frame ${frame} is not a frame; use ${FRAMES.join(" or ")}`);
  if (frame === "cover") return composeCover(pos[0], opt);
  if (frame === "plate") return composePlate(pos[0], opt, seed);
  if (frame === "luminous") return composeLuminous(pos[0], opt, seed);
  if (opt.split && opt.field !== "shape") throw new Usage("--split cuts a part of a shape field; pass --field shape");
  if (opt.style !== undefined && opt.field !== "shape") throw new Usage("--style picks a shape field's look; pass --field shape");
  for (const k of ["look", "ground", "format", "crop", "layout", "finish", "plate"]) if (opt[k] !== undefined) throw new Usage(`--${k} is for --frame cover or --frame plate; pass --frame cover, --frame plate, or leave out --${k}`);
  if (opt.field && FIELDS[opt.field].frames && !FIELDS[opt.field].frames.includes(frame)) throw new Usage(`--field ${opt.field} draws only in the ${FIELDS[opt.field].frames.join(" or ")} frame; leave out --frame`);
  if (preset && frame !== preset.frame) throw new Usage(`--from ${opt.from} is a ${preset.frame} preset; the loose frame draws a field, so use --field`);
  const theme = opt.theme ?? preset?.theme ?? "light";
  if (!THEMES.includes(theme)) throw new Usage(`--theme ${theme} is not a theme; use ${THEMES.join(" or ")}`);
  const facts = readFacts(pos[0]);
  let commit;
  let date;
  if (opt.repo) {
    commit = git(opt.repo, "%h");
    date = git(opt.repo, "%cs");
    if (!commit) warn(`${opt.repo} has no git history; the ${RECORD_FRAMES.includes(frame) ? "record line" : "footer"} will show no commit`);
  } else if (RECORD_FRAMES.includes(frame)) warn(`no --repo, so no commit: the ${frame} frame's record line needs one; set product.commit or compose again with --repo`);
  date ??= new Date().toISOString().slice(0, 10);
  const out = opt.out ?? path.join(path.dirname(pos[0]), `${facts.repo.name}-poster.json`);
  if (fs.existsSync(out) && !opt.force) throw new Failure(`${out} exists; it may hold your words. Pass --force to replace it with a fresh scaffold`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const logFile = preset ? null : (opt["shapes-log"] ?? path.join(path.dirname(path.resolve(out)), "recent-shapes.json"));
  let field = preset ? undefined : opt.field;
  const avoided = !preset && field === undefined ? readRecent(logFile).shapes : null;
  const hashKey = parseInt(String(facts.hash).slice(0, 8), 16) || 0;
  // A shape waits for the agent to draw it, so the pick never lands on one; compose offers it instead.
  if (avoided) field = pickField(Object.keys(FIELDS).filter((f) => !FIELDS[f].options.includes("shape") && (!FIELDS[f].frames || FIELDS[f].frames.includes(frame))), avoided, hashKey + avoided.length);
  if (field && FIELDS[field].options.includes("seed") && seed === undefined) seed = (hashKey % 2147483646) + 1;
  if (field && !FIELDS[field].options.includes("seed")) seed = undefined;
  const letter = field === "glyph" ? glyphLetter(facts.repo.name) : undefined;
  // Parts as the style compose writes will draw them: rings and symbols hold fewer than a relief.
  const parts = partsFromFacts(facts, partOptions({ field, ...(field === "shape" ? { style: opt.style ?? DEFAULT_STYLE } : {}), ...(opt.split ? { split: opt.split } : {}) }));
  if (opt.accent !== undefined && !accentIds(parts, opt.accent).size) throw new Usage(`--accent ${opt.accent} names no part; vyo parts ${pos[0]} lists the part ids`);
  if (field && !parts.length) throw new Failure(`no parts to draw; the scan found no code. Compose a fill poster instead: vyo compose ${pos[0]} --from <preset> (vyo presets lists them)`);
  const twins = new Set(sameNames(parts).flat());
  const unplain = parts.filter((p) => unplainName(p.name) || twins.has(p));
  const notes = preset ? preset.notes.length : 3;
  const o = { frame, theme, commit, date, floor: floorFor(notes, 1), preset, field, accent: opt.accent, split: opt.split, style: opt.style ?? (field === "shape" ? DEFAULT_STYLE : undefined), parts, seed, letter };
  let space;
  if (RECORD_FRAMES.includes(frame)) {
    const draft = scaffoldSpec(facts, { ...o, places: {} });
    const region = draft.figure.regions[0];
    // The names are placeholders until the agent writes them, so only a name it already gave can be quoted.
    o.accentNames = regionParts(region, facts).filter((p) => p.hot && !p.name.startsWith(PLACEHOLDER)).map((p) => p.name);
    // A shape is not drawn yet, so its words carry no coordinates: the engine places them around it.
    if (field === "shape") o.places = { label: {}, headline: {}, legend: {}, paragraph: {} };
    else {
      // Lay the field out on its own sheet, then fill the corners it leaves.
      space = fieldSpace(draft, facts);
      o.places = scaffoldPlaces(space.corners, space.accent, parts.length, frame);
    }
  }
  fs.writeFileSync(out, JSON.stringify(scaffoldSpec(facts, o), null, 2) + "\n");
  if (logFile && field) recordShape(logFile, field);
  const from = preset ? `the ${opt.from} preset's geometry and its words taken out` : `a ${field} field of ${parts.length} parts${opt.accent ? ` with ${opt.accent} in the accent` : ""}`;
  const lines = [
    ...(avoided ? [`picked ${field} (avoided recent: ${avoided.length ? avoided.join(", ") : "none"})`] : []),
    `Wrote ${out}: a scaffold with ${from}. Replace every "…" value, then run vyo sketch ${out}, adjust, sketch again, then vyo render ${out}`,
    ...(field ? [`vyo parts ${pos[0]}${field === "wave" ? "" : ` --field ${field}`} lists the parts: pick the accent by its id and give every part a plain name in names${unplain.length ? ` (${unplain.length} flagged by vyo parts must not keep their scanned name)` : ""}.`] : []),
    ...(avoided ? [`Or draw the object yourself: compose again with --field shape --style ${Object.keys(SHAPE_STYLES).join("|")} when one thing a stranger names in a second stands for the product.`] : []),
    ...(RECORD_FRAMES.includes(frame) ? looseNotes(field, space, frame) : authoringNotes(notes, field)),
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

/**
 * A cover's sketch: every spec error at once, then, when the shape and the ground can be drawn, the still in
 * numbers and as a PNG, with every finding the still and the shell give. Placeholder names sketch as the scanned ones.
 */
function coverSketch(file, spec, opt) {
  const errors = validateSpec(spec);
  // compose wrote the commit and the date; a spec rewritten by hand loses them, so say the exact values to put back.
  const p = spec?.product;
  if (p && typeof p === "object" && (p.commit === undefined || p.date === undefined)) {
    const repo = path.dirname(path.dirname(path.resolve(file)));
    // Only the repo the spec names: a spec kept elsewhere must not borrow another repo's commit.
    const [commit, date] = path.basename(repo) === p.repo ? [git(repo, "%h"), git(repo, "%cs")] : [];
    process.stdout.write(
      commit
        ? `✗ record: product has no ${p.commit === undefined ? "commit" : "date"}, which compose wrote; set "commit": "${commit}" and "date": "${date}" in product, and edit the spec compose writes in place next time\n`
        : `✗ record: product has no ${p.commit === undefined ? "commit" : "date"}, which compose wrote; run git -C <repo> log -1 --format=%h and --format=%cs and set them as "commit" and "date" in product\n`,
    );
  }
  const drawable =!errors.some((e) => /^(version|frame|product|ground|figure\.regions(\[0\])?(:|\.(kind|field|shape|strata|solid|turn|split|accent))|figure\.texts(:|\[\d+\]\.role))/.test(e) && !/\.names\[/.test(e));
  for (const e of errors) process.stdout.write(`✗ spec: ${e}\n`);
  if (!drawable) {
    process.stdout.write("Fix the ✗ spec lines above, then sketch again: the cover cannot be drawn until its shape, ground and parts are valid.\n");
    return 1;
  }
  const facts = factsFor(file, spec, opt);
  const region = spec.figure.regions[0];
  const names = Object.fromEntries(Object.entries(region.names ?? {}).filter(([, n]) => typeof n === "string" && !n.trim().startsWith(PLACEHOLDER)));
  const legend = spec.figure.texts.find((t) => t.role === "legend");
  const drawn = { ...spec, figure: { ...spec.figure, regions: [{ ...region, names }], texts: [{ ...legend, text: typeof legend?.text === "string" ? legend.text : "" }] } };
  process.stdout.write(coverSketchLines(drawn, facts).join("\n") + "\n");
  const presets = loadPresets();
  const findings = coverSketchFindings(drawn, facts);
  for (const c of CHECKS.filter((x) => x.frames?.includes("cover") || !x.frames)) {
    if (c.id === "spec") continue;
    const messages = c.id.startsWith("cover-") ? findings[c.id] : c.stage === "spec" ? c.run({ spec: c.id.startsWith("shape-") ? drawn : spec, facts, presets }) : [];
    for (const m of messages) process.stdout.write(`${c.level === "fail" ? "✗" : "!"} ${c.id}: ${m}\n`);
  }
  const png = path.join(path.dirname(file), `${spec.product.repo}-sketch.png`);
  fs.writeFileSync(png, coverSketchImage(drawn, facts));
  process.stdout.write(`sketch PNG: ${path.resolve(png)}, the still at a third of its size with the orange in place; open it and check it reads as the object\n`);
  return 0;
}

/**
 * A plate's sketch: every spec error at once, then, when the plate kind and ground can be drawn, its geometry
 * summary, spec-stage checks, and a 1/3-scale PNG preview. Placeholder names sketch as their scanned names.
 */
function plateSketch(file, spec, opt) {
  const errors = validateSpec(spec);
  const p = spec?.product;
  if (p && typeof p === "object" && (p.commit === undefined || p.date === undefined)) {
    const repo = path.dirname(path.dirname(path.resolve(file)));
    const [commit, date] = path.basename(repo) === p.repo ? [git(repo, "%h"), git(repo, "%cs")] : [];
    process.stdout.write(
      commit
        ? `✗ record: product has no ${p.commit === undefined ? "commit" : "date"}, which compose wrote; set "commit": "${commit}" and "date": "${date}" in product, and edit the spec compose writes in place next time\n`
        : `✗ record: product has no ${p.commit === undefined ? "commit" : "date"}, which compose wrote; run git -C <repo> log -1 --format=%h and --format=%cs and set them as "commit" and "date" in product\n`,
    );
  }
  const drawable = !errors.some(
    (e) => /^(version|frame|product|ground|layout|format|figure\.regions(\[0\])?(:|\.(kind|plate|split|accent|seed|minShare|maxParts))|figure\.texts(:|\[\d+\]\.role))/.test(e) && !/\.names\[/.test(e),
  );
  for (const e of errors) process.stdout.write(`✗ spec: ${e}\n`);
  if (!drawable) {
    process.stdout.write("Fix the ✗ spec lines above, then sketch again: the plate cannot be drawn until its kind, ground and parts are valid.\n");
    return 1;
  }
  const facts = factsFor(file, spec, opt);
  const region = spec.figure.regions[0];
  const names = Object.fromEntries(Object.entries(region.names ?? {}).filter(([, n]) => typeof n === "string" && !n.trim().startsWith(PLACEHOLDER)));
  const legend = spec.figure.texts.find((t) => t.role === "legend");
  const drawn = { ...spec, figure: { ...spec.figure, regions: [{ ...region, names }], texts: [{ ...legend, text: typeof legend?.text === "string" ? legend.text : "" }] } };
  process.stdout.write(plateSketchLines(drawn, facts).join("\n") + "\n");
  const presets = loadPresets();
  for (const c of CHECKS.filter((x) => x.stage === "spec" && x.id !== "spec" && (!x.frames || x.frames.includes("plate")))) {
    for (const m of c.run({ spec, facts, presets })) process.stdout.write(`${c.level === "fail" ? "✗" : "!"} ${c.id}: ${m}\n`);
  }
  const png = path.join(path.dirname(file), `${spec.product.repo}-sketch.png`);
  fs.writeFileSync(png, plateSketchImage(drawn, facts));
  process.stdout.write(`sketch PNG: ${path.resolve(png)}, the ${region.plate} plate at a third of its size; open it and check the composition\n`);
  return 0;
}

/**
 * A luminous poster's sketch: every spec error and pre-render finding, plus a quick Chromium sketch PNG
 * `<stem>-sketch.png` whenever `subject.svg` is authored (not a placeholder) and passes SVG safety checks.
 */
async function luminousSketch(file, spec, opt) {
  const errors = validateSpec(spec);
  for (const e of errors) process.stdout.write(`✗ spec: ${e}\n`);

  const region = spec?.figure?.regions?.find((r) => r && r.kind === "luminous");
  const structBad = errors.some((e) => /^(version|frame|theme|product\.repo|figure(:|\.regions(\[0\])?(:|\.kind)))/.test(e));
  if (structBad || !region) {
    process.stdout.write("Fix the ✗ spec lines above, then sketch again.\n");
    return 1;
  }

  const facts = factsFor(file, spec, opt);
  process.stdout.write(luminousSketchText(spec, facts));

  const presets = loadPresets();
  for (const c of CHECKS.filter((x) => x.stage === "spec" && x.id !== "spec" && (!x.frames || x.frames.includes("luminous")))) {
    for (const m of c.run({ spec, facts, presets })) process.stdout.write(`${c.level === "fail" ? "✗" : "!"} ${c.id}: ${m}\n`);
  }

  const svgStr = typeof region.subject?.svg === "string" ? region.subject.svg : "";
  const svgError = errors.some((e) => e.startsWith("figure.regions[0].subject.svg") || e.startsWith("figure.regions[0].subject.refractMaskSvg"));
  const svgAuthored = svgStr.trim().length > 0 && !svgStr.trim().startsWith(PLACEHOLDER) && !svgError;

  if (!svgAuthored) {
    process.stdout.write("sketch PNG: skipped (subject.svg is still a placeholder or invalid); author subject.svg and run vyo sketch again.\n");
    return 0;
  }

  const stem = path.basename(file, path.extname(file));
  const pngPath = path.join(path.dirname(file), `${stem}-sketch.png`);
  const legend = spec.figure?.texts?.find((t) => t?.role === "legend");
  const drawn = {
    ...spec,
    product: {
      ...spec.product,
      name: typeof spec.product?.name === "string" && !spec.product.name.trim().startsWith(PLACEHOLDER) ? spec.product.name : facts.repo.name,
    },
    headline: typeof spec.headline === "string" && !spec.headline.trim().startsWith(PLACEHOLDER) ? spec.headline : `${facts.repo.name} poster`,
    figure: {
      ...spec.figure,
      regions: [
        {
          ...region,
          microType: (region.microType ?? []).filter((m) => m && typeof m.text === "string" && !m.text.trim().startsWith(PLACEHOLDER)),
        },
      ],
      texts: [
        {
          role: "legend",
          id: legend?.id ?? "legend",
          text: typeof legend?.text === "string" && !legend.text.trim().startsWith(PLACEHOLDER) ? legend.text : "",
        },
      ],
    },
  };

  try {
    const html = buildPage(drawn, facts);
    const page = await renderLuminousSketch({ html, pngPath });
    if (page.luminous) {
      const m = page.luminous;
      process.stdout.write(
        `metrics: lit=${pct(m.litShare)}, accent=${pct(m.accentShare)}, tonal=${m.tonalRichness.activeBins} bins / ${pct(m.tonalRichness.midToneRatio)} mid-tones, sanctuary collisions=${m.sanctuaryCollisions}, microType=${m.microPlaced}/${m.microRequested}\n`,
      );
    }
    for (const c of CHECKS.filter((x) => x.stage === "page" && x.frames?.includes("luminous"))) {
      for (const m of c.run({ spec: drawn, facts, presets, page })) {
        process.stdout.write(`${c.level === "fail" ? "✗" : "!"} ${c.id}: ${m}\n`);
      }
    }
    process.stdout.write(`sketch PNG: ${path.resolve(pngPath)}, open it to inspect the 7px optical mosaic and 0.5-second recognizability\n`);
  } catch (e) {
    if (e instanceof NoBrowser) {
      warn(`sketch PNG skipped (${e.message})`);
    } else {
      throw e;
    }
  }
  return 0;
}

async function cmdSketch(argv) {
  const { pos, opt } = args(argv, { facts: { type: "string" } }, 1);
  const spec = readJson(pos[0], "poster spec");
  if (spec?.frame === "cover") return coverSketch(pos[0], spec, opt);
  if (spec?.frame === "plate") return plateSketch(pos[0], spec, opt);
  if (spec?.frame === "luminous") return luminousSketch(pos[0], spec, opt);
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
    process.stdout.write(`sketch PNG: ${path.resolve(file)}, the silhouette at a third of its size with its shading; open it and check it reads as the object\n`);
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
  if (files.gif && !spec.motion) throw new Failure("render --gif needs motion on the spec: { kind, frames, fps }");
  const base = path.join(outDir, `${repo}-poster`);
  let html;
  try {
    html = buildPage(spec, facts);
  } catch (e) {
    throw new Failure(e.message);
  }
  const page = await renderPage({ html, base, motion: spec.motion ?? null, format: spec.format ?? "poster", ...files });
  return report(runChecks("page", { ...input, page }));
}

async function cmdRender(argv) {
  const { pos, opt } = args(
    argv,
    { facts: { type: "string" }, out: { type: "string" }, "no-png": { type: "boolean" }, "no-pdf": { type: "boolean" }, gif: { type: "boolean" }, paper: { type: "string", default: "fit" } },
    1,
  );
  if (!PAPERS.includes(opt.paper)) throw new Usage(`--paper must be ${PAPERS.join(", ")}`);
  const outDir = opt.out ?? path.dirname(pos[0]);
  const fails = await poster(pos[0], opt, outDir, { png: !opt["no-png"], pdf: !opt["no-pdf"], gif: !!opt.gif, paper: opt.paper });
  const code = fails ? 1 : 0;
  const repo = readJson(pos[0], "poster spec").product.repo;
  const made = ["html", ...(opt["no-png"] ? [] : ["png", "thumb"]), ...(opt["no-pdf"] ? [] : ["pdf"]), ...(opt.gif ? ["gif", "mp4"] : [])]
    .map((x) => path.join(outDir, x === "thumb" ? `${repo}-poster-thumb.png` : `${repo}-poster.${x}`))
    .filter(fs.existsSync);
  if (made.length) process.stdout.write(`${code ? "Wrote, with failures" : "Wrote"}: ${made.join(", ")}\n`);
  if (!code) process.stdout.write("PASS\n");
  else err(`POSTER NOT FINISHED: fix the ${fails} ✗ line${fails === 1 ? "" : "s"} above, then run vyo render again. Any files written above are a failed draft, not the result.`);
  return code;
}

/** Render 2+ poster/cover/plate specs and tile them horizontally on paper into <out>.png (and <out>.gif/.mp4 with --gif). */
async function cmdSeries(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: { out: { type: "string" }, gif: { type: "boolean" }, gap: { type: "string", default: "24" } }, allowPositionals: true });
  } catch (e) {
    throw new Usage(e.message);
  }
  const files = parsed.positionals;
  const opt = parsed.values;
  if (files.length < 2) throw new Usage("series needs at least 2 spec files");
  if (!opt.out) throw new Usage("series needs --out <base> (writes <base>.png, and with --gif <base>.gif and <base>.mp4)");
  const gap = Math.max(0, Math.min(80, Number(opt.gap) || 24));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vyo-series-"));
  try {
    const pngs = [];
    const mp4s = [];
    const pad = String(files.length).padStart(2, "0");
    for (let i = 0; i < files.length; i++) {
      const specFile = files[i];
      const spec = readJson(specFile, "poster spec");
      const facts = factsFor(specFile, spec, {});
      if ((spec.frame === "cover" || spec.frame === "plate") && !spec.series) spec.series = `${String(i + 1).padStart(2, "0")}/${pad}`;
      const subDir = path.join(tmp, `s${i}`);
      fs.mkdirSync(subDir, { recursive: true });
      const tmpSpec = path.join(subDir, path.basename(specFile));
      fs.writeFileSync(tmpSpec, JSON.stringify(spec, null, 2));
      const tmpFacts = path.join(subDir, `${spec.product.repo}-facts.json`);
      fs.writeFileSync(tmpFacts, JSON.stringify(facts));
      const fails = await poster(tmpSpec, { facts: tmpFacts }, subDir, { png: true, pdf: false, gif: !!opt.gif, paper: "fit" });
      if (fails) return 1;
      pngs.push(path.join(subDir, `${spec.product.repo}-poster.png`));
      if (opt.gif) mp4s.push(path.join(subDir, `${spec.product.repo}-poster.mp4`));
    }
    const base = path.resolve(opt.out.replace(/\.png$/i, ""));
    fs.mkdirSync(path.dirname(base), { recursive: true });
    const runFfmpeg = (a, what) => {
      const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...a], { encoding: "utf8" });
      if (r.error?.code === "ENOENT") throw new GifFailure("vyo series needs ffmpeg on PATH");
      if (r.error || r.status !== 0) throw new GifFailure(`ffmpeg could not tile ${what}: ${(r.stderr || r.error?.message || `exit ${r.status}`).trim()}`);
    };
    const n = pngs.length;
    const h = 1190;
    const padColor = "#EAE8E2";
    const scalePad = (i) => `[${i}:v]scale=-2:${h}:flags=lanczos,pad=iw+${i === 0 ? gap * 2 : gap}:ih+${gap * 2}:${i === 0 ? gap : 0}:${gap}:color=${padColor}[v${i}]`;
    const filter = `${pngs.map((_, i) => scalePad(i)).join(";")};${pngs.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${n}`;
    runFfmpeg([...pngs.flatMap((p) => ["-i", p]), "-filter_complex", filter, `${base}.png`], "series PNG");
    const made = [`${base}.png`];
    if (opt.gif && mp4s.every((m) => fs.existsSync(m))) {
      const gh = 540;
      const gGap = Math.round((gap * gh) / h);
      const vScale = (i) => `[${i}:v]fps=12,trim=duration=3.5,setpts=PTS-STARTPTS,scale=-2:${gh}:flags=area,pad=iw+${i === 0 ? gGap * 2 : gGap}:ih+${gGap * 2}:${i === 0 ? gGap : 0}:${gGap}:color=${padColor}[v${i}]`;
      const vFilter = `${mp4s.map((_, i) => vScale(i)).join(";")};${mp4s.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${n}:shortest=1`;
      runFfmpeg([...mp4s.flatMap((p) => ["-stream_loop", "-1", "-i", p]), "-filter_complex", `${vFilter},split[a][b];[a]palettegen=max_colors=48:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`, "-loop", "0", `${base}.gif`], "series GIF");
      runFfmpeg([...mp4s.flatMap((p) => ["-stream_loop", "-1", "-i", p]), "-filter_complex", vFilter, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", `${base}.mp4`], "series MP4");
      made.push(`${base}.gif`, `${base}.mp4`);
    }
    process.stdout.write(`Wrote: ${made.join(", ")}\nPASS\n`);
    return 0;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
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

const COMMANDS = { init: cmdInit, scan: cmdScan, show: cmdShow, parts: cmdParts, presets: cmdPresets, shapes: cmdShapes, compose: cmdCompose, sketch: cmdSketch, render: cmdRender, series: cmdSeries, check: cmdCheck };

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
    if (e instanceof Failure || e instanceof NoBrowser || e instanceof GifFailure || e instanceof MaskFailure) {
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
