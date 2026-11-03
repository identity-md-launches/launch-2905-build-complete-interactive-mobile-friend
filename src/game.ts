export const ROUND_MS = 60_000;
export const COMBO_WINDOW_MS = 600;
export const TAPS_PER_LEVEL = 5;
export type Phase = 'welcome' | 'playing' | 'over';

/** A clock-injected engine. No intervals, DOM, or storage live in game rules. */
export class Game {
  phase: Phase = 'welcome';
  score = 0;
  taps = 0;
  streak = 0;
  maxMultiplier = 1;
  deadline = 0;
  lastTap = -Infinity;

  start(now: number): void {
    this.reset();
    this.phase = 'playing';
    this.deadline = now + ROUND_MS;
  }

  reset(): void {
    this.phase = 'welcome';
    this.score = 0;
    this.taps = 0;
    this.streak = 0;
    this.maxMultiplier = 1;
    this.deadline = 0;
    this.lastTap = -Infinity;
  }

  /** Returns true only on the transition to game over. */
  update(now: number): boolean {
    if (this.phase !== 'playing') return false;
    if (now >= this.deadline) {
      this.phase = 'over';
      this.streak = 0;
      return true;
    }
    if (now - this.lastTap > COMBO_WINDOW_MS) this.streak = 0;
    return false;
  }

  tap(now: number): number {
    this.update(now);
    if (this.phase !== 'playing') return 0;
    this.streak += 1;
    this.lastTap = now;
    this.taps += 1;
    const points = this.multiplier;
    this.maxMultiplier = Math.max(this.maxMultiplier, points);
    this.score += points;
    return points;
  }

  get multiplier(): number {
    return Math.min(5, 1 + Math.floor(this.streak / TAPS_PER_LEVEL));
  }

  remaining(now: number): number {
    if (this.phase === 'welcome') return ROUND_MS;
    if (this.phase === 'over') return 0;
    return Math.max(0, this.deadline - now);
  }

  comboRemaining(now: number): number {
    if (this.phase !== 'playing' || !this.streak) return 0;
    return Math.max(0, 1 - (now - this.lastTap) / COMBO_WINDOW_MS);
  }
}
