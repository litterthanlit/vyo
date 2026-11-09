// PNG decode and encode for the trace field. Node only: zlib, no extra dependencies. Not inlined into the page.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { SHEET } from "../geometry.mjs";
import { applyPoseToMask, blankMask, poseOf } from "./pose.mjs";
import { TRACE } from "./trace.mjs";

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BUNDLED = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "presets", "masks", "trace.png");

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

/**
 * Decode an 8-bit gray, rgb or rgba PNG (no interlacing) to luminance 0–255.
 * @returns {{ width: number, height: number, gray: Uint8Array }}
 */
export function decodePng(buf) {
  const src = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (src.length < 8 || !src.subarray(0, 8).equals(SIG)) throw new Error("png: not a PNG");
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat = [];
  let o = 8;
  while (o + 8 <= src.length) {
    const len = src.readUInt32BE(o);
    const type = src.toString("ascii", o + 4, o + 8);
    const data = src.subarray(o + 8, o + 8 + len);
    if (o + 12 + len > src.length) throw new Error("png: truncated chunk");
    o += 12 + len;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error("png: only 8-bit samples");
      colorType = data[9];
      if (![0, 2, 4, 6].includes(colorType)) throw new Error(`png: colour type ${colorType} is not supported`);
      if (data[12] !== 0) throw new Error("png: interlaced images are not supported");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  if (!width || !height || !idat.length) throw new Error("png: missing image data");
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const pix = Buffer.alloc(height * stride);
  let s = 0;
  for (let y = 0; y < height; y++) {
    const filter = inflated[s++];
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const v = inflated[s++];
      const a = i >= bpp ? pix[row + i - bpp] : 0;
      const b = y ? pix[row - stride + i] : 0;
      const c = y && i >= bpp ? pix[row - stride + i - bpp] : 0;
      let out = v;
      if (filter === 1) out = v + a;
      else if (filter === 2) out = v + b;
      else if (filter === 3) out = v + ((a + b) >> 1);
      else if (filter === 4) out = v + paeth(a, b, c);
      else if (filter !== 0) throw new Error(`png: filter ${filter}`);
      pix[row + i] = out & 255;
    }
  }
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    if (colorType === 0) gray[i] = pix[i];
    else if (colorType === 4) gray[i] = pix[i * 2];
    else if (colorType === 2) {
      const p = i * 3;
      gray[i] = Math.round(0.2126 * pix[p] + 0.7152 * pix[p + 1] + 0.0722 * pix[p + 2]);
    } else {
      const p = i * 4;
      const al = pix[p + 3] / 255;
      const r = pix[p] * al + 255 * (1 - al);
      const g = pix[p + 1] * al + 255 * (1 - al);
      const b = pix[p + 2] * al + 255 * (1 - al);
      gray[i] = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
  }
  return { width, height, gray };
}

/** Absolute path, cwd-relative path, or the bundled sample when `mask` is omitted. */
export function resolveMask(mask) {
  if (!mask) return BUNDLED;
  const abs = path.isAbsolute(mask) ? mask : path.resolve(process.cwd(), mask);
  if (!fs.existsSync(abs)) throw new Error(`trace mask not found: ${mask}`);
  return abs;
}

function imageToMask(img, floor, invert) {
  const mask = blankMask(floor);
  const { width, height, gray } = img;
  for (let y = 0; y < mask.h; y++) {
    const sy = Math.min(height - 1, Math.floor((((y + 0.5) * mask.step) / Math.max(1, floor)) * height));
    for (let x = 0; x < mask.w; x++) {
      const sx = Math.min(width - 1, Math.floor((((x + 0.5) * mask.step) / SHEET.width) * width));
      const dark = gray[sy * width + sx] < 128;
      if (invert ? !dark : dark) mask.bits[y * mask.w + x] = 1;
    }
  }
  return mask;
}

/**
 * Chords for a trace region, posed and ready for the page. Missing `mask` uses the bundled sample.
 * @returns {{ chords: { y: number, runs: [number, number][] }[], pitch: number }}
 */
export function traceChords(region, floor, mirror = false) {
  const img = decodePng(fs.readFileSync(resolveMask(region.mask)));
  const pose = poseOf(region.seed);
  if (mirror) pose.mirror = !pose.mirror;
  const invert = !pose.identity && pose.rnd() < 0.5;
  const mask = imageToMask(img, floor, invert);
  const pitch = Math.round(TRACE.pitch * pose.density * 10) / 10;
  return { chords: applyPoseToMask(mask, pose, { floor, pitch }), pitch };
}
