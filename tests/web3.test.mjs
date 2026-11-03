// Node 22.18+ strips TypeScript types natively, so the pure helpers are imported from source.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  keccak256, checksumAddress, formatUnits, decodeAbiString, hexToBigInt, parseWheelStatus,
  collectAddresses, relativeTime, chainName, shortAddress,
} from '../src/web3/chain-utils.ts';
import { SQUEEKCHAIN_CONTRACTS, SEPOLIA } from '../src/web3/config.ts';

const bytes = text => new TextEncoder().encode(text);

test('keccak256 matches published Ethereum vectors', () => {
  assert.equal(keccak256(bytes('')), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(keccak256(bytes('abc')), '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
  assert.equal(keccak256(bytes('transfer(address,uint256)')).slice(0, 8), 'a9059cbb');
  assert.equal(keccak256(new Uint8Array(200).fill(97)).length, 64, 'multi-block input');
});

test('EIP-55 checksums match the specification examples', () => {
  for (const address of ['0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359', '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB', '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb']) {
    assert.equal(checksumAddress(address.toLowerCase()), address);
  }
  assert.throws(() => checksumAddress('0x1234'));
  assert.equal(shortAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'), '0x5aAe…eAed');
});

test('unit formatting groups, truncates, and marks dust', () => {
  assert.equal(formatUnits(1234567890000000000000n, 18), '1,234.5678');
  assert.equal(formatUnits(0n, 18), '0');
  assert.equal(formatUnits(1n, 18), '<0.0001');
  assert.equal(formatUnits(1500000000n, 9, 2), '1.5');
  assert.equal(hexToBigInt('0x1937f164849d621900c18a') > 0n, true);
  assert.throws(() => hexToBigInt('12'));
});

test('ABI string decoding handles dynamic strings and bytes32', () => {
  const dynamic = '0x' + '20'.padStart(64, '0') + '6'.padStart(64, '0') + '53717565656b'.padEnd(64, '0');
  assert.equal(decodeAbiString(dynamic), 'Squeek');
  assert.equal(decodeAbiString('0x' + '53514b'.padEnd(64, '0')), 'SQK');
});

test('wheel status parser accepts schema 1 and refuses guesses', () => {
  const body = {
    schemaVersion: 1, installationId: 'x', revision: 'r', generatedAt: '2026-11-03T05:00:00Z',
    measurement: { freshness: 'online', observedAt: '2026-11-03T04:59:58Z', receivedAt: '2026-11-03T04:59:59Z', staleAfterSeconds: 30, counterEpoch: 'e', cumulativeWorkUnits: '62576', provenance: 'hardware', coreStatus: 'ACTIVE', rpmMilli: 41250, speedMmPerSecond: 600, distanceMm: 1000 },
    builder: { status: 'available', anchor: { blockHeight: '5570', settledThroughRound: '12', confirmedAt: null, transactionHash: '0x' + 'ab'.repeat(32) } },
  };
  const status = parseWheelStatus(body);
  assert.equal(status.coreStatus, 'ACTIVE');
  assert.equal(status.rpm, 41.25);
  assert.equal(status.workUnits, 62576n);
  assert.equal(status.settledBlock, 5570n);
  assert.throws(() => parseWheelStatus({ ...body, schemaVersion: 2 }));
  assert.throws(() => parseWheelStatus({ ...body, measurement: { ...body.measurement, rpmMilli: undefined } }));
  assert.throws(() => parseWheelStatus({ ...body, measurement: null }));
  assert.equal(parseWheelStatus({ ...body, builder: { status: 'unavailable' } }).settledBlock, null);
});

test('address collection, time and chain labels', () => {
  assert.deepEqual(collectAddresses({ identities: { token: '0x5501E1Fa81Be1c3F49225fa7668DA0245d07Db60', staking: { proxy: '0x4b67b739dFd832f4EAC67a7Aa3bc244fB74cea4F' } }, n: 1 }), {
    'identities.token': '0x5501e1fa81be1c3f49225fa7668da0245d07db60',
    'identities.staking.proxy': '0x4b67b739dfd832f4eac67a7aa3bc244fb74cea4f',
  });
  assert.equal(relativeTime(5), '5s ago');
  assert.equal(relativeTime(125), '2m 5s ago');
  assert.equal(chainName(11155111), 'Sepolia');
  assert.equal(chainName(999999), 'Chain 999999');
});

test('configuration targets Sepolia and lists only checksummed, sourced contracts', () => {
  assert.equal(SEPOLIA.id, 11155111);
  assert.equal(SEPOLIA.hexId, '0xaa36a7');
  for (const contract of SQUEEKCHAIN_CONTRACTS) {
    assert.equal(checksumAddress(contract.address), contract.address);
    assert.ok(contract.source.length > 10, `${contract.label} records its source`);
  }
});
