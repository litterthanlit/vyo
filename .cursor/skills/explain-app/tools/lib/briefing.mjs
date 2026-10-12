// The plain-English briefing of a Changes (CONTRACTS.md §7).
//
//   const doc = buildBriefing(changes, { receipts });   // { title, lede, short, numbers, sections, footer }
//   process.stdout.write(renderText(doc));
//
// Text and HTML (lib/briefing-html.mjs) both render the same doc, so their wording cannot drift.
// Voice: "you" and "your app"; every name is qualified by its kind ("the Recipes screen", "the saved record
// Ingredient"); no file paths unless `receipts`, and then only in `where`. Every other line passes `isJargon`.
// Every count comes from the Changes arrays and counts; nothing is recomputed from the facts.
import { SERVICE_VERBS, isJargon, sentenceCase } from "./scan/names.mjs";

const GROUP_AT = 6; // more than this many of one kind in a section collapse into one line
const NAME_MAX = 6; // names listed in a collapsed line before "and N more"
const OFFSCREEN_MAX = 6; // items in "Not on a screen yet" before "and N more"

const MINUS = "−";
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const fmt = (n) => n.toLocaleString("en-US");
const signed = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `${MINUS}${fmt(-n)}` : "0");
const plural = (n, one, many = `${one}s`) => `${fmt(n)} ${n === 1 ? one : many}`;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// "a", "a and b", "a, b and c"
function list(items) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
// The summary line reads better with the serial comma: "a, b, and c".
const clauseList = (items) => (items.length <= 2 ? list(items) : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`);

/* ─────────────────────────── words ─────────────────────────── */

// A name from the scan that happens to contain a banned word ("API keys", "Table settings") gets the plain one.
const SCRUB = [
  [/\bAPIs\b/gi, "requests"], [/\bAPI\b/gi, "request"], [/\bendpoints\b/gi, "requests"], [/\bendpoint\b/gi, "request"],
  [/\btables\b/gi, "lists"], [/\btable\b/gi, "list"], [/\bschemas?\b/gi, "shape"], [/\bcomponents\b/gi, "pieces"], [/\bcomponent\b/gi, "piece"],
  [/\bmodules\b/gi, "parts"], [/\bmodule\b/gi, "part"], [/\bwebhooks?\b/gi, "notice"], [/\bmiddleware\b/gi, "check"],
  [/\b(?:repositor(?:y|ies)|repos?)\b/gi, "project"], [/\bmonorepo\b/gi, "project"], [/\bcommits?\b/gi, "save"], [/\bpull requests?\b/gi, "change"],
  [/\bdeploy(?:ments?)?\b/gi, "launch"], [/\bback-?end\b/gi, "back room"], [/\bfront-?end\b/gi, "front room"],
  [/\b(?:environment variables?|env vars?)\b/gi, "setting"], [/\bSDKs?\b/g, "tools"], [/\bORM\b/g, "data"], [/\bREST\b/g, "web"],
  [/\bGraphQL\b/g, "queries"], [/\bPRs?\b/g, "changes"], [/\bCI\b/g, "checks"],
];
export function plainName(name) {
  let s = String(name ?? "").trim();
  if (isJargon(s)) for (const [re, to] of SCRUB) s = s.replace(re, to);
  return isJargon(s) ? "this one" : s;
}

// Package-derived vendor keys (CONTRACTS §2.5) → how a person writes the company.
const VENDORS = {
  stripe: "Stripe", lemonsqueezy: "Lemon Squeezy", paddle: "Paddle",
  resend: "Resend", sendgrid: "SendGrid", postmark: "Postmark", nodemailer: "Nodemailer", mailgun: "Mailgun", "fastapi-mail": "FastAPI Mail", "flask-mail": "Flask-Mail",
  clerk: "Clerk", auth0: "Auth0", workos: "WorkOS", stytch: "Stytch", kinde: "Kinde", supabase: "Supabase", firebase: "Firebase", okta: "Okta",
  github: "GitHub", google: "Google", apple: "Apple", discord: "Discord", gitlab: "GitLab", twitter: "X (Twitter)", facebook: "Facebook",
  linkedin: "LinkedIn", slack: "Slack", "azure-ad": "Azure AD", cognito: "Amazon Cognito", keycloak: "Keycloak",
  "aws-s3": "Amazon S3", aws: "Amazon Web Services", "vercel-blob": "Vercel Blob", uploadthing: "UploadThing", cloudinary: "Cloudinary",
  "google-cloud-storage": "Google Cloud Storage", "azure-blob": "Azure Blob Storage",
  posthog: "PostHog", "vercel-analytics": "Vercel Analytics", mixpanel: "Mixpanel", segment: "Segment", amplitude: "Amplitude", "google-analytics": "Google Analytics",
  sentry: "Sentry", bugsnag: "Bugsnag", rollbar: "Rollbar",
  redis: "Redis", upstash: "Upstash", "vercel-kv": "Vercel KV", memcached: "Memcached",
  pusher: "Pusher", ably: "Ably", liveblocks: "Liveblocks", "socket.io": "Socket.IO", partykit: "PartyKit",
  twilio: "Twilio", algolia: "Algolia", meilisearch: "Meilisearch", elastic: "Elastic", typesense: "Typesense",
  mapbox: "Mapbox", "google-maps": "Google Maps", leaflet: "Leaflet",
  openai: "OpenAI", anthropic: "Anthropic", azure: "Azure", mistral: "Mistral", groq: "Groq", cohere: "Cohere", replicate: "Replicate", ollama: "Ollama",
  huggingface: "Hugging Face", langchain: "LangChain",
};
export const vendorName = (key) => VENDORS[key] ?? sentenceCase(key);

// A service as the person knows it: "Payments (Stripe)". Without a vendor, or when the vendor repeats the name, just the name.
function withVendor(name, vendors) {
  const shown = [...new Set((vendors ?? []).map(vendorName))].filter((v) => v.toLowerCase() !== name.toLowerCase());
  return shown.length ? `${name} (${list(shown)})` : name;
}

/**
 * A cron string as a phrase that follows "runs": "every 15 minutes", "every hour", "every day at 08:00",
 * "every Monday at 08:00", "every weekday at 09:30", "monthly on day 1 at 08:00". Anything else: "on a schedule".
 */
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_KEYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
export function describeCron(expr) {
  const FALLBACK = "on a schedule";
  if (typeof expr !== "string") return FALLBACK;
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return FALLBACK;
  const [min, hour, dom, mon, dow] = f;
  const int = (s, max) => (/^\d+$/.test(s) && Number(s) <= max ? Number(s) : null);
  const pad = (n) => String(n).padStart(2, "0");
  const step = (s) => {
    const m = /^\*\/(\d+)$/.exec(s);
    return m && Number(m[1]) > 0 ? Number(m[1]) : null;
  };
  const rest = (...fields) => fields.every((x) => x === "*");
  if (min === "*" && rest(hour, dom, mon, dow)) return "every minute";
  if (step(min) && rest(hour, dom, mon, dow)) return step(min) === 1 ? "every minute" : `every ${step(min)} minutes`;
  if (int(min, 59) !== null && rest(hour, dom, mon, dow)) return "every hour";
  if (int(min, 59) !== null && step(hour) && rest(dom, mon, dow)) return step(hour) === 1 ? "every hour" : `every ${step(hour)} hours`;
  const m = int(min, 59);
  const h = int(hour, 23);
  if (m === null || h === null || mon !== "*") return FALLBACK;
  const at = `${pad(h)}:${pad(m)}`;
  if (dom === "*" && dow === "*") return `every day at ${at}`;
  if (dom === "*") {
    if (dow === "1-5") return `every weekday at ${at}`;
    const d = int(dow, 7) ?? DAY_KEYS[dow.toLowerCase()];
    return d === undefined || d === null ? FALLBACK : `every ${DAYS[d % 7]} at ${at}`;
  }
  if (dow === "*" && int(dom, 31) !== null) return `monthly on day ${int(dom, 31)} at ${at}`;
  return FALLBACK;
}

// HTTP methods → what the request does for the app. HEAD and OPTIONS add nothing a person would name.
const METHOD_VERBS = { GET: "look up", POST: "add", PUT: "change", PATCH: "change", DELETE: "remove" };
const VERB_ORDER = ["look up", "add", "change", "remove"];
export function methodVerbs(methods) {
  const verbs = new Set((methods ?? []).map((m) => METHOD_VERBS[String(m).toUpperCase()]).filter(Boolean));
  return VERB_ORDER.filter((v) => verbs.has(v));
}

// "look things up", "add things", "look up, add and change things"
const things = (verbs) => (verbs.length === 1 && verbs[0] === "look up" ? "look things up" : `${list(verbs)} things`);

const KIND_ORDER = ["screen", "table", "service", "ai", "endpoint", "job"];
const KIND_ONE = { screen: "screen", table: "saved record", service: "outside service", ai: "AI provider", endpoint: "request", job: "background job" };
const KIND_MANY = { screen: "screens", table: "saved records", service: "outside services", ai: "AI providers", endpoint: "requests", job: "background jobs" };
const rank = (kind) => KIND_ORDER.indexOf(kind);

// A fact (an Item or a ref) as a noun phrase: "the Plan screen", "the saved record Ingredient", "Payments (Stripe)", "OpenAI".
function label(f) {
  const name = plainName(f.name);
  switch (f.kind) {
    case "screen": return `the ${name} screen`;
    case "endpoint": return `the ${name} request`;
    case "table": return `the saved record ${name}`;
    case "job": return `the ${name} job`;
    case "service": return withVendor(name, f.vendor ?? f.meta?.vendor);
    case "ai": return /^AI\b/.test(name) ? `the ${name}` : name;
    default: return name;
  }
}
// The bare name for a list of names: services keep their vendor, the rest are just names.
const bare = (f) => (f.kind === "service" ? withVendor(plainName(f.name), f.vendor ?? f.meta?.vendor) : plainName(f.name));

function nameList(names, max = NAME_MAX) {
  if (names.length <= max) return list(names);
  return `${names.slice(0, max).join(", ")} and ${fmt(names.length - max)} more`;
}

// "the Plan screen", "the Plan and Home screens", "the Plan, Home and Settings screens", "5 screens"
function screenList(screens) {
  if (screens.length === 1) return `the ${plainName(screens[0].name)} screen`;
  if (screens.length <= 3) return `the ${list(screens.map((s) => plainName(s.name)))} screens`;
  return `${fmt(screens.length)} screens`;
}

// "/plan" from "screen:/plan#web"
const pathOf = (id) => id.slice(id.indexOf(":") + 1).replace(/#.*$/, "");

// A witness chain for receipts: files joined by →, a fact id by ─uses→ (as `why` prints it).
const FACT_ID = /^(?:screen|endpoint|table|service|ai|job):/;
function chainText(chain) {
  return chain.map((el, i) => (i === 0 ? el : `${FACT_ID.test(el) ? " ─uses→ " : " → "}${el}`)).join("");
}
function fileText(files, max = 4) {
  const l = files ?? [];
  return l.length <= max ? l.join(", ") : `${l.slice(0, max).join(", ")} and ${l.length - max} more`;
}

/* ─────────────────────────── lines ─────────────────────────── */

const runs = (schedule) => `runs ${describeCron(schedule)}`;

function newLine(i) {
  const name = plainName(i.name);
  switch (i.kind) {
    case "screen": return `The ${name} screen is new.`;
    case "table": return `The saved record ${name} is new.`;
    case "endpoint": {
      const v = methodVerbs(i.meta?.methods);
      return v.length ? `The ${name} request is new: it can ${things(v)}.` : `The ${name} request is new.`;
    }
    case "service": return `${label(i)}: your app can now ${SERVICE_VERBS[i.id.slice(8)] ?? "use this service"}.`;
    case "ai": {
      const tools = i.meta?.tools ?? 0;
      return `${cap(label(i))}: your app can now use AI${tools ? `, with ${plural(tools, "tool")} it can call` : ""}.`;
    }
    case "job": return i.meta?.schedule ? `The ${name} job is new: it ${runs(i.meta.schedule)}.` : `The ${name} job is new.`;
    default: return `${name} is new.`;
  }
}

function goneLine(i) {
  const name = plainName(i.name);
  switch (i.kind) {
    case "screen": return `The ${name} screen is gone.`;
    case "table": return `The saved record ${name} is gone.`;
    case "endpoint": return `The ${name} request is gone.`;
    case "service": return `${label(i)} is gone, so your app can no longer ${SERVICE_VERBS[i.id.slice(8)] ?? "use this service"}.`;
    case "ai": return `${cap(label(i))} is gone.`;
    case "job": return `The ${name} job is gone, so it no longer runs.`;
    default: return `${name} is gone.`;
  }
}

function movedLine(m) {
  const { from, to } = m;
  const fn = plainName(from.name);
  const tn = plainName(to.name);
  if (from.kind !== to.kind) {
    // an endpoint that gained a cron entry (or lost it): the same file, now a different kind of thing
    return to.kind === "job"
      ? `The ${fn} request is now a background job: it ${runs(to.meta?.schedule)}.`
      : `The ${fn} job is now an ordinary request: it no longer runs on a schedule.`;
  }
  switch (to.kind) {
    case "screen": {
      const fp = pathOf(from.id);
      const tp = pathOf(to.id);
      const where = isJargon(fp + tp) ? "" : ` from ${fp} to ${tp}`;
      return fn === tn ? `The ${tn} screen moved${where || " to a new address"}.` : `The ${fn} screen is now the ${tn} screen${where ? ` (moved${where})` : ""}.`;
    }
    case "endpoint": return fn === tn ? `The ${tn} request moved to a new address.` : `The ${fn} request is now the ${tn} request.`;
    case "job": return fn === tn ? `The ${tn} job moved.` : `The ${fn} job is now called ${tn}.`;
    case "table": return fn === tn ? `The saved record ${tn} was renamed in a way that only changes its spelling.` : `The saved record ${fn} was renamed ${tn}.`;
    default: return `${fn} is now called ${tn}.`;
  }
}

function changedLine(c) {
  const name = plainName(c.name);
  switch (c.type) {
    case "methods": {
      const b = methodVerbs(c.before);
      const a = methodVerbs(c.after);
      const added = a.filter((v) => !b.includes(v));
      const lost = b.filter((v) => !a.includes(v));
      if (added.length && lost.length) return `The ${name} request can now ${things(added)}, but can no longer ${things(lost)}.`;
      if (added.length) return `The ${name} request can now ${things(added)}.`;
      if (lost.length) return `The ${name} request can no longer ${things(lost)}.`;
      return `The ${name} request was adjusted${a.length ? `; it still can ${things(a)}` : ""}.`;
    }
    case "schedule": {
      if (c.before == null) return `The ${name} job now ${runs(c.after)}.`;
      if (c.after == null) return `The ${name} job no longer has a schedule.`;
      const now = describeCron(c.after);
      const was = describeCron(c.before);
      return now === was ? `The ${name} job's schedule changed.` : `The ${name} job now runs ${now} (it used to run ${was}).`;
    }
    case "vendor": {
      if (c.kind !== "service") return `${cap(label(c))} now connects in a different way.`;
      const gone = c.before.filter((v) => !c.after.includes(v)).map(vendorName);
      const fresh = c.after.filter((v) => !c.before.includes(v)).map(vendorName);
      if (gone.length && fresh.length) return `${name} now goes through ${list(fresh)} instead of ${list(gone)}.`;
      if (fresh.length) return `${name} now also goes through ${list(fresh)}.`;
      return `${name} no longer goes through ${list(gone)}.`;
    }
    case "tools": {
      const who = cap(label(c));
      if (c.after === 0) return `${who} no longer uses any of your tools (it used to use ${c.before}).`;
      if (c.before === 0) return `${who} can now use ${plural(c.after, "tool")} of yours.`;
      return `${who} can now use ${plural(c.after, "tool")} of yours (it used to use ${c.before}).`;
    }
    case "reworked": return `${cap(label(c))} was heavily reworked: its code went from ${plural(c.before, "line")} to ${plural(c.after, "line")}.`;
    default: return `${cap(label(c))} changed.`;
  }
}

function lookLine(w) {
  const name = plainName(w.name);
  switch (w.code) {
    case "went-empty": return "The scan finds no screens, saved records, outside services, AI or jobs in your app now. Check that is what you meant.";
    case "table-removed":
      return w.renamedTo
        ? `${name} (saved data) was renamed ${plainName(w.renamedTo.name)}. Unless its records are moved across, anything stored in ${name} may be lost if you publish this.`
        : `${name} (saved data) was removed. Anything stored in it may be lost if you publish this.`;
    case "screen-removed": return `The ${name} screen was removed. Anything that links to it will break.`;
    case "request-lost":
      return w.methods
        ? `The ${name} request can no longer ${methodVerbs(w.methods).length ? things(methodVerbs(w.methods)) : "answer some calls"}. Anything that asks it to will stop working.`
        : `The ${name} request was removed. Anything that asks for it will stop getting an answer.`;
    case "vendor-switched": {
      const fresh = list(w.after.filter((v) => !w.before.includes(v)).map(vendorName));
      const gone = list(w.before.filter((v) => !w.after.includes(v)).map(vendorName));
      return `${name} now goes through ${fresh} instead of ${gone}. You will need an account and keys for ${fresh}.`;
    }
    case "service-added": return `${label(w)} is new. It needs an account and keys, and it may cost money.`;
    case "ai-added": return `${cap(label(w))} is new. Each time your app uses it, it may cost money.`;
    case "job-added": return `The ${name} job is new. It will run on its own once you publish this.`;
    case "big-shrink": {
      const pct = Math.round(((w.before - w.after) / w.before) * 100);
      return `${name} lost ${pct}% of its code (${plural(w.before, "line")} down to ${fmt(w.after)}). Check that was on purpose.`;
    }
    default: return `${name} is worth a look.`;
  }
}

// More than this many of one kind of warning are said once, with the names.
const LOOK_GROUP_AT = 3;
const LOOK_GROUPED = {
  "table-removed": (n, names) => `${fmt(n)} ${KIND_MANY.table} (${names}) were removed. Anything stored in them may be lost if you publish this.`,
  "screen-removed": (n, names) => `${fmt(n)} ${KIND_MANY.screen} (${names}) were removed. Anything that links to them will break.`,
  "request-lost": (n, names) => `${fmt(n)} ${KIND_MANY.endpoint} (${names}) were removed. Anything that asks for them will stop getting an answer.`,
  "service-added": (n, names) => `${fmt(n)} ${KIND_MANY.service} (${names}) are new. Each needs an account and keys, and may cost money.`,
  "ai-added": (n, names) => `${fmt(n)} ${KIND_MANY.ai} (${names}) are new. Each time your app uses one, it may cost money.`,
  "job-added": (n, names) => `${fmt(n)} ${KIND_MANY.job} (${names}) are new. They will run on their own once you publish this.`,
  "big-shrink": (n, names) => `${fmt(n)} parts of your code lost at least half their lines (${names}). Check that was on purpose.`,
};

function lookItems(entries, it) {
  const items = [];
  const plain = (w) => !w.renamedTo && !w.methods; // a rename or a lost method is told on its own
  for (let i = 0; i < entries.length; ) {
    let j = i;
    while (j < entries.length && entries[j].code === entries[i].code && plain(entries[j]) === plain(entries[i])) j++;
    const run = entries.slice(i, j);
    const grouped = LOOK_GROUPED[run[0].code];
    if (grouped && plain(run[0]) && run.length > LOOK_GROUP_AT) {
      items.push(it(grouped(run.length, nameList(run.map((w) => (w.kind ? bare(w) : plainName(w.name))))), undefined, true));
    } else for (const w of run) items.push(it(lookLine(w), undefined, true));
    i = j;
  }
  return items;
}

/* ─────────────────────────── sections ─────────────────────────── */

function makeItem(receipts) {
  return (text, where, flag) => {
    const o = { text };
    if (receipts && where) o.where = where;
    if (flag) o.flag = true;
    return o;
  };
}

// One line per fact, or one line per kind once there are more than GROUP_AT of it.
function factItems(facts, one, verb, it) {
  const byKind = new Map();
  for (const f of [...facts].sort((a, b) => rank(a.kind) - rank(b.kind) || cmp(a.name, b.name) || cmp(a.id, b.id))) {
    if (!byKind.has(f.kind)) byKind.set(f.kind, []);
    byKind.get(f.kind).push(f);
  }
  const items = [];
  for (const [kind, l] of byKind) {
    if (l.length <= GROUP_AT) for (const f of l) items.push(it(one(f), fileText(f.files)));
    else {
      const files = [...new Set(l.flatMap((f) => f.files ?? []))].sort(cmp);
      items.push(it(`${fmt(l.length)} ${KIND_MANY[kind]} ${verb}: ${nameList(l.map(bare))}.`, fileText(files, 8)));
    }
  }
  return items;
}

function connectedItems(gained, it) {
  const order = (g) => rank(g.fact.kind);
  return [...gained]
    .sort((a, b) => order(a) - order(b) || cmp(a.fact.id, b.fact.id))
    .map((g) => it(`${cap(label(g.fact))} is now used from ${screenList(g.screens)}.`, chainText(g.chain)));
}

function lostItems(lost, it) {
  return [...lost]
    .sort((a, b) => rank(a.fact.kind) - rank(b.fact.kind) || cmp(a.fact.id, b.fact.id))
    .map((l) => it(`${cap(label(l.fact))} is no longer used from ${screenList(l.screens)}.`));
}

function jobsText(jobs) {
  return jobs.length === 1 ? `the ${plainName(jobs[0].name)} job` : `the ${list(jobs.map((j) => plainName(j.name)))} jobs`;
}

function offscreenItems(list_, it) {
  const sorted = [...list_].sort((a, b) => rank(a.fact.kind) - rank(b.fact.kind) || cmp(a.fact.id, b.fact.id));
  const items = sorted.slice(0, OFFSCREEN_MAX).map((n) => {
    const who = cap(label(n.fact));
    const jobs = n.usedByJobs.length ? jobsText(n.usedByJobs) : null;
    let text;
    if (n.why === "new") text = jobs ? `${who} is only used by ${jobs}; no screen seems to lead to it yet.` : `${who} is in the code, but no screen seems to lead to it yet.`;
    else text = jobs ? `No screen seems to lead to ${label(n.fact)} any more; only ${jobs} uses it.` : `No screen seems to lead to ${label(n.fact)} any more.`;
    return it(text, fileText(n.files));
  });
  if (sorted.length > OFFSCREEN_MAX) items.push(it(`And ${plural(sorted.length - OFFSCREEN_MAX, "more thing")} no screen seems to lead to yet.`));
  return items;
}

// The size line: "Your app is 14 files and 1,240 lines bigger (+29%). Grew most: Billing (+420)."
function sizeLine(size) {
  const df = size.files.after - size.files.before;
  const dl = size.loc.after - size.loc.before;
  let head;
  if (df === 0 && dl === 0) head = "Your app is the same size.";
  else {
    const pct = size.loc.before > 0 ? Math.round((dl / size.loc.before) * 100) : 0;
    const tail = pct !== 0 ? ` (${signed(pct)}%)` : "";
    if (df !== 0 && dl !== 0 && Math.sign(df) !== Math.sign(dl)) {
      const more = (n, one) => `${fmt(Math.abs(n))} ${n > 0 ? "more" : "fewer"} ${Math.abs(n) === 1 ? one : `${one}s`}`;
      head = `Your app has ${more(df, "file")} but ${more(dl, "line")}${tail}.`;
    } else {
      const bits = [df !== 0 ? plural(Math.abs(df), "file") : null, dl !== 0 ? plural(Math.abs(dl), "line") : null].filter(Boolean);
      head = `Your app is ${list(bits)} ${(dl || df) > 0 ? "bigger" : "smaller"}${tail}.`;
    }
  }
  const grew = size.areas.filter((a) => a.delta > 0);
  const shrank = size.areas.filter((a) => a.delta < 0).sort((a, b) => a.delta - b.delta || cmp(a.name, b.name));
  const bit = (a) => `${plainName(a.name)} (${signed(a.delta)})`;
  const more = [grew.length ? `Grew most: ${grew.map(bit).join(", ")}.` : "", shrank.length ? `Shrank most: ${shrank.map(bit).join(", ")}.` : ""].filter(Boolean);
  return [head, ...more].join(" ");
}

// A first look at an app: how big it is, and where the code is.
function standingSizeLine(size) {
  const head = `Your app is ${plural(size.files.after, "file")} and ${plural(size.loc.after, "line")} of code.`;
  const biggest = size.areas.filter((a) => a.delta > 0).map((a) => `${plainName(a.name)} (${fmt(a.after)})`);
  return biggest.length ? `${head} Biggest parts: ${biggest.join(", ")}.` : head;
}

// The things a reader should know about how far to trust the comparison. Returns look items and size items.
function noteItems(notes, it) {
  const look = [];
  const size = [];
  for (const n of notes) {
    switch (n.code) {
      case "repo-name-differs":
        look.push(it(`These two scans have different names (${plainName(n.before)} and ${plainName(n.after)}). Check you compared the right ones.`));
        break;
      case "unrelated":
        look.push(it(`Only ${n.shared}% of the files match, so these may be two different projects and the changes here may not mean much.`, undefined, true));
        break;
      case "capped":
        size.push(it("Your project is very large, so I only read part of it. The size numbers may be too low."));
        break;
      case "reshuffled":
        look.push(it(`${plural(n.count, KIND_ONE[n.kind] ?? "thing")} are all called ${plainName(n.name)}, so I could not tell which one became which. They are listed as new or gone, not as moved.`));
        break;
      case "scanner-drift":
        look.push(it(`${plural(n.ids.length, "change")} here ${n.ids.length === 1 ? "does" : "do"} not match any edit to your files. That can happen when the scan reads your project differently from before, so treat ${n.ids.length === 1 ? "it" : "them"} with care.`, n.ids.join(", "), true));
        break;
      default:
        break;
    }
  }
  return { look, size };
}

function posterItems(posters, added, it) {
  if (!posters) return [];
  const items = [];
  if (posters.stale) items.push(it("Your poster is out of date: it was drawn before these changes.", undefined, true));
  if (posters.unwired.length) items.push(it(`Your poster can't be redrawn as it stands: ${plural(posters.unwired.length, "problem")} with its parts.`, posters.unwired.join("; "), true));
  if (posters.uncited.length) {
    const names = posters.uncited.map((id) => bare(added.find((a) => a.id === id) ?? { kind: "x", name: id }));
    items.push(it(`${plural(posters.uncited.length, "new thing")} ${posters.uncited.length === 1 ? "isn't" : "aren't"} on your poster yet: ${nameList(names)}.`));
  }
  return items;
}

/* ─────────────────────────── the short version ─────────────────────────── */

const shortLabel = (f) => (f.kind === "ai" ? "the AI" : f.kind === "service" ? plainName(f.name) : label(f));

function shortOf(ch) {
  const added = (kind) => ch.added.filter((i) => i.kind === kind).length;
  const total = ch.added.length + ch.removed.length + ch.moved.length + ch.changed.length + ch.reach.gained.length + ch.reach.lost.length;
  const clauses = [];
  const take = (n, text) => {
    if (n > 0 && clauses.length < 4) clauses.push({ n, text });
  };
  take(added("screen"), plural(added("screen"), "new screen"));
  const s = added("service");
  const a = added("ai");
  take(s + a, list([s ? plural(s, "new outside service") : null, a ? (a === 1 ? "a new AI provider" : `${a} new AI providers`) : null].filter(Boolean)));
  const g = ch.reach.gained;
  take(g.length, g.length === 1 ? `${shortLabel(g[0].fact)} is now used from ${screenList(g[0].screens)}` : `${g.length} new connections from screens`);
  const gone = KIND_ORDER.map((k) => [k, ch.removed.filter((i) => i.kind === k).length]).filter(([, n]) => n > 0);
  take(ch.removed.length, `${list(gone.map(([k, n]) => plural(n, KIND_ONE[k], KIND_MANY[k])))} ${ch.removed.length === 1 ? "was" : "were"} removed`);
  take(added("job"), plural(added("job"), "new background job"));
  if (clauses.length === 0) {
    // None of the usual news: name the first kind of change there is, so the line is never just "1 change".
    const fallbacks = [
      [added("table"), plural(added("table"), "new saved record")],
      [added("endpoint"), plural(added("endpoint"), "new request")],
      [ch.moved.length, `${plural(ch.moved.length, "thing")} moved`],
      [ch.changed.length, `${plural(ch.changed.length, "thing")} changed`],
      [ch.reach.lost.length, `${plural(ch.reach.lost.length, "connection")} to screens lost`],
    ];
    const first = fallbacks.find(([n]) => n > 0);
    if (first) take(first[0], first[1]);
  }
  const consumed = clauses.reduce((sum, c) => sum + c.n, 0);
  const other = total - consumed;
  const text = clauses.map((c) => c.text);
  if (other > 0) text.push(plural(other, text.length ? "other change" : "change"));
  return text.length ? `${cap(clauseList(text))}.` : "";
}

/* ─────────────────────────── the doc ─────────────────────────── */

const NUMBER_ROWS = [["screen", "Screens"], ["table", "Saved records"], ["service", "Outside services"], ["ai", "AI"], ["job", "Background jobs"], ["endpoint", "Requests"]];

function numbersOf(ch, standing) {
  return NUMBER_ROWS.map(([kind, name]) => {
    const c = ch.counts[kind];
    const delta = c.after - c.before;
    const value = standing ? fmt(c.after) : delta === 0 ? `${fmt(c.after)} (no change)` : `${fmt(c.before)} → ${fmt(c.after)} (${signed(delta)})`;
    return { label: name, kind, before: c.before, after: c.after, delta, value, text: `${name} ${value}` };
  });
}

function ledeOf(ch) {
  const app = ch.after.repo ? plainName(ch.after.repo) : "your app";
  const b = ch.before.label;
  const a = ch.after.label;
  const standing = ch.before.empty && !ch.after.empty;
  const dated = ch.notes.find((n) => n.code === "first-save-after-date");
  let lede;
  if (standing) lede = `This is everything the scan found in ${a ?? app}.`;
  else if (b && a) lede = `Since ${b} · compared with ${a}.`;
  else lede = `Comparing two scans of ${app}.`;
  if (dated) lede += typeof dated.date === "string" ? ` Your first saved version is from ${dated.date}, after the date you asked about, so everything counts as new.` : " There was no saved version from before the date you asked about, so everything counts as new.";
  return lede;
}

// "Where your app stands now": everything is new, so say what is there by kind instead of listing it all.
function standingItems(ch, it) {
  const items = [];
  for (const kind of NUMBER_ROWS.map((r) => r[0])) {
    const l = ch.added.filter((i) => i.kind === kind).sort((x, y) => cmp(x.name, y.name) || cmp(x.id, y.id));
    if (!l.length) continue;
    const names = l.map((i) => {
      const n = bare(i);
      if (kind === "ai" && i.meta?.tools) return `${n} (${plural(i.meta.tools, "tool")})`;
      if (kind === "job" && i.meta?.schedule) return `${n} (${describeCron(i.meta.schedule)})`;
      return n;
    });
    items.push(it(`${plural(l.length, KIND_ONE[kind], KIND_MANY[kind])}: ${nameList(names)}.`, fileText([...new Set(l.flatMap((i) => i.files))].sort(cmp), 8)));
  }
  return items;
}

function standingShort(ch) {
  const bits = NUMBER_ROWS.filter(([k]) => ch.counts[k].after > 0).map(([k]) => plural(ch.counts[k].after, KIND_ONE[k], KIND_MANY[k]));
  return bits.length ? `Your app has ${clauseList(bits)}.` : "";
}

const FOOTER =
  "I can only see how your app is put together: screens, saved records, outside services, AI, background jobs and how they connect. I can't see wording, colour or settings changes.";
const NOT_STRUCTURAL =
  "Nothing structural changed: same screens, saved records, outside services, AI and jobs. (I can't see wording, colour or settings changes.)";

/**
 * Changes → doc { title, lede, short, numbers, sections: [{ id, title, items: [{ text, where?, flag? }] }], footer }.
 * Sections come in this order and are left out when empty: new, gone, changed, connected, offscreen, look, size
 * (a first look at an app has `now` in place of new/gone/changed/connected). `where` (file paths and witness chains)
 * is present only with `receipts`; the text of a line is the same either way. The size section also carries `bars`.
 */
export function buildBriefing(changes, { receipts = false } = {}) {
  if (!changes || changes.kind !== "changes" || changes.version !== 1) throw new TypeError("buildBriefing: expected a Changes (kind \"changes\", version 1)");
  const ch = changes;
  const it = makeItem(receipts);
  const sections = [];
  const section = (id, title, items, extra) => {
    if (items.length) sections.push({ id, title, items, ...extra });
  };

  const notes = noteItems(ch.notes, it);
  const standing = ch.before.empty && !ch.after.empty;
  const sizeItems = [it(standing ? standingSizeLine(ch.size) : sizeLine(ch.size)), ...notes.size];
  const bars = ch.size.areas.map((a) => ({ label: plainName(a.name), before: a.before, after: a.after, delta: a.delta }));

  if (ch.same) {
    return { title: "What changed", lede: ledeOf(ch), short: "Nothing changed.", numbers: [], sections: [], footer: "" };
  }

  if (standing) {
    section("now", "What is in it", standingItems(ch, it));
    section("offscreen", "Not on a screen yet", offscreenItems(ch.notOnScreen, it));
    section("look", "Worth a look", [...posterItems(ch.posters, ch.added, it), ...notes.look]);
    section("size", "Size", sizeItems, { bars });
    return { title: "Where your app stands now", lede: ledeOf(ch), short: standingShort(ch), numbers: numbersOf(ch, true), sections, footer: FOOTER };
  }

  const lookAll = [...lookItems(ch.worthALook, it), ...posterItems(ch.posters, ch.added, it), ...notes.look];

  if (!ch.structural) {
    section("look", "Worth a look", lookAll);
    section("size", "Size", sizeItems, { bars });
    return { title: "What changed", lede: ledeOf(ch), short: NOT_STRUCTURAL, numbers: numbersOf(ch, false), sections, footer: "" };
  }

  section("new", "New", factItems(ch.added, newLine, "are new", it));
  section("gone", "Gone", [...factItems(ch.removed, goneLine, "are gone", it), ...lostItems(ch.reach.lost, it)]);
  const movedItems = [...ch.moved].sort((a, b) => cmp(a.to.id, b.to.id)).map((m) => it(movedLine(m), `${fileText(m.from.files, 2)} \u2192 ${fileText(m.to.files, 2)}`));
  const changedItems = [...ch.changed].sort((a, b) => rank(a.kind) - rank(b.kind) || cmp(a.id, b.id) || cmp(a.type, b.type)).map((c) => it(changedLine(c), fileText(c.files)));
  section("changed", "Changed", [...movedItems, ...changedItems]);
  section("connected", "Now connected", connectedItems(ch.reach.gained, it));
  section("offscreen", "Not on a screen yet", offscreenItems(ch.notOnScreen, it));
  // With a generated client in the way, which screen calls which request cannot be told; say so once, where requests came or went.
  const touchesRequests = [...ch.added, ...ch.removed].some((i) => i.kind === "endpoint");
  if (ch.reach.generated && touchesRequests) lookAll.push(it("Your screens reach your requests through code that was generated for you, so I can't tell which screen uses which request."));
  section("look", "Worth a look", lookAll);
  section("size", "Size", sizeItems, { bars });
  return { title: "What changed", lede: ledeOf(ch), short: shortOf(ch) || `No screen seems to lead to ${plural(ch.notOnScreen.length, "thing")} any more.`, numbers: numbersOf(ch, false), sections, footer: FOOTER };
}

/** doc → plain text, ready to relay as is. */
export function renderText(doc) {
  const out = [doc.title, "", doc.lede];
  if (doc.short) out.push("", doc.short);
  if (doc.numbers.length) {
    const width = Math.max(...doc.numbers.map((n) => n.label.length));
    out.push("");
    for (const n of doc.numbers) out.push(`${n.label.padEnd(width)}  ${n.value}`);
  }
  for (const s of doc.sections) {
    out.push("", s.title);
    for (const i of s.items) {
      out.push(`- ${i.text}`);
      if (i.where) out.push(`    ↳ ${i.where}`);
    }
  }
  if (doc.footer) out.push("", doc.footer);
  return `${out.join("\n")}\n`;
}
