/**
 * UI owns the three DOM overlays — start menu, in-game HUD, game-over modal.
 * Each is built once at boot and toggled via the `hidden` class so the
 * runtime cost of switching screens is zero.
 */
export class UI {
  constructor(root, { onStart, onRestart }) {
    this.root = root;
    this.onStart = onStart;
    this.onRestart = onRestart;

    this._buildMenu();
    this._buildHUD();
    this._buildGameOver();
  }

  _buildMenu() {
    this.menu = document.createElement('div');
    this.menu.className = 'screen hidden';
    this.menu.innerHTML = `
      <div class="panel">
        <div class="title">Runvora</div>
        <div class="subtitle">Dodge. Collect. Survive.</div>
        <div class="controls">
          <span class="key">← / A</span><span>Move left</span>
          <span class="key">→ / D</span><span>Move right</span>
          <span class="key">Space</span><span>Jump</span>
        </div>
        <div class="subtitle touch-hint">On mobile: swipe to move, tap or swipe up to jump.</div>
        <div class="subtitle">Best: <span class="best">0</span></div>
        <button class="btn start-btn" type="button">Play</button>
      </div>
    `;
    this._bestEl = this.menu.querySelector('.best');
    this.menu
      .querySelector('.start-btn')
      .addEventListener('click', () => this.onStart());
    this.root.appendChild(this.menu);
  }

  _buildHUD() {
    this.hud = document.createElement('div');
    this.hud.className = 'hud hidden';
    this.hud.innerHTML = `
      <div class="hud-row">
        <span class="hud-label">Score</span>
        <span class="hud-value score">0</span>
      </div>
      <div class="hud-row">
        <span class="hud-label">Distance</span>
        <span class="hud-value distance">0m</span>
      </div>
      <div class="hud-row">
        <span class="hud-label">Coins</span>
        <span class="hud-value coin coins">0</span>
      </div>
    `;
    this._scoreEl = this.hud.querySelector('.score');
    this._distEl = this.hud.querySelector('.distance');
    this._coinsEl = this.hud.querySelector('.coins');
    this.root.appendChild(this.hud);
  }

  _buildGameOver() {
    this.over = document.createElement('div');
    this.over.className = 'screen hidden';
    this.over.innerHTML = `
      <div class="panel">
        <div class="title">Game Over</div>
        <div class="subtitle new-best hidden">New high score!</div>
        <div class="stats">
          <div class="stat">
            <div class="stat-label">Score</div>
            <div class="stat-value final-score">0</div>
          </div>
          <div class="stat">
            <div class="stat-label">Distance</div>
            <div class="stat-value final-distance">0m</div>
          </div>
          <div class="stat">
            <div class="stat-label">Coins</div>
            <div class="stat-value final-coins">0</div>
          </div>
          <div class="stat">
            <div class="stat-label">Best</div>
            <div class="stat-value final-best">0</div>
          </div>
        </div>
        <button class="btn restart-btn" type="button">Play again</button>
      </div>
    `;
    this._finalScore = this.over.querySelector('.final-score');
    this._finalDist = this.over.querySelector('.final-distance');
    this._finalCoins = this.over.querySelector('.final-coins');
    this._finalBest = this.over.querySelector('.final-best');
    this._newBest = this.over.querySelector('.new-best');
    this.over
      .querySelector('.restart-btn')
      .addEventListener('click', () => this.onRestart());
    this.root.appendChild(this.over);
  }

  _showOnly(el) {
    this.menu.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.over.classList.add('hidden');
    if (el) el.classList.remove('hidden');
  }

  showMenu(highScore) {
    this._bestEl.textContent = highScore;
    this._showOnly(this.menu);
  }

  showHUD() {
    this._showOnly(this.hud);
  }

  showGameOver({ score, coins, distance, highScore }) {
    this._finalScore.textContent = score;
    this._finalDist.textContent = `${distance}m`;
    this._finalCoins.textContent = coins;
    this._finalBest.textContent = highScore;
    const isNewBest = score >= highScore && score > 0;
    this._newBest.classList.toggle('hidden', !isNewBest);
    this._showOnly(this.over);
  }

  updateHUD({ score, coins, distance }) {
    this._scoreEl.textContent = score;
    this._distEl.textContent = `${distance}m`;
    this._coinsEl.textContent = coins;
  }
}
