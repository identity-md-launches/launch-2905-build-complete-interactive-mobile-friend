// Exercises the built export at an IPFS-style subpath; never imports app internals.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv.find(a => a.startsWith('--playwright-module='))?.split('=').slice(1).join('=');
const { chromium, webkit } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const root = resolve('dist');
const out = 'test/scratch/browser-validation';
await mkdir(out, { recursive: true });
const results = [];
const limits = [];
const resources = [];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://preview').pathname);
    if (!pathname.startsWith('/preview/')) throw new Error('Outside export');
    const file = resolve(root, pathname.slice(9) || 'index.html');
    if (!file.startsWith(root + '/') || !(await stat(file)).isFile()) throw new Error('Missing asset');
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const check = async (name, fn) => { await fn(); results.push({ name, passed: true }); process.stdout.write(`PASS ${name}\n`); };
const text = (page, selector) => page.locator(selector).innerText();
const phase = page => page.locator('#game').getAttribute('data-phase');
const storageKey = 'squeek-clicker:v1';
const browsers = [];

function monitor(page) {
  page.on('pageerror', error => resources.push(`script: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') resources.push(`console: ${message.text()}`); });
  page.on('requestfailed', request => resources.push(`request failed: ${new URL(request.url()).pathname}`));
  page.on('response', response => { if (response.status() >= 400) resources.push(`HTTP ${response.status()}: ${new URL(response.url()).pathname}`); });
}
async function load(page) {
  monitor(page);
  await page.clock.install({ time: new Date('2026-11-01T12:00:00Z') });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(new Date('2026-11-01T12:01:00Z'));
}

try {
  const browser = await chromium.launch({ headless: true }); browsers.push(browser);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await context.newPage(); await load(page);

  await check('390px first screen contains mascot and Start Game; fonts and relative assets load', async () => {
    assert.equal(await phase(page), 'welcome');
    const start = page.getByRole('button', { name: 'Start Game', exact: true });
    assert.equal(await start.count(), 1);
    const bounds = await start.boundingBox(); assert(bounds.y >= 0 && bounds.y + bounds.height <= 844);
    assert.equal(await page.locator('.welcome-mascot').evaluate(image => image.complete && image.naturalWidth > 0), true);
    assert.equal(await page.evaluate(() => [...document.fonts].every(f => f.status === 'loaded')), true);
    await page.screenshot({ path: `${out}/390-welcome.png`, scale: 'css' });
  });
  await check('touch play, 1× to 5× scoring, feedback, and idle combo decay', async () => {
    await page.getByRole('button', { name: 'Start Game', exact: true }).tap();
    assert.equal(await phase(page), 'playing');
    for (let i = 0; i < 20; i++) { await page.locator('#mouse-target').tap(); await page.clock.runFor(80); }
    assert.equal(await text(page, '#score'), '54');
    assert.equal(await page.locator('#combo-levels').getAttribute('aria-valuenow'), '5');
    assert.match(await text(page, '#last-award'), /5 points/);
    assert(await page.locator('.score-float').count() > 0);
    assert.equal(await page.evaluate(() => scrollY), 0, 'Rapid taps must keep the playfield in place');
    await page.screenshot({ path: `${out}/390-playing.png`, scale: 'css' });
    await page.clock.runFor(601);
    assert.equal(await page.locator('#combo-levels').getAttribute('aria-valuenow'), '1');
    assert.equal(await text(page, '#score'), '54');
  });
  await check('deadline ends round once, saves best, and locks scoring', async () => {
    await page.clock.fastForward(60_000);
    assert.equal(await phase(page), 'over');
    assert.equal(await text(page, '#result-score'), '54');
    assert.equal(await text(page, '#result-taps'), '20');
    assert.equal(await text(page, '#result-combo'), '5×');
    assert.equal(await text(page, '#best'), '54');
    assert.equal(await page.locator('.score-row').count(), 1);
    await page.evaluate(() => document.querySelector('#mouse-target').click());
    assert.equal(await text(page, '#score'), '54');
    assert.equal(await page.locator('.score-row').count(), 1);
    await page.screenshot({ path: `${out}/390-result.png`, scale: 'css' });
  });
  await check('replay, local high/recent sorting, and saved scores survive reload', async () => {
    await page.getByRole('button', { name: 'Play Again', exact: true }).tap();
    await page.locator('#mouse-target').tap();
    await page.clock.fastForward(60_001);
    assert.equal(await text(page, '#result-score'), '1');
    assert.equal(await text(page, '#best'), '54');
    assert.match(await text(page, '.score-row:first-child .row-points'), /^54\b/);
    await page.locator('#sort-recent').tap();
    assert.match(await text(page, '.score-row:first-child .row-points'), /^1\b/);
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    assert.equal(await text(page, '#best'), '54');
    assert.equal(await page.locator('.score-row').count(), 2);
  });
  await check('keyboard activation counts once; reset confirmation cancels or discards only the round', async () => {
    await page.locator('#start').tap();
    await page.keyboard.down('Space'); await page.keyboard.down('Space'); await page.keyboard.up('Space');
    assert.equal(await text(page, '#score'), '1');
    await page.keyboard.press('Enter'); assert.equal(await text(page, '#score'), '2');
    await page.locator('#reset').tap();
    assert.equal(await page.locator('#confirm-dialog').evaluate(d => d.open), true);
    await page.keyboard.press('Escape');
    await page.clock.runFor(32);
    assert.equal(await phase(page), 'playing');
    assert.equal(await text(page, '#score'), '2');
    await page.locator('#reset').tap();
    await page.getByRole('button', { name: 'Reset round', exact: true }).tap();
    await page.clock.runFor(32);
    assert.equal(await phase(page), 'welcome');
    assert.equal(await text(page, '#score'), '0');
    assert.equal(await text(page, '#timer'), '60s');
    assert.equal(await text(page, '#best'), '54');
    assert.equal(await page.locator('.score-row').count(), 2);
    assert.equal(await page.locator('#start').evaluate(e => document.activeElement === e), true);
  });
  await check('help traps focus, Escape restores it, and timer continues while dialog is open', async () => {
    await page.locator('#start').tap(); await page.locator('#help').tap();
    assert.equal(await page.locator('#help-dialog').evaluate(d => d.open), true);
    for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('#help-dialog')), true);
    await page.clock.fastForward(10_000);
    assert.equal(await text(page, '#timer'), '50s');
    await page.keyboard.press('Escape');
    await page.clock.runFor(32);
    assert.equal(await page.locator('#help').evaluate(e => document.activeElement === e), true);
    await page.clock.fastForward(50_000);
    assert.equal(await phase(page), 'over');
  });
  await check('clear-scores confirmation preserves on cancel and removes best/history on confirm', async () => {
    await page.locator('#clear').tap(); await page.getByRole('button', { name: 'Cancel', exact: true }).tap(); await page.clock.runFor(32);
    assert.equal(await text(page, '#best'), '54');
    await page.locator('#clear').tap(); await page.getByRole('button', { name: 'Clear scores', exact: true }).tap(); await page.clock.runFor(32);
    assert.equal(await text(page, '#best'), '0');
    assert.equal(await page.locator('#empty-scores').isVisible(), true);
    assert.equal(await page.locator('.score-row').count(), 0);
    const data = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
    assert.equal(data.best, 0); assert.equal(data.rounds.length, 0);
  });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 } }); await load(desktop);
  await check('desktop keyboard flow, visible focus, help close, and sound toggle', async () => {
    await desktop.keyboard.press('Tab'); assert.equal(await desktop.locator('.skip-link').evaluate(e => e === document.activeElement), true);
    await desktop.keyboard.press('Enter');
    assert.equal(await desktop.locator('#game').evaluate(e => e === document.activeElement), true);
    await desktop.keyboard.press('Tab');
    assert.equal(await desktop.locator('#start').evaluate(e => e === document.activeElement), true);
    assert.equal(await desktop.locator('#start').evaluate(e => getComputedStyle(e).outlineWidth), '2px');
    await desktop.screenshot({ path: `${out}/1440-focus.png`, scale: 'css' });
    await desktop.keyboard.press('Enter'); await desktop.keyboard.press('Space');
    assert.equal(await text(desktop, '#score'), '1');
    await desktop.locator('#sound').click(); assert.equal(await desktop.locator('#sound').getAttribute('aria-pressed'), 'true');
    await desktop.locator('#sound').click(); assert.equal(await desktop.locator('#sound').getAttribute('aria-pressed'), 'false');
  });
  await check('responsive export has no overflow at 320, 390, 768, 1024, and 1440 pixels', async () => {
    await desktop.reload();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await desktop.setViewportSize({ width, height: 900 });
      const dimensions = await desktop.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      assert(dimensions.content <= dimensions.viewport + 1, `Overflow at ${width}`);
      await desktop.screenshot({ path: `${out}/${width}-layout.png`, fullPage: true, scale: 'css' });
    }
    const share = await desktop.request.get(new URL('assets/share.png', url).href);
    assert.equal(share.status(), 200); assert.equal(share.headers()['content-type'], 'image/png');
  });
  await check('200% text enlargement reflows without horizontal overflow', async () => {
    await desktop.setViewportSize({ width: 390, height: 844 });
    await desktop.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const dimensions = await desktop.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    assert(dimensions.content <= dimensions.viewport + 1, 'Overflow with enlarged text');
    await desktop.screenshot({ path: `${out}/390-text-200.png`, fullPage: true, scale: 'css' });
  });

  const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); await load(reduced);
  await check('reduced motion keeps scoring feedback and disables moving effects', async () => {
    await reduced.locator('#start').click(); await reduced.locator('#mouse-target').click();
    assert.equal(await text(reduced, '#score'), '1');
    assert.equal(await reduced.locator('.score-float').evaluate(e => getComputedStyle(e).animationName), 'none');
    assert.equal(await reduced.locator('#mouse-target .mascot').evaluate(e => e.getAnimations().length), 0);
    await reduced.screenshot({ path: `${out}/390-reduced-motion.png`, scale: 'css' });
  });
  const blocked = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Unavailable', 'SecurityError'); } })); await load(blocked);
  await check('unavailable storage still allows a full round with an honest warning', async () => {
    assert.equal(await blocked.locator('#storage-warning').isVisible(), true);
    await blocked.locator('#start').click(); await blocked.locator('#mouse-target').click(); await blocked.clock.fastForward(60_001);
    assert.equal(await phase(blocked), 'over');
    assert.equal(await text(blocked, '#best'), '1');
    assert.match(await text(blocked, '#result-save'), /visit only/);
  });
  const corrupt = await browser.newPage();
  await corrupt.addInitScript(key => localStorage.setItem(key, '{not-json'), storageKey); await load(corrupt);
  await check('corrupt stored data recovers to a playable empty state', async () => {
    assert.equal(await text(corrupt, '#best'), '0');
    assert.equal(await corrupt.locator('#empty-scores').isVisible(), true);
    await corrupt.locator('#start').click(); await corrupt.locator('#mouse-target').click();
    assert.equal(await text(corrupt, '#score'), '1');
  });

  // Run the primary path in WebKit when its browser runtime is available.
  let safari;
  try { safari = await webkit.launch({ headless: true }); }
  catch { limits.push('WebKit could not launch; Safari/iOS runtime validation remains unperformed.'); }
  if (safari) {
    browsers.push(safari);
    const phone = await safari.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); await load(phone);
    await check('WebKit mobile primary flow', async () => {
      await phone.locator('#start').tap(); await phone.locator('#mouse-target').tap(); await phone.clock.fastForward(60_001);
      assert.equal(await phase(phone), 'over'); assert.equal(await text(phone, '#result-score'), '1');
      await phone.locator('#again').tap(); assert.equal(await phase(phone), 'playing');
    });
  }
  await check('no console errors, missing assets, or failed requests in checked flows', async () => assert.deepEqual(resources, []));
} catch (error) {
  results.push({ name: 'browser validation', passed: false, error: error.message.split('\n')[0] });
  process.exitCode = 1;
  process.stderr.write(`${error.stack}\n`);
} finally {
  await Promise.all(browsers.map(browser => browser.close()));
  await new Promise(r => server.close(r));
  const report = { results, limitations: limits, resourceErrors: resources };
  await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`${results.filter(r => r.passed).length} checks passed; ${results.filter(r => !r.passed).length} failed.\n`);
  for (const limit of limits) process.stdout.write(`LIMITATION ${limit}\n`);
}
