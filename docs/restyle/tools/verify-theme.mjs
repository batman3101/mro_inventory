// Theme checks from the 2026-11-27 audit (docs/audits), against a running server (local throwaway Supabase only):
//   01  a damaged saved theme value must not blank the app (the sign-in page still renders)
//   04  the first paint, before the app's JavaScript arrives, is already in the saved theme
//   03  a toast that is already open follows a theme switch (needs the test login: SHOT_EMAIL / SHOT_PASSWORD)
// usage: node verify-theme.mjs <baseUrl> <dev|prod> <outDir> [01,03,04]
//   dev = "vite", prod = "vite build" + "vite preview" (the held entry script has a different address)
// exit code 1 when a check fails. Needs playwright-core and a Chromium (see ../README.md).
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , BASE = 'http://localhost:5188', KIND = 'dev', OUT = './verify-out', ONLY = '01,03,04'] = process.argv;
const EXE = `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1228/chrome-win64/chrome.exe`;
const KEY = 'mro-theme-storage';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE });
const want = (id) => ONLY.split(',').includes(id);
let failures = 0;
const line = (ok, text) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${text}`);
};

// ---------------------------------------------------------------- RESTYLE-01
if (want('01')) {
  console.log('\n== RESTYLE-01: stored theme value -> does the sign-in page still render? (PC setting: dark)');
  const cases = [
    ['valid "system"', JSON.stringify({ state: { mode: 'system' }, version: 0 }), 'dark'],
    ['valid "light"', JSON.stringify({ state: { mode: 'light' }, version: 0 }), 'light'],
    ['valid "dark"', JSON.stringify({ state: { mode: 'dark' }, version: 0 }), 'dark'],
    ['wrong string "invalid"', JSON.stringify({ state: { mode: 'invalid' }, version: 0 }), 'dark'],
    ['mode null', JSON.stringify({ state: { mode: null }, version: 0 }), 'dark'],
    ['mode number 1', JSON.stringify({ state: { mode: 1 }, version: 0 }), 'dark'],
    ['mode object', JSON.stringify({ state: { mode: { a: 1 } }, version: 0 }), 'dark'],
    ['mode "__proto__"', JSON.stringify({ state: { mode: '__proto__' }, version: 0 }), 'dark'],
    ['state null', JSON.stringify({ state: null, version: 0 }), 'dark'],
    ['state missing', JSON.stringify({ version: 0 }), 'dark'],
    ['state is a string', JSON.stringify({ state: 'dark', version: 0 }), 'dark'],
    ['broken JSON', '{"state":{"mode":"li', 'dark'],
    ['JSON null', 'null', 'dark'],
    ['JSON array', '[]', 'dark'],
    ['plain text', 'dark', 'dark'],
    ['empty string', '', 'dark'],
    ['version mismatch (99) with "light"', JSON.stringify({ state: { mode: 'light' }, version: 99 }), 'dark'],
  ];
  for (const [name, raw, expectTheme] of cases) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
    await ctx.addInitScript(([k, v]) => {
      // only before the first load of this tab: later writes by the app must survive
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(k, v);
        sessionStorage.setItem('seeded', '1');
      }
    }, [KEY, raw]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 110)));
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      email: document.querySelectorAll('input[autocomplete="email"]').length,
      text: document.body.innerText.trim().length,
      bg: getComputedStyle(document.body).backgroundColor,
    }));
    const ok = r.email === 1 && errors.length === 0 && r.theme === expectTheme;
    line(ok, `${name.padEnd(36)} data-theme=${r.theme} email inputs=${r.email} text chars=${r.text} body=${r.bg} pageerrors=${errors.length}${errors.length ? ` (${errors[0]})` : ''}`);
    await ctx.close();
  }
}

// ---------------------------------------------------------------- RESTYLE-04
if (want('04')) {
  console.log(`\n== RESTYLE-04: what is painted while the app's JavaScript has not arrived yet (${KIND})`);
  const stored = (mode) => JSON.stringify({ state: { mode }, version: 0 });
  const cases = [
    ['saved light, PC dark', stored('light'), 'dark', 'light'],
    ['saved dark, PC light', stored('dark'), 'light', 'dark'],
    ['saved system, PC dark', stored('system'), 'dark', 'dark'],
    ['saved system, PC light', stored('system'), 'light', 'light'],
    ['nothing saved, PC dark', null, 'dark', 'dark'],
    ['saved "invalid", PC light', stored('invalid'), 'light', 'light'],
    ['broken JSON, PC dark', '{"state":', 'dark', 'dark'],
  ];
  const GROUND = { light: 'rgb(233, 237, 242)', dark: 'rgb(14, 17, 21)' };
  for (const [name, raw, os, expectTheme] of cases) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: os });
    if (raw !== null) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, raw]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 110)));
    // hold the app's entry script so the page stays in its "HTML only" state
    let release;
    const held = new Promise((res) => { release = res; });
    const entry = KIND === 'dev' ? '**/src/main.tsx*' : '**/assets/index-*.js';
    let heldCount = 0;
    await page.route(entry, async (route) => {
      heldCount += 1;
      await held;
      await route.continue();
    });
    await page.goto(`${BASE}/login`, { waitUntil: 'commit' });
    await page.waitForTimeout(900);
    const read = () => page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      html: getComputedStyle(document.documentElement).backgroundColor,
      scheme: getComputedStyle(document.documentElement).colorScheme,
      root: document.getElementById('root')?.childElementCount ?? -1,
    }));
    const before = await read();
    const cdp = await ctx.newCDPSession(page);
    const png = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data;
    const file = `04-${KIND}-${name.replace(/[^a-z]+/gi, '-')}.png`;
    writeFileSync(join(OUT, file), Buffer.from(png, 'base64'));
    release();
    const mounted = await page.waitForSelector('input[autocomplete="email"]', { timeout: 12000 }).then(() => true, () => false);
    await page.waitForTimeout(300);
    const after = await read();
    const afterBody = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const ok = heldCount > 0 && before.root === 0 && before.theme === expectTheme && before.html === GROUND[expectTheme]
      && mounted && after.theme === expectTheme && afterBody === GROUND[expectTheme] && errors.length === 0;
    line(ok, `${name.padEnd(26)} BEFORE app script: data-theme=${before.theme} html bg=${before.html} color-scheme=${before.scheme} (app mounted: ${before.root > 0}) | AFTER: sign-in shown=${mounted} data-theme=${after.theme} body=${afterBody} pageerrors=${errors.length} [${file}]`);
    await ctx.close();
  }
}

// ---------------------------------------------------------------- RESTYLE-03
if (want('03')) {
  console.log(`\n== RESTYLE-03: a toast that is already open, while the theme is switched (${KIND})`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 110)));
  await page.goto(`${BASE}/login`);
  await page.fill('input[autocomplete="email"]', process.env.SHOT_EMAIL);
  await page.fill('input[autocomplete="current-password"]', process.env.SHOT_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  // the app's own antd module (same instance the pages call message.* on), found among the loaded scripts
  const opened = await page.evaluate(async () => {
    const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\.js(\?|$)/.test(n));
    for (const url of urls) {
      try {
        const mod = await import(/* @vite-ignore */ url);
        const candidates = [mod.message, ...Object.values(mod).map((v) => v)];
        for (const c of candidates) {
          if (c && typeof c.success === 'function' && typeof c.open === 'function' && typeof c.destroy === 'function' && typeof c.useMessage === 'function') {
            c.success({ content: 'toast probe 토스트 확인', duration: 0 });
            return url.split('/').pop().slice(0, 60);
          }
        }
      } catch { /* not importable as a module: skip */ }
    }
    return null;
  });
  await page.waitForSelector('.ant-message-notice-content', { timeout: 8000 });
  const read = async (label) => {
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const el = document.querySelector('.ant-message-notice-content');
      const c = getComputedStyle(el);
      return { fg: c.color, bg: c.backgroundColor, theme: document.documentElement.getAttribute('data-theme'), n: document.querySelectorAll('.ant-message-notice-content').length };
    });
    await page.screenshot({ path: join(OUT, `03-${KIND}-${label}.png`) });
    return r;
  };
  const seg = (i) => page.locator('.app-sidefoot .ant-segmented-item').nth(i);
  const EXPECT = { light: ['rgb(28, 34, 48)', 'rgb(255, 255, 255)'], dark: ['rgb(227, 231, 237)', 'rgb(23, 27, 33)'] };
  console.log(`   opened through the app's antd module: ${opened}`);
  const steps = [['light (start)', null, 'light'], ['-> dark', 1, 'dark'], ['-> light', 0, 'light'], ['-> dark again', 1, 'dark'], ['-> system (PC light)', 2, 'light']];
  for (const [label, click, expectTheme] of steps) {
    if (click !== null) await seg(click).click();
    const r = await read(label.replace(/[^a-z]+/gi, '-'));
    const ok = r.theme === expectTheme && r.fg === EXPECT[expectTheme][0] && r.bg === EXPECT[expectTheme][1] && r.n === 1;
    line(ok, `${label.padEnd(22)} page theme=${r.theme} toast text=${r.fg} toast ground=${r.bg} (open toasts: ${r.n})`);
  }
  // language: the same holder also carries the antd locale; the toast must survive a language switch
  await page.locator('.app-top .ant-segmented-item', { hasText: 'VI' }).first().click();
  const r = await read('after-language-switch');
  line(r.n === 1, `after KO -> VI             toast still open: ${r.n === 1}, text=${r.fg}`);
  line(errors.length === 0, `page errors during the run: ${errors.length}${errors.length ? ` (${errors[0]})` : ''}`);
  await ctx.close();
}

await browser.close();
console.log(`\nfailed checks: ${failures}`);
process.exit(failures ? 1 : 0);
