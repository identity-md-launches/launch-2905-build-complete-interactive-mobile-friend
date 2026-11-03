import {
  chainName, collectAddresses, decodeAbiString, encodeAddressArg, formatUnits, hexToBigInt,
  parseWheelStatus, relativeTime, shortAddress, shortHash, type WheelStatus,
} from './chain-utils';
import { SEPOLIA, SQUEEKCHAIN_CONTRACTS, SQUEEKCHAIN_SITE } from './config';
import { GET_WALLET, OPEN_IN, isMobileBrowser } from './open-in';
import { ethCall, latestBlock, sepoliaRpc, squeekchainGet, type RawBlock } from './rpc';
import * as wallet from './wallet';

type Icon = (name: string, cls?: string) => string;
const BLOCK_MS = 12_000;
const WHEEL_MS = 15_000;
const number = new Intl.NumberFormat('en');
const clock = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const TOKEN = SQUEEKCHAIN_CONTRACTS.find(c => c.key === 'token')!;

export const walletButtonMarkup = (icon: Icon) => `<button class="wallet-button" id="wallet-button" type="button" aria-haspopup="dialog" data-state="disconnected">${icon('wallet')}<i class="w3-dot" aria-hidden="true"></i><span id="wallet-label">Connect<span class="label-long"> wallet</span></span></button>`;

const row = (label: string, id: string, extra = '') => `<div><dt>${label}</dt><dd id="${id}"${extra}>Loading</dd></div>`;

export const dashboardMarkup = (icon: Icon) => `
  <section class="web3" id="web3" aria-labelledby="web3-title" tabindex="-1">
    <div class="web3-head"><h2 id="web3-title">Web3 dashboard</h2><p class="section-description">Live reads from Ethereum Sepolia and Squeekchain. A wallet is optional, and nothing here asks you to sign.</p></div>
    <div class="web3-grid">
      <article class="w3-card" aria-labelledby="w3-wallet-title">
        <div class="section-title"><h3 id="w3-wallet-title">Wallet</h3>${icon('wallet')}</div>
        <p class="w3-status"><i class="w3-dot" id="w3-wallet-dot"></i><span id="w3-wallet-status">Not connected</span></p>
        <p class="w3-empty" id="w3-wallet-empty">Connect MetaMask or OKX Wallet to see your address, network and Sepolia balances. You can play without one.</p>
        <dl class="w3-list" id="w3-wallet-list" hidden>
          <div><dt>Wallet</dt><dd id="w3-wallet-name"></dd></div>
          <div><dt>Address</dt><dd class="w3-address"><span id="w3-address"></span><button class="utility w3-copy" id="w3-copy" type="button" aria-label="Copy address">${icon('copy')}</button></dd></div>
          <div><dt>Network</dt><dd id="w3-network"></dd></div>
          <div><dt>Sepolia ETH</dt><dd id="w3-eth">Loading</dd></div>
          <div><dt>SQK balance</dt><dd id="w3-sqk">Loading</dd></div>
        </dl>
        <div class="w3-actions"><button class="button primary w3-action" id="w3-wallet-action" type="button">Connect wallet</button><button class="button secondary" id="w3-disconnect" type="button" hidden>Disconnect</button></div>
        <p class="w3-note" id="w3-wallet-note" role="status"></p>
      </article>
      <article class="w3-card" aria-labelledby="w3-block-title" aria-busy="true" id="w3-block-card">
        <div class="section-title"><h3 id="w3-block-title">Latest Sepolia block</h3>${icon('cube')}</div>
        <p class="w3-big" id="w3-block-number">Loading</p>
        <dl class="w3-list">${row('Mined', 'w3-block-age')}${row('Transactions', 'w3-block-txs')}${row('Gas used', 'w3-block-gas')}${row('Base fee', 'w3-block-fee')}<div><dt>Hash</dt><dd><a id="w3-block-hash" class="w3-link" target="_blank" rel="noopener">Loading</a></dd></div></dl>
        <p class="w3-source" id="w3-block-source">From the public Sepolia RPC at publicnode.com, every 12 seconds.</p>
      </article>
      <article class="w3-card" aria-labelledby="w3-wheel-title" aria-busy="true" id="w3-wheel-card">
        <div class="section-title"><h3 id="w3-wheel-title">Squeekchain wheel</h3>${icon('wheel')}</div>
        <p class="w3-status"><i class="w3-dot" id="w3-wheel-dot"></i><span id="w3-wheel-status">Checking the official API</span></p>
        <dl class="w3-list" id="w3-wheel-list" hidden>${row('Speed', 'w3-wheel-rpm')}${row('Work units', 'w3-wheel-work')}<div><dt>Settled block</dt><dd><a id="w3-wheel-block" class="w3-link" target="_blank" rel="noopener"></a></dd></div>${row('Reading', 'w3-wheel-reading')}</dl>
        <p class="w3-empty" id="w3-wheel-empty" hidden>The Squeekchain API did not answer this browser, so no wheel reading is shown. It retries every 15 seconds.</p>
        <p class="w3-source">From the official API, <a class="w3-link" href="${SQUEEKCHAIN_SITE}" target="_blank" rel="noopener">squeekchain.com</a>.</p>
      </article>
      <article class="w3-card" aria-labelledby="w3-token-title" aria-busy="true" id="w3-token-card">
        <div class="section-title"><h3 id="w3-token-title">SQK on Sepolia</h3>${icon('coin')}</div>
        <p class="w3-big" id="w3-supply">Loading</p><p class="w3-caption" id="w3-supply-label">Total supply, read from the token contract</p>
        <ul class="w3-contracts" id="w3-contracts">${SQUEEKCHAIN_CONTRACTS.map(c => `<li data-key="${c.key}"><div class="w3-contract-head"><span>${c.label}</span><a class="w3-link" href="${SEPOLIA.explorer}/address/${c.address}" target="_blank" rel="noopener" aria-label="${c.label} ${c.address} on Etherscan">${shortAddress(c.address)}</a></div><p class="w3-caption">${c.verification.href ? `<a class="w3-link" href="${c.verification.href}" target="_blank" rel="noopener">${c.verification.label}</a>` : c.verification.label}<span class="w3-listed"></span></p></li>`).join('')}</ul>
        <p class="w3-source">Testnet tokens with no monetary value. Addresses as published by the Squeekchain API.</p>
      </article>
    </div>
  </section>`;

export const walletDialogMarkup = (icon: Icon) => `
  <dialog id="wallet-dialog" class="wallet-sheet" aria-labelledby="wallet-title">
    <div class="dialog-heading"><h2 id="wallet-title">Connect a wallet</h2><button class="utility" type="button" id="close-wallet" aria-label="Close">${icon('close')}</button></div>
    <p class="sheet-intro" id="wallet-intro">Optional. Your address and network are shown here. Nothing is signed or sent.</p>
    <div class="wallet-rows" id="wallet-rows"></div>
    <p class="w3-note" id="wallet-note" role="status"></p>
    <p class="sheet-foot">${icon('lock')}<span>Squeek Clicker never asks for a seed phrase or private key.</span></p>
  </dialog>`;

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing dashboard element: ${selector}`);
  return found;
}
const setText = (selector: string, text: string) => { el(selector).textContent = text; };

export function initWeb3(icon: Icon, announce: (text: string) => void): void {
  const dialog = el<HTMLDialogElement>('#wallet-dialog');
  const rows = el('#wallet-rows');
  const button = el<HTMLButtonElement>('#wallet-button');
  let lastBlock: { number: bigint; timestamp: number } | null = null;
  let wheel: WheelStatus | null = null;
  let tokenDecimals = 18;
  let tokenSymbol = 'SQK';
  let balancesFor = '';
  let wasConnected = false;

  // Rows -------------------------------------------------------------------------------------------
  const walletRow = (iconSrc: string, name: string, detail = '') => {
    const image = iconSrc ? `<img src="" width="28" height="28" alt="" />` : `<span class="ic-blank">${icon('wallet')}</span>`;
    return { html: `<span class="ic">${image}</span><span class="row-name"></span>${detail ? `<span class="row-detail">${detail}</span>` : ''}`, fill: (node: HTMLElement) => { node.querySelector<HTMLElement>('.row-name')!.textContent = name; const img = node.querySelector('img'); if (img) img.src = iconSrc; } };
  };

  function renderRows(): void {
    const state = wallet.getState();
    rows.replaceChildren();
    const found = wallet.wallets();
    if (isMobileBrowser() && !found.length) {
      el('#wallet-intro').textContent = 'Phones have no wallet extension. Open this page in your wallet app’s browser, then connect there.';
      for (const link of OPEN_IN) {
        const a = document.createElement('a');
        a.className = 'wallet-row'; a.href = link.href(location.href); a.rel = 'noopener';
        const r = walletRow(link.icon, `Open in ${link.name}`); a.innerHTML = r.html; r.fill(a);
        rows.append(a);
      }
      return;
    }
    el('#wallet-intro').textContent = 'Optional. Your address and network are shown here. Nothing is signed or sent.';
    for (const item of found) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'wallet-row'; b.dataset.uuid = item.info.uuid;
      const pending = state.pendingUuid === item.info.uuid;
      const r = walletRow(item.info.icon, item.info.name, pending ? 'Check your wallet' : 'Detected');
      b.innerHTML = r.html; r.fill(b);
      b.disabled = state.status === 'connecting' && !pending;
      if (pending) b.setAttribute('aria-busy', 'true');
      b.addEventListener('click', async () => {
        if (await wallet.connect(item.info.uuid)) { dialog.close(); announce(`Connected ${item.info.name}.`); }
      });
      rows.append(b);
    }
    for (const [rdns, get] of Object.entries(GET_WALLET)) {
      if (found.some(w => w.info.rdns === rdns)) continue;
      const a = document.createElement('a');
      a.className = 'wallet-row is-install'; a.href = get.href; a.target = '_blank'; a.rel = 'noopener';
      const r = walletRow(get.icon, get.name, `Install${icon('external')}`); a.innerHTML = r.html; r.fill(a);
      a.setAttribute('aria-label', `Install ${get.name} (opens a new tab)`);
      rows.append(a);
    }
  }

  // Header control, wallet card --------------------------------------------------------------------
  function renderWallet(): void {
    const state = wallet.getState();
    const connected = state.status === 'connected' && !!state.address;
    const onSepolia = wallet.isOnSepolia();
    const mode = connected ? (onSepolia ? 'connected' : 'wrong-network') : state.status;
    button.dataset.state = mode;
    const label = el('#wallet-label');
    if (connected) {
      label.textContent = onSepolia ? shortAddress(state.address!) : state.switching ? 'Switching…' : 'Switch to Sepolia';
      button.setAttribute('aria-label', onSepolia ? `Wallet ${state.address}, on Sepolia. Open wallet details` : 'Wrong network. Switch to Sepolia');
    } else {
      label.innerHTML = state.status === 'connecting' ? 'Connecting…' : 'Connect<span class="label-long"> wallet</span>';
      button.removeAttribute('aria-label');
    }
    el('#w3-wallet-dot').dataset.state = mode;
    setText('#w3-wallet-status', connected ? (onSepolia ? 'Connected to Sepolia' : `Connected to ${chainName(state.chainId ?? 0)}, not Sepolia`) : state.status === 'connecting' ? 'Waiting for your wallet' : 'Not connected');
    el('#w3-wallet-empty').hidden = connected;
    el('#w3-wallet-list').hidden = !connected;
    el('#w3-disconnect').hidden = !connected;
    const action = el<HTMLButtonElement>('#w3-wallet-action');
    action.hidden = connected && onSepolia;
    action.disabled = state.status === 'connecting' || state.switching;
    action.textContent = connected ? (state.switching ? 'Switching…' : 'Switch to Sepolia') : state.status === 'connecting' ? 'Connecting…' : 'Connect wallet';
    if (connected) {
      setText('#w3-wallet-name', state.wallet?.name ?? 'Wallet');
      setText('#w3-address', state.address!);
      setText('#w3-network', `${chainName(state.chainId ?? 0)} · chain ${state.chainId ?? 'unknown'}`);
      el('#w3-network').classList.toggle('is-warning', !onSepolia);
    }
    setText('#w3-wallet-note', state.note ?? '');
    setText('#wallet-note', state.note ?? '');
    if (dialog.open) renderRows();
    if (connected && balancesFor !== `${state.address}`) void readBalances();
    if (!connected) balancesFor = '';
    if (wasConnected && !connected) announce('Wallet disconnected. You can keep playing.');
    wasConnected = connected;
  }

  async function readBalances(): Promise<void> {
    const address = wallet.getState().address;
    if (!address) return;
    balancesFor = address;
    const [eth, sqk] = await Promise.allSettled([
      sepoliaRpc<string>('eth_getBalance', [address, 'latest']),
      ethCall(TOKEN.address, `0x70a08231${encodeAddressArg(address)}`),
    ]);
    if (wallet.getState().address !== address) return;
    setText('#w3-eth', eth.status === 'fulfilled' ? `${formatUnits(hexToBigInt(eth.value), 18)} ETH` : 'Unavailable right now');
    setText('#w3-sqk', sqk.status === 'fulfilled' ? `${formatUnits(hexToBigInt(sqk.value), tokenDecimals)} ${tokenSymbol}` : 'Unavailable right now');
  }

  function openDialog(): void {
    wallet.clearNote();
    renderRows();
    dialog.showModal();
    rows.querySelector<HTMLElement>('.wallet-row')?.focus();
  }
  button.addEventListener('click', () => {
    const state = wallet.getState();
    if (state.status === 'connected' && !wallet.isOnSepolia()) void wallet.switchToSepolia();
    else if (state.status === 'connected') {
      // Connected: the dashboard holds the details and Disconnect.
      el('#w3-wallet-title').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      el('#w3-disconnect').focus({ preventScroll: true });
    } else openDialog();
  });
  el('#w3-wallet-action').addEventListener('click', () => {
    if (wallet.getState().status === 'connected') void wallet.switchToSepolia(); else openDialog();
  });
  el('#w3-disconnect').addEventListener('click', () => { void wallet.disconnect(); el<HTMLButtonElement>('#w3-wallet-action').focus(); });
  el('#w3-copy').addEventListener('click', async () => {
    const address = wallet.getState().address;
    if (!address) return;
    try { await navigator.clipboard.writeText(address); setText('#w3-wallet-note', 'Address copied.'); }
    catch { setText('#w3-wallet-note', 'Copy is unavailable here. Select the address to copy it.'); }
  });
  el('#close-wallet').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { if (document.activeElement === document.body || !document.activeElement) button.focus({ preventScroll: true }); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')];
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });

  // Sepolia block ----------------------------------------------------------------------------------
  async function readBlock(): Promise<void> {
    try {
      const block: RawBlock = await latestBlock();
      const height = hexToBigInt(block.number);
      const isNew = !lastBlock || height !== lastBlock.number;
      lastBlock = { number: height, timestamp: Number(hexToBigInt(block.timestamp)) };
      setText('#w3-block-number', `#${number.format(height)}`);
      setText('#w3-block-txs', number.format(block.transactions.length));
      const used = hexToBigInt(block.gasUsed);
      const limit = hexToBigInt(block.gasLimit);
      setText('#w3-block-gas', `${limit ? (Number((used * 10000n) / limit) / 100).toFixed(1) : '0'}% of ${number.format(Number(limit / 1_000_000n))}M`);
      setText('#w3-block-fee', block.baseFeePerGas ? `${formatUnits(hexToBigInt(block.baseFeePerGas), 9, 3)} gwei` : 'None');
      const hash = el<HTMLAnchorElement>('#w3-block-hash');
      hash.textContent = shortHash(block.hash); hash.href = `${SEPOLIA.explorer}/block/${height}`;
      hash.setAttribute('aria-label', `Block ${height} on Etherscan`);
      setText('#w3-block-source', `From the public Sepolia RPC at publicnode.com, every 12 seconds. Checked ${clock.format(Date.now())}.`);
      el('#w3-block-card').setAttribute('aria-busy', 'false');
      el('#w3-block-card').classList.remove('is-error');
      tickAges();
      if (isNew && wallet.getState().address) void readBalances();
    } catch {
      el('#w3-block-card').classList.add('is-error');
      el('#w3-block-card').setAttribute('aria-busy', 'false');
      if (!lastBlock) for (const id of ['#w3-block-number', '#w3-block-age', '#w3-block-txs', '#w3-block-gas', '#w3-block-fee', '#w3-block-hash']) setText(id, id === '#w3-block-number' ? 'Unavailable' : 'None');
      setText('#w3-block-source', 'The public Sepolia RPCs did not answer. Retrying in 12 seconds.');
    }
  }

  // Squeekchain wheel ------------------------------------------------------------------------------
  const wheelLabel = { ACTIVE: 'Running', IDLE: 'Resting, the wheel is still', COUNTER_FAULT: 'Sensor fault' } as const;
  async function readWheel(): Promise<void> {
    try {
      wheel = parseWheelStatus(await squeekchainGet('/status'));
      el('#w3-wheel-dot').dataset.state = wheel.coreStatus === 'ACTIVE' ? 'connected' : wheel.coreStatus === 'COUNTER_FAULT' ? 'wrong-network' : 'disconnected';
      setText('#w3-wheel-status', wheelLabel[wheel.coreStatus]);
      setText('#w3-wheel-rpm', `${wheel.rpm.toFixed(1)} rpm`);
      setText('#w3-wheel-work', number.format(wheel.workUnits));
      const block = el<HTMLAnchorElement>('#w3-wheel-block');
      block.textContent = wheel.settledBlock === null ? 'Not available' : `#${number.format(wheel.settledBlock)}`;
      if (wheel.settledTx) { block.href = `${SEPOLIA.explorer}/tx/${wheel.settledTx}`; block.setAttribute('aria-label', `Squeekchain block ${wheel.settledBlock}, settlement transaction on Etherscan`); }
      else block.removeAttribute('href');
      el('#w3-wheel-list').hidden = false;
      el('#w3-wheel-empty').hidden = true;
      tickAges();
    } catch {
      wheel = null;
      el('#w3-wheel-dot').dataset.state = 'disconnected';
      setText('#w3-wheel-status', 'Official API unavailable');
      el('#w3-wheel-list').hidden = true;
      el('#w3-wheel-empty').hidden = false;
    }
    el('#w3-wheel-card').setAttribute('aria-busy', 'false');
  }

  // Contracts --------------------------------------------------------------------------------------
  async function readToken(): Promise<void> {
    const [name, symbol, decimals, supply] = await Promise.allSettled(['0x06fdde03', '0x95d89b41', '0x313ce567', '0x18160ddd'].map(data => ethCall(TOKEN.address, data)));
    try {
      if (symbol.status === 'fulfilled') tokenSymbol = decodeAbiString(symbol.value);
      if (decimals.status === 'fulfilled') tokenDecimals = Number(hexToBigInt(decimals.value));
      if (supply.status !== 'fulfilled') throw new Error('No supply');
      setText('#w3-supply', `${formatUnits(hexToBigInt(supply.value), tokenDecimals, 0)} ${tokenSymbol}`);
      const tokenName = name.status === 'fulfilled' ? decodeAbiString(name.value) : 'SQK token';
      setText('#w3-supply-label', `Total supply of ${tokenName} (${tokenSymbol}), read from the contract`);
    } catch {
      setText('#w3-supply', 'Unavailable');
      setText('#w3-supply-label', 'The token contract could not be read right now.');
    }
    el('#w3-token-card').setAttribute('aria-busy', 'false');
  }
  async function crossCheckApi(): Promise<void> {
    let listed: string[] | null = null;
    try { listed = Object.values(collectAddresses(await squeekchainGet('/economy/state'))); } catch { listed = null; }
    for (const contract of SQUEEKCHAIN_CONTRACTS) {
      const target = el(`#w3-contracts [data-key="${contract.key}"] .w3-listed`);
      target.textContent = listed === null ? '' : listed.includes(contract.address.toLowerCase()) ? ' · Listed by the Squeekchain API now' : ' · Not in the API’s current list';
    }
  }

  // Ages tick each second without new requests. -------------------------------------------------------
  function tickAges(): void {
    const now = Date.now();
    if (lastBlock) setText('#w3-block-age', relativeTime(now / 1000 - lastBlock.timestamp));
    if (wheel) setText('#w3-wheel-reading', `${wheel.freshness === 'online' ? 'Live' : 'Stale'}, ${relativeTime((now - wheel.observedAt) / 1000)}`);
  }

  let blockTimer = 0;
  let wheelTimer = 0;
  let ageTimer = 0;
  function startPolling(): void {
    stopPolling();
    void readBlock(); void readWheel();
    blockTimer = window.setInterval(() => void readBlock(), BLOCK_MS);
    wheelTimer = window.setInterval(() => void readWheel(), WHEEL_MS);
    ageTimer = window.setInterval(tickAges, 1000);
  }
  function stopPolling(): void { clearInterval(blockTimer); clearInterval(wheelTimer); clearInterval(ageTimer); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPolling(); else startPolling(); });

  wallet.subscribe(renderWallet);
  wallet.startDiscovery();
  renderWallet();
  startPolling();
  void readToken();
  void crossCheckApi();
}
