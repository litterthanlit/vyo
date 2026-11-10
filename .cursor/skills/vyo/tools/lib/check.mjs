// Every rule a poster must pass, as one table. "spec" checks run before render; "page" checks
// judge the measurements lib/inspect.js takes in the rendered page.
import { validateSpec, textProblems, hasWord, geometryKey } from "./spec.mjs";
import { bandCounts, bandLine } from "./band.mjs";
import { FONT_FACES, tokensOf, fieldTokensOf, recordText } from "./render.mjs";
import { frameOf, ROLES } from "./frame.mjs";
import { partsFromFacts, partOptions, regionParts, unplainName, sameNames } from "./parts.mjs";
import { FIELDS } from "./fields/index.mjs";
import { shapeReport, shapeFindings, SHAPE_LIMITS } from "./shape-report.mjs";
import { RINGS } from "./fields/shape-rings.mjs";
import { RELIEF } from "./fields/shape-relief.mjs";

const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
const overlap = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
const sameBand = (a, b) => a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
const grow = (r, x, y) => ({ left: r.left - x, right: r.right + x, top: r.top - y, bottom: r.bottom + y });
// Side by side, two things need 8px between them: rects that share a horizontal band are inflated by 4px each.
const crowd = (a, b) => (sameBand(a, b) ? overlap(grow(a, 4, 4), grow(b, 4, 4)) : overlap(a, b));
const inside = (r, s) => r.left >= s.left - 0.5 && r.top >= s.top - 0.5 && r.right <= s.right + 0.5 && r.bottom <= s.bottom + 0.5;
const hasProduct = (name, spec) => !!spec.product?.name && name.toLowerCase().includes(spec.product.name.toLowerCase());
const round = (n) => Math.round(n);
const pct = (n) => `${Math.round(n * 100)}%`;
const fillIds = (spec) => spec.figure.regions.filter((r) => r.kind === "fill").map((r) => r.id);
const fieldsOf = (spec) => spec.figure.regions.filter((r) => r.kind === "field");
// Fields lay their own rows out from the scan, so the rules for hand-drawn shapes judge fill rows only.
const fillRowsOf = (page) => {
  const fills = new Set(page.regions.filter((r) => r.kind === "fill").map((r) => r.id));
  return page.rows.filter((r) => fills.has(r.region));
};
// A keyword counts when a word starts with it, case-folded: "travels" has "travel", "hand-off" has "hand".
const startsWord = (text, word) => new RegExp(`(^|[^\\p{L}\\p{N}])${word}`, "iu").test(text);
const anyOf = (words) => words.map((w) => `"${w}"`).join(" or ");
/** The legend's message: the accent part's plain name and the field's measure words. */
export const legendMessage = (names, measure) =>
  `must say what the picture encodes; name the accent part (${names.length ? names.map((n) => `"${n}"`).join(" or ") : "set an accent first"}) and the measure (${measure.map(anyOf).join(", and ")})`;
const linesOf = (facts) => Object.values(facts.files).reduce((s, f) => s + (f.gen ? 0 : f.loc), 0);
const union = (rects) => rects.reduce((u, r) => ({ left: Math.min(u.left, r.left), top: Math.min(u.top, r.top), right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });

const spreadOf = (widths) => {
  const mean = widths.reduce((s, w) => s + w, 0) / (widths.length || 1);
  const sd = Math.sqrt(widths.reduce((s, w) => s + (w - mean) ** 2, 0) / (widths.length || 1));
  return { mean, spread: sd / mean };
};

/** The coverage numbers `silhouette` judges; `vyo sketch` prints the same from its estimate. */
export function figureStats(rowRects, dotRects, floor) {
  const all = [...rowRects, ...dotRects];
  const area = all.reduce((s, r) => s + (r.right - r.left) * (r.bottom - r.top), 0);
  const u = union(all);
  return {
    coverage: area / (840 * floor),
    height: all.length ? (u.bottom - u.top) / floor : 0,
    width: all.length ? (u.right - u.left) / 840 : 0,
  };
}
// A descender's tail is about 20 px at 2x; antialiasing alone moves none.
const TEXT_CLEAR = 8;
export const SILHOUETTE = { coverage: 0.15, height: 0.55, width: 0.6 };

/**
 * Per fill region, the numbers `row-variety` and `thin-region` judge. A line is every run of the region at one y,
 * merged into its outer span, so a hole does not make a box look varied or a wide ring look thin.
 * @param {{ region: string, left: number, right: number, top: number }[]} rows
 * @returns {{ id: string, variety: number, width: number }[]}
 */
export function regionStats(rows) {
  const regions = new Map();
  for (const r of rows) {
    if (!regions.has(r.region)) regions.set(r.region, new Map());
    const lines = regions.get(r.region);
    const y = Math.round(r.top);
    const [left, right] = lines.get(y) ?? [Infinity, -Infinity];
    lines.set(y, [Math.min(left, r.left), Math.max(right, r.right)]);
  }
  return [...regions].map(([id, lines]) => {
    const { mean, spread } = spreadOf([...lines.values()].map(([left, right]) => right - left));
    return { id, variety: spread, width: mean };
  });
}
// Measured on rendered posters: weak figures' main regions spread 0.15 to 0.22, good ones 0.31 to 0.50;
// weak columns averaged 84 to 128px across, the presets' narrowest region 238px.
export const REGION = { variety: 0.25, width: 160 };
export const boxMessage = (s) => `region ${s.id} is a box; a silhouette changes width along its whole height (spread/mean ${s.variety.toFixed(2)}, needs ${REGION.variety})`;
export const thinMessage = (s) => `region ${s.id} reads as a column; widen it or make it part of the main silhouette (${Math.round(s.width)}px across on average, under ${REGION.width}px)`;
const pageRegionStats = (page) => regionStats(fillRowsOf(page).map((r) => ({ region: r.region, ...r.rect })));

/**
 * A check of every shape field, read from shape-report's findings. `drawn` picks what the finding measures
 * on the page: its rows, its text blocks, or nothing (the mask alone).
 */
const shapeCheck = (id, level, stage, about, drawn = () => ({})) => ({
  id, level, stage, frames: ["loose"], about,
  run: (i) => fieldsOf(i.spec).filter((r) => r.field === "shape").flatMap((r) => shapeFindings(shapeReport(i.spec, r, i.facts), drawn(i))[id]),
});

/**
 * @typedef {{ spec: any, facts: any, presets: Record<string, any>, page?: any }} CheckInput
 * A check with `frames` runs only on posters in those frames; without, on every poster.
 * @type {{ id: string, level: "fail" | "warn", stage: "spec" | "page", frames?: ("swiss" | "loose")[], about: string, run: (i: CheckInput) => string[] }[]}
 */
export const CHECKS = [
  {
    id: "spec", level: "fail", stage: "spec", about: "the spec passes every rule in lib/spec.mjs",
    run: ({ spec }) => validateSpec(spec),
  },
  {
    id: "facts-hash", level: "fail", stage: "spec", about: "the spec was written for this facts.json",
    run: ({ spec, facts }) => (spec.facts === facts.hash ? [] : [`spec.facts is ${spec.facts} but facts.json is ${facts.hash}; the scan changed, so check the copy and set "facts" to ${facts.hash}`]),
  },
  {
    // Only the swiss footer prints counts; a loose field draws parts by their size and has no counts line.
    id: "facts-empty", level: "warn", stage: "spec", frames: ["swiss"], about: "the scan found something to count for the swiss footer",
    run: ({ facts }) => (facts.empty ? ["no application facts; the footer shows provenance only"] : []),
  },
  {
    id: "product-name", level: "warn", stage: "spec", about: "the product name is the customer-facing name",
    run: ({ spec, facts }) => (spec.product.name === facts.repo.name ? [`product name equals the folder name "${facts.repo.name}"; use the name customers see`] : []),
  },
  {
    id: "preset-copy", level: "warn", stage: "spec", about: "the figure's geometry is not a preset's, unchanged",
    run: ({ spec, presets }) => {
      const mine = spec.figure.regions.filter((r) => r.kind !== "field").map(geometryKey);
      if (!mine.length) return [];
      const same = Object.entries(presets).find(([, p]) => {
        const theirs = new Set(p.figure.regions.filter((r) => r.kind !== "field").map(geometryKey));
        return mine.every((k) => theirs.has(k));
      });
      return same ? [`the figure's geometry is the ${same[0]} preset's, unchanged; shape it for this product`] : [];
    },
  },
  {
    id: "part-name", level: "warn", stage: "spec", about: "every part a field draws has a plain name of its own, and every name in names belongs to a part",
    run: ({ spec, facts }) =>
      fieldsOf(spec).flatMap((r) => {
        const parts = partsFromFacts(facts, partOptions(r));
        return [
          ...parts.filter((p) => !unplainName(p.name) && hasProduct(p.name, spec)).map((p) => `part "${p.name}" (${p.id}) is or contains the product name; give it a plain name in names`),
          ...parts.filter((p) => !unplainName(p.name) && !(r.names ?? {})[p.id] && !hasProduct(p.name, spec)).map((p) => `part "${p.name}" (${p.id}) keeps its scanned name; give every part a plain lowercase name in names`),
          ...Object.keys(r.names ?? {}).filter((id) => !parts.some((p) => p.id === id)).map((id) => `names has ${id}, which is not a part of region ${r.id}; vyo parts lists the part ids`),
          ...sameNames(parts).map((g) => `parts ${g.map((p) => p.id).join(" and ")} are all called "${g[0].name}"; give each a plain name of its own in names`),
        ];
      }),
  },
  {
    id: "part-unplain", level: "fail", stage: "spec", about: "no part a field draws still carries a name that looks like a vendor or code name",
    run: ({ spec, facts }) =>
      fieldsOf(spec).flatMap((r) =>
        partsFromFacts(facts, partOptions(r)).filter((p) => unplainName(p.name)).map((p) => `part "${p.name}" (${p.id}) looks like a vendor or code name; add a plain name in names`),
      ),
  },
  {
    id: "accent-part", level: "warn", stage: "spec", about: "every field sets an accent part",
    run: ({ spec }) => fieldsOf(spec).filter((r) => r.accent === undefined).map((r) => `no accent part in region ${r.id}; set accent to the id of the part the poster is about (vyo parts lists them)`),
  },
  {
    id: "legend", level: "fail", stage: "spec", frames: ["loose"], about: "the legend names the accent part and the field's measure, so the picture reads as this project",
    run: ({ spec, facts }) =>
      fieldsOf(spec).flatMap((r) => {
        const legend = spec.figure.texts.find((t) => t.role === "legend")?.text ?? "";
        const names = regionParts(r, facts).filter((p) => p.hot).map((p) => p.name);
        const { measure } = FIELDS[r.field];
        // An accent that names no part is field-parts' to report; the legend still owes the measure.
        const named = !names.length || names.some((n) => legend.toLowerCase().includes(n.toLowerCase()));
        const measured = measure.every((group) => group.some((w) => startsWord(legend, w)));
        return named && measured ? [] : [legendMessage(names, measure)];
      }),
  },
  {
    id: "fits", level: "fail", stage: "spec", about: "a field's fits says why this field matches the product's story, in one of the field's keywords",
    run: ({ spec }) =>
      fieldsOf(spec)
        .filter((r) => !FIELDS[r.field].fits.some((w) => startsWord(r.fits, w)))
        .map((r) => `region ${r.id}: fits must say why a ${r.field} matches the product's story; use ${anyOf(FIELDS[r.field].fits)}`),
  },
  shapeCheck("shape-thin", "warn", "spec", `no feature of a drawn shape, and no cut in it, is under ${SHAPE_LIMITS.thin}px across, a hairline at thumbnail size`),
  shapeCheck("shape-cover", "warn", "spec", `a drawn shape covers at least ${SHAPE_LIMITS.cover * 100}% of the sheet`),
  shapeCheck("shape-accent", "warn", "spec", `the accent band of a drawn shape is at least ${SHAPE_LIMITS.accent}px tall, so it shows in the thumbnail`),
  shapeCheck("shape-split", "warn", "spec", "no band of a drawn shape falls on two separate pieces of it"),
  shapeCheck("shape-rings", "warn", "spec", `a shape in rings is deep enough for ${RINGS.perPart} rings per part`),
  shapeCheck("shape-upright", "warn", "spec", `every part of a shape in rings shows its name at least once leaning under ${RINGS.upright} degrees`),
  shapeCheck("shape-tone", "warn", "spec", `at thumbnail size a relief's lit side reaches ${RELIEF.tone.lit * 100}% light and its tones span ${RELIEF.tone.spread * 100}%, so it reads as a bright volume`),
  shapeCheck("shape-share", "fail", "page", `every part of a relief has its share of the glyphs within ${RELIEF.share.part * 100}% of its share of the lines`, ({ page }) => ({ rows: page.rows.map((r) => ({ part: r.part, text: r.text, width: r.rect.width })) })),
  shapeCheck("shape-name", "fail", "page", "every band of a drawn shape shows its part's whole name at least once", ({ page }) => ({ rows: page.rows.map((r) => ({ part: r.part, text: r.text, width: r.rect.width })) })),
  shapeCheck("shape-room", "fail", "page", `every text block sits in the room a drawn shape leaves, ${SHAPE_LIMITS.clear}px clear of it`, ({ page }) => ({
    blocks: page.blocks.filter((b) => b.role).map((b) => ({ id: b.name, ...b.rect })),
  })),
  {
    id: "drawn", level: "fail", stage: "page", about: "the figure script ran to the end",
    run: ({ page }) => [...page.errors.map((e) => `page error: ${e}`), ...(page.drawn ? [] : ["the figure never set window.drawn"])],
  },
  {
    id: "fonts", level: "fail", stage: "page", about: "Commit Mono 400 and 700 and Newsreader 400 loaded",
    run: ({ page }) =>
      FONT_FACES.filter(({ family, weight }) => !page.faces.some((f) => f.family === family && f.weight === String(weight) && f.status === "loaded")).map(
        ({ family, weight }) => `${family} ${weight} did not load`,
      ),
  },
  {
    id: "masthead-font", level: "warn", stage: "page", frames: ["swiss"], about: "Inter Display or Inter is installed for the product name",
    run: ({ page }) => (page.inter ? [] : ["neither Inter Display nor Inter is installed; the product name falls back to Helvetica or Arial"]),
  },
  {
    id: "path", level: "fail", stage: "page", about: "every fill region's outline is on the sheet and above the footer",
    run: ({ page }) =>
      page.regions
        .filter((r) => r.kind === "fill")
        .flatMap((r) => {
          const b = r.bbox;
          if (!(b.right - b.left >= 1 && b.bottom - b.top >= 1)) return [`region ${r.id} has an empty outline`];
          const out = [];
          if (!inside(b, page.sheet)) out.push(`region ${r.id} runs off the sheet (${round(b.left)}, ${round(b.top)} to ${round(b.right)}, ${round(b.bottom)})`);
          const below = Math.ceil(b.bottom - page.footerTop);
          if (below > 0) out.push(`region ${r.id} reaches ${below}px below the footer; move it up by ${below}`);
          return out;
        }),
  },
  {
    id: "region-size", level: "fail", stage: "page", about: "every fill region has at least 4 rows and every dots region fits above the footer",
    run: ({ page }) =>
      page.regions.flatMap((r) => {
        if (r.kind === "field") return [];
        if (r.kind === "fill") return r.rows >= 4 ? [] : [`region ${r.id} has ${r.rows} rows; it needs at least 4, so make it taller or wider`];
        const ok = inside(r.bbox, page.sheet) && r.bbox.bottom <= page.footerTop + 0.5;
        return ok ? [] : [`region ${r.id} does not fit: its letters end at ${round(r.bbox.bottom)}px and ${round(r.bbox.right)}px, the footer starts at ${round(page.footerTop)}px; use a smaller cell or move it`];
      }),
  },
  {
    id: "rows-fit", level: "fail", stage: "page", about: "every row of words fits its planned width, inside the sheet and above the footer",
    run: ({ page }) =>
      page.rows.flatMap((r) => [
        ...(r.scrollWidth > r.clientWidth ? [`the row "${r.word}" needs ${r.scrollWidth}px but has ${r.clientWidth}px; use shorter words`] : []),
        ...(inside(r.rect, page.sheet) ? [] : [`the row "${r.word}" in region ${r.region} sits outside the sheet; a word wider than its run overhangs, so use a shorter word or widen the shape`]),
        ...(r.rect.bottom > page.footerTop + 0.5 ? [`the row "${r.word}" runs into the footer (bottom at ${round(r.rect.bottom)}px, footer at ${round(page.footerTop)}px)`] : []),
      ]),
  },
  {
    id: "words-drawn", level: "fail", stage: "page", about: "every word of every fill region, and the hot word, appear in the figure",
    run: ({ spec, page }) => {
      const out = [];
      for (const r of spec.figure.regions.filter((x) => x.kind === "fill")) {
        const drawn = new Set(page.rows.filter((row) => row.region === r.id).map((row) => row.word.toLowerCase()));
        for (const w of r.words) if (!drawn.has(w.toLowerCase())) out.push(`region ${r.id}: "${w}" never drawn; shorten the list or enlarge the path`);
      }
      const hotRegion = spec.figure.regions.some((r) => r.hot) && page.rows.some((r) => r.hot);
      if (spec.hot !== undefined && !hotRegion && !page.figureHot.some((t) => hasWord(t, spec.hot))) out.push(`the hot word "${spec.hot}" is not drawn in the accent colour`);
      return out;
    },
  },
  {
    id: "regions-apart", level: "fail", stage: "page", about: "rows of different regions keep 4px apart",
    run: ({ page }) => {
      const items = [...page.rows, ...page.dots];
      const out = new Set();
      items.forEach((a, i) =>
        items.slice(i + 1).forEach((b) => {
          if (a.region !== b.region && sameBand(a.rect, b.rect) && overlap(grow(a.rect, 2, 0), grow(b.rect, 2, 0))) {
            out.add(`regions ${a.region} and ${b.region} touch at y ${round(Math.max(a.rect.top, b.rect.top))}; leave 4px between them or cut a hole. A long phrase that overhangs a narrow run can also cause this; shorten the word or widen the run.`);
          }
        }),
      );
      return [...out];
    },
  },
  {
    id: "blocks-apart", level: "fail", stage: "page", about: "no two text blocks overlap, rows and dots keep clear of them (in the swiss frame a wave's rows may pass behind the figure's texts), and blocks side by side keep 8px apart",
    run: ({ spec, page }) => {
      const blocks = page.blocks.map((b) => ({ ...b, kind: "block" }));
      // In the loose frame no type sits on the field, so no row passes behind a text.
      const behind = new Set(frameOf(spec) === "swiss" ? fieldsOf(spec).filter((r) => FIELDS[r.field].behindTexts).map((r) => r.id) : []);
      const marks = [...page.rows.map((r) => ({ ...r, name: `the row "${r.word}"` })), ...page.dots.map((d) => ({ ...d, name: `the dots line "${d.word}"` }))];
      const out = [];
      const say = (a, b) => out.push(`${a.name} overlaps ${b.name} or sits within 8px of it; shorten one of them`);
      blocks.forEach((a, i) => blocks.slice(i + 1).forEach((b) => crowd(a.rect, b.rect) && say(a, b)));
      for (const a of blocks) for (const m of marks) if (!(a.role && behind.has(m.region)) && crowd(a.rect, m.rect)) say(a, m);
      const fills = fillRowsOf(page);
      fills.forEach((a, i) => fills.slice(i + 1).forEach((b) => a.region === b.region && crowd(a.rect, b.rect) && say({ name: `the row "${a.word}"` }, { name: `the row "${b.word}"` })));
      return [...new Set(out)];
    },
  },
  {
    id: "text-clear", level: "fail", stage: "page", about: `nothing is painted over a text block's letters: at most ${TEXT_CLEAR} px of them (at 2x) differ from the block drawn alone`,
    run: ({ page }) =>
      (page.covered ?? [])
        .filter((c) => c.covered > TEXT_CLEAR)
        .map((c) => `${c.covered} px of the ${c.block}'s letters are painted over near ${c.x},${c.y}; something is drawn on top of the text, so move the block clear of it`),
  },
  {
    id: "blocks-inside", level: "fail", stage: "page", about: "every text block is inside the sheet",
    run: ({ page }) => page.blocks.filter((b) => !inside(b.rect, page.sheet)).map((b) => `${b.name} runs off the sheet (bottom at ${round(b.rect.bottom)}px of ${page.sheet.bottom}px)`),
  },
  {
    id: "silhouette", level: "fail", stage: "page", about: "the figure covers 15% of the sheet above the footer and spans 55% of its height and 60% of its width",
    run: ({ page }) => {
      const s = figureStats(page.rows.map((r) => r.rect), page.dots.map((d) => d.rect), page.footerTop);
      const out = [];
      if (s.coverage < SILHOUETTE.coverage) out.push(`the figure covers ${pct(s.coverage)} of the sheet above the footer; it needs ${pct(SILHOUETTE.coverage)}, so enlarge the shapes`);
      if (s.height < SILHOUETTE.height) out.push(`the figure spans ${pct(s.height)} of the height above the footer; it needs ${pct(SILHOUETTE.height)}`);
      if (s.width < SILHOUETTE.width) out.push(`the figure spans ${pct(s.width)} of the sheet's width; it needs ${pct(SILHOUETTE.width)}`);
      return out;
    },
  },
  {
    id: "field-parts", level: "fail", stage: "page", about: "a field's parts hold every line of the scan, each part is drawn, and its accent names a part",
    run: ({ spec, facts, page }) =>
      fieldsOf(spec).flatMap((r) => {
        const parts = regionParts(r, facts);
        const total = linesOf(facts);
        const held = parts.reduce((s, p) => s + p.loc, 0);
        const drawn = new Set(page.rows.filter((row) => row.region === r.id).map((row) => row.part));
        return [
          ...(held === total ? [] : [`region ${r.id}: the parts hold ${held} lines but facts.json has ${total}`]),
          ...parts.filter((p) => !drawn.has(p.id)).map((p) => `region ${r.id}: part "${p.name}" (${p.id}) is never drawn; move the text blocks that cover it`),
          ...(r.accent !== undefined && !parts.some((p) => p.hot) ? [`region ${r.id}: accent ${r.accent} names no part; vyo parts lists the part ids`] : []),
        ];
      }),
  },
  {
    id: "row-variety", level: "fail", stage: "page", about: `every fill region changes width: its lines' spread over their mean is at least ${REGION.variety}`,
    run: ({ page }) => pageRegionStats(page).filter((s) => s.variety < REGION.variety).map(boxMessage),
  },
  {
    id: "thin-region", level: "warn", stage: "page", about: `every fill region is at least ${REGION.width}px across on average`,
    run: ({ page }) => pageRegionStats(page).filter((s) => s.width < REGION.width).map(thinMessage),
  },
  {
    id: "one-region", level: "warn", stage: "page", about: "the figure has more than one fill region, or dots, or an accent",
    run: ({ spec, page }) => {
      const regions = spec.figure.regions;
      const accent = page.rows.some((r) => r.hot) || spec.figure.texts.some((t) => t.hot);
      return fillIds(spec).length === 1 && regions.length === 1 && !accent ? ["the figure is one region with no accent; add a second region, dots or a hot label"] : [];
    },
  },
  {
    id: "palette", level: "fail", stage: "page", about: "every colour on the sheet is one of the theme's tokens, or in a field's rows one of the field's own",
    run: ({ spec, page }) => {
      const allowed = new Set(Object.values(tokensOf(spec)).map(rgb));
      const own = Object.fromEntries(Object.entries(fieldTokensOf(spec)).map(([id, tokens]) => [`region ${id}`, new Set(Object.values(tokens).map(rgb))]));
      const bad = [...page.texts, ...page.boxes].filter((t) => !allowed.has(t.color) && !own[t.where]?.has(t.color));
      return [...new Set(bad.map((t) => `${t.where} uses ${t.color}, not a ${spec.theme} token`))];
    },
  },
  {
    id: "hot-tagged", level: "fail", stage: "page", about: "the accent colour is used only where data-hot marks it",
    run: ({ spec, page }) => {
      const hot = rgb(tokensOf(spec).hot);
      const bad = [...page.texts, ...page.boxes].filter((t) => t.color === hot && !t.hot);
      return [...new Set(bad.map((t) => `${t.where} is in the accent colour without data-hot`))];
    },
  },
  {
    id: "copy", level: "fail", stage: "page", about: "no jargon, file paths or AI tells in the visible words",
    run: ({ page }) => {
      const texts = [
        ...page.blocks.filter((b) => b.owner !== "render" && b.role !== "masthead").map((b) => [b.name, b.text]),
        ...page.rows.map((r) => [`region ${r.region}`, r.word]),
        ...page.dots.map((d) => [`region ${d.region}`, d.word]),
      ];
      return [...new Set(texts.flatMap(([name, text]) => textProblems(text).map((p) => `${name}: ${p}`)))];
    },
  },
  {
    id: "notes", level: "fail", stage: "page", about: "swiss: the footer shows the spec's notes; loose: 0 to 2 paragraphs and exactly one legend",
    run: ({ spec, page }) => {
      const n = (pred) => page.blocks.filter(pred).length;
      if (frameOf(spec) === "swiss") {
        const shown = n((b) => b.name === "note");
        return shown === spec.notes.length ? [] : [`the footer shows ${shown} notes; the spec has ${spec.notes.length}`];
      }
      const [lo, hi] = ROLES.loose.paragraph.count;
      const paragraphs = n((b) => b.role === "paragraph");
      const legends = n((b) => b.role === "legend");
      return paragraphs >= lo && paragraphs <= hi && legends === 1 ? [] : [`the poster shows ${paragraphs} paragraphs and ${legends} legends; use ${lo} to ${hi} paragraphs and exactly one legend`];
    },
  },
  {
    id: "band", level: "fail", stage: "page", frames: ["swiss"], about: "the footer counts match facts.json",
    run: ({ facts, page }) => {
      const want = bandLine(bandCounts(facts));
      const got = page.blocks.find((b) => b.name === "counts")?.text ?? "";
      return got === want ? [] : [`the footer counts read "${got}" but facts.json gives "${want}"`];
    },
  },
  {
    id: "record", level: "fail", stage: "page", frames: ["loose"], about: "the record line is drawn once, with the commit and the date",
    run: ({ spec, page }) => {
      const lines = page.blocks.filter((b) => b.name === "record");
      if (lines.length !== 1) return [`the poster shows ${lines.length} record lines; it needs exactly one`];
      if (!spec.product.commit) return ["the record line has no commit; set product.commit to the short hash (vyo compose --repo fills it)"];
      const want = `${recordText(spec.product)}.`;
      return lines[0].text === want ? [] : [`the record line reads "${lines[0].text}"; it should read "${want}"`];
    },
  },
  {
    id: "headline-lines", level: "warn", stage: "page", frames: ["swiss"], about: "the headline fits in two lines",
    run: ({ page }) => {
      const h = page.blocks.find((b) => b.role === "headline");
      return h && h.lines > 2 ? [`the headline runs to ${h.lines} lines; two read best`] : [];
    },
  },
];

/** Run one stage of the table. Returns `{ id, level, message }` for every finding. */
export function runChecks(stage, input) {
  const found = [];
  const frame = frameOf(input.spec);
  for (const c of CHECKS.filter((x) => x.stage === stage && (!x.frames || x.frames.includes(frame)))) {
    found.push(...c.run(input).map((message) => ({ id: c.id, level: c.level, message })));
    if (c.id === "spec" && found.length) break;
  }
  return found;
}
