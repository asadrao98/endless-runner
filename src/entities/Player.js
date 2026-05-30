import * as THREE from 'three';
import { GAME_CONFIG } from '../core/config.js';

/**
 * Player is a low-poly humanoid built from primitives, with procedural
 * limb-swing run animation, jump physics, lane snapping, and a
 * recomputed bounding box for collision checks.
 */
export class Player {
  constructor(scene, canvas) {
    this.scene = scene;
    this.canvas = canvas;
    this.group = new THREE.Group();
    this.position = this.group.position;

    this._buildMesh();
    scene.add(this.group);

    this.lane = 1; // 0=left, 1=center, 2=right
    this.targetX = GAME_CONFIG.lanes[this.lane];
    this.velocityY = 0;
    this.onGround = true;
    this.isJumping = false;
    this.runTime = 0;

    // Collision box is intentionally narrower than the visible mesh so
    // near-misses in adjacent lanes feel fair. Width/depth fit inside one
    // lane with margin; height covers torso + legs (head pokes above).
    this._box = new THREE.Box3();
    this._boxCenter = new THREE.Vector3();
    this._boxSize = new THREE.Vector3(0.5, 1.5, 0.5);

    this._bindInput();
    this._bindTouch();
  }

  // -- construction ----------------------------------------------------------

  _buildMesh() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xff5566,
      roughness: 0.6,
    });
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffd9a3,
      roughness: 0.6,
    });
    const limbMat = new THREE.MeshStandardMaterial({
      color: 0x2c3aa0,
      roughness: 0.6,
    });

    // Torso
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.9, 0.4),
      bodyMat,
    );
    body.position.y = 1.15;
    body.castShadow = true;
    this.group.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 16),
      headMat,
    );
    head.position.y = 1.9;
    head.castShadow = true;
    this.group.add(head);
    this.head = head;

    // Arms — geometry is offset so the mesh pivots around the shoulder,
    // not the centre of the limb. This makes rotation.x look like a swing.
    const armGeom = new THREE.BoxGeometry(0.18, 0.7, 0.18);
    armGeom.translate(0, -0.35, 0);
    this.armL = new THREE.Mesh(armGeom, limbMat);
    this.armR = new THREE.Mesh(armGeom, limbMat);
    this.armL.position.set(-0.45, 1.55, 0);
    this.armR.position.set(0.45, 1.55, 0);
    this.armL.castShadow = true;
    this.armR.castShadow = true;
    this.group.add(this.armL, this.armR);

    // Legs — same pivot trick.
    const legGeom = new THREE.BoxGeometry(0.22, 0.75, 0.22);
    legGeom.translate(0, -0.375, 0);
    this.legL = new THREE.Mesh(legGeom, limbMat);
    this.legR = new THREE.Mesh(legGeom, limbMat);
    this.legL.position.set(-0.18, 0.75, 0);
    this.legR.position.set(0.18, 0.75, 0);
    this.legL.castShadow = true;
    this.legR.castShadow = true;
    this.group.add(this.legL, this.legR);
  }

  // -- input -----------------------------------------------------------------

  _bindInput() {
    this._onKey = (e) => {
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          this.moveLeft();
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.moveRight();
          break;
        case 'Space':
        case 'ArrowUp':
        case 'KeyW':
          this.jump();
          e.preventDefault();
          break;
      }
    };
    window.addEventListener('keydown', this._onKey);
  }

  // Touch controls: swipe left/right to change lanes, swipe up or tap to
  // jump. Bound to the canvas so taps on menu / game-over panels don't
  // leak into gameplay actions.
  _bindTouch() {
    if (!this.canvas) return;

    const SWIPE_PX = 28;
    const TAP_PX = 16;
    const TAP_MS = 220;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let activeId = null;

    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (activeId !== null) return;
        const t = e.changedTouches[0];
        activeId = t.identifier;
        startX = t.clientX;
        startY = t.clientY;
        startTime = performance.now();
      },
      { passive: true },
    );

    const onEnd = (e) => {
      let touch = null;
      for (const t of e.changedTouches) {
        if (t.identifier === activeId) {
          touch = t;
          break;
        }
      }
      if (!touch) return;
      activeId = null;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dt = performance.now() - startTime;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      // Quick stationary touch → jump.
      if (dt < TAP_MS && adx < TAP_PX && ady < TAP_PX) {
        this.jump();
        return;
      }
      // Otherwise pick the dominant swipe axis.
      if (adx > ady) {
        if (adx > SWIPE_PX) {
          if (dx < 0) this.moveLeft();
          else this.moveRight();
        }
      } else if (dy < -SWIPE_PX) {
        this.jump();
      }
    };

    this.canvas.addEventListener('touchend', onEnd, { passive: true });
    this.canvas.addEventListener(
      'touchcancel',
      () => {
        activeId = null;
      },
      { passive: true },
    );
  }

  moveLeft() {
    if (this.lane > 0) {
      this.lane--;
      this.targetX = GAME_CONFIG.lanes[this.lane];
    }
  }

  moveRight() {
    if (this.lane < GAME_CONFIG.lanes.length - 1) {
      this.lane++;
      this.targetX = GAME_CONFIG.lanes[this.lane];
    }
  }

  jump() {
    if (this.onGround) {
      this.velocityY = GAME_CONFIG.jumpVelocity;
      this.onGround = false;
      this.isJumping = true;
    }
  }

  // -- per-frame -------------------------------------------------------------

  reset() {
    this.group.position.set(0, 0, 0);
    this.lane = 1;
    this.targetX = GAME_CONFIG.lanes[1];
    this.velocityY = 0;
    this.onGround = true;
    this.isJumping = false;
    this.runTime = 0;
    this.armL.rotation.set(0, 0, 0);
    this.armR.rotation.set(0, 0, 0);
    this.legL.rotation.set(0, 0, 0);
    this.legR.rotation.set(0, 0, 0);
  }

  update(dt) {
    // Snap to target lane with frame-rate-independent damping.
    const lerp = 1 - Math.exp(-12 * dt);
    this.group.position.x += (this.targetX - this.group.position.x) * lerp;

    // Jump physics.
    if (!this.onGround) {
      this.velocityY += GAME_CONFIG.gravity * dt;
      this.group.position.y += this.velocityY * dt;
      if (this.group.position.y <= 0) {
        this.group.position.y = 0;
        this.velocityY = 0;
        this.onGround = true;
        this.isJumping = false;
      }
    }

    // Procedural animation: sine-driven limb swing while running, tuck on jump.
    this.runTime += dt;
    if (this.isJumping) {
      this.armL.rotation.x = -1.3;
      this.armR.rotation.x = -1.3;
      this.legL.rotation.x = 0.7;
      this.legR.rotation.x = 0.7;
    } else {
      const swing = Math.sin(this.runTime * 14) * 0.95;
      this.armL.rotation.x = swing;
      this.armR.rotation.x = -swing;
      this.legL.rotation.x = -swing;
      this.legR.rotation.x = swing;
      // Tiny vertical bob on the head so the character feels alive.
      this.head.position.y = 1.9 + Math.abs(Math.sin(this.runTime * 14)) * 0.04;
    }
  }

  // The player doesn't actually run on a treadmill — they translate forward
  // (-Z). The whole world is procedurally streamed around them.
  advance(dz) {
    this.group.position.z -= dz;
  }

  getBoundingBox() {
    this._boxCenter.set(
      this.group.position.x,
      this.group.position.y + 0.75,
      this.group.position.z,
    );
    this._box.setFromCenterAndSize(this._boxCenter, this._boxSize);
    return this._box;
  }
}
