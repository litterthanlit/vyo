// PNG decode and encode for the trace field. Node only: zlib, no extra dependencies. Not inlined into the page.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { SHEET } from "../geometry.mjs";
import { applyPoseToMask, blankMask, poseOf } from "./pose.mjs";
import { TRACE } from "./trace.mjs";
import { SYMBOLS } from "./chords.mjs";

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MASKS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "presets", "masks");
const BUNDLED = path.join(MASKS, "trace.png");
/** The masks the package ships, by name: `mask: "wings"` reads presets/masks/wings.png. */
export const BUNDLED_MASKS = fs.readdirSync(MASKS).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4)).sort();

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** RGBA buffer (width * height * 4) to an 8-bit PNG. */
export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
};

// A mask is sampled down to about 420 by 600 cells, so a larger image only costs memory.
const MAX_SIDE = 4096;
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const DEPTHS = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };

/**
 * Decode a non-interlaced PNG of any colour type and bit depth to luminance 0–255, with any alpha
 * composited on white. Throws `png: …` on anything malformed or larger than 4096 on a side.
 * @returns {{ width: number, height: number, gray: Uint8Array }}
 */
export function decodePng(buf) {
  const src = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (src.length < 8 || !src.subarray(0, 8).equals(SIG)) throw new Error("png: not a PNG");
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = -1;
  let palette = null;
  let alphas = null;
  const idat = [];
  let o = 8;
  while (o + 8 <= src.length) {
    const len = src.readUInt32BE(o);
    const type = src.toString("ascii", o + 4, o + 8);
    if (o + 12 + len > src.length) throw new Error("png: truncated chunk");
    const data = src.subarray(o + 8, o + 8 + len);
    o += 12 + len;
    if (type === "IHDR") {
      if (len < 13) throw new Error("png: short IHDR");
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      if (!CHANNELS[colorType] || colorType === 1) throw new Error(`png: colour type ${colorType} is not supported`);
      if (!DEPTHS[colorType].includes(depth)) throw new Error(`png: bit depth ${depth} is not valid for colour type ${colorType}`);
      if (data[12] !== 0) throw new Error("png: interlaced images are not supported");
      if (!width || !height || width > MAX_SIDE || height > MAX_SIDE) throw new Error(`png: ${width} by ${height} is outside 1 to ${MAX_SIDE} on a side`);
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") alphas = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  if (!width || !idat.length) throw new Error("png: missing image data");
  if (colorType === 3 && (!palette || palette.length < 3)) throw new Error("png: palette image without a palette");
  const channels = CHANNELS[colorType];
  const stride = Math.ceil((width * channels * depth) / 8);
  const bpp = Math.max(1, (channels * depth) / 8);
  const want = height * (stride + 1);
  let inflated;
  try {
    inflated = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: want });
  } catch (e) {
    throw new Error(`png: image data does not inflate to ${want} bytes (${e.code || e.message})`);
  }
  if (inflated.length < want) throw new Error(`png: image data is ${inflated.length} bytes; ${width} by ${height} needs ${want}`);
  const pix = Buffer.alloc(height * stride);
  let s = 0;
  for (let y = 0; y < height; y++) {
    const filter = inflated[s++];
    if (filter > 4) throw new Error(`png: filter ${filter}`);
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const v = inflated[s++];
      const a = i >= bpp ? pix[row + i - bpp] : 0;
      const b = y ? pix[row - stride + i] : 0;
      const c = y && i >= bpp ? pix[row - stride + i - bpp] : 0;
      const pred = [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter];
      pix[row + i] = (v + pred) & 255;
    }
  }
  const max = (1 << depth) - 1;
  // The i-th sample of row y, scaled to 0–255 (16-bit samples keep their high byte).
  const sample = (y, i) => {
    const row = y * stride;
    if (depth === 16) return pix[row + i * 2];
    if (depth === 8) return pix[row + i];
    const bit = i * depth;
    return (pix[row + (bit >> 3)] >> (8 - depth - (bit & 7))) & max;
  };
  const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const onWhite = (l, alpha) => Math.round(l * (alpha / 255) + 255 * (1 - alpha / 255));
  const scale = depth < 8 ? 255 / max : 1;
  const gray = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const k = x * channels;
      let l;
      if (colorType === 3) {
        const idx = sample(y, x);
        const p = idx * 3;
        const rgb = p + 2 < palette.length ? luma(palette[p], palette[p + 1], palette[p + 2]) : 0;
        l = onWhite(rgb, alphas && idx < alphas.length ? alphas[idx] : 255);
      } else if (colorType === 0) l = Math.round(sample(y, k) * scale);
      else if (colorType === 4) l = onWhite(sample(y, k), sample(y, k + 1));
      else if (colorType === 2) l = Math.round(luma(sample(y, k), sample(y, k + 1), sample(y, k + 2)));
      else l = onWhite(luma(sample(y, k), sample(y, k + 1), sample(y, k + 2)), sample(y, k + 3));
      gray[y * width + x] = l;
    }
  }
  return { width, height, gray };
}

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
