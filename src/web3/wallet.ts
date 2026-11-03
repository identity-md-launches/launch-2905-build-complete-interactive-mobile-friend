import { checksumAddress, isAddress } from './chain-utils';
import { METAMASK_RDNS, OKX_RDNS, SEPOLIA, WALLET_STORAGE_KEY } from './config';

/** EIP-1193. The site only ever asks for accounts and the chain; it never signs or sends. */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
  on?(event: string, listener: (...args: any[]) => void): void;
  removeListener?(event: string, listener: (...args: any[]) => void): void;
}
export interface WalletInfo { uuid: string; name: string; icon: string; rdns: string }
export interface DiscoveredWallet { info: WalletInfo; provider: Eip1193Provider }
export interface WalletState {
  status: 'disconnected' | 'connecting' | 'connected';
  wallet: WalletInfo | null;
  pendingUuid: string | null;
  address: string | null;
  chainId: number | null;
  note: string | null;
  switching: boolean;
}

const discovered = new Map<string, DiscoveredWallet>();
const listeners = new Set<() => void>();
let state: WalletState = { status: 'disconnected', wallet: null, pendingUuid: null, address: null, chainId: null, note: null, switching: false };
let active: DiscoveredWallet | null = null;

const emit = () => listeners.forEach(listener => listener());
const set = (patch: Partial<WalletState>) => { state = { ...state, ...patch }; emit(); };
export const getState = () => state;
export const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };
export const isOnSepolia = () => state.chainId === SEPOLIA.id;

/** Brief-named wallets first (MetaMask, then OKX Wallet), then other extensions by name. */
export function wallets(): DiscoveredWallet[] {
  const rank = (w: DiscoveredWallet) => w.info.rdns === METAMASK_RDNS ? 0 : w.info.rdns === OKX_RDNS ? 1 : w.info.rdns === 'injected' ? 3 : 2;
  return [...discovered.values()].sort((a, b) => rank(a) - rank(b) || a.info.name.localeCompare(b.info.name));
}

const safeIcon = (icon: unknown) => typeof icon === 'string' && /^data:image\/(svg\+xml|png|webp|jpeg|gif)[;,]/.test(icon) ? icon : '';

export function startDiscovery(): void {
  window.addEventListener('eip6963:announceProvider', event => {
    const detail = (event as CustomEvent).detail as { info?: Partial<WalletInfo>; provider?: Eip1193Provider } | undefined;
    const info = detail?.info;
    if (!info?.uuid || !info.name || !detail?.provider?.request) return;
    discovered.set(info.uuid, { info: { uuid: info.uuid, name: String(info.name).slice(0, 40), icon: safeIcon(info.icon), rdns: String(info.rdns ?? '') }, provider: detail.provider });
    // A named extension replaces the anonymous window.ethereum fallback.
    discovered.delete('injected');
    emit();
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  window.setTimeout(() => {
    const legacy = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
    if (!discovered.size && legacy?.request) {
      discovered.set('injected', { info: { uuid: 'injected', name: 'Browser wallet', icon: '', rdns: 'injected' }, provider: legacy });
      emit();
    }
    void restore();
  }, 500);
}

function friendlyError(error: unknown): string {
  const code = (error as { code?: number })?.code;
  if (code === 4001) return 'Request declined in your wallet.';
  if (code === -32002) return 'Your wallet already has a request open. Check the wallet window.';
  return 'Your wallet did not connect. Try again.';
}

const parseChain = (value: unknown) => typeof value === 'string' ? Number.parseInt(value, 16) : typeof value === 'number' ? value : null;

function onAccounts(accounts: unknown): void {
  const first = Array.isArray(accounts) ? accounts.find(isAddress) : undefined;
  if (first) set({ address: checksumAddress(first) });
  else forget();
}
function onChain(chainId: unknown): void { set({ chainId: parseChain(chainId), switching: false }); }
function onDisconnect(): void { forget(); }

function attach(wallet: DiscoveredWallet, address: string, chainId: number | null): void {
  detach();
  active = wallet;
  wallet.provider.on?.('accountsChanged', onAccounts);
  wallet.provider.on?.('chainChanged', onChain);
  wallet.provider.on?.('disconnect', onDisconnect);
  try { localStorage.setItem(WALLET_STORAGE_KEY, wallet.info.rdns || wallet.info.uuid); } catch { /* Reconnect on reload is a convenience. */ }
  set({ status: 'connected', wallet: wallet.info, pendingUuid: null, address: checksumAddress(address), chainId, note: null, switching: false });
}
function detach(): void {
  active?.provider.removeListener?.('accountsChanged', onAccounts);
  active?.provider.removeListener?.('chainChanged', onChain);
  active?.provider.removeListener?.('disconnect', onDisconnect);
  active = null;
}
function forget(): void {
  detach();
  try { localStorage.removeItem(WALLET_STORAGE_KEY); } catch { /* Nothing to forget. */ }
  set({ status: 'disconnected', wallet: null, pendingUuid: null, address: null, chainId: null, switching: false });
}

export async function connect(uuid: string): Promise<boolean> {
  const wallet = discovered.get(uuid);
  if (!wallet || state.status === 'connecting') return false;
  set({ status: 'connecting', pendingUuid: uuid, note: null });
  try {
    const accounts = await wallet.provider.request({ method: 'eth_requestAccounts' });
    const address = Array.isArray(accounts) ? accounts.find(isAddress) : undefined;
    if (!address) throw Object.assign(new Error('No account'), { code: 4001 });
    const chainId = parseChain(await wallet.provider.request({ method: 'eth_chainId' }));
    attach(wallet, address, chainId);
    return true;
  } catch (error) {
    set({ status: 'disconnected', pendingUuid: null, note: friendlyError(error) });
    return false;
  }
}

/** Reconnects silently on reload: eth_accounts never opens a wallet prompt. */
async function restore(): Promise<void> {
  let saved: string | null = null;
  try { saved = localStorage.getItem(WALLET_STORAGE_KEY); } catch { return; }
  if (!saved || state.status !== 'disconnected') return;
  const wallet = [...discovered.values()].find(w => (w.info.rdns || w.info.uuid) === saved);
  if (!wallet) return;
  try {
    const accounts = await wallet.provider.request({ method: 'eth_accounts' });
    const address = Array.isArray(accounts) ? accounts.find(isAddress) : undefined;
    if (!address) return;
    attach(wallet, address, parseChain(await wallet.provider.request({ method: 'eth_chainId' })));
  } catch { /* Stay disconnected; the visitor can connect again. */ }
}

export async function switchToSepolia(): Promise<void> {
  if (!active || state.switching) return;
  const provider = active.provider;
  set({ switching: true, note: null });
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA.hexId }] });
    onChain(await provider.request({ method: 'eth_chainId' }));
  } catch (error) {
    const code = (error as { code?: number; data?: { originalError?: { code?: number } } })?.code;
    const nested = (error as { data?: { originalError?: { code?: number } } })?.data?.originalError?.code;
    if (code === 4902 || nested === 4902) {
      try {
        await provider.request({ method: 'wallet_addEthereumChain', params: [SEPOLIA.addParams] });
        onChain(await provider.request({ method: 'eth_chainId' }));
        return;
      } catch (addError) { set({ switching: false, note: friendlyError(addError) }); return; }
    }
    set({ switching: false, note: code === 4001 ? 'Network switch declined in your wallet.' : 'Your wallet did not switch networks. Choose Sepolia in the wallet.' });
  }
}

export async function disconnect(): Promise<void> {
  const provider = active?.provider;
  forget();
  set({ note: null });
  // MetaMask and others revoke the site's account permission; wallets without it just forget locally.
  try { await provider?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch { /* Local disconnect is enough. */ }
}

export const clearNote = () => { if (state.note) set({ note: null }); };
