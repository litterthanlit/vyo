import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FIELDS } from "../lib/fields/index.mjs";
import { pickField, readRecent, recordShape, usedAgo } from "../lib/recent.mjs";

const names = Object.keys(FIELDS);
const nonwave = names.filter((n) => n !== "wave");

test("picking never returns wave", () => {
  for (const recent of [[], ["wave"], ["wave", "wave"], nonwave, nonwave.slice(0, 3)]) {
    assert.notEqual(pickField(names, recent), "wave");
  }
});

test("picking avoids fields already in the log, and the key spreads first picks across the fresh fields", () => {
  const firsts = new Set(Array.from({ length: 48 }, (_, key) => pickField(names, [], key)));
  assert.equal(firsts.size, nonwave.length, "every non-wave field is some repo's first pick");
  assert.equal(pickField(names, [], 5), pickField(names, [], 5), "same key, same log, same pick");
  for (let key = 0; key < 24; key++) {
    const recent = nonwave.slice(-8);
    assert.ok(!recent.includes(pickField(names, recent, key)), `key ${key}`);
  }
});

test("when every non-wave field is in the log, picking takes the oldest", () => {
  assert.equal(pickField(names, nonwave), nonwave[0]);
  assert.equal(pickField(names, ["wave", ...nonwave.slice(1), nonwave[0]]), nonwave[1]);
  const rotated = [...nonwave.slice(2), nonwave[0], nonwave[1]];
  assert.equal(pickField(names, rotated), nonwave[2]);
});

test("recording appends, trims to 8, and reads back", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vyo-recent-"));
  const file = path.join(dir, "nested", "recent-shapes.json");
  try {
    assert.deepEqual(readRecent(file).shapes, []);
    for (let i = 0; i < 9; i++) recordShape(file, nonwave[i % nonwave.length]);
    const shapes = readRecent(file).shapes;
    assert.equal(shapes.length, 8);
    assert.equal(shapes.at(-1), nonwave[8 % nonwave.length]);
    assert.equal(shapes[0], nonwave[1 % nonwave.length]);
    assert.equal(usedAgo(shapes, shapes.at(-1)), 0);
    assert.equal(usedAgo(shapes, "nope"), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("vyo shapes, run from the repo, reads the log compose wrote beside the spec", () => {
  const tools = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "vyo-shapes-"));
  const vyo = (...a) => spawnSync(process.execPath, [path.join(tools, "vyo.mjs"), ...a], { encoding: "utf8", cwd: repo });
  try {
    const facts = path.join(repo, "vyo", "recipe-facts.json");
    assert.equal(vyo("scan", path.join(tools, "test", "fixtures", "recipe"), "--out", facts).status, 0);
    const made = vyo("compose", facts, "--out", path.join(repo, "vyo", "recipe-poster.json"));
    const picked = /^picked (\w+)/m.exec(made.stdout)?.[1];
    assert.ok(picked, made.stdout + made.stderr);
    assert.match(vyo("shapes").stdout, new RegExp(`^${picked} — .* — last used 0 ago$`, "m"));
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
