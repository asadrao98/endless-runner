import { Game } from './core/Game.js';

// Entry point: grab the canvas + UI root and boot the game.
const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

const game = new Game(canvas, uiRoot);
game.start();

// Surface unhandled errors visually rather than dying silently.
window.addEventListener('error', (e) => {
  console.error('Game error:', e.error || e.message);
});
