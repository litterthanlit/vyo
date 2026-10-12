// Friendly names (CONTRACTS §2.5). Deterministic, no lookups.

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function splitWords(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_\-.\s]+/g, " ")
    .trim()
    .toLowerCase();
}

export const sentenceCase = (s) => cap(splitWords(s));

export function singular(w) {
  if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + "y";
  if (/(ss|us|is)$/.test(w)) return w;
  if (/sses$/.test(w)) return w.slice(0, -2);
  if (/(ches|shes|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (/s$/.test(w) && w.length > 3) return w.slice(0, -1);
  return w;
}

// Table names: split camel case and underscores, strip _v2 style suffixes.
export function tableName(name) {
  return sentenceCase(name.replace(/_v\d+$/i, ""));
}

const GENERIC_ADD = new Set(["new", "create", "add"]);
const GENERIC_EDIT = new Set(["edit", "update"]);

// Screens and endpoints: the last static segment, title-cased.
export function routeName(routePath) {
  const clean = routePath.replace(/#.*$/, "");
  let segs = clean.split("/").filter(Boolean);
  if (segs.length === 0) return "Home";
  const noise = (s) => s === "api" || /^v\d+$/.test(s) || s === "trpc";
  const stripped = segs.filter((s) => !noise(s));
  if (stripped.length > 0) segs = stripped;
  else return "Main";
  const isDyn = (s) => /^\[.*\]$/.test(s);
  const statics = segs.filter((s) => !isDyn(s));
  const last = segs[segs.length - 1];
  if (isDyn(last)) {
    const prev = statics[statics.length - 1];
    if (prev) return sentenceCase(singular(splitWords(prev))) + " detail";
    const p = last.replace(/[\[\]]/g, "").replace(/^\.\.\./, "");
    return p === "id" || !p ? "Detail" : sentenceCase(p);
  }
  const word = splitWords(last);
  const prev = statics.length > 1 ? statics[statics.length - 2] : null;
  if (prev && GENERIC_ADD.has(word)) return cap(word) + " " + singular(splitWords(prev));
  if (prev && GENERIC_EDIT.has(word)) return cap(word) + " " + singular(splitWords(prev));
  return cap(word);
}

export function jobName(id) {
  const raw = id.replace(/\?.*$/, "");
  const segs = raw.split("/").filter(Boolean);
  return sentenceCase(segs[segs.length - 1] || raw) || "Job";
}

export const SERVICE_NAMES = {
  payments: "Payments",
  email: "Email",
  "sign-in": "Sign-in",
  "file-storage": "File storage",
  analytics: "Analytics",
  "error-alerts": "Error alerts",
  "fast-cache": "Fast cache",
  "live-updates": "Live updates",
  "text-messages": "Text messages",
  search: "Search",
  maps: "Maps",
};

// What a service lets the app do, as a verb phrase that follows "your app can now …". One per SERVICE_NAMES key.
// The change briefing uses it (lib/briefing.mjs); keep both maps in step when a service is added.
export const SERVICE_VERBS = {
  payments: "take payments",
  email: "send email",
  "sign-in": "sign people in",
  "file-storage": "store files",
  analytics: "see how people use it",
  "error-alerts": "tell you when something breaks",
  "fast-cache": "remember things so pages load faster",
  "live-updates": "show changes as they happen",
  "text-messages": "send text messages",
  search: "search your content",
  maps: "show maps",
};

export const AI_NAMES = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google AI",
  mistral: "Mistral",
  groq: "Groq",
  xai: "xAI",
  cohere: "Cohere",
  replicate: "Replicate",
  ollama: "Ollama",
  gateway: "AI gateway",
  "ai-sdk": "AI model",
  huggingface: "Hugging Face",
  bedrock: "Amazon Bedrock",
  azure: "Azure AI",
  deepseek: "DeepSeek",
  perplexity: "Perplexity",
  togetherai: "Together AI",
  fireworks: "Fireworks",
};

export function aiName(key) {
  return AI_NAMES[key] || sentenceCase(key);
}

// ---- Areas: plain-English folder names (shared by area facts and `draft`) ----

export const MAX_NAME = 16;

// The words the poster checker flags (tools/lib/inspect.js). A part name must never contain one.
const JARGON = [
  /\bAPIs?\b/i, /\bSDKs?\b/, /\bORM\b/, /\bREST\b/, /\bGraphQL\b/, /\bPRs?\b/, /\bCI\b/,
  ...["endpoint", "middleware", "webhook", "deploy", "deployment", "env var", "environment variable", "frontend", "front-end", "backend", "back-end", "monorepo", "repository", "repo", "component", "module", "commit", "pull request", "table", "schema"].map(
    (w) => new RegExp(`\\b${w}s?\\b`, "i"),
  ),
];
export const isJargon = (text) => JARGON.some((re) => re.test(text));

// Known folder names -> what a person gets from them. Keys are lower-case with "-" and "_" removed.
const FOLDER_NAMES = {
  components: "Screen pieces", component: "Screen pieces", widgets: "Screen pieces",
  ui: "Look and feel", styles: "Look and feel", style: "Look and feel", theme: "Look and feel", themes: "Look and feel", design: "Look and feel",
  lib: "Inner workings", libs: "Inner workings", core: "Inner workings", internal: "Inner workings", services: "Inner workings", service: "Inner workings", logic: "Inner workings",
  utils: "Helpers", util: "Helpers", helpers: "Helpers", helper: "Helpers", utilities: "Helpers",
  hooks: "Screen behaviour", hook: "Screen behaviour",
  api: "Requests", routes: "Requests", route: "Requests", router: "Requests", routers: "Requests", handlers: "Requests", controllers: "Requests", endpoints: "Requests", rest: "Requests",
  app: "Main app", src: "Main app", main: "Main app",
  pages: "Screens", views: "Screens", screens: "Screens", screen: "Screens", layouts: "Page layouts", layout: "Page layouts",
  config: "Settings", configs: "Settings", settings: "Settings", constants: "Settings", env: "Settings",
  types: "Data shapes", typings: "Data shapes", schemas: "Data shapes", schema: "Data shapes", models: "Data shapes", model: "Data shapes", entities: "Data shapes", interfaces: "Data shapes", validations: "Data shapes", validators: "Data shapes",
  db: "Saved data", database: "Saved data", prisma: "Saved data", drizzle: "Saved data", migrations: "Saved data", repositories: "Saved data", data: "Saved data", storage: "Saved data",
  auth: "Signing in", authentication: "Signing in", login: "Signing in", session: "Signing in", sessions: "Signing in",
  jobs: "Background work", tasks: "Background work", workers: "Background work", worker: "Background work", queues: "Background work", cron: "Background work", scheduler: "Background work",
  emails: "Emails", email: "Emails", mail: "Emails", mailers: "Emails", notifications: "Notices",
  scripts: "Helper scripts", bin: "Helper scripts", tools: "Helper scripts", cli: "Helper scripts",
  store: "App memory", stores: "App memory", state: "App memory", context: "App memory", contexts: "App memory", providers: "App memory", redux: "App memory",
  middleware: "Safety checks", guards: "Safety checks",
  common: "Shared parts", shared: "Shared parts", modules: "Features", packages: "Shared parts",
  server: "Back room", backend: "Back room", back: "Back room", client: "Front room", frontend: "Front room", front: "Front room", web: "Front room", www: "Front room",
  ai: "AI features", llm: "AI features", agents: "AI features",
  i18n: "Translations", locales: "Translations", lang: "Translations", translations: "Translations",
};
// Pairs win over single folders: "routes/api" and "app/api" are both "Requests", "lib/utils" is "Helpers".
const PAIR_NAMES = { "lib/utils": "Helpers", "src/lib": "Inner workings", "src/utils": "Helpers", "components/ui": "Look and feel" };

// Jargon words inside a folder name -> plain words
const WORD_FIXES = {
  component: "piece", components: "pieces", module: "part", modules: "parts", api: "request", apis: "requests", endpoint: "request", endpoints: "requests",
  backend: "back room", frontend: "front room", repo: "project", repos: "projects", repository: "project", webhook: "notice", webhooks: "notices",
  middleware: "check", sdk: "tools", orm: "data", graphql: "queries", deploy: "launch", deployment: "launch", commit: "save", commits: "saves", table: "list", tables: "lists", schema: "shape", schemas: "shapes",
  ai: "AI", ui: "UI", id: "ID", db: "data", auth: "sign-in",
};

const cleanSeg = (seg) => seg.replace(/^\((.*)\)$/, "$1").replace(/^\[+(?:\.\.\.)?(.*?)\]+$/, "$1");
const foldKey = (seg) => cleanSeg(seg).toLowerCase().replace(/[-_.]/g, "");

export function clip(name, n = MAX_NAME) {
  if (name.length <= n) return name;
  const cut = name.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > 6 ? cut.slice(0, sp) : cut).trim();
}

const sentence = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// A `routes` folder holds screens in a frontend package (TanStack, React Router, SvelteKit, Remix) and requests on a
// server (FastAPI api/routes, Express). `hint` says which: "pages" | "requests", or a function returning one.
const ROUTE_FOLDERS = new Set(["routes", "route"]);

// A folder's plain-English name: no jargon, 16 characters at most.
export function plainAreaName(dir, repoName = "", hint) {
  let name;
  if (dir === "") {
    const words = splitWords(repoName || "");
    const guess = sentence(words);
    name = guess && guess.length <= MAX_NAME && !isJargon(guess) && !/template|starter|boilerplate/i.test(guess) ? guess : "The whole app";
  } else {
    const segs = dir.split("/");
    const last = foldKey(segs[segs.length - 1]);
    const pair = segs.length > 1 ? `${foldKey(segs[segs.length - 2])}/${last}` : "";
    name = PAIR_NAMES[pair] || FOLDER_NAMES[last];
    if (ROUTE_FOLDERS.has(last) && (typeof hint === "function" ? hint() : hint) === "pages") name = "Pages";
    if (!name) {
      const words = splitWords(cleanSeg(segs[segs.length - 1])).split(" ").filter(Boolean);
      const fixed = words.map((w) => WORD_FIXES[w] || w);
      name = sentence(fixed.join(" ")) || "Main part";
    }
  }
  name = clip(name);
  if (isJargon(name)) name = "Main part";
  return name;
}


// Areas (CONTRACTS §2.5): the plain-English folder map; unmapped basenames are title-cased with jargon words replaced.
export const areaName = (dir, repoName, hint) => plainAreaName(dir, repoName, hint);
