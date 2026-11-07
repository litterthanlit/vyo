// The poster spec: the one file the agent writes. Pure validation, no I/O.
import { isJargon } from "./jargon.mjs";

/**
 * @typedef {"words" | "phrase" | "line"} SlotKind
 * @typedef {{ kind: "words", min: number, max: number, each?: number, letters?: true, prompt: string }
 *         | { kind: "phrase", max: number, prompt: string }
 *         | { kind: "line", max: number, prompt: string }} Slot
 * @typedef {{ id: string, fits: string, themes: Record<string, Record<string, string>>, notes: 2 | 3,
 *             slots: Record<string, Slot>, hotWords: (slots: Record<string, string | string[]>) => string[],
 *             hotRule: string, draw: (spec: Spec, ctx: object) => string }} Shape
 * @typedef {{
 *   version: 2,
 *   facts: string,
 *   product: { name: string, repo: string, commit?: string, date: string },
 *   theme: string,
 *   shape: string,
 *   headline: string,
 *   hot: string,
 *   slots: Record<string, string | string[]>,
 *   notes: { title: string, text: string }[],
 *   notBuilt: string[],
 *   audience?: string,
 * }} Spec
 */

export const PLACEHOLDER = "…";
export const LIMITS = { name: 24, headline: 72, hot: 24, noteTitle: 24, noteText: 220, notBuilt: 6, notBuiltItem: 32, audience: 40, word: 24 };

const KEYS = {
  spec: ["version", "facts", "product", "theme", "shape", "headline", "hot", "slots", "notes", "notBuilt", "audience"],
  product: ["name", "repo", "commit", "date"],
  note: ["title", "text"],
};

const isStr = (v) => typeof v === "string";
const isPlaceholder = (v) => isStr(v) && v.trim().startsWith(PLACEHOLDER);
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

/** Every string of a slot value as written. */
export const slotStrings = (v) => (Array.isArray(v) ? v : [v]);

/** The words-kind slot values of a spec, for checking what the figure must show. */
export function figureWords(spec, shape) {
  return Object.entries(shape.slots).filter(([, s]) => s.kind === "words").flatMap(([k]) => spec.slots[k] || []);
}

const SLOT_RULES = {
  words(field, v, s, err) {
    if (!Array.isArray(v) || !v.every(isStr)) return err(`${field}: must be a list of words`);
    if (v.length < s.min || v.length > s.max) err(`${field}: ${v.length} words; use ${s.min} to ${s.max}`);
    const each = s.each ?? LIMITS.word;
    v.forEach((w, i) => {
      if (!w.trim()) err(`${field}[${i}]: empty`);
      if (w.length > each) err(`${field}[${i}]: "${w}" is ${w.length} characters; at most ${each}`);
      if (s.letters && !/^[A-Za-z]+$/.test(w)) err(`${field}[${i}]: "${w}" must be letters A to Z only`);
    });
  },
  phrase(field, v, s, err) {
    if (!isStr(v) || !v.trim()) return err(`${field}: must be a short phrase`);
    if (v.length > s.max) err(`${field}: ${v.length} characters; at most ${s.max}`);
  },
  line(field, v, s, err) {
    if (!isStr(v) || !v.trim()) return err(`${field}: must be one sentence`);
    if (v.length > s.max) err(`${field}: ${v.length} characters; at most ${s.max}`);
    if (v.replace(/^\*\*[^*]+\*\*/, "").includes("**")) err(`${field}: **bold** is allowed only at the start`);
  },
};

function unknownKeys(obj, allowed, where, err) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) err(`${where}${k}: unknown field`);
}

/**
 * Every rule a spec must pass before render. Returns error strings, each naming its field.
 * @param {unknown} spec
 * @param {Record<string, Shape>} shapes
 * @returns {string[]}
 */
export function validateSpec(spec, shapes) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) return ["spec: must be a JSON object"];
  unknownKeys(spec, KEYS.spec, "", err);

  if (spec.version !== 2) err("version: must be 2");
  if (!isStr(spec.facts) || !/^[0-9a-f]{12}$/.test(spec.facts)) err("facts: must be the 12-character hash from facts.json");

  const p = spec.product;
  if (!p || typeof p !== "object") err("product: missing");
  else {
    unknownKeys(p, KEYS.product, "product.", err);
    if (!isStr(p.name) || !p.name.trim() || isPlaceholder(p.name)) err("product.name: missing");
    else if (p.name.length > LIMITS.name) err(`product.name: ${p.name.length} characters; at most ${LIMITS.name}`);
    if (!isStr(p.repo) || !p.repo || p.repo.includes("/")) err("product.repo: must be the folder name of the project");
    if (p.commit !== undefined && !(isStr(p.commit) && /^[0-9a-f]{4,40}$/.test(p.commit))) err("product.commit: must be a short commit hash");
    if (!isStr(p.date) || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) err("product.date: must be YYYY-MM-DD");
  }

  const shape = shapes[spec.shape];
  if (!shape) {
    err(`shape: "${spec.shape}" is not a shape; use one of ${Object.keys(shapes).join(", ")}`);
    return errors;
  }
  if (!Object.hasOwn(shape.themes, spec.theme)) err(`theme: "${spec.theme}" is not a theme of ${shape.id}; use ${Object.keys(shape.themes).join(" or ")}`);

  const copy = [];
  const field = (name, v, max) => {
    if (!isStr(v) || !v.trim()) return err(`${name}: missing`);
    if (isPlaceholder(v)) return err(`${name}: still the placeholder; write it`);
    if (v.length > max) err(`${name}: ${v.length} characters; at most ${max}`);
    copy.push([name, v]);
  };
  field("headline", spec.headline, LIMITS.headline);

  const slots = spec.slots;
  if (!slots || typeof slots !== "object" || Array.isArray(slots)) err("slots: missing");
  else {
    unknownKeys(slots, Object.keys(shape.slots), "slots.", err);
    for (const [name, s] of Object.entries(shape.slots)) {
      const v = slots[name];
      const f = `slots.${name}`;
      if (v === undefined) {
        err(`${f}: missing (${s.prompt})`);
        continue;
      }
      if (slotStrings(v).some(isPlaceholder)) {
        err(`${f}: still the placeholder; ${s.prompt}`);
        continue;
      }
      SLOT_RULES[s.kind](f, v, s, err);
      slotStrings(v).forEach((x, i) => isStr(x) && copy.push([Array.isArray(v) ? `${f}[${i}]` : f, x.replace(/\*\*/g, "")]));
    }
  }

  if (!isStr(spec.hot) || !spec.hot.trim()) err("hot: missing");
  else if (isPlaceholder(spec.hot)) err("hot: still the placeholder; write it");
  else if (spec.hot.length > LIMITS.hot || spec.hot.trim().split(/\s+/).length > 2) err(`hot: one word or a two-word phrase, at most ${LIMITS.hot} characters`);
  else if (errors.every((e) => !e.startsWith("slots"))) {
    const pool = shape.hotWords(slots);
    if (!pool.some((w) => hasWord(w, spec.hot))) err(`hot: "${spec.hot}" must be ${shape.hotRule}`);
  }

  if (!Array.isArray(spec.notes)) err("notes: must be a list");
  else {
    if (spec.notes.length !== shape.notes) err(`notes: ${spec.notes.length} notes; ${shape.id} takes exactly ${shape.notes}`);
    spec.notes.forEach((n, i) => {
      if (!n || typeof n !== "object") return err(`notes[${i}]: must be { title, text }`);
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

/** Slots filled to their maximum, for the `!` warning. */
export function slotsAtMax(spec, shape) {
  return Object.entries(shape.slots)
    .filter(([k, s]) => spec.slots[k].length === s.max)
    .map(([k]) => k);
}

/**
 * The spec `compose` writes: everything known filled in, every slot holding its prompt as a placeholder.
 * @param {{ hash: string, repo: { name: string } }} facts
 * @param {Shape} shape
 * @param {{ theme: string, commit?: string, date: string }} o
 * @returns {Spec}
 */
export function scaffoldSpec(facts, shape, { theme, commit, date }) {
  const hold = (prompt) => `${PLACEHOLDER} ${prompt}`;
  return {
    version: 2,
    facts: facts.hash,
    product: { name: facts.repo.name, repo: facts.repo.name, ...(commit ? { commit } : {}), date },
    theme,
    shape: shape.id,
    headline: hold(`one plain sentence about the outcome, at most ${LIMITS.headline} characters`),
    hot: hold(`the one word set in the accent colour: ${shape.hotRule}`),
    slots: Object.fromEntries(Object.entries(shape.slots).map(([k, s]) => [k, s.kind === "words" ? [hold(s.prompt)] : hold(s.prompt)])),
    notes: Array.from({ length: shape.notes }, () => ({ title: hold(`at most ${LIMITS.noteTitle} characters`), text: hold(`at most ${LIMITS.noteText} characters`) })),
    notBuilt: [],
  };
}
