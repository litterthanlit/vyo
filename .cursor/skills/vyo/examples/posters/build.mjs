#!/usr/bin/env node
// Render every poster spec in this folder, and the four signal and field presets the gallery shows, into
// this folder: <name>.png, plus <name>.gif and <name>.mp4 when the spec has motion.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, "../..");
const TOOLS = path.join(SKILL, "tools");
const VYO = path.join(TOOLS, "vyo.mjs");
const FIXTURE = path.join(TOOLS, "test", "fixtures", "recipe");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "vyo-gallery-"));
const FACTS = path.join(TMP, "facts.json");

const run = (args, extra = {}) => {
  const r = spawnSync(process.execPath, args, { encoding: "utf8", cwd: SKILL, ...extra });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || r.stdout || `exit ${r.status}\n`);
    process.exit(r.status || 1);
  }
  process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r;
};

const stamp = (spec) => {
  const facts = JSON.parse(fs.readFileSync(FACTS, "utf8"));
  return { ...spec, facts: facts.hash };
};

const writeSpec = (name, spec) => {
  const file = path.join(TMP, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(stamp(spec), null, 2) + "\n");
  return file;
};

fs.mkdirSync(HERE, { recursive: true });
run([VYO, "scan", FIXTURE, "--out", FACTS]);

const readPoster = (name) => JSON.parse(fs.readFileSync(path.join(HERE, `${name}.json`), "utf8"));

const fromPreset = (id) => JSON.parse(fs.readFileSync(path.join(TOOLS, "presets", `${id}.json`), "utf8"));
const posters = [
  ...fs.readdirSync(HERE).filter((f) => f.endsWith(".json")).sort().map((f) => [f.slice(0, -5), readPoster(f.slice(0, -5))]),
  ...["radial", "sphere", "signal-paper", "signal-wave"].map((id) => [id, fromPreset(id)]),
].map(([name, spec]) => [name, spec, !!spec.motion]);

for (const [name, spec, gif] of posters) {
  const file = writeSpec(name, spec);
  const out = path.join(TMP, `out-${name}`);
  fs.mkdirSync(out, { recursive: true });
  const args = [VYO, "render", file, "--facts", FACTS, "--out", out, "--no-pdf"];
  if (gif) args.push("--gif");
  process.stdout.write(`\n===== ${name}${gif ? " (gif)" : ""} =====\n`);
  run(args);
  const png = path.join(out, "recipe-poster.png");
  const dest = path.join(HERE, `${name}.png`);
  fs.copyFileSync(png, dest);
  if (gif) {
    fs.copyFileSync(path.join(out, "recipe-poster.gif"), path.join(HERE, `${name}.gif`));
    const mp4 = path.join(out, "recipe-poster.mp4");
    if (fs.existsSync(mp4)) fs.copyFileSync(mp4, path.join(HERE, `${name}.mp4`));
  }
}

process.stdout.write("\nGallery written to " + HERE + "\n");
