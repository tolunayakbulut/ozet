import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Renders each HTML page to a JPEG (default 1080x1350, numbered from startIndex). Elements marked `.fit` shrink until
 * their content no longer overflows: via the CSS variable named in `data-var` if
 * set, otherwise via font-size, down to `data-min` px.
 */
export async function renderSlides(
  pages: string[],
  outDir: string,
  size = { width: 1080, height: 1350 },
  startIndex = 1,
): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: size });
  const files: string[] = [];
  try {
    for (const [i, html] of pages.entries()) {
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => {
        const stuck: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(".fit")) {
          const min = Number(el.dataset.min ?? 20);
          const cssVar = el.dataset.var;
          const style = getComputedStyle(el);
          let size = parseFloat(cssVar ? style.getPropertyValue(cssVar) : style.fontSize);
          while (el.scrollHeight > el.clientHeight + 8 && size > min) {
            size -= 1;
            if (cssVar) el.style.setProperty(cssVar, `${size}px`);
            else el.style.fontSize = `${size}px`;
          }
          if (el.scrollHeight > el.clientHeight + 8) stuck.push(el.textContent?.trim().slice(0, 40) ?? "");
        }
        return stuck;
      });
      if (overflow.length) console.warn(`  ! sayfa ${i + 1}: metin hâlâ taşıyor: ${overflow.join(" | ")}`);
      const file = path.join(outDir, `${String(i + startIndex).padStart(2, "0")}.jpg`);
      await page.screenshot({ path: file, type: "jpeg", quality: 92 });
      await writeFile(file.replace(/\.jpg$/, ".html"), html);
      await page.close();
      files.push(file);
    }
  } finally {
    await browser.close();
  }
  return files;
}
