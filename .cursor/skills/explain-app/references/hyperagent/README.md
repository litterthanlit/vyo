# Hyperagent Public Skills

Source: https://github.com/alexmcdonnell-airtable/hyperagent-public-skills

Bundled references for explain-app Swiss poster design:

- `muller-brockmann-grid-systems.md` — grid engineering and discipline
- `vignelli-canon-design-system.md` — typography, palette, semantics

## Precedence

These are **background reading**, copied verbatim from their source. Where they disagree with the explain-app files, **explain-app wins**:

| Reference says | explain-app rule |
|----------------|------------------|
| Mono face for folios and captions | Grotesque sans only |
| Two sizes, heading ≈ 2× body | Two roles, four sizes (display · numeral · body · folio) |
| Warm paper `#F4F1EA`, vermilion `#F04E23` | White paper `#FFFFFF`, red `#E4002B` |
| Runtime JS optical alignment | Fixed `marginLeft` nudge (canvases can't measure fonts) |

The scripts and tools the references mention (`grid_tokens.py`, `verify_grid.js`, `vignelli_system.py`, `SearchImages`, `PublishFilePublicly`, GPT Image 2) are **not bundled** and not available to this skill. Don't try to call them.
