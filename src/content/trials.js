(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // =====================================================================
  // trials.js — Trials: optional run modifiers chosen on the character screen (prefix mu_).
  //
  // A Trial is a relic with rarity 'event', no class, trial: true and trialScore (integer percent).
  // Positive trialScore = handicap (harder), negative = boon (easier). The run score is multiplied
  // by 1 + sum(trialScore) / 100. Trials are never offered as loot (DS.relicPool skips them).
  //
  // Hooks used (all verified against combat.js / run.js):
  //   combat:  onCombatStart (before turn 1), onTurnStart (player turn only, after the draw),
  //            onCardPlayed, onDamaged (fromAttack: true for attack hits), passive energy / draw
  //   run:     onPickup (DS.Run.addRelic), onRoomEnter, onRest, passive potionSlots
  // =====================================================================

  // ----------------------------- HANDICAPS ----------------------------
  // trialScore +10..+50

  DS.defineRelic({
    id: 'mu_sluggish_blood',
    name: 'Sluggish Blood',
    rarity: 'event',
    icon: '🐌',
    trial: true,
    trialScore: 50,
    desc: 'You have 2 Energy each turn instead of 3.',
    flavor: 'Every heartbeat arrives a little late.',
    passive: { energy: -1 },
  });

  DS.defineRelic({
    id: 'mu_heavy_pack',
    name: 'Heavy Pack',
    rarity: 'event',
    icon: '🎒',
    trial: true,
    trialScore: 35,
    desc: 'Draw 4 cards each turn instead of 5.',
    flavor: 'Everything you need is in there. Getting to it is the problem.',
    passive: { draw: -1 },
  });

  DS.defineRelic({
    id: 'mu_cracked_satchel',
    name: 'Cracked Satchel',
    rarity: 'event',
    icon: '👝',
    trial: true,
    trialScore: 15,
    desc: 'You have 2 potion slots instead of 3.',
    flavor: 'The seam gave out somewhere on the second road.',
    passive: { potionSlots: -1 },
  });

  DS.defineRelic({
    id: 'mu_toll_road',
    name: 'Toll Road',
    rarity: 'event',
    icon: '🛣️',
    trial: true,
    trialScore: 15,
    desc: 'Each time you enter a room, lose 2 Gold.',
    flavor: 'Someone has always been waiting at the next gate with a hand out.',
    triggers: {
      onRoomEnter: [{ op: 'gold', amount: -2 }],
    },
  });

  DS.defineRelic({
    id: 'mu_brittle_bones',
    name: 'Brittle Bones',
    rarity: 'event',
    icon: '🦴',
    trial: true,
    trialScore: 20,
    desc: 'Immediately lose 10 Max HP.',
    flavor: 'The marrow was never very generous to begin with.',
    triggers: {
      onPickup: [{ op: 'max_hp', amount: -10 }],
    },
  });

  DS.defineRelic({
    id: 'mu_grave_dowry',
    name: 'Grave Dowry',
    rarity: 'event',
    icon: '⚰️',
    trial: true,
    trialScore: 25,
    desc: 'Immediately add 2 Decay curses to your deck.',
    flavor: 'A gift from the last person who tried this road.',
    triggers: {
      onPickup: [{ op: 'add_card', card: 'curse_decay', amount: 2 }],
    },
  });

  DS.defineRelic({
    id: 'mu_restless_dead',
    name: 'Restless Dead',
    rarity: 'event',
    icon: '👻',
    trial: true,
    trialScore: 20,
    desc: 'At the start of each combat, shuffle a Clumsy into your draw pile.',
    flavor: 'They never sleep quietly, and they always want to help.',
    triggers: {
      onCombatStart: [{ op: 'add_card', card: 'curse_clumsy', to: 'draw', amount: 1 }],
    },
  });

  DS.defineRelic({
    id: 'mu_dim_lantern',
    name: 'Dim Lantern',
    rarity: 'event',
    icon: '🕯️',
    trial: true,
    trialScore: 15,
    desc: 'At the start of each combat, gain 2 Weak.',
    flavor: 'It gives light enough to see the fight coming, not enough to win it.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'weak', amount: 2, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'mu_hobbled_ankle',
    name: 'Hobbled Ankle',
    rarity: 'event',
    icon: '🦶',
    trial: true,
    trialScore: 25,
    desc: 'At the start of each combat, become Entangled until the end of your first turn. You cannot play Attacks while Entangled.',
    flavor: 'The old break never healed straight.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'entangle', amount: 1, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'mu_dark_drumbeat',
    name: 'Dark Drumbeat',
    rarity: 'event',
    icon: '🥁',
    trial: true,
    trialScore: 35,
    desc: 'At the start of every 3rd turn, all enemies gain 1 Strength.',
    flavor: 'Somewhere below the floor, something keeps time for them.',
    triggers: {
      onTurnStart: { every: 3, effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'all_enemies' }] },
    },
  });

  DS.defineRelic({
    id: 'mu_warpaint_totem',
    name: 'Warpaint Totem',
    rarity: 'event',
    icon: '🗿',
    trial: true,
    trialScore: 40,
    desc: 'At the start of each combat, all enemies gain 1 Enrage. Whenever you play a Skill, each enemy gains Strength equal to its Enrage.',
    flavor: 'Every warrior it ever watched went into battle a little more furious.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'enrage', amount: 1, to: 'all_enemies' }],
    },
  });

  DS.defineRelic({
    id: 'mu_ember_tithe',
    name: 'Ember Tithe',
    rarity: 'event',
    icon: '🔥',
    trial: true,
    trialScore: 20,
    desc: 'At the start of each combat, lose 4 HP.',
    flavor: 'Each fight begins with a small payment to the fire.',
    triggers: {
      onCombatStart: [{ op: 'lose_hp', amount: 4, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'mu_bloodletting_charm',
    name: 'Bloodletting Charm',
    rarity: 'event',
    icon: '🩸',
    trial: true,
    trialScore: 25,
    desc: 'At the start of each of your turns, lose 1 HP.',
    flavor: 'It is warm, it is wet, and it wants a little of you every morning.',
    triggers: {
      onTurnStart: [{ op: 'lose_hp', amount: 1, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'mu_splinter_ward',
    name: 'Splinter Ward',
    rarity: 'event',
    icon: '🪵',
    trial: true,
    trialScore: 25,
    desc: 'Whenever an attack damages you, lose 2 HP.',
    flavor: 'Every blow leaves a little wood behind in the wound.',
    triggers: {
      onDamaged: { when: { fromAttack: true }, effects: [{ op: 'lose_hp', amount: 2, to: 'self' }] },
    },
  });

  DS.defineRelic({
    id: 'mu_scorched_bedroll',
    name: 'Scorched Bedroll',
    rarity: 'event',
    icon: '🛌',
    trial: true,
    trialScore: 20,
    desc: 'After you rest, lose 8 HP.',
    flavor: 'It is warm, but the fire that warmed it was not kind.',
    triggers: {
      onRest: [{ op: 'lose_hp', amount: 8, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'mu_frayed_gauntlet',
    name: 'Frayed Gauntlet',
    rarity: 'event',
    icon: '🧤',
    trial: true,
    trialScore: 15,
    desc: 'At the start of each combat, gain 2 Frail.',
    flavor: 'Every thread is loose, and every loose thread is a seam.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'frail', amount: 2, to: 'self' }],
    },
  });

  // ------------------------------- BOONS ------------------------------
  // trialScore -15..-50

  DS.defineRelic({
    id: 'mu_purse_of_plenty',
    name: 'Purse of Plenty',
    rarity: 'event',
    icon: '👛',
    trial: true,
    trialScore: -20,
    desc: 'Immediately gain 75 Gold.',
    flavor: 'It is never as empty as it looks.',
    triggers: {
      onPickup: [{ op: 'gold', amount: 75 }],
    },
  });

  DS.defineRelic({
    id: 'mu_iron_constitution',
    name: 'Iron Constitution',
    rarity: 'event',
    icon: '🫀',
    trial: true,
    trialScore: -25,
    desc: 'Immediately gain 12 Max HP and heal 12 HP.',
    flavor: 'Whatever hammered it into shape did not stop at the first blow.',
    triggers: {
      onPickup: [{ op: 'max_hp', amount: 12 }],
    },
  });

  DS.defineRelic({
    id: 'mu_ironbark_shield',
    name: 'Ironbark Shield',
    rarity: 'event',
    icon: '🛡️',
    trial: true,
    trialScore: -20,
    desc: 'At the start of each combat, gain 6 Block.',
    flavor: 'Grown slowly, carved quickly, and never once split.',
    triggers: {
      onCombatStart: [{ op: 'block', amount: 6, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'mu_warriors_ring',
    name: "Warrior's Ring",
    rarity: 'event',
    icon: '💍',
    trial: true,
    trialScore: -50,
    desc: 'You have 4 Energy each turn instead of 3.',
    flavor: 'Worn by someone who never once ran out of things to do.',
    passive: { energy: 1 },
  });

  DS.defineRelic({
    id: 'mu_keen_eye',
    name: 'Keen Eye',
    rarity: 'event',
    icon: '👁️',
    trial: true,
    trialScore: -40,
    desc: 'Draw 6 cards each turn instead of 5.',
    flavor: 'It sees the whole deck at once, or near enough.',
    passive: { draw: 1 },
  });

  DS.defineRelic({
    id: 'mu_bright_spark',
    name: 'Bright Spark',
    rarity: 'event',
    icon: '✨',
    trial: true,
    trialScore: -35,
    desc: 'At the start of each combat, gain 2 Strength.',
    flavor: 'It crackles against the palm and steadies the arm.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'mu_quickened_hands',
    name: 'Quickened Hands',
    rarity: 'event',
    icon: '🖐️',
    trial: true,
    trialScore: -25,
    desc: 'On the first turn of each combat, draw 2 extra cards.',
    flavor: 'The first breath of a fight is always the quickest.',
    triggers: {
      onTurnStart: { when: { turn: 1 }, effects: [{ op: 'draw', amount: 2 }] },
    },
  });

  DS.defineRelic({
    id: 'mu_potion_satchel',
    name: 'Potion Satchel',
    rarity: 'event',
    icon: '🧪',
    trial: true,
    trialScore: -15,
    desc: 'You have 4 potion slots instead of 3.',
    flavor: 'There is always room for one more bottle.',
    passive: { potionSlots: 1 },
  });
})();
