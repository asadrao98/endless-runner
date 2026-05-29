# Runvora

A minimal, modern Three.js endless runner. Three lanes, jump, collect coins,
dodge obstacles, ramp up speed forever. No assets required — everything is
built from primitive geometries.

## Setup

```bash
npm install
npm run dev
```

Vite opens the game in your default browser at `http://localhost:5173`.

For a production build:

```bash
npm run build
npm run preview
```

## Deploy to Firebase Hosting

The project is wired up for the Firebase project `endless-runn`, hosting
on a site named `runvora` (URL: `https://runvora.web.app`).

First-time setup on a machine:

```bash
npx firebase login
npx firebase hosting:sites:create runvora   # only needed once, ever
```

Then build and deploy:

```bash
npm run deploy
```

That runs `vite build` and uploads `dist/` to the `runvora` site. To change
the project, edit `.firebaserc`; to change the site, edit the `site` field
in `firebase.json`. Cache rules: long cache for hashed assets, no cache for
`index.html`.

## Controls

| Key            | Action     |
| -------------- | ---------- |
| `←` / `A`      | Move left  |
| `→` / `D`      | Move right |
| `Space` / `W`  | Jump       |

## Project structure

```
endless-runner/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.js              # Entry point — boots the Game class
    ├── styles.css           # HUD, menu, and game-over styles
    ├── core/
    │   ├── Game.js          # Orchestrator: scene, loop, state machine
    │   └── config.js        # Central tuning constants
    ├── entities/
    │   ├── Player.js        # Primitive-built character + run/jump anim
    │   ├── ObstacleManager.js   # Pooled obstacles: barriers, cones, blocks
    │   ├── CoinManager.js   # Pooled spinning coins
    │   └── Environment.js   # Streaming ground tiles + roadside trees
    └── ui/
        └── UI.js            # Start menu, HUD, game-over modal
```

## Architecture

`Game` is the orchestrator. It owns the renderer, scene, camera, and the
five subsystems (`Player`, `ObstacleManager`, `CoinManager`, `Environment`,
`UI`). Each subsystem owns its own meshes and pooling — `Game` only
coordinates the loop, the state machine (`menu → playing → over`), and
score / persistence.

The game loop is a single `requestAnimationFrame` callback. Delta time is
clamped to 50 ms so a backgrounded tab can't teleport the world forward.
Per frame:

1. If state is `playing`: ramp speed, advance player, tick spawn timers,
   update obstacles / coins / environment, run collision pass, update HUD.
2. Always: smooth-follow the camera (with optional shake) and render.

The player doesn't run on a treadmill — they actually translate forward
(`-Z`). All world content is procedurally streamed around them, which keeps
positions numerically stable for a long time.

High scores live in `localStorage` under `endlessRunner.highScore`.

## Procedural spawning

There are two spawn streams driven by separate timers in `Game._update`:

- **Obstacles** — interval lerps from `obstacleSpawnIntervalMax` down to
  `obstacleSpawnIntervalMin` over `difficultyRampSeconds` seconds.
  Each spawn picks 1 or 2 lanes (never all 3) and a random obstacle type.
- **Coins** — fixed interval (`coinSpawnInterval`). The manager asks the
  obstacle manager which lanes are reserved at the spawn line and avoids
  them, so a coin line never lands on top of a block. ~20 % of coin lines
  are elevated, forcing a jump.

Both streams place objects at `playerZ - spawnDistance` (well ahead of the
player) and recycle them once they pass `playerZ + despawnDistance` behind.
Object pools live on each manager — no allocations happen during play.

`Environment` works the same way but at a coarser granularity: 8 ground
tiles, each 30 units long, repositioned to the front of the track whenever
they fall a full tile behind. Trees on each recycled tile are re-scattered
so the world doesn't look like an obvious loop.

## Adding a new obstacle type

Open `src/entities/ObstacleManager.js` and append a new entry to the
`OBSTACLE_TYPES` array:

```js
{
  name: 'spike',
  build: () => {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 1.2, 4),
      new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.4 }),
    );
    m.position.y = 0.6;
    m.castShadow = true;
    return {
      mesh: m,
      size: new THREE.Vector3(0.8, 1.2, 0.8), // collision box
      centerY: 0.6,                            // collision box vertical centre
    };
  },
},
```

That's it — pooling, spawning, collision, and recycling all work
automatically. Each entry returns:

- `mesh` — the Three.js `Object3D` for this obstacle (group or mesh).
- `size` — the collision box dimensions.
- `centerY` — the vertical centre of the collision box, in the mesh's local
  space. Used so a tall obstacle and a short obstacle can share the same
  bounding-box machinery without offset bugs.

## Tuning

All gameplay constants live in `src/core/config.js` — lane positions,
initial / max speed, speed ramp, jump physics, spawn distances and
intervals, and the difficulty ramp duration. Edit and reload.
