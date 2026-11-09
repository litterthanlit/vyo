import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePng, encodePng } from "../lib/fields/png.mjs";

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
