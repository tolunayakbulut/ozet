import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { logoHtml } from "./templates.ts";

// Renders brand/logo.png (1080x1080, profile picture) and brand/logo.html.
await mkdir("brand", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
await page.setContent(logoHtml(), { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "brand/logo.png" });
await writeFile("brand/logo.html", logoHtml());
await browser.close();
