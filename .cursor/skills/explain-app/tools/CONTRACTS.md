# Poster contracts: facts, spec, geometry, checks

The poster pipeline has five pieces, and this file is the only agreement between them. If code and this file disagree, fix the code, or change this file first and say so.

```
repo ──scan──▶ <repo>-facts.json ──compose (optional preset)──▶ <repo>-poster.json (agent writes the figure) ──sketch──▶ text preview
                                                                                    └──render──▶ html, png, pdf (+ check)
```

| Piece | File(s) | Job |
|---|---|---|
| Scanner | `tools/lib/scan/*.mjs` | Repo → `facts.json`. Deterministic, no network, no LLM |
| Spec | `tools/lib/spec.mjs`, `tools/lib/jargon.mjs` | Scaffold a spec from facts and an optional preset. Validate a filled spec, including path parsing. Pure, no I/O, never measures text |
| Presets | `tools/presets/<id>.json` | Example figures the agent may start from with `compose --from`. They double as the goldens |
| Fill | `tools/lib/fill.js` | Runs in the page. Samples each region's outline into rows, fills them with words, draws dots, places the texts |
| Render and check | `tools/vyo.mjs`, `tools/lib/render.mjs`, `tools/lib/check.mjs`, `tools/lib/inspect.js` | Page shell, fonts, palette, footer, Playwright screenshot and PDF, and the checks |

Shared helpers live in `tools/lib/hash.mjs`: `stableStringify`, `factsHash`, `fnv1a`. Use them. Don't re-implement them.

---

## 1. CLI

One dispatcher, `tools/vyo.mjs` (`package.json` bin `vyo`). All commands run from the skill directory.

```bash
node tools/vyo.mjs scan    <repo-dir> --out <dir>/<repo>-facts.json
node tools/vyo.mjs show    <facts.json>
node tools/vyo.mjs presets [<id>]
node tools/vyo.mjs compose <facts.json> [--from <preset>] [--repo <dir>] [--theme light|dark] [--out <spec.json>] [--force]
node tools/vyo.mjs sketch  <spec.json>
node tools/vyo.mjs render  <spec.json> [--out <dir>] [--facts <facts.json>] [--no-png] [--no-pdf] [--paper fit|a4|letter]
node tools/vyo.mjs check   <spec.json> [--facts <facts.json>]
```

- `scan` and `show` are the v1 scanner, unchanged. `scan` never writes inside the scanned repo except to `--out`.
- `presets` prints, for each preset in `tools/presets/`, its id, its `fits` sentence and a one-line summary of its regions and texts. `presets <id>` prints that preset's `figure` as JSON.
- `compose` writes a scaffold spec (§3). It fills `facts` from the facts file, `product.name` and `product.repo` from `facts.repo.name`, and `theme` from `--theme`. It refuses to overwrite an existing spec, which may hold the agent's words, unless `--force` is given.
  - Without `--from`: a starter figure with one fill region shaped as a box (a three-stop `profile` of constant half-width 300 from y 176 to the floor minus 8), placeholder words, one masthead, one headline and one aside. The box fails `row-variety` on purpose, so the agent must reshape it.
  - With `--from <preset>`: the preset's figure with its geometry kept and every word replaced by a placeholder.
  - Validation rejects placeholders, so a scaffold cannot render.
  - It prints `floor: <y>`, the footer top for the spec's notes count with a one-line not-built list (§5), and says that each extra not-built line raises the floor by 16px. Then it prints the `masthead`, `headline`, `aside` and `rows` lines of §4.5: line heights, characters per line and the row grid.
  - With `--repo <dir>`: `product.commit` is `git -C <dir> log -1 --format=%h` and `product.date` is `git -C <dir> log -1 --format=%cs`, so reruns are stable.
  - Without it: no `commit`, and `date` is today's ISO date. `facts.json` stays free of timestamps.
- `sketch` validates the spec and prints the sheet as ASCII (§4.4). It needs no browser.
- `render` validates the spec, builds the HTML, writes a PNG at 2× and a PDF, then runs every check (§6). Default `--facts` is `<repo>-facts.json` beside the spec, where `<repo>` is `product.repo`. Default `--out` is the spec's directory. Outputs: `<repo>-poster.html`, `<repo>-poster.png`, `<repo>-poster.pdf`. The HTML embeds its fonts as base64 data URIs.
- `check` does what `render` does in a temporary directory and writes nothing to `--out`.
- `vyo shapes` no longer exists.
- Exit codes: 0 ok (warnings on stderr, prefixed `! `), 1 rule error (`✗ ` lines on stderr), 2 usage.
- `VYO_CHROMIUM` names the Chromium binary when Playwright's own is not installed.
- When `tools/fonts/` is missing, `render` and `check` exit 1 with `run tools/fetch-fonts.sh`.

---

## 2. `facts.json` (scanner output)

Written with `stableStringify(obj, 1)`, so two scans of the same tree are byte-identical. There are no timestamps and no absolute paths. All paths are repo-relative POSIX paths.

```ts
type FactsFile = {
  version: 1;
  hash: string;                  // factsHash(file): first 12 hex of sha256 over canonical JSON without "hash"
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

## 3. The spec

`<repo>-poster.json` is the single contract between `compose`, `sketch` and `render`. The agent edits only this file.

```ts
type Spec = {
  version: 3;
  facts: string;                 // facts.json `hash`. Render refuses a mismatch (a stale spec)
  product: {
    name: string;                // customer-facing name. compose copies facts.repo.name, and render warns until it differs
    repo: string;                // repo dir basename, = facts.repo.name
    commit?: string;             // short sha, only when compose had --repo
    date: string;                // ISO date: the commit date with --repo, else the day compose ran
  };
  theme: "light" | "dark";
  accent?: string;               // "#rrggbb". Replaces the theme's hot colour (the ribbon preset uses #9284FF on dark)
  headline: string;              // one serif sentence about the outcome, ≤ 72 chars
  hot: string;                   // one word or two-word phrase, set in the accent. See "hot" below
  figure: Figure;
  notes: { title: string; text: string }[];   // 2 or 3. title ≤ 24 chars, text ≤ 220
  notBuilt: string[];            // 0 to 6 plain items of ≤ 32 chars, rendered as "Not built yet: a, b, c". [] renders nothing
  audience?: string;             // optional, ≤ 40 chars
};

type Figure = {
  fits: string;                  // ≤ 160 chars: the picture and why it acts out the main moment. Printed by `presets`. Never drawn
  regions: Region[];             // 1 to 6
  texts: Text[];                 // 1 to 6: exactly one "masthead", at most one "headline"
};

type Outline =                   // exactly one key (§4.1)
  | { profile: [number, number, number][] }                 // [y, cx, halfWidth], 3 to 24 stops, y strictly increasing
  | { ellipse: { cx: number; cy: number; rx: number; ry: number } }
  | { polygon: [number, number][] }                         // 3 to 40 points, closed
  | { path: string };                                       // SVG path data in sheet px

type Ink = "soft" | "mid" | "ink" | "cold" | "cool";
type Tone = Ink | [Ink, Ink] | [Ink, Ink, Ink];             // a list steps down the region: each row takes the nearest stop

type Region =
  | (Outline & {
      kind: "fill";
      id: string;
      words: string[];           // 2 to 14, each ≤ 24 chars, nouns in the user's words
      tone: Tone;
      holes?: Outline[];         // cut out with the even-odd rule
      caps?: boolean;            // default true
      band?: 1 | 2 | 3 | 4;      // rows per word, default 1 (the ribbon preset uses 3)
      size?: 11 | 12;            // font size and row grid: 12 → 16px rows, 11 → 14px rows. Default 12
      hot?: boolean;             // every row in the accent, with data-hot (the eye's iris)
    })
  | {
      kind: "dots";
      id: string;
      lines: string[];           // 2 to 4 words, letters A to Z and spaces, ≤ 5 chars each
      x: number; y: number;      // top-left corner, sheet px
      cell: number;              // px per square
      tones: (Ink | "hot")[];    // one per line, never a list. "hot" draws the line in the accent, and so does a line matching the spec's `hot`
    };

type Text = {
  role: "masthead" | "headline" | "display" | "aside" | "label";
  id: string;
  text?: string;                 // required for display, aside and label. The masthead renders product.name with the accent full stop. The headline renders spec.headline
  x: number; y: number; w: number;   // sheet px. w is the wrap width. For the masthead it is the fit width, and the name shrinks to fit
  size?: number;                 // masthead 84 (48 to 120), headline 22 (18 to 40), display 56 (32 to 64), aside 12 (10 to 14), label 12 (10 to 32), hot label 26 (10 to 32)
  align?: "left" | "right" | "center";   // default left
  hot?: boolean;                 // label only: set in the accent, uppercase, tracked (the hourglass waist)
};
```

Validation lives in `lib/spec.mjs`. It is pure and every error names the field.

- Unknown keys are rejected, at every level.
- Every limit in the table below is enforced. The shared limits are `LIMITS` in `lib/spec.mjs`.
- Each fill region and each hole has exactly one of `profile`, `ellipse`, `polygon` and `path`.
- Every geometry number is finite. `rx`, `ry`, `cell` and every half-width are positive. A `path` must parse with the small tokenizer in `lib/spec.mjs`, which accepts M, L, C, Q, A, H, V and Z in absolute and relative forms. The validator checks numbers only. Bounds against the sheet and the footer are the page-stage `path` check (§6).
- `text` is required on displays, asides and labels. `hot` is allowed only on labels.
- A `display` is a bold sans line for the poster's own words, such as the ribbon's "Save in Claude Code." Its `text` is at most 40 characters.
- Region and text ids are lowercase letters, digits and dashes, at most 24, unique across regions and texts. `note`, `counts`, `notBuilt`, `provenance` and `credit` are footer block names and are rejected.
- `**bold**` markup is allowed only at the start of an aside. It renders as `<b>`.
- **`hot`** matches case-folded, as a whole word (`hasWord`), against a word of some fill region, a dots line, or the `text` of a label with `hot: true`. It may also stand alone when some region has `hot: true`.
- Every visible string passes `isJargon` from `lib/jargon.mjs` (exact tokens, whole word, case-folded).
- No file paths: no `/`-containing token with an extension, no `src/`, no `lib/`, no `.tsx` and the like.
- No "01/02/03" style markers and no middle-dot meta strings.
- No placeholder survives from `compose`.

| Field | Limit |
|---|---|
| `product.name` | 24 characters |
| `headline` | 72 characters |
| `hot` | 24 characters, one word or two |
| `notes` | 2 or 3 |
| `notes[].title` | 24 characters |
| `notes[].text` | 220 characters |
| `notBuilt` | 6 items, 32 characters each |
| `audience` | 40 characters |
| `figure.fits` | 160 characters |
| `figure.regions` | 1 to 6 |
| `figure.texts` | 1 to 6, exactly one masthead, at most one headline |
| Fill `words` | 2 to 14 items, 24 characters each |
| `profile` | 3 to 24 stops, y strictly increasing |
| `polygon` | 3 to 40 points |
| `band` | 1 to 4 |
| `size` (fill) | 11 or 12 |
| Dots `lines` | 2 to 4 items, 5 letters each, letters and spaces only |
| Dots `tones` | One per line |
| `size` (masthead) | 48 to 120, default 84 |
| `size` (headline) | 18 to 40, default 22 |
| `size` (display) | 32 to 64, default 56 |
| `size` (aside) | 10 to 14, default 12 |
| `size` (label) | 10 to 32, default 12; 26 when `hot` |
| `text` (aside) | 160 characters |
| `text` (label) | 32 characters |
| `text` (display) | 40 characters |

`lib/jargon.mjs` exports `BANNED: string[]` and `isJargon(text): string[]`, which returns the offending tokens. The "Instead of" column of the banned-term table in `plain-language-rules.md` holds the same tokens, and a test parses that table and compares.

---

## 4. Geometry

The sheet is 840×1190 CSS px with y growing downward. Every number in a figure is sheet px. The footer's top is `1190 − footerHeight − 36` (§5), and everything the agent places must sit above it.

### 4.1 Outlines

| Primitive | Outline |
|---|---|
| `profile` | For each stop `[y, cx, halfWidth]`, the left edge is `cx − halfWidth` and the right edge is `cx + halfWidth`. Between stops, `cx` and `halfWidth` follow a monotone cubic interpolation, so the outline is smooth and never overshoots a stop. The region spans the first stop's y to the last |
| `ellipse` | Centre `(cx, cy)`, radii `rx` and `ry` |
| `polygon` | The points in order, closed back to the first |
| `path` | The SVG path, filled with the even-odd rule |

`holes` are outlines of the same four kinds. They join the region's path, which is filled with the even-odd rule, so a hole cuts the region.

### 4.2 Sampling rows (in the page)

`lib/fill.js` builds each outline as an offscreen `<svg><path>` and uses `getBBox()` and `isPointInFill()`. Geometry is never computed in Node, except by `sketch` (§4.4).

1. Rows snap to one grid for the whole sheet: 16px for size 12, 14px for size 11.
2. A point x on the row with top y is inside when both `y + 3` and `y + 13` are inside the fill (`y + 2` and `y + 12` at size 11). The sampler tests every 1px across the bounding box and collects the inside runs.
3. Every text block's measured rect, padded by 12px, is cut out of the runs. A masthead can therefore sit inside a region, as in the eye preset.
4. Gaps narrower than 24px are merged, unless the gap came from a text block.
5. Runs narrower than 24px are dropped.

### 4.3 Filling rows

- Font `400 12px "Commit Mono"`, or 11px at size 11, uppercase unless `caps` is false.
- One word per row, shared by every run on that row, so the eye's two lid runs show the same word. With `band: n`, a word holds for n rows.
- The next word is the next one in the list that fits the row, cycling, and no word is skipped for more than one full cycle.
- A run narrower than the word draws the word centred at its natural width. It may overhang the run.
- A run narrower than twice the word's natural width draws the word once, centred, with no tracking.
- A wider run repeats the word with three spaces between copies and letter-spaces the result to the run's width. Tracking is never below 0.
- A tone list steps down the region by row index. Row i of n takes stop `round(i / (n - 1) * (stops - 1))`: a pair gives each row its nearer stop, so the top half is the first and the bottom half the second, and three stops give top, middle and bottom bands. A single row takes the first stop. Each row is one theme token, so `palette` still holds.
- A row whose word matches `hot` (`hasWord`) is set in the accent at weight 700 and carries `data-hot`. Every row of a region with `hot: true` does the same.
- Dots regions draw with v2's warm-start glyph table, shipped in full for A to Z and space: 5×7 squares per letter at `(x, y)` with `cell` px per square, a line 29 cells wide and 7 tall, lines 9 cells apart. Each line takes its tone. A line whose tone is `hot`, or whose word matches the spec's `hot`, takes the accent.
- Texts render as absolutely positioned blocks with `data-block=<id>`. The masthead uses `fitWidth` to shrink into `w`. A `display` is bold sans (Inter Display, then Inter), one line high per size px. A hot label is bold, set in the accent, uppercase and tracked.
- `window.drawn` is set to `true` when every region and text is laid out.

### 4.4 Sketch

`vyo sketch` runs the sampler of §4.2 in Node on a polygon version of each outline. Profiles and ellipses become exact polygons, and paths are flattened.

- The sheet prints at 20px per character: 42 columns by about 60 lines.
- `A` to `F` mark the fill rows of the first to the sixth region, `#` marks dots, `=` marks the footer top, and `·` marks hot rows.
- Text blocks print as boxes labelled with their ids, with heights estimated at 7.2px per character for mono text, 88px per masthead line at size 84, 28px per headline line at a 224px width, and the line heights of §4.5 for displays and labels.
- Under the sheet it prints, in order: `regions:` (letter, id and row count per region), `texts:` (each box's corners), `floor: <y>`, the coverage, height and width (as `silhouette` measures them, each marked ok or too low), and `row widths:` (spread over mean, as `row-variety` measures it, or `no fill rows`). Notes that start with `! ` follow: a region under 4 rows, a word that may never be drawn, a region or text below the floor.

### 4.5 Authoring numbers

These are the numbers `compose` prints and SKILL.md teaches.

| What | Number |
|---|---|
| Masthead line | 88px tall at size 84 |
| Headline | 28px per line in a 224px column at size 22 |
| Aside | 18px per line, 7.2px per character at size 12 |
| Display | One line, `size` px tall (56 by default) |
| Label | 1.25 × `size` px tall (12 by default, 26 when hot) |
| Rows | 16px apart at size 12, 14px at size 11 |
| Usual figure band | y 170 to the floor |
| Floor | The footer top for the notes count, with a one-line not-built list: 884 for 3 notes, 920 for 2. Each extra not-built line raises it by 16px |

---

## 5. The footer

The footer is one fragment that render builds and places at `top = 1190 − footerHeight − 36`. `footerHeight` grows with the notes count and with each line the not-built list wraps to. That top is the figure's floor (§4.5). With the current footer constants and a one-line not-built list, it is 884 for 3 notes and 920 for 2. Top to bottom:

1. A hairline rule.
2. The counts line, in the soft ink colour.
3. The notes row: 2 or 3 columns, one per item of `spec.notes`. Each column is a bold title over its text.
4. When `notBuilt` is not empty, `Not built yet: a, b, c` flush left on its own lines, wrapped at spaces to the footer's 728px width. Each extra line raises the floor by 16px.
5. The bottom line: provenance on the left and `Drawn by Vyo.` on the right. The full stop of `Drawn by Vyo.` carries `data-hot`.

Provenance is `<name> at <commit>, <date long form>`, such as `Hypher at 04186f4, 28 October 2026`. With no commit it is `<name>, <date long form>`. The footer never prints the word "commit".

The counts line uses commas and skips zero counts, in this order:

```
12 screens, 8 kinds of request, 5 kinds of saved record, 3 outside services (payments, email, sign-in), 1 AI model, runs 2 jobs on its own
```

| Count | Singular | Plural | Counted from `facts.facts` |
|---|---|---|---|
| Screens | `1 screen` | `N screens` | `kind: "screen"`, deduped by id with any `#<package>` suffix stripped |
| Requests | `1 kind of request` | `N kinds of request` | `kind: "endpoint"`, deduped the same way |
| Saved records | `1 kind of saved record` | `N kinds of saved record` | `kind: "table"` |
| Outside services | `1 outside service (payments)` | `N outside services (a, b, c)` | `kind: "service"`, grouped by capability. Names follow the count, lowercased, only when there are 3 or fewer |
| AI | `1 AI model` | `N AI models` | `kind: "ai"`, except the id `ai:gateway` |
| Jobs | `runs 1 job on its own` | `runs N jobs on its own` | `kind: "job"` |

One pure function, `bandCounts(facts)`, does the counting. A unit test pins its output for the `recipe` fixture:

```
6 screens, 3 kinds of request, 4 kinds of saved record, 3 outside services (email, payments, sign-in), 1 AI model, runs 1 job on its own
```

When `facts.empty` is true, the counts line is empty and render prints `! no application facts`.

The counts line and provenance are exempt from the jargon and file-path checks, because render writes them.

---

## 6. Checks

The checks are one table, `CHECKS` in `lib/check.mjs`, of `{ id, level, stage, about, run }` records. `tools/test/docs.test.mjs` fails when this table or the README's drifts from it. A `spec` stage check is pure and runs before render. A `page` stage check judges the measurements `lib/inspect.js` takes in the rendered page through Playwright. `✗` fails the run, `!` is a warning.

| id | Level | What it measures |
|---|---|---|
| `spec` | ✗ | The spec passes every rule in §3. When it fails, no other check runs |
| `facts-hash` | ✗ | `spec.facts` equals the facts file's `hash` |
| `facts-empty` | ! | `facts.empty` is true: the scan found nothing to count, so the footer shows provenance only |
| `product-name` | ! | `product.name` equals `facts.repo.name`, the folder name |
| `preset-copy` | ! | Every region's geometry equals a preset region's geometry, numbers compared exactly |
| `one-region` | ! | The figure is a single fill region with no hot rows and no hot label. A figure with dots, or with more than one region, never trips it |
| `drawn` | ✗ | The fill script ran to the end: the page raised no error and set `window.drawn` |
| `fonts` | ✗ | `document.fonts` holds a `FontFace` with status `loaded` for Commit Mono 400, Commit Mono 700 and Newsreader 400 |
| `masthead-font` | ! | Inter Display or Inter is installed for the product name |
| `path` | ✗ | Every outline parses and has a non-empty bounding box inside the sheet whose bottom is above the footer top. Message: `region <id> reaches <n>px below the footer; move it up by <n>` |
| `rows-fit` | ✗ | Every `.row` has `scrollWidth ≤ clientWidth` and sits inside the 840×1190 sheet |
| `region-size` | ✗ | Every fill region produced at least 4 rows, and every dots region fits above the footer. The message names the region |
| `regions-apart` | ✗ | Row rects of different regions at the same y do not overlap, with 4px horizontal inflation |
| `words-drawn` | ✗ | Per region, every word is drawn at least once. Message: `region <id>: "<word>" never drawn; shorten the list or enlarge the path` |
| `silhouette` | ✗ | Row rects plus dots line rects cover at least 15% of the area above the footer, and the figure spans at least 55% of that area's height and at least 60% of its width |
| `row-variety` | ✗ | Over all fill rows, the standard deviation of run widths divided by the mean is at least 0.15. Skipped when the figure has no fill region. Message: `the figure is a box; a silhouette changes width` |
| `blocks-apart` | ✗ | No two `[data-block]` text blocks, or a text block and a row, come within 8px. Two rows at the same y are compared horizontally only |
| `blocks-inside` | ✗ | Every `[data-block]` text block sits inside the sheet |
| `palette` | ✗ | Every text colour, square background and visible box background is one of the theme's tokens: `paper`, `ink`, `soft`, `mid`, `cold`, `cool`, or `hot` (or `accent`) |
| `hot-tagged` | ✗ | Anything in the hot colour carries `data-hot` |
| `copy` | ✗ | The visible words hold no banned term, file path, "01/02/03" marker or middle dot. The masthead and the render-owned footer lines are exempt |
| `notes` | ✗ | The footer shows exactly the notes in `spec.notes` |
| `band` | ✗ | The footer counts line equals the line built from `bandCounts(facts)` |
| `headline-lines` | ! | The headline wraps to more than 2 lines |

---

## 7. DOM contract

`lib/fill.js` and render produce, and the checks read, these markers:

| Marker | Who sets it | Meaning |
|---|---|---|
| `.row` | Fill | One run of words on one row of a fill region. Measured by `rows-fit`, `regions-apart`, `blocks-apart`, `silhouette` and `row-variety` |
| `data-region` | Fill | The region `id` on every `.row` and on every dots line. Lets the checks group rows by region |
| `data-word` | Fill | The source word, as written in the spec, on every `.row`. Read by `words-drawn` |
| `data-hot` | Render on the two full stops. Fill on hot rows, the hot dots line and a hot label | This element is meant to be in the hot colour. Anything in that colour without it fails `hot-tagged` |
| `data-block` | Fill for every text, with the text's `id`. Render for the footer blocks | A text block to measure for overlap and bounds, and to cut out of the rows |
| `window.drawn` | Fill | Set to `true` after the fonts load and every region and text is laid out. Render waits for it before the screenshot, the PDF and the checks |

The sheet is 840×1190 CSS px. The PNG is rendered at a device scale factor of 2.
