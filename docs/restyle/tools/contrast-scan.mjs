// Contrast scan (axe-core "color-contrast") of every page and a few windows, light and dark.
// Also checks: the theme switch (and that the choice is kept after reload), the menu toggle, the language switch.
// usage: SHOT_EMAIL=… SHOT_PASSWORD=… node contrast-scan.mjs   (needs playwright-core and axe-core, see ../README.md)
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const AXE = require.resolve('axe-core/axe.min.js');
const BASE = process.env.BASE_URL ?? 'http://localhost:5188';
// the test login of the local throwaway database (never a real account)
const EMAIL = process.env.SHOT_EMAIL;
const PASSWORD = process.env.SHOT_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error('set SHOT_EMAIL and SHOT_PASSWORD (the local test login)');
const EXE = `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1228/chrome-win64/chrome.exe`;
const PAGES = ['/', '/items', '/categories', '/inventory', '/inbound', '/outbound', '/suppliers', '/departments', '/analytics', '/users'];

const settle = async (page) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.ant-spin-spinning, .ant-skeleton'), null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(1200);
};
const spaGo = async (page, path) => {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await settle(page);
};

const lines = [];
let violations = 0;
async function scan(page, label) {
  await page.addScriptTag({ path: AXE });
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['color-contrast'] });
    return {
      passes: r.passes.reduce((n, p) => n + p.nodes.length, 0),
      incomplete: r.incomplete.reduce((n, p) => n + p.nodes.length, 0),
      bad: r.violations.flatMap((v) => v.nodes.map((n) => ({
        target: n.target.join(' '),
        html: n.html.slice(0, 110),
        d: n.any[0]?.data,
      }))),
    };
  });
  violations += res.bad.length;
  lines.push(`${res.bad.length ? 'FAIL' : 'PASS'} ${label}: ${res.passes} text nodes pass, ${res.bad.length} fail, ${res.incomplete} could not be measured`);
  for (const b of res.bad) lines.push(`     ${b.d?.contrastRatio} (${b.d?.fgColor} on ${b.d?.bgColor}, need ${b.d?.expectedContrastRatio}) ${b.target} :: ${b.html}`);
}

const browser = await chromium.launch({ executablePath: EXE });
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, locale: 'ko-KR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/signup`);
  await settle(page);
  await scan(page, `${scheme} /signup`);
  await page.goto(`${BASE}/login`);
  await settle(page);
  await scan(page, `${scheme} /login`);
  await page.fill('input[autocomplete="email"]', EMAIL);
  await page.fill('input[autocomplete="current-password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);
  await settle(page);
  for (const lang of ['ko', 'vi']) {
    if (lang === 'vi') {
      await page.locator('.app-top .ant-segmented-item', { hasText: 'VI' }).first().click();
      await page.waitForTimeout(400);
    }
    for (const path of PAGES) {
      await spaGo(page, path);
      await scan(page, `${scheme} ${lang} ${path}`);
    }
  }
  // windows (looking only)
  await spaGo(page, '/items');
  await page.locator('.ant-table-tbody tr.ant-table-row').first().locator('button').nth(2).click();
  await settle(page);
  await scan(page, `${scheme} vi price window`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.locator('.page-h button.ant-btn-primary').first().click();
  await settle(page);
  await scan(page, `${scheme} vi new item window`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.locator('.app-top .tbtn').last().click();
  await page.waitForTimeout(500);
  await scan(page, `${scheme} vi account pop-up`);
  await page.keyboard.press('Escape');
  await ctx.close();
}

// ---- behaviour: theme switch, kept after reload; menu toggle; language
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'ko-KR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await settle(page);
  const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const ground = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  lines.push(`theme: PC setting light -> data-theme=${await theme()} body=${await ground()}`);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(300);
  lines.push(`theme: PC setting changed to dark while open -> data-theme=${await theme()} body=${await ground()}`);
  await page.fill('input[autocomplete="email"]', EMAIL);
  await page.fill('input[autocomplete="current-password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);
  await settle(page);
  const seg = (i) => page.locator('.app-sidefoot .ant-segmented-item').nth(i);
  await seg(0).click();
  await page.waitForTimeout(300);
  lines.push(`theme: chose "light" on a dark PC -> data-theme=${await theme()} stored=${await page.evaluate(() => localStorage.getItem('mro-theme-storage'))}`);
  await page.reload();
  await settle(page);
  lines.push(`theme: after reload -> data-theme=${await theme()} body=${await ground()}`);
  await seg(1).click();
  await page.waitForTimeout(300);
  lines.push(`theme: chose "dark" -> data-theme=${await theme()} antd card bg=${await page.evaluate(() => getComputedStyle(document.querySelector('.ant-card')).backgroundColor)}`);
  await seg(2).click();
  await page.waitForTimeout(300);
  lines.push(`theme: chose "system" (PC is dark) -> data-theme=${await theme()}`);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(300);
  lines.push(`theme: "system", PC back to light -> data-theme=${await theme()}`);

  const sideW = () => page.evaluate(() => {
    const el = document.querySelector('.app-side');
    const r = el.getBoundingClientRect();
    return `left=${Math.round(r.left)} visible=${getComputedStyle(el).visibility}`;
  });
  lines.push(`menu: open ${await sideW()}`);
  await page.locator('.app-top .tbtn').first().click();
  await page.waitForTimeout(500);
  lines.push(`menu: after toggle ${await sideW()}`);
  await page.locator('.app-top .tbtn').first().click();
  await page.waitForTimeout(500);
  lines.push(`menu: toggled back ${await sideW()}`);

  await page.locator('.app-top .ant-segmented-item', { hasText: 'VI' }).first().click();
  await page.waitForTimeout(400);
  lines.push(`language: VI -> title "${await page.locator('.page-h h1').innerText()}", menu "${(await page.locator('.app-side .ant-menu-item').allInnerTexts()).join(' | ')}"`);
  // factory switch: the page is re-mounted for the other factory (reading only)
  await page.locator('.app-top .ant-segmented-item', { hasText: 'ALV' }).first().click();
  await settle(page);
  lines.push(`factory: ALV chosen -> stored=${await page.evaluate(() => JSON.parse(localStorage.getItem('mro-location-storage')).state.currentLocationCode)}, total stock card "${(await page.locator('.stat .v').first().innerText()).replace(/\s+/g, ' ')}"`);
  await page.locator('.app-top .ant-segmented-item', { hasText: 'ALT' }).first().click();
  await settle(page);
  // log out from the account pop-up
  await page.locator('.app-top .tbtn').last().click();
  await page.waitForTimeout(400);
  await page.locator('.user-pop button').click();
  await page.waitForURL(`${BASE}/login`);
  lines.push(`logout: landed on ${new URL(page.url()).pathname}`);
  await ctx.close();
}
await browser.close();
console.log(lines.join('\n'));
console.log(`\ncontrast violations: ${violations}`);
