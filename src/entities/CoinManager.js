import * as THREE from 'three';
import { GAME_CONFIG } from '../core/config.js';

const COIN_HEIGHT = 1.2;
const COINS_PER_GROUP = 5;
const COIN_GAP = 1.4;
const ELEVATED_CHANCE = 0.2;
const ELEVATED_Y = COIN_HEIGHT + 1.4;

/**
 * CoinManager spawns short runs of floating, spinning coins, recycles them
 * once they pass the player, and reports collisions back as a count of
 * coins collected this frame.
 */
export class CoinManager {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.pool = [];

    // Geometry rotated so the disc faces forward (toward +Z); spinning the
    // mesh around Y then animates the familiar face → edge → face cycle.
    this._coinGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16);
    this._coinGeom.rotateX(Math.PI / 2);

    this._coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd54a,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0x553300,
      emissiveIntensity: 0.3,
    });

    this._box = new THREE.Box3();
    this._tmpCenter = new THREE.Vector3();
    this._tmpSize = new THREE.Vector3(0.75, 0.75, 0.75);
  }

  _acquire() {
    if (this.pool.length > 0) {
      const c = this.pool.pop();
      c.mesh.visible = true;
      this.scene.add(c.mesh);
      return c;
    }
    const mesh = new THREE.Mesh(this._coinGeom, this._coinMat);
    mesh.castShadow = true;
    return { mesh };
  }

  _release(c) {
    this.scene.remove(c.mesh);
    c.mesh.visible = false;
    this.pool.push(c);
  }

  /**
   * Spawn one short line of coins ahead of the player, in a lane that the
   * ObstacleManager hasn't reserved. Occasionally place them high so the
   * player has to jump for them.
   */
  spawn(playerZ, reservedLanes) {
    const available = [0, 1, 2].filter((l) => !reservedLanes.has(l));
    const lanes = available.length > 0 ? available : [0, 1, 2];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];

    const spawnZ = playerZ - GAME_CONFIG.spawnDistance;
    const elevated = Math.random() < ELEVATED_CHANCE;
    const y = elevated ? ELEVATED_Y : COIN_HEIGHT;

    for (let i = 0; i < COINS_PER_GROUP; i++) {
      const c = this._acquire();
      c.mesh.position.set(
        GAME_CONFIG.lanes[lane],
        y,
        spawnZ - i * COIN_GAP,
      );
      this.active.push(c);
    }
  }

  update(dt, playerZ) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const c = this.active[i];
      // Spin around Y so the coin flashes between face and edge views.
      c.mesh.rotation.y += dt * 4;
      if (c.mesh.position.z > playerZ + GAME_CONFIG.despawnDistance) {
        this.active.splice(i, 1);
        this._release(c);
      }
    }
  }

  /**
   * Tests every active coin against the player's bounding box. Returns the
   * number collected this frame so the game can credit score + counter.
   */
  checkCollision(playerBox) {
    let collected = 0;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const c = this.active[i];
      this._tmpCenter.copy(c.mesh.position);
      this._box.setFromCenterAndSize(this._tmpCenter, this._tmpSize);
      if (this._box.intersectsBox(playerBox)) {
        this.active.splice(i, 1);
        this._release(c);
        collected++;
      }
    }
    return collected;
  }

  reset() {
    while (this.active.length > 0) {
      this._release(this.active.pop());
    }
  }
}
