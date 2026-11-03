// Production-export regressions. All providers and RPC replies below are test fixtures;
// this script uses no wallet keys, real balances, or external network requests.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.argv.find(a => a.startsWith('--playwright-module='))?.slice('--playwright-module='.length);
const { chromium, webkit } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const baseline = process.argv.includes('--baseline');
const out = `test/scratch/wallet-${baseline ? 'baseline' : 'regressions'}`;
await mkdir(out, { recursive: true });
const root = resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://preview').pathname);
    assert(path.startsWith('/preview/'));
    const file = resolve(root, path.slice(9) || 'index.html');
    assert(file.startsWith(root + '/') && (await stat(file)).isFile());
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const C = '0x3333333333333333333333333333333333333333';
const results = [], measurements = [], errors = [], limitations = [];
const browsers = [];
const check = async (name, fn) => {
  try { await fn(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); if (!baseline) process.exitCode = 1; }
};

function installWallet({ name, rdns, chainId, account }) {
  const listeners = {};
  let connected = false;
  const emit = (event, data) => (listeners[event] || []).forEach(fn => fn(data));
  window.__walletTest = {
    calls: [],
    changeAccount(address) { account = address; emit('accountsChanged', [address]); },
    changeChain(id) { chainId = id; emit('chainChanged', id); },
  };
  const provider = {
    async request({ method }) {
      window.__walletTest.calls.push(method);
      if (method === 'eth_chainId') return chainId;
      if (method === 'eth_requestAccounts') { connected = true; return [account]; }
      if (method === 'eth_accounts') return connected ? [account] : [];
      if (method === 'wallet_switchEthereumChain') { chainId = '0xaa36a7'; emit('chainChanged', chainId); return null; }
      if (method === 'wallet_revokePermissions') { connected = false; return null; }
      throw new Error(`Unexpected wallet method: ${method}`);
    },
    on(event, fn) { (listeners[event] ||= []).push(fn); },
    removeListener(event, fn) { listeners[event] = (listeners[event] || []).filter(f => f !== fn); },
  };
  const info = { uuid: '11111111-1111-4111-8111-111111111111', name, rdns, icon: '' };
  window.addEventListener('eip6963:requestProvider', () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info, provider } })));
}

async function fixture(page, options = {}) {
  page.setDefaultTimeout(5000);
  let block = 1000;
  const held = new Set(), pending = [];
  const values = new Map([[A, [1n, 10n]], [B, [2n, 20n]], [C, [3n, 30n]]]);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('503')) errors.push(m.text()); });
  page.on('response', r => { if (r.url().startsWith(url) && r.status() >= 400) errors.push(`Local HTTP ${r.status()}: ${r.url()}`); });
  await page.addInitScript(installWallet, { name: 'MetaMask', rdns: 'io.metamask', chainId: '0xaa36a7', account: A, ...options });
  await page.route('**/*', async route => {
    const request = route.request();
    if (request.url().startsWith(url)) return route.continue();
    if (request.method() !== 'POST') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Test-only unavailable API"}' });
    const { method, params, id } = request.postDataJSON();
    const reply = result => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id, result }) });
    if (method === 'eth_getBlockByNumber') return reply({ number: '0x' + block.toString(16), timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16), hash: '0x' + 'ab'.repeat(32), gasUsed: '0x1', gasLimit: '0x1c9c380', baseFeePerGas: '0x1', transactions: [] });
    const isEth = method === 'eth_getBalance';
    const isTokenBalance = method === 'eth_call' && params[0].data.startsWith('0x70a08231');
    if (isEth || isTokenBalance) {
      const address = (isEth ? params[0] : '0x' + params[0].data.slice(-40)).toLowerCase();
      const amount = values.get(address)?.[isEth ? 0 : 1] ?? 0n;
      if (held.has(address)) await new Promise(release => pending.push({ address, release }));
      return reply('0x' + (amount * 10n ** 18n).toString(16));
    }
    if (method === 'eth_call') {
      const data = params[0].data;
      if (data === '0x06fdde03') return reply('0x' + Buffer.from('Squeek').toString('hex').padEnd(64, '0'));
      if (data === '0x95d89b41') return reply('0x' + Buffer.from('SQK').toString('hex').padEnd(64, '0'));
      if (data === '0x313ce567') return reply('0x12');
      if (data === '0x18160ddd') return reply('0x' + (1000n * 10n ** 18n).toString(16));
    }
    throw new Error(`Unexpected test RPC: ${method}`);
  });
  return {
    hold(address) { held.add(address); },
    release(address) { held.delete(address); for (const entry of pending.splice(0).filter(entry => { if (entry.address === address) { entry.release(); return false; } return true; })) pending.push(entry); },
    pending(address) { return pending.filter(p => p.address === address).length; },
    nextBlock() { block++; },
  };
}

async function connect(page, name = 'MetaMask') {
  await page.locator('#wallet-button').click();
  await page.getByRole('button', { name: `${name} Detected`, exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#wallet-dialog').open === false);
}
async function amounts(page, address, eth, sqk) {
  await page.waitForFunction(({ address, eth, sqk }) => document.querySelector('#w3-address').textContent === address && document.querySelector('#w3-eth').textContent === eth && document.querySelector('#w3-sqk').textContent === sqk, { address, eth, sqk });
}
async function loadingAmounts(page) {
  assert.deepEqual(await page.locator('#w3-eth, #w3-sqk').allTextContents(), ['Loading', 'Loading']);
}
async function balanceReplies(page, address) {
  return Promise.all(['eth_getBalance', 'eth_call'].map(method => page.waitForResponse(response => {
    const request = response.request();
    if (request.method() !== 'POST') return false;
    const body = request.postDataJSON();
    return body.method === method && (method === 'eth_getBalance'
      ? body.params[0].toLowerCase() === address
      : body.params[0].data === '0x70a08231' + address.slice(2).padStart(64, '0'));
  }).then(response => response.finished())));
}
async function bounds(page) {
  return page.evaluate(() => {
    const box = selector => {
      const el = document.querySelector(selector), r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, scrollWidth: el.scrollWidth };
    };
    const span = document.querySelector('.wordmark > span');
    const range = document.createRange(); range.selectNodeContents(span);
    return { viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth,
      logo: box('.wordmark'), logoText: { display: getComputedStyle(span).display, right: range.getBoundingClientRect().right },
      sound: box('#sound'), help: box('#help'), wallet: box('#wallet-button'), game: box('#game'), start: box('#start') };
  });
}
function fits(b, label) {
  assert(b.content <= b.viewport, `${label}: scrollWidth ${b.content} exceeds ${b.viewport}`);
  for (const key of ['sound', 'help', 'wallet']) {
    assert(b[key].left >= 0 && b[key].right <= b.viewport, `${label}: ${key} outside viewport`);
    assert(b[key].width >= 44 && b[key].height >= 44, `${label}: ${key} target smaller than 44px`);
  }
  assert(b.logo.right <= b.sound.left, `${label}: logo and sound overlap`);
  if (b.logoText.display !== 'none') assert(b.logoText.right <= b.sound.left, `${label}: logo text and sound overlap`);
  assert(b.sound.right <= b.help.left && b.help.right <= b.wallet.left, `${label}: controls overlap`);
}

try {
  const browser = await chromium.launch({ headless: true }); browsers.push(browser);
  const page = await browser.newPage({ viewport: { width: 561, height: 900 } });
  await fixture(page, { chainId: '0x1' });
  await page.goto(url); await page.evaluate(() => document.fonts.ready);
  const widths = baseline ? [375, 561, 600, 640] : [320, 360, 375, 390, 400, 401, 560, 561, 600, 640, 760, 761, 768, 1024, 1440];
  for (const state of ['disconnected', 'wrong-network', 'connected']) {
    if (state === 'wrong-network') await connect(page);
    if (state === 'connected') { await page.locator('#wallet-button').click(); await page.waitForFunction(() => document.querySelector('#wallet-button').dataset.state === 'connected'); }
    for (const width of widths) {
      await page.setViewportSize({ width, height: width <= 400 ? 844 : 900 });
      const b = await bounds(page); measurements.push({ state, width, ...b });
      await check(`${state} header fits at ${width}px`, async () => fits(b, `${state} ${width}px`));
      if (state === 'wrong-network' && [375, 561].includes(width) || state === 'disconnected' && [390, 600, 1440].includes(width)) await page.screenshot({ path: `${out}/${state}-${width}.png` });
      if (width === 390 && state === 'disconnected') await check('390px product and Start Game remain on the first screen', async () => assert(b.game.top >= 0 && b.start.bottom <= 844));
    }
  }
  if (!baseline) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await check('connected header reflows with 200% text at 390px', async () => fits(await bounds(page), '200% text'));
  }
  await page.close();

  const walletPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const rpc = await fixture(walletPage);
  await walletPage.clock.install();
  await walletPage.goto(url); await walletPage.evaluate(() => document.fonts.ready);
  await connect(walletPage); await amounts(walletPage, A, '1 ETH', '10 SQK');
  rpc.hold(B);
  await walletPage.evaluate(address => window.__walletTest.changeAccount(address), B);
  await walletPage.waitForFunction(address => document.querySelector('#w3-address').textContent === address, B);
  const pendingState = await walletPage.locator('#w3-wallet-list').innerText();
  measurements.push({ state: 'account-B-pending', text: pendingState });
  await walletPage.screenshot({ path: `${out}/account-B-pending.png`, fullPage: true });
  await check('account changes immediately clear both previous balances', async () => {
    await loadingAmounts(walletPage);
    await walletPage.clock.runFor(1000);
    await loadingAmounts(walletPage);
  });
  rpc.release(B);
  await check('new balances appear under their own account after replies arrive', async () => amounts(walletPage, B, '2 ETH', '20 SQK'));

  if (!baseline) {
    await check('same-account block refresh retains its balances while pending', async () => {
      rpc.hold(B); rpc.nextBlock();
      await walletPage.clock.runFor(12_000);
      await walletPage.waitForFunction(() => document.querySelector('#w3-block-number').textContent === '#1,001');
      await amounts(walletPage, B, '2 ETH', '20 SQK');
      assert(rpc.pending(B) >= 2, 'balance refresh requests must be pending');
      rpc.release(B);
    });
    await check('late replies for a previous account cannot replace current balances', async () => {
      rpc.hold(A);
      await walletPage.evaluate(address => window.__walletTest.changeAccount(address), A);
      await amounts(walletPage, A, 'Loading', 'Loading');
      const deadline = Date.now() + 5000;
      while (rpc.pending(A) < 2 && Date.now() < deadline) await new Promise(r => setTimeout(r, 10));
      assert(rpc.pending(A) >= 2, 'previous account requests must be pending');
      await walletPage.evaluate(address => window.__walletTest.changeAccount(address), C);
      await amounts(walletPage, C, '3 ETH', '30 SQK');
      const oldReplies = balanceReplies(walletPage, A);
      rpc.release(A);
      await oldReplies;
      await walletPage.clock.runFor(32);
      await amounts(walletPage, C, '3 ETH', '30 SQK');
    });
    await check('disconnect and reconnect show Loading until the selected account replies', async () => {
      await walletPage.locator('#w3-disconnect').click();
      assert.equal(await walletPage.locator('#w3-wallet-list').isVisible(), false);
      rpc.hold(C); await connect(walletPage);
      await amounts(walletPage, C, 'Loading', 'Loading');
      rpc.release(C); await amounts(walletPage, C, '3 ETH', '30 SQK');
    });
    const okx = await browser.newPage({ viewport: { width: 375, height: 844 } });
    await fixture(okx, { name: 'OKX Wallet', rdns: 'com.okex.wallet', chainId: '0x1' });
    await okx.goto(url); await okx.evaluate(() => document.fonts.ready);
    await check('OKX connects, fits on the wrong chain, switches to Sepolia, and permits play', async () => {
      await connect(okx, 'OKX Wallet'); fits(await bounds(okx), 'OKX wrong chain');
      await okx.locator('#wallet-button').click(); await amounts(okx, A, '1 ETH', '10 SQK');
      assert.equal(await okx.locator('#w3-network').innerText(), 'Sepolia · chain 11155111');
      await okx.locator('#start').click(); await okx.locator('#mouse-target').click();
      assert.equal(await okx.locator('#score').innerText(), '1');
      const calls = await okx.evaluate(() => window.__walletTest.calls);
      assert(calls.includes('wallet_switchEthereumChain'));
      assert(!calls.some(method => /sign|sendTransaction/.test(method)));
    });
    await okx.close();
    let safari;
    try { safari = await webkit.launch({ headless: true }); }
    catch (e) { limitations.push(`WebKit unavailable: ${e.message.split('\n')[0]}`); }
    if (safari) {
      browsers.push(safari);
      const phone = await safari.newPage({ viewport: { width: 390, height: 844 } });
      const safariRpc = await fixture(phone, { chainId: '0x1' });
      await phone.goto(url); await phone.evaluate(() => document.fonts.ready);
      await check('WebKit guest play, wrong-network header, switch and pending account balances', async () => {
        fits(await bounds(phone), 'WebKit disconnected');
        await phone.locator('#start').click(); await phone.locator('#mouse-target').click();
        assert.equal(await phone.locator('#score').innerText(), '1');
        await connect(phone); fits(await bounds(phone), 'WebKit wrong-network');
        await phone.locator('#wallet-button').click(); await amounts(phone, A, '1 ETH', '10 SQK');
        safariRpc.hold(B); await phone.evaluate(address => window.__walletTest.changeAccount(address), B);
        await amounts(phone, B, 'Loading', 'Loading');
        safariRpc.release(B); await amounts(phone, B, '2 ETH', '20 SQK');
      });
      await phone.close();
    }
    await check('checked flows have no script errors or missing local assets', async () => assert.deepEqual(errors, []));
  }
  await walletPage.close();
} finally {
  await Promise.all(browsers.map(b => b.close()));
  await new Promise(r => server.close(r));
  await writeFile(`${out}/results.json`, JSON.stringify({ baseline, results, measurements, errors, limitations }, null, 2) + '\n');
  console.log(`${results.filter(r => r.passed).length} passed; ${results.filter(r => !r.passed).length} failed.`);
  for (const limit of limitations) console.log(`LIMITATION ${limit}`);
}
