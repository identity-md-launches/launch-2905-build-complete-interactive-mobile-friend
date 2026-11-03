/**
 * Mobile without a relay: a phone browser has no extension, so the sheet offers to open this
 * page inside a wallet's own browser, where that wallet is injected and EIP-6963 takes over.
 * Each link is the one its vendor documents; none needs a project ID or a server.
 */
export const OPEN_IN: ReadonlyArray<{ id: string; name: string; icon: string; href: (url: string) => string }> = [
  // https://docs.metamask.io/metamask-connect/evm/guides/metamask-exclusive/use-deeplinks
  { id: 'metamask', name: 'MetaMask', icon: './assets/wallets/metamask.svg', href: url => `https://link.metamask.io/dapp/${url.replace(/^https?:\/\//, '')}` },
  // https://web3.okx.com/build/docs/waas/app-universal-link
  { id: 'okx', name: 'OKX Wallet', icon: './assets/wallets/okx.svg', href: url => `https://www.okx.com/download?deeplink=${encodeURIComponent(`okx://wallet/dapp/url?dappUrl=${encodeURIComponent(url)}`)}` },
  // https://docs.cdp.coinbase.com/wallet-sdk/docs/deep-link
  { id: 'coinbase', name: 'Coinbase Wallet', icon: './assets/wallets/coinbase.svg', href: url => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}` },
];

/** Install pages for the two wallets the brief names, shown on desktop when they are missing. */
export const GET_WALLET = {
  'io.metamask': { name: 'MetaMask', icon: './assets/wallets/metamask.svg', href: 'https://metamask.io/download/' },
  'com.okex.wallet': { name: 'OKX Wallet', icon: './assets/wallets/okx.svg', href: 'https://web3.okx.com/download' },
} as const;

/** A phone or tablet browser with no injected provider is the case the links exist for. */
export const isMobileBrowser = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && !(window as { ethereum?: unknown }).ethereum;
