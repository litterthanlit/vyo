import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanRepo } from "../lib/scan/index.mjs";
import { bandCounts, bandLine, provenance } from "../lib/band.mjs";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const facts = (list) => ({ facts: list.map(([id, name = ""]) => ({ id, kind: id.split(":")[0], name, files: [] })) });

test("the recipe fixture's counts line", () => {
  const recipe = scanRepo(path.join(FIX, "recipe"));
  assert.equal(
    bandLine(bandCounts(recipe)),
    "6 screens, 3 kinds of request, 4 kinds of saved record, 3 outside services (email, payments, sign-in), 1 AI model, runs 1 job on its own",
  );
});

test("singulars, zero counts left out", () => {
  const f = facts([["screen:/"], ["table:User"], ["service:payments", "Payments"], ["job:nightly"]]);
  assert.equal(bandLine(bandCounts(f)), "1 screen, 1 kind of saved record, 1 outside service (payments), runs 1 job on its own");
});

test("package-suffixed ids count once, the AI gateway is not a model, more than 3 capabilities are not listed", () => {
  const f = facts([
    ["screen:/"], ["screen:/#apps/web"], ["screen:/#apps/admin"],
    ["endpoint:/api/a#web"], ["endpoint:/api/a#admin"],
    ["ai:gateway"], ["ai:openai"], ["ai:anthropic"],
    ["service:payments", "Payments"], ["service:email", "Email"], ["service:maps", "Maps"], ["service:search", "Search"],
  ]);
  assert.equal(bandLine(bandCounts(f)), "1 screen, 1 kind of request, 4 outside services, 2 AI models");
});

test("an app with no facts has an empty counts line", () => {
  assert.equal(bandLine(bandCounts(scanRepo(path.join(FIX, "empty")))), "");
});

test("provenance names the commit only when there is one, and never says commit", () => {
  assert.equal(provenance({ name: "Pantry", commit: "04186f4", date: "2026-10-28" }), "Pantry at 04186f4, 28 October 2026");
  assert.equal(provenance({ name: "Pantry", date: "2026-01-02" }), "Pantry, 2 January 2026");
});
