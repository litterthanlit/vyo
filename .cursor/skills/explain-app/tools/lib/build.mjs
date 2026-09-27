import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const TOOLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHIM = path.join(TOOLS, "shim", "canvas.tsx");
const ALLOWED_IMPORTS = new Set(["cursor/canvas"]);

// Static source rules from the canvas contract: only `cursor/canvas`, no fetch.
export function lintSource(source) {
  const errors = [];
  const specs = [
    ...source.matchAll(/\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g),
    ...source.matchAll(/\bimport\s*['"]([^'"]+)['"]/g),
    ...source.matchAll(/\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]/g),
  ].map((m) => m[1]);
  for (const spec of new Set(specs)) {
    if (!ALLOWED_IMPORTS.has(spec)) errors.push(`Imports "${spec}" — posters may import only from cursor/canvas`);
  }
  if (/\bfetch\s*\(/.test(source)) errors.push("Calls fetch() — posters must inline all content");
  return errors;
}

const shimPlugin = {
  name: "cursor-canvas-shim",
  setup(build) {
    build.onResolve({ filter: /^cursor\/canvas$/ }, () => ({ path: SHIM }));
  },
};

// Bundle one or more poster files into a standalone HTML page. Poster i mounts
// into <section id="poster-i">; render errors are shown in [data-poster-error].
export async function buildPage(files) {
  const imports = files.map((f, i) => `import P${i} from ${JSON.stringify(path.resolve(f))};`).join("\n");
  const entry = `
import { createRoot } from "react-dom/client";
import { Component, createElement as h } from "react";
${imports}
class Boundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    return this.state.error
      ? h("pre", { "data-poster-error": "" }, String(this.state.error.message || this.state.error))
      : this.props.children;
  }
}
[${files.map((_, i) => `P${i}`).join(", ")}].forEach((P, i) =>
  createRoot(document.getElementById("poster-" + i)).render(h(Boundary, null, h(P))));
`;
  let result;
  try {
    result = await esbuild.build({
      stdin: { contents: entry, resolveDir: TOOLS, sourcefile: "entry.js", loader: "js" },
      bundle: true,
      write: false,
      format: "iife",
      jsx: "automatic",
      nodePaths: [path.join(TOOLS, "node_modules")],
      plugins: [shimPlugin],
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
  } catch (e) {
    const detail = (e.errors || []).map((m) => `${m.location ? `${path.basename(m.location.file)}:${m.location.line} ` : ""}${m.text}`);
    throw new Error(`Build failed:\n  ${detail.join("\n  ") || e.message}`);
  }
  const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  const sections = files.map((_, i) => `<section id="poster-${i}"></section>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style></head><body>${sections}<script>${js}</script></body></html>`;
}
