// The wave field: rows of part names, as many per part as its share of lines, bent into one band that enters
// at the top behind the masthead, swings across and leaves through the floor. Pure: render inlines it,
// `vyo sketch` imports it.
import { clearOf } from "../geometry.mjs";

// f-wave-paper's numbers: 6.9px letters on 7.9px rows from the top edge to the floor, about 110 rows above
// a 900px floor. That density is what reads as a band at a sixth of the size.
export const WAVE = { size: 6.9, pitch: 7.9, every: 5 };
// Per theme: the field's own colour tokens, its two tints by depth (parts near the top of the tree first),
// and the tone of the accent part. On paper the band takes f-wave-paper's violets and the accent part is ink;
// on navy it takes a-wave's dim greys, so the orange accent carries.
export const WAVE_TONES = {
  light: { tokens: { wave: "#7A64DC", "wave-soft": "#907EDD" }, tints: ["wave", "wave-soft"], hot: "ink" },
  dark: { tokens: {}, tints: ["mid", "soft"], hot: "hot" },
};

/** A part's tint on this theme. */
export const depthTone = (id, theme = "light") => WAVE_TONES[theme].tints[id === "area:." || id.split("/").length <= 2 ? 0 : 1];

/** `word` and three spaces, repeated letter by letter from the left, as many letters as fit in `room` at this spacing. */
export function repeatTo(word, room, cw, spacing) {
  const cycle = `${word}   `;
  const n = Math.floor((room + spacing) / (cw + spacing));
  const text = Array.from({ length: Math.max(0, n) }, (_, i) => cycle[i % cycle.length]).join("").trimEnd();
  return { text, width: text.length ? text.length * cw + (text.length - 1) * spacing : 0 };
}

/** `n` rows shared out by lines, largest remainder first, at least one per part. */
export function rowsPerPart(parts, n) {
  const total = parts.reduce((s, p) => s + p.loc, 0) || 1;
  const room = Math.max(0, n - parts.length);
  const want = parts.map((p) => (p.loc / total) * room);
  const got = want.map(Math.floor);
  const order = want.map((w, i) => [w - got[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const left = room - got.reduce((s, g) => s + g, 0);
  for (let k = 0; k < left; k++) got[order[k][1]]++;
  return got.map((g) => g + 1);
}

/** The band's centre and half-width at height y on a sheet this tall: f-wave-paper's path, a smoothstep diagonal plus a damped sine. */
export function wavePath(y, height) {
  const u = Math.min(1, Math.max(0, (y + 14) / height));
  const centre = 130 + 560 * (u * u * (3 - 2 * u) * 0.6 + u * 0.4) + 95 * Math.sin(6.4 * u + 0.4) * (1 - 0.5 * u);
  return { centre, half: 150 + 40 * Math.abs(Math.cos(6.4 * u + 0.4)) };
}

/**
 * The rows of a wave region, top to bottom from the sheet's top edge to the floor. The band runs on behind the
 * text blocks, as in f-wave-paper: render gives each block a paper halo, so no row is cut around them.
 * @param {{ sentence?: string, every?: number }} region
 * @param {{ id: string, name: string, loc: number, hot: boolean }[]} parts  in tree order
 * @param {{ sheet: { width: number, height: number }, floor: number, mirror: boolean, theme?: "light" | "dark", measure: (text: string, size: number) => number }} frame
 */
export function waveRows(region, parts, { sheet, floor, mirror, theme = "light", measure }) {
  const { size, pitch } = WAVE;
  const every = region.every ?? WAVE.every;
  const slots = Array.from({ length: Math.floor(floor / pitch) }, (_, i) => {
    const y = Math.round(i * pitch * 10) / 10;
    const { centre: cx, half } = wavePath(y, sheet.height);
    const centre = mirror ? sheet.width - cx : cx;
    return { y, half, runs: clearOf([[Math.max(0, centre - half), Math.min(sheet.width - 2, centre + half)]], y, pitch, []) };
  });
  const counts = rowsPerPart(parts, slots.length);
  // Fewer rows than parts: the last parts go undrawn, and the field-parts check names them.
  const rows = parts.flatMap((p, i) => Array(counts[i]).fill(p)).slice(0, slots.length);
  // Rounded to 0.05px so the page's measured advance (4.134 at 6.9px) and the sketch's fixed 4.14 agree.
  const cw = Math.round(measure("M", size) * 20) / 20;
  const out = [];
  rows.forEach((p, i) => {
    const { y, half, runs } = slots[i];
    // The letters open up where the band widens on a turn.
    const spacing = 0.5 + (half - 150) / 12;
    const said = region.sentence && i % every === every - 1;
    const word = (said ? region.sentence : p.name).toLowerCase();
    const tone = p.hot ? WAVE_TONES[theme].hot : depthTone(p.id, theme);
    for (const [l, r] of runs) {
      const { text, width } = repeatTo(word, r - l, cw, spacing);
      if (text) out.push({ x: l, y, width, height: pitch, size, text, spacing, part: p.id, word: said ? region.sentence : p.name, hot: p.hot, tone });
    }
  });
  return out;
}
