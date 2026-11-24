// Plate registry for vyo v2 pure vector visual plates: topographic elevation contours and architectural PCB / circuit
// schematics. Pure deterministic ES module, zero external dependencies.
import { buildTopoPlate } from "./topo.mjs";
import { buildBlueprintPlate } from "./blueprint.mjs";

export const PLATE_NAMES = ["topo", "blueprint"];

export const PLATES = {
  topo: {
    about: "marching-squares topographic elevation map, contours rising around each area's lines and import passes",
    motion: "pulse",
    measure: [
      ["code", "lines", "elevation", "height"],
      ["contour", "map", "ridge", "peak", "hill"],
    ],
    legend(product, accent, colorName = "orange") {
      const base = `Elevation maps the lines of ${product}'s code, contours rising around each area's peaks and import passes.`;
      return accent ? `${base} The ${colorName} contours are ${accent}.` : base;
    },
    build: buildTopoPlate,
  },
  blueprint: {
    about: "architectural circuit schematic: proportional part chambers linked by chamfered traces along real imports",
    motion: "signal",
    measure: [
      ["code", "lines", "part", "chamber", "size"],
      ["import", "trace", "circuit", "connect", "link", "bus"],
    ],
    legend(product, accent, colorName = "orange") {
      const base = `Each chamber is a part of ${product}'s code sized by lines, linked by traces along real imports.`;
      return accent ? `${base} The ${colorName} circuits are ${accent}.` : base;
    },
    build: buildBlueprintPlate,
  },
};
