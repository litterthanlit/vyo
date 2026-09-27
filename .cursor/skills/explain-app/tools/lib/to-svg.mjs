import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// dom-to-svg centres each border line on the box edge, so half the stroke
// falls outside the box. CSS paints borders inside it: shift each side inward
// by half its width, with butt caps so the ends stop at the box corners.
const insideBorders = {
  name: "inside-borders",
  setup(build) {
    build.onLoad({ filter: /dom-to-svg[\\/]lib[\\/]element\.js$/ }, async (args) => {
      const fs = await import("node:fs");
      const src = fs.readFileSync(args.path, "utf8");
      const anchor = "    return border;\n}\nfunction createSvgAnchor";
      if (!src.includes(anchor)) throw new Error("dom-to-svg changed: update the inside-borders patch in lib/to-svg.mjs");
      const fix = `    {
        const half = parseFloat(styles.getPropertyValue(\`border-\${side}-width\`)) / 2;
        const shift = { top: ["y1", "y2", half], bottom: ["y1", "y2", -half], left: ["x1", "x2", half], right: ["x1", "x2", -half] }[side];
        for (const a of shift.slice(0, 2)) border.setAttribute(a, String(parseFloat(border.getAttribute(a)) + shift[2]));
        border.setAttribute("stroke-linecap", "butt");
    }
`;
      return { contents: src.replace(anchor, fix + anchor), loader: "js" };
    });
  },
};

// Browser bundle exposing window.__posterToSVG(el) → SVG markup. dom-to-svg
// turns laid-out HTML into real SVG: live <text> per line, rects for rules and
// backgrounds, inline SVG artwork carried over as groups. No <foreignObject>,
// so Figma and Illustrator open it as editable vectors.
export async function svgScript() {
  const result = await esbuild.build({
    stdin: {
      contents: `
import { elementToSVG } from "dom-to-svg";
window.__posterToSVG = (el) => {
  // The Block style's colour field is already SVG, but dom-to-svg misorders it
  // against the z-indexed content. Convert without it, then put a verbatim copy
  // back as the bottom layer at its exact position.
  const field = el.querySelector("[data-poster-field]");
  if (field) field.style.display = "none";
  const doc = elementToSVG(el);
  if (field) field.style.display = "";
  const svg = doc.documentElement;
  if (field) {
    const r = field.getBoundingClientRect();
    const copy = doc.importNode(field, true);
    copy.removeAttribute("style");
    copy.setAttribute("x", String(r.left));
    copy.setAttribute("y", String(r.top));
    copy.setAttribute("width", String(r.width));
    copy.setAttribute("height", String(r.height));
    const after = [...svg.children].find((c) => c.tagName !== "style" && c.tagName !== "defs");
    svg.insertBefore(copy, after || null);
  }
  // dom-to-svg forces each line to its measured width (textLength + glyph
  // stretching) on top of letter-spacing, which widens tracked type. Letter-
  // spacing alone reproduces the layout, and Figma ignores textLength anyway.
  // It also hangs text from its bottom edge (dominant-baseline), which Figma
  // and Illustrator ignore — move every line onto a plain alphabetic baseline.
  const ctx = document.createElement("canvas").getContext("2d");
  for (const t of svg.querySelectorAll("text")) {
    ctx.font = [t.getAttribute("font-style"), t.getAttribute("font-weight"), t.getAttribute("font-size"), t.getAttribute("font-family")].join(" ");
    const descent = ctx.measureText("Hg").fontBoundingBoxDescent;
    const hung = t.getAttribute("dominant-baseline") === "text-after-edge";
    t.removeAttribute("dominant-baseline");
    for (const a of ["user-select", "unicode-bidi", "font-size-adjust", "color"]) t.removeAttribute(a);
    for (const span of t.querySelectorAll("tspan")) {
      span.removeAttribute("textLength");
      span.removeAttribute("lengthAdjust");
      if (hung) span.setAttribute("y", String(+span.getAttribute("y") - descent));
    }
  }
  // Drop the empty stacking-layer groups dom-to-svg leaves behind.
  let empty;
  while ((empty = [...svg.querySelectorAll("g")].filter((g) => !g.childNodes.length)).length) empty.forEach((g) => g.remove());
  const r = el.getBoundingClientRect();
  svg.setAttribute("width", String(Math.ceil(r.width)));
  svg.setAttribute("height", String(Math.ceil(r.height)));
  return new XMLSerializer().serializeToString(doc);
};`,
      resolveDir: TOOLS,
      sourcefile: "to-svg.js",
      loader: "js",
    },
    bundle: true,
    write: false,
    format: "iife",
    plugins: [insideBorders],
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}
