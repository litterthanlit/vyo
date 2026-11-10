// PNG decode and encode with Node's zlib and no other dependency: `vyo sketch` writes its sketch with it, and a
// traced mask is read with it. Node only, never inlined into the page.
import zlib from "node:zlib";

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/**
 * An 8-bit PNG from raw pixels, row by row from the top: RGB when `pixels` holds 3 bytes a pixel, RGBA when 4.
 * @param {number} w
 * @param {number} h
 * @param {Uint8Array} pixels
 * @returns {Buffer}
 */
export function encodePng(w, h, pixels) {
  const channels = pixels.length / (w * h);
  if (channels !== 3 && channels !== 4) throw new Error(`png: ${pixels.length} bytes is neither RGB nor RGBA for ${w} by ${h}`);
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head.set([8, channels === 4 ? 6 : 2, 0, 0, 0], 8);
  const stride = w * channels;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) raw.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([SIG, chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
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
