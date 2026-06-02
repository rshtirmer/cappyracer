export const Events = {
  // Game lifecycle
  GAME_START: 'game:start',
  GAME_OVER: 'game:over',
  GAME_RESTART: 'game:restart',

  // Player
  PLAYER_MOVE: 'player:move',
  PLAYER_JUMP: 'player:jump',
  PLAYER_DIED: 'player:died',

  // Race
  LAP_COMPLETED: 'race:lap',
  RACE_FINISHED: 'race:finished',
  CHECKPOINT: 'race:checkpoint',

  // Items
  ITEM_PICKUP: 'item:pickup',
  ITEM_USED: 'item:used',
  ITEM_HIT: 'item:hit',

  // Kart
  BOOST: 'kart:boost', // any boost fired (drift mini-turbo / melon / pad)

  // Free-cruise (highway) scoring
  NEAR_MISS: 'cruise:near-miss', // threaded close past a car (data: {points, combo})
  COMBO_RESET: 'cruise:combo-reset', // crashed -> multiplier wiped

  // Menu
  MENU_SHOW: 'menu:show',
  MENU_HIDE: 'menu:hide',
  TRACK_SELECT: 'menu:track-select',
  RACE_REQUESTED: 'menu:race-requested', // PLAY clicked (story-aware start)

  // Story / cutscenes
  CUTSCENE_START: 'cutscene:start',
  CUTSCENE_END: 'cutscene:end',
  CUTSCENE_PLAY: 'cutscene:play', // request a specific beat by id

  // Audio (used by /add-audio)
  AUDIO_INIT: 'audio:init',
  MUSIC_MENU: 'music:menu',
  MUSIC_GAMEPLAY: 'music:gameplay',
  MUSIC_GAMEOVER: 'music:gameover',
  MUSIC_STOP: 'music:stop',
};

class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this;
  }

  off(event, callback) {
    if (!this.listeners[event]) return this;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    return this;
  }

  emit(event, data) {
    if (!this.listeners[event]) return this;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`EventBus error in ${event}:`, err);
      }
    });
    return this;
  }

  removeAll() {
    this.listeners = {};
    return this;
  }
}

export const eventBus = new EventBus();
