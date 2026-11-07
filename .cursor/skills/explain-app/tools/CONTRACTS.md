# Poster contracts: facts, spec, shapes, checks

The poster pipeline has four pieces, and this file is the only agreement between them. If code and this file disagree, fix the code, or change this file first and say so.

```
repo ──scan──▶ <repo>-facts.json ──compose──▶ <repo>-poster.json (agent fills) ──render──▶ html, png, pdf (+ check)
```

| Piece | File(s) | Job |
|---|---|---|
| Scanner | `tools/lib/scan/*.mjs` | Repo → `facts.json`. Deterministic, no network, no LLM |
| Spec | `tools/lib/spec.mjs`, `tools/lib/jargon.mjs` | Scaffold a spec from facts and a shape. Validate a filled spec. Pure, no I/O |
| Shapes | `tools/lib/shapes/<id>.mjs`, registry in `tools/lib/shapes/index.mjs` | Spec → the HTML for the whole sheet |
| Render and check | `tools/vyo.mjs`, `tools/lib/check.mjs` | Page shell, fonts, footer, Playwright screenshot and PDF, and the checks |

Shared helpers live in `tools/lib/hash.mjs`: `stableStringify`, `factsHash`, `fnv1a`. Use them. Don't re-implement them.

---

## 1. CLI

One dispatcher, `tools/vyo.mjs` (`package.json` bin `vyo`). All commands run from the skill directory.

```bash
node tools/vyo.mjs scan    <repo-dir> --out <dir>/<repo>-facts.json
node tools/vyo.mjs show    <facts.json>
node tools/vyo.mjs shapes
node tools/vyo.mjs compose <facts.json> --shape <id> [--repo <dir>] [--theme light|dark] [--out <spec.json>] [--force]
node tools/vyo.mjs render  <spec.json> [--out <dir>] [--facts <facts.json>] [--no-png] [--no-pdf] [--paper fit|a4|letter]
node tools/vyo.mjs check   <spec.json> [--facts <facts.json>]
```

- `scan` and `show` are the v1 scanner, unchanged. `scan` never writes inside the scanned repo except to `--out`.
- `shapes` prints, for each shape: id, "fits when", themes, notes count, and each slot with its kind, prompt and limits.
- `compose` writes a scaffold spec (§3). It fills `facts` from the facts file, `product.name` and `product.repo` from `facts.repo.name`, and `theme` from `--theme` or the shape's first theme. It rejects a theme the shape does not declare. It refuses to overwrite an existing spec, which may hold the agent's words, unless `--force` is given. Every slot holds a placeholder, which validation rejects, so a scaffold cannot render.
  - With `--repo <dir>`: `product.commit` is `git -C <dir> log -1 --format=%h` and `product.date` is `git -C <dir> log -1 --format=%cs`, so reruns are stable.
  - Without it: no `commit`, and `date` is today's ISO date. `facts.json` stays free of timestamps.
- `render` validates the spec, builds the HTML, writes a PNG at 2× and a PDF, then runs every check (§6). Default `--facts` is `<repo>-facts.json` beside the spec, where `<repo>` is `product.repo`. Default `--out` is the spec's directory. Outputs: `<repo>-poster.html`, `<repo>-poster.png`, `<repo>-poster.pdf`. The HTML embeds its fonts as base64 data URIs.
- `check` does what `render` does in a temporary directory and writes nothing to `--out`.
- Exit codes: 0 ok (warnings on stderr, prefixed `! `), 1 rule error (`✗ ` lines on stderr), 2 usage.
- `VYO_CHROMIUM` names the Chromium binary when Playwright's own is not installed.
- When `tools/fonts/` is missing, `render` and `check` exit 1 with `run tools/fetch-fonts.sh`.

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

`<repo>-poster.json` is the single contract between `compose` and `render`. The agent edits only this file.

```ts
type ShapeId = "hourglass" | "ribbon" | "warm-start" | "eye";
type Spec = {
  version: 2;
  facts: string;                 // facts.json `hash`. Render refuses a mismatch (a stale spec)
  product: {
    name: string;                // customer-facing name. compose copies facts.repo.name, and render warns until it differs
    repo: string;                // repo dir basename, = facts.repo.name
    commit?: string;             // short sha, only when compose had --repo
    date: string;                // ISO date: the commit date with --repo, else the day compose ran
  };
  theme: "light" | "dark";       // must be a key of the shape's `themes`
  shape: ShapeId;
  headline: string;              // one serif sentence about the outcome, ≤ 72 chars
  hot: string;                   // one word or two-word phrase, set in the accent. See "hot" below
  slots: Record<string, string | string[]>;   // exactly the shape's slots (§4)
  notes: { title: string; text: string }[];   // exactly the shape's `notes` count (2 or 3). title ≤ 24 chars, text ≤ 220
  notBuilt: string[];            // 0–6 plain items of ≤ 32 chars, rendered as "Not built yet: a, b, c". [] renders nothing
  audience?: string;             // optional, ≤ 40 chars
};
```

Validation lives in `lib/spec.mjs`. It is pure and every error names the field.

- Unknown keys are rejected, at every level.
- Every limit is enforced. The shared limits are `LIMITS` in `lib/spec.mjs`, and the table below states them. Slot limits come from the shape (§4).
- `slots` holds every slot the shape declares, with no placeholder value, and no slot the shape does not declare.
- A `words` slot is a `string[]` within `min` and `max`. A `phrase` or `line` slot is a string within `max`.
- `**bold**` markup is allowed only at the start of a `line` slot. It renders as `<b>`.
- **`hot`** matches case-folded, as a whole word, against the words of the slots the shape names (§4). For `warm-start` it must equal the last of `lines`, case-folded.
- Every string passes `isJargon` from `lib/jargon.mjs` (exact tokens, whole word, case-folded).
- No file paths: no `/`-containing token with an extension, no `src/`, no `lib/`, no `.tsx` and the like.
- No "01/02/03" style markers and no middle-dot meta strings.

| Field | Limit |
|---|---|
| `product.name` | 24 characters |
| `headline` | 72 characters |
| `hot` | 24 characters, one word or two |
| `notes[].title` | 24 characters |
| `notes[].text` | 220 characters |
| `notBuilt` | 6 items, 32 characters each |
| `audience` | 40 characters |
| Each word in a `words` slot | 24 characters unless the slot sets `each`: `hourglass` 16, `ribbon` `travels` 22, `eye` 18, `warm-start` `lines` 5 |

`lib/jargon.mjs` exports `BANNED: string[]` and `isJargon(text): string[]`, which returns the offending tokens. The "Instead of" column of the banned-term table in `plain-language-rules.md` holds the same tokens, and a test parses that table and compares.

---

## 4. Shape modules

Each shape is one module, `lib/shapes/<id>.mjs`, with a default export. `lib/shapes/index.mjs` registers them and checks that each has the fields below.

```ts
type Tokens = Record<string, string> & { hot: string };   // CSS variable name → hex. One of them is `hot`
type Slot =
  | { kind: "words"; min: number; max: number; each?: number; letters?: true; prompt: string }    // string[]. `each` caps one item (default LIMITS.word). warm-start's `lines` sets each: 5 and letters: true
  | { kind: "phrase"; max: number; prompt: string }                // string, set in caps by the shape
  | { kind: "line"; max: number; prompt: string };                 // one sentence, may start with **bold**
type Shape = {
  id: ShapeId;
  fits: string;                  // "fits when", printed by `vyo shapes`. The agent picks by this
  themes: { light?: Tokens; dark?: Tokens };   // only the themes the shape has
  notes: 2 | 3;                  // footer columns
  slots: Record<string, Slot>;
  hotWords(slots): string[];     // the words `hot` may match
  hotRule: string;               // the same rule in words, used in the error message
  draw(spec: Spec, ctx: DrawCtx): string;      // HTML for the whole 840×1190 sheet
};
type DrawCtx = {
  masthead: string;              // product name with the accent full stop, which carries data-hot
  headline: string;              // the serif line, ready to place
  footer: string;                // §5, ready to place
  footerHeight: number;          // place the footer at top = 1190 − footerHeight − margin
  mastFont: string;              // the masthead's font-family value
  esc(s): string;                // HTML-escape
  line(s): string;               // a `line` slot as HTML, with the leading **bold** as <b>
  json(v): string;               // JSON safe to inline in a <script>
};
```

| Shape | Themes | Notes | Slots | `hot` comes from |
|---|---|---|---|---|
| `hourglass` | light, dark | 3 | `top` words 6–12, `waist` phrase ≤ 16, `bottom` words 3–8, `asideLeft` line ≤ 90, `asideRight` line ≤ 110, `asideBottom` line ≤ 90 | `top` or `waist` |
| `ribbon` | dark | 3 | `leftLine` phrase ≤ 24, `rightLine` phrase ≤ 24, `travels` words 4–10, `aside` line ≤ 110 | `travels`. The ribbon rows are the accent by design. `hot` is the one word set bold and bright |
| `warm-start` | light | 2 | `lines` words 2–4 (each ≤ 5 letters, letters only), `aside` line ≤ 110 | Equals the last of `lines` |
| `eye` | light | 3 | `lids` words 6–12, `iris` words 3–6, `blurb` line ≤ 140 | `iris`. The masthead sits in the iris |

Render owns the page shell: the doctype, the `@font-face` rules, the palette variables from the shape's theme, the sheet `div`, and the wait for `window.drawn`. The shape owns everything inside the sheet, including where the masthead, headline and footer go. Each mockup in `explorations/2026-10-29-type-posters/` is the geometry for its shape.

Word rows are measured in the browser. `draw` may return a `<script>` that awaits `document.fonts.ready`, measures with a canvas 2d context, lays out the rows, and then sets `window.drawn = true`.

---

## 5. The footer

The footer is one fragment that render builds and passes as `ctx.footer`, with a fixed height in `ctx.footerHeight`. Top to bottom:

1. A hairline rule.
2. The counts line, in the soft ink colour.
3. The notes row: 2 or 3 columns, from the shape's `notes`. Each column is a bold title over its text.
4. The bottom line: provenance on the left, `Not built yet: a, b, c` centred when `notBuilt` is not empty, and `Drawn by Vyo.` on the right. The full stop of `Drawn by Vyo.` carries `data-hot`.

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
| `slot-at-max` | ! | A slot is filled to its limit, which risks crowding |
| `drawn` | ✗ | The shape's script ran to the end: the page raised no error and set `window.drawn` |
| `fonts` | ✗ | `document.fonts` holds a `FontFace` with status `loaded` for Commit Mono 400, Commit Mono 700 and Newsreader 400 |
| `masthead-font` | ! | Inter Display or Inter is installed for the product name |
| `rows-fit` | ✗ | Every `.row` has `scrollWidth ≤ clientWidth` and sits inside the 840×1190 sheet |
| `words-drawn` | ✗ | Every slot word appears in a rendered `.row`, and `hot` appears in the accent colour in the figure |
| `blocks-apart` | ✗ | No two `[data-block]` text blocks overlap |
| `blocks-inside` | ✗ | Every `[data-block]` text block sits inside the sheet |
| `palette` | ✗ | Every text colour, square background and visible box background is one of the theme's tokens |
| `hot-tagged` | ✗ | Anything in the `hot` colour carries `data-hot` |
| `copy` | ✗ | The visible words hold no banned term, file path, "01/02/03" marker or middle dot. The masthead and the render-owned footer lines are exempt |
| `notes` | ✗ | The footer shows the shape's `notes` count of notes |
| `band` | ✗ | The footer counts line equals the line built from `bandCounts(facts)` |
| `headline-lines` | ! | The headline wraps to more than 2 lines |

---

## 7. DOM contract

Shapes produce, and the checks read, these markers:

| Marker | Who sets it | Meaning |
|---|---|---|
| `data-hot` | Render on the two full stops. The shape on everything else in the accent | This element is meant to be in the `hot` colour. Anything in that colour without it fails `hot-tagged` |
| `data-block` | The shape | A text block to measure for overlap: masthead, headline, asides, blurb, notes, footer lines |
| `.row` | The shape | One row of words in the figure. Measured by `rows-fit` and read by `words-drawn` |
| `window.drawn` | The shape's script | Set to `true` after the fonts load and every row is laid out. Render waits for it before the screenshot, the PDF and the checks |

The sheet is 840×1190 CSS px. The PNG is rendered at a device scale factor of 2.
