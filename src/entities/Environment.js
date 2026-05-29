import * as THREE from 'three';
import { GAME_CONFIG } from '../core/config.js';

// Each ground tile is TILE_LENGTH long. We keep TILE_COUNT of them and
// recycle whichever one falls behind the player to the far end of the track.
const TILE_LENGTH = 30;
const TILE_COUNT = 8;
const ROAD_WIDTH = 7;
const TREES_PER_TILE = 5;

/**
 * Environment streams the ground, road markings, and roadside scenery in
 * an endless loop. Tiles are not destroyed — they're repositioned ahead of
 * the player when they fall behind, so we never allocate during play.
 */
export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.tiles = [];

    // Shared materials, so all tiles draw with the same buffers.
    this._roadMat = new THREE.MeshStandardMaterial({
      color: 0x3f4654,
      roughness: 0.95,
    });
    this._lineMat = new THREE.MeshBasicMaterial({ color: 0xffe680 });
    this._grassMat = new THREE.MeshStandardMaterial({
      color: 0x4f9656,
      roughness: 1,
    });
    this._trunkMat = new THREE.MeshStandardMaterial({
      color: 0x6b4423,
      roughness: 0.9,
    });
    this._leavesMat = new THREE.MeshStandardMaterial({
      color: 0x2e7d4f,
      roughness: 0.85,
    });

    for (let i = 0; i < TILE_COUNT; i++) {
      const tile = this._buildTile();
      tile.position.z = -i * TILE_LENGTH;
      this.scene.add(tile);
      this.tiles.push(tile);
    }
  }

  _buildTile() {
    const group = new THREE.Group();

    // Road surface — a plane laid flat in the XZ plane.
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_WIDTH, TILE_LENGTH),
      this._roadMat,
    );
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    group.add(road);

    // Lane dividers between the three lanes.
    for (const lineX of [-1, 1]) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.08, TILE_LENGTH),
        this._lineMat,
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(lineX, 0.01, 0);
      group.add(line);
    }

    // Grass shoulders extending well past the road.
    for (const sx of [-1, 1]) {
      const grass = new THREE.Mesh(
        new THREE.PlaneGeometry(40, TILE_LENGTH),
        this._grassMat,
      );
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(sx * (ROAD_WIDTH / 2 + 20), -0.01, 0);
      grass.receiveShadow = true;
      group.add(grass);
    }

    // Scenery: a handful of low-poly trees per tile. Positions are
    // re-randomized whenever the tile cycles, so the world doesn't look
    // like a short loop.
    const trees = [];
    for (let i = 0; i < TREES_PER_TILE; i++) {
      const tree = this._buildTree();
      group.add(tree);
      trees.push(tree);
    }
    group.userData.trees = trees;
    this._scatterTrees(trees);

    return group;
  }

  _buildTree() {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 1.4, 8),
      this._trunkMat,
    );
    trunk.position.y = 0.7;
    trunk.castShadow = true;
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 1.8, 8),
      this._leavesMat,
    );
    leaves.position.y = 2.0;
    leaves.castShadow = true;
    tree.add(trunk, leaves);
    return tree;
  }

  _scatterTrees(trees) {
    for (const tree of trees) {
      const side = Math.random() < 0.5 ? -1 : 1;
      tree.position.set(
        side * (ROAD_WIDTH / 2 + 3 + Math.random() * 15),
        0,
        (Math.random() - 0.5) * TILE_LENGTH,
      );
      const scale = 0.8 + Math.random() * 0.7;
      tree.scale.setScalar(scale);
      tree.rotation.y = Math.random() * Math.PI * 2;
    }
  }

  update(playerZ) {
    // If a tile drops more than one tile-length behind the player, move it
    // to the front of the track (most-negative Z).
    for (const tile of this.tiles) {
      if (tile.position.z > playerZ + TILE_LENGTH) {
        let minZ = Infinity;
        for (const t of this.tiles) {
          if (t.position.z < minZ) minZ = t.position.z;
        }
        tile.position.z = minZ - TILE_LENGTH;
        this._scatterTrees(tile.userData.trees);
      }
    }
  }

  reset() {
    for (let i = 0; i < this.tiles.length; i++) {
      this.tiles[i].position.z = -i * TILE_LENGTH;
      this._scatterTrees(this.tiles[i].userData.trees);
    }
  }
}
