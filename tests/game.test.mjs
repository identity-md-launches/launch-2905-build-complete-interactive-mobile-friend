import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, ROUND_MS, COMBO_WINDOW_MS } from '../test/scratch/unit/game.js';
import { addRound, emptyScores, parseScores, MAX_ROUNDS } from '../test/scratch/unit/storage.js';

test('a round lasts exactly 60 seconds and finishes once', () => {
  const game = new Game();
  assert.equal(game.tap(100), 0);
  game.start(1000);
  assert.equal(game.remaining(1000), ROUND_MS);
  assert.equal(game.update(60_999), false);
  assert.equal(game.remaining(60_999), 1);
  assert.equal(game.update(61_000), true);
  assert.equal(game.update(61_001), false);
  assert.equal(game.phase, 'over');
  assert.equal(game.remaining(61_001), 0);
});

test('quick taps unlock every level through 5× and cap there', () => {
  const game = new Game(); game.start(0);
  const awards = Array.from({ length: 25 }, (_, i) => game.tap(i * 50));
  assert.deepEqual(awards.slice(0, 5), [1, 1, 1, 1, 2]);
  assert.deepEqual([awards[9], awards[14], awards[19], awards[24]], [3, 4, 5, 5]);
  assert.equal(game.multiplier, 5);
  assert.equal(game.taps, 25);
  assert.equal(game.maxMultiplier, 5);
  assert.equal(game.score, awards.reduce((a, b) => a + b, 0));
});

test('combo accepts 600ms gaps, resets after longer gaps, and preserves score', () => {
  const game = new Game(); game.start(0);
  for (let i = 0; i < 5; i++) game.tap(i * 100);
  const before = game.score;
  assert.equal(game.tap(400 + COMBO_WINDOW_MS), 2);
  assert.equal(game.tap(1000 + COMBO_WINDOW_MS + 1), 1);
  assert.equal(game.multiplier, 1);
  assert.equal(game.streak, 1);
  assert.equal(game.score, before + 3);
  assert.equal(game.maxMultiplier, 2);
});

test('idle decay is visible without another tap', () => {
  const game = new Game(); game.start(0);
  for (let i = 0; i < 10; i++) game.tap(i * 10);
  assert.equal(game.multiplier, 3);
  assert.equal(game.comboRemaining(390), 0.5);
  game.update(691);
  assert.equal(game.streak, 0);
  assert.equal(game.multiplier, 1);
  assert.equal(game.comboRemaining(691), 0);
});

test('a tap at or after the deadline earns no points, including after a background gap', () => {
  const game = new Game(); game.start(0);
  assert.equal(game.tap(59_999), 1);
  assert.equal(game.tap(60_000), 0);
  assert.equal(game.tap(90_000), 0);
  assert.equal(game.score, 1);
  assert.equal(game.phase, 'over');
});

test('reset and replay discard the round and fully initialize the next one', () => {
  const game = new Game(); game.start(1000); game.tap(1010); game.reset();
  assert.equal(game.phase, 'welcome');
  assert.equal(game.score, 0);
  assert.equal(game.taps, 0);
  assert.equal(game.tap(1020), 0);
  game.start(5000);
  assert.equal(game.remaining(5000), ROUND_MS);
  assert.equal(game.multiplier, 1);
  assert.equal(game.maxMultiplier, 1);
  assert.equal(game.tap(5010), 1);
});

const round = (i, score = i) => ({ id: `round-${i}`, score, taps: i, maxMultiplier: 1, at: 1_800_000_000_000 + i });
test('history retains the latest 30 rounds and keeps an older all-time personal best', () => {
  let saved = addRound(emptyScores(), round(0, 999));
  for (let i = 1; i <= 35; i++) saved = addRound(saved, round(i));
  assert.equal(saved.rounds.length, MAX_ROUNDS);
  assert.equal(saved.rounds[0].id, 'round-35');
  assert.equal(saved.rounds.at(-1).id, 'round-6');
  assert.equal(saved.best, 999);
  assert.deepEqual(parseScores(JSON.stringify(saved)), saved);
});

test('duplicate completion cannot add the same round twice', () => {
  const first = addRound(emptyScores(), round(1));
  assert.equal(addRound(first, round(1)), first);
});

test('malformed, incompatible, or hostile storage recovers to valid state', () => {
  for (const raw of [null, '', '{', 'null', '5', '[]', '{"version":2,"rounds":[]}']) {
    assert.deepEqual(parseScores(raw), emptyScores());
  }
  const input = { version: 1, best: -100, rounds: [round(4), null, { ...round(3), score: '<script>' }, { ...round(2), at: Infinity }, { ...round(2), maxMultiplier: 0 }] };
  assert.deepEqual(parseScores(JSON.stringify(input)), { version: 1, best: 4, rounds: [round(4)] });
});

