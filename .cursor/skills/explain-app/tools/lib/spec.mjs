// The poster spec: the one file the agent writes. Pure validation, no I/O, no text measuring.
import { isJargon } from "./jargon.mjs";
import { SHEET, SHAPE_KEYS, parsePath } from "./geometry.mjs";
import { FIELDS } from "./fields/index.mjs";
import { WAVE } from "./fields/wave.mjs";

/**
 * @typedef {"soft" | "mid" | "ink" | "cold" | "cool"} ToneName
 * @typedef {ToneName | ToneName[]} Tone  a name, or 2 or 3 stops from the region's top row to its bottom row
 * @typedef {{ profile: [number, number, number][] } | { ellipse: { cx: number, cy: number, rx: number, ry: number } }
 *         | { polygon: [number, number][] } | { path: string }} Shape
 * @typedef {Shape & { kind: "fill", id: string, holes?: Shape[], words: string[], tone: Tone, caps?: boolean,
 *                     band?: 1 | 2 | 3 | 4, size?: 11 | 12, hot?: boolean }} FillRegion
 * @typedef {{ kind: "dots", id: string, lines: string[], x: number, y: number, cell: number, tones: (ToneName | "hot")[] }} DotsRegion
 * @typedef {{ kind: "field", id: string, field: "wave" | "terrain", accent?: string, names?: Record<string, string>,
 *             sentence?: string, every?: number, minShare?: number, maxParts?: number }} FieldRegion  drawn from facts.json at render
 * @typedef {{ role: "masthead" | "headline" | "display" | "aside" | "label", id: string, text?: string, x: number, y: number, w: number,
 *             size?: number, align?: "left" | "right" | "center", hot?: boolean }} Text
 * @typedef {{
 *   version: 3,
 *   facts: string,
 *   product: { name: string, repo: string, commit?: string, date: string },
 *   theme: "light" | "dark",
 *   accent?: string,
 *   headline: string,
 *   hot?: string,  required unless the figure has a field
 *   figure: { fits: string, regions: (FillRegion | DotsRegion | FieldRegion)[], texts: Text[] },
 *   notes: { title: string, text: string }[],
 *   notBuilt: string[],
 *   audience?: string,
 * }} Spec
 */

export const PLACEHOLDER = "…";
export const LIMITS = {
  name: 24, headline: 72, hot: 24, noteTitle: 24, noteText: 220, notBuilt: 6, notBuiltItem: 32, audience: 40,
  fits: 160, regions: 6, texts: 6, words: [2, 14], word: 24, lines: [2, 4], line: 5, aside: 160, label: 32, display: 40,
  profile: [3, 24], polygon: [3, 40], holes: 4, path: 4000, fields: 1, partName: 24, sentence: 40, every: [2, 20], minShare: [0, 0.2], maxParts: [2, 24],
};
export const TONES = ["soft", "mid", "ink", "cold", "cool"];
export const DOT_TONES = [...TONES, "hot"];
export const ROLES = ["masthead", "headline", "display", "aside", "label"];
export const THEMES = ["light", "dark"];
// size: [default, min, max] per text role. A hot label is the accent word set large, like the hourglass waist.
export const TEXT_SIZE = { masthead: [84, 48, 120], headline: [22, 18, 40], display: [56, 32, 64], aside: [12, 10, 14], label: [12, 10, 32], hotLabel: [26, 10, 32] };
// Block names the footer uses; a figure text cannot take one.
const RESERVED = ["note", "counts", "notBuilt", "provenance", "credit"];

// Keys that only some kinds of field take, like the wave's sentence.
const FIELD_OPTIONS = [...new Set(Object.values(FIELDS).flatMap((f) => f.options))];
const KEYS = {
  spec: ["version", "facts", "product", "theme", "accent", "headline", "hot", "figure", "notes", "notBuilt", "audience"],
  product: ["name", "repo", "commit", "date"],
  note: ["title", "text"],
  figure: ["fits", "regions", "texts"],
  fill: ["kind", "id", ...SHAPE_KEYS, "holes", "words", "tone", "caps", "band", "size", "hot"],
  dots: ["kind", "id", "lines", "x", "y", "cell", "tones"],
  field: ["kind", "id", "field", "accent", "names", "minShare", "maxParts", ...FIELD_OPTIONS],
  text: ["role", "id", "text", "x", "y", "w", "size", "align", "hot"],
  ellipse: ["cx", "cy", "rx", "ry"],
};

const isStr = (v) => typeof v === "string";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isPlaceholder = (v) => isStr(v) && v.trim().startsWith(PLACEHOLDER);
const inRange = (v, lo, hi) => isNum(v) && v >= lo && v <= hi;

/** Whole-word, case-folded: does `phrase` occur in `text`? Self-contained: render injects its source into the page. */
export function hasWord(text, phrase) {
  const fold = (x) => String(x).toLowerCase().replace(/\s+/g, " ").trim();
  const needle = fold(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${needle}($|[^\\p{L}\\p{N}])`, "u").test(fold(text));
}

const PATH = [
  /[\w.-]*\/[\w./-]*\.[a-z]{1,5}\b/i,
  /(^|[^\w])(src|lib|app|components|pages|api)\//i,
  /\b[\w-]+\.(tsx?|jsx?|mjs|cjs|py|rb|go|rs|json|ya?ml|sql|prisma|css|html|mdx?|env)\b/i,
];
const NUMBER_MARKER = /(^|\s)0[1-9](?=[\s.:)]|$)/;

/** Problems with poster copy the agent wrote: jargon, file paths, AI tells. */
export function textProblems(text) {
  const out = [];
  const jargon = isJargon(text);
  if (jargon.length) out.push(`jargon: ${jargon.map((j) => `"${j}"`).join(", ")}`);
  if (PATH.some((re) => re.test(text))) out.push("a file path");
  if (NUMBER_MARKER.test(text)) out.push('a "01/02/03" style marker');
  if (text.includes("·")) out.push("a middle dot");
  return out;
}

function unknownKeys(obj, allowed, where, err) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) err(`${where}${k}: unknown field`);
}

const toneOk = (t) => (isStr(t) ? TONES.includes(t) : Array.isArray(t) && t.length >= 2 && t.length <= 3 && t.every((x) => TONES.includes(x)));

/** Rules for one shape: exactly one of profile, ellipse, polygon or path, its numbers in range. */
function checkShape(where, s, err) {
  const given = SHAPE_KEYS.filter((k) => s[k] !== undefined);
  if (given.length !== 1) return err(`${where}: give exactly one of ${SHAPE_KEYS.join(", ")} (found ${given.length ? given.join(", ") : "none"})`);
  const [kind] = given;
  const v = s[kind];
  const f = `${where}.${kind}`;
  if (kind === "profile") {
    const [lo, hi] = LIMITS.profile;
    if (!Array.isArray(v) || v.length < lo || v.length > hi) return err(`${f}: ${lo} to ${hi} stops of [y, cx, halfWidth]`);
    v.forEach((stop, i) => {
      if (!Array.isArray(stop) || stop.length !== 3 || !stop.every(isNum)) return err(`${f}[${i}]: must be [y, cx, halfWidth]`);
      const [y, cx, hw] = stop;
      if (!inRange(y, 0, SHEET.height) || !inRange(cx, 0, SHEET.width)) err(`${f}[${i}]: y must be 0 to ${SHEET.height} and cx 0 to ${SHEET.width}`);
      if (!inRange(hw, 0, SHEET.width / 2)) err(`${f}[${i}]: halfWidth must be 0 to ${SHEET.width / 2}`);
      if (i > 0 && Array.isArray(v[i - 1]) && isNum(v[i - 1][0]) && !(y > v[i - 1][0])) err(`${f}[${i}]: y must be greater than the stop before`);
    });
    if (v.every((st) => Array.isArray(st) && st[2] === 0)) err(`${f}: every halfWidth is 0`);
  } else if (kind === "ellipse") {
    if (!isObj(v)) return err(`${f}: must be { cx, cy, rx, ry }`);
    unknownKeys(v, KEYS.ellipse, `${f}.`, err);
    if (!inRange(v.cx, 0, SHEET.width) || !inRange(v.cy, 0, SHEET.height)) err(`${f}: cx must be 0 to ${SHEET.width} and cy 0 to ${SHEET.height}`);
    if (!inRange(v.rx, 1, SHEET.width) || !inRange(v.ry, 1, SHEET.height)) err(`${f}: rx and ry must be 1 to ${SHEET.width}`);
  } else if (kind === "polygon") {
    const [lo, hi] = LIMITS.polygon;
    if (!Array.isArray(v) || v.length < lo || v.length > hi) return err(`${f}: ${lo} to ${hi} points of [x, y]`);
    v.forEach((p, i) => {
      if (!Array.isArray(p) || p.length !== 2 || !p.every(isNum)) return err(`${f}[${i}]: must be [x, y]`);
      if (!inRange(p[0], 0, SHEET.width) || !inRange(p[1], 0, SHEET.height)) err(`${f}[${i}]: must be inside the ${SHEET.width} by ${SHEET.height} sheet`);
    });
  } else {
    if (!isStr(v) || !v.trim()) return err(`${f}: must be an SVG path string`);
    if (v.length > LIMITS.path) return err(`${f}: ${v.length} characters; at most ${LIMITS.path}`);
    const parsed = parsePath(v);
    if (parsed.error) err(`${f}: does not parse: ${parsed.error}`);
  }
}

function checkFill(f, r, err) {
  checkShape(f, r, err);
  if (r.holes !== undefined) {
    if (!Array.isArray(r.holes) || r.holes.length > LIMITS.holes) err(`${f}.holes: a list of at most ${LIMITS.holes} shapes`);
    else
      r.holes.forEach((h, i) => {
        if (!isObj(h)) return err(`${f}.holes[${i}]: must be { profile }, { ellipse }, { polygon } or { path }`);
        unknownKeys(h, SHAPE_KEYS, `${f}.holes[${i}].`, err);
        checkShape(`${f}.holes[${i}]`, h, err);
      });
  }
  const [lo, hi] = LIMITS.words;
  if (!Array.isArray(r.words) || !r.words.every(isStr)) err(`${f}.words: must be a list of words`);
  else if (r.words.some(isPlaceholder)) err(`${f}.words: still the placeholder; write ${lo} to ${hi} nouns in the user's words`);
  else {
    if (r.words.length < lo || r.words.length > hi) err(`${f}.words: ${r.words.length} words; use ${lo} to ${hi}`);
    r.words.forEach((w, i) => {
      if (!w.trim()) err(`${f}.words[${i}]: empty`);
      if (w.length > LIMITS.word) err(`${f}.words[${i}]: "${w}" is ${w.length} characters; at most ${LIMITS.word}`);
    });
  }
  if (!toneOk(r.tone)) err(`${f}.tone: one of ${TONES.join(", ")}, or a list of 2 or 3 of them (top row to bottom row)`);
  if (r.caps !== undefined && typeof r.caps !== "boolean") err(`${f}.caps: true or false`);
  if (r.hot !== undefined && typeof r.hot !== "boolean") err(`${f}.hot: true or false`);
  if (r.band !== undefined && ![1, 2, 3, 4].includes(r.band)) err(`${f}.band: 1 to 4 rows per word`);
  if (r.size !== undefined && ![11, 12].includes(r.size)) err(`${f}.size: 11 or 12`);
}

function checkDots(f, r, err) {
  const [lo, hi] = LIMITS.lines;
  if (!Array.isArray(r.lines) || !r.lines.every(isStr)) err(`${f}.lines: must be a list of words`);
  else if (r.lines.some(isPlaceholder)) err(`${f}.lines: still the placeholder; write ${lo} to ${hi} words of at most ${LIMITS.line} letters`);
  else {
    if (r.lines.length < lo || r.lines.length > hi) err(`${f}.lines: ${r.lines.length} lines; use ${lo} to ${hi}`);
    r.lines.forEach((w, i) => {
      if (!/^[A-Za-z ]+$/.test(w) || !w.trim()) err(`${f}.lines[${i}]: "${w}" must be letters A to Z and spaces`);
      if (w.length > LIMITS.line) err(`${f}.lines[${i}]: "${w}" is ${w.length} characters; at most ${LIMITS.line}`);
    });
    if (!Array.isArray(r.tones) || r.tones.length !== r.lines.length || !r.tones.every((t) => DOT_TONES.includes(t))) {
      err(`${f}.tones: one of ${DOT_TONES.join(", ")} per line (${r.lines.length})`);
    }
  }
  if (!inRange(r.x, 0, SHEET.width) || !inRange(r.y, 0, SHEET.height)) err(`${f}: x must be 0 to ${SHEET.width} and y 0 to ${SHEET.height}`);
  if (!Number.isInteger(r.cell) || r.cell < 8 || r.cell > 32) err(`${f}.cell: a whole number of px, 8 to 32`);
}

function checkField(f, r, err, copy) {
  const kind = FIELDS[r.field];
  if (!kind) return err(`${f}.field: "${r.field}" is not a field; use ${Object.keys(FIELDS).join(" or ")}`);
  for (const k of FIELD_OPTIONS) {
    if (r[k] !== undefined && !kind.options.includes(k)) err(`${f}.${k}: a ${r.field} field has no ${k}; only ${Object.keys(FIELDS).filter((n) => FIELDS[n].options.includes(k)).join(", ")} takes it`);
  }
  if (r.accent !== undefined && !(isStr(r.accent) && /^area:\S+$/.test(r.accent))) err(`${f}.accent: an area id like "area:lib/plan", or a glob of them; vyo parts lists the ids`);
  const plain = (where, v, max, what) => {
    if (!isStr(v) || !v.trim()) return err(`${where}: missing`);
    if (isPlaceholder(v)) return err(`${where}: still the placeholder; write ${what}`);
    if (v.length > max) err(`${where}: ${v.length} characters; at most ${max}`);
    copy.push([where, v]);
  };
  if (r.names !== undefined) {
    if (!isObj(r.names)) err(`${f}.names: a map from part id to plain name`);
    else
      for (const [id, name] of Object.entries(r.names)) {
        if (!/^area:\S+$/.test(id)) err(`${f}.names: "${id}" is not a part id like "area:lib/plan"`);
        plain(`${f}.names["${id}"]`, name, LIMITS.partName, "a plain name for the part");
      }
  }
  if (r.sentence !== undefined) plain(`${f}.sentence`, r.sentence, LIMITS.sentence, "one plain sentence, or remove it");
  const whole = (k) => {
    const [lo, hi] = LIMITS[k];
    if (r[k] !== undefined && !(Number.isInteger(r[k]) && inRange(r[k], lo, hi))) err(`${f}.${k}: a whole number, ${lo} to ${hi}`);
  };
  whole("every");
  whole("maxParts");
  if (r.minShare !== undefined && !inRange(r.minShare, ...LIMITS.minShare)) err(`${f}.minShare: ${LIMITS.minShare[0]} to ${LIMITS.minShare[1]}, a share of the lines`);
}

function checkText(f, t, err, copy) {
  if (!ROLES.includes(t.role)) return err(`${f}.role: "${t.role}" is not a role; use ${ROLES.join(", ")}`);
  const named = t.role !== "masthead" && t.role !== "headline";
  if (named) {
    const max = LIMITS[t.role];
    if (!isStr(t.text) || !t.text.trim()) err(`${f}.text: missing`);
    else if (isPlaceholder(t.text)) err(`${f}.text: still the placeholder; write it`);
    else {
      if (t.text.length > max) err(`${f}.text: ${t.text.length} characters; at most ${max}`);
      if (t.text.replace(/^\*\*[^*]+\*\*/, "").includes("**")) err(`${f}.text: **bold** is allowed only at the start`);
      copy.push([`${f}.text`, t.text.replace(/\*\*/g, "")]);
    }
  } else if (t.text !== undefined) err(`${f}.text: the ${t.role} prints ${t.role === "masthead" ? "product.name" : "the spec's headline"}; leave text out`);
  if (t.hot !== undefined && (t.role !== "label" || typeof t.hot !== "boolean")) err(`${f}.hot: only a label can be hot`);
  if (!inRange(t.x, 0, SHEET.width) || !inRange(t.y, 0, SHEET.height)) err(`${f}: x must be 0 to ${SHEET.width} and y 0 to ${SHEET.height}`);
  if (!inRange(t.w, 16, SHEET.width)) err(`${f}.w: 16 to ${SHEET.width}`);
  const [, lo, hi] = TEXT_SIZE[t.role === "label" && t.hot ? "hotLabel" : t.role];
  if (t.size !== undefined && !inRange(t.size, lo, hi)) err(`${f}.size: ${lo} to ${hi}`);
  if (t.align !== undefined && !["left", "right", "center"].includes(t.align)) err(`${f}.align: left, right or center`);
}

function checkFigure(fig, err, copy) {
  if (!isObj(fig)) return err("figure: must be { fits, regions, texts }");
  unknownKeys(fig, KEYS.figure, "figure.", err);
  if (!isStr(fig.fits) || !fig.fits.trim()) err("figure.fits: missing");
  else if (isPlaceholder(fig.fits)) err("figure.fits: still the placeholder; say what the picture is and why it acts out the main moment");
  else if (fig.fits.length > LIMITS.fits) err(`figure.fits: ${fig.fits.length} characters; at most ${LIMITS.fits}`);

  const ids = new Set();
  const idOk = (f, id) => {
    if (!isStr(id) || !/^[a-z][a-z0-9-]{0,23}$/.test(id)) return err(`${f}.id: lowercase letters, digits and dashes, at most 24`);
    if (RESERVED.includes(id)) return err(`${f}.id: "${id}" is a footer block; pick another`);
    if (ids.has(id)) err(`${f}.id: "${id}" is used twice`);
    ids.add(id);
  };

  if (!Array.isArray(fig.regions) || fig.regions.length < 1 || fig.regions.length > LIMITS.regions) err(`figure.regions: 1 to ${LIMITS.regions} regions`);
  else
    fig.regions.forEach((r, i) => {
      const f = `figure.regions[${i}]`;
      if (!isObj(r)) return err(`${f}: must be a region`);
      if (!["fill", "dots", "field"].includes(r.kind)) return err(`${f}.kind: "${r.kind}" is not a region kind; use field, fill or dots`);
      unknownKeys(r, KEYS[r.kind], `${f}.`, err);
      idOk(f, r.id);
      if (r.kind === "fill") checkFill(f, r, err);
      else if (r.kind === "dots") checkDots(f, r, err);
      else checkField(f, r, err, copy);
      for (const [k, list] of [["words", r.words], ["lines", r.lines]]) if (Array.isArray(list) && !list.some(isPlaceholder)) list.forEach((w, j) => isStr(w) && copy.push([`${f}.${k}[${j}]`, w]));
    });

  if (Array.isArray(fig.regions) && fig.regions.filter((r) => isObj(r) && r.kind === "field").length > LIMITS.fields) err(`figure.regions: at most ${LIMITS.fields} field region`);

  if (!Array.isArray(fig.texts) || fig.texts.length < 1 || fig.texts.length > LIMITS.texts) return err(`figure.texts: 1 to ${LIMITS.texts} texts`);
  fig.texts.forEach((t, i) => {
    const f = `figure.texts[${i}]`;
    if (!isObj(t)) return err(`${f}: must be a text`);
    unknownKeys(t, KEYS.text, `${f}.`, err);
    idOk(f, t.id);
    checkText(f, t, err, copy);
  });
  const count = (role) => fig.texts.filter((t) => isObj(t) && t.role === role).length;
  if (count("masthead") !== 1) err(`figure.texts: ${count("masthead")} mastheads; use exactly one`);
  if (count("headline") > 1) err(`figure.texts: ${count("headline")} headlines; use at most one`);
}

/** Does the figure have a field region? */
export const hasField = (fig) => Array.isArray(fig?.regions) && fig.regions.some((r) => isObj(r) && r.kind === "field");

/** Every word the hot word may come from: fill words, dots lines and hot labels. */
function hotPool(fig) {
  const regions = Array.isArray(fig?.regions) ? fig.regions.filter(isObj) : [];
  const texts = Array.isArray(fig?.texts) ? fig.texts.filter(isObj) : [];
  return {
    words: [...regions.flatMap((r) => [...(Array.isArray(r.words) ? r.words : []), ...(Array.isArray(r.lines) ? r.lines : [])]), ...texts.filter((t) => t.hot).map((t) => t.text)].filter(isStr),
    hotRegion: regions.some((r) => r.kind === "fill" && r.hot === true),
  };
}

/**
 * Every rule a spec must pass before render. Returns error strings, each naming its field.
 * @param {unknown} spec
 * @returns {string[]}
 */
export function validateSpec(spec) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!isObj(spec)) return ["spec: must be a JSON object"];
  unknownKeys(spec, KEYS.spec, "", err);

  if (spec.version !== 3) err("version: must be 3");
  if (!isStr(spec.facts) || !/^[0-9a-f]{12}$/.test(spec.facts)) err("facts: must be the 12-character hash from facts.json");

  const p = spec.product;
  if (!isObj(p)) err("product: missing");
  else {
    unknownKeys(p, KEYS.product, "product.", err);
    if (!isStr(p.name) || !p.name.trim() || isPlaceholder(p.name)) err("product.name: missing");
    else if (p.name.length > LIMITS.name) err(`product.name: ${p.name.length} characters; at most ${LIMITS.name}`);
    if (!isStr(p.repo) || !p.repo || p.repo.includes("/")) err("product.repo: must be the folder name of the project");
    if (p.commit !== undefined && !(isStr(p.commit) && /^[0-9a-f]{4,40}$/.test(p.commit))) err("product.commit: must be a short commit hash");
    if (!isStr(p.date) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) err("product.date: must be YYYY-MM-DD");
  }

  if (!THEMES.includes(spec.theme)) err(`theme: "${spec.theme}" is not a theme; use light or dark`);
  if (spec.accent !== undefined && !(isStr(spec.accent) && /^#[0-9a-f]{6}$/i.test(spec.accent))) err("accent: a hex colour like #9284FF");

  const copy = [];
  const field = (name, v, max) => {
    if (!isStr(v) || !v.trim()) return err(`${name}: missing`);
    if (isPlaceholder(v)) return err(`${name}: still the placeholder; write it`);
    if (v.length > max) err(`${name}: ${v.length} characters; at most ${max}`);
    copy.push([name, v]);
  };
  field("headline", spec.headline, LIMITS.headline);
  const before = errors.length;
  checkFigure(spec.figure, err, copy);
  const figureOk = errors.length === before;

  // A field's part names come from facts.json, so its hot word, if any, is checked on the page.
  const withField = hasField(spec.figure);
  if (spec.hot !== undefined || !withField) {
    if (!isStr(spec.hot) || !spec.hot.trim()) err("hot: missing");
    else if (isPlaceholder(spec.hot)) err("hot: still the placeholder; write it");
    else if (spec.hot.length > LIMITS.hot || spec.hot.trim().split(/\s+/).length > 2) err(`hot: one word or a two-word phrase, at most ${LIMITS.hot} characters`);
    else if (figureOk && !withField) {
      const pool = hotPool(spec.figure);
      if (!pool.hotRegion && !pool.words.some((w) => hasWord(w, spec.hot))) err(`hot: "${spec.hot}" must be in a fill region's words, a dots line or a hot label, or a region must be hot`);
    }
  }

  if (!Array.isArray(spec.notes)) err("notes: must be a list");
  else {
    if (spec.notes.length < 2 || spec.notes.length > 3) err(`notes: ${spec.notes.length} notes; use 2 or 3`);
    spec.notes.forEach((n, i) => {
      if (!isObj(n)) return err(`notes[${i}]: must be { title, text }`);
      unknownKeys(n, KEYS.note, `notes[${i}].`, err);
      field(`notes[${i}].title`, n.title, LIMITS.noteTitle);
      field(`notes[${i}].text`, n.text, LIMITS.noteText);
    });
  }

  if (!Array.isArray(spec.notBuilt)) err("notBuilt: must be a list (use [] for none)");
  else {
    if (spec.notBuilt.length > LIMITS.notBuilt) err(`notBuilt: ${spec.notBuilt.length} items; at most ${LIMITS.notBuilt}`);
    spec.notBuilt.forEach((x, i) => field(`notBuilt[${i}]`, x, LIMITS.notBuiltItem));
  }
  if (spec.audience !== undefined) field("audience", spec.audience, LIMITS.audience);

  for (const [name, text] of copy) for (const problem of textProblems(text)) err(`${name}: ${problem} in "${text}"`);
  return errors;
}

/** A region's geometry alone, as a string, for comparing a figure against the presets. */
export function geometryKey(r) {
  const pick = r.kind === "dots" ? ["x", "y", "cell"] : [...SHAPE_KEYS, "holes"];
  return JSON.stringify(pick.map((k) => r[k] ?? null));
}

const hold = (prompt) => `${PLACEHOLDER} ${prompt}`;

/**
 * The figure `compose` writes by default: one field region and the three usual texts, placed where the field
 * leaves room. Parts with unplain names get a placeholder in `names`.
 * @param {keyof typeof FIELDS} field
 * @param {number} floor
 * @param {{ accent?: string, unplain: { id: string, name: string }[] }} o
 */
function fieldFigure(field, floor, { accent, unplain }) {
  const at = FIELDS[field].texts(floor);
  return {
    fits: hold(`what the picture is and why it acts out the main moment, at most ${LIMITS.fits} characters`),
    regions: [
      {
        kind: "field",
        id: field,
        field,
        ...(accent ? { accent } : {}),
        ...(unplain.length ? { names: Object.fromEntries(unplain.map((p) => [p.id, hold(`a plain name for "${p.name}", at most ${LIMITS.partName} characters`)])) } : {}),
        ...(FIELDS[field].options.includes("sentence") ? { sentence: hold(`a sentence woven in every ${WAVE.every}th row, at most ${LIMITS.sentence} characters, or remove it`) } : {}),
      },
    ],
    texts: [
      { role: "masthead", id: "masthead", x: 50, y: 36, w: 490 },
      { role: "headline", id: "headline", ...at.headline },
      { role: "aside", id: "aside", ...at.aside, text: hold(`one or two sentences on what the field shows, at most ${LIMITS.aside} characters`) },
    ],
  };
}

/** A preset's figure with every word replaced by a placeholder and its geometry kept. */
function blankFigure(fig) {
  return {
    ...fig,
    fits: hold(`what the picture is and why it acts out the main moment, at most ${LIMITS.fits} characters`),
    regions: fig.regions.map((r) =>
      r.kind === "fill"
        ? { ...r, words: [hold(`${r.words.length} nouns in the user's words, like ${r.words.slice(0, 2).map((w) => `"${w}"`).join(", ")}`)] }
        : { ...r, lines: [hold(`${r.lines.length} words of at most ${LIMITS.line} letters, top to bottom`)] },
    ),
    texts: fig.texts.map((t) => (t.text === undefined ? t : { ...t, text: hold(`at most ${LIMITS[t.role]} characters, like "${t.text}"`) })),
  };
}

/**
 * The spec `compose` writes: everything known filled in, every word the agent must write a placeholder.
 * Without a preset, the figure is a field.
 * @param {{ hash: string, repo: { name: string } }} facts
 * @param {{ theme: "light" | "dark", commit?: string, date: string, floor: number, preset?: Spec,
 *           field?: keyof typeof FIELDS, accent?: string, unplain?: { id: string, name: string }[] }} o
 * @returns {Spec}
 */
export function scaffoldSpec(facts, { theme, commit, date, floor, preset, field = "wave", accent, unplain = [] }) {
  const notes = preset ? preset.notes.length : 3;
  return {
    version: 3,
    facts: facts.hash,
    product: { name: facts.repo.name, repo: facts.repo.name, ...(commit ? { commit } : {}), date },
    theme,
    ...(preset?.accent ? { accent: preset.accent } : {}),
    headline: hold(`one plain sentence about the outcome, at most ${LIMITS.headline} characters`),
    ...(preset ? { hot: hold("the one word set in the accent colour: a word of a fill region, a dots line or a hot label") } : {}),
    figure: preset ? blankFigure(preset.figure) : fieldFigure(field, floor, { accent, unplain }),
    notes: Array.from({ length: notes }, () => ({ title: hold(`at most ${LIMITS.noteTitle} characters`), text: hold(`at most ${LIMITS.noteText} characters`) })),
    notBuilt: [],
  };
}
