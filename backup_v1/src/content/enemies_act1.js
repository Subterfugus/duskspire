// Act 1 bestiary and encounter table: the Ashen Catacombs.
// Rats, slimes, cultists, skeletons, fungal things, bandits and gremlin-like pests.
(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---- ai helpers (private to this file) -----------------------------------
  // Cycle through a list by the enemy's 1-based turn counter.
  const cycle = (list, turn) => list[(Math.max(1, turn | 0) - 1) % list.length];
  // Count living enemies with a given id (ctx.combat may be absent in odd contexts).
  const livingOf = (ctx, id) => {
    const alive = ctx.combat && typeof ctx.combat.livingEnemies === 'function' ? ctx.combat.livingEnemies() : [];
    return alive.filter((e) => e.id === id).length;
  };
  // HP fraction of the acting enemy.
  const frac = (ctx) => ctx.self.hp / Math.max(1, ctx.self.maxHp);
  // Weighted random pick that avoids repeating the previous move.
  function weighted(ctx, table) {
    const rng = ctx.rng || DS.rng;
    const last = ctx.lastMoves && ctx.lastMoves.length ? ctx.lastMoves[ctx.lastMoves.length - 1] : null;
    let entries = Object.entries(table).filter((e) => e[0] !== last);
    if (!entries.length) entries = Object.entries(table);
    const total = entries.reduce((s, e) => s + e[1], 0);
    let r = rng.next() * total;
    for (const e of entries) {
      r -= e[1];
      if (r < 0) return e[0];
    }
    return entries[entries.length - 1][0];
  }

  // ---- custom statuses ------------------------------------------------------
  // Spore Rot: sticky fungal filth. Each end of your turn, Slimed cards pile into your discard.
  DS.defineStatus({
    id: 'a1_spores', name: 'Spore Rot', type: 'debuff', icon: '🍄', stacks: true, decay: 'turn_end',
    desc: 'At the end of your turn, add {n} Slimed to your discard pile. Fades by 1 each turn.',
    triggers: {
      onTurnEnd: [{ op: 'add_card', card: 'status_slimed', to: 'discard', amount: { v: 'stacks' } }]
    }
  });

  // Guarded: a defensive crouch. Halves incoming attack damage until the owner's next turn starts.
  DS.defineStatus({
    id: 'a1_guarded', name: 'Guarded', type: 'buff', icon: '🛡️', stacks: false, decay: null, expire: 'turn_start',
    desc: 'Takes 50% less attack damage until its next turn begins.',
    mods: { attackTakenMul: 0.5 }
  });

  // ==========================================================================
  // NORMAL enemies (swarmers and sturdier solo / duo enemies)
  // ==========================================================================

  DS.defineEnemy({
    id: 'a1_catacomb_rat', name: 'Catacomb Rat', act: 1, tier: 'normal', hp: [9, 12], icon: '🐀', scale: 0.7,
    // Pack instinct: every death in the pack makes the survivors meaner.
    triggers: {
      onEnemyDeath: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }]
    },
    moves: {
      bite: { name: 'Bite', intent: 'attack', effects: [{ op: 'damage', amount: 4 }] },
      gnaw: { name: 'Filthy Gnaw', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 3 },
        { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }
      ] },
      squeal: { name: 'Squeal', intent: 'buff', effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] }
    },
    pattern: { type: 'random', weights: { bite: 50, gnaw: 35, squeal: 15 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a1_grave_slime', name: 'Grave Slime', act: 1, tier: 'normal', hp: [14, 18], icon: '🟢', scale: 0.9,
    moves: {
      slam: { name: 'Slam', intent: 'attack', effects: [{ op: 'damage', amount: 6 }] },
      spit: { name: 'Acid Spit', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 3 },
        { op: 'add_card', card: 'status_slimed', to: 'discard', amount: 1 }
      ] },
      harden: { name: 'Harden', intent: 'defend', effects: [{ op: 'block', amount: 7, to: 'self' }] }
    },
    pattern: { type: 'random', weights: { slam: 40, spit: 35, harden: 25 }, noRepeat: 2, first: 'spit' }
  });

  DS.defineEnemy({
    id: 'a1_mischief_imp', name: 'Mischief Imp', act: 1, tier: 'normal', hp: [11, 14], icon: '👺', scale: 0.75,
    // Imps grow angrier every time they are struck.
    onSpawn: [{ op: 'apply', status: 'angry', amount: 1, to: 'self' }],
    moves: {
      pinch: { name: 'Pinch', intent: 'attack', effects: [{ op: 'damage', amount: 3 }] },
      pelt: { name: 'Pelt', intent: 'attack', effects: [{ op: 'damage', amount: 2, times: 3 }] },
      snicker: { name: 'Snicker', intent: 'debuff', effects: [{ op: 'apply', status: 'weak', amount: 1, to: 'target' }] }
    },
    pattern: { type: 'random', weights: { pinch: 35, pelt: 40, snicker: 25 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a1_shroomling', name: 'Shroomling', act: 1, tier: 'normal', hp: [13, 16], icon: '🍄', scale: 0.8,
    onSpawn: [{ op: 'apply', status: 'regen', amount: 1, to: 'self' }],
    moves: {
      spore_puff: { name: 'Spore Puff', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 3 },
        { op: 'apply', status: 'weak', amount: 1, to: 'target' }
      ] },
      regrow: { name: 'Regrow', intent: 'buff', effects: [{ op: 'heal', amount: 4, to: 'self' }] },
      burst: { name: 'Spore Burst', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] }
    },
    pattern: { type: 'sequence', moves: ['spore_puff', 'regrow', 'burst'], loop: true }
  });

  DS.defineEnemy({
    id: 'a1_skeleton_legionary', name: 'Skeleton Legionary', act: 1, tier: 'normal', hp: [32, 36], icon: '💀', scale: 1,
    // Ancient discipline: the first debuff thrown at it is shrugged off.
    onSpawn: [{ op: 'apply', status: 'artifact', amount: 1, to: 'self' }],
    moves: {
      rusted_slash: { name: 'Rusted Slash', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
      brace: { name: 'Brace Shield', intent: 'defend', effects: [{ op: 'block', amount: 9, to: 'self' }] },
      heavy_chop: { name: 'Heavy Chop', intent: 'attack', effects: [{ op: 'damage', amount: 11 }] },
      rattle: { name: 'Rattle Bones', intent: 'buff', effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] }
    },
    pattern: { type: 'sequence', moves: ['rusted_slash', 'brace', 'heavy_chop', 'rattle'], loop: true }
  });

  DS.defineEnemy({
    id: 'a1_skeleton_archer', name: 'Skeleton Archer', act: 1, tier: 'normal', hp: [22, 26], icon: '🏹', scale: 0.95,
    moves: {
      mark: { name: 'Mark Prey', intent: 'debuff', effects: [{ op: 'apply', status: 'vulnerable', amount: 1, to: 'target' }] },
      volley: { name: 'Volley', intent: 'attack', effects: [{ op: 'damage', amount: 4, times: 2 }] },
      aimed_shot: { name: 'Aimed Shot', intent: 'attack', effects: [{ op: 'damage', amount: 9 }] },
      step_back: { name: 'Step Back', intent: 'defend', effects: [{ op: 'block', amount: 6, to: 'self' }] }
    },
    pattern: { type: 'sequence', moves: ['mark', 'volley', 'aimed_shot', 'step_back'], loop: true }
  });

  DS.defineEnemy({
    id: 'a1_cultist', name: 'Ash Cultist', act: 1, tier: 'normal', hp: [42, 48], icon: '🧙', scale: 1.05,
    moves: {
      incantation: { name: 'Dark Incantation', intent: 'buff', effects: [{ op: 'apply', status: 'ritual', amount: 3, to: 'self' }] },
      dark_strike: { name: 'Dark Strike', intent: 'attack', effects: [{ op: 'damage', amount: 6 }] },
      hex: { name: 'Hex', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 4 },
        { op: 'apply', status: 'frail', amount: 1, to: 'target' }
      ] }
    },
    // Chants once, then grows stronger every turn through its ritual.
    ai: (ctx) => (ctx.turn === 1 ? 'incantation' : weighted(ctx, { dark_strike: 60, hex: 40 }))
  });

  DS.defineEnemy({
    id: 'a1_cult_fanatic', name: 'Zealous Fanatic', act: 1, tier: 'normal', hp: [24, 28], icon: '😤', scale: 0.95,
    moves: {
      flagellate: { name: 'Flagellate', intent: 'buff', effects: [
        { op: 'lose_hp', amount: 3, to: 'self' },
        { op: 'apply', status: 'strength', amount: 2, to: 'self' }
      ] },
      cleave: { name: 'Cleave', intent: 'attack', effects: [{ op: 'damage', amount: 9 }] },
      rush: { name: 'Frenzied Rush', intent: 'attack', effects: [{ op: 'damage', amount: 5, times: 2 }] }
    },
    // Bleeds itself for strength, but will not bleed itself dry.
    ai: (ctx) => {
      if (ctx.self.hp <= 10) return cycle(['cleave', 'rush'], ctx.turn);
      return cycle(['flagellate', 'cleave', 'rush', 'cleave'], ctx.turn);
    }
  });

  DS.defineEnemy({
    id: 'a1_bandit_thug', name: 'Bandit Thug', act: 1, tier: 'normal', hp: [30, 34], icon: '🦹', scale: 1,
    moves: {
      club: { name: 'Club', intent: 'attack', effects: [{ op: 'damage', amount: 8 }] },
      dirty_trick: { name: 'Dirty Trick', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 5 },
        { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 }
      ] },
      raise_buckler: { name: 'Raise Buckler', intent: 'defend', effects: [{ op: 'block', amount: 8, to: 'self' }] }
    },
    pattern: { type: 'random', weights: { club: 40, dirty_trick: 35, raise_buckler: 25 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a1_bandit_slinger', name: 'Bandit Slinger', act: 1, tier: 'normal', hp: [18, 22], icon: '🎯', scale: 0.9,
    moves: {
      aim: { name: 'Take Aim', intent: 'buff', effects: [{ op: 'apply', status: 'vigor', amount: 4, to: 'self' }] },
      sling: { name: 'Sling Stone', intent: 'attack', effects: [{ op: 'damage', amount: 6 }] },
      rapid_sling: { name: 'Rapid Sling', intent: 'attack', effects: [{ op: 'damage', amount: 3, times: 3 }] }
    },
    pattern: { type: 'sequence', moves: ['aim', 'sling', 'rapid_sling'], loop: true }
  });

  DS.defineEnemy({
    id: 'a1_crypt_ghoul', name: 'Crypt Ghoul', act: 1, tier: 'normal', hp: [34, 40], icon: '🧟', scale: 1.05,
    moves: {
      claw: { name: 'Double Claw', intent: 'attack', effects: [{ op: 'damage', amount: 5, times: 2 }] },
      feast: { name: 'Feast', intent: 'attack_buff', effects: [
        { op: 'damage', amount: 6 },
        { op: 'heal', amount: 6, to: 'self' }
      ] },
      gorge: { name: 'Gorge', intent: 'buff', effects: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }] }
    },
    pattern: { type: 'random', weights: { claw: 40, feast: 35, gorge: 25 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a1_bone_hound', name: 'Bone Hound', act: 1, tier: 'normal', hp: [20, 24], icon: '🐕', scale: 0.85,
    moves: {
      lunge: { name: 'Lunge', intent: 'attack', effects: [{ op: 'damage', amount: 9 }] },
      snap: { name: 'Snap', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 4, times: 2 },
        { op: 'apply', status: 'vulnerable', amount: 1, to: 'target' }
      ] },
      howl: { name: 'Hollow Howl', intent: 'buff', effects: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }] }
    },
    pattern: { type: 'random', weights: { lunge: 40, snap: 40, howl: 20 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a1_crypt_spider', name: 'Crypt Spider', act: 1, tier: 'normal', hp: [16, 20], icon: '🕷️', scale: 0.8,
    moves: {
      web_spit: { name: 'Web Spit', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 3 },
        { op: 'apply', status: 'weak', amount: 1, to: 'target' }
      ] },
      venom_bite: { name: 'Venom Bite', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 4 },
        { op: 'apply', status: 'poison', amount: 3, to: 'target' }
      ] },
      skitter: { name: 'Skitter Away', intent: 'defend', effects: [{ op: 'block', amount: 6, to: 'self' }] }
    },
    pattern: { type: 'random', weights: { web_spit: 35, venom_bite: 40, skitter: 25 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a1_mourning_wisp', name: 'Mourning Wisp', act: 1, tier: 'normal', hp: [16, 20], icon: '👻', scale: 0.9,
    moves: {
      wail: { name: 'Mournful Wail', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 4 },
        { op: 'apply', status: 'frail', amount: 1, to: 'target' }
      ] },
      drain: { name: 'Grave Drain', intent: 'attack', effects: [
        { op: 'damage', amount: 6 },
        { op: 'heal', amount: 4, to: 'self' }
      ] },
      shroud: { name: 'Ghostly Shroud', intent: 'buff', effects: [{ op: 'apply', status: 'a1_guarded', amount: 1, to: 'self' }] }
    },
    pattern: { type: 'sequence', moves: ['wail', 'drain', 'shroud'], loop: true }
  });

  DS.defineEnemy({
    id: 'a1_plague_corpse', name: 'Plague Corpse', act: 1, tier: 'normal', hp: [36, 42], icon: '🤢', scale: 1.1,
    onSpawn: [{ op: 'apply', status: 'regen', amount: 2, to: 'self' }],
    moves: {
      maul: { name: 'Maul', intent: 'attack', effects: [{ op: 'damage', amount: 9 }] },
      festering_bite: { name: 'Festering Bite', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 5 },
        { op: 'add_card', card: 'status_burn', to: 'discard', amount: 1 }
      ] },
      lurch: { name: 'Lurching Guard', intent: 'defend', effects: [{ op: 'block', amount: 10, to: 'self' }] }
    },
    pattern: { type: 'random', weights: { maul: 40, festering_bite: 35, lurch: 25 }, noRepeat: 2 }
  });

  // ==========================================================================
  // MINION enemies (only summoned or accompanying)
  // ==========================================================================

  DS.defineEnemy({
    id: 'a1_risen_skeleton', name: 'Risen Skeleton', act: 1, tier: 'minion', hp: [9, 11], icon: '🦴', scale: 0.75,
    moves: {
      jab: { name: 'Jab', intent: 'attack', effects: [{ op: 'damage', amount: 4 }] },
      rake: { name: 'Rake', intent: 'attack', effects: [{ op: 'damage', amount: 3, times: 2 }] },
      brace: { name: 'Brace', intent: 'defend', effects: [{ op: 'block', amount: 4, to: 'self' }] }
    },
    pattern: { type: 'sequence', moves: ['jab', 'brace', 'rake'], loop: true }
  });

  DS.defineEnemy({
    id: 'a1_spore_puffball', name: 'Spore Puffball', act: 1, tier: 'minion', hp: [6, 8], icon: '🫧', scale: 0.7,
    // Bursting releases a cloud of spores onto the player.
    triggers: {
      onDeath: [{ op: 'apply', status: 'a1_spores', amount: 1, to: 'player' }]
    },
    moves: {
      bump: { name: 'Bump', intent: 'attack', effects: [{ op: 'damage', amount: 4 }] },
      pollen: { name: 'Pollen Cloud', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 2 },
        { op: 'apply', status: 'a1_spores', amount: 1, to: 'target' }
      ] },
      drift: { name: 'Drift', intent: 'defend', effects: [{ op: 'block', amount: 5, to: 'self' }] }
    },
    pattern: { type: 'sequence', moves: ['bump', 'pollen', 'drift'], loop: true }
  });

  DS.defineEnemy({
    id: 'a1_cult_initiate', name: 'Cult Initiate', act: 1, tier: 'minion', hp: [10, 13], icon: '🕯️', scale: 0.8,
    moves: {
      cut: { name: 'Ritual Cut', intent: 'attack', effects: [{ op: 'damage', amount: 4 }] },
      whisper: { name: 'Whisper', intent: 'debuff', effects: [{ op: 'apply', status: 'weak', amount: 1, to: 'target' }] },
      chant: { name: 'Low Chant', intent: 'buff', effects: [{ op: 'apply', status: 'ritual', amount: 1, to: 'self' }] }
    },
    pattern: { type: 'random', weights: { cut: 50, whisper: 25, chant: 25 }, noRepeat: 2 }
  });

  // ==========================================================================
  // ELITE enemies (each punishes a different style of play)
  // ==========================================================================

  DS.defineEnemy({
    id: 'a1_sporeback_behemoth', name: 'Sporeback Behemoth', act: 1, tier: 'elite', hp: [92, 100], icon: '🌿', scale: 1.6,
    desc: 'Thorns bristle from its hide. Every hit you land on it hurts you back, and the thorns keep growing. Punishes attack-heavy decks.',
    onSpawn: [{ op: 'apply', status: 'thorns', amount: 3, to: 'self' }],
    moves: {
      spore_cloud: { name: 'Spore Cloud', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 6 },
        { op: 'apply', status: 'a1_spores', amount: 2, to: 'target' }
      ] },
      crush: { name: 'Crushing Hoof', intent: 'attack', effects: [{ op: 'damage', amount: 15 }] },
      bloom: { name: 'Bristling Bloom', intent: 'defend', effects: [
        { op: 'block', amount: 12, to: 'self' },
        { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
      ] },
      pollen_tide: { name: 'Pollen Tide', intent: 'attack', effects: [{ op: 'damage', amount: 4, times: 3 }] }
    },
    pattern: { type: 'sequence', moves: ['spore_cloud', 'crush', 'bloom', 'pollen_tide'], loop: true }
  });

  DS.defineEnemy({
    id: 'a1_ossuary_warlord', name: 'Ossuary Warlord', act: 1, tier: 'elite', hp: [96, 104], icon: '⚔️', scale: 1.5,
    desc: 'Every skill you play fuels its rage with Strength. Punishes skill-heavy and block-heavy decks.',
    onSpawn: [{ op: 'apply', status: 'enrage', amount: 2, to: 'self' }],
    moves: {
      bone_cleave: { name: 'Bone Cleave', intent: 'attack', effects: [{ op: 'damage', amount: 12 }] },
      skull_bash: { name: 'Skull Bash', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 9 },
        { op: 'apply', status: 'vulnerable', amount: 1, to: 'target' }
      ] },
      bellow: { name: 'Ossuary Bellow', intent: 'buff', effects: [{ op: 'apply', status: 'plated_armor', amount: 4, to: 'self' }] },
      reckless_swing: { name: 'Reckless Swing', intent: 'attack', effects: [{ op: 'damage', amount: 7, times: 2 }] },
      rampage: { name: 'Rampage', intent: 'attack', effects: [
        // Hits harder the more wounded the Warlord is.
        { op: 'damage', amount: { v: 'missing_hp', of: 'self', mul: 0.5, add: 8 } }
      ] }
    },
    ai: (ctx) => {
      if (frac(ctx) <= 0.5 && ctx.turn % 2 === 0) return 'rampage';
      return cycle(['bone_cleave', 'skull_bash', 'bellow', 'reckless_swing'], ctx.turn);
    }
  });

  DS.defineEnemy({
    id: 'a1_ash_hierophant', name: 'Ash Hierophant', act: 1, tier: 'elite', hp: [84, 92], icon: '🔮', scale: 1.35,
    desc: 'Keeps replacing its acolytes, and grows stronger every time any ally dies. Punishes slow fights and careless minion-clearing.',
    onSpawn: [{ op: 'apply', status: 'ritual', amount: 2, to: 'self' }],
    triggers: {
      onEnemyDeath: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }]
    },
    moves: {
      summon_initiates: { name: 'Summon Initiates', intent: 'special', effects: [{ op: 'summon', enemy: 'a1_cult_initiate', amount: 2 }] },
      ashen_word: { name: 'Ashen Word', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 6 },
        { op: 'apply', status: 'frail', amount: 2, to: 'target' }
      ] },
      ember_lash: { name: 'Ember Lash', intent: 'attack', effects: [{ op: 'damage', amount: 11 }] },
      consecrate: { name: 'Consecrate', intent: 'buff', effects: [
        { op: 'heal', amount: 6, to: 'self' },
        { op: 'apply', status: 'strength', amount: 2, to: 'self' }
      ] }
    },
    ai: (ctx) => {
      if (livingOf(ctx, 'a1_cult_initiate') < 2) return 'summon_initiates';
      return cycle(['ashen_word', 'ember_lash', 'consecrate'], ctx.turn);
    }
  });

  DS.defineEnemy({
    id: 'a1_gloomwraith', name: 'Gloomwraith', act: 1, tier: 'elite', hp: [88, 96], icon: '🌫️', scale: 1.3,
    desc: 'Feeds on spent cards: every card you exhaust makes it stronger. Its shroud halves your attacks. Punishes exhaust decks.',
    triggers: {
      onCardExhausted: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }]
    },
    moves: {
      void_touch: { name: 'Void Touch', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 6 },
        { op: 'add_card', card: 'status_void', to: 'draw', amount: 1 }
      ] },
      shriek: { name: 'Hollow Shriek', intent: 'debuff', effects: [{ op: 'apply', status: 'weak', amount: 2, to: 'target' }] },
      drain_life: { name: 'Drain Life', intent: 'attack', effects: [
        { op: 'damage', amount: 12 },
        { op: 'heal', amount: 6, to: 'self' }
      ] },
      unmake: { name: 'Unmake', intent: 'attack', effects: [{ op: 'damage', amount: 18 }] },
      shroud: { name: 'Shroud of Dusk', intent: 'buff', effects: [{ op: 'apply', status: 'a1_guarded', amount: 1, to: 'self' }] }
    },
    ai: (ctx) => {
      if (frac(ctx) <= 0.5) return ctx.turn % 2 === 1 ? 'unmake' : 'shroud';
      return cycle(['void_touch', 'shriek', 'drain_life'], ctx.turn);
    }
  });

  // ==========================================================================
  // BOSS enemies (multi-phase, one signature mechanic each)
  // ==========================================================================

  DS.defineEnemy({
    id: 'a1_ooze_king', name: 'The Ooze King', act: 1, tier: 'boss', hp: [160, 170], icon: '👑', scale: 2,
    desc: 'Phase 1: a wobbling tyrant of sludge. Below half health it splits in two, spawning Grave Slimes, and turns savage.',
    onSpawn: [{ op: 'apply', status: 'split_ready', amount: 1, to: 'self' }],
    moves: {
      ooze_slam: { name: 'Ooze Slam', intent: 'attack', effects: [{ op: 'damage', amount: 14 }] },
      gelatinous_wall: { name: 'Gelatinous Wall', intent: 'defend', effects: [{ op: 'block', amount: 16, to: 'self' }] },
      spit_sludge: { name: 'Spit Sludge', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 6 },
        { op: 'add_card', card: 'status_slimed', to: 'discard', amount: 2 }
      ] },
      tidal_slam: { name: 'Tidal Slam', intent: 'attack', effects: [{ op: 'damage', amount: 18 }] },
      split: { name: 'Split Apart', intent: 'special', effects: [
        { op: 'remove_status', status: 'split_ready', to: 'self' },
        { op: 'summon', enemy: 'a1_grave_slime', amount: 2 }
      ] }
    },
    ai: (ctx) => {
      const s = ctx.self;
      const frac2 = frac(ctx);
      if (frac2 <= 0.5 && s.statuses && s.statuses.split_ready) return 'split';
      if (frac2 > 0.5) return cycle(['ooze_slam', 'spit_sludge', 'gelatinous_wall'], ctx.turn);
      return cycle(['tidal_slam', 'spit_sludge', 'gelatinous_wall'], ctx.turn);
    }
  });

  DS.defineEnemy({
    id: 'a1_bone_necromancer', name: 'Bone Necromancer', act: 1, tier: 'boss', hp: [165, 178], icon: '☠️', scale: 1.8,
    desc: 'Raises a fresh squad of risen skeletons whenever its guard is gone. Every death in the crypt feeds it. Kill the bones, or kill the caster.',
    // Feeds on the dead: every death in the room heals it.
    triggers: {
      onEnemyDeath: [{ op: 'heal', amount: 4, to: 'self' }]
    },
    moves: {
      raise_dead: { name: 'Raise Dead', intent: 'special', effects: [{ op: 'summon', enemy: 'a1_risen_skeleton', amount: 2 }] },
      bone_lance: { name: 'Bone Lance', intent: 'attack', effects: [{ op: 'damage', amount: 11 }] },
      grave_chill: { name: 'Grave Chill', intent: 'debuff', effects: [{ op: 'apply', status: 'frail', amount: 2, to: 'target' }] },
      soul_drain: { name: 'Soul Drain', intent: 'attack', effects: [
        { op: 'damage', amount: 8 },
        { op: 'heal', amount: 8, to: 'self' }
      ] },
      shadow_lash: { name: 'Shadow Lash', intent: 'attack', effects: [{ op: 'damage', amount: 5, times: 4 }] }
    },
    ai: (ctx) => {
      if (ctx.turn === 1 || livingOf(ctx, 'a1_risen_skeleton') === 0) return 'raise_dead';
      if (frac(ctx) <= 0.5) return cycle(['shadow_lash', 'raise_dead', 'soul_drain', 'bone_lance'], ctx.turn);
      return cycle(['bone_lance', 'grave_chill', 'soul_drain', 'raise_dead'], ctx.turn);
    }
  });

  DS.defineEnemy({
    id: 'a1_ashen_gatekeeper', name: 'The Ashen Gatekeeper', act: 1, tier: 'boss', hp: [210, 225], icon: '🗿', scale: 2,
    desc: 'An armored guardian that alternates between Iron Stance (you deal half damage while it braces) and Ember Fury (strength, then crushing blows). Below a quarter health it makes its last stand.',
    moves: {
      iron_stance: { name: 'Iron Stance', intent: 'defend', effects: [
        { op: 'block', amount: 15, to: 'self' },
        { op: 'apply', status: 'a1_guarded', amount: 1, to: 'self' }
      ] },
      ember_fury: { name: 'Ember Fury', intent: 'buff', effects: [
        { op: 'apply', status: 'strength', amount: 2, to: 'self' },
        { op: 'apply', status: 'vigor', amount: 6, to: 'self' }
      ] },
      bulwark_slam: { name: 'Bulwark Slam', intent: 'attack', effects: [{ op: 'damage', amount: 16 }] },
      chain_sweep: { name: 'Chain Sweep', intent: 'attack', effects: [{ op: 'damage', amount: 9, times: 2 }] },
      last_stand: { name: 'Last Stand', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 20 },
        { op: 'apply', status: 'vulnerable', amount: 2, to: 'target' }
      ] }
    },
    ai: (ctx) => {
      const f = frac(ctx);
      if (f <= 0.25 && ctx.turn % 2 === 0) return 'last_stand';
      if (f > 0.5) return cycle(['iron_stance', 'ember_fury', 'bulwark_slam', 'chain_sweep'], ctx.turn);
      return cycle(['ember_fury', 'chain_sweep', 'iron_stance', 'bulwark_slam'], ctx.turn);
    }
  });

  // ==========================================================================
  // ENCOUNTERS (act 1)
  // ==========================================================================

  // ---- easy: one or two weak enemies ----
  DS.defineEncounter({ id: 'a1_enc_rat_nest', act: 1, tier: 'easy', name: 'Rat Nest',
    enemies: ['a1_catacomb_rat', 'a1_catacomb_rat'] });
  DS.defineEncounter({ id: 'a1_enc_lone_ooze', act: 1, tier: 'easy', name: 'Lone Ooze',
    enemies: ['a1_grave_slime'] });
  DS.defineEncounter({ id: 'a1_enc_imp_pair', act: 1, tier: 'easy', name: 'Mischief Pair',
    enemies: ['a1_mischief_imp', 'a1_mischief_imp'] });
  DS.defineEncounter({ id: 'a1_enc_mushroom_patch', act: 1, tier: 'easy', name: 'Mushroom Patch',
    enemies: ['a1_shroomling'] });
  DS.defineEncounter({ id: 'a1_enc_stray_hound', act: 1, tier: 'easy', name: 'Stray Hound',
    enemies: ['a1_bone_hound'] });
  DS.defineEncounter({ id: 'a1_enc_crypt_spider', act: 1, tier: 'easy', name: 'Crypt Spider',
    enemies: ['a1_crypt_spider'] });

  // ---- normal: 1 to 3 enemies, balanced threat ----
  DS.defineEncounter({ id: 'a1_enc_rat_swarm', act: 1, tier: 'normal', name: 'Rat Swarm',
    enemies: ['a1_catacomb_rat', 'a1_catacomb_rat', 'a1_catacomb_rat'] });
  DS.defineEncounter({ id: 'a1_enc_ooze_pair', act: 1, tier: 'normal', name: 'Ooze Pair',
    enemies: ['a1_grave_slime', 'a1_grave_slime'] });
  DS.defineEncounter({ id: 'a1_enc_imp_gang', act: 1, tier: 'normal', name: 'Imp Gang',
    enemies: ['a1_mischief_imp', 'a1_mischief_imp', 'a1_mischief_imp'] });
  DS.defineEncounter({ id: 'a1_enc_cult_chanter', act: 1, tier: 'normal', name: 'Cult Chanter',
    enemies: ['a1_cultist'] });
  DS.defineEncounter({ id: 'a1_enc_skeleton_patrol', act: 1, tier: 'normal', name: 'Skeleton Patrol',
    enemies: ['a1_skeleton_legionary', 'a1_skeleton_archer'] });
  DS.defineEncounter({ id: 'a1_enc_zealot_pair', act: 1, tier: 'normal', name: 'Zealot Pair',
    enemies: ['a1_cult_fanatic', 'a1_cult_fanatic'] });
  DS.defineEncounter({ id: 'a1_enc_bandit_ambush', act: 1, tier: 'normal', name: 'Bandit Ambush',
    enemies: ['a1_bandit_thug', 'a1_bandit_slinger'] });
  DS.defineEncounter({ id: 'a1_enc_hound_pack', act: 1, tier: 'normal', name: 'Bone Hound Pack',
    enemies: ['a1_bone_hound', 'a1_bone_hound'] });
  DS.defineEncounter({ id: 'a1_enc_crypt_ghoul', act: 1, tier: 'normal', name: 'Crypt Ghoul',
    enemies: ['a1_crypt_ghoul'] });
  DS.defineEncounter({ id: 'a1_enc_mourning_wisps', act: 1, tier: 'normal', name: 'Mourning Wisps',
    enemies: ['a1_mourning_wisp', 'a1_mourning_wisp'] });
  DS.defineEncounter({ id: 'a1_enc_rotting_hall', act: 1, tier: 'normal', name: 'Rotting Hall',
    enemies: ['a1_plague_corpse', 'a1_crypt_spider'] });
  DS.defineEncounter({ id: 'a1_enc_mushroom_grove', act: 1, tier: 'normal', name: 'Mushroom Grove',
    enemies: ['a1_shroomling', 'a1_shroomling', 'a1_grave_slime'] });
  DS.defineEncounter({ id: 'a1_enc_grave_robbers', act: 1, tier: 'normal', name: 'Grave Robbers',
    enemies: ['a1_bandit_thug', 'a1_mischief_imp', 'a1_mischief_imp'] });
  DS.defineEncounter({ id: 'a1_enc_charnel_mix', act: 1, tier: 'normal', name: 'Charnel Mix',
    enemies: ['a1_catacomb_rat', 'a1_grave_slime', 'a1_mischief_imp'] });
  DS.defineEncounter({ id: 'a1_enc_restless_dead', act: 1, tier: 'normal', name: 'Restless Dead',
    enemies: ['a1_crypt_ghoul', 'a1_mourning_wisp'] });

  // ---- elite: some with accompanying minions ----
  DS.defineEncounter({ id: 'a1_enc_sporeback', act: 1, tier: 'elite', name: 'Sporeback Behemoth',
    enemies: ['a1_sporeback_behemoth', 'a1_spore_puffball', 'a1_spore_puffball'] });
  DS.defineEncounter({ id: 'a1_enc_ossuary_warlord', act: 1, tier: 'elite', name: 'Ossuary Warlord',
    enemies: ['a1_ossuary_warlord', 'a1_risen_skeleton'] });
  DS.defineEncounter({ id: 'a1_enc_ash_hierophant', act: 1, tier: 'elite', name: 'Ash Hierophant',
    enemies: ['a1_ash_hierophant', 'a1_cult_initiate', 'a1_cult_initiate'] });
  DS.defineEncounter({ id: 'a1_enc_gloomwraith', act: 1, tier: 'elite', name: 'Gloomwraith',
    enemies: ['a1_gloomwraith'] });

  // ---- boss: one signature foe each ----
  DS.defineEncounter({ id: 'a1_enc_ooze_king', act: 1, tier: 'boss', name: 'The Ooze King',
    enemies: ['a1_ooze_king'] });
  DS.defineEncounter({ id: 'a1_enc_necromancer', act: 1, tier: 'boss', name: 'The Bone Necromancer',
    enemies: ['a1_bone_necromancer'] });
  DS.defineEncounter({ id: 'a1_enc_gatekeeper', act: 1, tier: 'boss', name: 'The Ashen Gatekeeper',
    enemies: ['a1_ashen_gatekeeper'] });
})();
