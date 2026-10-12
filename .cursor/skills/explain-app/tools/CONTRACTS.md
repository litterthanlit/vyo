# Contracts: facts, parts, wiring, drawing, changes

Page 3 draws **this repo's real parts and real wiring**. Four pieces cooperate, and this file is the only agreement between them. If code and this file disagree, fix the code, or change this file first and say so.

```
repo ──scan──▶ <repo>-facts.json ──agent writes PARTS──▶ wire ──▶ WIRING block ──▶ canvas draws it
                      │
two facts.json ──diff──▶ Changes (§7) ──▶ briefing doc ──▶ text / one-file HTML
```

The same `facts.json` also feeds the What-changed briefing (§7): two scans of one app, compared.

| Piece | File(s) | Job |
|---|---|---|
| Scanner | `tools/scan.mjs` (dispatcher), `tools/lib/scan/*.mjs` | Repo → `facts.json`. Deterministic, no new dependencies, no LLM. `lib/scan/io.mjs` reads a `facts.json` and refuses output inside the repo |
| Reach | `tools/lib/reach.mjs` | The link walker (§3.3): imports and http hops, at most 3 hops, kit never walked. Used by `wire` and by `diffFacts` |
| Wiring | `tools/lib/wire.mjs` | facts + `PARTS` → `WIRING` (counts, sizes, links). Also `why` |
| Drawing | `exploded-view-starter.md` (the TSX starter) | `PARTS` + `WIRING` → isometric drawing, labels, interaction |
| Checker | `tools/lib/inspect.js`, `tools/poster.mjs` | Verifies hashes, re-runs `wire`, measures the DOM contract |
| Changes | `tools/lib/changes.mjs` | Two `facts.json` → Changes v1 (§7). Pure: no I/O, no clock |
| Briefing | `tools/lib/briefing.mjs`, `tools/lib/briefing-html.mjs` | Changes → a plain-English document → text, or one offline HTML file |
| Git reader | `tools/lib/gitrev.mjs` | Resolves `--since` and reads an old commit out of git into a temp folder to scan |
| CLI | `tools/lib/changes-cli.mjs` | The `diff` and `changes` commands |

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
node tools/scan.mjs diff    <before.json> <after.json> [--out changes.json] [--json] [--canvas <canvas.tsx>] [--html <file>] [--receipts]
node tools/scan.mjs changes <repo> --since <commit|date|facts.json|empty> [same flags] [--save-facts <file>]
```

- `tools/scan.mjs` owns argument parsing for `scan`, `show` and `draft`. It forwards `wire` and `why` to `tools/lib/wire.mjs`, which exports `wireMain(argv: string[]): Promise<number>` and `whyMain(argv: string[]): Promise<number>`; the return value is the exit code. It forwards `diff` and `changes` the same way to `tools/lib/changes-cli.mjs` (`diffMain`, and `changesMain`<!-- verify: export name -->). A forwarded module that is not installed exits 2 with a message.
- Exit codes: 0 ok (warnings go to stderr, prefixed `! `), 1 rule error (`✗ ` lines on stderr), 2 usage. For `diff` and `changes`, 0 also means "worked, whatever it found": changes or none.
- The scanner never writes inside the scanned repo. `changes` refuses any `--out`, `--html` or `--save-facts` path inside `<repo>`. <!-- verify: what `diff` guards, since it is given no repo -->
- `changes` scans `<repo>` as it is now (uncommitted and untracked work included, so `--since HEAD` means "what did the agent just change"). `--since` is resolved in this order: `empty`/`none` (an empty baseline); a file that exists (read as a `facts.json`); a commit, tag or branch (`git rev-parse --verify --quiet X^{commit}`); a date (`git rev-list -1 --before=X HEAD`, a bare `YYYY-MM-DD` taken as `00:00:00`; with no earlier commit, the empty baseline plus a `first-save-after-date` note). A value starting with `-` or holding NUL is refused. A rev or date also errors on a non-git folder, a shallow clone, or a folder that is not the git top level (the message prints the top level). <!-- verify: against lib/gitrev.mjs and lib/changes-cli.mjs -->
- An old commit is read with `git ls-tree` and `git cat-file --batch` (never `git archive`, which honours `export-ignore`) into `mkdtemp(os.tmpdir()/explain-app-)/<basename of repo>`, scanned with `useGit: false`, and removed afterwards. Symlinks and submodules are skipped; blobs over 2 MiB become sparse files of the right size. Nothing is written in the repo or its `.git`.
- Other commands: `node tools/install.mjs [--cursor] [--claude] [--project <dir>] [--dry-run]` copies the skill where the hosts load it (exit 0/1/2). `node tools/poster.mjs export <files…> --html [--no-png] [--no-pdf]` writes each poster as one offline HTML file; with `--no-png --no-pdf` no browser starts. See [README.md](README.md).

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
- **File listing:** `git ls-files -co --exclude-standard` minus `git ls-files -d` (tracked files deleted in the work tree, so there are no ghost paths) when the dir is a git work tree; otherwise walk the dir. `scanRepo(dir, { useGit: false })` always walks, for a tree read out of a commit.
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
- **Areas:** the plain-English folder map `draft` uses (components → "Screen pieces", ui → "Look and feel", lib → "Inner workings", hooks → "Screen behaviour", api → "Requests", …), so jargon never reaches the poster through chip names. Anything not in the map: basename title-cased, with route-group parentheses removed and jargon words replaced.
- **Services:** the capability name. **AI:** the provider name.

| service id | name | packages (JS / Python) |
|---|---|---|
| `service:payments` | Payments | stripe, @stripe/*, @lemonsqueezy/*, paddle* / stripe |
| `service:email` | Email | resend, @sendgrid/*, postmark, nodemailer, mailgun* / sendgrid, emails, fastapi-mail (template-only packages like `@react-email/*` are **not** a service) |
| `service:sign-in` | Sign-in | **hosted sign-in companies only**: @clerk/*, @auth0/*, @workos-inc/*, @stytch/*, @kinde-oss/*, @supabase/auth-helpers-*, @supabase/ssr, firebase/auth, @okta/* / auth0-python, firebase-admin. Sign-in libraries that run inside the app (next-auth, @auth/*, lucia, better-auth, passlib, pwdlib, pyjwt, python-jose, authlib) are **not** outside services, but an OAuth provider they load is: a file importing `next-auth/providers/<p>` or `@auth/core/providers/<p>` for p in github, google, apple, discord, gitlab, twitter, facebook, linkedin, slack, azure-ad, auth0, okta, cognito, keycloak (not `credentials`, `email`, `nodemailer`) counts as sign-in through that company, `meta.vendor` = p |
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

The walk below is `tools/lib/reach.mjs` (`buildLinkGraph`, `makeView`, `walk`); `wire` calls it with `stopAt` = "is owned" and `skipEndpoint` = "is cited by a part". For every owned, non-kit file `f` (owner `p`), walk breadth-first:
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
- **Text:** line 1 is the number and name in sentence case, `01  Name` (10px, weight 600, tracking ≤ 0.02em, so an 18-character name fits the 130px gutter). Line 2 is a meta count phrase from the table below. **Never wraps.** Below ~880px figure width the labels become a numbered legend under the drawing.

| role | line 2 |
|---|---|
| screens | `{n} screen(s)` |
| api | `{n} kind(s) of request` |
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

---

## 7. Changes (diff output)

What changed between two scans of one app. `diffFacts` is pure: no I/O, no clock, no absolute paths, every list sorted, so the same two scans give the same bytes whatever order the inputs list their facts in. `lib/briefing.mjs` turns a Changes into plain English (§7.10).

```ts
diffFacts(before: FactsFile, after: FactsFile, opts?: {
  labels?: { before?: string; after?: string };      // plain-English names for the two sides
  parts?: PartSpec[];                                 // an already-parsed PARTS array (a poster's): adds `part` tags and `posters`
  wiringFactsHash?: string;                           // the facts hash the poster's WIRING block was drawn from (or labels.wiringFacts)
  notes?: { code: string; [k: string]: unknown }[];  // notes only the caller knows, e.g. { code: "first-save-after-date", date }
}): Changes
```

It throws if either side is not a facts file (`facts` and `files` are needed) or `version !== 1`. Areas are never compared as facts.

### 7.1 Shape

```ts
type CountKind = "screen" | "endpoint" | "table" | "service" | "ai" | "job";
type Changes = {
  version: 1;
  kind: "changes";
  before: Side;
  after: Side;
  same: boolean;          // the two facts.json have the same hash
  structural: boolean;    // any of added, removed, moved, changed, reach.gained, reach.lost, notOnScreen is non-empty
  counts: Record<CountKind, { before: number; after: number; added: number; removed: number }>;
  added: Item[];          // sorted by id
  removed: Item[];
  moved: { how: MoveHow; from: Item; to: Item }[];   // sorted by to.id
  changed: Change[];      // sorted by id, then type
  reach: { gained: Gained[]; lost: Lost[]; generated: boolean };
  notOnScreen: NotOnScreen[];
  worthALook: Look[];
  size: Size;
  notes: Note[];
  posters?: { stale: boolean; unwired: string[]; uncited: string[] };   // only when opts.parts was given
  hash: string;           // factsHash() of this object without "hash"
};
type Side = { hash: string; repo: string; empty: boolean; label?: string };
// hash: that scan's facts hash. repo: facts.repo.name (a string). empty: no screen, endpoint, table, service, AI or job.
// label: opts.labels, e.g. "your last saved version (a1b2c3d, 2026-10-07)" / "your files right now".
type Item = {
  id: string; kind: CountKind; name: string;
  files: string[];                                  // sorted
  meta?: { methods?: string[]; vendor?: string[]; schedule?: string; tools?: number; package?: string };  // the fact's meta, without empty values; lists sorted
  part?: string;                                    // opts.parts only: the poster part that cites it, else the one that owns one of its files
};
type Ref = { id: string; kind: CountKind; name: string; vendor?: string[] };   // a fact as another entry points at it
type MoveHow = "same-name" | "same-shape" | "same-slot" | "folded-name";
```

- `counts[kind].before` and `.after` count the facts of that kind in each scan. `.added` and `.removed` count the entries left in `added` and `removed` once moves are taken out. So `after − before = added − removed`, except across a move that changes kind (§7.2, `same-slot`).
- Briefing lines read these arrays and counts. Nothing is recounted from the facts.

### 7.2 Moves (pairing rules)

A removed fact is paired with an added one only when the match is **unique and 1:1**, and the kind is one the rule allows. Rules run in this order, each on what the earlier ones left. A pair goes in `moved` (not in `added` or `removed`); `how` says which rule.

| `how` | Kinds | Pairs when |
|---|---|---|
| `same-name` | everything except tables | Exactly one removed and one added share a kind and a friendly name. A screen whose address changed |
| `same-shape` | screen, endpoint, job | Every defining file belongs to that fact alone and is hand-written, and the removed and added facts have the same sorted file sizes (lines), the same imports out and the same uses out. A renamed folder |
| `same-slot` | endpoint, job (the two may pair across kinds) | In one file both scans have, exactly one endpoint or job went and exactly one arrived, and neither fact pairs with another file's. A route that gained a cron entry stops being an endpoint (§2.1) |
| `folded-name` | table | Same name once case, underscores and a plural are folded: `Recipe` → `Recipes`, `meal_plan` → `MealPlans` |

**Tables are never paired by the file they share.** Every Prisma model lives in one `schema.prisma`, so "Ingredient removed, Tag added, same file" would look like a rename and hide a loss of data. A table is paired only by `folded-name`, and that move still raises `table-removed` (with `renamedTo`): a changed table name does not move its rows.

If 5 or more unpaired facts share a kind and a name, none is guessed and a `reshuffled` note says so.

### 7.3 Changes in place

A fact present on both sides (or the two ends of a move of one kind) can have:

```ts
type Change = { id: string; kind: CountKind; name: string; files: string[] } & (   // id: the after-side id
  | { type: "methods"; before: string[]; after: string[] }            // endpoint: meta.methods
  | { type: "schedule"; before: string | null; after: string | null } // job: meta.schedule
  | { type: "vendor"; before: string[]; after: string[] }             // service, ai: meta.vendor
  | { type: "tools"; before: number; after: number }                  // ai: meta.tools
  | { type: "reworked"; before: number; after: number }               // screen, endpoint, table, job: lines in its own files; files = the after-side files
);
```

`reworked` looks only at the fact's own hand-written files (not generated, defining nothing else). They must have changed by at least `reworkLines` lines **and** `reworkShare` of the old size. Lines of code is the only in-place signal the scan has.

### 7.4 Reach: what each screen can get to

Roots are every **screen** and every **job** fact. A root walks, with `lib/reach.mjs` (§3.3), from each of its non-kit defining files:

- along `imports`, and along `http` uses into the defining files of the endpoint called (the http hop: a screen reaches saved data only through screen → `fetch("/api/…")` → route file → `lib/…` → an ORM use);
- at most `MAX_HOPS` = 3 hops, and **never through kit files**;
- reaching a fact means a visited file `uses` it. Only `service`, `ai`, `endpoint` and `table` facts count as reached; screens, jobs and areas never do.

Each root is walked twice. The **strong** walk skips generated files (`gen`); the **weak** walk may pass through them. Strong is a subset of weak. A generated client (`sdk.gen.ts`) lists every endpoint, so through it every screen "reaches" every request, and that proves nothing about one screen.

```ts
type Gained = { fact: Ref; screens: { id: string; name: string }[]; chain: string[] };
type Lost = { fact: Ref; screens: { id: string; name: string }[] };
```

- **`reach.gained[]`**: a fact a screen reaches strongly now, that the same screen did not reach strongly **or weakly** before. Screens are those present on both sides: the same id, or the id a `moved` entry gave. `chain` is the shortest strong path: files in order, an endpoint id before the file an http hop led to, and the fact's id last.
- **`reach.lost[]`**: a fact a screen reached strongly before, that still exists and that the screen reaches neither strongly nor weakly now.
- **`reach.generated`**: true when, on either side, some screen or job reaches something only through a generated file. Then **no endpoint is claimed** in `gained` or `lost`: which screen calls which request cannot be told.
- Jobs are roots but never appear in `gained` or `lost`. They appear as `usedByJobs`.
- Entries are sorted by `fact.id`; `screens` by id. A long `screens` list is collapsed in the wording (the briefing says "N screens" above 3), not in the data.

```ts
type NotOnScreen = {
  fact: Ref; why: "new" | "disconnected";
  usedByJobs: { id: string; name: string }[];   // jobs whose strong reach includes it, sorted
  files: string[];                              // the fact's files (evidence)
};
```

`notOnScreen` lists `service`, `ai`, `endpoint` and `table` facts in the **after** scan that no screen reaches by any path, strong or weak. `new`: not in the before scan and not the target of a move. `disconnected`: a screen reached it before (ids mapped through moves) and none does now. It means "no screen seems to lead to it", not "it is broken": see §7.12.

### 7.5 Worth a look

```ts
type Look =
  | { code: "went-empty" }
  | { code: "table-removed" | "screen-removed" | "request-lost" | "service-added" | "ai-added" | "job-added";
      kind: CountKind; id: string; name: string; vendor?: string[];
      renamedTo?: { id: string; name: string };   // table-removed, from a folded-name move
      methods?: string[] }                         // request-lost, when only some methods went
  | { code: "vendor-switched"; kind: "service"; id: string; name: string; before: string[]; after: string[] }
  | { code: "big-shrink"; name: string; before: number; after: number };   // an area, by its plain name
```

| Code | Raised when | The wording warns about |
|---|---|---|
| `went-empty` | The after scan is empty and the before scan was not | Wrong folder, or most of the app deleted |
| `table-removed` | A table is in `removed`, or is the `from` of a `folded-name` move | Saved data may be lost |
| `screen-removed` | A screen is in `removed` | Links to it break |
| `request-lost` | An endpoint is in `removed`, or loses a method (`methods` says which) | Callers get no answer |
| `vendor-switched` | A service has a new vendor and lost another | A new account and keys |
| `service-added` | A service is in `added` | An account, keys, cost |
| `ai-added` | An AI provider is in `added` | Cost per use |
| `job-added` | A job is in `added` | It runs on its own once published |
| `big-shrink` | An area lost at least `bigShrinkShare` of its lines (and passed the area test, §7.6) | A part of the app got much smaller |

Order: the codes in the order of this table, then by `id` or `name`.

### 7.6 Size

```ts
type Size = { files: { before: number; after: number }; loc: { before: number; after: number };
              areas: { name: string; before: number; after: number; delta: number }[] };
```

- Files and lines exclude generated files.
- `areas` roll up lines by folder. Both scans are cut with the **union of the `meta.leaf` directories** of either scan, each file going to the shallowest such directory above it, so a folder that became two leaves is still one bucket. The root `.` is left out while any other leaf exists. Buckets with the same plain name merge.
- An area is listed when it moved by at least `areaLines` lines and at least `areaShare` of its old size; a new area needs `areaLines` only.
- Kept: the `areasGrew` that grew most (largest first), then the `areasShrank` that shrank most. The full list still feeds `big-shrink`.
- A capped scan (§7.9) lists no areas and raises no `big-shrink`.

### 7.7 Posters

With `opts.parts`, `diffFacts` runs `wire` on each scan, adds `posters`, and tags each Item with `part`:

- `stale`: with `wiringFactsHash` (or `labels.wiringFacts`): that hash differs from the after scan's. Without it: wiring `parts` against the before scan draws something different from wiring them against the after scan.
- `unwired`: the `wire` errors for `parts` against the after scan, sorted. The poster cannot be redrawn as it stands.
- `uncited`: ids of added screen, table, service, AI and job items that no part cites. They are not on the poster.

### 7.8 `THRESHOLDS`

Every number the diff decides with is exported from `lib/changes.mjs` as a frozen `THRESHOLDS`. Change a number there, never in a second place.

| Name | Value | Used for |
|---|---|---|
| `reworkLines` | 20 | `reworked`: minimum lines changed in a fact's own files |
| `reworkShare` | 0.25 | `reworked`: minimum share of the old size |
| `areaLines` | 50 | `size.areas`: minimum lines moved |
| `areaShare` | 0.2 | `size.areas`: minimum share of the old size (not for a new area) |
| `bigShrinkShare` | 0.5 | `big-shrink`: share of lines lost |
| `areasGrew` / `areasShrank` | 3 / 2 | How many areas `size.areas` keeps |
| `unrelatedShare` | 0.2 | `unrelated`: shared file paths, of the smaller scan |
| `reshuffled` | 5 | `reshuffled`: unpaired facts with one name |
| `capped` | 19000 | `capped`: files in a scan (the scanner stops at 20000) |

### 7.9 Notes

Things a reader needs to know about how far to trust the comparison. Sorted in the order below, then by content.

| Code | Fields | Means |
|---|---|---|
| `repo-name-differs` | `before`, `after` | The two scans have different `repo.name` |
| `unrelated` | `shared` (percent) | Fewer than `unrelatedShare` of the file paths match, and neither scan is empty: probably two projects |
| `capped` | `side`: `before`, `after` or `both` | A scan holds `capped` files or more: sizes are partial |
| `empty-baseline` | | The before scan is empty and the after scan is not. The briefing says where the app stands |
| `first-save-after-date` | `date?` | Passed in by `changes`: no saved version is older than the date asked about, so the baseline is empty |
| `reshuffled` | `kind`, `name`, `count` | `reshuffled` or more unpaired facts share one kind and name; nothing was paired by name |
| `scanner-drift` | `ids` | These facts came or went though every file defining them reads exactly as before (same lines, same imports and uses): the scan changed, not the app |

A caller's own notes go after these, as given.

### 7.10 The briefing document

`buildBriefing(changes, { receipts }) → Briefing` and `renderText(doc)` (`lib/briefing.mjs`); `renderHtml(doc)` in `lib/briefing-html.mjs`. Text and HTML render the same document, so their wording cannot drift.

```ts
type Briefing = {
  title: string;      // "What changed", or "Where your app stands now" for a first look
  lede: string;       // "Since <before.label> · compared with <after.label>." Absolute dates only
  short: string;      // at most 4 clauses, in priority order, then "and N other changes"; "Nothing changed." when same
  numbers: { label: string; kind: CountKind; before: number; after: number; delta: number; value: string; text: string }[];  // six rows, "(no change)" when equal (a first look shows only the count; same has none)
  sections: { id: "now" | "new" | "gone" | "changed" | "connected" | "offscreen" | "look" | "size";
              title: string; items: { text: string; where?: string; flag?: true }[]; bars?: { label: string; before: number; after: number; delta: number }[] }[];
  footer: string;     // what the scan cannot see
};
```

- Sections come in the order new, gone, changed, connected ("Now connected"), offscreen ("Not on a screen yet"), look ("Worth a look"), size, and are left out when empty. A first look (empty before, something now) has `now` in place of new, gone, changed and connected. `size` carries `bars`.
- `same`: title "What changed", short "Nothing changed.", no sections, no numbers, no footer. Not `structural`: short is "Nothing structural changed: same screens, saved records, outside services, AI and jobs. (I can't see wording, colour or settings changes.)", then Worth a look and Size.
- More than 6 of one kind in New or Gone become one line naming up to 6. More than 3 warnings of one kind in Worth a look become one line. Not on a screen yet lists 6, then "And N more".
- `where` (file paths, witness chains) exists only with `receipts`, and never changes the wording of `text`.
- Voice: "you" and "your app"; names qualified by kind ("the Recipes screen", "the saved record Ingredient"); services as "Payments (Stripe)". **Every line without `where` passes `isJargon`** (`lib/scan/names.mjs`). A name from the scan that contains a banned word is scrubbed ("API keys" becomes "request keys"). Cron strings become phrases by `describeCron` ("every Monday at 08:00"), else "on a schedule". HTTP methods become verbs: look up, add, change, remove. Services have verbs in `SERVICE_VERBS` ("take payments").
- HTML is one self-contained page: no `<script>`, `<link>`, `url()` or `@import`; every string escaped; `lang` and a viewport tag; light and dark by `prefers-color-scheme`; size bars have `role="img"` and an `aria-label`; receipts sit in `<details>`, only with `--receipts`. <!-- verify: against lib/briefing-html.mjs -->

### 7.11 Tests that pin this

`test/changes.test.mjs` covers every rule above. `test/examples.test.mjs` regenerates the sample briefing in `examples.md` from the Pantry fixture and fails when the file differs from what the tool prints.

### 7.12 What the scan cannot see

State these in any briefing. They are why the wording hedges.

- **Wording, colour, images, settings and keys.** A screen can change completely and show nothing if its size and links stay the same. Never write "no changes users would notice".
- **Wiring above the import graph.** Layout and middleware wiring, such as a sign-in provider wrapped around the whole app in `layout.tsx`, is not an import from any screen. "No screen seems to lead to it" is not "it does not work".
- **Distance.** Reach stops after 3 hops. A screen that reaches a service in 4 does not "use" it here.
- **Generated clients.** Which screen calls which request cannot be told through generated code (`reach.generated`).
- **Data.** A removed table is a change to the app's design. The scan does not know what is stored, or how the database is migrated.
- **Moves.** Only unique matches are paired. Everything else is "gone" and "new".
- **Size.** Lines are non-blank lines. "Reworked" is lines only. A very large project is read in part (`capped`).
