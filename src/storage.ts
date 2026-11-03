export const STORAGE_KEY = 'squeek-clicker:v1';
export const MAX_ROUNDS = 30;
export interface Round {
  id: string;
  score: number;
  taps: number;
  maxMultiplier: number;
  at: number;
}
export interface SavedScores { version: 1; best: number; rounds: Round[] }
export const emptyScores = (): SavedScores => ({ version: 1, best: 0, rounds: [] });
const whole = (v: unknown, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;

export function parseScores(raw: string | null): SavedScores {
  if (!raw) return emptyScores();
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyScores();
    const value = data as Partial<SavedScores>;
    if (value.version !== 1 || !Array.isArray(value.rounds)) return emptyScores();
    const rounds = value.rounds.filter((r): r is Round =>
      !!r && typeof r === 'object' && typeof r.id === 'string' && r.id.length < 100 &&
      whole(r.score, 1_000_000_000) && whole(r.taps, 1_000_000_000) &&
      whole(r.maxMultiplier, 5) && r.maxMultiplier >= 1 &&
      whole(r.at, 8_640_000_000_000_000)
    ).slice(0, MAX_ROUNDS);
    return {
      version: 1,
      best: Math.max(whole(value.best, 1_000_000_000) ? value.best : 0, ...rounds.map(r => r.score)),
      rounds,
    };
  } catch { return emptyScores(); }
}

export function addRound(saved: SavedScores, round: Round): SavedScores {
  // A throttled frame and a click at the deadline may both request completion.
  if (saved.rounds.some(r => r.id === round.id)) return saved;
  return {
    version: 1,
    best: Math.max(saved.best, round.score),
    rounds: [round, ...saved.rounds].slice(0, MAX_ROUNDS),
  };
}
