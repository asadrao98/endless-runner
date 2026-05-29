// Central tuning constants. Tweak these to change the feel of the game.
export const GAME_CONFIG = {
  // Three lanes; player snaps between these X positions.
  laneWidth: 2,
  lanes: [-2, 0, 2],

  // Forward speed (units / second).
  initialSpeed: 12,
  maxSpeed: 32,
  speedRamp: 0.18, // additional units of speed per second of play.

  // Jump physics.
  jumpVelocity: 9,
  gravity: -22,

  // World streaming distances (relative to the player along Z).
  spawnDistance: 80, // how far ahead obstacles / coins appear.
  despawnDistance: 20, // how far behind the player they get recycled.

  // Spawn cadence (seconds). Obstacle interval shrinks slightly as time progresses.
  obstacleSpawnIntervalMax: 1.2,
  obstacleSpawnIntervalMin: 0.55,
  coinSpawnInterval: 0.7,

  // Difficulty curve length: time after which spawn cadence reaches its minimum.
  difficultyRampSeconds: 60,
};
