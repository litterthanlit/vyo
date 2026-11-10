# vyo

vyo draws a codebase as one poster that someone who does not code can read. Your coding agent invents a shape for the product, and vyo sizes every part of the code to fit it.

<table align="center">
  <tr>
    <td align="center" valign="top"><img src="docs/posters/bands-pantry-dark-web.png" width="280" alt="A dark poster headed 'A week of dinners, planned in one go.' A white storage jar is cut into horizontal bands. Each band repeats the plain name of one part of the code, such as 'screens', 'recipe cards' and 'week view', in type as big as that part's share of the code. One band, 'the plan', is orange."></td>
    <td align="center" valign="top"><img src="docs/posters/rings-pantry-dark-web.png" width="280" alt="A dark poster headed 'A week of dinners, planned in one go.' A jar outline is filled with rings inside rings. Each ring is lines of small type naming one part of the code. The orange rings are the plan. Faint outlines echo the jar around it."></td>
    <td align="center" valign="top"><img src="docs/posters/relief-pantry-dark-web.png" width="280" alt="A dark poster headed 'A week of dinners, planned in one go.' A jar rendered as a lit, rounded volume in dense small type. Each layer is the name of one part of the code. The layer for the plan glows orange near the bottom."></td>
  </tr>
  <tr>
    <td align="center" valign="top"><img src="docs/posters/bands-hypher-light-web.png" width="280" alt="A pale poster headed 'Switch agents without starting over.' A notebook shape with a ribbon at the bottom is cut into bands in slate and black. The words 'server', 'screen pieces' and 'web helpers' fill the big bands. The 'handoff note' band is orange."></td>
    <td align="center" valign="top"><img src="docs/posters/rings-hypher-dark-web.png" width="280" alt="A dark poster headed 'Switch agents without starting over.' A large paper-plane shape is filled with rings of small type, one ring per part of the code. The orange outer rings read 'handoff note'. The core is drawn in level lines."></td>
    <td align="center" valign="top"><img src="docs/posters/relief-hypher-dark-web.png" width="280" alt="A dark poster headed 'Switch agents without starting over.' A paper plane with lit, folded wings, drawn in dense small type. Each band is the name of one part of the code. A band named 'handoff note' glows orange across the wing."></td>
  </tr>
</table>

<p align="center">The same two products in the three looks. Pantry is a recipe planner kept as a test fixture. Hypher is a tool for handing work from one coding agent to the next.</p>

## The three looks

A shape poster has one `style`. You pick it, or your agent does.

- **bands** cuts the shape top to bottom into one band per part. Part names read from across a room.
- **rings** sets the names along the outline, ring inside ring. It suits a fat, round object.
- **relief** draws the outline as a lit, sculpted volume in dense small type. The object itself is the pull.

vyo also draws three other fields: a wave, a terrain and a river. The shape field is the one shown here.

## Install and make a poster

Run these in the project you want to explain:

```bash
npm install --save-dev @litterthanlit/vyo
npx vyo init
npx playwright install chromium
```

`npx vyo init` copies the skill into `.cursor/skills/vyo/` and `.claude/skills/vyo/`. If you already have a Chromium or Chrome, set `VYO_CHROMIUM` to its path and skip the last command. Node.js 20 or later is required.

Then say this to your agent:

> Explain this app as a poster. Draw it as a shape.

The agent follows the skill and replies with the paths of a PNG and a PDF in `vyo/` at the project root.

To try vyo without installing it, run `npx -y @litterthanlit/vyo init` and have the agent run `npx -y @litterthanlit/vyo` wherever the skill says `npx vyo`.

## How it works

1. `vyo scan` reads the code with no network and no model. Two scans of the same tree give the same file.
2. Your agent names each part in plain words and chooses the part the product is about. For a shape, it draws the silhouette from a few simple pieces.
3. `vyo sketch` shows the layout in a quick picture before the full render, so the agent can fix the shape first.
4. `vyo render` draws the poster to HTML, PNG and PDF.
5. Checks run on what was drawn. They reject jargon, file paths, placeholder text and text that collides with the picture, and each failure says what to change.

## What it reads

- Nothing leaves your machine. The scan makes no network calls and calls no model.
- Your code is never executed. The scan reads source files as text. The only program it runs is `git`, to read the latest commit, with hooks switched off.
- Dotfiles such as `.env`, hidden folders, tests, `node_modules`, and build output at a project root are skipped.

## Languages

JavaScript, TypeScript and Python get full detection: screens, requests and saved records. Go, Ruby, Rust, PHP, Java, Kotlin, Swift, C#, C and C++, Dart, Scala, Elixir, Lua and Zig are drawn by size.

## More

- [The skill folder](.cursor/skills/vyo/) holds `SKILL.md`, the plain-language rules and the examples.
- [tools/README.md](.cursor/skills/vyo/tools/README.md) lists every command, the spec, and every check.
- [Package README](.cursor/skills/vyo/README.md) is the page shown on npm.

## Licence

MIT. See [LICENSE](LICENSE). The bundled fonts, Commit Mono and Newsreader, are under the SIL Open Font License 1.1. See [fonts/LICENSE.md](.cursor/skills/vyo/fonts/LICENSE.md).
