// What goes wrong with a cover, measured on its frames: a big part whose name never prints whole in the still, a
// part whose glyphs stray from its share of the lines, an accent that vanishes, a loop whose seam jumps, and an
// outline accent too thin to see or so thick the object reads orange. Each message names the one change to make.
import { COVER, COVER_GRID, coverLegend } from "./cover.mjs";
import { partsFromFacts, partOptions, aroundProduct } from "./parts.mjs";

// The orange is an accent, never the whole object: past `share` of the code it is most of the object, whatever
// the strata, and the cover fails. An outline accent under `thin` px reads at thumbnail size as a sliver on one
// side wall, not a ring, so on each object an outline takes accents from the share that makes a `thin` ring to
// `share`; bands show any accent from `least`. Judged on the stopwatch: 6% of the code made a 3px sliver, 27% a
// 32px outline all round, 58% an orange object; Requests's 98% accent drew a solid orange plane. Good outline
// accents sit near `ideal`, bands near `band`.
export const COVER_LIMITS = { thin: 16, share: 0.4, ideal: 0.27, band: 0.15, least: 0.05 };
export const COVER_CHECKS = ["cover-names", "cover-share", "cover-accent", "cover-seam", "cover-shell"];

const pct = (n) => `${n < 0.01 ? Math.round(n * 1000) / 10 : Math.round(n * 100)}%`;
const points = (n) => (Math.round(n * 1000) / 10).toFixed(1);

/**
 * The good-accent window on this cover's object, as shares of the code: for an outline, from the least share
 * whose ring is `thin` px in the still to `share` (null when no share up to `share` makes one); for bands,
 * `least` to `share`. `cover` must be drawn as an outline with an accent set, so its shell can be measured.
 */
export function coverWindow(cover) {
  const L = COVER_LIMITS;
  let floor = null;
  for (let s = 1; s <= L.share * 100 && floor === null; s++) if (Math.round(cover.shell.at(s / 100)) >= L.thin) floor = s / 100;
  return { ring: floor === null ? null : [floor, L.share], band: [L.least, L.share] };
}

/**
 * Parts the product could be about that would make a good accent here, best first, as `<id> ("<name>", <share>[,
 * <shell>px])`. Code around the product (samples, tests, docs, scripts, setup) is never offered. For an outline,
 * the parts whose ring would be at least `thin` px and at most `share` of the code, nearest `ideal`; for other
 * strata, the parts of `least` to `share` of the code, nearest `band`.
 */
export function accentCandidates(cover, limit = 3, outline = cover.model.strata.outline) {
  const { model, shell, region } = cover;
  const at = outline ? shell?.at : null;
  const L = COVER_LIMITS;
  return model.parts
    .map((p) => ({ ...p, px: at ? at(p.share) : null }))
    .filter((p) => !p.hot && !aroundProduct(p.id) && p.share <= L.share && (outline && at ? Math.round(p.px) >= L.thin : p.share >= L.least))
    .sort((a, b) => Math.abs(a.share - (outline ? L.ideal : L.band)) - Math.abs(b.share - (outline ? L.ideal : L.band)))
    .slice(0, limit)
    .map((p) => `${p.id} ("${region.names?.[p.id] ?? p.name}", ${pct(p.share)}${p.px !== null ? `, a ${Math.round(p.px)}px shell` : ""})`);
}

/**
 * The one change to make. The accent is the part the product is about, so the fix keeps it when it can: a ring
 * too thin becomes a band. Only an accent too small for any strata moves, to a part the product could be about.
 */
const accentFix = (cover, thin = false) => {
  const on = (list) => `${list.length > 1 ? "one of " : ""}${list.join(", ")}`;
  const hot = cover.model.parts.find((p) => p.hot);
  if (thin && hot && hot.share >= COVER_LIMITS.least) {
    const legend = coverLegend({ ...cover.region, strata: "down" }, cover.product, cover.region.names?.[hot.id] ?? hot.name);
    return `keep the accent and set "strata": "down", which draws it as an orange band, and change the legend to "${legend}"`;
  }
  const c = accentCandidates(cover);
  if (c.length) return `put the accent on ${on(c)}`;
  if (!cover.model.strata.outline) return `put the accent on the part the product is about nearest ${Math.round(COVER_LIMITS.band * 100)}% of the code (vyo parts lists the shares)`;
  const bands = accentCandidates(cover, 3, false);
  return `no part here makes a ${thin ? "thicker" : "good"} ring, so set "strata": "down" for bands top to bottom${bands.length ? ` and put the accent on ${on(bands)}` : thin ? ", or take a rounder silhouette" : ""}`;
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
  if (hot.length === 1 && hot[0].share > COVER_LIMITS.share) {
    const n = facts ? splits(facts, region) : 0;
    const ids = [...(region.split ?? []), hot[0].id].map((s) => `"${s}"`).join(", ");
    out["cover-accent"].push(
      `the accent "${hot[0].name}" is ${pct(hot[0].share)} of the code, so the orange would be most of the object (at most ${pct(COVER_LIMITS.share)}); ${
        n ? `add "split": [${ids}] to the region to cut it into the ${n} parts inside it, then put the accent on the one the product is about (vyo parts <facts> --field shape ${[...(region.split ?? []), hot[0].id].map((s) => `--split ${s}`).join(" ")} lists them)` : "put the accent on a smaller part the product is about"
      }`,
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
  if (shell && hot.length === 1 && hot[0].share <= COVER_LIMITS.share && Math.round(shell.px) < COVER_LIMITS.thin) {
    out["cover-shell"].push(`the orange shell is ${Math.round(shell.px)}px thick (${pct(shell.share)} of the code); under ${COVER_LIMITS.thin}px it reads as a hairline, not a shell, at thumbnail size, so ${accentFix(cover, true)}`);
  }
  return out;
}

/** How many parts splitting the accent gives it, or 0 when it has nothing inside it to split. */
function splits(facts, region) {
  const before = partsFromFacts(facts, partOptions(region)).length;
  const after = partsFromFacts(facts, { ...partOptions(region), split: [...(region.split ?? []), region.accent] }).length;
  return after > before ? after - before + 1 : 0;
}
