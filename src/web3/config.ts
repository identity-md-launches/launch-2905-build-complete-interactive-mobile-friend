// Every chain id, endpoint and address the site reads lives here, with where it came from.

export const SEPOLIA = {
  id: 11155111,
  hexId: '0xaa36a7',
  name: 'Sepolia',
  explorer: 'https://sepolia.etherscan.io',
  // Public endpoints that answer browsers (CORS *); tried in order on failure.
  rpcUrls: [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://1rpc.io/sepolia',
    'https://sepolia.gateway.tenderly.co',
  ],
  // wallet_addEthereumChain parameters for wallets that do not know Sepolia yet.
  addParams: {
    chainId: '0xaa36a7',
    chainName: 'Sepolia',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'],
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
} as const;

/** Squeekchain's official public API. Plain GETs, no key. */
export const SQUEEKCHAIN_API = 'https://api.squeekchain.com/v1';
export const SQUEEKCHAIN_SITE = 'https://squeekchain.com';

export interface ContractInfo {
  key: 'token' | 'core' | 'staking';
  label: string;
  address: string;
  /** How the source code can be checked; never claimed beyond what the explorer shows. */
  verification: { label: string; href: string | null; verified: boolean };
  source: string;
}

/**
 * Squeekchain's Sepolia contracts, as listed in `identities` by the official
 * `GET /v1/economy/state` (cited by the open-source squeek-economy-viewer and wheelcast
 * tools). Checked on 2026-11-03 against Sepolia itself: the token answers name() "Squeek"
 * and symbol() "SQK", and all three were created by the same deployer,
 * 0xff6f4f1E23ba7d1F34d8B4d3A81e5a1B9afEcDFA. The site also re-reads the API at run time
 * and says whether each address is still listed there.
 */
export const SQUEEKCHAIN_CONTRACTS: readonly ContractInfo[] = [
  {
    key: 'token',
    label: 'SQK token',
    address: '0x5501E1Fa81Be1c3F49225fa7668DA0245d07Db60',
    verification: { label: 'Source not published on Etherscan', href: null, verified: false },
    source: 'Squeekchain API /v1/economy/state identities.token; name() and symbol() read on Sepolia',
  },
  {
    key: 'core',
    label: 'SqueekCore',
    address: '0x980B4424c007CAf7a1f3670B48c8EaEf7EbC3d44',
    verification: { label: 'Proxy; source not published on Etherscan', href: null, verified: false },
    source: 'Squeekchain API /v1/economy/state identities.core and /v1/core',
  },
  {
    key: 'staking',
    label: 'Staking',
    address: '0x4b67b739dFd832f4EAC67a7Aa3bc244fB74cea4F',
    verification: {
      label: 'Verified on Sourcify (exact match)',
      href: 'https://repo.sourcify.dev/11155111/0x4b67b739dFd832f4EAC67a7Aa3bc244fB74cea4F',
      verified: true,
    },
    source: 'Squeekchain API /v1/economy/state identities.staking; Sourcify exact match 2026-10-31',
  },
];

export const OKX_RDNS = 'com.okex.wallet';
export const METAMASK_RDNS = 'io.metamask';
export const WALLET_STORAGE_KEY = 'squeek-clicker:wallet';
