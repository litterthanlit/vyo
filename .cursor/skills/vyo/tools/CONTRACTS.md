# Poster contracts: facts, spec, geometry, checks

The poster pipeline has five pieces, and this file is the only agreement between them. If code and this file disagree, fix the code, or change this file first and say so.

```
repo ──scan──▶ <repo>-facts.json ──compose (optional preset)──▶ <repo>-poster.json (agent writes the figure) ──sketch──▶ text preview
                                                                                    └──render──▶ html, png, pdf, optional gif/mp4 (+ check)
```

| Piece | File(s) | Job |
|---|---|---|
| Scanner | `tools/lib/scan/*.mjs` | Repo → `facts.json`. Deterministic, no network, no LLM |
| Spec | `tools/lib/spec.mjs`, `tools/lib/jargon.mjs` | Scaffold a spec from facts and an optional preset. Validate a filled spec, including path parsing. Pure, no I/O, never measures text |
| Presets | `tools/presets/<id>.json` | Example figures the agent may start from with `compose --from`. They double as the goldens |
| Parts | `tools/lib/parts.mjs` | Facts → the parts a field draws (§4b). Pure |
| Fields | `tools/lib/fields/*.mjs` | One layout per field kind and the registry `FIELDS`. Pure: render inlines them into the page, `sketch` imports them (§4b) |
| Fill | `tools/lib/fill.js` | Runs in the page. Samples each region's outline into rows, fills them with words, lays out fields, draws dots and hairline routes, places the texts, applies motion |
| Render and check | `tools/vyo.mjs`, `tools/lib/render.mjs`, `tools/lib/check.mjs`, `tools/lib/inspect.js` | Page shell, fonts, palette, footer, Playwright screenshot and PDF, and the checks |

Shared helpers live in `tools/lib/hash.mjs`: `stableStringify`, `factsHash`, `fnv1a`. Use them. Don't re-implement them.

---

## 1. CLI

One dispatcher, `tools/vyo.mjs`, the bin `vyo` of the npm package `@litterthanlit/vyo`, whose root is the skill directory. Commands run from any directory; paths are relative to it.

```bash
vyo init    [--cursor] [--claude] [--codex] [--dir <repo-dir>]
vyo scan    <repo-dir> --out <dir>/<repo>-facts.json
vyo show    <facts.json>
vyo parts   <facts.json> [--field wave|terrain|river|shape|radial|sphere|scatter|shatter|glyph|bleed|slabs|spiral|contour] [--split <part id>]...
vyo shapes  [--log <file>]
vyo presets [<id>]
vyo compose <facts.json> [--frame loose|swiss|signal] [--field wave|terrain|river|shape|radial|sphere|scatter|shatter|glyph|bleed|slabs|spiral|contour] [--style rings|relief|symbols] [--split <part id>]... [--seed <n>] [--accent <part id>] [--from <preset>] [--repo <dir>] [--theme light|dark] [--out <spec.json>] [--shapes-log <file>] [--force]
vyo sketch  <spec.json> [--facts <facts.json>]
vyo render  <spec.json> [--out <dir>] [--facts <facts.json>] [--no-png] [--no-pdf] [--gif] [--paper fit|a4|letter]
vyo check   <spec.json> [--facts <facts.json>]
```

- `init` copies `SKILL.md`, `examples.md`, `plain-language-rules.md` and `project-context.example.md` into `<editor>/skills/vyo/` of `--dir` (default `.`) for each of `--cursor` (`.cursor`) and `--claude` (`.claude`); with neither flag, for the editor folders the repo has, or both if it has neither. `--codex` writes one block between `<!-- vyo:begin` and `<!-- vyo:end -->` at the end of `AGENTS.md`, pointing at the first skill path, and replaces it on a rerun. It prints `Wrote <path>` per file.
- `scan` and `show` are the v1 scanner, unchanged. `scan` never writes inside the scanned repo except to `--out`.
- `parts` prints the parts a field draws with that field's default `minShare` and `maxParts` (§4b; `--field river` uses the river's 0.002 and 24, the others 0.02 and 14): a header line `<repo>: <n> parts, <lines> lines in <files> files (parts under 2% of the lines merge into their parent; at most 14)`, a column header `id  share  lines  files  name`, one line per part in tree order, `  ! looks like a vendor or code name` after each unplain name, `  ! same name as <id>` after each name another part shares, and a closing line on setting `accent` and `names`.
- `presets` prints, for each preset in `tools/presets/`, its id, its `fits` sentence and a one-line summary of its regions and texts. `presets <id>` prints that preset's `figure` as JSON.
- `compose` writes a scaffold spec (§3). It fills `facts` from the facts file, `product.name` and `product.repo` from `facts.repo.name`, and `theme` from `--theme`. It refuses to overwrite an existing spec, which may hold the agent's words, unless `--force` is given.
  - With `--frame cover`: the cover scaffold of §3c, whatever `--field`; `--from`, `--style`, `--theme` and `--seed` are refused, and the shapes log is not written. It prints every part's id, share and scanned name, `*` beside the parts of 20% to 40% of the code, a line on the accent (or, when no part is in that range, `set "strata": "down"`), the ready silhouettes, the grounds, and the next commands.
  - Without `--from`: a field figure (§4b), in the loose frame unless `--frame swiss` or `signal`. When the facts hold no parts, it writes nothing and exits 1 with `✗ no parts to draw; the scan found no code. Compose a fill poster instead: vyo compose <facts.json> --from <preset> (vyo presets lists them)`. One field region of kind `--field`. With no `--field`, compose picks a registered field other than `wave`: one absent from the recent log if any remain, chosen by the facts hash plus the log's length so repos with empty logs start on different shapes, otherwise the least recently used non-wave field, and prints `picked <field> (avoided recent: …)`. It never defaults to wave. It writes `seed` (`--seed`, or `(parseInt(facts.hash.slice(0, 8), 16) % 2147483646) + 1`; `--seed 0` is the identity) and, for a glyph, `letter` from the first A–Z or 0–9 of the repo name. The region id equals the kind, `accent` comes from `--accent` (which must name a part), a placeholder goes in `names` for each part whose scanned name is unplain or shared with another part, and a placeholder `sentence` when the kind takes one. After a successful write it appends the field to `<dirname of --out>/recent-shapes.json` (`--shapes-log` overrides the path), newest last, keeping 8. `--from` does not record. In the loose and signal frames it lays the field out, finds the empty corners, and places `label`, `headline`, `legend`, a `paragraph` and a `list` of the parts into them (§3b); it writes no notes. The spec has no `hot`.
  - With `--from <preset>`: a fill preset's figure with its geometry kept and every word replaced by a placeholder. A field preset is refused with `--from <id> is a field preset, drawn from its own scan; use --field <kind>`, and `--field` or `--accent` beside `--from` is a usage error.
  - Validation rejects placeholders, so a scaffold cannot render.
  - Loose frame: it prints the corners the field leaves and one line per text role, and warns when there is no `--repo`, since the record line needs the commit. A field scaffold adds `vyo parts <facts.json> lists the parts: pick the accent by its id and name the <n> flagged parts in names.`; a preset scaffold adds the `rows` line and the silhouette advice.
  - Swiss frame (the exception): the spec also has a masthead at (50, 36, w 490), and a headline and aside where the field's registry entry places them. It prints `floor: <y>`, the footer top for the spec's notes count with a one-line not-built list (§5), and says that each extra not-built line raises the floor by 16px. Then it prints the `masthead`, `headline` and `aside` lines of §4.5: line heights and characters per line, and a `field: <kind>, <about>.` line after them.
  - With `--repo <dir>`: `product.commit` is `git -C <dir> log -1 --format=%h` and `product.date` is `git -C <dir> log -1 --format=%cs`, so reruns are stable.
  - Without it: no `commit`, and `date` is today's ISO date. `facts.json` stays free of timestamps.
- `sketch` validates the spec and prints the sheet as ASCII (§4.4). A figure with a field reads the facts, from `--facts` or `<repo>-facts.json` beside the spec as `render` does. It needs no browser.
- `render` validates the spec, builds the HTML, writes a PNG at 2× and a PDF, then runs every check (§6). Default `--facts` is `<repo>-facts.json` beside the spec, where `<repo>` is `product.repo`. Default `--out` is the spec's directory. Outputs: `<repo>-poster.html`, `<repo>-poster.png`, `<repo>-poster-thumb.png` (the poster at 1/6 scale, 140×198 CSS px at 2×, written with the PNG), `<repo>-poster.pdf`. `--gif` also writes `<repo>-poster.gif` (560px wide, 48 colours) and `<repo>-poster.mp4` (840px); the spec must have `motion: { kind: nodes|resolve|wipe, frames, fps }`. The HTML embeds its fonts as base64 data URIs.
- `check` does what `render` does in a temporary directory and writes nothing to `--out`.
- `shapes` lists every registered field: name, its one-line `about`, and `last used N ago` or `never`. `--log` or `--shapes-log` names the recent file; otherwise `./vyo/recent-shapes.json`, where compose writes it when the spec is in `<repo>/vyo/`.
- Exit codes: 0 ok (warnings on stderr, prefixed `! `), 1 rule error (`✗ ` lines on stderr), 2 usage.
- `VYO_CHROMIUM` names the Chromium binary when Playwright's own is not installed. When no browser starts, `render` and `check` print `BROWSER_NOTE` from `tools/lib/browser.mjs` (set `VYO_CHROMIUM`, or `npx playwright@<version> install chromium` for the Playwright vyo resolved) and exit 1. Install never downloads a browser: `postinstall` only prints that note.
- The fonts ship in `fonts/` at the package root. When a file is missing there, `render` and `check` exit 1 with `reinstall @litterthanlit/vyo`.

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
  excluded: { files: number; lines: number; by: Record<string, { files: number; lines: number }> };  // source files the exclusion rules dropped, by reason
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
  frame?: "loose" | "swiss" | "signal";     // default loose. §3b
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
  hot?: string;                  // one word or two-word phrase, set in the accent. Required unless the figure has a field. See "hot" below
  figure: Figure;
  record?: "bottom" | "left";    // loose and signal: where the record line goes; unset, render picks (§3b)
  notes: { title: string; text: string }[];   // swiss only, and required there: 2 or 3. title ≤ 24 chars, text ≤ 220. Loose and signal reject notes and notBuilt
  notBuilt: string[];            // 0 to 6 plain items of ≤ 32 chars, rendered as "Not built yet: a, b, c". [] renders nothing
  audience?: string;             // optional, ≤ 40 chars
  motion?: { kind: "nodes" | "resolve" | "wipe"; frames: number; fps: number };  // 8–36 frames, 6–24 fps. `render --gif` needs this
};

type Figure = {
  fits: string;                  // ≤ 160 chars: the picture and why it acts out the main moment. Printed by `presets`. Never drawn
  regions: Region[];             // 1 to 6
  texts: Text[];                 // 1 to 14. Swiss: exactly one masthead, at most one headline. Loose and signal: exactly one label, headline and legend
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
      size?: 7 | 8 | 9 | 10 | 11 | 12;  // font size and row grid. Default 12 (16px rows)
      hot?: boolean;             // every row in the accent, with data-hot (the eye's iris)
    })
  | {
      kind: "dots";
      id: string;
      lines: string[];           // 2 to 4 words, letters A to Z and spaces, ≤ 5 chars each
      x: number; y: number;      // top-left corner, sheet px
      cell: number;              // px per square
      tones: (Ink | "hot")[];    // one per line, never a list. "hot" draws the line in the accent, and so does a line matching the spec's `hot`
    }
  | {
      kind: "routes";
      id: string;
      paths: { d: string; tone: Ink | "hot" }[];   // 1 to 6 open SVG paths (M L H V C Q A Z)
      nodes?: { path: number; t: number; tone: Ink | "hot" }[];  // at most 12; t is 0 to 1 along that path
    }
  | FieldRegion;                 // at most one per figure

type FieldRegion = {             // drawn from facts.json at render (§4b); the agent writes no geometry
  kind: "field";
  id: string;
  field: "wave" | "terrain" | "river" | "shape" | "radial" | "sphere" | "scatter" | "shatter" | "glyph" | "bleed" | "slabs" | "spiral" | "contour";   // a key of FIELDS in lib/fields/index.mjs
  fits: string;                  // ≤ 160 chars: why this field matches the product's story. Never drawn. Replaces figure.fits on a field poster (§3b)
  accent?: string;               // a part id, an area id or a glob over part ids ("area:lib/*"). Unset: check warns accent-part
  names?: Record<string, string>;   // part id → plain name, ≤ 24 chars, for parts whose scanned name is a vendor or code name
  sentence?: string;             // wave only: ≤ 40 chars, set in every `every`th row
  every?: number;                // wave only: 2 to 20, default 5
  seed?: number;                 // 0 to 2147483647. Omitted or 0 is the identity pose
  letter?: string;               // glyph only: one of A–Z or 0–9
  shape?: Shape;                 // shape only, required: the silhouette the agent draws (§4b)
  style?: "rings" | "relief" | "symbols";   // shape only: the look over the mask, default relief
  echo?: number;                 // rings only: 0 to 12 faded outlines outside the shape, default 0
  bevel?: number;                // relief only: 0 to 1, the share of the deepest point that is rounded, default 0.7
  strata?: { by: "angle"; angle: number } | { by: "depth" };   // relief only: how the parts layer, default angle 90
  split?: string[];              // shape only: 1 to 4 part ids, each leaf part cut into the folders inside it
  minShare?: number;             // 0 to 0.2, default 0.02 (river 0.002): parts below this share of lines merge into their parent
  maxParts?: number;             // 2 to 24, default 14 (river 24, shape 12, a relief 14)
};

type Shape = {
  ops?: ShapeOp[];               // 1 to 24, painted in order into one mask; ops[0] is an add. Required unless mask
  mask?: string;                 // instead of ops: a bundled mask (wings, trace) or a PNG path; its dark pixels are the silhouette
  rotate?: number;               // degrees clockwise, the whole shape; not with mask
  fit?: { w?: number; h?: number; cx?: number; cy?: number };   // w, h 0.05 to 3 (shares of the sheet, over 1 bleeds); cx, cy −0.5 to 1.5
};

type ShapeOp = ({ add: Kind; face?: "lit" | "dim" | "round" } | { cut: Kind } | { crease: Kind }) & { rotate?: number } & (   // free units, y down; rotate about the op's centre
  | { add|cut: "circle"; at: [x, y]; r: number }
  | { add|cut: "ellipse"; at: [x, y]; r: [rx, ry] }
  | { add|cut: "rect"; at: [x, y]; size: [w, h]; round?: number }          // at is the top-left corner
  | { add|cut: "capsule"; from: [x, y]; to: [x, y]; r: number }
  | { add|cut: "arc"; at: [x, y]; r: number; from: number; to: number; width: number }   // degrees clockwise from twelve o'clock
  | { add|cut: "polygon"; points: [x, y][]; round?: number }               // 3 to 40 points
  | { add|cut: "path"; d: string });                                       // SVG path, filled nonzero

type Text = {                    // swiss roles below; the loose frame's roles are in §3b
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
- **`hot`** matches case-folded, as a whole word (`hasWord`), against a word of some fill region, a dots line, or the `text` of a label with `hot: true`. It may also stand alone when some region has `hot: true`. When the figure has a field, `hot` is optional, and a given `hot` is checked on the page only (`words-drawn`), since part names come from the facts.
- A field region takes only the keys of its kind: `sentence` and `every` on a `terrain` fail with `a terrain field has no sentence; only wave takes it`. `letter` is glyph only (one A–Z or 0–9); `symbols` (true or false) is for scatter, shatter, glyph, bleed, slabs, spiral and contour. `seed` is a whole number from 0 to 2147483647. `accent` and the keys of `names` start with `area:`. `names` values and `sentence` follow the copy rules below. `mask` is a path and is not copy.
- A field region takes only the keys of its kind: `sentence` and `every` on a `terrain` fail with `a terrain field has no sentence; only wave takes it`. `accent` and the keys of `names` start with `area:`. `names` values and `sentence` follow the copy rules below.
- A `shape` field draws only in the loose or signal frame and requires `shape`. Every shape error is reported at once, by op index: `figure.regions[0].shape.ops[2]: give exactly one of add, cut or crease (found add, cut)`, `….ops[1].add: "square" is not a kind; use circle, ellipse, rect, capsule, arc, polygon, path`, `….ops[0].size: must be two numbers above 0`, `….ops[3].r: missing; it must be a number above 0`, `….ops[1].radius: a circle takes at, r, rotate and face` (a cut or crease: `…at, r and rotate`), `….ops[0]: must be an add; a cut on an empty sheet removes nothing` (a crease first: `…; a crease folds a surface the adds have drawn`), `….ops[1].face: one of lit, dim, round: …`, `figure.regions[0].bevel: 0 to 1, …`, `figure.regions[0].strata: { "by": "angle", "angle": degrees } … or { "by": "depth" } …`. A crease on a capsule or an arc may leave out `r` or `width`. The hints are valid on any style; only relief draws them. `….fit.h: 0.05 to 3, a share of the sheet's height (over 1 bleeds off)`. When the ops are well formed but paint nothing on the sheet: `figure.regions[0].shape: the ops paint nothing on the sheet; the cuts remove all of it, or fit.cx and fit.cy move it off`. The scaffold's placeholder string fails with `still the placeholder`, and `vyo sketch` refuses it too.
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
| Field regions | At most 1 |
| Field `names` values | 24 characters |
| Field `sentence` | 40 characters |
| Field `every` | 2 to 20 |
| Field `minShare` | 0 to 0.2 |
| Field `maxParts` | 2 to 24 |
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

## 3b. Frames, legend, fits, record and corners

A spec sits in one of four frames, `frame: "loose" | "swiss" | "signal" | "cover"`, default `loose`; the cover is §3c. `ROLES` in `lib/frame.mjs` is the closed set of text roles per frame, with each role's size, line height, count, limits and what it prints; validation, render, sketch and compose read that one table.

**`swiss`** is the v4 poster, unchanged: masthead, the serif headline, figure texts, a footer hairline with counts, 2 or 3 note columns, the not-built list, provenance and the credit. It takes fill, dots and field figures. Its roles are §3's `Text`.

**`signal`** is the high-contrast poster: charcoal (`theme: "dark"`, paper `#111111`) or cream (`theme: "light"`, paper `#F3EEE4`), one signal colour (default lime `#C8FF00`, or `spec.accent`), a grotesque headline (Inter / Helvetica), archival `meta`, optional highlighter `mark`s. It draws a field or a fill (it rejects a figure with neither). The field's floor is the sheet's bottom edge. Field rows may pass behind type. The signal `list` is the stepped list: bold grotesque caps, 10 to 44px, each item a bullet and one step further in, four steps then back. Extra roles on top of loose: `meta` (0 or 1, 11px mono caps, ≤ 80 characters), `display` (0 to 2, 96px grotesque, ≤ 8 characters), `mark` (0 to 3, a block of the signal colour; no `text`; needs `h` 4 to 1190), blended over whatever it covers like a highlighter. On cream, the field's accent part is ink on a block of the signal colour, since lime type does not read on paper. `compose --frame signal` places the loose roles in the corners; the agent adds `meta` and `mark`.

**`loose`** draws a field (it rejects a figure without one) and nothing else of the swiss frame: no masthead, hairline, counts, notes or footer. The field's floor is the sheet's bottom edge, so the wave runs under the top and bottom edges and the terrain off the left, right and bottom. No field row may come within 8px of a text (`blocks-apart` exempts nothing in this frame). Text roles:

| role | Count | Size (min to max) | Line height | Font | Text |
|---|---|---|---|---|---|
| `label` | exactly 1 | 13 (11 to 16) | 1.2 × size | Commit Mono, caps, 0.17em tracking | prints `product.name` in capitals; no `text` |
| `headline` | exactly 1 | 42 (32 to 60) | 1.06 × size | Newsreader, −0.01em | prints `spec.headline`; no `text`. The only large type |
| `paragraph` | 0 to 2 | 15 (13 to 17) | 1.4 × size | Newsreader | `text`, ≤ 220 chars, ≤ 2 sentences |
| `legend` | exactly 1 | 15 (13 to 17) | 1.4 × size | Newsreader | `text`, ≤ 180 chars, ≤ 2 sentences; must name the accent part and the measure (`legend` check) |
| `list` | 0 or 1 | 13 (11 to 14) | 1.55 × size | Commit Mono, one item per line | `parts: true` (the field's parts' plain names, tree order) or `items` (1 to 16 names, ≤ 24 chars); no `text` |
| `rule` | 0 or 1 | 13 (11 to 14) | 1 × size | Commit Mono | `text`: one character, repeated across `w` |

A loose text takes `role, id, x, y, w, size?, align?` and `text`, `parts` or `items` as its role says; `hot` is swiss only. On a poster with a shape field `x` and `y` may both be left out, and `w` too (then the role's widest): `placeTexts` in `lib/place.mjs` places the block (see the shape field, Text placement), and `figure.texts[i]: give x and y together, or leave both out and the engine places the block` refuses one without the other. Sentences are counted by splitting on `.`, `!` or `?` followed by a space or the end. Validation messages: `figure.texts: <n> <role>s; use exactly <n>` or `use <lo> to <hi>`; `figure.texts[i].role: "<role>" is not a role in the loose frame; use label, headline, paragraph, legend, list, rule`; `notes: the loose frame has no footer; write paragraphs in figure.texts, or set frame to swiss`; `figure.regions: the loose frame draws a field; add a field region, or set frame to swiss for fill and dots figures`.

**Legend** (check `legend`, loose and signal). Case-folded, the legend contains a hot part's plain name (from `names` or the scanned name), unless the accent names no part (then `field-parts` reports it), and for each measure group of the field one word that starts with a word of the group: wave, radial and sphere `code` or `lines`; terrain `code` or `lines`, and `files` or `wide`; river `merge`, `join` or `flow`; shape `code` or `lines`, and `type`, `size`, `big`, `bigger`, `larger` or `area`; every field from scatter to contour `code` or `lines`. Message: `must say what the picture encodes; name the accent part ("<name>") and the measure (<groups>)`, groups written `"code" or "lines", and "files" or "wide"`. The groups are `measure` in the field's registry entry.

**Fits** (check `fits`, every frame). A field region's `fits` is required (≤ 160 chars) and has a word that starts with one of the field's keywords: wave `travel`, `flow`, `hand`, `move`; terrain `big`, `weight`, `matters`, `most`; river `merge`, `join`, `many`, `one`; radial `spread`, `out`, `from`, `centre`, `center`; sphere `curve`, `round`, `fold`, `flat`; shape `object`, `thing`, `picture`, `shape`, `looks`; and each generated field its own (`vyo shapes` lists them; `keywords` in the registry). Message: `region <id>: fits must say why a <field> matches the product's story; use "<k1>" or "<k2>" …`. A field poster's `figure.fits` is rejected: `figure.fits: a field poster says why it fits on its field region; move it to the field's fits`. The keywords are `fits` in the registry entry.

**Record** (loose and signal). Render writes one line, `<name> at <commit>, <long date>. Drawn by Vyo.`, 10px Commit Mono, 0.3px tracking, `mid`, the last full stop in `hot` with `data-hot`, as `[data-block=record][data-owner=render]`. `recordSpot` in `lib/frame.mjs` places it from the field's rows laid out with no text blocks: at x 40, y 1150 when a box 10px around it is clear; else rotated −90° at x 18, its foot at the lowest y (stepping up 10px from 1160) where the strip x 0 to 38 is clear for its length plus 10px; else at the bottom. `record: "bottom"` or `"left"` forces the side. Check `record`: exactly one record block; `product.commit` set (`the record line has no commit; set product.commit to the short hash (vyo compose --repo fills it)`); the text equals the line above.

**Corners.** `corners(rects)` in `lib/geometry.mjs` marks every 20px cell a field row touches, then for each sheet corner grows a rectangle row by row from the corner, keeping the run of empty cells from the edge. The winner has the largest area with its height counted up to 400px (ties: the larger whole area), among candidates at least 220px wide when there are any. Two corners on one edge whose sizes add past the sheet each give up half the overlap, rounded up to whole cells, except that on a left or right edge a corner narrower than 220px gives up all of it to a wider one (a strip that holds no text block, as beside a shape that bleeds). A bottom corner's height leaves out the 10px the last cell row hangs past the sheet. Returns `{ "top-left" | "top-right" | "bottom-left" | "bottom-right": { x, y, w, h } }`; an empty corner is `w` or `h` 0. `fieldSpace(spec, facts)` in `lib/render.mjs` lays the field out with no text blocks and returns its row rects (and, for a shape, one rect per span of its fills and shadow), their corners and the centre of the accent part's rows.

**Compose scaffold** (`vyo compose --field <f>`, loose by default). Compose lays the field out, finds the corners and calls `scaffoldPlaces(corners, accentCentre, partCount)` in `lib/frame.mjs`. Within a corner the room is the corner less 40px from the sheet's edges and 16px from the field; a bottom corner's stack ends 60px above the sheet's bottom, over the record. Usable corners have room at least 160 by 60. Assignment, in this order: `label` to the smallest usable corner, `headline` to the largest, `list` to the tallest, `legend` to the one whose centre is nearest the accent centre, `paragraph` to the one with most room left. Each block takes width `min(role width, room)` (label 220, headline 380, list 240, legend 260, paragraph 240) and the height of three quarters of its role's character limit at that width (54 characters for the headline; one line per part for the list). Blocks stack from the corner, 24px apart; right corners align right. A block that does not fit its corner goes to the corner with most room left; `list` and `paragraph` are left out when none has room. The scaffold writes `label`, `headline`, `legend` (placeholder `… what the picture encodes, at most 2 sentences and 180 characters: name "<accent name>" and the measure (<groups>)`, where the accent name is quoted only once `names` gives it, and is otherwise `the accent part by the plain name you give it in names`), `paragraph` and `list` (`parts: true`), the field region with a `fits` placeholder naming its keywords, and no `notes` or `notBuilt`. Without `--repo` it warns that the record needs a commit. `--field shape` writes `shape` as a placeholder string and a label, headline, legend and paragraph with no coordinates, adds `split` from `--split` and `style` from `--style` (rings, relief or symbols; relief when `--style` is left out; a usage error without `--field shape`), writes the legend placeholder as the style's model sentence (`… at most 2 sentences and 180 characters, like "Every <layer, ring or band of marks> is a part of <product>, <as big as its code, its area as big as its share of the code, or as big as its share of the code>. The orange <unit> is <the accent's plain name>."`), prints `texts: no coordinates. The engine places the label, headline, legend and paragraph in the room the shape leaves, …` in place of the corners and the shape format after the role lines; `--field shape --frame swiss` is a usage error.

## 3c. The cover frame

`frame: "cover"` (`lib/cover.mjs`, `lib/cover-render.mjs`, `lib/cover-page.js`, `lib/cover-report.mjs`, `lib/cover-sketch.mjs`). The spec:

- `ground`: required, one of `COVER_GROUNDS`: `navy`, `charcoal`, `forest`, `paper`. Anything else: `ground: "<v>" is not a ground[; a free colour is not offered]; use "navy", "charcoal", "forest", "paper"`. `theme` and `accent` are refused.
- `series`: optional, `\d{1,2}/\d{1,2}`, printed top right before `Vyo`.
- `figure.regions`: exactly one `{ kind: "field", field: "shape", ... }`; `fits` optional; `style`, `bevel`, `echo` and `shape.fit` refused; `strata` one of `COVER_STRATA` (`"outline"`, the default, `"down"`, `"diagonal"`) or the relief's object; `solid` `{ bevel 0–1, depth 0.2–1.5, tilt 0–1, groove 2–30 }` and `turn` `{ yaw 0–40, pitch 0–20, lean −30–30 }`, both optional.
- `figure.texts`: exactly one `{ role: "legend", id, text }`; any other key: `the cover places every block itself; remove <key>`.
- `motion`: absent or `{ kind: "turn" }`, no `frames` or `fps`.
- `notes`, `notBuilt` and `record` are refused.

`shape.like` names a ready silhouette in `SILHOUETTES` (`lib/silhouettes.mjs`), whose `ops` every frame and style paint and whose `solid` and `turn` the cover takes unless the region gives its own; `like` beside `ops` or `mask` is refused.

The model (`coverModel`): the shape fitted with `fit { w: 0.78, h: 0.5 }`, inflated by `coverSolid` on a 1.5px grid, sampled by `coverSurface` (front, back, and a rim between them where the surface slopes over 0.8), and fitted, over 24 poses, into the box between the top columns (`44 + max(3, headline lines) × 14.5 + 34`) and the legend (30px above it). The template wraps the headline at 230px and the legend at 330px with Inter Medium's advances (`coverWrap`), so Node and the page break the same lines; the name is 168px, or less when wider than 752px. `coverCells(m, f)` gives frame `f`'s printed cells (§3b of the prototype's README is the rule, ported exactly: under `{ by: "depth" }` and the angle strata the shipped cells match the prototype's reports frame for frame), and `coverMeasure` its shares, gap, accent cells, whole names and letters. For `"outline"` the accent's share of the cells, in depth order, is cut first, and the rest stack by height. `coverStill` measures frames nearest 55% of the turn first and stops at the first band where every part of 2% or more prints whole; this is the frame a full sort of all 168 gives. `coverShell` gives the accent's depth in sheet px at the still and the depth any share would reach.

The page: a canvas under five text blocks, `record`, `headline`, `number` and `series`, `legend` and `name`, each placed on the prototype's baselines with Inter's ascent and descent. Node passes the still's frame; the page draws it at 2× and sets `window.cover { frames, still, report }`. `window.coverFrame(f, scale)` draws a frame and returns its measurements; `window.coverSteps()` the glyph changes per step. `render --gif` draws every frame at 1×, screenshots it, collects the reports and steps into `page.loop`, draws the still back, and writes the GIF at 12 fps in 32 colours without dither and the MP4 at 24 fps.

The checks: `cover-shell` (spec stage) on Node's still; `cover-names`, `cover-share`, `cover-accent` and `cover-seam` (page stage) on `page.cover.report`, and on every frame of `page.loop` when the GIF was drawn; `vyo sketch` runs all five on Node's still. `shape-dominant`, `shape-simple`, `shape-limb` and `shape-thin` judge the silhouette fitted as a poster would fit it. `fits`, `field-parts`, `notes`, `blocks-apart` and `blocks-inside` do not run on a cover: its template places every block. `record` checks the cover's three record lines; `fonts` checks Commit Mono 400 and 700, Inter 500 and Inter Display 600; `still` checks that the canvas shows the still's frame.

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
- `A` to `F` mark the rows of the first to the sixth fill or field region, `#` marks dots, `=` marks the footer top, and `·` marks hot rows.
- Text blocks print as boxes labelled with their ids, with heights estimated at 7.2px per character for mono text, 88px per masthead line at size 84, 28px per headline line at a 224px width, and the line heights of §4.5 for displays and labels.
- A field's rows come from its layout module (§4b) with the estimated text blocks and a fixed advance of 0.6 × size per letter. Its `regions:` entry reads `<letter> <id> (<kind>, <n> parts, <rows> rows)`, and `! region <id>: part "<name>" (<part id>) is never drawn` or `! region <id>: accent <accent> names no part` follow the other notes.
- Under the sheet it prints, in order: `regions:` (letter, id and row count per region), `texts:` (each box's corners), `floor: <y>`, the coverage, height and width (as `silhouette` measures them, each marked ok or too low), and one `region <id>:` line per fill region with its spread over mean and mean width, as `row-variety` and `thin-region` measure them (or `regions: no fill rows`). Notes that start with `! ` follow: a region under 4 rows, a word that may never be drawn, a region or text below the floor, and the `row-variety` and `thin-region` messages.

A shape field marks the mask instead of rows: its letter on each cell whose centre the mask covers, `@` in the accent. Its `regions:` entry reads `<letter> <id> (shape, <n> parts; @ marks the accent band)`, followed by `shape: covers <n>% of the sheet (needs 35%, a relief 18%), <w> by <h>px (fit.w <v>, fit.h <v>), bleeds <edges or nowhere>` and the style's own lines, below. It prints every `shape-*` message, measured on the Node layout with the placed text blocks, as `✗ <id>: <message>` when the check fails render and `! <id>: <message>` when it warns, so a finding has one level in both; two text blocks that overlap print `✗ blocks-apart: text blocks "<a>" and "<b>" overlap; move one`. After the sketch, `vyo sketch` prints the spec's errors that do not block it as `✗ spec: <error>` and runs every spec-stage check but `spec` and the `shape-*` ones (those are already among its notes) on the spec and the facts, printing each finding as `✗ <id>: <message>` or `! <id>: <message>`; it still exits 0. A shape in rings marks `@` where the accent's fill is and prints `rings: <n> rings of 7px fit (the shape is <w>px across at its thickest; <p> parts want about <m>)`, then `, then a core of <k> level lines` when it has one, `parts, outline in (* the accent): rings, core lines, share of the shape's area for share of the lines` and one line per part, `  <* or space> <name> <r> rings, <k> core lines, <a>% of the area for <l>% of the lines`. `vyo sketch` then writes `<repo>-sketch.png` beside the spec, 280 by 397, and prints `sketch PNG: <absolute path>, …`: the sheet at a third of its size, each pixel the average of 3 by 3 samples, every crease (a capsule's or arc's centre line, another kind's outline, painted as the relief paints it) as a line of `paper` pixels, and the text blocks outlined in `mid`; for rings, every fill in its order (the light theme's `ink` shape, the core, the accent) and each glyph's origin blended 40% toward its tone. `lib/png.mjs` encodes it with Node's zlib. A relief marks each cell with its light as `·:-=+*#` from dark to lit and `@` in the accent stratum; its entry reads `(shape, <n> strata; @ marks the accent stratum, ·:-=+*# the light)`, followed by `relief: bevel <b> (<R>px rounded), strata <at n degrees or by depth, outline in>; thumbnail lit side <n>% (needs 25.0%), spread <n>% (needs 22.0%)` and one line per stratum, `  <* or space> <name> <a>% of the area for <l>% of the lines, <g> glyph cells, whole name <k>x`, the accent's with `, <t>px thick`. Its PNG is the predicted thumbnail.

In the loose frame the sketch draws no `=` line, prints `floor: the sheet's bottom edge (loose frame)` and then one corners line, `corners: top-left at <x>,<y> is <w> by <h>; top-right at …; bottom-left at …; bottom-right at …`, from `corners()` over the field laid out with no text blocks. The record line is among the `texts:` entries as `record <left>,<top> to <right>,<bottom>`.

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

## 4b. Parts and fields

### Parts

`partsFromFacts(facts, { minShare, maxParts, split, names })` in `lib/parts.mjs` returns `{ id, name, loc, files, order }[]` in tree order (parents before children, siblings by name). `regionParts(region, facts)` adds `hot` from the region's `accent`.

1. Every file of `facts.files` without `gen` starts in its nearest ancestor-or-self area with `meta.leaf`, or in its own area when none is a leaf or that leaf is in `split`.
2. A part under `minShare` of the total lines merges into its parent area (the nearest enclosing area, else `area:.`), deepest first, until every part is at or above `minShare` or sits at the top level (`area:.` or one segment deep).
3. While there are more than `maxParts` parts, the smallest part other than `area:.` merges into its parent.
4. A part's `name` is `names[id]`, else the area's scanned name. `loc` and `files` count the files in the part.

The parts hold every non-generated line and file exactly once. `dominance(facts, options)` returns `{ part, share, count, split }` when the largest part holds over 75% of the lines or there are under 4 parts (`DOMINANT`), else null; `split` is `{ id, count, largest }`, what adding the largest part to `split` gives, or null when that adds no part. `vyo parts` prints it as a last `!` line: `! "<name>" (<id>) holds <n>% of the lines among <k> parts; as a shape's accent it draws one slab of orange. Split it into the folders inside it: vyo parts <facts> --field shape --split <id> gives <m> parts, the largest <l>%; then write "split": ["<id>"] in the region and put the accent on one of them.`, or `…, and it has no folders inside it to split: put the accent on a smaller part.` `unplainName(name)` is true for an all-caps name, a name holding a company name from `VENDORS` in `lib/scan/detect-services.mjs` (the service and AI vendors the scan detects, plus common hosting and data platforms), or one word ending in a digit. `accentIds(parts, accent)` resolves `accent`: a glob over part ids; else the part with that id; else every part inside that area; else the nearest part the area merged into, never `area:.` by that fallback.

### Fields

`FIELDS` in `lib/fields/index.mjs` is `{ [kind]: { about, options, parts?, measure, fits, layout, ground?, tokens, behindTexts, texts?, frames? } }`: `parts` overrides the part defaults, `ground` returns fills drawn under the rows as `{ part, hot, tone, rows: [y, spans][] }` (the shape only), `frames` limits the frames the field draws in, `measure` and `fits` are the legend's and fits' words (§3b), `texts` places the swiss frame's texts. `layout(region, parts, { floor, mirror, theme, frame, blocks, measure })` returns row items `{ x, y, width, height, size, text, spacing, part, word, hot, tone, alpha?, lineHeight?, weight? }`. `floor` is the footer top, `mirror` is true when the masthead's centre is right of the sheet's middle, `theme` is the spec's, `frame` is the spec's frame, `blocks` are the text blocks' rects and `measure(text, size)` the text width. The page uses canvas measurements and its laid-out blocks; `sketch` uses 0.6 × size per letter and estimated blocks. The advance is rounded to 0.05px, so both place every row within 2px given the same blocks (`test/run.mjs` checks this on the field presets).

The wave and the terrain set text in Commit Mono 400 at the mockups' 6.9px and keep inside x 0 to 838 and above the floor. Terrain cuts every row around the text blocks padded by 12px (`clearOf` in `lib/geometry.mjs`); the wave runs on behind them. The advance is rounded to 0.05px, since the page measures 4.134px at 6.9px and the sketch assumes 4.14.

**`wave`** (`lib/fields/wave.mjs`, after `explorations/2026-11-07-abstract-fields/f-wave-paper/`, tinted as `a-wave/` on dark):

- Row slots sit 7.9px apart from y 0 to the floor, 7.9px tall: about 113 above a 900px floor. No slot is cut around the text blocks: the band passes behind the masthead and the other figure texts, which render sets above the rows with a 6px paper halo (a copy of each block one layer down, its letters transparent and its `text-shadow` paper; see `text-clear`).
- The slots go to the parts by lines, largest remainder first, at least one each, in tree order, top to bottom. With fewer slots than parts, the last parts go undrawn.
- At row top y, with `u = (y + 14) / 1190`: centre `130 + 560·(0.6·smoothstep(u) + 0.4·u) + 95·sin(6.4u + 0.4)·(1 − 0.5u)`, mirrored across the sheet when `mirror`; half-width `150 + 40·|cos(6.4u + 0.4)|`; letter spacing `0.5 + (half − 150) / 12`. The band enters at the top behind the masthead, swings right, back left across the middle and leaves through the floor.
- A row's text is its part's name in lower case and three spaces, repeated letter by letter from the run's left edge while letters fit. Every `every`th row (`i % every == every − 1`) carries `sentence` instead, when given.
- Tone: accent parts take `ink` on light, as in f-wave-paper, and `hot` on dark. Other parts at most two segments deep (and `area:.`) take `wave` (#7A64DC) on light and `mid` on dark; deeper parts `wave-soft` (#907EDD) on light and `soft` on dark. `wave` and `wave-soft` are the field's own tokens (`tokens` in its registry entry): render declares them, and `palette` allows them in the field's rows only.

**`terrain`** (`lib/fields/terrain.mjs`, after `e-terrain/`):

- Peaks sit left to right across x 0 to 840 in tree order. A peak's width is its share of files; a part under 40px gets 40px and the others share the rest. Its height is `loc × scale`, where `scale` puts the tallest at `0.32 × floor`, and is at least 2 rows above the foot.
- The base is 70px under the floor. The ridge is the p-norm (p = 4) of each peak's bump `height × exp(−1.1 × (|x − centre| / (1.25 × width + 30))^1.5)`, and never lower than the foot, 2 rows above the floor, so no valley cuts the range.
- Rows are 7.6px apart, bottom to top from the floor. At each letter position the ridge must reach the row's level. The letter belongs to the part with the tallest bump there, except inside a foothill: under the peak whose centre is nearest, within half its width, up to a height that falls from its own bump to the foot at its edges. A small part under a big neighbour shows as a pointed hill. Two letters of gap open where the part changes.
- A run starts its part's name from the first letter. A word in progress runs on over a border into the next part's slope; at a foothill's border the run instead ends on its last whole word and the foothill's name starts where the cut word began. A name breaks only where the ridge drops below the row.
- The advance is `0.94·cw + 1.5·min(|slope|, 1.6)`, rounded to 0.25px. Tone: `hot` for accent parts; `ink` within 9px of the ridge; `mid` elsewhere. Opacity, in steps of 0.1 from 0.22 to 1: `0.42 + 0.5·lit − min(0.2, depth / 1600)`, plus 0.35 at the rim and 0.3 for the accent, where `lit = clamp(0.5 + slope / 2)` so slopes facing left catch the light. A run of letters with one part, tone, opacity and advance is one item, with `alpha` set.

**`river`** (`lib/fields/river.mjs`, after `g-flow/`):

- Parts default to `minShare` 0.002 and `maxParts` 24 (`parts` in the registry entry), so a river shows many streams. `partTies(parts, facts)` in `lib/parts.mjs` counts `facts.imports` between parts (a file's part is the deepest part that is its area or an ancestor; generated files are left out) as `[i, j, count]`; render passes them as `region.ties`.
- Merge tree: start with one cluster per part; repeatedly join the two clusters with the largest `imports between them / √(loc_a × loc_b)` (average linkage), the one earlier in tree order on top.
- Thickness: the leaving channel is 0.2 × floor; a part is `loc / (total / (0.2 × floor))` px thick, at least 3.6px, and a part thinner than that draws fewer digits (density `loc-thickness / 3.6`, never under 0.4, so no part vanishes). Streams enter stacked across y 0.2 to 0.78 × floor with 4 to 40px between them, centred; a cluster's centre is its kids' thickness-weighted mean.
- A cluster of height h (merges below it) starts at `x = −30 + 630 × (0.22 + 0.78 × (h / root height)^0.9)`; the last merge is at x 600 and the channel runs off the right edge. Each ribbon's centre eases (quintic smootherstep) from its start to its slot in its parent.
- Texture: 5px Commit Mono digits in 3.1px cells on 5px rows. A cell's density is 1 within 60% of the ribbon's half-thickness, falling to 0 at its edge, times the stream's density; the cell draws a digit when `hash(c, q) ≤ density^1.4`, `0` or `1` by `hash(c + 977, q + 31)` (`cellHash`, the same in Node and the page). No part name is ever printed.
- Tone: the accent part's own stream and 3 rows by 17 cells from x 590 on the channel's centre are `hot` at alpha 1; other leaf streams alternate `ink` and `mid` by part index; merged channels `ink`. Alpha `0.3 + 0.48 × density`, in steps of 0.2. A run is one row's cells of one part, tone and alpha, gaps as spaces.

**`radial`** (`lib/fields/radial.mjs`): rows of part names on horizontal chords that widen from an apex near the top of the sheet to the floor, one row per share of lines. Size 5.6px on 6.4px pitch. Accent rows take the signal colour on a signal-dark sheet.

**`sphere`** (`lib/fields/sphere.mjs`): a 3×5 grid of type-built ellipses that flatten down the page, one cell per share of lines. Size and pitch as radial.

**`scatter`** (`lib/fields/scatter.mjs`): 5 to 12 ellipses of type, jittered across the sheet, with gaps between the clouds. Seed 0 draws eight fixed clouds.

**`shatter`** (`lib/fields/shatter.mjs`): a regular grid of cells. A fault line shifts the cells on one side along the fault, and about 10 to 25 percent of the cells are dropped.

**`glyph`** (`lib/fields/glyph.mjs`): one built-in 8×12 letter, scaled to about 55 to 80 percent of the sheet height and filled with type. `letter` is one of A–Z or 0–9; the default is A.

**`bleed`** (`lib/fields/bleed.mjs`): one large ellipse whose centre is off the sheet. Only the intersection with the sheet is filled.

**`slabs`** (`lib/fields/slabs.mjs`): 6 to 12 horizontal slabs with gaps between them. Widths follow part shares; the left edges stagger.

**`spiral`** (`lib/fields/spiral.mjs`): a thick stroke along an Archimedean spiral `r = a + bθ`, scanned into horizontal chords. Not a sine.

**`contour`** (`lib/fields/contour.mjs`): two to four Gaussian hills and four to seven thick iso-bands, nested rings rather than a wave.

Every field takes `seed`. Omitted or 0 is the identity. A non-zero seed is mulberry32 and poses the silhouette: crop, scale, anchor, mirror, a small rotation in mask space rescanned to horizontal chords, density, and an optional circular void. The new fields also move their own parameters (cloud count, fault, letter, and so on). The masthead's mirror is not applied twice, and the glyph never mirrors. A posed wave, terrain, river, radial or sphere keeps, run by run, the part and tone that drew it, so its legend still holds. A pose that crops a part away, or leaves the figure under 55% of the floor's height or 60% of the sheet's width when the unposed form reached them, softens: first without crop or void, then at scale 1 without rotation, then unposed. A mask field whose seeded form is under that minimum on its own grows, up to twice its size, about a point that keeps it on the sheet.

**`shape`** (`lib/fields/shape.mjs` over `lib/mask.mjs`):

- The mask. `shapeMask(shape)` turns each op into closed rings in its own units (circles and ellipses as 64-gons, rounded corners as 8-segment arcs, arcs flat-ended, paths flattened by `parsePath`), turns it by its own `rotate` about its box's centre and by the shape's `rotate`, then measures the painted extent on a 1000px probe, cuts counted. It scales that extent uniformly by `fit` (without `fit.w` or `fit.h`, the largest scale that fits inside `SHAPE_ROOM`: 40px from the sides, 250px from the top, 56px from the bottom, the shape standing on the bottom margin and centred across; with the engine's `room: { top }`, that top in place of 250 and the shape centred down the room; with one, `fit.cx` and `fit.cy` default to 0.5 and 0.61) and paints every op again, in order, into one span list per sheet row: each row samples its centre with the nonzero rule, an `add` unions and a `cut` subtracts. The result is `{ runs, area, box, fit }`: `runs[y]` the sorted `[left, right]` spans of row y clipped to the sheet, `area` the px covered, `box` the fitted extent with bleed, `fit` its share of the sheet. Nothing downstream reads the ops.
- Fills (`ground`). A style's rows of spans, each in a theme token, the accent's in `hot`. Type on the accent in rings is `on-hot` (#161616 on light, #0E1424 on dark), the field's own token (`SHAPE_TOKENS`). The page draws each fill as a full-sheet `div` with `data-region`, `data-part` and `data-hot`, coloured by `background` and clipped by `clip-path: path()` from `runsPath`: each span sampled at its row's centre and joined to the outer ends of the spans it touches one row down by a trapezoid, centre to centre, with a half-row strip where nothing touches above or below, so slanted edges stay smooth.
- `SHAPE_STYLES` in `lib/fields/shape.mjs` maps a region's `style` to the function that reads the mask, called as `(mask, parts, { ...frame, region })`; `rings`, `relief` and `symbols` ship, `relief` is the default (`DEFAULT_STYLE`), and a further look is another entry over the same mask. A style returns `{ rows, ground }` and `findings` (check id to messages; relief's is a function of the rows as drawn, since its name and share checks read the page) and `summary` (the sketch's lines; relief's is a function, so the page never runs its thumbnail prediction). Relief also gives the sketch `ascii(x, y)` and `picture()`, and the page `sheet`, rows of marks on the sheet outside the shape. `mask.xf` (`{ s, tx, ty }`, shape units to sheet px) lets a style paint a single op with `paintRows`.
- Rings (`lib/fields/shape-rings.mjs`, after `explorations/2026-11-09-shape-fields/c-contour/`). `ringField(mask)` gives the signed distance at every pixel centre (positive inside) from two exact transforms (`edt` in `lib/mask.mjs`), its slope over ±2px, and each cell's lowest and highest corner. Ring i is the iso-line at 3.5 + 7i px, traced by marching squares inside the mask's box; a line that leaves the box is open. Each line is resampled every 1.5px and averaged over ±min(level, 14)/3 samples, wound clockwise, and starts at its seam: its lowest point, a little toward its middle. A loop with more than 30% of its samples (every 3px) within 4.2px of a pixel whose slope is under 0.55, or any loop once what lies deeper than its ring is 10% of the shape's area or less, encloses a core: the pixels at depth ≥ 7i flood-filled from it, so long as they are no more than the loop encloses (a loop round a hole encloses no core). Ring order encodes nothing. Ring 0 is a rim, held by the non-accent part whose share of lines is nearest ring 0's share of the area; the accent takes rings 1 to e, whole, e the ring edge nearest its share and at least 1 + 2 (the sketch prints `the accent's share fills under 2 rings, too thin to show at thumbnail size, so it takes 2 (14px) and more area than its share` when that floor holds). The other parts, in tree order, the rim's part with its lines less ring 0's share, then run from ring e: `allotRings(parts, ringAreas, coreRows, least, start)` places each part by ring coordinate u (ring ⌊u⌋, the fraction u − ⌊u⌋ of the way round from the seam): the boundary after part k sits where the area inside `start` reaches its share of those parts' lines, a ring's area spread evenly along its loops, at least `least(k, u)` past the previous boundary (two copies of the name; the accent 2 rings), snapped to a whole ring within 0.04. Past the last ring, the parts left split the core's pixel rows top to bottom by area. Names are set outline first: per ring, per part, per loop arc, ⌊arc / ((name + 3) × 0.6 × 6.6)⌋ copies, evenly spaced, a closed whole ring starting half a span in on odd rings; each letter's centre on the line 3.96px from the last; a copy is dropped when two letters' headings differ by over 24°, a letter centre lies within 2.3px of the skeleton, or a letter centre is within 4.75px of one already set; a middle dot goes between two kept copies. A copy whose mean heading points left is set in reverse order and turned half round. The core is set in horizontal lines 7px apart, each line the spans at least 2.4px inside the core over the letters' height, holding whole names centred. Every row is `{ x, y, width, height, size, text, glyphs, weight, part, word, hot, tone, lean }`: `glyphs` is one `[x, y, degrees]` per character, the origin on the baseline (0.34 em below the line) and the turn; the box is the union of the glyph cells (advance by 0.8 em up and 0.2 em down). Ground, in order: the echoes (`soft`, alpha falling from 1 on dark, 0.7 on light, by 1/echo each), the light theme's whole mask in `ink`, the cores (`cold` on dark, `cool` on light), the accent's whole rings by depth and its partial rings by nearest ring point (rows), and the hairlines as 0.64px ribbons (`ink` on dark, `paper` on light) along the edge of the ring each part starts on (outer edge from the cut on, inner edge before it, and a tick between), along each core's edge and across the core between parts.
- Text placement (`lib/place.mjs`, Node only; render and sketch call it before they read the texts). The room is a 4px grid: 40px from the sheet's edges, the mask grown by 20px, the record line by 10px and each block with coordinates by 22px are taken. Blocks without `x` and `y`, in the order label, headline, legend, paragraph, list, rule, go as one column; else, when the shape is the engine's to fit (no `fit.w`, `fit.h` or `fit.cy`, no pinned block), the shape gets `room: { top }` at 40 plus the label, headline and legend stacked at the headline's widest plus 32 (`PLACE.gap`), and if that keeps at least 85% of its scale (`PLACE.shrink`) the blocks go as one column or as those three then the rest around it; else, around the shape where it was, as those three then the rest, as label and headline then the rest, or one by one: a column `width` px wide (from the widest of its roles' widest, label 300, headline 520, legend and paragraph 300, list 240, rule 300, down by 20 to the narrowest of their narrowest, 120 to 240) holds each block as wide as its role allows, flush to the column's side, 10px under a label and 22px under anything else, heights estimated at 1.12 × the role's average advance. The headline tries its default size, then 38, 35 and 32px, and its lines are wrapped by Newsreader's own advances (`serifLines` in `lib/frame.mjs`, with the frame's tracking). A relief stacks its headline instead (`PLACE.stacked`): from 60px down in 4px steps, the narrowest column from 240px up in 20px steps whose headline takes at most 4 lines, the label 18px above it and the legend under it as wide as that column within 240 to 330px. Every grouping is tried first with headline columns at least 400px wide, then with the full range. A column takes the first free spot from the top in 8px steps, at the x nearest a side margin, and aligns away from the shape (right when its centre is right of the mask's). Placed blocks take their room before the next group. When no grouping fits, the blocks stack 22px apart from 40,40 and `shape-room` reports them. Once placed, a shape the engine fits whose every block ends more than 32px above it gets `room: { top }` 32px under the lowest block: `shapeMask` then scales it to the smaller of the side margins and the room from that top to the bottom margin, and centres it in that room. `room` is the engine's: the spec rejects it, and only the placed spec, which render, sketch and every `shape-*` check read, carries it.
- Feedback (`lib/shape-report.mjs`, Node only). `shapeReport` lays the region out with the fixed advance; `shapeFindings` measures the mask for the `shape-*` checks (§6): thin features and cuts by a morphological opening on a 2px grid with exact distance transforms, free corners by `corners()` over the spans grown by 16px.

**`relief`** (`lib/fields/shape-relief.mjs` over `lib/mask.mjs`, after `explorations/2026-11-09-shape-fields/a-relief/`; `RELIEF` and `RELIEF_TONES` hold every number below):

- Surface (`reliefSurface`), on a 2px grid of the mask (`maskGrid`). `dIn` is the exact Euclidean distance to the outline (Felzenszwalb); off the sheet is not an outline, so a bleed is not bevelled. The dome is a quarter circle of radius R = max(8, bevel × the deepest `dIn`), softened by a three-pass box blur of radius R / 4, plus 0.45 × a quarter-circle pillow of radius min(12, max(4, 0.22 R)) off every seam between strata, less a valley 14px wide and 12.6px deep along every crease. A `face` cell is instead 0.35 × the dome + 0.3 × the pillow ± 0.55 × its distance along the light's direction in the plane (lit toward, dim away); a later add without a face rounds its cells again. Light is Lambert from (−0.62, −0.78, 0.75) normalised, mapped so a flat top is 0.5, plus 0.35 × a Blinn specular to the power 60.
- Strata (`reliefStrataKey`, `reliefCut`). Each cell's key is its distance along the strata angle (or its `dIn`, for depth); cells sorted by key are cut in tree order, each part exactly as many cells as its share of the lines, so a level seam may step partway along a line. The type's strata are cut again by the same key over the glyph cells, so each part is owed its share of the glyphs, even in a 3px shell; the 2px labels drive only the shading's seams.
- Type. 6px Commit Mono on a fixed grid: 0.6 em columns, 1.04 em lines, a 2px margin each side. Each line is set word by word, a word being its part's name and two gap cells. Where a word starts it takes, of the parts under the next 14 glyph cells, the one owed the most cells: each cell adds one to its own stratum's part and takes one from its word's part, so glyph shares follow the lines. A word runs to its end across any seam and stops only at the outline; a line entering the shape starts (line × 7) mod (name + 2) cells into its first word. A part still without a whole name writes it once over the line stretch that holds most of its own cells. Strength is clamp(0.5 + 1.5 (ink − 0.5)), where ink is the light on the dark sheet and 1 − the light on paper, and at least 0.6 within 5px of the outline. A gap cell is blank under 0.3, `·` under 0.7, else `:`. Alpha is 0.3 + 0.7 × strength^1.1 in twentieths, weight 700 above 0.42. Each line's run of one word's part is one `.row` (`data-part`, `data-word`, `data-hot`) of `spans`, `{ text, alpha, weight, tone, glow? }`, merged while the look holds. Letters are `ink`; the accent's are bold `hot`, at 0.55 + 0.45 × light on the dark sheet with a 2.5px `hot` text-shadow, and at 0.88 + 0.12 × strength on paper.
- Ground: only the glow, the accent's drawn letter cells in `hot` at 0.55 alpha and a 7px blur (paper: 0.4 and 5px). No haze, body or shadow fill. `fill.js` draws a ground's `alpha` as opacity and a `blur` as `filter: blur()` on a full-sheet wrapper, since a filter on the clipped fill would be clipped too.
- Sheet (`sheet` in the style's result, `FIELDS.shape.sheet`). A `·` in `ink` on every other glyph cell outside the shape, and on every cell where the cast shadow reaches 0.08: the mask moved 4.5% and 6.5% of its short side right and down, softened over 7% of it. The dot's alpha is 0.12 × (1 − shadow) on the dark sheet and 0.07 + 0.38 × shadow on paper, in hundredths, and under 0.015 it is left out. `fill.js` draws the sheet first, as `.sheet-marks` lines that no check reads, and blanks each mark within 10px across or 8px down of a text block or the record line.
- Prediction (`reliefThumb`, `reliefTone`, Node only). The 280px thumbnail composited in the page's order: paper, each ground with its blur (three box passes of radius blur / 3 − 0.5), then each glyph cell laying its alpha × its ink cover (a letter 0.2 regular and 0.3 bold, `·` 0.035 and 0.06, `:` 0.07 and 0.11) over its area. Against the real thumbnails of the Pantry jar and the Hypher plane on the dark sheet, `lit` read within 0.02. `lit` is the 90th percentile of the shape's contrast with the sheet, on either sheet, since the letters are the ink; `spread` the 10th to 90th. The sketch PNG is this prediction.
- Findings (`findings(rows)`): `shape-accent` from the accent stratum's thickness, `shape-name` and `shape-share` from the rows given (the page's, at page stage), `shape-tone` from the prediction.
- The result is cached on its inputs (shape, bevel, strata, parts, theme), so the page's ground and rows and every check share one layout; new colours only redo the prediction. The layout runs in the page, so the page's HTML does not grow with the shape.

**Terrain on paper.** The light theme adds 0.14 to every letter's alpha and 0.5 (not 0.3) for the accent, as i-loose did, because the dark alphas wash out on paper (`TERRAIN.lift`). Signal themes skip the navy lift and use charcoal or cream.

### In the page

Render computes each field region's parts and embeds them, with `floor`, `mirror`, `theme` and `frame`, in the figure JSON. A traced shape's image goes in the figure's `images`, by mask name, because the page cannot read a file; `fill.js` hands them to `setMaskImages` in `lib/mask.mjs`, which Node's loader `lib/png-mask.mjs` sets on import. It concatenates `geometry.mjs`, `mask.mjs`, then `fields/pose.mjs`, `fields/wave.mjs`, `fields/chords.mjs`, every other `fields/*.mjs` in name order, then `fields/index.mjs` (imports dropped, exports unwrapped) before `fill.js`; `test/fields.test.mjs` compiles that script, so two modules that declare the same top-level name fail the suite. Each item becomes a `.row` with `data-region`, `data-part`, `data-word` (the part's name or the sentence) and, for accent parts, `data-hot`, at the item's `weight` (default 400), `lineHeight` (default its height) and `alpha` as opacity. A field's `ground` fills are drawn first, each clipped by its own `path` when it has one (nonzero) and by `runsPath(rows)` otherwise, at `alpha` as opacity. A row with `glyphs` is an SVG `<text class="row">` in one SVG over the sheet, with per-character `x`, `y` and `rotate`, `white-space: pre`, and `fill` and `color` in its tone; `lib/inspect.js` reports its scroll and client widths as 0.

---

## 5. The footer

Swiss frame only; the loose frame has the record line instead (§3b). The footer is one fragment that render builds and places at `top = 1190 − footerHeight − 36`. `footerHeight` grows with the notes count and with each line the not-built list wraps to. That top is the figure's floor (§4.5). With the current footer constants and a one-line not-built list, it is 884 for 3 notes and 920 for 2. Top to bottom:

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
| `facts-empty` | ! | Swiss frame only. `facts.empty` is true: the scan found nothing to count, so the footer shows provenance only. The loose frame has no counts line, so it never fires there |
| `product-name` | ! | `product.name` equals `facts.repo.name`, the folder name. Message: `product name equals the folder name "<name>"; write the name customers see, capitalised as the product's own docs write it. If the docs write it exactly "<name>", keep it: this warning only asks you to check` |
| `preset-copy` | ! | Every region's geometry equals a preset region's geometry, numbers compared exactly. Field regions are left out, and a figure of only a field never trips it |
| `part-name` | ! | A part a field draws has the product's name in its name, has no entry in `names`, or shares its name with another part, ignoring case: `parts <id> and <id> are all called "<name>"; give each a plain name of its own in names`. Also a key in `names` that is not a part |
| `part-unplain` | ✗ | A part a field draws still has an unplain name: all caps, a company name the scan knows, or one word ending in a digit. A scanned name left in place trips it, since `names` replaces the scanned name. Message: `part "<name>" (<id>) looks like a vendor or code name; add a plain name in names` |
| `accent-part` | ! | A field region has no `accent`. Message: `no accent part in region <id>; set accent to the id of the part the poster is about (vyo parts lists them)` |
| `legend` | ✗ | Loose and signal. The legend names the accent part's plain name (case-folded, anywhere in the text) and the field's measure: a word that starts with "code" or "lines"; a terrain also "files" or "wide"; a river "merge", "join" or "flow". Message: `must say what the picture encodes; name the accent part ("<name>") and the measure (<words>)` |
| `fits` | ✗ | A field region's `fits` has a word that starts with one of the field's keywords: wave "travel", "flow", "hand", "move"; terrain "big", "weight", "matters", "most"; river "merge", "join", "many", "one"; radial "spread", "out", "from", "centre", "center"; sphere "curve", "round", "fold", "flat". Message: `region <id>: fits must say why a <field> matches the product's story; use "<k>" or …` |
| `one-region` | ! | The figure is a single fill region with no hot rows and no hot label. A figure with dots, or with more than one region, never trips it |
| `shape-dominant` | ! | Spec stage. `dominance()` in `lib/parts.mjs` names the largest part and, with `split` plus its id, what `partsFromFacts` cuts it into. No part of a shape is one slab. When the largest part holds over 75% of the lines, or there are under 4 parts, and it has folders inside it, split it: `the accent "<name>" holds <n>% of the lines and the shape has <k> parts, so every style draws it as one slab; add "split": ["<id>"] to the region to cut "<name>" into the folders inside it (<m> parts, the largest <l>%), then put the accent on the one the story is about (vyo parts <facts> --field shape --split <id> lists them)`, or, when it is not the accent, `"<name>" holds <n>% of the lines and the shape has <k> parts, so it draws as one slab around the accent; add "split": [...] …; the accent stays where it is`. With nothing to split, only an accent over 75% speaks: `the accent "<name>" holds <n>% of the lines, so <style> draws it as one slab of the accent; "<name>" has no folders inside it to split, so put the accent on a smaller part`. A small accent among few unsplittable parts is silent: nothing would change the picture |
| `shape-simple` | ! | Spec stage. More than 8 adds and cuts (creases do not count), or 3 or more adds or cuts of one kind whose areas, each painted alone, are under 10% of the mask and within 30% of each other. Messages: `the shape has <n> ops; past 8 a silhouette stops reading as one object at thumbnail size, so simplify it: one object with one telling feature, in 3 to 6 ops` and `ops <i>, <j>, <k> are <n> <kind>s of about <p>% of the shape each: small repeated details like wheels or windows merge at thumbnail size, so drop them or draw them as one shape` |
| `shape-limb` | ! | Spec stage. `limbFindings(mask)` in `lib/shape-report.mjs` reads the mask's row widths, `SHAPE_LIMB`. No even limb under 25% of a shape's widest row runs from its top or bottom over 25% of its height while holding at most 15% of its area (at least 80% of its rows within 1.5 times its median width, so a tapering tip is not one). The cold run's mailbox post took 32% of the height for 10% of the area and read as a signpost; a flask's neck, at 32% of its body's width, passes. Message: `a thin limb at the <top or bottom> (y <a> to <b>, <w>px wide) takes <h>% of the shape's height for <n>% of its area; at thumbnail size the object reads as a post with a small head, and its parts there are too narrow to read, so shorten it to under 25% of the height or drop it` |
| `shape-thin` | ! | Spec stage, every shape field. On a 2px grid, the cells of the mask that a disc 18px across cannot reach (an opening by exact distance transforms; off the sheet counts as shape), and the paper cells inside the shape's box that such a disc cannot reach, grouped 4-connected; a group of at least 324px² is reported with twice its deepest distance as its width. Messages: `the shape is <n>px thick near <x>,<y>; under 18px it is a hairline at thumbnail size, so make that feature at least 18px thick or remove it` and `a cut in the shape is <n>px wide near <x>,<y>; under 18px it closes up at thumbnail size, so widen the cut to at least 18px or remove it` |
| `shape-cover` | ! | Spec stage. The mask covers at least 35% of the sheet; a relief, 18%, since it is drawn by its type's density over a dot grid and a thin form with air round it still reads (the Hypher plane covers 21%). Message: `the shape covers <n>% of the sheet; it needs 35% to read as the picture, so scale it up <k>x (set fit.h to <v>, it is <v0>) or draw it fatter` when fit.h (or fit.w alone) is given, the new value differs from the old and the scaled shape stays on the sheet (k is 1.02 × √(0.35 / cover)); otherwise `…, so draw it fatter: it fills <p>% of its <w> by <h>px box[, already as large as the room the text leaves]; thicken its thin parts or make it closer to as tall as it is wide` |
| `shape-edge` | ! | Spec stage. A shape whose box runs off an edge by more than half a pixel and less than 5% of its own width (left, right) or height (top, bottom) reads as cut by mistake. Message: `the shape runs <n>px off the <edge> edge, too little to read as a bleed, so it looks cut by mistake; leave out fit.w and fit.h to fit it inside the sheet, or move it <n + 56>px <up/down/left/right> (fit.<cx/cy> <v> to <v>), or bleed it boldly, by a fifth of the shape or more` (without fit.w or fit.h: `move fit.<cx/cy> back toward the middle`) |
| `shape-accent` | ! | Spec stage. A symbols shape's accent rows are at least 40px tall together. Message: `the accent's symbol rows are <h>px tall; they need 40px to show in the thumbnail, so scale the shape up <k>x, widen it where the accent falls, or put the accent on a bigger part`. A relief's accent stratum is at least 40px thick (twice its deepest distance to another part or the outline). Message: `the accent stratum "<name>" is <t>px thick at its thickest; it needs 40px to show in the thumbnail, so turn the strata (strata.angle) to cut across the shape's narrow side, use strata by depth, scale the shape up, or put the accent on a bigger part` |
| `shape-tone` | ! | Spec stage, relief only. `reliefTone` predicts the 280px thumbnail (see relief, Prediction) and measures the pixels inside the mask as contrast with the sheet. Its 90th percentile must reach 0.25 and its 10th to 90th percentile spread 0.22. On real thumbnails the plane and the jar measured 0.28 to 0.32 and 0.26 to 0.31 on the dark sheet; every face dim, 0.15 to 0.22 and 0.15 to 0.22. Messages: `at thumbnail size the relief's lit side reaches <n>% of the ink's contrast (90th percentile); it needs 25.0% to stand off the sheet, so <lever>` (on paper `shadow side`; with a face turned from the ink, `turn a dim face to lit or drop its face`, on paper `turn a lit face to dim …`) and `at thumbnail size the relief's tones span <n>% (10th to 90th percentile); it needs 22.0% to read as a volume, so <lever>`. The lever is, in order: `the accent covers <a>% of the shape and its flat fill holds the tone whatever the bevel, so put the accent on a smaller part` when the accent stratum is over half the shape; `every face is <lit or dim>, which turns the whole form one way: give one add the other face, or drop the faces`; `raise bevel (it is <b>) to 0.7 or more, so the form rounds toward the light` under 0.7; else `its <R>px of rounding is too shallow to shade at this size: draw it fatter, or fold it with a crease along its length`. Over 75% accent it is silent: `shape-dominant` gives the fix |
| `shape-share` | ✗ | Page stage, relief only. Per part, the characters of its `.row`s over all the relief's row characters, against its lines over all lines; more than max(0.6 points, 20% of the line share) apart trips it. Message: `"<name>" has <g>% of the relief's glyphs for <l>% of the lines; its stratum is cut off by the sheet edge or too thin across the glyph lines, so keep the shape on the sheet or turn the strata (strata.angle)` |
| `shape-rings` | ! | Spec stage, shapes in rings. The rings that fit are at least 1.5 per part. Message: `the shape is <w>px across at its thickest, room for <n> rings of 7px; its <p> parts need about <m>, so draw it fatter (about <x>px across at its thickest), raise fit.h, or use style relief` |
| `shape-upright` | ! | Spec stage, shapes in rings. Every part with a name set has one whose mean heading, after the reversal, is within 30° of level. Message: `part "<name>" never reads upright: none of its <n> names leans under 30 degrees; turn the shape (shape.rotate) so more of its outline runs level, or draw it rounder` |
| `shape-name` | ✗ | Page stage. Some `.row` of every part holds its lower-case name whole. In rings, message: `part "<name>" never shows its whole name: its <r> rings[ and its core lines] hold no whole copy of "<name>" (<n>px with its dot), where they run short or fold; make the shape fatter there or give the part a shorter name`, or, past the last ring, `… the shape ran out of rings before it (<n> rings of 7px fit); draw it fatter or use style relief` |
| `shape-room` | ✗ | Page stage. No figure text block (a `[data-role]`) comes within 16px of the mask. Message: `the <id> (<w> by <h> at <x>,<y>) sits on the shape or within 16px of it; move it into the <corner> corner, <w> by <h> at <x>,<y>`, the largest corner of `shapeCorners`; when that corner is too small, `…; no corner holds it (the largest, <corner>, is <w> by <h>), so shrink the shape (fit.h <v> to <v × 0.85>) or move it with fit.cx and fit.cy` |
| `cover-shell` | ! | Cover only, strata `outline`. The accent's outer shell, measured in the still, is at least 16px thick and at most 20% of the code. Messages: `the orange shell is <n>px thick (<s>% of the code); under 16px it reads as a hairline, not a shell, at thumbnail size, so put the accent on one of <id> ("<name>", <s>%, <n>px), …` and `the orange shell is <s>% of the code and <n>px thick, so the object reads mostly orange (keep it under 20%); add "split": ["<id>"] to the region and put the accent on one of the <k> parts inside it, or put the accent on one of …`. The candidates are the parts of 4% to 20% whose shell would be 16px or more, nearest 10% first |
| `cover-names` | ✗ | Cover only, page stage. Every part of 2% of the lines or more prints its whole name at least once in the still the PNG shows. Message: `"<name>" (<s>% of the code) never prints its whole name in the still, frame <f>; at <n> characters it does not fit its stratum there, so shorten it to <k> characters or fewer` |
| `cover-share` | ✗ | Cover only, page stage. In the still, and with `--gif` in every frame of the loop, each part's share of the printed glyphs is within 1 point of its share of the lines. Message: `in frame <f> "<name>" prints <g>% of the glyphs for <l>% of the lines, <d> points off where at most 1.0 is allowed; its plain name is too long for its stratum there, so shorten it from <n> characters to <k> or fewer` |
| `cover-accent` | ✗ | Cover only, page stage. The accent names exactly one part, and it prints at least one glyph in the still and, with `--gif`, in every frame. Messages: `the accent <id> names <n> parts (…); set it to the id of one of them`, `the accent <id> names no part, so nothing prints in orange; put the accent on …`, `the accent "<name>" prints no glyph in frame <f>; at <s>% of the code it is too small to show in every pose, so put the accent on …` |
| `cover-seam` | ✗ | Cover only, with `--gif`. The step from the loop's last frame back to its first changes at most 1.05 times as many glyphs as the largest step inside it. Message: `the step from the last frame back to the first changes <n> glyphs where the largest step inside the loop changes <m>, so the GIF jumps at its seam; this is an engine fault, so render without --gif and report it` |
| `drawn` | ✗ | The fill script ran to the end: the page raised no error and set `window.drawn` |
| `fonts` | ✗ | `document.fonts` holds a `FontFace` with status `loaded` for Commit Mono 400, Commit Mono 700 and Newsreader 400 |
| `masthead-font` | ! | Inter Display or Inter is installed for the product name. Swiss only |
| `path` | ✗ | Every outline parses and has a non-empty bounding box inside the sheet whose bottom is above the footer top. Message: `region <id> reaches <n>px below the footer; move it up by <n>` |
| `rows-fit` | ✗ | Every `.row` has `scrollWidth ≤ clientWidth` and sits inside the 840×1190 sheet |
| `region-size` | ✗ | Every fill region produced at least 4 rows, and every dots region fits above the footer. The message names the region. Fields are exempt |
| `regions-apart` | ✗ | Row rects of different regions at the same y do not overlap, with 4px horizontal inflation |
| `words-drawn` | ✗ | Per fill region, every word is drawn at least once, and the hot word, when the spec has one, is drawn in the accent. Message: `region <id>: "<word>" never drawn; shorten the list or enlarge the path` |
| `silhouette` | ✗ | Not for a shape field (its rows are type inside the mask, which `shape-cover` judges). Row rects plus dots line rects cover at least 15% of the area above the footer, and the figure spans at least 55% of that area's height and at least 60% of its width |
| `field-parts` | ✗ | A field's parts hold every non-generated line of `facts.json`, every part has at least one row (wave) or one run of letters (terrain), and `accent` names a part. Message: `region <id>: part "<name>" (<id>) is never drawn; move the text blocks that cover it` |
| `row-variety` | ✗ | In every fill region, the standard deviation of its line widths divided by their mean is at least 0.25. A line is all the region's runs at one y, merged into their outer span. Fields are exempt, and the check is skipped when the figure has no fill region. Message: `region <id> is a box; a silhouette changes width along its whole height` |
| `thin-region` | ! | Every fill region's lines are at least 160px wide on average. Fields are exempt. Message: `region <id> reads as a column; widen it or make it part of the main silhouette` |
| `blocks-apart` | ✗ | No two `[data-block]` text blocks, or a text block and a row, come within 8px. Two rows of one fill region at the same y are compared horizontally only; a field's rows are not compared with each other, and a wave's rows may pass behind the figure's texts (the blocks with a `data-role`) |
| `text-clear` | ✗ | Page stage. Each figure text block but a mark (`.sheet > [data-role]:not([data-role=mark])`) is screenshotted with the marks hidden, since a mark lies over type on purpose, as the poster draws it and again alone on the sheet with no halo; a pixel that is at least half letter alone and differs from it in the poster by more than 35% of the ink-to-paper contrast is covered. More than 8 covered pixels (at 2x) trips it. Message: `<n> px of the <id>'s letters are painted over near <x>,<y>; something is drawn on top of the text, so move the block clear of it`. The halo is a copy of each block (`data-halo`, skipped by `lib/inspect.js`) one layer under every block's letters, with transparent letters and paper `text-shadow` at 6px and 3px; a `-webkit-text-stroke` on the block painted line by line and covered the descenders of the line above, and one block's halo covered the block above it |
| `blocks-inside` | ✗ | Every `[data-block]` text block sits inside the sheet |
| `palette` | ✗ | Every text colour, square background and visible box background is one of the theme's tokens: `paper`, `ink`, `soft`, `mid`, `cold`, `cool`, or `hot` (or `accent`). A field's rows may also take the field's own tokens |
| `hot-tagged` | ✗ | Anything in the hot colour carries `data-hot` |
| `copy` | ✗ | The visible words hold no banned term, file path, "01/02/03" marker, middle dot, typed commit hash or typed YYYY-MM-DD date. The masthead and the render-owned footer lines are exempt |
| `notes` | ✗ | Swiss: the footer shows exactly the notes in `spec.notes`. Loose and signal: 0 to 2 paragraphs and exactly one legend. Message: `the poster shows <n> paragraphs and <n> legends; use 0 to 2 paragraphs and exactly one legend` |
| `band` | ✗ | The footer counts line equals the line built from `bandCounts(facts)`. Swiss only |
| `still` | ✗ | The PNG and PDF show the finished poster whatever the spec's `motion`: no row hidden, every `mark` at its full width. The GIF's frames are the only place motion is partial |
| `record` | ✗ | Loose and signal. The record line is drawn once and reads `<name> at <commit>, <date>. Drawn by Vyo.`. Without `product.commit`: `the record line has no commit; set product.commit to the short hash (vyo compose --repo fills it)` |
| `headline-lines` | ! | The headline wraps to more than 2 lines. Swiss only |

---

## 7. DOM contract

`lib/fill.js` and render produce, and the checks read, these markers:

| Marker | Who sets it | Meaning |
|---|---|---|
| `.row` | Fill | One run of words on one row of a fill region, or one item of a field. Measured by `rows-fit`, `regions-apart`, `blocks-apart`, `silhouette`, `row-variety` and `thin-region` |
| `data-region` | Fill | The region `id` on every `.row` and on every dots line. Lets the checks group rows by region |
| `data-word` | Fill | The source word, as written in the spec, on every `.row`; on a field row, the part's name or the sentence. Read by `words-drawn` and `copy` |
| `data-part` | Fill | The part id on every field row. Read by `field-parts` |
| `data-hot` | Render on the two full stops. Fill on hot rows, the hot dots line and a hot label | This element is meant to be in the hot colour. Anything in that colour without it fails `hot-tagged` |
| `data-block` | Fill for every text, with the text's `id`. Render for the footer blocks and the loose frame's `record` | A text block to measure for overlap and bounds, and to cut out of the rows |
| `.routes` | Fill | The SVG of a routes region. Hairlines; not measured as rows |
| `.node` | Fill | A dot on a route. `window.applyMotion` moves it when `motion.kind` is `nodes` |
| `[data-role=mark]` | Render | A highlighter block with no halo copy, one layer above every block's letters, painted over the type with `mix-blend-mode: multiply` on paper (ink stays ink, the ground turns to the signal colour) and `difference` on charcoal. `window.applyMotion` grows its width when `motion.kind` is `wipe` |
| `window.applyMotion` | Fill | `(t) => void`, t in 0…1. Still PNG uses t = 0.35. GIF walks t across `motion.frames` |
| `window.drawn` | Fill | Set to `true` after the fonts load and every region and text is laid out. Render waits for it before the screenshot, the PDF and the checks |

The sheet is 840×1190 CSS px. The PNG is rendered at a device scale factor of 2.
