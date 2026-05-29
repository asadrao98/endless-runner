import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { Game } from './core/Game.js';

// Firebase web API keys are public project identifiers, not secrets —
// safe to ship in client code.
const firebaseConfig = {
  apiKey: 'AIzaSyBqOymIerbYKw68OvBvSIS9MhPIY5Kw0vo',
  authDomain: 'endless-runn.firebaseapp.com',
  projectId: 'endless-runn',
  storageBucket: 'endless-runn.firebasestorage.app',
  messagingSenderId: '970248618402',
  appId: '1:970248618402:web:26385aa77d2e17d6ad32fb',
  measurementId: 'G-PF70JXMSZC',
};

const firebaseApp = initializeApp(firebaseConfig);
// Analytics only works in supported browser contexts — guard so it doesn't
// throw in unsupported environments (file://, some embedded webviews, etc).
isSupported()
  .then((ok) => {
    if (ok) getAnalytics(firebaseApp);
  })
  .catch(() => {});

// Entry point: grab the canvas + UI root and boot the game.
const canvas = document.getElementById('game-canvas');
const uiRoot = document.getElementById('ui-root');

const game = new Game(canvas, uiRoot);
game.start();

// Surface unhandled errors visually rather than dying silently.
window.addEventListener('error', (e) => {
  console.error('Game error:', e.error || e.message);
});
