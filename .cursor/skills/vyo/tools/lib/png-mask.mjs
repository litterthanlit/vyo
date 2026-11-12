// A traced shape: `shape.mask` names a PNG, bundled by name or at a path, whose dark pixels are the silhouette.
// Node reads it here into spans per image row, and hands lib/mask.mjs the loader, so a traced shape goes through the
// same mask, styles, checks and placement as a drawn one. Not inlined into the page; render embeds the images.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng } from "./png.mjs";
import { setMaskImages } from "./mask.mjs";

const MASKS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "presets", "masks");
/** The masks the package ships, by name: `mask: "wings"` reads presets/masks/wings.png. */
export const BUNDLED_MASKS = fs.readdirSync(MASKS).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4)).sort();
// The sheet is 840 by 1190, so an image is sampled down to at most this many pixels on its long side.
const MAX_SIDE = 1200;

/** A shape mask that is missing or is not a PNG the decoder reads. */
export class MaskFailure extends Error {}

/** A bundled mask's name, an absolute path, or a path relative to the working directory, as a file. */
export function resolveMask(mask) {
  if (BUNDLED_MASKS.includes(mask)) return path.join(MASKS, `${mask}.png`);
  const abs = path.isAbsolute(mask) ? mask : path.resolve(process.cwd(), mask);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new MaskFailure(`shape mask not found: ${mask} (a bundled name, ${BUNDLED_MASKS.join(" or ")}, or a path absolute or relative to the working directory)`);
  return abs;
}

/**
 * The image's dark pixels (luminance under 128, alpha on white) as spans per row, trimmed to their box and sampled
 * down to MAX_SIDE. An image with no dark pixel is 0 by 0.
 * @returns {import("./mask.mjs").MaskImage}
 */
export function imageRuns({ width, height, gray }) {
  let [x0, y0, x1, y1] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] >= 128) continue;
      [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
    }
  }
  if (x1 < 0) return { w: 0, h: 0, runs: [] };
  const k = Math.max(1, Math.ceil(Math.max(x1 - x0 + 1, y1 - y0 + 1) / MAX_SIDE));
  const [w, h] = [Math.ceil((x1 - x0 + 1) / k), Math.ceil((y1 - y0 + 1) / k)];
  const runs = Array.from({ length: h }, (_, j) => {
    const sy = y0 + j * k;
    const row = [];
    let open = -1;
    for (let i = 0; i <= w; i++) {
      const dark = i < w && gray[sy * width + x0 + i * k] < 128;
      if (dark && open < 0) open = i;
      if (!dark && open >= 0) row.push([open, i]), (open = -1);
    }
    return row;
  });
  return { w, h, runs };
}

const cache = new Map();
/** The traced image for a shape's `mask`, read once per file. Throws MaskFailure with the mask named. */
export function loadMaskImage(mask) {
  if (typeof mask !== "string" || !mask.trim()) throw new MaskFailure(`shape mask: a bundled name (${BUNDLED_MASKS.join(" or ")}) or a path to a PNG`);
  const file = resolveMask(mask);
  if (!cache.has(file)) {
    try {
      cache.set(file, imageRuns(decodePng(fs.readFileSync(file))));
    } catch (e) {
      throw new MaskFailure(`shape mask ${mask}: ${e.message}`);
    }
  }
  return cache.get(file);
}

setMaskImages(loadMaskImage);
