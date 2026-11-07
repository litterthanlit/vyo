// Every rule a poster must pass, as one table. "spec" checks run before render; "page" checks
// judge the measurements lib/inspect.js takes in the rendered page.
import { validateSpec, textProblems, hasWord, figureWords, slotsAtMax } from "./spec.mjs";
import { bandCounts, bandLine } from "./band.mjs";
import { FONT_FACES } from "./render.mjs";

const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
const tokensOf = (shape, spec) => shape.themes[spec.theme];
const overlap = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
const inside = (r, s) => r.left >= s.left - 0.5 && r.top >= s.top - 0.5 && r.right <= s.right + 0.5 && r.bottom <= s.bottom + 0.5;
const round = (n) => Math.round(n);

/**
 * @typedef {{ spec: any, facts: any, shapes: object, shape: any, page?: any }} CheckInput
 * @type {{ id: string, level: "fail" | "warn", stage: "spec" | "page", about: string, run: (i: CheckInput) => string[] }[]}
 */
export const CHECKS = [
  {
    id: "spec", level: "fail", stage: "spec", about: "the spec passes every rule in lib/spec.mjs",
    run: ({ spec, shapes }) => validateSpec(spec, shapes),
  },
  {
    id: "facts-hash", level: "fail", stage: "spec", about: "the spec was written for this facts.json",
    run: ({ spec, facts }) => (spec.facts === facts.hash ? [] : [`spec.facts is ${spec.facts} but facts.json is ${facts.hash}; the scan changed, so check the copy and set "facts" to ${facts.hash}`]),
  },
  {
    id: "facts-empty", level: "warn", stage: "spec", about: "the scan found something to count",
    run: ({ facts }) => (facts.empty ? ["no application facts; the footer shows provenance only"] : []),
  },
  {
    id: "product-name", level: "warn", stage: "spec", about: "the product name is the customer-facing name",
    run: ({ spec, facts }) => (spec.product.name === facts.repo.name ? [`product name equals the folder name "${facts.repo.name}"; use the name customers see`] : []),
  },
  {
    id: "slot-at-max", level: "warn", stage: "spec", about: "no slot is filled to its limit",
    run: ({ spec, shape }) => slotsAtMax(spec, shape).map((k) => `slots.${k} is at its maximum; check the poster for crowding`),
  },
  {
    id: "drawn", level: "fail", stage: "page", about: "the shape's script ran to the end",
    run: ({ page }) => [...page.errors.map((e) => `page error: ${e}`), ...(page.drawn ? [] : ["the shape never set window.drawn"])],
  },
  {
    id: "fonts", level: "fail", stage: "page", about: "Commit Mono 400 and 700 and Newsreader 400 loaded",
    run: ({ page }) =>
      FONT_FACES.filter(({ family, weight }) => !page.faces.some((f) => f.family === family && f.weight === String(weight) && f.status === "loaded")).map(
        ({ family, weight }) => `${family} ${weight} did not load`,
      ),
  },
  {
    id: "masthead-font", level: "warn", stage: "page", about: "Inter Display or Inter is installed for the product name",
    run: ({ page }) => (page.inter ? [] : ["neither Inter Display nor Inter is installed; the product name falls back to Helvetica or Arial"]),
  },
  {
    id: "rows-fit", level: "fail", stage: "page", about: "every row of words fits its planned width, inside the sheet",
    run: ({ page }) =>
      page.rows.flatMap((r) => [
        ...(r.scrollWidth > r.clientWidth ? [`the row "${r.word}" needs ${r.scrollWidth}px but has ${r.clientWidth}px; use shorter words`] : []),
        ...(inside(r.rect, page.sheet) ? [] : [`the row "${r.word}" sits outside the sheet`]),
      ]),
  },
  {
    id: "words-drawn", level: "fail", stage: "page", about: "every slot word and the hot word appear in the figure",
    run: ({ spec, shape, page }) => {
      const drawn = page.rows.map((r) => r.word);
      const missing = figureWords(spec, shape).filter((w) => !drawn.some((d) => d.toLowerCase() === w.toLowerCase()));
      const out = missing.map((w) => `"${w}" is in the slots but never drawn; it may not fit any row, use a shorter word`);
      if (!page.figureHot.some((t) => hasWord(t, spec.hot))) out.push(`the hot word "${spec.hot}" is not drawn in the accent colour`);
      return out;
    },
  },
  {
    id: "blocks-apart", level: "fail", stage: "page", about: "no two text blocks touch",
    run: ({ page }) => {
      const out = [];
      page.blocks.forEach((a, i) => page.blocks.slice(i + 1).forEach((b) => overlap(a.rect, b.rect) && out.push(`${a.name} overlaps ${b.name}; shorten one of them`)));
      return out;
    },
  },
  {
    id: "blocks-inside", level: "fail", stage: "page", about: "every text block is inside the sheet",
    run: ({ page }) => page.blocks.filter((b) => !inside(b.rect, page.sheet)).map((b) => `${b.name} runs off the sheet (bottom at ${round(b.rect.bottom)}px of ${page.sheet.bottom}px)`),
  },
  {
    id: "palette", level: "fail", stage: "page", about: "every colour on the sheet is one of the theme's tokens",
    run: ({ spec, shape, page }) => {
      const allowed = new Set(Object.values(tokensOf(shape, spec)).map(rgb));
      const bad = [...page.texts, ...page.boxes].filter((t) => !allowed.has(t.color));
      return [...new Set(bad.map((t) => `${t.where} uses ${t.color}, not a ${spec.theme} token`))];
    },
  },
  {
    id: "hot-tagged", level: "fail", stage: "page", about: "the accent colour is used only where data-hot marks it",
    run: ({ spec, shape, page }) => {
      const hot = rgb(tokensOf(shape, spec).hot);
      const bad = [...page.texts, ...page.boxes].filter((t) => t.color === hot && !t.hot);
      return [...new Set(bad.map((t) => `${t.where} is in the accent colour without data-hot`))];
    },
  },
  {
    id: "copy", level: "fail", stage: "page", about: "no jargon, file paths or AI tells in the visible words",
    run: ({ page }) => {
      const texts = [...page.blocks.filter((b) => b.owner !== "render" && b.name !== "masthead").map((b) => [b.name, b.text]), ...page.rows.map((r) => ["a row", r.word])];
      return [...new Set(texts.flatMap(([name, text]) => textProblems(text).map((p) => `${name}: ${p}`)))];
    },
  },
  {
    id: "notes", level: "fail", stage: "page", about: "the footer shows the shape's number of notes",
    run: ({ shape, page }) => {
      const n = page.blocks.filter((b) => b.name === "note").length;
      return n === shape.notes ? [] : [`the footer shows ${n} notes; ${shape.id} takes ${shape.notes}`];
    },
  },
  {
    id: "band", level: "fail", stage: "page", about: "the footer counts match facts.json",
    run: ({ facts, page }) => {
      const want = bandLine(bandCounts(facts));
      const got = page.blocks.find((b) => b.name === "counts")?.text ?? "";
      return got === want ? [] : [`the footer counts read "${got}" but facts.json gives "${want}"`];
    },
  },
  {
    id: "headline-lines", level: "warn", stage: "page", about: "the headline fits in two lines",
    run: ({ page }) => {
      const h = page.blocks.find((b) => b.name === "headline");
      return h && h.lines > 2 ? [`the headline runs to ${h.lines} lines; two read best`] : [];
    },
  },
];

/** Run one stage of the table. Returns `{ id, level, message }` for every finding. */
export function runChecks(stage, input) {
  const found = [];
  for (const c of CHECKS.filter((x) => x.stage === stage)) {
    found.push(...c.run(input).map((message) => ({ id: c.id, level: c.level, message })));
    if (c.id === "spec" && found.length) break;
  }
  return found;
}
