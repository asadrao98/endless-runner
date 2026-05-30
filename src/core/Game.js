import * as THREE from 'three';
import { GAME_CONFIG } from './config.js';
import { Player } from '../entities/Player.js';
import { Environment } from '../entities/Environment.js';
import { ObstacleManager } from '../entities/ObstacleManager.js';
import { CoinManager } from '../entities/CoinManager.js';
import { UI } from '../ui/UI.js';

const HIGHSCORE_KEY = 'endlessRunner.highScore';

/**
 * Game orchestrates the scene, the game loop, and all sub-systems.
 * It owns the renderer / camera / scene, drives delta-time updates,
 * and coordinates state transitions (menu -> playing -> over).
 */
export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;

    // 'menu' | 'playing' | 'over'
    this.state = 'menu';

    this._setupRenderer();
    this._setupScene();
    this._setupCamera();
    this._setupLights();

    // Sub-systems. Each one owns its own meshes and pooling.
    this.environment = new Environment(this.scene);
    this.player = new Player(this.scene, this.canvas);
    this.obstacleManager = new ObstacleManager(this.scene);
    this.coinManager = new CoinManager(this.scene);

    this.ui = new UI(uiRoot, {
      onStart: () => this._startGame(),
      onRestart: () => this._restartGame(),
    });

    // Run-scoped state, reset in _reset().
    this.score = 0;
    this.coins = 0;
    this.distance = 0;
    this.speed = GAME_CONFIG.initialSpeed;
    this.elapsedTime = 0;
    this._obstacleTimer = 0;
    this._coinTimer = 0;
    this._cameraShake = 0;

    this.highScore = this._loadHighScore();

    this._lastTime = performance.now();
    this._boundLoop = (t) => this._loop(t);

    window.addEventListener('resize', () => this._onResize());
    this._onResize();

    this.ui.showMenu(this.highScore);
  }

  // -- setup helpers ---------------------------------------------------------

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    const sky = new THREE.Color('#8ec5ff');
    this.scene.background = sky;
    // Fog helps hide pop-in at the spawn line and adds depth.
    this.scene.fog = new THREE.Fog(sky.getHex(), 35, 110);
  }

  _setupCamera() {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 250);
    this.camera.position.set(0, 5, 8);
    this.camera.lookAt(0, 1, -10);
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    // A hemisphere light gives a nicer sky/ground bounce than ambient alone.
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x405040, 0.35);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(12, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const d = 30;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    this.sun = sun;
  }

  // -- lifecycle -------------------------------------------------------------

  start() {
    requestAnimationFrame(this._boundLoop);
  }

  _startGame() {
    this._reset();
    this.state = 'playing';
    this.ui.showHUD();
  }

  _restartGame() {
    this._reset();
    this.state = 'playing';
    this.ui.showHUD();
  }

  _reset() {
    this.score = 0;
    this.coins = 0;
    this.distance = 0;
    this.speed = GAME_CONFIG.initialSpeed;
    this.elapsedTime = 0;
    this._obstacleTimer = 0.4; // small grace period before first obstacle.
    this._coinTimer = 0.2;
    this._cameraShake = 0;

    this.player.reset();
    this.obstacleManager.reset();
    this.coinManager.reset();
    this.environment.reset();

    // Snap camera so the start of the run isn't a slow pan.
    this.camera.position.set(0, 5.5, 8);
    this.camera.lookAt(0, 1, -10);

    this.ui.updateHUD({ score: 0, coins: 0, distance: 0 });
  }

  _gameOver() {
    this.state = 'over';
    this._cameraShake = 0.45;
    const score = Math.floor(this.score);
    if (score > this.highScore) {
      this.highScore = score;
      this._saveHighScore(score);
    }
    this.ui.showGameOver({
      score,
      coins: this.coins,
      distance: Math.floor(this.distance),
      highScore: this.highScore,
    });
  }

  // -- loop ------------------------------------------------------------------

  _loop(now) {
    // Clamp dt so a long tab-switch pause doesn't teleport everything.
    const dt = Math.min((now - this._lastTime) / 1000, 0.05);
    this._lastTime = now;

    if (this.state === 'playing') {
      this._update(dt);
    }

    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this._boundLoop);
  }

  _update(dt) {
    this.elapsedTime += dt;

    // Ramp up the run speed slowly.
    this.speed = Math.min(
      GAME_CONFIG.maxSpeed,
      GAME_CONFIG.initialSpeed + this.elapsedTime * GAME_CONFIG.speedRamp,
    );

    const distMoved = this.speed * dt;
    this.distance += distMoved;
    this.score += distMoved * 0.5; // 0.5 pt / meter from running

    this.player.update(dt);
    this.player.advance(distMoved);

    // Spawn cadence: obstacles get tighter, coins stay steady.
    const difficulty = Math.min(
      1,
      this.elapsedTime / GAME_CONFIG.difficultyRampSeconds,
    );
    const obstacleInterval = THREE.MathUtils.lerp(
      GAME_CONFIG.obstacleSpawnIntervalMax,
      GAME_CONFIG.obstacleSpawnIntervalMin,
      difficulty,
    );

    this._obstacleTimer -= dt;
    if (this._obstacleTimer <= 0) {
      this.obstacleManager.spawn(this.player.position.z);
      this._obstacleTimer = obstacleInterval;
    }

    this._coinTimer -= dt;
    if (this._coinTimer <= 0) {
      this.coinManager.spawn(
        this.player.position.z,
        this.obstacleManager.getReservedLanesNear(this.player.position.z),
      );
      this._coinTimer = GAME_CONFIG.coinSpawnInterval;
    }

    this.obstacleManager.update(dt, this.player.position.z);
    this.coinManager.update(dt, this.player.position.z);
    this.environment.update(this.player.position.z);

    // Collision pass.
    const playerBox = this.player.getBoundingBox();

    const collected = this.coinManager.checkCollision(playerBox);
    if (collected > 0) {
      this.coins += collected;
      this.score += collected * 10;
    }

    if (this.obstacleManager.checkCollision(playerBox, this.player.lane)) {
      this._gameOver();
      return;
    }

    this.ui.updateHUD({
      score: Math.floor(this.score),
      coins: this.coins,
      distance: Math.floor(this.distance),
    });
  }

  _updateCamera(dt) {
    const target = this.player.position;

    // Smooth-follow with slight lateral lean so lane changes feel responsive.
    const desiredX = target.x * 0.45;
    const desiredY = target.y + 4.8;
    const desiredZ = target.z + 7.8;

    // Frame-rate independent damping via 1 - exp(-k*dt).
    const lerpXY = 1 - Math.exp(-8 * dt);
    const lerpZ = 1 - Math.exp(-12 * dt);

    this.camera.position.x += (desiredX - this.camera.position.x) * lerpXY;
    this.camera.position.y += (desiredY - this.camera.position.y) * lerpXY;
    this.camera.position.z += (desiredZ - this.camera.position.z) * lerpZ;

    if (this._cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this._cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this._cameraShake;
      this._cameraShake = Math.max(0, this._cameraShake - dt * 1.8);
    }

    this.camera.lookAt(target.x * 0.3, target.y + 1.2, target.z - 8);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // -- persistence -----------------------------------------------------------

  _loadHighScore() {
    try {
      const v = localStorage.getItem(HIGHSCORE_KEY);
      return v ? parseInt(v, 10) || 0 : 0;
    } catch {
      return 0;
    }
  }

  _saveHighScore(v) {
    try {
      localStorage.setItem(HIGHSCORE_KEY, String(v));
    } catch {
      /* storage may be unavailable in private mode — ignore */
    }
  }
}
