// Service / AI map (CONTRACTS §2.5): bare imports -> service:* and ai:* facts, plus `package` uses.
import { aiName, SERVICE_NAMES } from "./names.mjs";
import { pkgNameOf } from "./imports.mjs";
import { cmp } from "./util.mjs";

// [pattern, vendor]. JS patterns: "name", "@scope/*", "prefix*". Python patterns: dotted module roots.
const SERVICES = {
  payments: {
    js: [["stripe", "stripe"], ["@stripe/*", "stripe"], ["@lemonsqueezy/*", "lemonsqueezy"], ["paddle*", "paddle"], ["@paddle/*", "paddle"]],
    py: [["stripe", "stripe"], ["paddle", "paddle"], ["paddle_billing", "paddle"]],
  },
  // Template packages (@react-email/*) only render the message; they are not a company that sends it.
  email: {
    js: [["resend", "resend"], ["@sendgrid/*", "sendgrid"], ["postmark", "postmark"], ["nodemailer", "nodemailer"], ["mailgun*", "mailgun"]],
    py: [["sendgrid", "sendgrid"], ["emails", "emails"], ["fastapi_mail", "fastapi-mail"], ["flask_mail", "flask-mail"]],
  },
  // Hosted sign-in companies only. next-auth, @auth/*, lucia, better-auth, passlib, pwdlib, pyjwt, python-jose and
  // authlib run inside the app, so they are not outside services.
  "sign-in": {
    js: [["@clerk/*", "clerk"], ["@auth0/*", "auth0"], ["auth0", "auth0"], ["auth0-js", "auth0"], ["@workos-inc/*", "workos"], ["@stytch/*", "stytch"], ["@kinde-oss/*", "kinde"],
      ["@supabase/auth-helpers-*", "supabase"], ["@supabase/ssr", "supabase"], ["firebase/auth", "firebase"], ["@okta/*", "okta"]],
    py: [["auth0", "auth0"], ["firebase_admin", "firebase"]],
  },
  "file-storage": {
    js: [["@aws-sdk/client-s3", "aws-s3"], ["@vercel/blob", "vercel-blob"], ["uploadthing", "uploadthing"], ["@uploadthing/*", "uploadthing"], ["cloudinary", "cloudinary"], ["next-cloudinary", "cloudinary"], ["@google-cloud/storage", "google-cloud-storage"], ["@azure/storage-blob", "azure-blob"]],
    py: [["boto3", "aws"], ["google.cloud.storage", "google-cloud-storage"], ["azure.storage.blob", "azure-blob"]],
  },
  analytics: {
    js: [["posthog-js", "posthog"], ["posthog-node", "posthog"], ["@vercel/analytics", "vercel-analytics"], ["@vercel/speed-insights", "vercel-analytics"], ["mixpanel*", "mixpanel"], ["@segment/*", "segment"], ["@amplitude/*", "amplitude"], ["react-ga4", "google-analytics"], ["@next/third-parties", "google-analytics"]],
    py: [["posthog", "posthog"], ["mixpanel", "mixpanel"], ["segment", "segment"]],
  },
  "error-alerts": {
    js: [["@sentry/*", "sentry"], ["@bugsnag/*", "bugsnag"], ["rollbar", "rollbar"]],
    py: [["sentry_sdk", "sentry"], ["bugsnag", "bugsnag"], ["rollbar", "rollbar"]],
  },
  "fast-cache": {
    js: [["redis", "redis"], ["ioredis", "redis"], ["@upstash/redis", "upstash"], ["@vercel/kv", "vercel-kv"]],
    py: [["redis", "redis"], ["aioredis", "redis"], ["pymemcache", "memcached"]],
  },
  "live-updates": {
    js: [["pusher", "pusher"], ["pusher-js", "pusher"], ["ably", "ably"], ["@liveblocks/*", "liveblocks"], ["socket.io*", "socket.io"], ["partykit", "partykit"], ["partysocket", "partykit"]],
    py: [["socketio", "socket.io"], ["flask_socketio", "socket.io"]],
  },
  "text-messages": { js: [["twilio", "twilio"]], py: [["twilio", "twilio"]] },
  search: {
    js: [["algoliasearch", "algolia"], ["react-instantsearch*", "algolia"], ["meilisearch", "meilisearch"], ["@elastic/*", "elastic"], ["typesense", "typesense"]],
    py: [["elasticsearch", "elastic"], ["meilisearch", "meilisearch"]],
  },
  maps: {
    js: [["mapbox-gl", "mapbox"], ["react-map-gl", "mapbox"], ["@googlemaps/*", "google-maps"], ["@react-google-maps/api", "google-maps"], ["leaflet", "leaflet"], ["react-leaflet", "leaflet"]],
    py: [],
  },
};

const AI = {
  openai: { js: [["openai", "openai"], ["@ai-sdk/openai", "ai-sdk"], ["@langchain/openai", "langchain"], ["@azure/openai", "azure"]], py: [["openai", "openai"], ["langchain_openai", "langchain"]] },
  anthropic: { js: [["@anthropic-ai/*", "anthropic"], ["@ai-sdk/anthropic", "ai-sdk"], ["@langchain/anthropic", "langchain"]], py: [["anthropic", "anthropic"], ["langchain_anthropic", "langchain"]] },
  google: {
    js: [["@google/generative-ai", "google"], ["@google/genai", "google"], ["@ai-sdk/google", "ai-sdk"], ["@ai-sdk/google-vertex", "ai-sdk"], ["@langchain/google-genai", "langchain"], ["@google-cloud/vertexai", "google"]],
    py: [["google.generativeai", "google"], ["google.genai", "google"], ["langchain_google_genai", "langchain"], ["vertexai", "google"]],
  },
  mistral: { js: [["@ai-sdk/mistral", "ai-sdk"], ["@mistralai/*", "mistral"]], py: [["mistralai", "mistral"]] },
  groq: { js: [["@ai-sdk/groq", "ai-sdk"], ["groq-sdk", "groq"]], py: [["groq", "groq"]] },
  xai: { js: [["@ai-sdk/xai", "ai-sdk"]], py: [] },
  cohere: { js: [["@ai-sdk/cohere", "ai-sdk"], ["cohere-ai", "cohere"]], py: [["cohere", "cohere"]] },
  replicate: { js: [["replicate", "replicate"], ["@ai-sdk/replicate", "ai-sdk"]], py: [["replicate", "replicate"]] },
  ollama: { js: [["ollama", "ollama"], ["ollama-ai-provider", "ollama"], ["@ai-sdk/ollama", "ai-sdk"]], py: [["ollama", "ollama"]] },
  gateway: { js: [["@ai-sdk/gateway", "ai-sdk"]], py: [] },
  huggingface: { js: [["@huggingface/*", "huggingface"], ["@xenova/transformers", "huggingface"]], py: [["huggingface_hub", "huggingface"]] },
  bedrock: { js: [["@ai-sdk/amazon-bedrock", "ai-sdk"], ["@aws-sdk/client-bedrock-runtime", "aws"]], py: [] },
};
// ai with no provider package
const GENERIC_JS = ["ai", "@ai-sdk/react", "@ai-sdk/rsc", "@ai-sdk/ui-utils", "@ai-sdk/provider", "@ai-sdk/provider-utils", "langchain", "@langchain/core", "@langchain/community", "@langchain/langgraph", "llamaindex", "@llamaindex/*"];
// @ai-sdk/* packages that are helpers, not model providers
const NON_PROVIDER = new Set(["react", "rsc", "ui-utils", "provider", "provider-utils", "otel", "devtools", "svelte", "vue", "angular", "solid", "langchain", "llamaindex", "valibot", "test", "mcp"]);
const GENERIC_PY = ["langchain", "langchain_core", "langchain_community", "langgraph", "llama_index", "litellm", "crewai", "pydantic_ai", "autogen"];

function matchJs(pattern, spec, pkg) {
  if (pattern.endsWith("*")) {
    const pre = pattern.slice(0, -1);
    return pkg.startsWith(pre) || spec.startsWith(pre);
  }
  return pkg === pattern || spec === pattern || spec.startsWith(pattern + "/");
}
const matchPy = (pattern, mod) => mod === pattern || mod.startsWith(pattern + ".");

function classify(spec, lang) {
  const pkg = lang === "js" ? pkgNameOf(spec) : spec;
  const hit = (list) => {
    for (const [pat, vendor] of list) if (lang === "js" ? matchJs(pat, spec, pkg) : matchPy(pat, spec)) return vendor;
    return null;
  };
  for (const [id, def] of Object.entries(SERVICES)) {
    const v = hit(def[lang]);
    if (v) return { type: "service", id, vendor: v };
  }
  for (const [key, def] of Object.entries(AI)) {
    const v = hit(def[lang]);
    if (v) return { type: "ai", id: key, vendor: v };
  }
  if (lang === "js") {
    if (GENERIC_JS.some((g) => matchJs(g, spec, pkg))) return { type: "ai-generic", vendor: "ai-sdk" };
    const m = /^@ai-sdk\/([\w-]+)$/.exec(pkg);
    if (m && NON_PROVIDER.has(m[1])) return { type: "ai-generic", vendor: "ai-sdk" };
    if (m) return { type: "ai", id: m[1], vendor: "ai-sdk" };
  } else if (GENERIC_PY.some((g) => matchPy(g, spec))) return { type: "ai-generic", vendor: "ai-sdk" };
  return null;
}

const TOOL_RE = /\b(?:tool|createTool|defineTool)\s*(?:<[^>(]*>)?\s*\(\s*\{|\bnew\s+(?:DynamicStructuredTool|DynamicTool|StructuredTool)\s*\(|^[ \t]*@(?:\w+\.)?(?:tool|function_tool)\b/gm;
const FN_TOOL_RE = /\btype\s*:\s*["']function["']/g;

// ctx.ext: Map<file,{js:Set,py:Set}>; ctx.sources for tool counting. Returns the `package` uses.
export function detectServices(ctx) {
  const { ext, facts, sources } = ctx;
  const svc = new Map();
  const ai = new Map();
  const generic = new Set();
  const perFile = new Map(); // file -> [ {type,id,vendor} ]
  for (const [file, e] of [...ext].sort((a, b) => cmp(a[0], b[0]))) {
    const hits = [];
    for (const s of e.js) {
      const c = classify(s, "js");
      if (c) hits.push(c);
    }
    for (const s of e.py) {
      const c = classify(s, "py");
      if (c) hits.push(c);
    }
    if (hits.length) perFile.set(file, hits);
  }
  for (const [file, hits] of perFile) {
    for (const h of hits) {
      const bucket = h.type === "service" ? svc : h.type === "ai" ? ai : null;
      if (bucket) {
        if (!bucket.has(h.id)) bucket.set(h.id, { files: new Set(), vendors: new Set() });
        bucket.get(h.id).files.add(file);
        bucket.get(h.id).vendors.add(h.vendor);
      } else generic.add(file);
    }
  }
  const uses = [];
  for (const [id, b] of svc) {
    facts.add("service", `service:${id}`, { name: SERVICE_NAMES[id], files: b.files, meta: { vendor: [...b.vendors] } });
    for (const f of b.files) uses.push([f, `service:${id}`, "package"]);
  }
  const aiFacts = new Map();
  for (const [key, b] of ai) aiFacts.set(key, { files: b.files, vendors: b.vendors });
  if (aiFacts.size === 0 && generic.size) aiFacts.set("ai-sdk", { files: generic, vendors: new Set(["ai-sdk"]) });
  // tool definitions in files that import any AI package
  const aiFiles = new Set(generic);
  for (const b of ai.values()) for (const f of b.files) aiFiles.add(f);
  const primary = [...aiFacts].sort((a, b) => b[1].files.size - a[1].files.size || cmp(a[0], b[0]))[0]?.[0];
  const tools = new Map();
  for (const file of [...aiFiles].sort(cmp)) {
    const src = sources.get(file);
    if (!src) continue;
    let n = (src.code.match(TOOL_RE) || []).length;
    if (n === 0) n = (src.code.match(FN_TOOL_RE) || []).length;
    if (!n) continue;
    const own = [...ai.keys()].filter((k) => ai.get(k).files.has(file)).sort(cmp);
    const target = own[0] ?? primary;
    if (target) tools.set(target, (tools.get(target) || 0) + n);
  }
  for (const [key, b] of aiFacts) {
    facts.add("ai", `ai:${key}`, { name: aiName(key), files: b.files, meta: { vendor: [...b.vendors], tools: tools.get(key) || 0 } });
    for (const f of b.files) uses.push([f, `ai:${key}`, "package"]);
  }
  return uses;
}
