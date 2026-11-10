import { test } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng } from "../lib/png.mjs";
import { traceChords, MaskFailure } from "../lib/png-mask.mjs";

test("a 16 by 16 rectangle round-trips through the PNG codec", () => {
  const width = 16;
  const height = 16;
  const rgba = Buffer.alloc(width * height * 4, 255);
  for (let y = 4; y < 12; y++) {
    for (let x = 3; x < 13; x++) {
      const o = (y * width + x) * 4;
      rgba[o] = 0;
      rgba[o + 1] = 0;
      rgba[o + 2] = 0;
      rgba[o + 3] = 255;
    }
  }
  const img = decodePng(encodePng(width, height, rgba));
  assert.equal(img.width, 16);
  assert.equal(img.height, 16);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const on = y >= 4 && y < 12 && x >= 3 && x < 13;
      const luma = img.gray[y * width + x];
      assert.equal(luma < 128, on, `${x},${y} is ${luma}`);
    }
  }
});

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  return Buffer.concat([len, Buffer.from(type), data, Buffer.alloc(4)]);
};
const ihdr = (w, h, depth, colour) => {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(w, 0);
  b.writeUInt32BE(h, 4);
  b[8] = depth;
  b[9] = colour;
  return chunk("IHDR", b);
};
const png = (...chunks) => Buffer.concat([SIG, ...chunks, chunk("IEND", Buffer.alloc(0))]);

test("a 1-bit palette PNG decodes: black in the palette is dark, white is light", () => {
  // 8 by 2: row 0 is index 1 (black) in the left half; row 1 is all index 0 (white).
  const rows = Buffer.from([0, 0b11110000, 0, 0b00000000]);
  const img = decodePng(png(ihdr(8, 2, 1, 3), chunk("PLTE", Buffer.from([255, 255, 255, 0, 0, 0])), chunk("IDAT", zlib.deflateSync(rows))));
  assert.deepEqual([...img.gray], [0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
});

test("grey with alpha composites on white, so a transparent ground is light", () => {
  // 2 by 1: a transparent black pixel, then an opaque black one.
  const rows = Buffer.from([0, 0, 0, 0, 255]);
  const img = decodePng(png(ihdr(2, 1, 8, 4), chunk("IDAT", zlib.deflateSync(rows))));
  assert.deepEqual([...img.gray], [255, 0]);
});

test("malformed or hostile PNGs fail with a png: message, never a crash or a huge allocation", () => {
  const bad = [
    ["not a PNG", Buffer.from("hello world")],
    ["a short IHDR", png(chunk("IHDR", Buffer.alloc(4)), chunk("IDAT", zlib.deflateSync(Buffer.alloc(2))))],
    ["a 100000 by 100000 image", png(ihdr(100000, 100000, 8, 0), chunk("IDAT", zlib.deflateSync(Buffer.alloc(16))))],
    ["image data shorter than its rows", png(ihdr(64, 64, 8, 0), chunk("IDAT", zlib.deflateSync(Buffer.alloc(10))))],
    ["a deflate bomb", png(ihdr(16, 16, 8, 0), chunk("IDAT", zlib.deflateSync(Buffer.alloc(64 * 1024 * 1024))))],
    ["a palette image without a palette", png(ihdr(8, 1, 8, 3), chunk("IDAT", zlib.deflateSync(Buffer.alloc(9))))],
    ["an unknown filter", png(ihdr(1, 1, 8, 0), chunk("IDAT", zlib.deflateSync(Buffer.from([9, 0]))))],
  ];
  for (const [name, buf] of bad) assert.throws(() => decodePng(buf), /^Error: png: /, name);
});

test("a trace mask that is a folder or not a PNG fails with its path named", () => {
  const here = fileURLToPath(import.meta.url);
  assert.throws(() => traceChords({ mask: here }, 1000), (e) => e instanceof MaskFailure && /^trace mask .*png\.test\.mjs: png: not a PNG$/.test(e.message));
  assert.throws(() => traceChords({ mask: fileURLToPath(new URL(".", import.meta.url)) }, 1000), (e) => e instanceof MaskFailure && /^trace mask not found/.test(e.message));
});
