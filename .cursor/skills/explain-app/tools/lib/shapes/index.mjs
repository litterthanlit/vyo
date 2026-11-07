// The shape library. A shape is data plus one draw(spec, ctx) that returns the whole sheet's HTML.
import hourglass from "./hourglass.mjs";
import ribbon from "./ribbon.mjs";
import warmStart from "./warm-start.mjs";

const KINDS = ["words", "phrase", "line"];

function assertShape(shape) {
  const bad = (m) => {
    throw new Error(`shape ${shape.id}: ${m}`);
  };
  if (typeof shape.fits !== "string" || !shape.fits) bad("needs fits");
  const themes = Object.entries(shape.themes || {});
  if (!themes.length || themes.some(([name, t]) => !["light", "dark"].includes(name) || !/^#[0-9A-F]{6}$/i.test(t.hot) || !/^#[0-9A-F]{6}$/i.test(t.paper))) {
    bad("themes must be light and/or dark, each with paper and hot hex colours");
  }
  if (![2, 3].includes(shape.notes)) bad("notes must be 2 or 3");
  for (const [name, s] of Object.entries(shape.slots)) {
    if (!KINDS.includes(s.kind)) bad(`slot ${name} has kind ${s.kind}; use ${KINDS.join(", ")}`);
    if (!s.prompt || !(s.max > 0) || (s.kind === "words" && !(s.min > 0 && s.min <= s.max))) bad(`slot ${name} needs a prompt and limits`);
  }
  if (typeof shape.hotWords !== "function" || !shape.hotRule) bad("needs hotWords and hotRule");
  if (typeof shape.draw !== "function" || shape.draw.length !== 2) bad("draw must be draw(spec, ctx)");
  return shape;
}

/** @type {Record<string, import("../spec.mjs").Shape>} */
export const SHAPES = Object.fromEntries([hourglass, ribbon, warmStart].map((s) => [s.id, assertShape(s)]));
