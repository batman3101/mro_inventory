// Screenshots of every page against the local dev server (throwaway local Supabase, fictional data).
// usage: SHOT_EMAIL=… SHOT_PASSWORD=… node shoot.mjs <before|after> <outDir> [light,dark] [ko,vi]
// needs playwright-core and a Chromium (see ../README.md); MODALS=0 skips the windows, PAGES=0 the pages.
// Every picture is checked before it is taken: the address, the page's title, a window's title (from the
// app's own ko/vi texts). If the screen is not the one the file is named after, the run stops with an error
// (2026-11-27 audit RESTYLE-02: four "before" window pictures were in fact the sign-in page).
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , phase = 'after', outDir = './out', schemesArg = 'light,dark', langsArg = 'ko'] = process.argv;
const BASE = process.env.BASE_URL ?? 'http://localhost:5188';
// the test login of the local throwaway database (never a real account)
const EMAIL = process.env.SHOT_EMAIL;
const PASSWORD = process.env.SHOT_PASSWORD;
if (!EMAIL || !PASSWORD) throw new Error('set SHOT_EMAIL and SHOT_PASSWORD (the local test login)');
const EXE = `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1228/chrome-win64/chrome.exe`;
const W = 1440;
const H = 900;
// the app's texts; set LOCALES_DIR when this script runs from a copy outside the repository
const LOCALES = process.env.LOCALES_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '../../../src/i18n/locales');
const texts = (lang) => JSON.parse(readFileSync(join(LOCALES, `${lang}.json`), 'utf8'));

// [file name, address, the page title's key in the locale files]
const PAGES = [
  ['dashboard', '/', 'dashboard.title'],
  ['items', '/items', 'items.title'],
  ['categories', '/categories', 'categories.title'],
  ['inventory', '/inventory', 'inventory.listTitle'],
  ['inbound', '/inbound', 'inbound.title'],
  ['outbound', '/outbound', 'outbound.title'],
  ['suppliers', '/suppliers', 'suppliers.title'],
  ['departments', '/departments', 'departments.title'],
  ['analytics', '/analytics', 'analytics.title'],
  ['users', '/users', 'users.title'],
];
const pick = (obj, key) => key.split('.').reduce((o, k) => o[k], obj);

mkdirSync(outDir, { recursive: true });
const problems = [];

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.ant-spin-spinning, .ant-skeleton'), null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0); // no hover state in the picture
  await page.waitForTimeout(2600); // chart animations (the pie's labels come last)
}

// the whole page in one picture: when the app scrolls inside its own box, grow the window until nothing is cut
async function shot(page, file) {
  await page.setViewportSize({ width: W, height: H });
  await page.waitForTimeout(100);
  const extra = await page.evaluate(() => {
    const el = document.querySelector('.app-page');
    return el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0;
  });
  if (extra > 0) {
    await page.setViewportSize({ width: W, height: H + extra + 2 });
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: join(outDir, file), fullPage: true });
  await page.setViewportSize({ width: W, height: H });
}

async function spaGo(page, path) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await settle(page);
}

// ---- checks that the screen is the intended one; each throws, which ends the run ----
async function expectAt(page, path) {
  const at = new URL(page.url()).pathname;
  if (at !== path) throw new Error(`expected the address ${path} but the browser is at ${at}`);
  if (path !== '/login' && (await page.locator('input[autocomplete="current-password"]').count()) > 0) {
    throw new Error(`expected ${path} but the sign-in form is showing (signed out?)`);
  }
}

// the page's own title (h1 after the restyle, antd's h3 title before it)
async function expectPage(page, path, title) {
  await expectAt(page, path);
  await page.locator('h1, h3.ant-typography').filter({ hasText: title }).first()
    .waitFor({ state: 'visible', timeout: 8000 })
    .catch(() => { throw new Error(`at ${path} the page title "${title}" is not on screen`); });
}

// click, then make sure the window with this title is open on the same page
async function openWindow(page, opener, title, path) {
  await opener.click();
  await page.locator('.ant-modal-title:visible').filter({ hasText: title }).first()
    .waitFor({ state: 'visible', timeout: 8000 })
    .catch(() => { throw new Error(`the window "${title}" did not open (address now ${new URL(page.url()).pathname})`); });
  await expectAt(page, path);
  await settle(page);
}

async function closeWindow(page) {
  await page.keyboard.press('Escape');
  await page.locator('.ant-modal-title:visible').first().waitFor({ state: 'hidden', timeout: 8000 });
}

async function setLang(page, lang) {
  if (lang === 'ko') return;
  const flag = page.locator('button', { hasText: '🇻🇳' });
  if (await flag.count()) await flag.first().click();
  else await page.locator('.app-top .ant-segmented-item', { hasText: 'VI' }).first().click();
  await page.waitForTimeout(400);
}

// horizontal overflow or clipped text in the frame (the Vietnamese check)
async function clipReport(page, label) {
  const found = await page.evaluate(() => {
    const out = [];
    const sel = '.ant-segmented-item-label, .app-top *, .app-side *, .page-h *, .stat *, .ant-btn, .ant-table-thead th, .ant-card-head-title, .ant-statistic-title, .ant-menu-title-content, .ant-form-item-label label, .ant-modal-title';
    for (const el of document.querySelectorAll(sel)) {
      if (!(el instanceof HTMLElement) || !el.offsetParent) continue;
      if (el.children.length > 0 && el.tagName !== 'BUTTON' && el.tagName !== 'TH' && !el.classList.contains('ant-segmented-item-label')) continue;
      const cs = getComputedStyle(el);
      if (cs.textOverflow === 'ellipsis' && el.tagName === 'TD') continue;
      if (el.tagName === 'TH' && el.querySelector('.react-resizable-handle') && el.scrollWidth - el.clientWidth <= 6) continue; // the resize grip sticks out 5px
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible') {
        out.push(`${el.tagName}.${String(el.className).slice(0, 40)} "${(el.textContent ?? '').trim().slice(0, 40)}" ${el.scrollWidth}>${el.clientWidth}`);
      }
    }
    // table cells whose content is wider than the column (cut by the next column), one line per column
    const cols = new Map();
    for (const td of document.querySelectorAll('.ant-table-tbody > tr.ant-table-row > td:not(.ant-table-cell-ellipsis)')) {
      if (td.scrollWidth > td.clientWidth + 1) {
        const head = td.closest('table').querySelectorAll('thead th')[td.cellIndex] ?? td.closest('.ant-table').querySelectorAll('thead th')[td.cellIndex];
        const key = (head?.textContent ?? `col ${td.cellIndex}`).trim();
        if (!cols.has(key)) cols.set(key, `${td.scrollWidth}>${td.clientWidth} "${(td.textContent ?? '').trim().slice(0, 24)}"`);
      }
    }
    for (const [k, v] of cols) out.push(`table column "${k}" content cut: ${v}`);
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth + 1) out.push(`document scrolls sideways ${doc.scrollWidth}>${doc.clientWidth}`);
    return out;
  });
  for (const f of found) problems.push(`[clip] ${label}: ${f}`);
}

const browser = await chromium.launch({ executablePath: EXE });
for (const scheme of schemesArg.split(',')) {
  for (const lang of langsArg.split(',')) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: scheme, locale: 'ko-KR', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`[console] ${scheme}/${lang} ${page.url()}: ${m.text().slice(0, 300)}`);
    });
    page.on('pageerror', (e) => problems.push(`[pageerror] ${scheme}/${lang} ${page.url()}: ${String(e).slice(0, 300)}`));
    const tag = `${phase}-${scheme}-${lang}`;
    const t = texts(lang);
    const pages = process.env.PAGES !== '0';

    if (lang === 'ko' && pages) {
      await page.goto(`${BASE}/signup`);
      await settle(page);
      await expectAt(page, '/signup');
      await shot(page, `${tag}-signup.png`);
    }
    await page.goto(`${BASE}/login`);
    await settle(page);
    await expectAt(page, '/login');
    if (lang === 'ko' && pages) await shot(page, `${tag}-login.png`);

    await page.fill('input[autocomplete="email"]', EMAIL);
    await page.fill('input[autocomplete="current-password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`);
    await settle(page);
    await setLang(page, lang);

    for (const [name, path, titleKey] of PAGES) {
      await spaGo(page, path);
      await expectPage(page, path, pick(t, titleKey));
      if (!pages) continue;
      await shot(page, `${tag}-${name}.png`);
      await clipReport(page, `${tag}-${name}`);
    }

    // a few windows opened for looking only (nothing is saved)
    if (process.env.MODALS !== '0') {
      // Buttons are looked for inside the page area, by their own name: before the restyle the side menu held a
      // primary "log out" button ahead of the page's, so "the first primary button" signed the session out.
      const content = page.locator('.ant-layout-content, .app-page');
      const firstRow = content.locator('.ant-table-tbody tr.ant-table-row').first();
      const iconButton = (icon) => firstRow.locator('button').filter({ has: page.locator(`.anticon-${icon}`) });

      await spaGo(page, '/items');
      await expectPage(page, '/items', t.items.title);
      await openWindow(page, iconButton('dollar'), t.items.managePrice, '/items');
      await shot(page, `${tag}-modal-price.png`);
      await closeWindow(page);

      await openWindow(page, content.getByRole('button', { name: t.items.addItem }), t.items.createItem, '/items');
      await shot(page, `${tag}-modal-item.png`);
      await clipReport(page, `${tag}-modal-item`);
      await closeWindow(page);

      await spaGo(page, '/outbound');
      await expectPage(page, '/outbound', t.outbound.title);
      await openWindow(page, content.getByRole('button', { name: t.outbound.newOutbound }), t.outbound.newOutbound, '/outbound');
      await shot(page, `${tag}-modal-outbound.png`);
      await clipReport(page, `${tag}-modal-outbound`);
      await closeWindow(page);

      if (phase === 'after') {
        await spaGo(page, '/items');
        await expectPage(page, '/items', t.items.title);
        await openWindow(page, iconButton('eye'), t.items.detail, '/items');
        await shot(page, `${tag}-modal-detail.png`);
        await closeWindow(page);

        // bulk upload window (nothing is uploaded)
        await openWindow(page, content.getByRole('button', { name: t.items.bulkUpload }), t.items.bulkDialogTitle, '/items');
        await shot(page, `${tag}-modal-bulk.png`);
        await closeWindow(page);

        await spaGo(page, '/');
        await expectPage(page, '/', t.dashboard.title);
        await page.locator('.app-top .tbtn').last().click(); // account pop-up
        await page.locator('.user-pop').getByRole('button', { name: t.auth.logout }).waitFor({ state: 'visible', timeout: 8000 });
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(outDir, `${tag}-account-popup.png`) });
        await clipReport(page, `${tag}-account-popup`);
        await page.keyboard.press('Escape');
        await page.locator('.user-pop').waitFor({ state: 'hidden', timeout: 8000 });
        await page.locator('.app-top .tbtn').first().click(); // menu closed
        await page.locator('.app-side.closed').waitFor({ state: 'attached', timeout: 8000 });
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(outDir, `${tag}-menu-closed.png`) });
        await page.locator('.app-top .tbtn').first().click();
      }
    }
    await expectAt(page, new URL(page.url()).pathname); // still signed in at the end of the run
    await ctx.close();
  }
}
await browser.close();
console.log(problems.length ? problems.join('\n') : 'no console errors, no clipped text found');
