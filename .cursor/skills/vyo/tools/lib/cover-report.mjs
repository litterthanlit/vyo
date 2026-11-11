// What goes wrong with a cover, measured on its frames: a big part whose name never prints whole in the still, a
// part whose glyphs stray from its share of the lines, an accent that vanishes, a loop whose seam jumps, and an
// outline accent too thin to see or so thick the object reads orange. Each message names the one change to make.
import { COVER, COVER_GRID } from "./cover.mjs";
import { partsFromFacts, partOptions } from "./parts.mjs";

// shell: an outline accent under `thin` px reads at thumbnail size as a sliver on one side wall, not a shell; past
// `share` of the code the object reads as an orange thing with a dark hole. Judged on the stopwatch: 6% of the code
// made a 3px sliver, 27% (Express's example apps, the owner's favourite) a 32px outline all round, 58% an orange
// object. Good outline accents sit near `ideal`; with other strata a band near `band` shows best.
export const COVER_LIMITS = { thin: 16, share: 0.4, ideal: 0.27, band: 0.15, least: 0.05 };
// The shares that make a good outline accent before the shape is known: on a round object 20% of the code makes
// about a 21px shell, and past `share` the object reads orange.
export const OUTLINE_SHARE = [0.2, COVER_LIMITS.share];
export const COVER_CHECKS = ["cover-names", "cover-share", "cover-accent", "cover-seam", "cover-shell"];

const pct = (n) => `${n < 0.01 ? Math.round(n * 1000) / 10 : Math.round(n * 100)}%`;
const points = (n) => (Math.round(n * 1000) / 10).toFixed(1);

/**
 * Parts that would make a good accent here, best first, as `<id> ("<name>", <share>[, <shell>px])`. For an outline,
 * the parts whose outer shell would be at least `thin` px and at most `share` of the code, nearest `ideal`; for
 * other strata, the parts of `least` to `share` of the code, nearest `band`.
 */
export function accentCandidates(cover, limit = 3) {
  const { model, shell, region } = cover;
  const outline = model.strata.outline;
  const at = shell?.at;
  const L = COVER_LIMITS;
  return model.parts
    .map((p) => ({ ...p, px: at ? at(p.share) : null }))
    .filter((p) => !p.hot && p.share <= L.share && (outline && at ? p.px >= L.thin : p.share >= L.least))
    .sort((a, b) => Math.abs(a.share - (outline ? L.ideal : L.band)) - Math.abs(b.share - (outline ? L.ideal : L.band)))
    .slice(0, limit)
    .map((p) => `${p.id} ("${region.names?.[p.id] ?? p.name}", ${pct(p.share)}${p.px !== null ? `, a ${Math.round(p.px)}px shell` : ""})`);
}

const accentFix = (cover) => {
  const c = accentCandidates(cover);
  const want = cover.model.strata.outline ? `${Math.round(COVER_LIMITS.ideal * 100)}%` : `${Math.round(COVER_LIMITS.band * 100)}%`;
  if (c.length) return `put the accent on ${c.length > 1 ? "one of " : ""}${c.join(", ")}`;
  return cover.model.strata.outline ? 'no part here makes a thicker shell, so set "strata": "down" for bands top to bottom, or take a rounder silhouette' : `put the accent on the part nearest ${want} of the code (vyo parts lists the shares)`;
};

/** The longest run of one part's cells along a glyph row in a frame: the most room its name has. */
const longestRun = (cells, part, cols) => {
  let [best, run, last] = [0, 0, -2];
  for (const c of cells) {
    if (c.part !== part) continue;
    run = c.i === last + 1 && c.i % cols !== 0 ? run + 1 : 1;
    last = c.i;
    best = Math.max(best, run);
  }
  return best;
};

/**
 * Every finding on a cover, by check id. `still` is the still's measurements (the page's, or Node's in the sketch);
 * `loop` is every frame's and the steps between them when the loop was drawn; `cells` gives a frame's cells.
 * @returns {Record<(typeof COVER_CHECKS)[number], string[]>}
 */
export function coverFindings(cover, { still = cover.still, loop = null, cells = null, facts = null } = {}) {
  const out = Object.fromEntries(COVER_CHECKS.map((id) => [id, []]));
  const { model, region, shell } = cover;
  const parts = model.parts;
  const hot = parts.filter((p) => p.hot);
  if (hot.length !== 1) {
    out["cover-accent"].push(
      hot.length
        ? `the accent ${region.accent} names ${hot.length} parts (${hot.map((p) => `"${p.name}"`).join(", ")}); set it to the id of one of them (vyo parts lists the ids)`
        : `the accent ${region.accent ?? "is not set and"} names no part, so nothing prints in orange; ${accentFix(cover)}`,
    );
  }
  const frames = loop?.reports ?? [still];
  for (const r of frames) {
    if (hot.length === 1 && r.accentCells === 0) {
      out["cover-accent"].push(`the accent "${hot[0].name}" prints no glyph in frame ${r.frame}; at ${pct(hot[0].share)} of the code it is too small to show in every pose, so ${accentFix(cover)}`);
      break;
    }
  }
  const worst = frames.reduce((m, r) => (r.shareGap > m.shareGap ? r : m), frames[0]);
  if (worst.shareGap > COVER.gap) {
    const i = worst.shares.reduce((b, s, k) => (Math.abs(s - parts[k].share) > Math.abs(worst.shares[b] - parts[b].share) ? k : b), 0);
    const len = parts[i].name.length;
    out["cover-share"].push(`in frame ${worst.frame} "${parts[i].name}" prints ${pct(worst.shares[i])} of the glyphs for ${pct(parts[i].share)} of the lines, ${points(Math.abs(worst.shares[i] - parts[i].share))} points off where at most ${points(COVER.gap)} is allowed; its plain name is too long for its stratum there, so shorten it from ${len} characters to ${Math.max(3, Math.floor(len * 0.6))} or fewer`);
  }
  parts.forEach((p, i) => {
    if (p.share < COVER.big || still.whole[i] > 0) return;
    const room = cells ? longestRun(cells(still.frame), i, COVER_GRID.cols) : 0;
    const fit = Math.max(3, Math.floor((room - 1) / 2), Math.floor(p.name.length * 0.6));
    out["cover-names"].push(`"${p.name}" (${pct(p.share)} of the code) never prints its whole name in the still, frame ${still.frame}; at ${p.name.length} characters it does not fit its stratum there, so shorten it to ${Math.min(fit, p.name.length - 1)} characters or fewer`);
  });
  if (loop) {
    const inner = loop.steps.slice(0, -1);
    const seam = loop.steps[loop.steps.length - 1];
    const most = Math.max(...inner);
    if (seam > most * COVER.seam) out["cover-seam"].push(`the step from the last frame back to the first changes ${seam} glyphs where the largest step inside the loop changes ${most}, so the GIF jumps at its seam; this is an engine fault, so render without --gif and report it`);
  }
  if (shell && hot.length === 1) {
    if (shell.px < COVER_LIMITS.thin) {
      out["cover-shell"].push(`the orange shell is ${Math.round(shell.px)}px thick (${pct(shell.share)} of the code); under ${COVER_LIMITS.thin}px it reads as a hairline, not a shell, at thumbnail size, so ${accentFix(cover)}`);
    } else if (shell.share > COVER_LIMITS.share) {
      const split = facts && splits(facts, region);
      out["cover-shell"].push(`the orange shell is ${pct(shell.share)} of the code and ${Math.round(shell.px)}px thick, so the object reads mostly orange (keep it at ${pct(COVER_LIMITS.share)} or less); ${split ? `add "split": [${[...(region.split ?? []), hot[0].id].map((s) => `"${s}"`).join(", ")}] to the region and put the accent on one of the ${split} parts inside it, or ` : ""}${accentFix(cover)}`);
    }
  }
  return out;
}

/** How many parts splitting the accent gives it, or 0 when it has no folders inside it. */
function splits(facts, region) {
  const before = partsFromFacts(facts, partOptions(region)).length;
  const after = partsFromFacts(facts, { ...partOptions(region), split: [...(region.split ?? []), region.accent] }).length;
  return after > before ? after - before + 1 : 0;
}
