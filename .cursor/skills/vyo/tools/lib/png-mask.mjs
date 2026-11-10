// A traced mask: a PNG, bundled by name or at a path, read in Node (the page cannot read a file) into the
// chords a trace region fills. Not inlined into the page.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SHEET } from "./geometry.mjs";
import { decodePng } from "./png.mjs";
import { applyPoseToMask, blankMask, poseOf } from "./fields/pose.mjs";
import { TRACE } from "./fields/trace.mjs";
import { SYMBOLS } from "./fields/chords.mjs";

const MASKS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "presets", "masks");
const BUNDLED = path.join(MASKS, "trace.png");
/** The masks the package ships, by name: `mask: "wings"` reads presets/masks/wings.png. */
export const BUNDLED_MASKS = fs.readdirSync(MASKS).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4)).sort();

/** A trace mask that is missing or is not a PNG this decoder reads. */
export class MaskFailure extends Error {}

/** A bundled mask's name, an absolute path, or a cwd-relative path; the keyhole sample when `mask` is omitted. */
export function resolveMask(mask) {
  if (!mask) return BUNDLED;
  if (BUNDLED_MASKS.includes(mask)) return path.join(MASKS, `${mask}.png`);
  const abs = path.isAbsolute(mask) ? mask : path.resolve(process.cwd(), mask);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new MaskFailure(`trace mask not found: ${mask} (a bundled name, ${BUNDLED_MASKS.join(" or ")}, or a path absolute or relative to the working directory)`);
  return abs;
}

/** The image's dark pixels, their bounding box fitted inside the sheet above `floor` at its own aspect and centred. */
function imageToMask(img, floor) {
  const mask = blankMask(floor);
  const { width, height, gray } = img;
  let [x0, y0, x1, y1] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] >= 128) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return mask;
  const [w, h] = [x1 - x0 + 1, y1 - y0 + 1];
  // 0.9 leaves a margin of ground around the silhouette, where compose can place the words.
  const fit = 0.9 * Math.min(SHEET.width / w, Math.max(1, floor) / h);
  const left = (SHEET.width - w * fit) / 2;
  const top = (floor - h * fit) / 2;
  for (let y = 0; y < mask.h; y++) {
    const sy = y0 + Math.floor(((y + 0.5) * mask.step - top) / fit);
    if (sy < y0 || sy > y1) continue;
    for (let x = 0; x < mask.w; x++) {
      const sx = x0 + Math.floor(((x + 0.5) * mask.step - left) / fit);
      if (sx >= x0 && sx <= x1 && gray[sy * width + sx] < 128) mask.bits[y * mask.w + x] = 1;
    }
  }
  return mask;
}

/**
 * Chords for a trace region, posed and ready for the page. Missing `mask` uses the bundled sample.
 * @returns {{ chords: { y: number, runs: [number, number][] }[], pitch: number }}
 */
export function traceChords(region, floor, mirror = false) {
  const file = resolveMask(region.mask);
  let img;
  try {
    img = decodePng(fs.readFileSync(file));
  } catch (e) {
    throw new MaskFailure(`trace mask ${region.mask}: ${e.message}`);
  }
  const pose = poseOf(region.seed);
  if (mirror) pose.mirror = !pose.mirror;
  const mask = imageToMask(img, floor);
  const pitch = Math.round((region.symbols ? SYMBOLS : TRACE).pitch * pose.density * 10) / 10;
  return { chords: applyPoseToMask(mask, pose, { floor, pitch }), pitch };
}
