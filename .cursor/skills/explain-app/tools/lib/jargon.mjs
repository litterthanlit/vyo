// The banned-term list for every word on the poster. plain-language-rules.md shows the same
// terms with what to say instead; test/spec.test.mjs fails when the two drift apart.
export const BANNED = [
  "api", "endpoint", "endpoints", "middleware", "orm", "webhook", "webhooks",
  "deploy", "deployment", "env var", "frontend", "backend", "monorepo", "sdk",
  "graphql", "component", "components", "module", "modules",
  "repository", "repo", "commit", "commits", "pr", "mvp",
  "leverage", "utilize", "platform", "ecosystem", "synergy", "holistic",
  "disruptive", "revolutionary",
];

const SINGLE = new Set(BANNED.filter((t) => !t.includes(" ")));
const PAIRS = new Set(BANNED.filter((t) => t.includes(" ")));

/** The banned tokens in `text`, whole words, case-folded, in order of appearance, deduped. */
export function isJargon(text) {
  const words = String(text).toLowerCase().match(/[a-z0-9]+(?:'[a-z]+)?/g) || [];
  const hits = [];
  words.forEach((w, i) => {
    if (SINGLE.has(w)) hits.push(w);
    if (i > 0 && PAIRS.has(`${words[i - 1]} ${w}`)) hits.push(`${words[i - 1]} ${w}`);
  });
  return [...new Set(hits)];
}
