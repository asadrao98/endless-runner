import * as THREE from 'three';
import { GAME_CONFIG } from '../core/config.js';

/**
 * Obstacle type definitions. Each entry describes how to build a fresh mesh
 * for that type, plus the collision box info (size + vertical centre offset
 * from the mesh's origin).
 *
 * Add a new obstacle by appending a new entry here — see README.
 */
const OBSTACLE_TYPES = [
  {
    name: 'barrier',
    build: () => {
      const g = new THREE.Group();
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.35, 0.25),
        new THREE.MeshStandardMaterial({ color: 0xff4d4d, roughness: 0.55 }),
      );
      beam.position.y = 1.1;
      beam.castShadow = true;

      const postGeom = new THREE.BoxGeometry(0.14, 1.1, 0.14);
      const postMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.6,
      });
      const postL = new THREE.Mesh(postGeom, postMat);
      postL.position.set(-0.7, 0.55, 0);
      postL.castShadow = true;
      const postR = new THREE.Mesh(postGeom, postMat);
      postR.position.set(0.7, 0.55, 0);
      postR.castShadow = true;

      g.add(beam, postL, postR);
      return {
        mesh: g,
        size: new THREE.Vector3(1.6, 1.3, 0.3),
        centerY: 0.65,
      };
    },
  },
  {
    name: 'cone',
    build: () => {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 1.1, 14),
        new THREE.MeshStandardMaterial({ color: 0xff8a00, roughness: 0.5 }),
      );
      m.position.y = 0.55;
      m.castShadow = true;
      return {
        mesh: m,
        size: new THREE.Vector3(0.8, 1.1, 0.8),
        centerY: 0.55,
      };
    },
  },
  {
    name: 'block',
    build: () => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 1.3, 1.3),
        new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.75 }),
      );
      m.position.y = 0.65;
      m.castShadow = true;
      return {
        mesh: m,
        size: new THREE.Vector3(1.3, 1.3, 1.3),
        centerY: 0.65,
      };
    },
  },
];

/**
 * ObstacleManager handles spawning, recycling, and collision tests for
 * obstacles. It maintains a per-type pool so we never garbage-collect
 * meshes during play.
 */
export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    // pools keyed by typeIndex.
    this.pools = OBSTACLE_TYPES.map(() => []);

    this._box = new THREE.Box3();
    this._tmpCenter = new THREE.Vector3();
    this._tmpSize = new THREE.Vector3();
  }

  // -- pooling ---------------------------------------------------------------

  _acquire(typeIndex) {
    const pool = this.pools[typeIndex];
    if (pool.length > 0) {
      const o = pool.pop();
      o.mesh.visible = true;
      this.scene.add(o.mesh);
      return o;
    }
    const built = OBSTACLE_TYPES[typeIndex].build();
    return {
      typeIndex,
      mesh: built.mesh,
      size: built.size,
      centerY: built.centerY,
    };
  }

  _release(o) {
    this.scene.remove(o.mesh);
    o.mesh.visible = false;
    this.pools[o.typeIndex].push(o);
  }

  // -- spawning --------------------------------------------------------------

  spawn(playerZ) {
    // 60% single obstacle, 40% two — but never block all three lanes,
    // and never the same lane twice.
    const wantPair = Math.random() < 0.4;
    const laneIndices = [0, 1, 2];
    // Fisher–Yates shuffle.
    for (let i = laneIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [laneIndices[i], laneIndices[j]] = [laneIndices[j], laneIndices[i]];
    }
    const count = wantPair ? 2 : 1;

    const z = playerZ - GAME_CONFIG.spawnDistance;
    for (let i = 0; i < count; i++) {
      const lane = laneIndices[i];
      const typeIndex = Math.floor(Math.random() * OBSTACLE_TYPES.length);
      const o = this._acquire(typeIndex);
      o.laneIndex = lane;
      o.mesh.position.x = GAME_CONFIG.lanes[lane];
      o.mesh.position.z = z;
      this.active.push(o);
    }
  }

  // -- per-frame -------------------------------------------------------------

  update(dt, playerZ) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i];
      if (o.mesh.position.z > playerZ + GAME_CONFIG.despawnDistance) {
        this.active.splice(i, 1);
        this._release(o);
      }
    }
  }

  checkCollision(playerBox, playerLane) {
    // Lane-based gate: the player only collides with obstacles in their
    // *logical* lane (the integer set on keypress), not their visual X.
    // This prevents phantom hits while the lane-change lerp is mid-flight
    // and the avatar's bounding box is grazing an adjacent lane.
    for (const o of this.active) {
      if (o.laneIndex !== playerLane) continue;

      this._tmpCenter.set(
        o.mesh.position.x,
        o.centerY,
        o.mesh.position.z,
      );
      this._tmpSize.copy(o.size);
      this._box.setFromCenterAndSize(this._tmpCenter, this._tmpSize);
      // Shrink collision box slightly so near-misses feel fair.
      this._box.expandByScalar(-0.08);
      if (this._box.intersectsBox(playerBox)) return true;
    }
    return false;
  }

  /**
   * Returns a set of lane indices that are occupied near a target Z.
   * The coin manager uses this to avoid spawning coins on top of obstacles.
   */
  getReservedLanesNear(playerZ) {
    const reserved = new Set();
    const spawnZ = playerZ - GAME_CONFIG.spawnDistance;
    for (const o of this.active) {
      if (Math.abs(o.mesh.position.z - spawnZ) < 8) {
        // Map x back to lane index.
        const laneIdx = GAME_CONFIG.lanes.indexOf(o.mesh.position.x);
        if (laneIdx >= 0) reserved.add(laneIdx);
      }
    }
    return reserved;
  }

  reset() {
    while (this.active.length > 0) {
      this._release(this.active.pop());
    }
  }
}
