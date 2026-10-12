// Scanner tests: node --test tools/test/scan.test.mjs
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stableStringify, factsHash } from "../lib/hash.mjs";
import { scanRepo, draftParts, showFacts, matchGlob, selectIds, plainAreaName, isJargon } from "../scan.mjs";
import { scanJs, stripPy, parseJsonc } from "../lib/scan/tokenize.mjs";
import { normRoutePath, segSuffixMatch, matchSegs } from "../lib/scan/routes.mjs";
import { routeName, tableName, areaName } from "../lib/scan/names.mjs";
import { scanRepoDetailed } from "../lib/scan/index.mjs";
import { listFiles } from "../lib/scan/files.mjs";
import { outputInsideRepo } from "../lib/scan/io.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, "..");
const FIX = path.join(HERE, "fixtures");
const CLI = path.join(TOOLS, "scan.mjs");

const ids = (facts, kind) => facts.facts.filter((f) => f.kind === kind).map((f) => f.id);
const fact = (facts, id) => facts.facts.find((f) => f.id === id);
const hasUse = (facts, file, id, via) => facts.uses.some((u) => u[0] === file && u[1] === id && u[2] === via);
const hasImport = (facts, from, to) => facts.imports.some((e) => e[0] === from && e[1] === to);

// A tiny independent glob matcher, to cross-check the exported one.
function miniGlob(pattern, id) {
  const re = new RegExp(
    "^" +
      pattern
        .split("**")
        .map((chunk) => chunk.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*"))
        .join(".*") +
      "$",
  );
  return re.test(id);
}

let recipe;
let fastapi;
let empty;

before(async () => {
  recipe = await scanRepo(path.join(FIX, "recipe"));
  fastapi = await scanRepo(path.join(FIX, "fastapi-svc"));
  empty = await scanRepo(path.join(FIX, "empty"));
});

describe("recipe fixture (Next.js app router + Prisma)", () => {
  test("screens drop route groups and use [param] segments", () => {
    assert.deepEqual(ids(recipe, "screen"), [
      "screen:/",
      "screen:/plan",
      "screen:/recipes",
      "screen:/recipes/[id]",
      "screen:/recipes/new",
      "screen:/settings",
    ]);
    assert.equal(fact(recipe, "screen:/recipes/[id]").name, "Recipe detail");
    assert.equal(fact(recipe, "screen:/").name, "Home");
    assert.deepEqual(fact(recipe, "screen:/recipes").files, ["app/(app)/recipes/page.tsx"]);
  });

  test("endpoints carry their methods; the cron target is a job, not an endpoint", () => {
    assert.deepEqual(ids(recipe, "endpoint"), ["endpoint:/api/recipes", "endpoint:/api/recipes/[id]", "endpoint:/api/suggest"]);
    assert.deepEqual(fact(recipe, "endpoint:/api/recipes").meta.methods, ["GET", "POST"]);
    assert.deepEqual(fact(recipe, "endpoint:/api/recipes/[id]").meta.methods, ["DELETE", "GET", "PATCH"]);
    assert.deepEqual(fact(recipe, "endpoint:/api/suggest").meta.methods, ["POST"]);
    assert.equal(fact(recipe, "endpoint:/api/cron/weekly-plan"), undefined);
    const job = fact(recipe, "job:/api/cron/weekly-plan");
    assert.ok(job, "cron job exists");
    assert.equal(job.meta.schedule, "0 8 * * 1");
    assert.deepEqual(job.files, ["app/api/cron/weekly-plan/route.ts"]);
    assert.equal(job.name, "Weekly plan");
    assert.deepEqual(ids(recipe, "job"), ["job:/api/cron/weekly-plan"]);
  });

  test("tables come from the Prisma schema with friendly names", () => {
    assert.deepEqual(ids(recipe, "table"), ["table:Ingredient", "table:MealPlan", "table:Recipe", "table:User"]);
    assert.equal(fact(recipe, "table:MealPlan").name, "Meal plan");
    assert.deepEqual(fact(recipe, "table:Recipe").files, ["prisma/schema.prisma"]);
  });

  test("services and AI are found from imports", () => {
    assert.deepEqual(ids(recipe, "service"), ["service:email", "service:payments", "service:sign-in"]);
    assert.equal(fact(recipe, "service:payments").name, "Payments");
    assert.deepEqual(fact(recipe, "service:payments").meta.vendor, ["stripe"]);
    assert.deepEqual(fact(recipe, "service:payments").files, ["lib/billing.ts"]);
    assert.deepEqual(fact(recipe, "service:email").files, ["lib/email.ts"]);
    assert.deepEqual(fact(recipe, "service:sign-in").files, ["lib/auth.ts"]);
    assert.deepEqual(fact(recipe, "service:sign-in").meta.vendor, ["clerk"], "Clerk is a hosted sign-in company");
    assert.deepEqual(ids(recipe, "ai"), ["ai:openai"]);
    const ai = fact(recipe, "ai:openai");
    assert.equal(ai.name, "OpenAI");
    assert.equal(ai.meta.tools, 2);
    assert.deepEqual(ai.files, ["lib/ai/suggest.ts"]);
  });

  test("areas: the merge rule, depth, and the named areas all survive", () => {
    const areas = ids(recipe, "area");
    for (const a of ["area:.", "area:app", "area:app/(app)", "area:app/api", "area:components", "area:components/recipes", "area:components/plan", "area:components/ui", "area:lib", "area:lib/recipes", "area:lib/plan", "area:lib/ai"]) {
      assert.ok(areas.includes(a), `${a} is an area`);
    }
    // prisma/ holds one small file: merged into the root, no fact of its own
    assert.ok(!areas.includes("area:prisma"));
    assert.equal(recipe.files["prisma/schema.prisma"].area, "area:.");
    // [id] and new/ hold one file each: merged into area:app/(app)/recipes
    assert.ok(!areas.includes("area:app/(app)/recipes/[id]"));
    assert.equal(recipe.files["app/(app)/recipes/[id]/page.tsx"].area, "area:app/(app)/recipes");
    assert.equal(recipe.files["components/recipes/recipe-card.tsx"].area, "area:components/recipes");
    for (const a of ["area:components/recipes", "area:components/plan", "area:components/ui", "area:lib/recipes", "area:lib/plan", "area:lib/ai"]) {
      assert.ok(fact(recipe, a).meta.fileCount >= 3, `${a} has at least 3 files`);
    }
    assert.equal(fact(recipe, "area:lib/recipes").name, "Recipes");
    assert.equal(fact(recipe, "area:.").loc, Object.values(recipe.files).reduce((s, f) => s + (f.gen ? 0 : f.loc), 0));
  });

  test("leaf flags mark the balanced split", () => {
    const leaf = (a) => fact(recipe, a).meta.leaf;
    for (const a of ["area:components/recipes", "area:components/plan", "area:components/ui", "area:lib/recipes", "area:lib/plan", "area:lib/ai", "area:app/api", "area:app/(app)"]) {
      assert.equal(leaf(a), true, `${a} is a leaf`);
    }
    for (const a of ["area:.", "area:app", "area:components", "area:lib"]) assert.equal(leaf(a), false, `${a} is not a leaf`);
  });

  test("kit files: components/ui and lib/utils; data flag on lib/db.ts", () => {
    for (const f of ["components/ui/button.tsx", "components/ui/card.tsx", "components/ui/input.tsx", "components/ui/badge.tsx", "lib/utils.ts"]) {
      assert.equal(recipe.files[f].kit, 1, `${f} is kit`);
    }
    assert.equal(recipe.files["components/recipes/recipe-card.tsx"].kit, undefined);
    assert.equal(recipe.files["app/(app)/page.tsx"].kit, undefined, "files that define facts are never kit");
    assert.equal(recipe.files["lib/db.ts"].data, 1);
    assert.equal(recipe.files["lib/db.ts"].kit, undefined, "a database access file stays linkable");
    assert.equal(recipe.files["lib/recipes/query.ts"].data, undefined, "query.ts only imports lib/db");
    assert.deepEqual(Object.keys(recipe.files).filter((f) => recipe.files[f].data), ["lib/db.ts"]);
  });

  test("tests, config files and non-source files are left out", () => {
    const files = Object.keys(recipe.files);
    assert.ok(!files.some((f) => /\.test\./.test(f)), "no test files");
    assert.ok(!files.includes("next.config.mjs"));
    assert.ok(!files.includes("package.json"));
    assert.equal(files.length, 41);
  });

  test("imports: relative, tsconfig alias (JSONC with comments and trailing commas), no commented-out imports", () => {
    assert.ok(hasImport(recipe, "app/api/recipes/route.ts", "lib/recipes/query.ts"), "@/ alias resolves");
    assert.ok(hasImport(recipe, "components/recipes/recipe-list.tsx", "components/recipes/recipe-card.tsx"), "./relative resolves");
    assert.ok(hasImport(recipe, "app/layout.tsx", "components/header.tsx"));
    assert.ok(hasImport(recipe, "components/recipes/recipe-list.tsx", "components/recipes/recipe-card.tsx"), "import { A, type B } still counts");
    assert.ok(!hasImport(recipe, "lib/plan/query.ts", "components/plan/plan-grid.tsx"), "import type is not wiring");
    assert.ok(!hasImport(recipe, "components/plan/plan-day.tsx", "components/plan/plan-grid.tsx"), "import type is not wiring");
    assert.ok(!hasImport(recipe, "lib/recipes/mutations.ts", "lib/recipes/schema.ts"), "import type is not wiring");
    assert.deepEqual(recipe.unresolved, {}, "the commented-out imports are not counted");
    assert.ok(!recipe.imports.some((e) => /old-totals|legacy-list/.test(e[1])));
    for (const [from, to] of recipe.imports) {
      assert.ok(recipe.files[from] && recipe.files[to], `${from} -> ${to} are both kept files`);
      assert.notEqual(from, to);
    }
  });

  test("uses: http literals from screens, orm accessors, package imports", () => {
    assert.ok(hasUse(recipe, "app/(app)/page.tsx", "endpoint:/api/suggest", "http"));
    assert.ok(hasUse(recipe, "app/(app)/page.tsx", "endpoint:/api/recipes", "http"));
    assert.ok(hasUse(recipe, "app/(app)/recipes/page.tsx", "endpoint:/api/recipes", "http"));
    assert.ok(hasUse(recipe, "app/(app)/recipes/new/page.tsx", "endpoint:/api/recipes", "http"));
    assert.ok(!recipe.uses.some((u) => u[2] === "http" && u[0] === "components/header.tsx"), 'href="/recipes/new" is a link, not a request');
    assert.ok(hasUse(recipe, "lib/recipes/query.ts", "table:Recipe", "orm"), "prisma.recipe.findMany");
    assert.ok(hasUse(recipe, "lib/plan/query.ts", "table:MealPlan", "orm"), "camelCase accessor matches MealPlan");
    assert.ok(hasUse(recipe, "lib/plan/build.ts", "table:User", "orm"));
    assert.ok(hasUse(recipe, "lib/billing.ts", "service:payments", "package"));
    assert.ok(hasUse(recipe, "lib/ai/suggest.ts", "ai:openai", "package"));
  });

  test("defines lists the facts a file declares", () => {
    assert.deepEqual(recipe.files["app/api/recipes/route.ts"].defines, ["endpoint:/api/recipes"]);
    assert.deepEqual(recipe.files["app/api/cron/weekly-plan/route.ts"].defines, ["job:/api/cron/weekly-plan"]);
    assert.deepEqual(recipe.files["prisma/schema.prisma"].defines, ["table:Ingredient", "table:MealPlan", "table:Recipe", "table:User"]);
  });

  test("packages and shape", () => {
    assert.deepEqual(recipe.repo, { name: "recipe", packages: ["."] });
    assert.equal(recipe.version, 1);
    assert.equal(recipe.empty, false);
  });
});

describe("fastapi-svc fixture (FastAPI + SQLModel + Celery + TanStack)", () => {
  test("packages are the manifest folders", () => {
    assert.deepEqual(fastapi.repo.packages, ["backend", "frontend"]);
  });

  test("router prefixes are joined: include_router prefix + APIRouter prefix + decorator path", () => {
    assert.deepEqual(ids(fastapi, "endpoint"), [
      "endpoint:/api/v1/items",
      "endpoint:/api/v1/items/[id]",
      "endpoint:/api/v1/login/access-token",
      "endpoint:/api/v1/password-recovery/[email]",
      "endpoint:/api/v1/users",
      "endpoint:/api/v1/users/me",
      "endpoint:/api/v1/users/signup",
      "endpoint:/api/v1/utils/health-check",
    ]);
    assert.deepEqual(fact(fastapi, "endpoint:/api/v1/items").meta.methods, ["GET", "POST"]);
    assert.deepEqual(fact(fastapi, "endpoint:/api/v1/items/[id]").meta.methods, ["DELETE", "GET", "PUT"]);
    assert.deepEqual(fact(fastapi, "endpoint:/api/v1/utils/health-check").files, ["backend/app/api/routes/utils.py"]);
    assert.deepEqual(fact(fastapi, "endpoint:/api/v1/login/access-token").meta.methods, ["POST"]);
  });

  test("SQLModel tables need table=True", () => {
    assert.deepEqual(ids(fastapi, "table"), ["table:Item", "table:User"]);
    assert.deepEqual(fact(fastapi, "table:User").files, ["backend/app/models.py"]);
    assert.equal(fastapi.files["backend/app/models.py"].data, 1);
  });

  test("Celery task is a job; services are Email and Error alerts", () => {
    assert.deepEqual(ids(fastapi, "job"), ["job:send_weekly_digest"]);
    assert.deepEqual(fact(fastapi, "job:send_weekly_digest").files, ["backend/app/worker.py"]);
    assert.deepEqual(ids(fastapi, "service"), ["service:email", "service:error-alerts"]);
    assert.deepEqual(fact(fastapi, "service:email").files, ["backend/app/utils.py"]);
    assert.deepEqual(fact(fastapi, "service:error-alerts").files, ["backend/app/main.py"]);
    assert.deepEqual(fact(fastapi, "service:error-alerts").meta.vendor, ["sentry"]);
    assert.deepEqual(ids(fastapi, "ai"), []);
  });

  test("TanStack file routes: pathless layout and __root are not screens", () => {
    assert.deepEqual(ids(fastapi, "screen"), ["screen:/", "screen:/items", "screen:/login", "screen:/signup"]);
    assert.deepEqual(fact(fastapi, "screen:/").files, ["frontend/src/routes/_layout/index.tsx"]);
  });

  test("Python imports: relative (..deps, .. import deps, .) and absolute from the package root", () => {
    assert.ok(hasImport(fastapi, "backend/app/api/routes/items.py", "backend/app/api/deps.py"), "from ..deps import X");
    assert.ok(hasImport(fastapi, "backend/app/api/routes/users.py", "backend/app/api/deps.py"), "from .. import deps");
    assert.ok(hasImport(fastapi, "backend/app/api/routes/items.py", "backend/app/models.py"), "from app.models import X");
    assert.ok(hasImport(fastapi, "backend/app/api/routes/items.py", "backend/app/crud.py"), "from app import crud");
    assert.ok(hasImport(fastapi, "backend/app/api/routes/login.py", "backend/app/core/security.py"), "from app.core import security");
    assert.ok(hasImport(fastapi, "backend/app/api/main.py", "backend/app/api/routes/items.py"), "from app.api.routes import items");
    assert.ok(hasImport(fastapi, "backend/app/main.py", "backend/app/api/main.py"));
    assert.deepEqual(fastapi.unresolved, {});
  });

  test("frontend alias imports and the generated client", () => {
    assert.ok(hasImport(fastapi, "frontend/src/routes/_layout/items.tsx", "frontend/src/components/ItemList.tsx"), "@/components/ItemList");
    assert.ok(hasImport(fastapi, "frontend/src/routes/_layout/items.tsx", "frontend/src/client/index.ts"), "../../client");
    assert.ok(hasImport(fastapi, "frontend/src/hooks/useAuth.ts", "frontend/src/client/index.ts"), "@/client");
    assert.equal(fastapi.files["frontend/src/client/sdk.gen.ts"].gen, 1);
    assert.equal(fastapi.files["frontend/src/routeTree.gen.ts"].gen, 1);
    assert.equal(fastapi.files["frontend/src/components/ItemList.tsx"].gen, undefined);
    assert.ok(!ids(fastapi, "area").includes("area:frontend/src/client"), "a folder of generated files has no area");
    assert.equal(fastapi.files["frontend/src/client/sdk.gen.ts"].area, "area:frontend/src");
  });

  test("http uses come from the literal URLs in the generated client", () => {
    assert.ok(hasUse(fastapi, "frontend/src/client/sdk.gen.ts", "endpoint:/api/v1/items", "http"));
    assert.ok(hasUse(fastapi, "frontend/src/client/sdk.gen.ts", "endpoint:/api/v1/items/[id]", "http"), "{id} in a literal matches [id]");
    assert.ok(hasUse(fastapi, "frontend/src/client/sdk.gen.ts", "endpoint:/api/v1/users/signup", "http"));
    assert.ok(hasUse(fastapi, "frontend/src/client/sdk.gen.ts", "endpoint:/api/v1/login/access-token", "http"));
    assert.ok(!fastapi.uses.some((u) => u[2] === "http" && u[0].startsWith("frontend/src/routes/_layout")), '"/_layout" is not a request');
    assert.ok(!fastapi.uses.some((u) => u[2] === "http" && u[0] === "frontend/src/routes/signup.tsx"), 'createFileRoute("/signup") is not a request');
  });

  test("orm uses from imported model classes", () => {
    assert.ok(hasUse(fastapi, "backend/app/crud.py", "table:User", "orm"));
    assert.ok(hasUse(fastapi, "backend/app/api/routes/items.py", "table:Item", "orm"));
    assert.ok(hasUse(fastapi, "backend/app/api/deps.py", "table:User", "orm"));
  });
});

describe("empty fixture", () => {
  test("a README-only repo is empty", () => {
    assert.equal(empty.empty, true);
    assert.deepEqual(Object.keys(empty.files), []);
    assert.deepEqual(empty.facts.map((f) => f.kind), ["area"]);
    assert.deepEqual(draftParts(empty), []);
  });
});

describe("output rules", () => {
  test("deterministic: scanning twice gives identical bytes", async () => {
    for (const name of ["recipe", "fastapi-svc", "empty"]) {
      const a = stableStringify(await scanRepo(path.join(FIX, name)), 1);
      const b = stableStringify(await scanRepo(path.join(FIX, name)), 1);
      assert.equal(a, b, name);
    }
  });

  test("hash is factsHash of the file; facts and files are sorted; no absolute paths", () => {
    for (const f of [recipe, fastapi, empty]) {
      assert.equal(f.hash, factsHash(f));
      assert.match(f.hash, /^[0-9a-f]{12}$/);
      const idList = f.facts.map((x) => x.id);
      assert.deepEqual(idList, [...idList].sort(), "facts sorted by id");
      assert.equal(new Set(idList).size, idList.length, "ids unique");
      const text = stableStringify(f, 1);
      assert.ok(!text.includes(os.tmpdir()) && !text.includes(HERE), "no absolute paths");
      assert.ok(!text.includes("\\\\"), "POSIX separators");
      for (const arr of [f.imports, f.uses]) {
        const lines = arr.map((x) => x.join("\0"));
        assert.deepEqual(lines, [...lines].sort(), "sorted");
        assert.equal(new Set(lines).size, lines.length, "deduped");
      }
    }
  });

  test("CLI scan writes facts.json outside the repo, byte-identical on a second run, with the contract hash", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "scan-out-"));
    try {
      const a = path.join(out, "a.json");
      const b = path.join(out, "b.json");
      const r1 = spawnSync("node", [CLI, "scan", path.join(FIX, "recipe"), "--out", a], { encoding: "utf8" });
      const r2 = spawnSync("node", [CLI, "scan", path.join(FIX, "recipe"), "--out", b], { encoding: "utf8" });
      assert.equal(r1.status, 0, r1.stderr);
      assert.match(r1.stdout, /^Scanned recipe: 6 screens, 3 endpoints, 4 tables, 3 services, 1 AI, 1 jobs?, \d+ areas/);
      assert.equal(r1.stdout.trim().split("\n").length, 1, "one-line summary");
      assert.equal(r2.status, 0);
      assert.ok(fs.readFileSync(a).equals(fs.readFileSync(b)), "byte-identical");
      const parsed = JSON.parse(fs.readFileSync(a, "utf8"));
      assert.equal(fs.readFileSync(a, "utf8"), stableStringify(parsed, 1), "written with stableStringify(obj, 1)");
      assert.equal(parsed.hash, factsHash(parsed));
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  test("CLI refuses to write inside the scanned repo, and the scan leaves the repo untouched", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scan-copy-"));
    try {
      fs.cpSync(path.join(FIX, "recipe"), path.join(tmp, "recipe"), { recursive: true });
      const snap = () => execFileSync("find", [path.join(tmp, "recipe"), "-type", "f", "-printf", "%p %s %T@\\n"], { encoding: "utf8" });
      const before = snap();
      const bad = spawnSync("node", [CLI, "scan", path.join(tmp, "recipe"), "--out", path.join(tmp, "recipe", "facts.json")], { encoding: "utf8" });
      assert.equal(bad.status, 1);
      assert.match(bad.stderr, /^✗ /m);
      assert.ok(!fs.existsSync(path.join(tmp, "recipe", "facts.json")));
      const ok = spawnSync("node", [CLI, "scan", path.join(tmp, "recipe"), "--out", path.join(tmp, "facts.json")], { encoding: "utf8" });
      assert.equal(ok.status, 0, ok.stderr);
      assert.equal(snap(), before, "nothing in the scanned repo changed");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("wire and why are forwarded to lib/wire.mjs; without it they exit 2 with a message", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scan-nowire-"));
    try {
      fs.mkdirSync(path.join(tmp, "lib"), { recursive: true });
      fs.copyFileSync(CLI, path.join(tmp, "scan.mjs"));
      fs.copyFileSync(path.join(TOOLS, "lib", "hash.mjs"), path.join(tmp, "lib", "hash.mjs"));
      fs.cpSync(path.join(TOOLS, "lib", "scan"), path.join(tmp, "lib", "scan"), { recursive: true });
      for (const cmd of ["wire", "why"]) {
        const r = spawnSync("node", [path.join(tmp, "scan.mjs"), cmd, "facts.json"], { encoding: "utf8" });
        assert.equal(r.status, 2, r.stderr);
        assert.match(r.stderr, /wire\.mjs/);
      }
      fs.writeFileSync(path.join(tmp, "lib", "wire.mjs"), 'import "./nope.mjs";\nexport async function wireMain() { return 0; }\n');
      const broken = spawnSync("node", [path.join(tmp, "scan.mjs"), "wire", "facts.json"], { encoding: "utf8" });
      assert.equal(broken.status, 2, broken.stderr);
      assert.match(broken.stderr, /Could not load tools\/lib\/wire\.mjs/, "a missing import inside wire.mjs is not reported as wire.mjs missing");
      assert.doesNotMatch(broken.stderr, /is not installed/);
      fs.writeFileSync(
        path.join(tmp, "lib", "wire.mjs"),
        'export async function wireMain(argv) { console.log("wire " + argv.join(",")); return 0; }\nexport async function whyMain(argv) { console.log("why " + argv.join(",")); return 1; }\n',
      );
      const w = spawnSync("node", [path.join(tmp, "scan.mjs"), "wire", "f.json", "--into", "c.tsx"], { encoding: "utf8" });
      assert.equal(w.status, 0);
      assert.equal(w.stdout.trim(), "wire f.json,--into,c.tsx");
      const y = spawnSync("node", [path.join(tmp, "scan.mjs"), "why", "f.json", "A", "B"], { encoding: "utf8" });
      assert.equal(y.status, 1, "the return value of whyMain is the exit code");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("diff and changes are forwarded to lib/changes-cli.mjs; without it they exit 2 with a message naming it", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scan-nochanges-"));
    try {
      fs.mkdirSync(path.join(tmp, "lib"), { recursive: true });
      fs.copyFileSync(CLI, path.join(tmp, "scan.mjs"));
      fs.copyFileSync(path.join(TOOLS, "lib", "hash.mjs"), path.join(tmp, "lib", "hash.mjs"));
      fs.cpSync(path.join(TOOLS, "lib", "scan"), path.join(tmp, "lib", "scan"), { recursive: true });
      for (const cmd of ["diff", "changes"]) {
        const r = spawnSync("node", [path.join(tmp, "scan.mjs"), cmd, "a.json", "b.json"], { encoding: "utf8" });
        assert.equal(r.status, 2, r.stderr);
        assert.match(r.stderr, /changes-cli\.mjs/);
        assert.match(r.stderr, new RegExp(`\`${cmd}\` is unavailable`));
      }
      fs.writeFileSync(
        path.join(tmp, "lib", "changes-cli.mjs"),
        'export async function diffMain(argv) { console.log("diff " + argv.join(",")); return 0; }\nexport async function changesMain(argv) { console.log("changes " + argv.join(",")); return 1; }\n',
      );
      const d = spawnSync("node", [path.join(tmp, "scan.mjs"), "diff", "a.json", "b.json", "--json"], { encoding: "utf8" });
      assert.equal(d.status, 0);
      assert.equal(d.stdout.trim(), "diff a.json,b.json,--json");
      const c = spawnSync("node", [path.join(tmp, "scan.mjs"), "changes", ".", "--since", "HEAD"], { encoding: "utf8" });
      assert.equal(c.status, 1, "the return value of changesMain is the exit code");
      assert.equal(c.stdout.trim(), "changes .,--since,HEAD");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("CLI usage errors exit 2; unknown file exits 1", () => {
    assert.equal(spawnSync("node", [CLI], { encoding: "utf8" }).status, 2);
    assert.equal(spawnSync("node", [CLI, "bogus"], { encoding: "utf8" }).status, 2);
    assert.equal(spawnSync("node", [CLI, "scan"], { encoding: "utf8" }).status, 2);
    assert.equal(spawnSync("node", [CLI, "scan", path.join(FIX, "recipe")], { encoding: "utf8" }).status, 2, "--out is required");
    assert.equal(spawnSync("node", [CLI, "show", path.join(os.tmpdir(), "no-such-facts.json")], { encoding: "utf8" }).status, 1);
  });
});

describe("show and draft", () => {
  test("show prints fact ids next to every item", () => {
    const text = showFacts(recipe);
    assert.match(text, /^Repo: recipe/);
    assert.match(text, /screen:\/recipes\/\[id\] {2,}Recipe detail/);
    assert.match(text, /endpoint:\/api\/recipes {2,}Recipes {2}GET,POST/);
    assert.match(text, /table:MealPlan {2,}Meal plan/);
    assert.match(text, /service:payments {2,}Payments {2,}stripe/);
    assert.match(text, /ai:openai {2,}OpenAI {2,}2 tools/);
    assert.match(text, /job:\/api\/cron\/weekly-plan {2,}Weekly plan {2,}0 8 \* \* 1/);
    assert.match(text, /area:lib\/recipes {2,}Recipes {2,}\d+ LOC {2,}\d+%/);
    assert.match(text, /KIT FILES/);
    assert.match(text, /components\/ui\/button\.tsx/);
    assert.match(text, /TOP CROSS-AREA IMPORTS/);
    assert.match(text, /area:app\/api -> area:lib\/recipes/);
    assert.match(showFacts(empty), /too small or too unusual/);
  });

  test("CLI show and draft read a facts file", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "scan-show-"));
    try {
      const f = path.join(out, "facts.json");
      spawnSync("node", [CLI, "scan", path.join(FIX, "recipe"), "--out", f]);
      const show = spawnSync("node", [CLI, "show", f], { encoding: "utf8" });
      assert.equal(show.status, 0, show.stderr);
      assert.match(show.stdout, /screen:\/ {2,}Home/);
      const draft = spawnSync("node", [CLI, "draft", f], { encoding: "utf8" });
      assert.equal(draft.status, 0, draft.stderr);
      const parts = JSON.parse(draft.stdout);
      assert.ok(Array.isArray(parts) && parts.length >= 2);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  test("draft(recipe): 2–9 parts, short names, patterns that all match something", () => {
    const parts = draftParts(recipe);
    assert.ok(parts.length >= 2 && parts.length <= 9, `${parts.length} parts`);
    assert.ok(parts.length <= 7);
    const allIds = recipe.facts.map((f) => f.id);
    const roles = new Set(["screens", "api", "feature", "ai", "jobs", "data", "service"]);
    const seen = new Set();
    for (const p of parts) {
      assert.ok(roles.has(p.role));
      assert.ok(p.name.length > 0 && p.name.length <= 16, `name "${p.name}"`);
      assert.ok(!isJargon(p.name) && !isJargon(p.line), `"${p.name}" / "${p.line}" has no jargon`);
      assert.match(p.line, /^When you .*, the app .*\.$/);
      assert.ok(p.from.length >= 1);
      for (const pat of p.from.filter((x) => !x.startsWith("!"))) {
        assert.ok(allIds.some((id) => miniGlob(pat, id)), `${pat} matches a fact`);
        assert.equal(allIds.filter((id) => miniGlob(pat, id)).length, allIds.filter((id) => matchGlob(pat, id)).length, "exported matcher agrees");
      }
      if (p.role === "feature") {
        for (const pat of p.from) {
          assert.match(pat, /^area:/);
          assert.ok(!seen.has(pat), `${pat} cited once`);
          seen.add(pat);
        }
      }
    }
    assert.ok(parts.filter((p) => p.role === "feature").length <= 4);
    const byRole = (r) => parts.find((p) => p.role === r);
    assert.deepEqual(byRole("screens").from, ["screen:**"]);
    assert.deepEqual(byRole("jobs").from, ["job:**"]);
    assert.deepEqual(byRole("ai").from, ["ai:*"]);
    assert.deepEqual(byRole("data").from, ["table:*"]);
    assert.deepEqual(byRole("service").from, ["service:*"]);
    assert.equal(byRole("api"), undefined, "only 3 endpoints next to 6 screens: no api part");
    // routes and kit are not feature parts
    const cited = parts.filter((p) => p.role === "feature").flatMap((p) => p.from);
    assert.ok(!cited.includes("area:app/(app)") && !cited.includes("area:app/api") && !cited.includes("area:components/ui"));
    // no nested citations
    for (const a of cited) for (const b of cited) if (a !== b) assert.ok(!(`${b.slice(5)}/`).startsWith(`${a.slice(5)}/`), `${a} contains ${b}`);
  });

  test("draft(fastapi-svc): endpoints get a part when there are 8, jobs are skipped when empty", () => {
    const parts = draftParts(fastapi);
    assert.ok(parts.length >= 2 && parts.length <= 7);
    const api = parts.find((p) => p.role === "api");
    assert.ok(api, "8 endpoints next to 4 screens");
    assert.deepEqual(api.from, ["endpoint:**"]);
    assert.deepEqual(parts.find((p) => p.role === "jobs").from, ["job:**"]);
    assert.equal(parts.find((p) => p.role === "ai"), undefined);
    const cited = parts.filter((p) => p.role === "feature").flatMap((p) => p.from);
    assert.ok(!cited.includes("area:backend/app/api"), "the route folder is already the api part");
    const allIds = fastapi.facts.map((f) => f.id);
    for (const p of parts) for (const pat of p.from) assert.ok(allIds.some((id) => miniGlob(pat, id)), pat);
  });
});

describe("glob rules (§3.1)", () => {
  test("* stops at /, ** does not, whole-id match, ! excludes in order", () => {
    assert.ok(matchGlob("table:*", "table:Recipe"));
    assert.ok(!matchGlob("job:*", "job:/api/cron/weekly-plan"), "* does not cross /");
    assert.ok(matchGlob("job:**", "job:/api/cron/weekly-plan"));
    assert.ok(matchGlob("screen:**", "screen:/recipes/[id]"));
    assert.ok(matchGlob("area:lib/*", "area:lib/ai"));
    assert.ok(!matchGlob("area:lib", "area:lib/ai"), "whole id only");
    assert.ok(!matchGlob("table:Rec", "table:Recipe"));
    const idList = ["endpoint:/a", "endpoint:/b", "endpoint:/c"];
    assert.deepEqual([...selectIds(["endpoint:**", "!endpoint:/b"], idList)].sort(), ["endpoint:/a", "endpoint:/c"]);
    assert.deepEqual([...selectIds(["!endpoint:/b", "endpoint:**"], idList)].sort(), idList, "order matters");
  });
});

describe("building blocks", () => {
  test("scanJs blanks comments, keeps strings, finds /-strings, copes with regexes and nested templates", () => {
    const src = 'import a from "./a"; // import b from "./b"\nconst u = "http://x"; const t = `/api/x/${id}/y${`/z`}`; /* fetch("/no") */ fetch("/api/recipes"); const re = /[\'"]/g;';
    const { code, strings } = scanJs(src);
    assert.equal(code.length, src.length);
    assert.ok(code.includes('import a from "./a"'));
    assert.ok(!code.includes("./b") && !code.includes("/no"));
    assert.ok(code.includes("http://x"), "// inside a string is not a comment");
    const values = strings.map((s) => s.value);
    assert.ok(values.includes("/api/recipes"));
    assert.ok(values.includes("/api/x/\u0001/y\u0001"));
    assert.ok(values.includes("/z"));
  });

  test("scanJs does not mistake JSX closing tags for regex literals", () => {
    const { strings } = scanJs('const a = <div><p>x</p><Link href="/api/x">y</Link></div>; const f = (x) => /ab+c/.test(x); fetch("/api/after");');
    assert.deepEqual(strings.map((s) => s.value), ["/api/x", "/api/after"]);
  });

  test("stripPy removes comments and docstrings only", () => {
    const code = stripPy('import os  # hi\n"""doc\nimport nope\n"""\nfrom . import y\nx = "#kept"');
    assert.ok(code.includes("import os") && code.includes("from . import y") && code.includes('"#kept"'));
    assert.ok(!code.includes("nope") && !code.includes("hi"));
  });

  test("parseJsonc handles comments and trailing commas", () => {
    assert.deepEqual(parseJsonc('{ // c\n "a": [1,2,], /* x */ "b": {"c": 1,}, }'), { a: [1, 2], b: { c: 1 } });
    assert.equal(parseJsonc("{ nope"), null);
  });

  test("route normalisation and the http suffix rule", () => {
    assert.equal(normRoutePath("/api/v1/items/{item_id}/"), "/api/v1/items/[item_id]");
    assert.equal(normRoutePath("/a/:id?x=1"), "/a/[id]");
    assert.equal(normRoutePath("/a/<int:pk>"), "/a/[pk]");
    assert.equal(normRoutePath("/a/$id"), "/a/[id]");
    assert.equal(normRoutePath("/docs/[[...slug]]"), "/docs/[...slug]");
    assert.equal(segSuffixMatch(matchSegs("/api/recipes/[p]"), matchSegs("/api/recipes/[id]")), 0);
    assert.equal(segSuffixMatch(matchSegs("/recipes"), matchSegs("/api/recipes")), 0, "either side may be the suffix");
    assert.equal(segSuffixMatch(matchSegs("/base/api/recipes"), matchSegs("/api/recipes")), 0);
    assert.equal(segSuffixMatch(matchSegs("/api/recipes"), matchSegs("/api/recipes/[id]")), null);
    assert.equal(segSuffixMatch(matchSegs("/[id]"), matchSegs("/api/recipes")), null, "the shorter side needs a static segment");
    assert.equal(segSuffixMatch(matchSegs("/_layout"), matchSegs("/api/v1/items/[id]")), null, "a static segment must meet a static one");
    assert.equal(segSuffixMatch(matchSegs("/api/users/[p]"), matchSegs("/api/users/stripe")), 1, "a wildcard swallowing a static is the loosest fit");
  });

  test("friendly names", () => {
    assert.equal(routeName("/settings/billing"), "Billing");
    assert.equal(routeName("/recipes/[id]"), "Recipe detail");
    assert.equal(routeName("/recipes/new"), "New recipe");
    assert.equal(routeName("/"), "Home");
    assert.equal(tableName("Message_v2"), "Message");
    assert.equal(tableName("VerificationToken"), "Verification token");
    assert.equal(areaName("app/(chat)", "x"), "Chat");
  });
});

describe("other frameworks", () => {
  const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), "scan-fw-"));
  const build = (spec) => {
    const root = mk();
    for (const [rel, text] of Object.entries(spec)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    }
    return root;
  };
  const withRepo = async (spec, fn) => {
    const root = build(spec);
    try {
      return await fn(await scanRepo(root));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

  test("Flask: blueprint url_prefix joined with register_blueprint, methods from route()", () =>
    withRepo(
      {
        "requirements.txt": "flask\n",
        "app/__init__.py": 'from flask import Flask\nfrom .api import api_bp\n\ndef create_app():\n    app = Flask(__name__)\n    app.register_blueprint(api_bp, url_prefix="/api")\n    return app\n',
        "app/api.py": 'from flask import Blueprint\napi_bp = Blueprint("api", __name__, url_prefix="/v1")\n\n@api_bp.get("/posts/<int:post_id>")\ndef post(post_id):\n    return {}\n\n@api_bp.route("/posts", methods=["GET", "POST"])\ndef posts():\n    return {}\n',
      },
      (f) => {
        assert.deepEqual(ids(f, "endpoint"), ["endpoint:/api/v1/posts", "endpoint:/api/v1/posts/[post_id]"]);
        assert.deepEqual(fact(f, "endpoint:/api/v1/posts").meta.methods, ["GET", "POST"]);
      },
    ));

  test("Django: include() chains urls.py files; abstract models are not tables", () =>
    withRepo(
      {
        "manage.py": "import os\n",
        "mysite/urls.py": 'from django.urls import include, path\nurlpatterns = [path("admin/", admin.site.urls), path("api/", include("blog.urls"))]\n',
        "blog/urls.py": 'from django.urls import path\nfrom . import views\nurlpatterns = [path("posts/", views.L.as_view()), path("posts/<int:pk>/", views.D.as_view())]\n',
        "blog/views.py": "from .models import Post\nclass L:\n    def get(self):\n        return Post.objects.all()\nclass D: pass\n",
        "blog/models.py": "from django.db import models\nclass Post(models.Model):\n    title = models.CharField(max_length=9)\nclass Base(models.Model):\n    class Meta:\n        abstract = True\n",
      },
      (f) => {
        assert.deepEqual(ids(f, "endpoint"), ["endpoint:/api/posts", "endpoint:/api/posts/[pk]"]);
        assert.deepEqual(ids(f, "table"), ["table:Post"]);
        assert.ok(hasUse(f, "blog/views.py", "table:Post", "orm"));
      },
    ));

  test("Express: app.use mounts, route().get().delete() chains; a mount prefix is not an http use", () =>
    withRepo(
      {
        "package.json": '{"name":"e","dependencies":{"express":"4"}}',
        "src/server.js": 'const express = require("express");\nconst users = require("./routes/users");\nconst app = express();\napp.use("/api/users", users);\napp.get("/health", (req, res) => res.send("ok"));\n',
        "src/routes/users.js": 'const router = require("express").Router();\nrouter.get("/", (req, res) => {});\nrouter.route("/:id").get((req, res) => {}).delete((req, res) => {});\nmodule.exports = router;\n',
      },
      (f) => {
        assert.deepEqual(ids(f, "endpoint"), ["endpoint:/api/users", "endpoint:/api/users/[id]", "endpoint:/health"]);
        assert.deepEqual(fact(f, "endpoint:/api/users/[id]").meta.methods, ["DELETE", "GET"]);
        assert.deepEqual(f.uses.filter((u) => u[2] === "http"), []);
      },
    ));

  test("Hono basePath and tRPC procedures, with client calls as http uses", () =>
    withRepo(
      {
        "package.json": '{"name":"h","dependencies":{"hono":"4","@trpc/server":"11"}}',
        "src/index.ts": 'import { Hono } from "hono";\nconst app = new Hono().basePath("/api");\napp.post("/items/:id", (c) => c.text("x"));\nexport default app;\n',
        "src/trpc/recipe.ts": 'export const recipeRouter = createTRPCRouter({\n  list: publicProcedure.query(() => []),\n  create: publicProcedure.mutation(() => ({})),\n});\n',
        "src/web/client.ts": 'import { api } from "./trpc";\nexport const go = () => api.recipe.list.useQuery();\n',
      },
      (f) => {
        assert.deepEqual(ids(f, "endpoint"), ["endpoint:/api/items/[id]", "endpoint:/trpc/recipe.create", "endpoint:/trpc/recipe.list"]);
        assert.deepEqual(fact(f, "endpoint:/trpc/recipe.list").meta.methods, ["GET"]);
        assert.ok(hasUse(f, "src/web/client.ts", "endpoint:/trpc/recipe.list", "http"));
      },
    ));

  test("SvelteKit, Nuxt, Remix and React Router screens", async () => {
    await withRepo(
      {
        "package.json": '{"name":"s","devDependencies":{"@sveltejs/kit":"2"}}',
        "src/routes/+page.svelte": "<p>hi</p>\n",
        "src/routes/(app)/blog/[slug]/+page.svelte": "<p>hi</p>\n",
        "src/routes/api/posts/+server.ts": "export const GET = () => new Response();\nexport async function POST() { return new Response(); }\n",
      },
      (f) => {
        assert.deepEqual(ids(f, "screen"), ["screen:/", "screen:/blog/[slug]"]);
        assert.deepEqual(fact(f, "endpoint:/api/posts").meta.methods, ["GET", "POST"]);
      },
    );
    await withRepo(
      {
        "package.json": '{"name":"n","dependencies":{"nuxt":"3"}}',
        "pages/index.vue": "<template><p>hi</p></template>\n",
        "pages/posts/[id].vue": "<template><p>hi</p></template>\n",
        "server/api/posts/[id].get.ts": "export default defineEventHandler(() => ({}));\n",
      },
      (f) => {
        assert.deepEqual(ids(f, "screen"), ["screen:/", "screen:/posts/[id]"]);
        assert.deepEqual(fact(f, "endpoint:/api/posts/[id]").meta.methods, ["GET"]);
      },
    );
    await withRepo(
      {
        "package.json": '{"name":"r","dependencies":{"@remix-run/react":"2"}}',
        "app/routes/_index.tsx": "export default function A(){ return null }\n",
        "app/routes/recipes.$id.tsx": "export default function A(){ return null }\n",
        "app/routes/_auth.login.tsx": "export default function A(){ return null }\n",
        "app/routes/api.health.tsx": "export async function loader(){ return {} }\n",
      },
      (f) => {
        assert.deepEqual(ids(f, "screen"), ["screen:/", "screen:/login", "screen:/recipes/[id]"]);
        assert.deepEqual(ids(f, "endpoint"), ["endpoint:/api/health"]);
      },
    );
    await withRepo(
      {
        "package.json": '{"name":"spa","dependencies":{"react-router-dom":"6"}}',
        "src/App.tsx": 'import { Routes, Route } from "react-router-dom";\nexport default function App() {\n  return (<Routes><Route path="/" element={<A />} /><Route path="/recipes/:id" element={<B />} /><Route path="*" element={<C />} /></Routes>);\n}\n',
      },
      (f) => assert.deepEqual(ids(f, "screen"), ["screen:/", "screen:/recipes/[id]"]),
    );
  });

  test("http matching: base-path templates count, matcher patterns and type-only imports do not, the tightest endpoint wins", () =>
    withRepo(
      {
        "package.json": '{"name":"n","dependencies":{"next":"14","stripe":"1","@clerk/nextjs":"5"}}',
        "app/api/users/[userId]/route.ts": "export async function PATCH() { return null }\n",
        "app/api/users/stripe/route.ts": "export async function GET() { return null }\n",
        "app/api/chat/route.ts": "export async function POST() { return null }\n",
        "app/page.tsx": 'import type { User } from "@clerk/nextjs/server";\nexport default function P() { fetch(`${process.env.BASE ?? ""}/api/chat?x=1`); fetch(`/api/users/${id}`); fetch("/api/users/stripe"); return null }\n',
        "middleware.ts": 'export const config = { matcher: ["/api/:path*", "/"] };\n',
      },
      (f) => {
        const http = f.uses.filter((u) => u[2] === "http").map((u) => `${u[0]} ${u[1]}`);
        assert.deepEqual(http.sort(), ["app/page.tsx endpoint:/api/chat", "app/page.tsx endpoint:/api/users/[userId]", "app/page.tsx endpoint:/api/users/stripe"]);
        assert.ok(!f.uses.some((u) => u[2] === "package"), "import type is erased: no package use");
        assert.deepEqual(ids(f, "service"), []);
      },
    ));

  test("Drizzle tables are found and uses follow the imported table variable; the old _v1 copy is dropped", () =>
    withRepo(
      {
        "package.json": '{"name":"d","dependencies":{"drizzle-orm":"1","next":"14"}}',
        "lib/db/schema.ts": 'import { pgTable, text } from "drizzle-orm/pg-core";\nexport const chat = pgTable("Chat", { id: text("id") });\nexport const message = pgTable("Message_v2", { id: text("id") });\nexport const messageOld = pgTable("Message", { id: text("id") });\n',
        "lib/db/queries.ts": 'import { eq } from "drizzle-orm";\nimport { chat } from "./schema";\nexport const one = (db: any, id: string) => db.select().from(chat).where(eq(chat.id, id));\n',
      },
      (f) => {
        assert.deepEqual(ids(f, "table"), ["table:Chat", "table:Message_v2"]);
        assert.ok(hasUse(f, "lib/db/queries.ts", "table:Chat", "orm"));
        assert.ok(!hasUse(f, "lib/db/queries.ts", "table:Message_v2", "orm"));
        assert.equal(f.files["lib/db/queries.ts"].data, 1);
        assert.equal(f.files["lib/db/queries.ts"].kit, undefined);
      },
    ));
});

describe("type-only imports are not wiring (§2.3)", () => {
  const withRepo = async (spec, fn) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "scan-types-"));
    for (const [rel, text] of Object.entries(spec)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    }
    try {
      return await fn(await scanRepo(root));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

  test("import type, export type … from and all-`type X` specifiers draw no edge; a mixed import still does", () =>
    withRepo(
      {
        "package.json": '{"name":"t","dependencies":{"next":"14","drizzle-orm":"1"}}',
        "lib/db/schema.ts": 'import { pgTable, text } from "drizzle-orm/pg-core";\nexport const chat = pgTable("Chat", { id: text("id") });\nexport type Chat = { id: string };\nexport type Vote = { id: string };\n',
        "lib/db/other.ts": "export const other = 1;\nexport type Other = string;\n",
        "components/a.tsx": 'import type { Chat } from "@/lib/db/schema";\nexport const A = (c: Chat) => c;\n',
        "components/b.tsx": 'import { type Chat, type Vote } from "@/lib/db/schema";\nexport const B = (c: Chat, v: Vote) => [c, v];\n',
        "components/c.tsx": 'export type { Chat } from "@/lib/db/schema";\nexport type * from "@/lib/db/other";\n',
        "components/d.tsx": 'import { type Chat, chat } from "@/lib/db/schema";\nexport const D = (c: Chat) => chat && c;\n',
        "components/e.tsx": 'import { chat } from "@/lib/db/schema";\nexport const E = chat;\n',
        "components/f.tsx": 'type T = typeof import("@/lib/db/other");\nexport const F: T | null = null;\n',
        "components/g.tsx": 'export const G = () => import("@/lib/db/other");\n',
        "app/page.tsx": "export default function P() { return null }\n",
      },
      (f) => {
        const importers = f.imports.filter((e) => e[1] === "lib/db/schema.ts").map((e) => e[0]);
        assert.deepEqual(importers, ["components/d.tsx", "components/e.tsx"], "only the value imports");
        assert.ok(!hasImport(f, "components/c.tsx", "lib/db/other.ts"), "export type * from");
        assert.ok(!hasImport(f, "components/f.tsx", "lib/db/other.ts"), "typeof import(...) is a type");
        assert.ok(hasImport(f, "components/g.tsx", "lib/db/other.ts"), "a real dynamic import is wiring");
        assert.deepEqual(f.unresolved, {});
      },
    ));

  test("a type-only import of a missing file is not counted as unresolved, and brings no package use", () =>
    withRepo(
      {
        "package.json": '{"name":"t","dependencies":{"@clerk/nextjs":"5","stripe":"1"}}',
        "a.ts": 'import type { X } from "./gone";\nimport type { User } from "@clerk/nextjs/server";\nimport { type Stripe } from "stripe";\nexport const a = 1;\n',
        "b.ts": 'import { auth } from "@clerk/nextjs/server";\nexport const b = auth;\n',
      },
      (f) => {
        assert.deepEqual(f.unresolved, {});
        assert.deepEqual(f.uses, [["b.ts", "service:sign-in", "package"]]);
        assert.deepEqual(fact(f, "service:sign-in").files, ["b.ts"]);
        assert.equal(fact(f, "service:payments"), undefined);
      },
    ));

  test("Python: imports under `if TYPE_CHECKING:` are skipped, runtime imports and the else branch are kept", () =>
    withRepo(
      {
        "requirements.txt": "fastapi\n",
        "app/__init__.py": "",
        "app/models.py": "class User: pass\n",
        "app/other.py": "x = 1\n",
        "app/later.py": "y = 1\n",
        "app/svc.py":
          "from typing import TYPE_CHECKING\nfrom app.other import x\n\nif TYPE_CHECKING:\n    from app.models import User\n    import app.later\n\ndef f(u: 'User'):\n    return x\n\nif TYPE_CHECKING: from app import models\nelse:\n    from app import later\n",
      },
      (f) => {
        assert.ok(hasImport(f, "app/svc.py", "app/other.py"));
        assert.ok(hasImport(f, "app/svc.py", "app/later.py"), "the else branch runs");
        assert.ok(!hasImport(f, "app/svc.py", "app/models.py"));
        assert.deepEqual(f.imports.filter((e) => e[0] === "app/svc.py").map((e) => e[1]), ["app/later.py", "app/other.py"]);
      },
    ));
});

describe("services are outside companies (§2.5)", () => {
  const withRepo = async (spec, fn) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "scan-svc-"));
    for (const [rel, text] of Object.entries(spec)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    }
    try {
      return await fn(await scanRepo(root));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

  test("libraries that run inside the app are not services", () =>
    withRepo(
      {
        "package.json": '{"name":"s","dependencies":{"next":"14"}}',
        "a.ts": 'import NextAuth from "next-auth";\nimport { Auth } from "@auth/core";\nimport { Lucia } from "lucia";\nimport { betterAuth } from "better-auth";\nimport { render } from "@react-email/components";\nexport const x = [NextAuth, Auth, Lucia, betterAuth, render];\n',
        "py/requirements.txt": "x\n",
        "py/a.py": "from passlib.context import CryptContext\nimport jwt\nfrom jose import jwt as j\nfrom pwdlib import PasswordHash\nfrom authlib.integrations.starlette_client import OAuth\n",
      },
      (f) => {
        assert.deepEqual(ids(f, "service"), []);
        assert.deepEqual(f.uses.filter((u) => u[2] === "package"), []);
      },
    ));

  test("hosted sign-in companies and mail senders are services", () =>
    withRepo(
      {
        "package.json": '{"name":"s","dependencies":{"next":"14"}}',
        "clerk.ts": 'import { auth } from "@clerk/nextjs/server";\nexport const a = auth;\n',
        "auth0.ts": 'import { handleAuth } from "@auth0/nextjs-auth0";\nexport const a = handleAuth;\n',
        "workos.ts": 'import { WorkOS } from "@workos-inc/node";\nexport const a = WorkOS;\n',
        "stytch.ts": 'import { Client } from "@stytch/nextjs";\nexport const a = Client;\n',
        "kinde.ts": 'import { x } from "@kinde-oss/kinde-auth-nextjs";\nexport const a = x;\n',
        "okta.ts": 'import { x } from "@okta/okta-auth-js";\nexport const a = x;\n',
        "fb.ts": 'import { getAuth } from "firebase/auth";\nexport const a = getAuth;\n',
        "supa.ts": 'import { createServerClient } from "@supabase/ssr";\nexport const a = createServerClient;\n',
        "mail.ts": 'import { Resend } from "resend";\nimport { render } from "@react-email/render";\nexport const a = [Resend, render];\n',
        "py/requirements.txt": "x\n",
        "py/a.py": "from auth0.authentication import GetToken\nimport firebase_admin\n",
      },
      (f) => {
        assert.deepEqual(ids(f, "service"), ["service:email", "service:sign-in"]);
        assert.deepEqual(fact(f, "service:sign-in").meta.vendor, ["auth0", "clerk", "firebase", "kinde", "okta", "stytch", "supabase", "workos"]);
        assert.deepEqual(fact(f, "service:email").files, ["mail.ts"], "Resend yes, @react-email/render only renders the message");
        assert.equal(fact(f, "service:sign-in").files.length, 9);
      },
    ));
});

describe(".mdx is content that counts (§2.2)", () => {
  const withRepo = async (spec, fn) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "scan-mdx-"));
    for (const [rel, text] of Object.entries(spec)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    }
    try {
      return await fn(await scanRepo(root));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
  const post = (n, extra = "") => `---\ntitle: Post ${n}\n---\n\n${extra}Some words about post ${n}.\n\nMore words, on a line of their own.\n`;

  test("a folder of posts becomes an area; ESM blocks are imports, prose and code fences are not", () =>
    withRepo(
      {
        "package.json": '{"name":"c","dependencies":{"next":"14"}}',
        "tsconfig.json": '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./*"]}}}',
        "components/callout.tsx": "export const Callout = () => null;\n",
        "components/other.tsx": "export const Other = () => null;\n",
        "content/blog/one.mdx": post(1, 'import { Callout } from "@/components/callout"\n\n'),
        "content/blog/two.mdx": post(2, '```tsx\nimport { Other } from "@/components/other"\n```\n\nYou can import { Other } from "@/components/other" in prose.\n\n'),
        "content/blog/three.mdx": post(3),
        "content/blog/four.mdx": post(4),
        "app/page.tsx": "export default function P() { return null }\n",
      },
      (f) => {
        for (const n of ["one", "two", "three", "four"]) assert.ok(f.files[`content/blog/${n}.mdx`], `${n}.mdx is a kept file`);
        assert.equal(f.files["content/blog/one.mdx"].loc, 6, "prose lines count as LOC");
        assert.ok(ids(f, "area").includes("area:content/blog"), "4 posts make an area");
        assert.equal(f.files["content/blog/one.mdx"].area, "area:content/blog");
        assert.equal(fact(f, "area:content/blog").meta.fileCount, 4);
        assert.ok(fact(f, "area:content/blog").loc >= 20);
        assert.ok(hasImport(f, "content/blog/one.mdx", "components/callout.tsx"), "an ESM block is parsed like JS");
        assert.ok(!hasImport(f, "content/blog/two.mdx", "components/other.tsx"), "code fences and prose are not imports");
        assert.equal(f.files["content/blog/one.mdx"].gen, undefined, "long prose lines are not a minified bundle");
        assert.deepEqual(f.unresolved, {});
      },
    ));

  test("an .mdx page in the app folder is a screen", () =>
    withRepo(
      {
        "package.json": '{"name":"c","dependencies":{"next":"14"}}',
        "app/page.tsx": "export default function P() { return null }\n",
        "app/about/page.mdx": "# About\n\nHello.\n",
      },
      (f) => assert.deepEqual(ids(f, "screen"), ["screen:/", "screen:/about"]),
    ));
});

describe("sign-in through an outside company's OAuth provider (§2.5)", () => {
  const withRepo = async (spec, fn) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "scan-oauth-"));
    for (const [rel, text] of Object.entries(spec)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    }
    try {
      return await fn(await scanRepo(root));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

  test("next-auth and Auth.js providers are sign-in through that company; credentials, email and nodemailer are not", () =>
    withRepo(
      {
        "package.json": '{"name":"o","dependencies":{"next":"14","next-auth":"4"}}',
        "lib/auth.ts":
          'import NextAuth from "next-auth";\nimport GitHub from "next-auth/providers/github";\nimport Credentials from "next-auth/providers/credentials";\nimport Email from "next-auth/providers/email";\nexport const a = [NextAuth, GitHub, Credentials, Email];\n',
        "lib/auth2.ts": 'import Google from "@auth/core/providers/google";\nimport Nodemailer from "@auth/core/providers/nodemailer";\nimport type Discord from "next-auth/providers/discord";\nexport const b = [Google, Nodemailer];\n',
        "lib/plain.ts": 'import NextAuth from "next-auth";\nimport Creds from "next-auth/providers/credentials";\nexport const c = [NextAuth, Creds];\n',
      },
      (f) => {
        assert.deepEqual(ids(f, "service"), ["service:sign-in"]);
        assert.deepEqual(fact(f, "service:sign-in").meta.vendor, ["github", "google"], "type-only discord import is not wiring");
        assert.deepEqual(fact(f, "service:sign-in").files, ["lib/auth.ts", "lib/auth2.ts"]);
        assert.ok(hasUse(f, "lib/auth.ts", "service:sign-in", "package"));
        assert.ok(hasUse(f, "lib/auth2.ts", "service:sign-in", "package"));
        assert.ok(!hasUse(f, "lib/plain.ts", "service:sign-in", "package"), "next-auth alone is not an outside service");
      },
    ));

  test("every listed provider counts", () => {
    const providers = ["github", "google", "apple", "discord", "gitlab", "twitter", "facebook", "linkedin", "slack", "azure-ad", "auth0", "okta", "cognito", "keycloak"];
    const spec = { "package.json": '{"name":"o","dependencies":{"next-auth":"4"}}' };
    providers.forEach((p, i) => (spec[`p${i}.ts`] = `import P from "next-auth/providers/${p}";\nexport const x = P;\n`));
    return withRepo(spec, (f) => assert.deepEqual(fact(f, "service:sign-in").meta.vendor, [...providers].sort()));
  });
});

describe("a routes folder is Pages for screens and Requests for server routes (§2.5)", () => {
  const withRepo = async (spec, fn) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "scan-routes-"));
    for (const [rel, text] of Object.entries(spec)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    }
    try {
      return await fn(await scanRepo(root));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
  const page = "export default function P() { return null }\n";
  const names = (f) => Object.fromEntries(f.facts.filter((x) => x.kind === "area").map((x) => [x.id, x.name]));

  test("TanStack, SvelteKit and Remix route folders are Pages", async () => {
    await withRepo(
      {
        "package.json": '{"name":"t","dependencies":{"@tanstack/react-router":"1"}}',
        "src/routes/__root.tsx": page,
        "src/routes/index.tsx": page,
        "src/routes/items.tsx": page,
        "src/routes/login.tsx": page,
      },
      (f) => assert.equal(names(f)["area:src/routes"], "Pages"),
    );
    await withRepo(
      {
        "package.json": '{"name":"s","devDependencies":{"@sveltejs/kit":"2"}}',
        "src/routes/+page.svelte": "<p>hi</p>\n",
        "src/routes/about/+page.svelte": "<p>hi</p>\n",
        "src/routes/blog/+page.svelte": "<p>hi</p>\n",
        "src/routes/api/posts/+server.ts": "export const GET = () => new Response();\n",
      },
      (f) => {
        assert.equal(names(f)["area:src/routes"], "Pages");
      },
    );
    await withRepo(
      {
        "package.json": '{"name":"r","dependencies":{"@remix-run/react":"2"}}',
        "app/routes/_index.tsx": page,
        "app/routes/about.tsx": page,
        "app/routes/recipes.$id.tsx": page,
      },
      (f) => assert.equal(names(f)["area:app/routes"], "Pages"),
    );
  });

  test("a routes folder of components with no declared screens is still Pages; server route folders are Requests", async () => {
    await withRepo(
      {
        "package.json": '{"name":"spa","dependencies":{"react":"18"}}',
        "src/routes/Home.tsx": page,
        "src/routes/About.tsx": page,
        "src/routes/Contact.tsx": page,
      },
      (f) => assert.equal(names(f)["area:src/routes"], "Pages"),
    );
    await withRepo(
      {
        "package.json": '{"name":"e","dependencies":{"express":"4"}}',
        "src/server.js": 'const express = require("express");\nconst users = require("./routes/users");\nconst app = express();\napp.use("/api/users", users);\n',
        "src/routes/users.js": 'const router = require("express").Router();\nrouter.get("/", (req, res) => {});\nrouter.post("/", (req, res) => {});\nmodule.exports = router;\n',
        "src/routes/orders.js": 'const router = require("express").Router();\nrouter.get("/orders", (req, res) => {});\nmodule.exports = router;\n',
        "src/routes/health.js": 'const router = require("express").Router();\nrouter.get("/health", (req, res) => {});\nmodule.exports = router;\n',
      },
      (f) => assert.equal(names(f)["area:src/routes"], "Requests"),
    );
    // the shared map keeps "routes/api" and a bare routes folder on the server side by default
    assert.equal(plainAreaName("routes/api", "x"), "Requests");
    assert.equal(plainAreaName("src/routes", "x"), "Requests");
    assert.equal(plainAreaName("src/routes", "x", "pages"), "Pages");
    assert.equal(plainAreaName("src/routes", "x", () => "pages"), "Pages");
    assert.equal(plainAreaName("backend/app/api/routes", "x", "requests"), "Requests");
  });

  test("the fastapi-svc fixture: frontend routes are Pages, backend routes stay Requests", () => {
    assert.equal(fact(fastapi, "area:frontend/src/routes").name, "Pages");
    assert.equal(fact(fastapi, "area:backend/app/api").name, "Requests");
    const draft = draftParts(fastapi);
    assert.ok(!draft.some((p) => p.role === "feature" && p.name === "Requests"));
  });
});

describe("draft names are plain English (never jargon, 16 characters at most)", () => {
  test("known folders map to plain words", () => {
    const cases = {
      components: "Screen pieces",
      "frontend/src/components": "Screen pieces",
      ui: "Look and feel",
      "components/ui": "Look and feel",
      "lib/utils": "Helpers",
      utils: "Helpers",
      lib: "Inner workings",
      hooks: "Screen behaviour",
      "routes/api": "Requests",
      "app/api": "Requests",
      "backend/app/api": "Requests",
      backend: "Back room",
      frontend: "Front room",
      config: "Settings",
      "app/(chat)": "Chat",
      "components/chat": "Chat",
      "components/ai-elements": "AI elements",
      "components/UserSettings": "User settings",
      "lib/billing": "Billing",
      "components/recipes": "Recipes",
      "src/features/weekly-plan": "Weekly plan",
    };
    for (const [dir, name] of Object.entries(cases)) assert.equal(plainAreaName(dir, "x"), name, dir);
  });

  test("jargon words inside folder names are replaced, and every result is short and clean", () => {
    const dirs = [
      "lib/api-client", "packages/module-loader", "components/endpoint-list", "app/backend-for-frontend", "tools/repo-sync", "src/webhooks",
      "frontend/src/components/Admin", "modules/payments-and-subscriptions-center", "lib/middleware", "db/schema", "x/deployment-checks", "pr-review", "lib/orm",
      "(marketing)", "[slug]", "weird_snake_case_folder_name_that_goes_on", "",
    ];
    for (const dir of dirs) {
      const name = plainAreaName(dir, "full-stack-fastapi-template");
      assert.ok(name.length >= 1 && name.length <= 16, `"${name}" for ${dir}`);
      assert.ok(!isJargon(name), `"${name}" for ${dir} has jargon`);
    }
    assert.equal(plainAreaName("lib/api-client", "x"), "Request client");
    assert.equal(plainAreaName("", "full-stack-fastapi-template"), "The whole app");
    assert.equal(plainAreaName("", "pantry"), "Pantry");
  });

  test("the checker's jargon list is mirrored", () => {
    for (const w of ["API", "apis", "SDK", "ORM", "REST", "GraphQL", "PR", "CI", "endpoint", "middleware", "webhook", "deploy", "frontend", "backend", "monorepo", "repository", "repo", "component", "Components", "module", "commit", "table", "schema"]) {
      assert.ok(isJargon(`The ${w} here`), w);
    }
    for (const w of ["Screen pieces", "Look and feel", "Requests", "Back room", "Saved records", "Outside services", "Runs on its own", "What you see"]) assert.ok(!isJargon(w), w);
  });

  test("area facts carry the same plain names, so chip names never read Ui, Components or Api (§2.5)", () => {
    const name = (f, id) => fact(f, id).name;
    assert.equal(name(recipe, "area:components"), "Screen pieces");
    assert.equal(name(recipe, "area:components/ui"), "Look and feel");
    assert.equal(name(recipe, "area:lib"), "Inner workings");
    assert.equal(name(recipe, "area:app/api"), "Requests");
    assert.equal(name(recipe, "area:app"), "Main app");
    assert.equal(name(recipe, "area:.") , "Recipe", "the repo name is an ordinary word");
    // ordinary product words are unchanged
    assert.equal(name(recipe, "area:components/recipes"), "Recipes");
    assert.equal(name(recipe, "area:lib/recipes"), "Recipes");
    assert.equal(name(recipe, "area:lib/plan"), "Plan");
    assert.equal(name(recipe, "area:lib/ai"), "AI features");
    assert.equal(name(fastapi, "area:backend"), "Back room");
    assert.equal(name(fastapi, "area:frontend"), "Front room");
    assert.equal(name(fastapi, "area:frontend/src/components"), "Screen pieces");
    assert.equal(name(fastapi, "area:backend/app/api"), "Requests");
    assert.equal(name(fastapi, "area:frontend/src/routes"), "Pages", "a routes folder of screens is Pages");
    for (const f of [recipe, fastapi, empty]) {
      for (const a of f.facts.filter((x) => x.kind === "area")) {
        assert.ok(a.name.length >= 1 && a.name.length <= 16 && !isJargon(a.name), `${a.id}: "${a.name}"`);
        const dir = a.id === "area:." ? "" : a.id.slice(5);
        const hint = /(^|\/)routes$/.test(dir) ? (f === fastapi && dir.startsWith("frontend") ? "pages" : "requests") : undefined;
        assert.equal(a.name, plainAreaName(dir, f.repo.name, hint), `${a.id} uses the shared map`);
      }
    }
    assert.match(showFacts(recipe), /area:components\/ui {2,}Look and feel/);
  });

  test("every drafted part of every fixture is plain", () => {
    for (const f of [recipe, fastapi]) {
      for (const p of draftParts(f)) {
        assert.ok(p.name.length <= 16 && !isJargon(p.name) && !isJargon(p.line), `${p.name}: ${p.line}`);
      }
    }
    const names = draftParts(fastapi).map((p) => p.name);
    assert.ok(names.includes("Screen pieces"), "frontend components are not called Components");
    assert.ok(!names.includes("Components"));
    assert.ok(!names.some((n) => /^Behind the screens$/.test(n)), "no 18-character placeholder");
  });
});

describe("real-world edges", () => {
  const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), "scan-edge-"));
  const write = (root, rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };

  test("huge, binary and garbage files never throw", async () => {
    const root = mk();
    try {
      write(root, "package.json", JSON.stringify({ name: "edge", dependencies: { next: "14.0.0" } }));
      write(root, "app/page.tsx", 'import x from "./missing";\nexport default function P(){ return <p>{`${`unterminated`}</p> }\n');
      write(root, "app/big.ts", "export const x = 1;\n".repeat(40000));
      fs.writeFileSync(path.join(root, "app/blob.ts"), Buffer.from([0, 1, 2, 3, 0, 255]));
      write(root, "app/broken.py", 'def (:\n  from . import\nimport\n"""never closed\n');
      write(root, "app/layout.tsx", "export default function L(){ return null }\n");
      write(root, "node_modules/pkg/index.js", "module.exports = 1;\n");
      const facts = await scanRepo(root);
      assert.ok(facts.files["app/page.tsx"]);
      assert.ok(!facts.files["app/big.ts"], "over 512 KB is skipped");
      assert.ok(!facts.files["app/blob.ts"], "binary is skipped");
      assert.ok(!Object.keys(facts.files).some((f) => f.startsWith("node_modules")));
      assert.deepEqual(ids(facts, "screen"), ["screen:/"]);
      assert.equal(facts.unresolved["./missing"], 1, "unresolved relative imports are counted");
      assert.equal(facts.hash, factsHash(facts));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("inside a git work tree the listing follows .gitignore", async (t) => {
    try {
      execFileSync("git", ["--version"], { stdio: "ignore" });
    } catch {
      return t.skip("git not available");
    }
    const root = mk();
    try {
      write(root, "package.json", JSON.stringify({ name: "g", dependencies: { next: "14.0.0" } }));
      write(root, ".gitignore", "ignored/\n");
      write(root, "app/page.tsx", "export default function P(){ return null }\n");
      write(root, "app/ignored-page/page.tsx", "export default function Q(){ return null }\n");
      write(root, "ignored/app/page.tsx", "export default function R(){ return null }\n");
      execFileSync("git", ["init", "-q"], { cwd: root });
      const facts = await scanRepo(root);
      assert.ok(!Object.keys(facts.files).some((f) => f.startsWith("ignored/")), "ignored/ is left out");
      assert.ok(facts.files["app/page.tsx"]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Git helpers for the next tests: a throwaway repo with a fixed identity and no signing.
  const haveGit = () => {
    try {
      execFileSync("git", ["--version"], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  };
  const git = (cwd, ...args) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { cwd, stdio: "pipe" });
  const commitAll = (root) => {
    git(root, "init", "-q");
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "init");
  };

  test("useGit:false walks a git work tree: the same facts as git mode on a clean commit", async (t) => {
    if (!haveGit()) return t.skip("git not available");
    const root = mk();
    try {
      const dir = path.join(root, "recipe"); // the folder name is the repo name, so both scans must agree on it
      fs.cpSync(path.join(FIX, "recipe"), dir, { recursive: true });
      commitAll(dir);
      const viaGit = scanRepoDetailed(dir);
      const walked = scanRepoDetailed(dir, { useGit: false });
      assert.equal(viaGit.diag.git, true);
      assert.equal(walked.diag.git, false, "the flag reaches listFiles");
      assert.equal(stableStringify(walked.facts, 1), stableStringify(viaGit.facts, 1));
      assert.equal(stableStringify(await scanRepo(dir, { useGit: false }), 1), stableStringify(walked.facts, 1), "scanRepo forwards the option");
      // the two modes differ only where git knows more than the disk: an ignored folder is walked, not listed
      write(dir, ".gitignore", "ignored/\n");
      write(dir, "ignored/lib/extra.ts", "export const extra = 1;\n");
      assert.ok(!(await scanRepo(dir)).files["ignored/lib/extra.ts"], "git mode follows .gitignore");
      assert.ok((await scanRepo(dir, { useGit: false })).files["ignored/lib/extra.ts"], "walk mode does not");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("git mode lists what is on disk: a tracked file deleted without staging leaves no ghost path", async (t) => {
    if (!haveGit()) return t.skip("git not available");
    const root = mk();
    try {
      write(root, "package.json", JSON.stringify({ name: "g", dependencies: { next: "14.0.0" } }));
      write(root, "app/page.tsx", 'import { gone } from "../lib/gone";\nimport { kept } from "../lib/kept";\nexport default function P(){ return gone + kept }\n');
      write(root, "lib/gone.ts", "export const gone = 1;\n");
      write(root, "lib/kept.ts", "export const kept = 1;\n");
      write(root, "lib/staged-away.ts", "export const s = 1;\n");
      commitAll(root);
      const clean = await scanRepo(root);
      assert.ok(clean.files["lib/gone.ts"] && hasImport(clean, "app/page.tsx", "lib/gone.ts"));

      fs.rmSync(path.join(root, "lib/gone.ts")); // deleted on disk, still in the index
      git(root, "rm", "-q", "lib/staged-away.ts"); // deleted and staged
      write(root, "lib/fresh.ts", "export const fresh = 1;\n"); // untracked
      const { paths, git: viaGit } = listFiles(root);
      assert.equal(viaGit, true);
      assert.ok(!paths.includes("lib/gone.ts"), "unstaged deletion is not listed");
      assert.ok(!paths.includes("lib/staged-away.ts"));
      assert.ok(paths.includes("lib/fresh.ts") && paths.includes("lib/kept.ts"));
      assert.deepEqual(paths, listFiles(root, { useGit: false }).paths, "git mode now agrees with the disk");

      const facts = await scanRepo(root);
      assert.ok(!facts.files["lib/gone.ts"]);
      assert.ok(!hasImport(facts, "app/page.tsx", "lib/gone.ts"));
      assert.ok(hasImport(facts, "app/page.tsx", "lib/kept.ts"));
      assert.equal(facts.unresolved["../lib/gone"], 1, "an import of the deleted file is unresolved, not silently 'excluded'");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("outputInsideRepo: refuses the repo itself, its subfolders and a symlinked way in; allows the rest", (t) => {
    const root = mk();
    try {
      const repo = path.join(root, "repo");
      fs.mkdirSync(path.join(repo, "sub"), { recursive: true });
      assert.match(outputInsideRepo(path.join(repo, "facts.json"), repo), /^--out .* is inside the scanned repo; the scanner never writes there\. Pick a path outside /);
      assert.ok(outputInsideRepo(path.join(repo, "sub", "x", "facts.json"), repo), "a folder that does not exist yet");
      assert.ok(outputInsideRepo(path.join(repo, "sub", "..", "facts.json"), repo), "dot-dot is resolved");
      assert.equal(outputInsideRepo(path.join(root, "facts.json"), repo), null);
      assert.equal(outputInsideRepo(path.join(root, "repo-facts.json"), repo), null, "a sibling with the same prefix is outside");
      assert.match(outputInsideRepo(path.join(repo, "o.html"), repo, { flag: "--html", shown: "my-app" }), /^--html .* outside my-app$/);
      try {
        fs.symlinkSync(path.join(repo, "sub"), path.join(root, "link"), "dir");
      } catch {
        return t.skip("cannot create symlinks here");
      }
      assert.ok(outputInsideRepo(path.join(root, "link", "facts.json"), repo), "through a symlink into the repo");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("monorepo: the same screen path in two packages gets #package suffixes; workspace imports resolve", async () => {
    const root = mk();
    try {
      write(root, "package.json", JSON.stringify({ name: "mono", private: true, workspaces: ["apps/*", "packages/*"] }));
      for (const app of ["web", "admin"]) {
        write(root, `apps/${app}/package.json`, JSON.stringify({ name: app, dependencies: { next: "14.0.0", "@mono/ui": "*" } }));
        write(root, `apps/${app}/app/page.tsx`, 'import { Button } from "@mono/ui/button";\nexport default function P(){ return <Button/> }\n');
      }
      write(root, "packages/ui/package.json", JSON.stringify({ name: "@mono/ui" }));
      write(root, "packages/ui/src/button.tsx", "export function Button(){ return null }\n");
      const facts = await scanRepo(root);
      assert.deepEqual(ids(facts, "screen"), ["screen:/#apps/admin", "screen:/#apps/web"]);
      assert.deepEqual(facts.repo.packages, ["apps/admin", "apps/web", "packages/ui"]);
      assert.ok(hasImport(facts, "apps/web/app/page.tsx", "packages/ui/src/button.tsx"));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
