// Exploration E (e-vyo-own): 4 Original Vyo Palettes + 4 Bespoke Agent-Drawn 3-Layer SVG Scenes
// Each scene is a clean 840x1190 3-layer graphic visual explanation (atmosphere, structure, core)
// paired with anchored plain-language micro-callouts placed directly on the parts they explain.

export const PALETTES = {
  // Poster 01 (vyo): Obsidian Ink + Glacier Slate + Electric Japanese Vermilion
  sumi: {
    name: "sumi",
    isDark: true,
    ground: "#0B0C10",
    ink: "#EEF3FA",
    mutedInk: "#8392AA",
    atmoLow: "#263147",
    atmoHigh: "#4E648D",
    structLow: "#537299",
    structMid: "#82A8D0",
    structHigh: "#CBE0F5",
    coreDeep: "#B92820",
    coreBright: "#EB3E30",
    specular: "#F5FAFF",
    calloutCore: "#FFFFFF",
    calloutPart: "#E3EEF9",
    calloutWhisper: "#9EB0C9",
    calloutTick: "#8FB2D6",
  },

  // Poster 02 (Flask): Warm Archival Paper + Mineral Indigo + Vermilion
  washi: {
    name: "washi",
    isDark: false,
    ground: "#F4F1EA",
    ink: "#161B22",
    mutedInk: "#6F7782",
    atmoLow: "#D3D8DF",
    atmoHigh: "#B0BECB",
    structLow: "#5A7D9B",
    structMid: "#2F5373",
    structHigh: "#1B364F",
    coreDeep: "#B5251B",
    coreBright: "#D83326",
    specular: null,
    calloutCore: "#11151B",
    calloutPart: "#1B2430",
    calloutWhisper: "#596574",
    calloutTick: "#2F5373",
  },

  // Poster 03 (Pantry): Archival Chalk + Mist Slate + Charcoal Ink + Electric Klein Cobalt
  cobalt: {
    name: "cobalt",
    isDark: false,
    ground: "#EFECE6",
    ink: "#16191F",
    mutedInk: "#6D7480",
    atmoLow: "#CFD6DF",
    atmoHigh: "#B2BDCC",
    structLow: "#60718A",
    structMid: "#39485E",
    structHigh: "#222B3B",
    coreDeep: "#143BD9",
    coreBright: "#1B4DFF",
    specular: null,
    calloutCore: "#0F172A",
    calloutPart: "#1E2633",
    calloutWhisper: "#5B6575",
    calloutTick: "#39485E",
  },

  // Poster 04 (Hypher): Deep Night-Forest + Celadon Mist + Glacier Silver + Molten Amber-Vermilion
  pine: {
    name: "pine",
    isDark: true,
    ground: "#0B1311",
    ink: "#EBF4F0",
    mutedInk: "#7B9890",
    atmoLow: "#1F3B35",
    atmoHigh: "#467369",
    structLow: "#53867A",
    structMid: "#88BAAD",
    structHigh: "#CFE9E1",
    coreDeep: "#C93D1D",
    coreBright: "#F5562E",
    specular: "#FFF5EC",
    calloutCore: "#FFFFFF",
    calloutPart: "#E2F2EC",
    calloutWhisper: "#9AB9B0",
    calloutTick: "#8FC0B3",
  },
};

// ===========================================================================
// SCENE 01 — VYO: Branching Source Streams -> Tilted Vermilion Refraction Prism -> Framed Poster Sheet
// ===========================================================================
export const VYO_SCENE = {
  id: "vyo-own",
  palette: PALETTES.sumi,
  headlineSanctuary: { maxX: 605, maxY: 236, softX: 540, softY: 202 },
  refractOpts: {
    shearScale: 0.94,
    dispScale: 1.05,
    streakScale: 0.90,
    streakMixStruct: 0.24,
    streakMixAtmo: 0.30,
    streakMixCore: 0.16,
    coreShearRatio: 0.56,
  },

  // Layer 1: Branching organic source-file streams flowing in from left & lower-left + atmospheric beam halo
  atmosphereSvg: `
    <defs>
      <linearGradient id="vyoStreamFade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#8A8A8A" stop-opacity="0.58"/>
        <stop offset="55%" stop-color="#E8E8E8" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.35"/>
      </linearGradient>
      <radialGradient id="vyoPrismAura" cx="48%" cy="50%" r="44%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.88"/>
        <stop offset="55%" stop-color="#B0B0B0" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <!-- Soft optical halo radiating around the central refraction lens -->
    <ellipse cx="425" cy="600" rx="250" ry="300" transform="rotate(-18 425 600)" fill="url(#vyoPrismAura)"/>

    <!-- Organic branching source-file streams entering from left edge and lower-left -->
    <g fill="none" stroke="url(#vyoStreamFade)" stroke-linecap="round">
      <path d="M -30 340 C 110 355, 225 430, 385 495" stroke-width="24"/>
      <path d="M -30 435 C 120 445, 235 495, 380 545" stroke-width="34"/>
      <path d="M -30 555 C 125 560, 240 570, 378 595" stroke-width="28"/>
      <path d="M -30 685 C 135 675, 245 645, 388 640" stroke-width="32"/>
      <path d="M -30 825 C 140 805, 250 735, 398 690" stroke-width="30"/>
      <path d="M 35 1150 C 130 980, 235 835, 405 735" stroke-width="36"/>
      <path d="M 165 1155 C 245 1005, 315 875, 420 770" stroke-width="28"/>
      <path d="M 295 1155 C 345 1025, 380 915, 438 805" stroke-width="22"/>
    </g>

    <!-- Quiet upper-right optical scatter cone behind emerging poster -->
    <polygon points="445,420 860,185 860,1135 465,860" fill="#FFFFFF" opacity="0.22"/>
  `,

  // Layer 2: Converging structural code trunks on the left + emerging tilted framed poster sheet on the right
  structureSvg: `
    <defs>
      <linearGradient id="vyoTrunkGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#6A6A6A" stop-opacity="0.42"/>
        <stop offset="55%" stop-color="#D0D0D0" stop-opacity="0.90"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.98"/>
      </linearGradient>
      <linearGradient id="vyoSheetGrad" x1="0" y1="0" x2="1" y2="0.4">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.98"/>
        <stop offset="58%" stop-color="#D2D2D2" stop-opacity="0.92"/>
        <stop offset="100%" stop-color="#8A8A8A" stop-opacity="0.72"/>
      </linearGradient>
      <linearGradient id="vyoBandGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#FAFAFA"/>
        <stop offset="70%" stop-color="#C2C2C2"/>
        <stop offset="100%" stop-color="#787878"/>
      </linearGradient>
    </defs>

    <!-- Stronger structural branches feeding into the left face of the prism -->
    <g fill="none" stroke="url(#vyoTrunkGrad)" stroke-linecap="round">
      <path d="M -15 470 C 125 480, 230 518, 365 556" stroke-width="20"/>
      <path d="M -15 618 C 128 618, 238 612, 365 612" stroke-width="24"/>
      <path d="M -15 765 C 138 742, 245 692, 376 666" stroke-width="22"/>
      <path d="M 105 1145 C 190 975, 268 830, 392 722" stroke-width="22"/>
    </g>

    <!-- Emerging framed poster sheet (slightly cantilevered -5.5deg, bleeding cleanly off right edge!) -->
    <g transform="rotate(-5.5 640 660)">
      <!-- Crisp outer structural poster frame rails -->
      <rect x="498" y="252" width="420" height="845" rx="6" fill="none" stroke="url(#vyoSheetGrad)" stroke-width="26"/>

      <!-- Interior poster header block (quiet editorial bar inside the poster-within-a-poster) -->
      <rect x="546" y="308" width="235" height="24" rx="3" fill="#E8E8E8"/>
      <rect x="546" y="348" width="168" height="16" rx="3" fill="#B5B5B5"/>

      <!-- Rhythmic luminous horizontal bands composing the distilled poster body -->
      <rect x="546" y="408" width="335" height="44" rx="3" fill="url(#vyoBandGrad)"/>
      <rect x="546" y="476" width="335" height="72" rx="3" fill="url(#vyoBandGrad)"/>
      <rect x="546" y="572" width="335" height="36" rx="3" fill="url(#vyoBandGrad)" opacity="0.82"/>
      <rect x="546" y="634" width="335" height="92" rx="3" fill="url(#vyoBandGrad)"/>
      <rect x="546" y="752" width="335" height="58" rx="3" fill="url(#vyoBandGrad)" opacity="0.90"/>
      <rect x="546" y="836" width="335" height="84" rx="3" fill="url(#vyoBandGrad)"/>
      <rect x="546" y="946" width="335" height="46" rx="3" fill="url(#vyoBandGrad)" opacity="0.80"/>
      <rect x="546" y="1014" width="260" height="28" rx="3" fill="#A0A0A0"/>
    </g>
  `,

  // Layer 3: Sculptural tilted vermilion optical lens / refraction prism at the convergence heart
  coreSvg: `
    <defs>
      <linearGradient id="vyoLensBody" x1="0" y1="0" x2="1" y2="0.15">
        <stop offset="0%" stop-color="#888888"/>
        <stop offset="32%" stop-color="#E4E4E4"/>
        <stop offset="50%" stop-color="#FFFFFF"/>
        <stop offset="68%" stop-color="#E0E0E0"/>
        <stop offset="100%" stop-color="#767676"/>
      </linearGradient>
      <linearGradient id="vyoLensSpine" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#B0B0B0"/>
        <stop offset="30%" stop-color="#FFFFFF"/>
        <stop offset="70%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#A0A0A0"/>
      </linearGradient>
      <linearGradient id="vyoEchoBar" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#EAEAEA"/>
        <stop offset="65%" stop-color="#B8B8B8"/>
        <stop offset="100%" stop-color="#606060"/>
      </linearGradient>
    </defs>

    <!-- Bold biconvex tilted optical lens / prism sweeping diagonally across center -->
    <g transform="translate(405 595) rotate(-17)">
      <path d="M 0 -225 C 74 -130, 82 130, 0 225 C -82 130, -74 -130, 0 -225 Z" fill="url(#vyoLensBody)"/>
      <!-- Luminous specular focal axis spine down the lens heart -->
      <path d="M 0 -175 C 24 -95, 26 95, 0 175 C -26 95, -24 -95, 0 -175 Z" fill="url(#vyoLensSpine)"/>
    </g>

    <!-- Distilled vermilion accent focal band echoed inside the emerging poster sheet -->
    <g transform="rotate(-5.5 640 660)">
      <rect x="546" y="654" width="290" height="44" rx="3" fill="url(#vyoEchoBar)"/>
    </g>
  `,

  callouts: [
    { x: 63, y: 392, text: "no network", role: "whisper" },
    { x: 63, y: 511, text: "source tree", role: "part" },
    { x: 63, y: 791, text: "read every file", role: "part" },
    // Anchored cleanly in quiet obsidian air right beside the upper-left tip of the glowing vermilion lens!
    { x: 189, y: 392, text: "drawing engine", role: "core" },
    { x: 553, y: 364, text: "plain words", role: "part", inlaid: true },
    { x: 560, y: 602, text: "framed poster", role: "part", inlaid: true },
    { x: 581, y: 812, text: "check the margin", role: "whisper" },
    { x: 560, y: 980, text: "true scale", role: "whisper" },
    { x: 133, y: 308, text: "scan", role: "whisper" },
    { x: 91, y: 952, text: "every line", role: "whisper" },
    { x: 686, y: 203, text: "calm", role: "whisper" },
    { x: 294, y: 875, text: "grain", role: "whisper" },
  ],
};

// ===========================================================================
// SCENE 02 — FLASK: Single Incoming Conduit -> Vermilion Request Core Aperture -> 6 Fanning Routing Lanes
// ===========================================================================
export const FLASK_SCENE = {
  id: "flask-own",
  palette: PALETTES.washi,
  // Extra generous right margin so "grown only as far as you need." breathes cleanly on warm archival paper!
  headlineSanctuary: { maxX: 692, maxY: 236, softX: 642, softY: 202 },
  refractOpts: {
    shearScale: 0.80,
    dispScale: 0.80,
    streakScale: 0.80,
    streakMixStruct: 0.19,
    streakMixAtmo: 0.24,
    streakMixCore: 0.14,
    coreShearRatio: 0.50,
  },

  // Layer 1: Calm radiating architectural concentric arcs (optional extensions: "grown only as far as you need")
  atmosphereSvg: `
    <g fill="none" stroke-linecap="round">
      <circle cx="304" cy="595" r="228" stroke="#D8D8D8" stroke-width="24"/>
      <circle cx="304" cy="595" r="338" stroke="#C8C8C8" stroke-width="26"/>
      <circle cx="304" cy="595" r="452" stroke="#BDBDBD" stroke-width="28"/>
      <circle cx="304" cy="595" r="566" stroke="#A8A8A8" stroke-width="24"/>
    </g>
    <!-- Soft outer mist shelf on lower-left -->
    <path d="M -20 790 Q 140 830, 250 970 T 330 1150 L -20 1150 Z" fill="#9A9A9A" opacity="0.34"/>
  `,

  // Layer 2: Single bold incoming trunk from left -> 6 sweeping curved indigo routing lanes fanning right & down
  structureSvg: `
    <defs>
      <linearGradient id="flaskTrunk" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#D2D2D2"/>
        <stop offset="55%" stop-color="#F2F2F2"/>
        <stop offset="100%" stop-color="#FFFFFF"/>
      </linearGradient>
      <linearGradient id="flaskFan" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="55%" stop-color="#DCDCDC"/>
        <stop offset="100%" stop-color="#9A9A9A"/>
      </linearGradient>
    </defs>

    <!-- Single bold incoming request conduit sweeping confidently from left edge into the request core -->
    <path d="M -25 576 C 65 576, 138 595, 224 595" fill="none" stroke="url(#flaskTrunk)" stroke-width="58" stroke-linecap="butt"/>

    <!-- Six bold curved routing lanes fanning outward from the vermilion request core -->
    <g fill="none" stroke="url(#flaskFan)" stroke-linecap="round">
      <!-- Lane 1: High arc curving around headline sanctuary and bleeding off upper-right -->
      <path d="M 358 538 C 460 405, 615 268, 865 212" stroke-width="36"/>
      <!-- Lane 2: Upper-mid routing lane -->
      <path d="M 378 564 C 505 478, 660 408, 865 376" stroke-width="38"/>
      <!-- Lane 3: Center-upper page rendering lane -->
      <path d="M 388 590 C 530 562, 680 546, 865 538" stroke-width="38"/>
      <!-- Lane 4: Center-lower session lane -->
      <path d="M 384 620 C 525 654, 675 688, 865 706" stroke-width="38"/>
      <!-- Lane 5: Lower-right clean replies lane -->
      <path d="M 366 648 C 495 752, 650 835, 865 894" stroke-width="36"/>
      <!-- Lane 6: Deep lower arc sweeping gracefully down to the bottom hairline -->
      <path d="M 336 672 C 425 815, 525 975, 668 1150" stroke-width="34"/>
    </g>
  `,

  // Layer 3: Sculptural vermilion aperture / focal junction ring + inner pupil core
  coreSvg: `
    <defs>
      <radialGradient id="flaskRingGrad" cx="44%" cy="42%" r="58%">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="68%" stop-color="#E2E2E2"/>
        <stop offset="100%" stop-color="#9A9A9A"/>
      </radialGradient>
    </defs>

    <!-- Bold outer vermilion aperture ring with warm archival paper breathing inside -->
    <circle cx="304" cy="595" r="82" fill="none" stroke="url(#flaskRingGrad)" stroke-width="36"/>
    <!-- Inner focal core pupil -->
    <circle cx="304" cy="595" r="24" fill="#FFFFFF"/>
  `,

  callouts: [
    { x: 56, y: 518, text: "incoming request", role: "part" },
    { x: 238, y: 721, text: "request core", role: "core" },
    // Cleanly nestled in open warm-paper channels right beside each routing lane!
    { x: 483, y: 315, text: "route a path", role: "part" },
    { x: 616, y: 476, text: "render a page", role: "part" },
    { x: 623, y: 637, text: "session cookie", role: "part" },
    { x: 609, y: 777, text: "clean replies", role: "part" },
    { x: 427, y: 973, text: "command line", role: "part" },
    { x: 560, y: 252, text: "optional pieces", role: "whisper" },
    { x: 84, y: 903, text: "grow on demand", role: "whisper" },
    { x: 91, y: 399, text: "thin layer", role: "whisper" },
    { x: 707, y: 1022, text: "open", role: "whisper" },
  ],
};

// ===========================================================================
// SCENE 03 — PANTRY: Drifting Recipe Arcs -> 7 Calm Day-Pillars -> Electric Klein Cobalt Weekly Wave
// ===========================================================================
export const PANTRY_SCENE = {
  id: "pantry-own",
  palette: PALETTES.cobalt,
  headlineSanctuary: { maxX: 525, maxY: 236, softX: 465, softY: 200 },
  refractOpts: {
    shearScale: 0.48, // architectural calm so the 7 vertical day-pillars stand tall & rhythmic!
    dispScale: 0.70,
    streakScale: 0.72,
    streakMixStruct: 0.16,
    streakMixAtmo: 0.26,
    streakMixCore: 0.16,
    coreShearRatio: 0.54,
  },

  // Layer 1: Graceful saved recipe arcs drifting down from upper-right toward the 7 pillars
  atmosphereSvg: `
    <defs>
      <linearGradient id="pantryArcFade" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#E6E6E6" stop-opacity="0.95"/>
        <stop offset="65%" stop-color="#C8C8C8" stop-opacity="0.72"/>
        <stop offset="100%" stop-color="#9A9A9A" stop-opacity="0.20"/>
      </linearGradient>
    </defs>

    <!-- Drifting curved recipe ribbons floating down from upper-right across the week -->
    <g fill="none" stroke="url(#pantryArcFade)" stroke-linecap="round">
      <path d="M 860 112 C 690 120, 560 185, 428 335" stroke-width="26"/>
      <path d="M 865 178 C 660 198, 480 265, 315 365" stroke-width="30"/>
      <path d="M 865 248 C 630 278, 390 330, 195 415" stroke-width="24"/>
      <path d="M 865 312 C 740 328, 635 352, 540 375" stroke-width="22"/>
      <path d="M 735 88 C 655 155, 622 225, 638 295" stroke-width="20"/>
    </g>

    <!-- Soft atmospheric horizontal table-ripple bands behind the lower pillars -->
    <rect x="0" y="795" width="840" height="44" fill="#B8B8B8" opacity="0.34"/>
    <rect x="0" y="965" width="840" height="58" fill="#B0B0B0" opacity="0.28"/>
  `,

  // Layer 2: Seven calm architectural vertical day-pillars standing across the lower two-thirds
  structureSvg: `
    <defs>
      <linearGradient id="pantryPillarGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="48%" stop-color="#D4D4D4"/>
        <stop offset="100%" stop-color="#8C8C8C"/>
      </linearGradient>
    </defs>

    <!-- 7 rhythmic vertical day-pillars: width 76px, clean 32px chalk gaps (x = 58..782) -->
    <!-- Mon -->
    <rect x="58" y="518" width="76" height="632" rx="4" fill="url(#pantryPillarGrad)"/>
    <!-- Tue -->
    <rect x="166" y="440" width="76" height="710" rx="4" fill="url(#pantryPillarGrad)"/>
    <!-- Wed -->
    <rect x="274" y="392" width="76" height="758" rx="4" fill="url(#pantryPillarGrad)"/>
    <!-- Thu -->
    <rect x="382" y="468" width="76" height="682" rx="4" fill="url(#pantryPillarGrad)"/>
    <!-- Fri -->
    <rect x="490" y="350" width="76" height="800" rx="4" fill="url(#pantryPillarGrad)"/>
    <!-- Sat -->
    <rect x="598" y="308" width="76" height="842" rx="4" fill="url(#pantryPillarGrad)"/>
    <!-- Sun -->
    <rect x="706" y="412" width="76" height="738" rx="4" fill="url(#pantryPillarGrad)"/>

    <!-- Subtle recessed meal-card horizontal notches carved cleanly into pillars -->
    <g fill="#000000" opacity="0.62">
      <rect x="58" y="838" width="76" height="14"/>
      <rect x="166" y="560" width="76" height="14"/>
      <rect x="166" y="892" width="76" height="14"/>
      <rect x="274" y="520" width="76" height="14"/>
      <rect x="274" y="858" width="76" height="14"/>
      <rect x="382" y="920" width="76" height="14"/>
      <rect x="490" y="492" width="76" height="14"/>
      <rect x="490" y="878" width="76" height="14"/>
      <rect x="598" y="454" width="76" height="14"/>
      <rect x="598" y="844" width="76" height="14"/>
      <rect x="706" y="544" width="76" height="14"/>
      <rect x="706" y="906" width="76" height="14"/>
    </g>
  `,

  // Layer 3: Bold, luminous electric Klein cobalt horizontal unifying wave sweeping across all 7 pillars!
  coreSvg: `
    <defs>
      <linearGradient id="pantryWaveGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#D4D4D4"/>
        <stop offset="25%" stop-color="#FFFFFF"/>
        <stop offset="60%" stop-color="#FAFAFA"/>
        <stop offset="100%" stop-color="#CFCFCF"/>
      </linearGradient>
    </defs>

    <!-- Primary sweeping weekly planning wave tying all 7 days into one cohesive plan -->
    <path d="M -25 680 C 125 628, 255 724, 415 676 C 575 628, 705 706, 865 654
             L 865 748 C 705 796, 575 722, 415 768 C 255 814, 125 722, -25 772 Z"
          fill="url(#pantryWaveGrad)"/>

    <!-- Delicate upper cobalt recipe-selection ribbon curving smoothly down into Sat/Sun crown -->
    <path d="M 865 210 C 765 225, 680 250, 636 312"
          fill="none" stroke="#EAEAEA" stroke-width="20" stroke-linecap="round"/>
  `,

  callouts: [
    { x: 546, y: 147, text: "saved recipes", role: "part" },
    { x: 672, y: 196, text: "suggestions", role: "whisper" },
    // Clean day labels perched right above each of the 7 pillars!
    { x: 96, y: 497, text: "mon", role: "whisper", align: "center" },
    { x: 204, y: 420, text: "tue", role: "whisper", align: "center" },
    { x: 312, y: 371, text: "wed", role: "whisper", align: "center" },
    { x: 420, y: 448, text: "thu", role: "whisper", align: "center" },
    { x: 528, y: 329, text: "fri", role: "whisper", align: "center" },
    { x: 636, y: 273, text: "sat", role: "whisper", align: "center" },
    { x: 744, y: 392, text: "sun", role: "whisper", align: "center" },
    // Crisp inlaid Swiss caption windows inside the dense cobalt wave & charcoal pillars
    { x: 287, y: 721, text: "the weekly plan", role: "core", inlaid: true },
    { x: 161, y: 945, text: "meal cards", role: "part", inlaid: true },
    { x: 511, y: 994, text: "shopping list", role: "part", inlaid: true },
    { x: 63, y: 371, text: "one week", role: "whisper" },
  ],
};

// ===========================================================================
// SCENE 04 — HYPHER: Two Separated Opposing Crescent Waves + Dark Diagonal Chasm + Glowing Amber Handoff Bridge
// ===========================================================================
export const HYPHER_SCENE = {
  id: "hypher-own",
  palette: PALETTES.pine,
  headlineSanctuary: { maxX: 590, maxY: 238, softX: 525, softY: 202 },
  refractOpts: {
    shearScale: 0.90,
    dispScale: 1.04,
    streakScale: 0.88,
    streakMixStruct: 0.22,
    streakMixAtmo: 0.28,
    streakMixCore: 0.16,
    coreShearRatio: 0.56,
  },

  // Layer 1: Wide orbital context echo rings & shared memory aura sweeping behind both workspaces
  atmosphereSvg: `
    <g fill="none" stroke-linecap="round">
      <circle cx="420" cy="630" r="245" stroke="#C8C8C8" stroke-width="22" opacity="0.72"/>
      <circle cx="420" cy="630" r="365" stroke="#B4B4B4" stroke-width="24" opacity="0.62"/>
      <circle cx="420" cy="630" r="485" stroke="#9C9C9C" stroke-width="22" opacity="0.48"/>
    </g>
    <!-- Soft lower-left workspace mist echo -->
    <path d="M -25 890 C 90 910, 195 975, 285 1150 L -25 1150 Z" fill="#8C8C8C" opacity="0.34"/>
  `,

  // Layer 2: Two dramatic opposing architectural crescent waves separated by a deep dark diagonal chasm!
  structureSvg: `
    <defs>
      <!-- Bright glacier-silver rim facing the dark chasm, receding deeper celadon toward outer edge -->
      <linearGradient id="hypherLeftWave" x1="0" y1="0.4" x2="1" y2="0.2">
        <stop offset="0%" stop-color="#585858"/>
        <stop offset="55%" stop-color="#B8B8B8"/>
        <stop offset="92%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#E6E6E6"/>
      </linearGradient>
      <linearGradient id="hypherRightWave" x1="0" y1="0.3" x2="1" y2="0.5">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="22%" stop-color="#DFDFDF"/>
        <stop offset="68%" stop-color="#A6A6A6"/>
        <stop offset="100%" stop-color="#606060"/>
      </linearGradient>
    </defs>

    <!-- LEFT CRESCENT WAVE (First Agent): sweeps boldly down from upper-left and halts sharply at the diagonal chasm -->
    <path d="M -30 412
             C 95 400, 255 436, 366 518
             C 340 650, 315 805, 290 975
             C 280 1045, 272 1100, 266 1150
             L -30 1150 Z"
          fill="url(#hypherLeftWave)"/>
    <!-- Sculptural recessed architectural contour channels inside Left Wave -->
    <path d="M -20 672 C 95 654, 195 664, 275 692" fill="none" stroke="#000000" stroke-width="24" opacity="0.82"/>
    <path d="M -20 848 C 88 832, 178 842, 254 872" fill="none" stroke="#000000" stroke-width="20" opacity="0.78"/>

    <!-- RIGHT CRESCENT WAVE (Next Agent): rises cleanly across the dark chasm and bleeds off right & bottom -->
    <path d="M 865 258
             C 715 310, 565 408, 492 532
             C 456 668, 434 832, 412 1010
             C 404 1068, 398 1112, 394 1150
             L 865 1150 Z"
          fill="url(#hypherRightWave)"/>
    <!-- Sculptural recessed contour channels inside Right Wave -->
    <path d="M 538 712 C 635 678, 745 660, 865 656" fill="none" stroke="#000000" stroke-width="24" opacity="0.82"/>
    <path d="M 500 896 C 612 858, 730 838, 865 836" fill="none" stroke="#000000" stroke-width="20" opacity="0.78"/>
  `,

  // Layer 3: Glowing molten amber-vermilion folded ribbon / baton bridge spanning right across the dark chasm!
  coreSvg: `
    <defs>
      <linearGradient id="hypherBridge" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#888888"/>
        <stop offset="22%" stop-color="#E4E4E4"/>
        <stop offset="50%" stop-color="#FFFFFF"/>
        <stop offset="78%" stop-color="#E4E4E4"/>
        <stop offset="100%" stop-color="#888888"/>
      </linearGradient>
      <linearGradient id="hypherFoldCrest" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#A8A8A8"/>
        <stop offset="30%" stop-color="#FFFFFF"/>
        <stop offset="70%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#A8A8A8"/>
      </linearGradient>
    </defs>

    <!-- Folded baton bridge angled cleanly across the dark chasm from First Agent into Next Agent -->
    <g transform="translate(424 606) rotate(-13)">
      <!-- Lower ribbon wing -->
      <path d="M -215 -14 L 195 -36 L 222 10 L -188 32 Z" fill="url(#hypherBridge)"/>
      <!-- Upper folded ribbon wing creating sculptural baton facet -->
      <path d="M -205 -46 L 205 -64 L 195 -16 L -215 2 Z" fill="url(#hypherBridge)" opacity="0.88"/>
      <!-- Blazing specular fold crest down the exact center of the handoff bridge -->
      <rect x="-175" y="-26" width="350" height="22" rx="6" fill="url(#hypherFoldCrest)"/>
    </g>
  `,

  callouts: [
    { x: 77, y: 364, text: "capture context", role: "part" },
    { x: 63, y: 742, text: "first agent", role: "part", inlaid: true },
    { x: 63, y: 952, text: "editor & browser", role: "whisper", inlaid: true },
    { x: 350, y: 504, text: "handoff note", role: "core" },
    { x: 525, y: 315, text: "shared memory", role: "whisper" },
    { x: 574, y: 742, text: "next agent", role: "part", inlaid: true },
    { x: 553, y: 924, text: "pick up cleanly", role: "part", inlaid: true },
    { x: 350, y: 805, text: "relay", role: "whisper" },
    { x: 693, y: 203, text: "state", role: "whisper" },
    { x: 329, y: 1029, text: "carry", role: "whisper" },
  ],
};

export const SCENES_BY_ID = {
  "vyo-own": VYO_SCENE,
  "flask-own": FLASK_SCENE,
  "pantry-own": PANTRY_SCENE,
  "hypher-own": HYPHER_SCENE,
};
