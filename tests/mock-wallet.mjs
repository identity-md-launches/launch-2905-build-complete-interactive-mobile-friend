// Test-only EIP-6963 wallets injected into the page with addInitScript. They hold no keys,
// answer only the read methods the site uses, and let tests drive accept, reject and chain switch.
export function installMockWallets() {
  const make = (info, options) => {
    const listeners = {};
    let chainId = options.chainId;
    let connected = false;
    const emit = (event, value) => (listeners[event] || []).forEach(fn => fn(value));
    const provider = {
      async request({ method }) {
        window.__walletCalls = [...(window.__walletCalls || []), `${info.rdns}:${method}`];
        if (method === 'eth_requestAccounts') {
          if (options.reject) throw Object.assign(new Error('User rejected'), { code: 4001 });
          connected = true; return [options.account];
        }
        if (method === 'eth_accounts') return connected ? [options.account] : [];
        if (method === 'eth_chainId') return chainId;
        if (method === 'wallet_switchEthereumChain') { chainId = '0xaa36a7'; emit('chainChanged', chainId); return null; }
        if (method === 'wallet_revokePermissions') { connected = false; return null; }
        throw Object.assign(new Error(`Unsupported ${method}`), { code: 4200 });
      },
      on(event, fn) { (listeners[event] ||= []).push(fn); },
      removeListener(event, fn) { listeners[event] = (listeners[event] || []).filter(f => f !== fn); },
    };
    const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: Object.freeze({ info, provider }) }));
    window.addEventListener('eip6963:requestProvider', announce);
    announce();
  };
  const icon = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 28 28%22%3E%3Crect width=%2228%22 height=%2228%22 fill=%22%23f6851b%22/%3E%3C/svg%3E';
  make({ uuid: 'mock-okx', name: 'OKX Wallet', icon, rdns: 'com.okex.wallet' }, { account: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed', chainId: '0x1', reject: true });
  make({ uuid: 'mock-metamask', name: 'MetaMask', icon, rdns: 'io.metamask' }, { account: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed', chainId: '0x1' });
}
