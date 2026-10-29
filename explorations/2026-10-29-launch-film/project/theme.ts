import { defineTheme } from "continuity";

// Vyo's accent: the orange full stop of its wordmark. Used the litt way, as light and as the
// one fill (the wordmark's dot); never as a word's colour. The hex values are the documented
// brand override (api.md, "Brand accent"), so each line carries a litt-allow.
export default defineTheme("litt-dark", {
  colors: {
    accent: "#ff5a1f", // litt-allow: litt-hex (brand accent override)
    "accent-fg": "#1b0e07", // litt-allow: litt-hex (dark ink on the orange: 4.5:1)
    "accent-text": "#ff7a45", // litt-allow: litt-hex (brand accent override)
    "accent-tint": "#3a1a0e", // litt-allow: litt-hex (brand accent override)
    focus: "#ff7a45", // litt-allow: litt-hex (brand accent override)
  },
});
