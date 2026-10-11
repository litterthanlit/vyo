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

// Areas: basename title-cased, route-group parentheses removed.
export function areaName(dir, repoName) {
  if (dir === "") return sentenceCase(repoName || "Project");
  const base = dir.slice(dir.lastIndexOf("/") + 1).replace(/^\((.*)\)$/, "$1").replace(/^\[+(\.\.\.)?(.*?)\]+$/, "$2");
  return sentenceCase(base) || "Main";
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
