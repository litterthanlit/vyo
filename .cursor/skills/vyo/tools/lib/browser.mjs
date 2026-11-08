// The one Chromium vyo launches, and the note that says how to get one when it will not start.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Pinned to the Playwright vyo resolved: a browser installed by another Playwright version will not launch.
export const BROWSER_NOTE = `vyo renders with Chromium. Set VYO_CHROMIUM to a Chromium or Chrome binary,
or install the one it expects: npx playwright@${require("playwright/package.json").version} install chromium`;

export class NoBrowser extends Error {
  constructor() {
    super(BROWSER_NOTE);
  }
}

export async function launchChromium() {
  const { chromium } = require("playwright");
  try {
    return await chromium.launch(process.env.VYO_CHROMIUM ? { executablePath: process.env.VYO_CHROMIUM } : {});
  } catch {
    throw new NoBrowser();
  }
}
