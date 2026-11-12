// Ready silhouettes, by name: `shape: { like: "<name>" }` paints these ops into the same mask a drawn shape uses.
// Each is a few ops in a 100-unit box that inflate well as a relief; `solid` is the cover's solid for it when the
// spec gives none. Pure, with no imports: the page inlines it before mask.mjs.

// noun: the object's name in a legend. suits: the kind of product it stands for, in a few words. words: word
// starts that point to it in a README, by which compose picks a default.
/** @type {Record<string, { noun: string, suits: string, words: string[], about: string, ops: object[], solid?: object, turn?: object }>} */
export const SILHOUETTES = {
  stopwatch: {
    noun: "stopwatch",
    suits: "timers, schedulers, benchmarks: anything about time or speed",
    words: ["time", "timer", "speed", "schedul", "benchmark", "clock", "cron", "deadline", "interval", "measur"],
    about: "time, speed, a race: a round case, its crown and side button, one hand",
    ops: [
      { add: "circle", at: [50, 60], r: 38 },
      { add: "rect", at: [45, 13], size: [10, 10] },
      { add: "rect", at: [38, 3], size: [24, 11], round: 3 },
      { add: "capsule", from: [76, 31], to: [86, 21], r: 4.5 },
      { crease: "capsule", from: [50, 60], to: [50, 33], r: 1 },
    ],
    solid: { bevel: 1, depth: 0.65, groove: 9 },
  },
  flask: {
    noun: "flask",
    suits: "databases, caches, data tools: anything that holds things",
    words: ["data", "store", "storage", "cache", "database", "queue", "persist", "container", "collect", "table"],
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
    noun: "paper plane",
    suits: "HTTP clients, mail, uploads: anything that sends",
    words: ["send", "request", "http", "client", "deliver", "mail", "upload", "fetch", "transfer", "post"],
    about: "a hand-off, sending, travel: a paper plane, a lit wing over a dim keel",
    ops: [
      { add: "polygon", points: [[0, 35], [100, 0], [45, 55]], face: "lit" },
      { add: "polygon", points: [[45, 55], [100, 0], [65, 100]], face: "dim" },
    ],
    solid: { bevel: 0.2, depth: 0.5, tilt: 0.45 },
    turn: { yaw: 26, pitch: 14 },
  },
  pear: {
    noun: "pear",
    suits: "recipes, meals, health: anything about food or growing",
    words: ["food", "recipe", "kitchen", "meal", "cook", "health", "grow", "garden", "diet", "fruit"],
    about: "food, a kitchen, something that ripens: a pear with a stem and a leaf",
    ops: [
      { add: "ellipse", at: [50, 67], r: [33, 31] },
      { add: "ellipse", at: [50, 35], r: [17, 20] },
      { add: "polygon", points: [[34, 36], [66, 36], [80, 58], [20, 58]], round: 4 },
      { add: "capsule", from: [50, 17], to: [54, 4], r: 2.4 },
      { add: "ellipse", at: [62, 11], r: [11, 5], rotate: -28 },
    ],
    solid: { bevel: 1, depth: 0.9 },
  },
  key: {
    noun: "key",
    suits: "sign-in, passwords, permissions: anything about access",
    words: ["auth", "login", "sign", "password", "secur", "token", "encrypt", "access", "permission", "secret"],
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
    noun: "bell",
    suits: "notifications, events, webhooks: anything that alerts",
    words: ["notif", "alert", "event", "webhook", "push", "subscri", "alarm", "remind", "emit", "listen"],
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
    noun: "mug",
    suits: "journals, chat, routines: anything used every day",
    words: ["daily", "habit", "journal", "chat", "routine", "note", "diary", "coffee", "personal", "today"],
    about: "a daily habit, a break, something served: a mug with a handle",
    ops: [
      { add: "rect", at: [10, 14], size: [62, 76], round: 10 },
      { add: "arc", at: [72, 50], r: 18, from: 10, to: 170, width: 11 },
      { crease: "rect", at: [10, 14], size: [62, 9], round: 4 },
    ],
    solid: { bevel: 1, depth: 0.8, groove: 10 },
  },
  bolt: {
    noun: "lightning bolt",
    suits: "runtimes, build tools, engines: anything about power",
    words: ["fast", "quick", "power", "energy", "lightweight", "runtime", "engine", "compile", "bundle", "instant"],
    about: "power, speed, energy: a lightning bolt",
    ops: [{ add: "polygon", points: [[60, 0], [16, 58], [46, 58], [34, 100], [86, 38], [56, 38], [72, 0]], round: 2 }],
    solid: { bevel: 0.7, depth: 0.8 },
  },
  lighthouse: {
    noun: "lighthouse",
    suits: "monitoring, search, linting: anything that watches or guides",
    words: ["guide", "monitor", "watch", "observ", "search", "find", "lint", "check", "safe", "warn"],
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
    noun: "kite",
    suits: "frameworks, starters, games: anything that lifts a project off the ground",
    words: ["framework", "minimal", "starter", "scaffold", "play", "game", "launch", "unopinionated", "flexible", "build"],
    about: "lift, play, something that rises on its own: a kite with a lit and a dim half and a short tail",
    ops: [
      { add: "polygon", points: [[50, 0], [50, 90], [10, 38]], face: "lit" },
      { add: "polygon", points: [[50, 0], [90, 38], [50, 90]], face: "dim" },
      { add: "capsule", from: [50, 88], to: [45, 98], r: 3.5 },
    ],
    solid: { bevel: 0.3, depth: 0.55, tilt: 0.4 },
  },
  bulb: {
    noun: "light bulb",
    suits: "AI, analysis, teaching: anything about ideas",
    words: ["idea", "learn", "insight", "ai", "analy", "understand", "explain", "model", "smart", "teach"],
    about: "an idea, insight, something that lights up: a light bulb with its neck and screw base",
    ops: [
      { add: "circle", at: [50, 38], r: 36 },
      { add: "polygon", points: [[28, 58], [72, 58], [64, 80], [36, 80]], round: 4 },
      { add: "rect", at: [35, 78], size: [30, 16], round: 3 },
      { add: "rect", at: [41, 92], size: [18, 7], round: 3 },
      { crease: "rect", at: [35, 84], size: [30, 4] },
    ],
    solid: { bevel: 1, depth: 0.9, groove: 8 },
  },
  lantern: {
    noun: "lantern",
    suits: "servers, gateways, proxies: anything that serves",
    words: ["server", "serve", "host", "proxy", "gateway", "route", "middleware", "api", "listen", "port"],
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
