// Pure helpers with no imports, DOM, or network, so Node can test them directly.

const MASK = (1n << 64n) - 1n;
const ROTATIONS = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
const ROUND_CONSTANTS: bigint[] = [];
{
  let r = 1;
  for (let round = 0; round < 24; round++) {
    let constant = 0n;
    for (let j = 0; j < 7; j++) {
      r = ((r << 1) ^ ((r >> 7) * 0x71)) % 256;
      if (r & 2) constant ^= 1n << ((1n << BigInt(j)) - 1n);
    }
    ROUND_CONSTANTS.push(constant);
  }
}
const rotate = (value: bigint, n: number) => n === 0 ? value : ((value << BigInt(n)) | (value >> BigInt(64 - n))) & MASK;

function permute(state: bigint[]): void {
  const c = new Array<bigint>(5);
  const b = new Array<bigint>(25);
  for (const constant of ROUND_CONSTANTS) {
    for (let x = 0; x < 5; x++) c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5] ^ rotate(c[(x + 1) % 5], 1);
      for (let y = 0; y < 25; y += 5) state[x + y] ^= d;
    }
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotate(state[x + 5 * y], ROTATIONS[x + 5 * y]);
    for (let y = 0; y < 25; y += 5) for (let x = 0; x < 5; x++) state[x + y] = b[x + y] ^ (~b[((x + 1) % 5) + y] & MASK & b[((x + 2) % 5) + y]);
    state[0] ^= constant;
  }
}

/** Ethereum's Keccak-256 (original padding, not SHA3-256), as a lowercase hex string without 0x. */
export function keccak256(input: Uint8Array): string {
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((input.length + 1) / rate) * rate);
  padded.set(input);
  padded[input.length] ^= 0x01;
  padded[padded.length - 1] ^= 0x80;
  const state = new Array<bigint>(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let lane = 0; lane < rate / 8; lane++) {
      let value = 0n;
      for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(padded[offset + lane * 8 + i]);
      state[lane] ^= value;
    }
    permute(state);
  }
  let hex = '';
  for (let lane = 0; lane < 4; lane++) for (let i = 0; i < 8; i++) hex += Number((state[lane] >> BigInt(8 * i)) & 0xffn).toString(16).padStart(2, '0');
  return hex;
}

export const isAddress = (value: unknown): value is string => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);

/** EIP-55 mixed-case checksum. */
export function checksumAddress(address: string): string {
  if (!isAddress(address)) throw new Error(`Not an address: ${address}`);
  const lower = address.slice(2).toLowerCase();
  const hash = keccak256(new TextEncoder().encode(lower));
  let out = '0x';
  for (let i = 0; i < 40; i++) out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  return out;
}

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
export const shortHash = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-6)}`;

export function hexToBigInt(value: unknown): bigint {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]*$/.test(value)) throw new Error('Expected a hex quantity');
  return value === '0x' ? 0n : BigInt(value);
}

/** Formats a fixed-point integer with grouping and at most `places` fraction digits, rounding down. */
export function formatUnits(value: bigint, decimals: number, places = 4): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let fraction = decimals ? (abs % base).toString().padStart(decimals, '0').slice(0, places) : '';
  fraction = fraction.replace(/0+$/, '');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (abs > 0n && whole === 0n && !fraction) return `${negative ? '-' : ''}<0.${'0'.repeat(Math.max(0, places - 1))}1`;
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** Decodes an ABI-encoded `string` return value (or a bytes32 legacy name). */
export function decodeAbiString(hex: string): string {
  const data = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (data.length === 64) return decodeUtf8(data).replace(/\0+$/, '');
  if (data.length < 128) throw new Error('Short ABI string');
  const offset = Number(BigInt(`0x${data.slice(0, 64)}`)) * 2;
  const length = Number(BigInt(`0x${data.slice(offset, offset + 64)}`)) * 2;
  return decodeUtf8(data.slice(offset + 64, offset + 64 + length));
}
function decodeUtf8(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return new TextDecoder().decode(bytes);
}

export const encodeAddressArg = (address: string) => address.slice(2).toLowerCase().padStart(64, '0');

export function relativeTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 10: 'OP Mainnet', 56: 'BNB Chain', 137: 'Polygon', 8453: 'Base', 42161: 'Arbitrum One',
  17000: 'Holesky', 84532: 'Base Sepolia', 560048: 'Hoodi', 11155111: 'Sepolia',
};
export const chainName = (id: number) => CHAIN_NAMES[id] ?? `Chain ${id}`;

export interface WheelStatus {
  coreStatus: 'IDLE' | 'ACTIVE' | 'COUNTER_FAULT';
  freshness: 'online' | 'stale';
  rpm: number;
  workUnits: bigint;
  observedAt: number;
  settledBlock: bigint | null;
  settledTx: string | null;
  generatedAt: number;
}

/**
 * Validates Squeekchain's GET /v1/status (schemaVersion 1). Unknown or malformed
 * fields are rejected, never defaulted, so a missing reading is never shown as zero.
 */
export function parseWheelStatus(body: unknown): WheelStatus {
  const root = body as Record<string, unknown> | null;
  if (!root || typeof root !== 'object' || root.schemaVersion !== 1) throw new Error('Unsupported status schema');
  const m = root.measurement as Record<string, unknown> | null;
  if (!m || typeof m !== 'object') throw new Error('No wheel measurement');
  const status = m.coreStatus;
  if (status !== 'IDLE' && status !== 'ACTIVE' && status !== 'COUNTER_FAULT') throw new Error('Unknown wheel status');
  const freshness = m.freshness === 'online' || m.freshness === 'stale' ? m.freshness : null;
  if (!freshness) throw new Error('Unknown freshness');
  if (typeof m.rpmMilli !== 'number' || !Number.isSafeInteger(m.rpmMilli) || m.rpmMilli < 0) throw new Error('Bad rpm');
  if (typeof m.cumulativeWorkUnits !== 'string' || !/^(0|[1-9]\d*)$/.test(m.cumulativeWorkUnits)) throw new Error('Bad work units');
  const observedAt = Date.parse(String(m.observedAt));
  const generatedAt = Date.parse(String(root.generatedAt));
  if (!Number.isFinite(observedAt) || !Number.isFinite(generatedAt)) throw new Error('Bad timestamp');
  let settledBlock: bigint | null = null;
  let settledTx: string | null = null;
  const builder = root.builder as Record<string, unknown> | null | undefined;
  if (builder && builder.status === 'available' && builder.anchor && typeof builder.anchor === 'object') {
    const anchor = builder.anchor as Record<string, unknown>;
    if (typeof anchor.blockHeight === 'string' && /^(0|[1-9]\d*)$/.test(anchor.blockHeight)) settledBlock = BigInt(anchor.blockHeight);
    if (typeof anchor.transactionHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(anchor.transactionHash)) settledTx = anchor.transactionHash;
  }
  return { coreStatus: status, freshness, rpm: m.rpmMilli / 1000, workUnits: BigInt(m.cumulativeWorkUnits), observedAt, settledBlock, settledTx, generatedAt };
}

/** Collects every address in a nested JSON object, keyed by dotted path. */
export function collectAddresses(value: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [key, item] of Object.entries(value)) {
    if (isAddress(item)) out[prefix + key] = item.toLowerCase();
    else if (item && typeof item === 'object') Object.assign(out, collectAddresses(item, `${prefix}${key}.`));
  }
  return out;
}
