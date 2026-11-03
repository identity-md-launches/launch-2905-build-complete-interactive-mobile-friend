import { Game, ROUND_MS, TAPS_PER_LEVEL } from './game';
import { STORAGE_KEY, addRound, emptyScores, parseScores, type Round } from './storage';

const paths: Record<string, string> = {
  play: '<path d="m8 5 11 7-11 7z"/>',
  sound: '<path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4zM16 9l5 6m0-6-5 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 17h.01"/>',
  trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 13v5m-4 3h8m-6-3h4v3h-4z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6M12 2v3m6 1 2-2"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  mouse: '<path d="M9 3h6a5 5 0 0 1 5 5v8a8 8 0 0 1-16 0V8a5 5 0 0 1 5-5ZM12 3v7m-8 0h16"/>',
  heart: '<path d="M3 5h6v3h6V5h6v9h-3v3h-3v3H9v-3H6v-3H3z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  gamepad: '<path d="M7 6h10l3 3 2 9-3 2-5-4h-4l-5 4-3-2 2-9zM8 9v5m-2.5-2.5h5M16 10h.01M18 13h.01"/>',
};
const icon = (name: string, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header shell">
    <a class="wordmark" href="./" aria-label="Squeek Clicker home"><img src="./assets/favicon.svg" width="36" height="36" alt="" /><span>Squeek<span class="wordmark-secondary"> Clicker</span></span></a>
    <nav class="utilities" aria-label="Game settings">
      <button class="utility sound-toggle" id="sound" type="button" aria-label="Sound" aria-pressed="false"><span id="sound-icon">${icon('mute')}</span><span id="sound-label">Sound off</span></button>
      <button class="utility" id="help" type="button" aria-label="How to play">${icon('help')}<span>How to play</span></button>
    </nav>
  </header>
  <main class="shell" id="main">
    <div class="intro">
      <div><h1>Small mouse. <span>Big scores.</span></h1><p>A 60-second clicker for the Squeekchain community.</p></div>
      <div class="challenge-label">${icon('gamepad')}<span>A little friendly competition</span></div>
    </div>
    <div class="arcade-layout">
      <section class="game-panel" id="game" tabindex="-1" aria-label="Squeek Clicker game">
        <div class="scoreboard" aria-label="Round statistics">
          <div class="stat"><span class="stat-label">${icon('bolt')}Score</span><span class="stat-value score-value" id="score">0</span></div>
          <div class="stat"><span class="stat-label">${icon('timer')}Time left</span><span class="stat-value timer-value" id="timer" role="timer" aria-label="Time remaining">60<span class="stat-unit">s</span></span></div>
          <div class="stat"><span class="stat-label">${icon('trophy')}Personal best</span><span class="stat-value" id="best">0</span></div>
        </div>
        <div class="time-track" aria-hidden="true"><div id="time-fill"></div></div>
        <div class="playfield" id="playfield">
          <div class="scene-art" aria-hidden="true"><i class="pixel-star star-one"></i><i class="pixel-star star-two"></i><i class="pixel-star star-three"></i><i class="pixel-dot dot-one"></i><i class="pixel-dot dot-two"></i><div class="floor-grid"></div><div class="mouse-platform"></div></div>
          <div class="welcome-screen screen" id="welcome-screen">
            <h2>Ready, set, squeek.</h2>
            <p class="screen-description">Tap into your next personal best.</p>
            <img class="mascot welcome-mascot" src="./assets/mouse.svg" width="224" height="224" alt="A pixel mouse holding a piece of cheese" draggable="false" />
            <button class="button primary" id="start" type="button" aria-label="Start Game">${icon('play')}<span>Start Game</span><span class="button-arrow">${icon('chevron')}</span></button>
            <p class="control-hint">60 seconds. How high can you go?</p>
          </div>
          <div class="playing-screen screen" id="playing-screen" hidden>
            <h2 id="play-heading">Let’s make some squeeks.</h2>
            <p class="screen-description" id="play-description">Find your rhythm. Keep that combo going.</p>
            <button class="mouse-target" id="mouse-target" type="button" aria-label="Tap the mouse to earn points" aria-describedby="tap-instructions"><img class="mascot" src="./assets/mouse.svg" width="256" height="256" alt="" draggable="false" /></button>
            <p class="tap-instructions" id="tap-instructions">Tap the mouse <span class="keyboard-hint">or press <kbd>Space</kbd></span></p>
            <p class="control-hint" id="last-award">Each tap earns 1 point</p>
          </div>
          <div class="over-screen screen" id="over-screen" hidden>
            <div class="result-top"><img class="mascot result-mascot" src="./assets/mouse.svg" width="80" height="80" alt="" /><span id="result-badge" class="result-badge">${icon('trophy')}Round complete</span></div>
            <h2 id="result-heading" tabindex="-1">That’s a wrap!</h2>
            <p class="result-score" id="result-score">0</p><p class="result-points">points earned</p>
            <div class="result-stats"><span><b id="result-taps">0</b> total taps</span><span><b id="result-combo">1×</b> max combo</span></div>
            <button class="button primary" id="again" type="button" aria-label="Play Again">${icon('play')}<span>Play Again</span><span class="button-arrow">${icon('chevron')}</span></button>
            <p class="control-hint" id="result-save">Saved to your local leaderboard</p>
          </div>
          <div id="effects" class="effects" aria-hidden="true"></div>
        </div>
        <div class="combo-panel">
          <div class="combo-heading"><span>${icon('bolt')}Combo multiplier</span><span id="combo-tip">Keep a quick rhythm</span></div>
          <div class="combo-levels" id="combo-levels" role="meter" aria-label="Combo multiplier" aria-valuemin="1" aria-valuemax="5" aria-valuenow="1" aria-valuetext="1 times"><div class="combo-life" id="combo-life" aria-hidden="true"></div>${[1,2,3,4,5].map(n => `<div class="combo-level${n === 1 ? ' reached' : ''}" data-level="${n}"><span>${n}×</span><i></i></div>`).join('')}</div>
        </div>
        <div class="game-bottom"><span class="round-status"><i id="status-dot"></i><span id="round-status">Your next high score starts here</span></span><button class="utility reset-button" id="reset" type="button" disabled>${icon('reset')}Reset</button></div>
      </section>
      <aside class="sidebar" aria-label="Instructions and saved scores">
        <section class="instructions" aria-labelledby="instructions-title"><div class="section-title"><h2 id="instructions-title">A tiny field guide</h2>${icon('mouse')}</div>
          <ol class="steps">
            <li><span class="step-number">01</span><div><h3>Tap the little guy</h3><p>Every tap earns points. You’ve got 60 seconds to make them count.</p></div></li>
            <li><span class="step-number">02</span><div><h3>Get into a rhythm</h3><p>Tap within 0.6 seconds. Every 5 quick taps unlocks the next multiplier.</p></div></li>
            <li><span class="step-number">03</span><div><h3>Make it a high score</h3><p>Reach 5×, chase your best, and come back for one more round.</p></div></li>
          </ol>
          <div class="tip-line">${icon('bolt')}<span>A little speed goes a long way.</span></div>
        </section>
        <section class="leaderboard" aria-labelledby="leaderboard-title"><div class="section-title"><h2 id="leaderboard-title">Your leaderboard</h2>${icon('trophy')}</div>
          <p class="section-description">Your best rounds on this device.</p>
          <div class="leaderboard-controls"><div class="score-tabs" role="group" aria-label="Sort saved rounds"><button id="sort-top" class="score-tab" type="button" aria-pressed="true">Top scores</button><button id="sort-recent" class="score-tab" type="button" aria-pressed="false">Recent</button></div><button class="utility clear-button" id="clear" type="button" aria-label="Clear saved scores" title="Clear saved scores" disabled>${icon('trash')}</button></div>
          <div class="empty-scores" id="empty-scores">${icon('trophy')}<p>No squeeks on the board. Yet.</p><span>Finish a round to set your first score.</span></div>
          <ol class="score-list" id="score-list" aria-label="Saved rounds" hidden></ol>
          <p class="saved-rounds" id="saved-rounds" hidden></p>
          <p class="storage-note">${icon('lock')}<span>Up to 30 rounds saved locally.</span></p>
          <p class="storage-warning" id="storage-warning" role="status" hidden>Browser storage is unavailable. Scores last for this visit only.</p>
        </section>
      </aside>
    </div>
  </main>
  <footer class="site-footer shell"><span>${icon('heart')}Built for the Squeekchain Community</span><span>Big squeeks. Good company.</span></footer>
  <div class="sr-only" id="announcer" role="status" aria-live="polite" aria-atomic="true"></div>
  <dialog id="help-dialog" aria-labelledby="help-title"><div class="dialog-heading"><h2 id="help-title">How to play</h2><button class="utility" type="button" id="close-help" aria-label="Close instructions">${icon('close')}</button></div><p>Start a round, then tap the mouse as many times as you can in 60 seconds.</p><ul class="help-list"><li><b>Build your combo.</b> Keep taps within 0.6 seconds. At 5, 10, 15, and 20 consecutive taps, earn 2×, 3×, 4×, and 5× points per tap.</li><li><b>Keep the rhythm.</b> A gap longer than 0.6 seconds resets your multiplier to 1×.</li><li><b>Use your keyboard.</b> Focus the mouse and press Space or Enter. Holding a key does not earn extra points.</li><li><b>Watch the clock.</b> Opening help or switching tabs keeps the timer running.</li><li><b>Keep your best.</b> Finished rounds are saved on this browser. Reset discards the current round and keeps saved scores.</li></ul><p class="dialog-footnote">These are game points with no monetary value.</p><button class="button primary" id="got-it" type="button">Got it${icon('chevron')}</button></dialog>
  <dialog id="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-description"><h2 id="confirm-title"></h2><p id="confirm-description"></p><form method="dialog" class="dialog-actions"><button class="button secondary" value="cancel" autofocus>Cancel</button><button class="button primary" value="confirm" id="confirm-action">Reset round</button></form></dialog>
`;

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing game element: ${selector}`);
  return found;
}
const game = new Game();
let storageAvailable = true;
let saved = emptyScores();
try { saved = parseScores(localStorage.getItem(STORAGE_KEY)); }
catch { storageAvailable = false; }
let sortMode: 'top' | 'recent' = 'top';
let roundId = '';
let roundSaved = false;
let frame = 0;
let lastSeconds = 60;
let lastMultiplier = 1;
let mouseAnimation: Animation | undefined;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const number = new Intl.NumberFormat('en');
const date = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const scoreEl = el('#score');
const bestEl = el('#best');
const timerEl = el('#timer');
const mouseTarget = el<HTMLButtonElement>('#mouse-target');
const effects = el('#effects');
const comboLevels = el('#combo-levels');
const comboLife = el('#combo-life');
const timeFill = el('#time-fill');
const announce = (text: string) => { el('#announcer').textContent = text; };

function persist(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }
  catch { storageAvailable = false; }
  el('#storage-warning').hidden = storageAvailable;
}

function renderLeaderboard(): void {
  const list = el<HTMLOListElement>('#score-list');
  list.replaceChildren();
  const rounds = [...saved.rounds];
  if (sortMode === 'top') rounds.sort((a, b) => b.score - a.score || b.at - a.at);
  const visible = rounds.slice(0, 5);
  visible.forEach((round, i) => {
    const row = document.createElement('li');
    row.className = `score-row${round.id === roundId ? ' latest-score' : ''}`;
    const rank = document.createElement('span');
    rank.className = 'rank'; rank.textContent = String(i + 1).padStart(2, '0');
    const detail = document.createElement('div'); detail.className = 'round-detail';
    const title = document.createElement('span'); title.textContent = round.id === roundId ? 'Latest round' : 'Your round';
    const when = document.createElement('time'); when.dateTime = new Date(round.at).toISOString(); when.textContent = date.format(round.at);
    detail.append(title, when);
    const points = document.createElement('b'); points.className = 'row-points'; points.textContent = number.format(round.score);
    const unit = document.createElement('span'); unit.className = 'sr-only'; unit.textContent = ' points'; points.append(unit);
    row.append(rank, detail, points); list.append(row);
  });
  list.hidden = !visible.length;
  el('#empty-scores').hidden = !!visible.length;
  const count = el('#saved-rounds');
  count.hidden = !visible.length;
  count.textContent = `Showing ${visible.length} of ${saved.rounds.length} saved ${saved.rounds.length === 1 ? 'round' : 'rounds'}`;
  el<HTMLButtonElement>('#clear').disabled = !saved.rounds.length && !saved.best;
  el('#sort-top').setAttribute('aria-pressed', String(sortMode === 'top'));
  el('#sort-recent').setAttribute('aria-pressed', String(sortMode === 'recent'));
  bestEl.textContent = number.format(saved.best);
  el('#storage-warning').hidden = storageAvailable;
}

function renderRound(now: number): void {
  scoreEl.textContent = number.format(game.score);
  const seconds = Math.ceil(game.remaining(now) / 1000);
  if (seconds !== lastSeconds) {
    timerEl.innerHTML = `${seconds}<span class="stat-unit">s</span>`;
    timerEl.setAttribute('aria-label', `${seconds} seconds remaining`);
    lastSeconds = seconds;
    if (seconds === 10 && game.phase === 'playing') announce('10 seconds remaining. Keep going!');
  }
  timerEl.classList.toggle('time-low', seconds <= 10 && game.phase === 'playing');
  timeFill.style.transform = `scaleX(${game.remaining(now) / ROUND_MS})`;
  const multiplier = game.multiplier;
  comboLevels.setAttribute('aria-valuenow', String(multiplier));
  comboLevels.setAttribute('aria-valuetext', `${multiplier} times`);
  comboLevels.querySelectorAll<HTMLElement>('[data-level]').forEach(level => level.classList.toggle('reached', Number(level.dataset.level) <= multiplier));
  comboLife.style.transform = `scaleX(${game.comboRemaining(now)})`;
  comboLevels.classList.toggle('has-combo', multiplier > 1);
  if (game.phase === 'playing') {
    el('#combo-tip').textContent = multiplier === 5 ? '5×! Keep it going.' : `${game.streak % TAPS_PER_LEVEL} / 5 to next level`;
    el('#last-award').textContent = `Each tap earns ${multiplier} ${multiplier === 1 ? 'point' : 'points'}`;
    if (multiplier !== lastMultiplier && multiplier > 1) announce(`${multiplier} times combo. ${multiplier} points per tap.`);
  }
  lastMultiplier = multiplier;
}

function showPhase(): void {
  for (const phase of ['welcome', 'playing', 'over'] as const) el(`#${phase}-screen`).hidden = game.phase !== phase;
  el('#game').dataset.phase = game.phase;
  el<HTMLButtonElement>('#reset').disabled = game.phase === 'welcome';
  el('#status-dot').classList.toggle('is-playing', game.phase === 'playing');
  el('#round-status').textContent = game.phase === 'playing' ? 'Go on. You’ve got this.' : game.phase === 'over' ? 'Another round? The mouse is ready.' : 'Your next high score starts here';
}

function start(): void {
  cancelAnimationFrame(frame);
  const now = performance.now();
  roundId = crypto.randomUUID();
  roundSaved = false;
  effects.replaceChildren();
  game.start(now);
  lastSeconds = -1;
  lastMultiplier = 1;
  showPhase(); renderRound(now);
  mouseTarget.focus({ preventScroll: true });
  announce('Game started. 60 seconds. Tap the mouse or press Space to earn points.');
  playTone(520, 0.1);
  frame = requestAnimationFrame(tick);
}

function finish(): void {
  if (roundSaved) return;
  roundSaved = true;
  cancelAnimationFrame(frame);
  effects.replaceChildren();
  const isRecord = game.score > saved.best;
  const round: Round = { id: roundId, score: game.score, taps: game.taps, maxMultiplier: game.maxMultiplier, at: Date.now() };
  saved = addRound(saved, round); persist(); renderLeaderboard();
  el('#result-score').textContent = number.format(game.score);
  el('#result-taps').textContent = number.format(game.taps);
  el('#result-combo').textContent = `${game.maxMultiplier}×`;
  el('#result-badge').innerHTML = `${icon('trophy')}${isRecord ? 'New personal best!' : 'Round complete'}`;
  el('#result-badge').classList.toggle('new-best', isRecord);
  el('#result-save').textContent = storageAvailable ? 'Saved to your local leaderboard' : 'Saved for this visit only';
  showPhase(); renderRound(performance.now());
  el('#combo-tip').textContent = 'A fresh combo awaits.';
  if (!document.querySelector('dialog[open]')) el('#again').focus({ preventScroll: true });
  announce(`Round complete. ${game.score} points from ${game.taps} taps. ${isRecord ? 'A new personal best!' : 'Play again to beat your best.'}`);
  playTone(520, 0.12); playTone(650, 0.12, 0.12); playTone(780, 0.2, 0.24);
}

function tick(now: number): void {
  if (game.update(now)) { finish(); return; }
  renderRound(now);
  if (game.phase === 'playing') frame = requestAnimationFrame(tick);
}

function tap(event?: MouseEvent): void {
  const now = performance.now();
  const points = game.tap(now);
  if (game.phase === 'over') { finish(); return; }
  if (!points) return;
  renderRound(now);
  playTone(420 + points * 85, 0.055);
  if (!reducedMotion.matches) {
    mouseAnimation?.cancel();
    mouseAnimation = mouseTarget.querySelector<HTMLImageElement>('.mascot')!.animate([{ transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 140, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
  }
  const bounds = el('#playfield').getBoundingClientRect();
  const targetBounds = mouseTarget.getBoundingClientRect();
  const x = event && event.detail > 0 ? event.clientX - bounds.left : targetBounds.left + targetBounds.width * (0.4 + Math.random() * 0.2) - bounds.left;
  const y = event && event.detail > 0 ? event.clientY - bounds.top : targetBounds.top + targetBounds.height * 0.35 - bounds.top;
  const float = document.createElement('span');
  float.className = 'score-float'; float.textContent = `+${points}`;
  float.style.left = `${Math.max(24, Math.min(bounds.width - 40, x))}px`;
  float.style.top = `${Math.max(60, Math.min(bounds.height - 40, y))}px`;
  if (effects.children.length >= 32) effects.firstElementChild?.remove();
  effects.append(float);
  window.setTimeout(() => float.remove(), 650);
}

function reset(): void {
  cancelAnimationFrame(frame); mouseAnimation?.cancel(); effects.replaceChildren();
  game.reset(); lastSeconds = -1; showPhase(); renderRound(performance.now());
  el('#combo-tip').textContent = 'Keep a quick rhythm';
  el('#start').focus({ preventScroll: true });
  announce('Game reset. Your saved scores are kept. Start a new round when you’re ready.');
}

const helpDialog = el<HTMLDialogElement>('#help-dialog');
const confirmDialog = el<HTMLDialogElement>('#confirm-dialog');
// Native dialogs make the page inert; wrap Tab between their own action buttons.
for (const dialog of [helpDialog, confirmDialog]) {
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
}
let confirmedAction: (() => void) | null = null;
function confirm(title: string, description: string, actionLabel: string, action: () => void): void {
  el('#confirm-title').textContent = title; el('#confirm-description').textContent = description;
  el('#confirm-action').textContent = actionLabel;
  confirmedAction = action; confirmDialog.returnValue = 'cancel'; confirmDialog.showModal();
}
confirmDialog.querySelector('form')!.addEventListener('submit', event => {
  event.preventDefault();
  const accepted = (event.submitter as HTMLButtonElement | null)?.value === 'confirm';
  const action = accepted ? confirmedAction : null;
  confirmedAction = null;
  confirmDialog.close(accepted ? 'confirm' : 'cancel');
  action?.();
});
confirmDialog.addEventListener('cancel', () => { confirmedAction = null; });
confirmDialog.addEventListener('close', () => {
  if (confirmDialog.open) return;
  if (game.phase === 'over' && el('#reset') !== document.activeElement) el('#again').focus({ preventScroll: true });
});
el('#help').addEventListener('click', () => helpDialog.showModal());
el('#close-help').addEventListener('click', () => helpDialog.close());
el('#got-it').addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('close', () => { if (game.phase === 'over') el('#again').focus({ preventScroll: true }); });
el('#start').addEventListener('click', start);
el('#again').addEventListener('click', start);
mouseTarget.addEventListener('click', tap);
mouseTarget.addEventListener('keydown', event => {
  if (event.code === 'Space' || event.key === 'Enter') {
    event.preventDefault();
    if (!event.repeat) tap();
  }
});
mouseTarget.addEventListener('contextmenu', event => event.preventDefault());
el('#reset').addEventListener('click', () => {
  if (game.phase === 'playing') confirm('Reset this round?', 'Your current points will be discarded. Your saved scores will stay. The clock keeps running until you reset.', 'Reset round', reset);
  else reset();
});
el('#clear').addEventListener('click', () => confirm('Clear saved scores?', 'This removes your personal best and all saved rounds from this browser. This cannot be undone.', 'Clear scores', () => {
  saved = emptyScores(); persist(); renderLeaderboard();
  if (game.phase === 'over') el('#result-save').textContent = 'Saved scores cleared';
  announce('Saved scores cleared. Your next round starts a new leaderboard.');
}));
el('#sort-top').addEventListener('click', () => { sortMode = 'top'; renderLeaderboard(); });
el('#sort-recent').addEventListener('click', () => { sortMode = 'recent'; renderLeaderboard(); });
document.addEventListener('visibilitychange', () => {
  if (game.phase === 'playing' && game.update(performance.now())) finish();
});
window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY || event.key === null) { saved = parseScores(event.newValue); renderLeaderboard(); }
});
reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) mouseAnimation?.cancel(); });

let audio: AudioContext | undefined;
let sound = false;
function playTone(frequency: number, length: number, delay = 0): void {
  if (!sound || !audio) return;
  try {
    const startAt = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, startAt + length);
    gain.gain.setValueAtTime(0.025, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + length);
    oscillator.connect(gain); gain.connect(audio.destination);
    oscillator.start(startAt); oscillator.stop(startAt + length);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  } catch { /* Sound never interrupts a round. */ }
}
el('#sound').addEventListener('click', async () => {
  try {
    if (!sound) { audio ??= new AudioContext(); await audio.resume(); }
    sound = !sound;
    el('#sound').setAttribute('aria-pressed', String(sound));
    el('#sound-label').textContent = sound ? 'Sound on' : 'Sound off';
    el('#sound-icon').innerHTML = icon(sound ? 'sound' : 'mute');
    if (sound) playTone(600, 0.07);
  } catch { announce('Sound is unavailable in this browser. You can still play.'); }
});

showPhase(); renderLeaderboard(); renderRound(performance.now());
