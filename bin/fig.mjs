#!/usr/bin/env node
/**
 * figkit <file.html> [--out file.png]   render a figure to a PNG, with a phone layout when it has sides, a phone-inline preview and a list of problems
 * figkit <chart.json> [--out file.png]  check a chart spec and render it the same way
 * figkit guide                          print the guide for writing figures
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { ensureBuilt } from '../viz/build.mjs';
import { parseSpec } from '../viz/spec.js';

const HOME = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = (...p) => pathToFileURL(path.join(HOME, ...p)).href;
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
  console.log('Usage:\n  figkit <file.html> [--out file.png]   render, check and preview a figure\n  figkit <chart.json> [--out file.png]  the same for a chart from a spec\n  figkit guide                          how to write one');
  process.exit(0);
}
if (args[0] === 'guide') {
  process.stdout.write(fs.readFileSync(path.join(HOME, 'GUIDE.md'), 'utf8'));
  process.exit(0);
}

let src, out;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') out = args[++i];
  else src = args[i];
}
src = path.resolve(src);
if (!fs.existsSync(src)) { console.error(`figkit: no file at ${src}`); process.exit(1); }
let body = fs.readFileSync(src, 'utf8');
if (/\.json$/i.test(src)) {
  const spec = parseSpec(body);
  if (!spec.ok) {
    console.log(`This chart spec has ${spec.problems.length} problem${spec.problems.length === 1 ? '' : 's'}:\n${spec.problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  body = `<main class="fig chart"><script type="application/json" id="figkit-spec">${JSON.stringify(spec.spec).replace(/</g, '\\u003c')}</script></main>`;
} else if (!/class="[^"]*\bfig\b/.test(body)) body = `<main class="fig">\n${body}\n</main>`;
await ensureBuilt();

const fonts = ['newsreader/400.css', 'newsreader/400-italic.css', 'geist-sans/400.css', 'geist-sans/500.css', 'geist-sans/600.css', 'geist-mono/400.css', 'geist-mono/500.css']
  .map((f) => `<link rel="stylesheet" href="${url('node_modules/@fontsource', f)}">`).join('\n');
const page_html = `<!doctype html><html><head><meta charset="utf-8">
<base href="${pathToFileURL(path.dirname(src) + path.sep).href}">
${fonts}
<link rel="stylesheet" href="${url('runtime/fig.css')}">
<script src="${url('node_modules/d3/dist/d3.min.js')}"></script>
<script src="${url('node_modules/@observablehq/plot/dist/plot.umd.min.js')}"></script>
<script src="${url('dist/viz.iife.js')}"></script>
<script src="${url('runtime/fig.js')}"></script>
<style>body { display: inline-block; }</style>
</head><body>
${body}
</body></html>`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figkit-'));
const base = path.basename(src).replace(/\.[^.]+$/, '');
const png = path.resolve(out ?? path.join(dir, `${base}.png`));
const stem = png.replace(/\.png$/i, '');
// The phone layout, written only for a figure with sides, for a viewer to show on a narrow screen. The inline preview
// is for looking at, and has a different name so no viewer mistakes it for a layout.
const phonePng = stem + '.phone.png', inline = stem + '-inline.png';
const wrapped = path.join(dir, `${base}.page.html`);
fs.writeFileSync(wrapped, page_html);

/** Playwright's own Chromium if installed, else any headless shell Playwright has downloaded, else Chrome or Edge. */
async function launch() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || { darwin: path.join(os.homedir(), 'Library/Caches/ms-playwright'),
    win32: path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright') }[process.platform] || path.join(os.homedir(), '.cache/ms-playwright');
  const ls = (d) => (fs.existsSync(d) ? fs.readdirSync(d) : []);
  const shells = ls(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()
    .flatMap((d) => ls(path.join(cache, d)).map((sub) => path.join(cache, d, sub, process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell')));
  const tries = [{}, ...shells.map((executablePath) => ({ executablePath })), { channel: 'chrome' }, { channel: 'msedge' }];
  for (const opt of tries) {
    if (opt.executablePath && !fs.existsSync(opt.executablePath)) continue;
    try { return await chromium.launch(opt); } catch { /* try the next browser */ }
  }
  console.error('figkit: no browser found. Install Chrome, or run: npx playwright install chromium');
  process.exit(1);
}

const browser = await launch();
try {
  async function render(phone, shot) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (phone) await page.addInitScript(() => { window.__figPhone = true; });
    await page.goto(pathToFileURL(wrapped).href);
    await page.waitForFunction('window.__figDone === true', null, { timeout: 30000 });
    const r = await page.evaluate(() => ({ problems: window.fig.problems, info: window.fig.info, sides: !!document.querySelector('.fig .sides') }));
    await page.locator('.fig').first().screenshot({ path: shot });
    await page.close();
    return { ...r, problems: [...errors.map((e) => `Script error: ${e}`), ...r.problems] };
  }
  const desk = await render(false, png);
  const mob = desk.sides ? await render(true, phonePng) : null;
  if (!mob) fs.rmSync(phonePng, { force: true });
  const small = await browser.newPage({ viewport: { width: 358, height: 400 }, deviceScaleFactor: 2 });
  await small.setContent(`<body style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(mob ? phonePng : png).toString('base64')}" style="width:358px;display:block"></body>`);
  await small.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
  await small.locator('img').screenshot({ path: inline });

  const { info } = desk;
  const lines = [`Figure:       ${png}  (${info.width * 2}×${info.height * 2})`];
  if (mob) lines.push(`Phone layout: ${phonePng}  (${mob.info.width * 2}×${mob.info.height * 2}), the sides stacked, for a viewer to show on a phone`);
  lines.push(`Phone inline: ${inline}  (preview only)`);
  const ph = (mob ?? desk).info.phone;
  const sizes = [['the title', ph?.title], ['headings', ph?.heading], ['body', ph?.body]].filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}px`);
  if (sizes.length) lines.push(`Inline on a phone: ${sizes.join(', ')}; under about 6px only reads after a tap to zoom.`);
  if (!mob && info.unmarked) lines.push('Its columns sit side by side and will shrink on a phone. If they are two sides to compare, add class "sides" to the row or grid that holds them, and a stacked phone layout is drawn too.');
  const all = [...desk.problems, ...(mob?.problems ?? []).map((p) => `Phone layout: ${p}`)];
  lines.push(all.length ? `\n${all.length} problem${all.length === 1 ? '' : 's'}:` : '\nNo problems found by the checks.');
  for (const p of all) lines.push(`  - ${p}`);
  lines.push('', `The checks cannot see whether it is clear. Open the figure${mob ? ', the phone layout' : ''} and the inline preview and look as a reader would, then embed the figure: ![what it shows](path).`);
  console.log(lines.join('\n'));
} finally {
  await browser.close();
}
