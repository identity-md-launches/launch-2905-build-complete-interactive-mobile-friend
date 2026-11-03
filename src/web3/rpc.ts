import { SEPOLIA, SQUEEKCHAIN_API } from './config';

let preferred = 0;

/** One JSON-RPC call against Sepolia's public endpoints, falling through to the next on failure. */
export async function sepoliaRpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < SEPOLIA.rpcUrls.length; attempt++) {
    const index = (preferred + attempt) % SEPOLIA.rpcUrls.length;
    try {
      const response = await fetch(SEPOLIA.rpcUrls[index], {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { result?: T; error?: { message?: string } };
      if (body.error) throw new Error(body.error.message ?? 'RPC error');
      preferred = index;
      return body.result as T;
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error('Sepolia RPC unavailable');
}

export const ethCall = (to: string, data: string) => sepoliaRpc<string>('eth_call', [{ to, data }, 'latest']);

export interface RawBlock {
  number: string; hash: string; timestamp: string; gasUsed: string; gasLimit: string;
  baseFeePerGas?: string; transactions: unknown[]; miner: string;
}
export const latestBlock = () => sepoliaRpc<RawBlock>('eth_getBlockByNumber', ['latest', false]);

/** GET from the official Squeekchain API. Plain GET with no custom headers: no CORS preflight. */
export async function squeekchainGet(path: string): Promise<unknown> {
  const response = await fetch(`${SQUEEKCHAIN_API}${path}`, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
