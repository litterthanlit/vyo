// Ready silhouettes, by name: `shape: { like: "<name>" }` paints these ops into the same mask a drawn shape uses.
// Each is a few ops in a 100-unit box that inflate well as a relief; `solid` is the cover's solid for it when the
// spec gives none. Pure, with no imports: the page inlines it before mask.mjs.

/** @type {Record<string, { about: string, ops: object[], solid?: object, turn?: object }>} */
export const SILHOUETTES = {
  stopwatch: {
    about: "time, speed, a race: a round case, its crown and side button, one hand",
    ops: [
      { add: "circle", at: [50, 60], r: 38 },
      { add: "rect", at: [45, 13], size: [10, 10] },
      { add: "rect", at: [38, 3], size: [24, 11], round: 3 },
      { add: "capsule", from: [79, 28], to: [86, 21], r: 4.5 },
      { crease: "capsule", from: [50, 60], to: [50, 33], r: 1 },
    ],
    solid: { bevel: 1, depth: 0.65, groove: 9 },
  },
  flask: {
    about: "a small thing that holds a lot, something poured: a round-bellied flask with a cap and a label",
    ops: [
      { add: "rect", at: [4, 34], size: [92, 60], round: 24 },
      { add: "polygon", points: [[20, 38], [80, 38], [64, 28], [36, 28]], round: 6 },
      { add: "rect", at: [42, 16], size: [16, 14] },
      { add: "rect", at: [37, 4], size: [26, 14], round: 3 },
      { crease: "rect", at: [20, 48], size: [60, 34], round: 10 },
    ],
    solid: { bevel: 1, depth: 1, groove: 12 },
  },
  plane: {
    about: "a hand-off, sending, travel: a paper plane, a lit wing over a dim keel",
    ops: [
      { add: "polygon", points: [[0, 35], [100, 0], [45, 55]], face: "lit" },
      { add: "polygon", points: [[45, 55], [100, 0], [65, 100]], face: "dim" },
    ],
    solid: { bevel: 0.2, depth: 0.5, tilt: 0.45 },
    turn: { yaw: 26, pitch: 14 },
  },
  pear: {
    about: "food, a kitchen, something that ripens: a pear with a stem and a leaf",
    ops: [
      { add: "ellipse", at: [50, 67], r: [33, 31] },
      { add: "ellipse", at: [50, 35], r: [17, 20] },
      { add: "polygon", points: [[34, 36], [66, 36], [80, 58], [20, 58]], round: 4 },
      { add: "capsule", from: [50, 17], to: [54, 4], r: 2.4 },
      { add: "ellipse", at: [65, 10], r: [11, 5], rotate: -28 },
    ],
    solid: { bevel: 1, depth: 0.9 },
  },
  key: {
    about: "access, sign-in, security: a key with a round bow and two teeth",
    ops: [
      { add: "circle", at: [26, 50], r: 24 },
      { cut: "circle", at: [26, 50], r: 10 },
      { add: "rect", at: [44, 42], size: [54, 16], round: 3 },
      { add: "rect", at: [72, 54], size: [10, 16], round: 2 },
      { add: "rect", at: [86, 54], size: [10, 22], round: 2 },
    ],
    solid: { bevel: 1, depth: 0.7 },
  },
  bell: {
    about: "alerts, notices, a call: a bell with its loop, flared skirt and clapper",
    ops: [
      { add: "ellipse", at: [50, 40], r: [27, 30] },
      { add: "polygon", points: [[23, 42], [77, 42], [90, 82], [10, 82]], round: 6 },
      { add: "rect", at: [4, 78], size: [92, 11], round: 5 },
      { add: "circle", at: [50, 92], r: 8 },
      { add: "rect", at: [43, 4], size: [14, 10], round: 4 },
    ],
    solid: { bevel: 1, depth: 0.85 },
  },
  cup: {
    about: "a daily habit, a break, something served: a mug with a handle",
    ops: [
      { add: "rect", at: [10, 14], size: [62, 76], round: 10 },
      { add: "arc", at: [72, 50], r: 18, from: 10, to: 170, width: 11 },
      { crease: "rect", at: [10, 14], size: [62, 9], round: 4 },
    ],
    solid: { bevel: 1, depth: 0.8, groove: 10 },
  },
  bolt: {
    about: "power, speed, energy: a lightning bolt",
    ops: [{ add: "polygon", points: [[60, 0], [16, 58], [46, 58], [34, 100], [86, 38], [56, 38], [72, 0]], round: 2 }],
    solid: { bevel: 0.7, depth: 0.8 },
  },
  lighthouse: {
    about: "guidance, safety, a signal that finds you: a lighthouse tower with its lamp room and roof",
    ops: [
      { add: "polygon", points: [[36, 30], [64, 30], [74, 90], [26, 90]] },
      { add: "rect", at: [32, 24], size: [36, 8], round: 2 },
      { add: "rect", at: [37, 12], size: [26, 14], round: 2 },
      { add: "polygon", points: [[32, 13], [68, 13], [50, 0]], round: 2 },
      { add: "rect", at: [16, 88], size: [68, 12], round: 3 },
      { crease: "rect", at: [30, 52], size: [40, 12] },
    ],
    solid: { bevel: 1, depth: 0.8, groove: 10 },
  },
  kite: {
    about: "lift, play, something that rises on its own: a kite with a lit and a dim half and a short tail",
    ops: [
      { add: "polygon", points: [[50, 0], [50, 100], [12, 40]], face: "lit" },
      { add: "polygon", points: [[50, 0], [88, 40], [50, 100]], face: "dim" },
      { add: "capsule", from: [50, 98], to: [40, 118], r: 3.5 },
    ],
    solid: { bevel: 0.3, depth: 0.55, tilt: 0.4 },
  },
  anchor: {
    about: "stability, holding fast, a harbour: an anchor with its ring, stock and curved arms",
    ops: [
      { add: "circle", at: [50, 9], r: 9 },
      { cut: "circle", at: [50, 9], r: 4 },
      { add: "rect", at: [44, 16], size: [12, 70] },
      { add: "rect", at: [26, 24], size: [48, 10], round: 5 },
      { add: "arc", at: [50, 54], r: 36, from: 100, to: 260, width: 12 },
      { add: "polygon", points: [[80, 70], [96, 50], [96, 74]] },
      { add: "polygon", points: [[20, 70], [4, 50], [4, 74]] },
    ],
    solid: { bevel: 1, depth: 0.7 },
  },
  lantern: {
    about: "light in the dark, a guide, warmth: a lantern with its handle, cap, glass and base",
    ops: [
      { add: "arc", at: [50, 14], r: 13, from: 270, to: 90, width: 6 },
      { add: "polygon", points: [[22, 26], [78, 26], [64, 12], [36, 12]], round: 3 },
      { add: "rect", at: [26, 24], size: [48, 56], round: 8 },
      { add: "rect", at: [20, 78], size: [60, 12], round: 4 },
      { crease: "rect", at: [36, 34], size: [28, 36], round: 8 },
    ],
    solid: { bevel: 1, depth: 0.85, groove: 10 },
  },
};

export const SILHOUETTE_NAMES = Object.keys(SILHOUETTES);

/** A shape's ops: its own, or its ready silhouette's. */
export const shapeOps = (shape) => shape.ops ?? SILHOUETTES[shape.like]?.ops ?? [];
