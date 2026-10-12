// Keeps the sample briefing in examples.md (and the excerpt in briefing.md) honest.
// Run: node --test tools/test/examples.test.mjs      Rewrite the sample: UPDATE_EXAMPLES=1 node --test tools/test/examples.test.mjs
//
// The sample is generated, not typed: copy the Pantry fixture twice (into folders named "pantry"), change the second
// copy in a fixed way, scan both, diff, and render the briefing as text. examples.md must hold exactly that text
// between its markers. Node built-ins only; no git and no install needed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { diffFacts } from "../lib/changes.mjs";
import { buildBriefing, renderText } from "../lib/briefing.mjs";
import { isJargon } from "../lib/scan/names.mjs";
import { scanRepo } from "../scan.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, "..", "..");
const RECIPE = path.join(HERE, "fixtures", "recipe");
const EXAMPLES = path.join(SKILL, "examples.md");
const BRIEFING = path.join(SKILL, "briefing.md");

// Fixed labels, as the `changes` command words them for `--since HEAD` (versionLabel in lib/changes-cli.mjs; lib/briefing.mjs, ledeOf, builds the line from them).
const LABELS = { before: "your last saved version (a1b2c3d, 2026-10-07)", after: "your files right now" };

const SAMPLE = { begin: "<!-- briefing-sample:BEGIN -->", end: "<!-- briefing-sample:END -->" };
const EXCERPT = { begin: "<!-- briefing-excerpt:BEGIN -->", end: "<!-- briefing-excerpt:END -->" };

// A Billing page long enough that the "Main app" folder visibly grows (the size line names areas of 50+ lines).
const PLANS = ["Free", "Plus", "Family", "Team", "Studio", "Pro", "Chef", "Club", "School", "Cafe", "Shop", "Grand"];
const BILLING_PAGE = [
  "const PLANS = [",
  ...PLANS.flatMap((name, i) => ["  {", `    name: "${name}",`, `    price: ${i * 5},`, `    perks: ["${name} recipes", "${name} plans"],`, "  },"]),
  "];",
  "",
  "export default function BillingPage() {",
  "  return (",
  "    <section>",
  "      <h1>Billing</h1>",
  "      <ul>",
  "        {PLANS.map((plan) => (",
  "          <li key={plan.name}>",
  "            <h2>{plan.name}</h2>",
  "            <p>{plan.price} a month</p>",
  "          </li>",
  "        ))}",
  "      </ul>",
  "    </section>",
  "  );",
  "}",
  "",
].join("\n");

// The fixed edits. Each one is what changes.test.mjs checks on its own; here they all happen at once.
function mutate(dir) {
  const file = (rel) => path.join(dir, rel);
  const read = (rel) => fs.readFileSync(file(rel), "utf8");
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(file(rel)), { recursive: true });
    fs.writeFileSync(file(rel), text);
  };
  // the Plan screen starts using the AI helper
  write("app/(app)/plan/page.tsx", `import { suggestRecipes } from "@/lib/ai/suggest";\n${read("app/(app)/plan/page.tsx")}`);
  // a new Billing screen
  write("app/(app)/billing/page.tsx", BILLING_PAGE);
  // a file nothing links to yet, importing Twilio
  write("lib/notify.ts", 'import twilio from "twilio";\n\nexport const sms = twilio("sid", "token");\n');
  // the Settings screen moves to /preferences
  fs.renameSync(file("app/(app)/settings"), file("app/(app)/preferences"));
  // the weekly job moves to Friday 17:00
  write("vercel.json", JSON.stringify({ crons: [{ path: "/api/cron/weekly-plan", schedule: "0 17 * * 5" }] }));
  // the Ingredient model is deleted
  write("prisma/schema.prisma", read("prisma/schema.prisma").replace(/model Ingredient \{[^}]*\}\n\n/, ""));
}

async function sampleDoc() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "examples-test-"));
  try {
    const [before, after] = ["before", "after"].map((side) => {
      const dir = path.join(tmp, side, "pantry"); // same folder name on both sides, so the app has one name
      fs.cpSync(RECIPE, dir, { recursive: true });
      return dir;
    });
    mutate(after);
    const changes = diffFacts(await scanRepo(before, { useGit: false }), await scanRepo(after, { useGit: false }), { labels: LABELS });
    return buildBriefing(changes);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// The text between two markers: { head (up to and including begin), body (between), tail (from end) }.
function between(text, { begin, end }, file) {
  const i = text.indexOf(begin);
  const j = text.indexOf(end);
  assert.ok(i >= 0 && j > i, `${path.basename(file)} needs ${begin} … ${end}`);
  return { head: text.slice(0, i + begin.length), body: text.slice(i + begin.length, j), tail: text.slice(j) };
}

// The body of the ```text fence inside a marked block.
function fenced(body, file) {
  const m = /^\s*```text\n([\s\S]*?)\n```\s*$/.exec(body);
  assert.ok(m, `the marked block in ${path.basename(file)} must be one \`\`\`text fence`);
  return m[1];
}

test("examples.md: the sample briefing is what the tool prints for the Pantry fixture", async () => {
  const rendered = renderText(await sampleDoc()).replace(/\n+$/, "");
  const text = fs.readFileSync(EXAMPLES, "utf8");
  const block = between(text, SAMPLE, EXAMPLES);
  if (process.env.UPDATE_EXAMPLES) {
    fs.writeFileSync(EXAMPLES, `${block.head}\n\`\`\`text\n${rendered}\n\`\`\`\n${block.tail}`);
    return;
  }
  assert.equal(fenced(block.body, EXAMPLES), rendered, "examples.md has drifted from the tool. Rewrite it: UPDATE_EXAMPLES=1 node --test tools/test/examples.test.mjs");
});

test("the sample says what the mutations did, in words a builder uses", async () => {
  const doc = await sampleDoc();
  const lines = renderText(doc).split("\n");
  for (const line of lines) assert.ok(!isJargon(line), `jargon in the sample: ${line}`);
  const has = (line) => assert.ok(lines.includes(line), `missing: ${line}`);
  has("- The Billing screen is new.");
  has("- The saved record Ingredient is gone.");
  has("- The Settings screen is now the Preferences screen (moved from /settings to /preferences).");
  has("- The Weekly plan job now runs every Friday at 17:00 (it used to run every Monday at 08:00).");
  has("- OpenAI is now used from the Plan screen.");
  has("- Text messages (Twilio) is in the code, but no screen seems to lead to it yet.");
  assert.ok(doc.sections.some((s) => s.id === "look"), "the sample shows Worth a look");
  assert.ok(doc.sections.find((s) => s.id === "size")?.items[0].text.includes("Grew most:"), "the sample shows which part of the app grew");
});

test("briefing.md: every line of its excerpt is a line the tool prints", async () => {
  const printed = new Set(renderText(await sampleDoc()).split("\n"));
  const text = fs.readFileSync(BRIEFING, "utf8");
  const excerpt = fenced(between(text, EXCERPT, BRIEFING).body, BRIEFING);
  const lines = excerpt.split("\n").filter((l) => l.trim() !== "" && l.trim() !== "…");
  assert.ok(lines.length >= 5, "the excerpt is not empty");
  for (const line of lines) assert.ok(printed.has(line), `briefing.md excerpt has a line the tool does not print: ${line}`);
});
