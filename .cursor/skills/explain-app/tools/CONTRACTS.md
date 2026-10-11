# Page 3 contracts: facts, parts, wiring, drawing

Page 3 draws **this repo's real parts and real wiring**. Four pieces cooperate, and this file is the only agreement between them. If code and this file disagree, fix the code, or change this file first and say so.

```
repo ──scan──▶ <repo>-facts.json ──agent writes PARTS──▶ wire ──▶ WIRING block ──▶ canvas draws it
```

| Piece | File(s) | Job |
|---|---|---|
| Scanner | `tools/scan.mjs` (dispatcher), `tools/lib/scan/*.mjs` | Repo → `facts.json`. Deterministic, no new dependencies, no LLM |
| Wiring | `tools/lib/wire.mjs` | facts + `PARTS` → `WIRING` (counts, sizes, links). Also `why` |
| Drawing | `exploded-view-starter.md` (the TSX starter) | `PARTS` + `WIRING` → isometric drawing, labels, interaction |
| Checker | `tools/lib/inspect.js`, `tools/poster.mjs` | Verifies hashes, re-runs `wire`, measures the DOM contract |

Shared helpers live in `tools/lib/hash.mjs`: `stableStringify`, `factsHash`, `fnv1a`, `partsHash`. Use them; don't re-implement.

---

## 1. CLI

All commands run from the skill directory.

```bash
node tools/scan.mjs scan  <repo-dir> --out <canvases>/<repo>-facts.json   # writes facts.json, prints a one-line summary
node tools/scan.mjs show  <facts.json>                                     # human summary for the agent (see §2.6)
node tools/scan.mjs draft <facts.json>                                     # prints a suggested PARTS array (valid JSON)
node tools/scan.mjs wire  <facts.json> --into <canvas.tsx>                 # rewrites the WIRING block; errors → exit 1
node tools/scan.mjs why   <facts.json> --canvas <canvas.tsx> "<part A>" "<part B>"   # prints one witness path for a link
```

- `tools/scan.mjs` owns argument parsing for `scan`, `show` and `draft`. It forwards `wire` and `why` to `tools/lib/wire.mjs`, which exports `wireMain(argv: string[]): Promise<number>` and `whyMain(argv: string[]): Promise<number>`; the return value is the exit code.
- Exit codes: 0 ok (warnings go to stderr, prefixed `! `), 1 rule error (`✗ ` lines on stderr), 2 usage.
- The scanner never writes inside the scanned repo.

---

## 2. `facts.json` (scanner output)

Written with `stableStringify(obj, 1)`, so two scans of the same tree are byte-identical. There are no timestamps and no absolute paths. All paths are repo-relative POSIX paths.

```ts
type FactsFile = {
  version: 1;
  hash: string;                  // factsHash(file) — first 12 hex of sha256 over canonical JSON without "hash"
  empty: boolean;                // true when there are no screen/endpoint/table/service/ai/job facts
  repo: { name: string; packages: string[] };  // name = repo dir basename; packages = app roots (".", "apps/web", "backend", …), sorted
  facts: Fact[];                 // sorted by id, ids unique
  files: Record<string, FileInfo>;             // every kept source file
  imports: [string, string][];   // [fromFile, toFile], both keys of `files`, deduped, sorted
  uses: [string, string, "package" | "http" | "orm"][];  // [file, factId, via], deduped, sorted
  unresolved: Record<string, number>;          // internal-looking specifiers that didn't resolve → count (diagnostics only)
};
type FileInfo = {
  area: string;                  // id of the deepest area fact containing the file
  loc: number;                   // non-blank lines
  gen?: 1;                       // generated: excluded from LOC totals and kit detection, but still walkable
  kit?: 1;                       // shared plumbing (see §2.4): never owned for linking, never walked through
  data?: 1;                      // imports a database client runtime (see §2.3)
  defines?: string[];            // ids of screen/endpoint/table/job facts defined in this file, sorted
};
type Kind = "screen" | "endpoint" | "table" | "service" | "ai" | "job" | "area";
type Fact = {
  id: string;                    // see §2.1
  kind: Kind;
  name: string;                  // friendly name (§2.5)
  files: string[];               // sorted. screen/endpoint/table/job: defining files. service/ai: files importing the SDK (evidence only). area: [] (use the dir)
  loc?: number;                  // area only: LOC of the subtree, excluding gen files
  meta?: {
    methods?: string[];          // endpoint: ["DELETE","GET",…] sorted
    vendor?: string[];           // service/ai: package-derived vendor keys, e.g. ["stripe"]
    schedule?: string;           // job: cron string when known
    leaf?: boolean;              // area: a good "one part" granularity (§2.2)
    fileCount?: number;          // area: kept source files in subtree
    tools?: number;              // ai: number of AI tool definitions found (e.g. `tool({` in files importing the AI SDK)
    package?: string;            // which package (app root) the fact belongs to
  };
};
```

### 2.1 Fact ids

| kind | id | Notes |
|---|---|---|
| screen | `screen:/recipes/[id]` | URL path. Route groups `(x)` removed, dynamic segments written `[name]`, catch-all `[...name]`, root `/`. A collision across packages gets `#<package>` appended |
| endpoint | `endpoint:/api/recipes/[id]` | `:id`, `{id}`, `$id` and `<id>` are all written `[id]`. tRPC procedures: `endpoint:/trpc/<router>.<procedure>` |
| table | `table:Recipe` | As declared: Prisma model, Drizzle table string, SQLModel/SQLAlchemy/Django class, SQL table. De-duplicated case-insensitively; model names win over migrations |
| service | `service:payments` | Named by capability (§2.5). Vendors go in `meta.vendor` |
| ai | `ai:openai` | Provider key. If only the generic `ai` SDK is present with no provider package: `ai:ai-sdk` |
| job | `job:/api/cron/weekly-plan`, `job:send-digest` | Cron path, or function or task id. **A cron target is a job, not also an endpoint** |
| area | `area:lib/ai`, `area:.` | A directory. Citing an area covers its whole subtree |

### 2.2 Areas

- **Kept files:** source extensions only (`.ts .tsx .js .jsx .mjs .cjs .mts .cts .vue .svelte .astro .py .go .rb .rs .php .java .kt .swift .sql .prisma .mdx`). `.mdx` is app content (blog posts, docs pages): it counts toward areas and LOC, so a content folder can become a feature part, and its `import` lines are parsed like JS.
- **Excluded:**
  - `node_modules .git dist build out .next .nuxt .svelte-kit .turbo .vercel coverage vendor venv .venv __pycache__`
  - tests: `*.test.* *.spec.* __tests__/ tests/ test/ e2e/ cypress/ playwright/`
  - `*.config.*`, `*.d.ts` (treat as gen if kept), `public/`, `static/`, `assets/`
- **File listing:** `git ls-files -co --exclude-standard` when the dir is a git work tree; otherwise walk the dir.
- **Emitted areas:** one area fact for every directory with kept files in its subtree, and `area:.` for the repo root.
  - **Merge rule:** a directory with < 3 kept files **and** < 100 LOC is merged into its parent. No fact is emitted, and its files report the parent's area.
  - **Depth cap:** at most 3 levels below a package's source base (`<pkg>/src` if it exists, else `<pkg>`). Deeper dirs merge into the level-3 ancestor.
- **`meta.leaf = true`** marks the "balanced" split, the level `draft` should cite:
  - Start at each package's source base. Descend into a dir's children when that dir holds > 20% of the package's LOC **and** has ≥ 2 child areas with ≥ 3 files each. Route trees (`app/`, `pages/`, `src/routes/`) descend one level, so route groups like `app/(chat)` become leaves.
  - Where descent stops, the area is a leaf.

### 2.3 Imports and uses

- **imports:**
  - Parse with regex: `import … from`, `export … from`, `import(…)`, `require(…)`, and Python `import x` / `from x import y` (relative dots too).
  - **Type-only imports are not wiring.** Skip `import type …`, `export type … from`, and imports whose every named specifier is `type X`. Also skip Python imports under `if TYPE_CHECKING:`. Nothing runs through them, so they would draw false cables (e.g. UI files that only import a database row's *type*).
  - Resolve relative specifiers and tsconfig/jsconfig `compilerOptions.paths` (per package, honouring `baseUrl`), plus Python package-relative modules.
  - Try extensions `.ts .tsx .js .jsx .mjs .cjs .vue .svelte .py` and `/index.*` / `__init__.py`.
  - Specifiers that look internal but don't resolve are counted in `unresolved`. Bare package specifiers are not imports; they may be `uses`.
- **uses `package`:** a file imports a package mapped to a service or AI fact (§2.5). Entry: `[file, service:x | ai:y, "package"]`.
- **uses `http`:**
  - A string or template literal starting with `/` that, after normalisation, segment-suffix-matches an endpoint path. Either side may be the suffix; the shorter one must have ≥ 1 static segment.
  - Normalisation: params become `*`, query strings and trailing slashes are dropped.
  - Entry: `[file, endpoint:…, "http"]`.
- **uses `orm`:** a Prisma-style accessor `\b(prisma|db)\.(\w+)\.(findMany|findUnique|findFirst|create|update|upsert|delete|count|aggregate|groupBy)\b` whose accessor matches a table name case-insensitively. Entry: `[file, table:X, "orm"]`.
- **data flag:** set when the file imports a DB client runtime: `@prisma/client`, `drizzle-orm*`, `mongoose`, `@supabase/supabase-js`, `kysely`, `pg`, `mysql2`, `better-sqlite3`, `sqlmodel`, `sqlalchemy`, `django.db`, `peewee`, `tortoise`, `motor`, `pymongo`.

### 2.4 Kit files

A file is `kit` when it defines no fact **and** is imported from at least `max(4, ceil(0.25 × A))` distinct areas, where A is the number of distinct areas that contain at least one importing file. Typical kit files: `components/ui/*`, `lib/utils`. Kit files keep `components/` from wiring everything to everything.

### 2.5 Friendly names and the service / AI map

- **Screens and endpoints:** the last static segment, title-cased (`/recipes/[id]` → "Recipe detail", `/` → "Home", `/settings/billing` → "Billing").
- **Tables:** split camel case and underscores, strip `_v\d+` (`Message_v2` → "Message").
- **Areas:** basename title-cased, with route-group parentheses removed.
- **Services:** the capability name. **AI:** the provider name.

| service id | name | packages (JS / Python) |
|---|---|---|
| `service:payments` | Payments | stripe, @stripe/*, @lemonsqueezy/*, paddle* / stripe |
| `service:email` | Email | resend, @sendgrid/*, postmark, nodemailer, mailgun* / sendgrid, emails, fastapi-mail (template-only packages like `@react-email/*` are **not** a service) |
| `service:sign-in` | Sign-in | **hosted sign-in companies only**: @clerk/*, @auth0/*, @workos-inc/*, @stytch/*, @kinde-oss/*, @supabase/auth-helpers-*, @supabase/ssr, firebase/auth, @okta/* / auth0-python, firebase-admin. Sign-in libraries that run inside the app (next-auth, @auth/*, lucia, better-auth, passlib, pwdlib, pyjwt, python-jose, authlib) are **not** outside services |
| `service:file-storage` | File storage | @aws-sdk/client-s3, @vercel/blob, uploadthing, @uploadthing/*, cloudinary / boto3 |
| `service:analytics` | Analytics | posthog-js, posthog-node, @vercel/analytics, mixpanel*, @segment/* / posthog |
| `service:error-alerts` | Error alerts | @sentry/* / sentry-sdk |
| `service:fast-cache` | Fast cache | redis, ioredis, @upstash/redis, @vercel/kv / redis |
| `service:live-updates` | Live updates | pusher, pusher-js, ably, @liveblocks/*, socket.io* |
| `service:text-messages` | Text messages | twilio / twilio |
| `service:search` | Search | algoliasearch, meilisearch, @elastic/* / elasticsearch, meilisearch |
| `service:maps` | Maps | mapbox-gl, @googlemaps/*, leaflet |

| ai id | name | packages |
|---|---|---|
| `ai:openai` | OpenAI | openai, @ai-sdk/openai / openai |
| `ai:anthropic` | Anthropic | @anthropic-ai/sdk, @ai-sdk/anthropic / anthropic |
| `ai:google` | Google AI | @google/generative-ai, @google/genai, @ai-sdk/google / google-generativeai, google-genai |
| `ai:mistral`, `ai:groq`, `ai:xai`, `ai:cohere`, `ai:replicate`, `ai:ollama` | (provider) | matching `@ai-sdk/*` or vendor package |
| `ai:gateway` | AI gateway | @ai-sdk/gateway |
| `ai:ai-sdk` | AI model | `ai` with no provider package; also langchain / llamaindex with no provider |

### 2.6 `show` output (for the agent; plain text)

Show, in this order:
- packages
- counts per kind
- screens grouped by first segment
- endpoints grouped the same way
- tables
- services with vendors
- AI providers and tool counts
- jobs with schedules
- the leaf areas with LOC and share of total
- kit files
- the top 15 cross-area import pairs

---

## 3. Canvas blocks (in `<repo>-exploded-view.canvas.tsx`)

Two marked blocks. Code outside them is the starter and is never generated.

```ts
// PARTS:BEGIN — you write this (valid JSON). Then run: node tools/scan.mjs wire <facts.json> --into <this file>
const PARTS: PartSpec[] = [
  {"name": "What you see", "role": "screens", "line": "When you open Pantry, you move between six screens.", "from": ["screen:**"]}
];
// PARTS:END
// WIRING:BEGIN — generated by `node tools/scan.mjs wire`; do not edit
const WIRING: Wiring = {"facts":"…","parts":"…","n":[…],"links":[…]};
// WIRING:END
```

- **Parsing:** the text after `const PARTS: PartSpec[] = ` up to the last `;` before `// PARTS:END` is `JSON.parse`d. `WIRING` is parsed the same way. `wire --into` replaces only the WIRING line(s) and keeps everything else byte-identical.
- If the WIRING block is missing, `wire --into` inserts it straight after `// PARTS:END`.

```ts
type Role = "screens" | "api" | "feature" | "ai" | "jobs" | "data" | "service";
type PartSpec = { name: string; role: Role; line: string; from: string[]; detail?: string };
// detail: optional plain-English replacement for the caption's "Made of: …" list (≤ 120 chars). Use it when the scanned item names (folder or route names) wouldn't mean anything to a reader. Like name and line, it is not part of the parts hash.
type PartWiring = {
  count: number;     // true number of items (role table §4)
  drawn: number;     // min(count, cap)
  items: number[];   // length === drawn; relative weight 0–1 per drawn item (LOC share where meaningful, else 1). When count > cap the LAST item is the bundle
  size: number;      // 0–1: owned LOC / total non-gen LOC (feature parts use it for footprint and height)
  loc: number;       // owned LOC
  names: string[];   // ≤ 12 friendly item names, in item order, for the caption
  tools?: number;    // ai only: tool count (drawn as satellites, cap 6)
};
type Wiring = {
  facts: string;                        // facts.json hash
  parts: string;                        // partsHash(PARTS)
  n: PartWiring[];                      // index-aligned with PARTS
  links: [number, number, number][];    // [a, b, weight], a < b, sorted by a then b; no self-links
};
```

- The canvas checks `fnv1a(JSON.stringify(PARTS.map(p => [p.role, p.from]))) === WIRING.parts` and `WIRING.n.length === PARTS.length`. On a mismatch it throws `PARTS changed — re-run wire`. Names and lines may change freely.

### 3.1 Part rules (enforced by `wire`, mirrored by the canvas where cheap)

**Limits:**
- **2–9 parts.** 2 is a warning; 1, or 10+, is an error: `"<n> parts — use 2 to 9"`.
- `name` is ≤ 18 characters (`"Part name "<name>" is <n> characters — 18 at most"`).
- `line` is one sentence.

**Glob rules for `from`:**
- A pattern matches a **whole** id. `*` = `[^/]*`, `**` = `.*`, and a leading `!` excludes.
- Patterns apply in order: positives add matches, `!` patterns remove them.
- Every positive pattern must match ≥ 1 fact. Otherwise: `"Part "<name>": "<pattern>" matches nothing — did you mean <id>, <id>?"` (the 3 nearest ids by edit distance).

**Kinds per role:**
- A non-area match must be the role's kind: screens→screen, api→endpoint, data→table, service→service, ai→ai, jobs→job.
- `feature` parts cite **only** `area:` facts.
- Any role may additionally cite `area:` facts. These change file ownership, never counts, except for feature.
- Otherwise: `"Part "<name>": "<pattern>" matches <kind> facts — a <role> part counts only <kind> (plus area: for ownership)"`.

**No double citations:**
- A non-area fact may be cited by only one part: `"<id> is cited by both "<a>" and "<b>""`.
- The same area id may not be cited twice. Nested areas are allowed; the deepest one wins.

**Counts:** a non-feature part whose count is 0 is an error: `"<role> part "<name>" counts nothing"`.

### 3.2 File ownership

Decided per file, in this order:
1. **Defines a cited fact.** The file is in `files` of a cited screen, endpoint, table or job fact, so it belongs to that part. If facts cited by several parts live in one file, the part with the most such facts wins; ties go to the lower index. *service and ai facts never confer ownership*: their `files` are evidence.
2. **Deepest cited area.** The file is under a cited area's directory; the longest dir wins.
3. **Data file.** The file has `data: 1` and there is exactly one `data` part.
4. Otherwise it is **unowned**.

Kit files may be owned, but they are never a link source or target and are never walked through.

### 3.3 Links

For every owned, non-kit file `f` (owner `p`), walk breadth-first:
- **Edges:** `imports`, plus `http` uses to an endpoint **not cited by any part**, followed into that endpoint's defining files. The walk runs ≤ 3 hops and **stops** at the first owned file on a branch. It never enters kit files.
- **Targets found from `f` or any unowned file reached:**
  - an owned file of another part `q` gives `(p,q)` with witness `(f, file)`
  - each `uses` entry of `f` or of an unowned file reached, whose fact is cited by part `q`, gives `(p,q)` with witness `(f, factId)`. This covers `package`, `orm` and `http` to cited endpoints.
- **Weight:** the number of distinct **source files** that reach the other part, counted in both directions: |{f ∈ p reaching q}| + |{g ∈ q reaching p}|. It is not the number of witnesses, so one file importing a generated client that lists 15 endpoints counts once, not 15 times. Witnesses are still kept (for `why`). Self-links are dropped.
- **Warnings:**
  - a part with no links: `"! "<name>" has no links"`
  - uncited facts: `"! Not drawn: Payments (service), 2 tables, …"` for uncited service, ai, job, table and screen facts

`why` prints one shortest witness chain per direction, e.g. `app/(app)/recipes/page.tsx → components/recipes/list.tsx → lib/recipes/query.ts` or `lib/billing.ts ─uses→ service:payments`.

### 3.4 Counts per role

The canvas never recounts.

| role | count = | items weight | names | cap |
|---|---|---|---|---|
| screens | cited screen facts | 1 each | friendly screen names | 12 |
| api | cited endpoint facts | 1 each | friendly endpoint names | 16 |
| feature | 1 cited area → its direct child area facts **plus** one chip for the area's own files outside those children (named after the area, only if they have LOC), skipping children removed by `!area:` patterns; several areas → those areas | LOC share among chips | area names | 6 |
| ai | cited ai facts | 1 each | provider names (`tools` = Σ meta.tools) | 4 |
| jobs | cited job facts | 1 each | job names | 4 |

`names` are de-duplicated (first occurrence kept). For example, two chips both called "Recipes", from `lib/recipes` and `components/recipes`, are listed once. Counts are not affected.
| data | cited table facts | 1 each | table names | 10 |
| service | cited service facts | 1 each | service names | 6 |

When count > cap: `drawn = cap`. The first cap − 1 items are real, the last is the bundle with weight 1, and `names` still lists up to 12 real names.

---

## 4. Drawing (the starter)

### Role → shape

Each drawn unit is an element with `data-item`.

| role | shape | units |
|---|---|---|
| screens | portrait cards standing in a shallow tray, fanned in a row | one card per drawn item |
| api | low patch-panel slab with sockets in rows of 4 | one socket per drawn item |
| feature | block (footprint `0.6 + 0.4·√size` of the slot, height `12 + 32·√size`) with chips on top | one chip per drawn item, packed 3×2 |
| ai | hexagonal prism; small satellites ring it, one per tool (cap 6) | one facet mark per provider |
| jobs | meshed flat gears | one gear per drawn item |
| data | cylinder: a stack of disks | one disk per drawn item |
| service | plug block with prongs | one prong per drawn item |

### Tiers

| Tier | Roles |
|---|---|
| T0 (top) | screens, api |
| T1 | feature |
| T2 | ai, jobs |
| T3 (bottom) | data, service |

- Empty tiers are dropped. T2 merges into T1 when T1 + T2 ≤ 4 parts.
- A tier with more than 4 parts throws `Tier with <n> parts — merge parts (4 per tier at most)`.
- **Ordering within a tier:** 4 barycenter sweeps on link weights, then brute-force column assignment minimising Σ weight·|Δcolumn| against tiers already placed. Ties go to the centre.

### Slots and gaps

- **Slots:** K is the largest tier size. Slot pitch is P = 592 / K, and the half-size is a = min(64, (P − 24) / 3.46). Footprint = a × role factor.
- **Gaps:** the gap between tiers is `8 + (gOpen − 8) · open / 100`, with gOpen = 2a + 8.
- **Fit:** fitted once at open = 100: s = min(1, 592/w, 640/h). s < 0.6 throws.
- **Height:** VBH = ⌈(h·s + 64) / 8⌉·8 ≤ 704, so the page never jumps.
- **Paint order** for each tier from the bottom up:
  1. same-tier arches
  2. the tier's parts
  3. cables from this tier up to the one above, plus skip-tier cables starting here (so they pass behind the middle parts)
  4. leaders, painted last

### Cables

- **Ends:** from the lower part's top face to the upper part's underside.
- **Curve:** a screen-space cubic with controls (x₁, y₁ − k) and (x₂, y₂ + k), k = 0.45·Δy.
- **Ports:** spread along the part's screen-horizontal diagonal, ordered by the far end's x.
- **Same-tier links:** arches between back corners, rising a + 16.
- **Strands:** 1 for weight 1–3, 2 for 4–15, 3 for 16+, 3 units apart.
- **Colour:** INK_SOFT at 0.75. When either end is selected: INK at 1.25. The lower port gets a paper ring, r 2.5.

### Labels

- **Gutters:** cols 1–2 on the left and cols 11–12 on the right. The drawing is in cols 3–10, 592 units.
- **Side:** a part goes left when its slot centre is left of the drawing centre. A centre slot goes to the side with fewer labels; ties go right.
- **Per-side y:** sort by desired y. A forward pass sets y = max(desired, prev + 40, PAD). On overflow, shift up and run a backward pass.
- **Leader path:** horizontal, then an elbow in the gutter, then a stub at the label's near edge.
- **Text:** line 1 is a folio, `01 — NAME`. Line 2 is a meta count phrase from the table below. **Never wraps.**

| role | line 2 |
|---|---|
| screens | `{n} screen(s)` |
| api | `Answers {n} kind(s) of request` |
| feature | `{pct}% of the code` |
| ai | `{n} AI model(s)` + ` · {t} tools` when tools > 0 |
| jobs | `Runs {n} job(s) on its own` |
| data | `{n} kind(s) of saved record` |
| service | `{n} outside service(s)` |

Role words such as API or endpoint never appear on the page.

### Selection and caption

- **Selection:** the selected part gets the TINT fill and an INK outline at 1.25, and its cables turn INK. Hover or click selects; the listbox handles ↑/↓/Home/End.
- **Caption (`aria-live`):** `02 / 07 — NAME`, then the part's `line`, then `Made of: a, b and N more`, then `Connected to: X, Y` (or `Not wired to the other parts`).

**Controls:** the slider ("Open layers"), the theme button, and Show grid. All interactive chrome sits in `[data-chrome]` except Show grid, as before.

---

## 5. DOM contract (checker ↔ drawing)

| Selector | Attributes |
|---|---|
| `figure` | `data-facts-hash`, `data-parts-hash` |
| `g[data-part]` | `data-part=i`, `data-role`, `data-count`, `data-drawn`; contains exactly one `[data-face="top"]` path and `drawn` × `[data-item]` |
| `path[data-link]` | `data-link=k`, `data-from-part=a`, `data-to-part=b`, `data-weight` (one element per link; extra strands carry `data-strand` and no `data-link`) |
| `polyline[data-leader]` | `data-leader=i`, `data-side="left"\|"right"`; first point on part i's top face, last point at the label's near edge |
| `[role=option][data-label]` | `data-label=i`, `data-side`; inside one `[role=listbox]`, `id="xv-part-<i>"`, `aria-selected` |
| caption | `[aria-live="polite"]` |
| state keys | `openExploded` (80), `partExploded` (0), `themeExploded` ("light"), `showGridExploded` (false) |

---

## 6. Fixtures

Under `tools/test/fixtures/`:

- **`recipe/`:** "Pantry", a Next.js app router app (package name `pantry`).
  - **screens:** `/`, `/recipes`, `/recipes/[id]`, `/recipes/new`, `/plan`, `/settings`, inside route group `app/(app)`
  - **endpoints:** `/api/recipes` (GET, POST), `/api/recipes/[id]` (GET, PATCH, DELETE), `/api/suggest` (POST)
  - **job:** cron `/api/cron/weekly-plan`, declared in `vercel.json`
  - **Prisma tables:** User, Recipe, Ingredient, MealPlan
  - **services:**
    - Stripe in `lib/billing.ts`
    - Resend in `lib/email.ts`
    - Clerk (`@clerk/nextjs`, a hosted sign-in company) in `lib/auth.ts`
  - **AI:** openai in `lib/ai/suggest.ts`, with 2 `tool({` definitions
  - **areas:**
    - `components/recipes`, `components/plan`
    - `components/ui` (kit: imported by ≥ 4 areas)
    - `lib/recipes`, `lib/plan`, `lib/ai`, `lib/db.ts` (imports `@prisma/client`)
  - **http:** the screens call `/api/recipes` and `/api/suggest` through fetch literals
  - Each named area dir (`components/recipes`, `components/plan`, `components/ui`, `lib/recipes`, `lib/plan`, `lib/ai`) has **≥ 3 source files**, so it survives the §2.2 merge rule. `prisma/` holds only `schema.prisma` and merges into `area:.`, which is fine because tables are owned through rule 1 of §3.2.
- **`fastapi-svc/`:** a FastAPI + SQLModel + Celery service with a small React (TanStack file routes) frontend in `frontend/`.
  - **tables:** User, Item
  - **endpoints:** ~8, using APIRouter prefixes
  - **jobs:** 1 Celery task
  - **services:** Email (`emails`), Error alerts (`sentry-sdk`)
- **`empty/`:** a README only. Scanning it gives `empty: true`.

**Recipe starter `PARTS`:** the page 3 starter ships these 7 parts, and its `WIRING` must equal a fresh `wire(scan(recipe), PARTS)`:

| Part | role | from |
|---|---|---|
| What you see | screens | `["screen:**"]` |
| Recipe box | feature | `["area:lib/recipes", "area:components/recipes"]` |
| Meal planner | feature | `["area:lib/plan", "area:components/plan"]` |
| Recipe ideas | ai | `["ai:*", "area:lib/ai"]` |
| Weekly email | jobs | `["job:**"]` |
| Saved recipes | data | `["table:*"]` |
| Outside services | service | `["service:*"]` |
