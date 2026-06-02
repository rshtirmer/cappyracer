class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.started = false;
    this.gameOver = false;
    this.finished = false;
    this.countdown = 0;    // seconds left in the pre-race 3-2-1 hold

    // Race
    this.lap = 0;          // laps completed
    this.gate = 0;         // next ordered checkpoint index expected
    this.raceTime = 0;     // seconds since the race started
    this.bestTime = this.bestTime || null;
    this.onTrack = true;
    this.progress = 0;     // 0..1 around the loop
    this.offset = 0;       // signed lateral distance from centerline
    this.position = 1;     // live race position (1 = leading)
    this.totalRacers = 1;
    this.heldItem = null;  // player's held item: 'shell' | 'mud' | 'melon' | null

    // Audio reads these each frame (engine pitch + drift-charge whine).
    this.speed = 0;        // player kart speed (world units/sec)
    this.drifting = false; // player is power-sliding
    this.driftCharge = 0;  // seconds held in the current clean drift
  }

  recordFinish() {
    this.finished = true;
    if (this.bestTime == null || this.raceTime < this.bestTime) {
      this.bestTime = this.raceTime;
    }
  }
}

export const gameState = new GameState();
