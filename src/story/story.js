/**
 * The Hot Spring Cup quest — narrative beats for CappyRacer's in-engine
 * cinematics. Pure data: the Cutscene system (`src/ui/Cutscene.js`) renders a
 * scripted camera move over the live 3D world while revealing these lines.
 *
 * Arc: Cappy the capybara journeys to win the legendary Hot Spring Cup, facing
 * a cast of cute-animal rivals across three heats (goal -> setbacks -> finale),
 * with an off-the-books bonus highway run on the side.
 *
 * A beat:
 *   id     — stable key (used for "seen" persistence).
 *   shot   — camera move: 'rise' | 'orbit' | 'flyby'.
 *   lines  — [{ who, text }] dialogue, advanced one at a time.
 *   final  — (optional) true for the Cup finale (grand framing).
 */
export const HERO = 'Cappy';

export const BEATS = {
  // --- Opening (plays before the very first race, at Sunset Springs) --------
  intro: {
    id: 'intro', shot: 'rise',
    lines: [
      { who: 'Narrator', text: 'Deep in the steaming valley lies a legend — the Hot Spring Cup. 🏆' },
      { who: 'Narrator', text: 'Win it, and you earn a soak in the coziest, warmest spring in all the land.' },
      { who: 'Cappy', text: 'A whole legendary hot spring... just for me? I HAVE to win that Cup!' },
      { who: 'Duke the Duck', text: 'Ha! Dream on, fuzzball. I\'m the reigning champ. Try to keep up at Sunset Springs!' },
      { who: 'Narrator', text: 'Three heats. The valley\'s fastest critters. One Cup. The race is on!' },
    ],
  },

  // --- After winning Sunset Springs (heat 1) --------------------------------
  'win-springs': {
    id: 'win-springs', shot: 'orbit',
    lines: [
      { who: 'Narrator', text: 'Cappy takes the first heat at Sunset Springs!' },
      { who: 'Duke the Duck', text: 'WHAT?! Beginner\'s luck. You\'ll choke on the night course, I promise you.' },
      { who: 'Cappy', text: 'One down, two to go. The Cup is getting closer! ✨' },
      { who: 'Narrator', text: 'A new heat opens: Twilight Hot Springs — twistier, darker, meaner.' },
    ],
  },

  // --- Before Twilight Hot Springs (heat 2) ---------------------------------
  'pre-twilight': {
    id: 'pre-twilight', shot: 'flyby',
    lines: [
      { who: 'Narrator', text: 'Dusk settles over the misty pools. The Twilight course coils like a sleeping snake.' },
      { who: 'Miso the Cat', text: 'Purr... the line here is razor-thin, little capybara. Brake too late and the mist takes you.' },
      { who: 'Cappy', text: 'Tight corners? That\'s where drifting pays off. Let\'s carve it up!' },
    ],
  },

  // --- After winning Twilight Hot Springs ------------------------------------
  'win-twilight': {
    id: 'win-twilight', shot: 'orbit',
    lines: [
      { who: 'Pip the Frog', text: 'Whoa! You threaded those hairpins like it was nothing. Ribbit — respect.' },
      { who: 'Cappy', text: 'Two heats down! Just one more and the Cup is mine.' },
      { who: 'Narrator', text: 'But the final qualifier is... out of this world. The Cosmic Drift awaits among the stars.' },
    ],
  },

  // --- Before Cosmic Drift (heat 3, the finale qualifier) -------------------
  'pre-cosmos': {
    id: 'pre-cosmos', shot: 'flyby',
    lines: [
      { who: 'Narrator', text: 'The track floats in the void, lit only by neon and distant suns. 🌌' },
      { who: 'Shelldon the Tortoise', text: 'Slow down to speed up, young racer. Out here, the patient line is the fastest line.' },
      { who: 'Cappy', text: 'Among the stars, for the Cup itself... I won\'t hesitate. Let\'s fly!' },
    ],
  },

  // --- THE FINALE: winning Cosmic Drift wins the Hot Spring Cup -------------
  finale: {
    id: 'finale', shot: 'rise', final: true, prop: 'trophy', // reveal the Cup
    lines: [
      { who: 'Narrator', text: 'Across the stars, Cappy crosses the final line FIRST!' },
      { who: 'Narrator', text: 'The valley erupts. The Hot Spring Cup is lifted high. 🏆🎉' },
      { who: 'Duke the Duck', text: '...Okay. Okay! That was incredible. You earned it, champ.' },
      { who: 'Cappy', text: 'We ALL earned it. Last one in the legendary spring is a rotten yuzu!' },
      { who: 'Narrator', text: 'And so the cozy capybara soaked in glory — the new champion of the Hot Spring Cup.' },
    ],
  },

  // --- Bonus highway (after-hours, off the books) ---------------------------
  'pre-highway': {
    id: 'pre-highway', shot: 'flyby',
    lines: [
      { who: 'Bramble the Hedgehog', text: 'Psst! Champ! Wanna run the old highway? Real traffic, no rules, no hesitation.' },
      { who: 'Cappy', text: 'No-hesi on a live highway? ...Yeah. Let\'s see what this kart can really do. 🛣️' },
    ],
  },
  'win-highway': {
    id: 'win-highway', shot: 'orbit',
    lines: [
      { who: 'Bramble the Hedgehog', text: 'Not a single bumper touched! You\'ve got ICE in those paws. Legendary.' },
      { who: 'Cappy', text: 'Weaving traffic at full tilt? Best warm-down a champion could ask for. 😎' },
    ],
  },
};

/** Story beat shown the FIRST time you race a track (by track id). */
export const PRE_RACE = {
  springs: 'intro',
  twilight: 'pre-twilight',
  cosmos: 'pre-cosmos',
  highway: 'pre-highway',
};

/** Story beat shown after WINNING (1st place) a track (by track id). */
export const WIN_BEAT = {
  springs: 'win-springs',
  twilight: 'win-twilight',
  cosmos: 'finale',
  highway: 'win-highway',
};
