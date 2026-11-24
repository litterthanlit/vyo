// render.mjs — Exploration B (b-cascade): Translucent vertical cascade posters.
// Renders `vyo` and `pantry` at 840x1190 @ 2x DPR (1680x2380 PNG) + 280px thumbnails.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { buildCascade } from './layout.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SKILL_DIR = path.join(REPO_ROOT, '.cursor/skills/vyo');
const FONTS_DIR = path.join(SKILL_DIR, 'fonts');
const OUT_DIR = path.join(__dirname, 'out');

const require = createRequire(path.join(SKILL_DIR, 'package.json'));
const { chromium } = require('playwright');

// ---------------------------------------------------------------------------
// Poster Configurations (real scanned codebases)
// ---------------------------------------------------------------------------

const POSTERS = [
  {
    id: 'vyo',
    outName: 'vyo-cascade',
    factsPath: path.resolve(__dirname, '../facts/vyo-facts.json'),
    width: 840,
    height: 1190,
    ground: '#FFFFFF',
    inkText: '#141414',
    colophonColor: '#888888',
    targetBars: 1180,
    locExponent: 0.62,
    seed: 'vyo-cascade-v3',
    grainStrength: 17,
    titleLines: ['Every File', 'Moves Through', 'One Picture'],
    mark: '&',
    colophonRight: 'ink spine: fields · indigo: engine · rose: scan · saffron: cli & covers',
    classifyFile(fp) {
      if (fp.startsWith('tools/lib/fields/')) return 'spine';
      if (fp.startsWith('tools/lib/scan/')) return 'rightMid';
      if (fp.startsWith('examples/') || fp === 'tools/vyo.mjs' || fp === 'tools/postinstall.mjs') {
        return 'flankLeft';
      }
      if (fp.startsWith('tools/lib/cover')) return 'flankRight';
      return 'leftMid';
    },
    zones: {
      flankLeft: {
        xMin: -0.02,
        xMax: 0.095,
        xCenter: 0.025,
        xJitter: 0.032,
        hubPull: 0.14,
        densityScale: 1.85,
        minShards: 12,
        echoProb: 0.20,
        palette: ['#E88F14', '#F3B42E', '#F8CE5C', '#FBE08E'],
      },
      leftMid: {
        xMin: 0.035,
        xMax: 0.415,
        xCenter: 0.225,
        xJitter: 0.042,
        hubPull: 0.20,
        densityScale: 1.12,
        minShards: 7,
        echoProb: 0.20,
        palette: ['#4F48A3', '#716AC0', '#9891D9', '#C0BBE9'],
      },
      spine: {
        xMin: 0.355,
        xMax: 0.555,
        xCenter: 0.448,
        xJitter: 0.030,
        hubPull: 0.34,
        densityScale: 0.72,
        minShards: 5,
        echoProb: 0.10,
        palette: ['#181920', '#363844', '#606370', '#9194A0'],
      },
      rightMid: {
        xMin: 0.565,
        xMax: 0.905,
        xCenter: 0.745,
        xJitter: 0.044,
        hubPull: 0.16,
        densityScale: 1.24,
        minShards: 7,
        echoProb: 0.20,
        mirrorFlankProb: 0.15,
        palette: ['#E072A7', '#EC9AC1', '#F4BCD7', '#FAD5E7'],
      },
      flankRight: {
        xMin: 0.765,
        xMax: 1.02,
        xCenter: 0.91,
        xJitter: 0.038,
        hubPull: 0.14,
        densityScale: 2.05,
        minShards: 12,
        echoProb: 0.18,
        palette: ['#EB9216', '#F4B632', '#F9CF60', '#FCE193'],
      },
    },
  },
  {
    id: 'pantry',
    outName: 'pantry-cascade',
    factsPath: path.join(
      REPO_ROOT,
      'explorations/2026-11-11-punk-covers/c-living/facts/pantry-facts.json'
    ),
    width: 840,
    height: 1190,
    ground: '#FDFBF7',
    inkText: '#161A1C',
    colophonColor: '#89867E',
    targetBars: 1140,
    locExponent: 0.70,
    seed: 'pantry-cascade-v3',
    grainStrength: 17,
    titleLines: ['A Week of', 'Dinners, Planned', 'In One Go'],
    mark: '&',
    colophonRight: 'sumi spine: recipes & plan · jade: ui · persimmon: screens · ochre: api & ai',
    classifyFile(fp) {
      if (fp.startsWith('lib/recipes/') || fp.startsWith('lib/plan/') || fp.startsWith('prisma/')) {
        return 'spine';
      }
      if (fp.startsWith('components/')) return 'leftMid';
      if (fp.startsWith('app/api/')) return 'flankLeft';
      if (fp.startsWith('lib/ai/') || fp.startsWith('lib/')) return 'flankRight';
      return 'rightMid';
    },
    zones: {
      flankLeft: {
        xMin: -0.02,
        xMax: 0.105,
        xCenter: 0.03,
        xJitter: 0.034,
        hubPull: 0.14,
        densityScale: 1.95,
        minShards: 14,
        echoProb: 0.20,
        palette: ['#DC6D22', '#EE9932', '#F6C058', '#FAD98C'],
      },
      leftMid: {
        xMin: 0.04,
        xMax: 0.405,
        xCenter: 0.22,
        xJitter: 0.042,
        hubPull: 0.20,
        densityScale: 1.15,
        minShards: 10,
        echoProb: 0.20,
        palette: ['#1C6D6B', '#3D928E', '#6FB7B2', '#A6D6D1'],
      },
      spine: {
        xMin: 0.355,
        xMax: 0.555,
        xCenter: 0.448,
        xJitter: 0.030,
        hubPull: 0.32,
        densityScale: 0.74,
        minShards: 8,
        echoProb: 0.10,
        palette: ['#181E20', '#364044', '#616C71', '#929CA1'],
      },
      rightMid: {
        xMin: 0.565,
        xMax: 0.895,
        xCenter: 0.74,
        xJitter: 0.044,
        hubPull: 0.16,
        densityScale: 1.32,
        minShards: 11,
        echoProb: 0.22,
        mirrorFlankProb: 0.13,
        palette: ['#DF6954', '#ED907E', '#F5B8AA', '#FAD5CB'],
      },
      flankRight: {
        xMin: 0.76,
        xMax: 1.02,
        xCenter: 0.91,
        xJitter: 0.038,
        hubPull: 0.15,
        densityScale: 1.40,
        minShards: 10,
        echoProb: 0.18,
        palette: ['#E4821E', '#F1AD36', '#F7CE66', '#AAD3C4'],
      },
    },
  },
];

function loadFontBase64(filename) {
  return fs.readFileSync(path.join(FONTS_DIR, filename)).toString('base64');
}

function buildHtml({ cascade, poster, fonts }) {
  const colophonLeft = `${poster.id} · ${cascade.stats.fileCount} files · ${cascade.stats.totalLoc.toLocaleString('en-US')} lines · ${cascade.stats.importCount} imports`;
  const payload = JSON.stringify({
    width: poster.width,
    height: poster.height,
    ground: poster.ground,
    grainStrength: poster.grainStrength,
    bars: cascade.bars,
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: 'Newsreader';
    src: url(data:font/ttf;base64,${fonts.newsreader}) format('truetype');
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: 'Inter';
    src: url(data:font/woff2;base64,${fonts.inter}) format('woff2');
    font-weight: 500;
    font-style: normal;
  }
  @font-face {
    font-family: 'CommitMono';
    src: url(data:font/otf;base64,${fonts.commit}) format('opentype');
    font-weight: 400;
    font-style: normal;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${poster.width}px;
    height: ${poster.height}px;
    overflow: hidden;
    background: ${poster.ground};
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }

  .poster {
    position: relative;
    width: ${poster.width}px;
    height: ${poster.height}px;
    background: ${poster.ground};
    overflow: hidden;
  }

  #cascade {
    position: absolute;
    inset: 0;
    width: ${poster.width}px;
    height: ${poster.height}px;
    display: block;
  }

  .editorial {
    position: absolute;
    left: 54px;
    right: 54px;
    bottom: 70px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    pointer-events: none;
  }

  .title {
    font-family: 'Newsreader', Georgia, serif;
    font-size: 50px;
    font-weight: 400;
    line-height: 1.07;
    letter-spacing: -0.015em;
    color: ${poster.inkText};
    font-feature-settings: "kern" 1, "liga" 1, "opsz" 48;
  }

  .title span {
    display: block;
  }

  .mark {
    font-family: 'Newsreader', Georgia, serif;
    font-size: 46px;
    font-weight: 400;
    line-height: 0.84;
    color: ${poster.inkText};
    -webkit-text-stroke: 1.15px ${poster.inkText};
    paint-order: stroke fill;
    transform: translateY(-2px);
    user-select: none;
  }

  .colophon {
    position: absolute;
    left: 54px;
    right: 54px;
    bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-family: 'Inter', sans-serif;
    font-size: 9.2px;
    font-weight: 500;
    letter-spacing: 0.025em;
    color: ${poster.colophonColor};
    opacity: 0.80;
  }
</style>
</head>
<body>
  <div class="poster">
    <canvas id="cascade" width="${poster.width * 2}" height="${poster.height * 2}"></canvas>

    <div class="editorial">
      <h1 class="title">
        ${poster.titleLines.map((line) => `<span>${line}</span>`).join('\n        ')}
      </h1>
      <div class="mark" aria-hidden="true">${poster.mark}</div>
    </div>

    <footer class="colophon">
      <span>${colophonLeft}</span>
      <span>${poster.colophonRight}</span>
    </footer>
  </div>

  <script>
    (() => {
      const DATA = ${payload};
      const canvas = document.getElementById('cascade');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const DPR = 2;
      const PW = DATA.width * DPR;
      const PH = DATA.height * DPR;

      function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }

      // 1. Fill crisp gallery white/warm paper ground
      ctx.fillStyle = DATA.ground;
      ctx.fillRect(0, 0, PW, PH);

      // 2. Render all translucent vertical rectangles using true multiply blending
      ctx.save();
      ctx.scale(DPR, DPR);
      ctx.globalCompositeOperation = 'multiply';

      for (const b of DATA.bars) {
        const [r, g, bl] = hexToRgb(b.color);
        const x = Math.round(b.x * 2) / 2;
        const y = Math.round(b.y * 2) / 2;
        const w = Math.max(1.5, Math.round(b.w * 2) / 2);
        const h = Math.max(4, Math.round(b.h * 2) / 2);

        const grad = ctx.createLinearGradient(x, y, x, y + h);
        const topA = b.alpha * (0.95 + b.seed * 0.08);
        const botA = b.alpha * (1.03 - b.seed * 0.08);
        grad.addColorStop(0, \`rgba(\${r},\${g},\${bl},\${topA.toFixed(3)})\`);
        grad.addColorStop(1, \`rgba(\${r},\${g},\${bl},\${botA.toFixed(3)})\`);

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, h);
      }
      ctx.restore();

      // 3. Apply tactile risograph / archival ink grain ONLY where ink exists
      const [grR, grG, grB] = hexToRgb(DATA.ground);
      const img = ctx.getImageData(0, 0, PW, PH);
      const d = img.data;
      const strength = DATA.grainStrength || 17;

      function hash2(x, y) {
        let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
      }

      for (let y = 0; y < PH; y++) {
        const rowOff = y * PW * 4;
        const cy = y >> 1;
        for (let x = 0; x < PW; x++) {
          const idx = rowOff + (x << 2);
          const r = d[idx];
          const g = d[idx + 1];
          const b = d[idx + 2];

          const dr = Math.abs(grR - r);
          const dg = Math.abs(grG - g);
          const db = Math.abs(grB - b);
          const inkDiff = Math.max(dr, dg, db);
          if (inkDiff < 3) continue;

          const ink = Math.min(1, inkDiff / 220);
          const toothEnvelope = Math.pow(ink, 0.55) * (1.0 - 0.22 * ink * ink);

          const n1 = hash2(x, y) - 0.5;
          const n2 = hash2(x >> 1, cy) - 0.5;
          const grain = (n1 * 0.65 + n2 * 0.55) * strength * 2.2 * toothEnvelope;
          const fleck = hash2(x + 9173, y + 3119) > 0.955 ? 11 * toothEnvelope : 0;

          const delta = grain + fleck;
          d[idx] = Math.max(0, Math.min(255, Math.round(r + delta)));
          d[idx + 1] = Math.max(0, Math.min(255, Math.round(g + delta)));
          d[idx + 2] = Math.max(0, Math.min(255, Math.round(b + delta)));
        }
      }
      ctx.putImageData(img, 0, 0);
      window.__RENDER_DONE__ = true;
    })();
  </script>
</body>
</html>`;
}

async function makeThumb(browser, fullPngPath, thumbPngPath, thumbWidth = 280) {
  const b64 = fs.readFileSync(fullPngPath).toString('base64');
  const thumbHeight = Math.round((thumbWidth * 1190) / 840);
  const ctx = await browser.newContext({
    viewport: { width: thumbWidth, height: thumbHeight },
    deviceScaleFactor: 1,
  });
  try {
    const page = await ctx.newPage();
    await page.setContent(`<!doctype html><html><body style="margin:0;padding:0;overflow:hidden;background:#fff;">
      <canvas id="c" width="${thumbWidth}" height="${thumbHeight}" style="display:block;width:${thumbWidth}px;height:${thumbHeight}px;"></canvas>
      <script>
        (() => {
          window.__DONE = new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const c = document.getElementById('c');
              const ctx = c.getContext('2d');
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, ${thumbWidth}, ${thumbHeight});
              resolve(true);
            };
            img.src = 'data:image/png;base64,${b64}';
          });
        })();
      </script>
    </body></html>`);
    await page.evaluate(() => window.__DONE);
    await page.screenshot({ path: thumbPngPath, type: 'png' });
  } finally {
    await ctx.close();
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const fonts = {
    newsreader: loadFontBase64('newsreader-400.ttf'),
    inter: loadFontBase64('inter-500.woff2'),
    commit: loadFontBase64('commit-400.otf'),
  };

  const browser = await chromium.launch({
    executablePath: process.env.VYO_CHROMIUM || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const poster of POSTERS) {
      const facts = JSON.parse(fs.readFileSync(poster.factsPath, 'utf8'));
      const cascade = buildCascade(facts, poster);
      const html = buildHtml({ cascade, poster, fonts });

      const context = await browser.newContext({
        viewport: { width: poster.width, height: poster.height },
        deviceScaleFactor: 2,
      });
      try {
        const page = await context.newPage();
        page.on('pageerror', (err) => {
          throw new Error(`Page error rendering ${poster.id}: ${err.message}`);
        });

        await page.setContent(html, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => window.__RENDER_DONE__ === true);

        const fullPath = path.join(OUT_DIR, `${poster.outName}.png`);
        const thumbPath = path.join(OUT_DIR, `${poster.outName}-thumb.png`);

        await page.screenshot({ path: fullPath, type: 'png' });
        await makeThumb(browser, fullPath, thumbPath, 280);

        console.log(
          `Rendered ${poster.outName}: ${cascade.stats.fileCount} files, ` +
            `${cascade.stats.totalLoc} LOC, ${cascade.stats.importCount} imports -> ` +
            `${cascade.stats.barCount} shards -> ${fullPath}`
        );
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
