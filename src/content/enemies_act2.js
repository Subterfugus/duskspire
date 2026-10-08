/* DUSKSPIRE, Act 2: The Drowned City. Bestiary and encounter table (ids a2_). */
(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ------------------------------------------------------------------
  // Custom statuses
  // ------------------------------------------------------------------
  DS.defineStatus({
    id: 'a2_winding',
    name: 'Winding',
    desc: 'Clockwork charge: {n}. Once the gears are fully wound, the Colossus unleashes Overwind.',
    type: 'buff',
    icon: '⚙️',
    stacks: true,
    decay: null,
    expire: null,
  });

  // ------------------------------------------------------------------
  // MINIONS (only summoned or accompanying)
  // ------------------------------------------------------------------
  DS.defineEnemy({
    id: 'a2_siren_handmaid',
    name: 'Siren Handmaid',
    act: 2,
    tier: 'minion',
    hp: [28, 32],
    icon: '🫧',
    scale: 0.8,
    moves: {
      lull: {
        name: 'Lullaby',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 4 },
          { op: 'apply', status: 'weak', amount: 1 },
        ],
      },
      undertow: { name: 'Undertow', intent: 'attack', effects: [{ op: 'damage', amount: 8 }] },
      lament: { name: 'Lament', intent: 'defend', effects: [{ op: 'block', amount: 6, to: 'self' }] },
    },
    pattern: { type: 'sequence', moves: ['lull', 'undertow', 'lament'], loop: true },
  });

  DS.defineEnemy({
    id: 'a2_cog_drone',
    name: 'Cog Drone',
    act: 2,
    tier: 'minion',
    hp: [22, 26],
    icon: '⚙️',
    scale: 0.8,
    // Sparks when destroyed: a short burst of shrapnel at the player.
    triggers: {
      onDeath: [{ op: 'damage', amount: 6, to: 'player' }],
    },
    moves: {
      spin: { name: 'Buzzsaw Spin', intent: 'attack', effects: [{ op: 'damage', amount: 4 }] },
      sputter: {
        name: 'Sputter',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 2 },
          { op: 'add_card', card: 'status_burn', to: 'discard', amount: 1 },
        ],
      },
      whirr: { name: 'Whirr', intent: 'defend', effects: [{ op: 'block', amount: 6, to: 'self' }] },
    },
    pattern: { type: 'sequence', moves: ['spin', 'whirr', 'sputter', 'spin'], loop: true },
  });

  DS.defineEnemy({
    id: 'a2_plague_rat',
    name: 'Plague Rat',
    act: 2,
    tier: 'minion',
    hp: [12, 14],
    icon: '🐁',
    scale: 0.7,
    moves: {
      gnaw: { name: 'Gnaw', intent: 'attack', effects: [{ op: 'damage', amount: 4 }] },
      cough: {
        name: 'Foul Cough',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 2 },
          { op: 'add_card', card: 'status_slimed', to: 'discard', amount: 1 },
        ],
      },
      scurry: { name: 'Scurry', intent: 'defend', effects: [{ op: 'block', amount: 4, to: 'self' }] },
    },
    pattern: { type: 'random', weights: { gnaw: 45, cough: 35, scurry: 20 }, noRepeat: 2 },
  });

  // ------------------------------------------------------------------
  // NORMAL: swarmers (meant to appear in groups)
  // ------------------------------------------------------------------
  DS.defineEnemy({
    id: 'a2_drowned_thrall',
    name: 'Drowned Thrall',
    act: 2,
    tier: 'normal',
    hp: [20, 24],
    icon: '🧟',
    scale: 0.9,
    moves: {
      grab: {
        name: 'Waterlogged Grab',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 5 },
          { op: 'apply', status: 'weak', amount: 1 },
        ],
      },
      claw: { name: 'Brine Claw', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
      lurch: { name: 'Shamble', intent: 'defend', effects: [{ op: 'block', amount: 6, to: 'self' }] },
    },
    pattern: { type: 'random', weights: { grab: 35, claw: 40, lurch: 25 }, noRepeat: 2, first: 'claw' },
  });

  DS.defineEnemy({
    id: 'a2_sewer_rat',
    name: 'Sewer Rat',
    act: 2,
    tier: 'normal',
    hp: [16, 19],
    icon: '🐀',
    scale: 0.7,
    moves: {
      bite: { name: 'Gnaw', intent: 'attack', effects: [{ op: 'damage', amount: 6 }] },
      filth: {
        name: 'Filth Bite',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 3 },
          { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 },
        ],
      },
      scurry: { name: 'Scurry', intent: 'defend', effects: [{ op: 'block', amount: 5, to: 'self' }] },
    },
    pattern: { type: 'random', weights: { bite: 45, filth: 35, scurry: 20 }, noRepeat: 2 },
  });

  DS.defineEnemy({
    id: 'a2_mire_leech',
    name: 'Mire Leech',
    act: 2,
    tier: 'normal',
    hp: [18, 21],
    icon: '🪱',
    scale: 0.7,
    moves: {
      latch: {
        name: 'Latch On',
        intent: 'attack',
        effects: [
          { op: 'damage', amount: 4 },
          { op: 'heal', amount: 4, to: 'self' },
        ],
      },
      thrash: { name: 'Thrash', intent: 'attack', effects: [{ op: 'damage', amount: 3, times: 3 }] },
      sink: { name: 'Sink Under', intent: 'defend', effects: [{ op: 'block', amount: 7, to: 'self' }] },
    },
    pattern: { type: 'random', weights: { latch: 40, thrash: 35, sink: 25 }, noRepeat: 2 },
  });

  DS.defineEnemy({
    id: 'a2_cursed_squire',
    name: 'Cursed Squire',
    act: 2,
    tier: 'normal',
    hp: [24, 28],
    icon: '🗡️',
    scale: 0.9,
    moves: {
      chant: {
        name: 'Oath Chant',
        intent: 'buff',
        effects: [{ op: 'apply', status: 'ritual', amount: 1, to: 'self' }],
      },
      lunge: { name: 'Cursed Lunge', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
      slash: { name: 'Grave Slash', intent: 'attack', effects: [{ op: 'damage', amount: 9 }] },
    },
    pattern: { type: 'random', weights: { lunge: 45, slash: 35, chant: 20 }, noRepeat: 2, first: 'chant' },
  });

  DS.defineEnemy({
    id: 'a2_tidal_gull',
    name: 'Tidal Gull',
    act: 2,
    tier: 'normal',
    hp: [18, 22],
    icon: '🐦',
    scale: 0.7,
    moves: {
      dive: { name: 'Dive Bomb', intent: 'attack', effects: [{ op: 'damage', amount: 5 }] },
      peck: { name: 'Peck Storm', intent: 'attack', effects: [{ op: 'damage', amount: 2, times: 2 }] },
      screech: {
        name: 'Piercing Screech',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 2 },
          { op: 'apply', status: 'frail', amount: 1 },
        ],
      },
    },
    pattern: { type: 'random', weights: { dive: 40, peck: 35, screech: 25 }, noRepeat: 2, first: 'dive' },
  });

  DS.defineEnemy({
    id: 'a2_plague_acolyte',
    name: 'Plague Acolyte',
    act: 2,
    tier: 'normal',
    hp: [20, 24],
    icon: '🔔',
    scale: 0.9,
    moves: {
      censer: {
        name: 'Swinging Censer',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 4 },
          { op: 'apply', status: 'poison', amount: 3 },
        ],
      },
      flagellate: { name: 'Flagellation', intent: 'attack', effects: [{ op: 'damage', amount: 3, times: 3 }] },
      benediction: {
        name: 'Benediction of Rot',
        intent: 'buff',
        effects: [
          { op: 'heal', amount: 5, to: 'self' },
          { op: 'block', amount: 4, to: 'self' },
        ],
      },
    },
    pattern: {
      type: 'random',
      weights: { censer: 35, flagellate: 35, benediction: 30 },
      noRepeat: 2,
      first: 'censer',
    },
  });

  DS.defineEnemy({
    id: 'a2_pale_pickpocket',
    name: 'Pale Pickpocket',
    act: 2,
    tier: 'normal',
    hp: [16, 20],
    icon: '🥷',
    scale: 0.8,
    moves: {
      nick: { name: 'Quick Nick', intent: 'attack', effects: [{ op: 'damage', amount: 6 }] },
      pilfer: {
        name: 'Pilfer',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 4 },
          { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 },
        ],
      },
      vanish: { name: 'Slip Away', intent: 'defend', effects: [{ op: 'block', amount: 6, to: 'self' }] },
    },
    pattern: { type: 'random', weights: { nick: 40, pilfer: 35, vanish: 25 }, noRepeat: 2, first: 'pilfer' },
  });

  DS.defineEnemy({
    id: 'a2_oathbroken_knight',
    name: 'Oathbroken Knight',
    act: 2,
    tier: 'normal',
    hp: [62, 70],
    icon: '🛡️',
    scale: 1.1,
    onSpawn: [{ op: 'apply', status: 'plated_armor', amount: 6, to: 'self' }],
    moves: {
      cleave: { name: 'Rusted Cleave', intent: 'attack', effects: [{ op: 'damage', amount: 11 }] },
      bash: {
        name: 'Shield Bash',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 8 },
          { op: 'apply', status: 'vulnerable', amount: 1 },
        ],
      },
      vow: {
        name: 'Broken Vow',
        intent: 'buff',
        effects: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }],
      },
    },
    pattern: { type: 'sequence', moves: ['cleave', 'bash', 'vow'], loop: true },
  });

  DS.defineEnemy({
    id: 'a2_siren',
    name: 'Drowned Siren',
    act: 2,
    tier: 'normal',
    hp: [58, 64],
    icon: '🧜',
    scale: 1.0,
    moves: {
      song: {
        name: 'Lilting Song',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 6 },
          { op: 'apply', status: 'weak', amount: 1 },
        ],
      },
      hymn: {
        name: 'Hollow Hymn',
        intent: 'debuff',
        effects: [{ op: 'add_card', card: 'status_dazed', to: 'discard', amount: 2 }],
      },
      dive: { name: 'Riptide Dive', intent: 'attack', effects: [{ op: 'damage', amount: 15 }] },
    },
    pattern: { type: 'sequence', moves: ['song', 'hymn', 'dive'], loop: true },
  });

  DS.defineEnemy({
    id: 'a2_lantern_eel',
    name: 'Lantern Eel',
    act: 2,
    tier: 'normal',
    hp: [44, 50],
    icon: '🐍',
    scale: 1.1,
    onSpawn: [{ op: 'apply', status: 'thorns', amount: 2, to: 'self' }],
    moves: {
      shock: { name: 'Lantern Shock', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
      coil: {
        name: 'Coil Tight',
        intent: 'attack_defend',
        effects: [
          { op: 'damage', amount: 5 },
          { op: 'block', amount: 8, to: 'self' },
        ],
      },
      venom: {
        name: 'Venom Spit',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 3 },
          { op: 'apply', status: 'poison', amount: 3 },
        ],
      },
    },
    pattern: { type: 'random', weights: { shock: 35, coil: 30, venom: 35 }, noRepeat: 2, first: 'venom' },
  });

  DS.defineEnemy({
    id: 'a2_clockwork_sentry',
    name: 'Clockwork Sentry',
    act: 2,
    tier: 'normal',
    hp: [68, 76],
    icon: '🤖',
    scale: 1.2,
    onSpawn: [{ op: 'apply', status: 'plated_armor', amount: 6, to: 'self' }],
    moves: {
      scan: {
        name: 'Target Scan',
        intent: 'debuff',
        effects: [{ op: 'apply', status: 'vulnerable', amount: 2 }],
      },
      fire: { name: 'Piston Bolt', intent: 'attack', effects: [{ op: 'damage', amount: 11 }] },
      recal: { name: 'Recalibrate', intent: 'defend', effects: [{ op: 'block', amount: 14, to: 'self' }] },
      overheat: { name: 'Overheat Lance', intent: 'attack', effects: [{ op: 'damage', amount: 20 }] },
    },
    // Full power until half health, then it runs hot: alternates a 20-damage lance with bolts.
    ai: (ctx) => {
      const low = ctx.self.hp <= ctx.self.maxHp * 0.5;
      if (low) return ctx.turn % 2 === 0 ? 'overheat' : 'fire';
      return ['scan', 'fire', 'recal'][(ctx.turn - 1) % 3];
    },
  });

  DS.defineEnemy({
    id: 'a2_sunken_archer',
    name: 'Sunken Archer',
    act: 2,
    tier: 'normal',
    hp: [46, 52],
    icon: '🏹',
    scale: 1.0,
    moves: {
      aim: {
        name: 'Drowned Aim',
        intent: 'debuff',
        effects: [{ op: 'apply', status: 'vulnerable', amount: 1 }],
      },
      volley: { name: 'Barbed Volley', intent: 'attack', effects: [{ op: 'damage', amount: 6, times: 3 }] },
      retreat: { name: 'Sink Back', intent: 'defend', effects: [{ op: 'block', amount: 10, to: 'self' }] },
      snipe: { name: 'Eye for Eye', intent: 'attack', effects: [{ op: 'damage', amount: 16 }] },
    },
    pattern: { type: 'sequence', moves: ['aim', 'volley', 'retreat', 'snipe'], loop: true },
  });

  DS.defineEnemy({
    id: 'a2_brine_wraith',
    name: 'Brine Wraith',
    act: 2,
    tier: 'normal',
    hp: [40, 46],
    icon: '👻',
    scale: 1.0,
    moves: {
      wail: {
        name: 'Drowned Wail',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 6 },
          { op: 'apply', status: 'weak', amount: 1 },
          { op: 'add_card', card: 'status_dazed', to: 'draw', amount: 1 },
        ],
      },
      phase: {
        name: 'Phase Out',
        intent: 'buff',
        effects: [{ op: 'apply', status: 'intangible', amount: 1, to: 'self' }],
      },
      drain: {
        name: 'Life Drain',
        intent: 'attack',
        effects: [
          { op: 'damage', amount: 11 },
          { op: 'heal', amount: 10, to: 'self' },
        ],
      },
    },
    pattern: { type: 'random', weights: { wail: 35, phase: 15, drain: 50 }, noRepeat: 2, first: 'wail' },
  });

  DS.defineEnemy({
    id: 'a2_dockhand_brute',
    name: 'Dockhand Brute',
    act: 2,
    tier: 'normal',
    hp: [62, 68],
    icon: '🪝',
    scale: 1.3,
    // Every blow it takes makes it stronger.
    onSpawn: [{ op: 'apply', status: 'angry', amount: 1, to: 'self' }],
    moves: {
      haul: { name: 'Hook Haul', intent: 'attack', effects: [{ op: 'damage', amount: 11 }] },
      slam: {
        name: 'Cargo Slam',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 9 },
          { op: 'apply', status: 'frail', amount: 2 },
        ],
      },
      bellow: {
        name: 'Bellow',
        intent: 'buff',
        effects: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }],
      },
    },
    pattern: { type: 'sequence', moves: ['haul', 'slam', 'haul', 'bellow'], loop: true },
  });

  DS.defineEnemy({
    id: 'a2_drowned_hag',
    name: 'Drowned Hag',
    act: 2,
    tier: 'normal',
    hp: [54, 60],
    icon: '🔮',
    scale: 1.1,
    moves: {
      hex: {
        name: 'Brine Hex',
        intent: 'debuff',
        effects: [
          { op: 'apply', status: 'weak', amount: 2 },
          { op: 'apply', status: 'frail', amount: 1 },
        ],
      },
      slime: {
        name: 'Slime Brew',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 6 },
          { op: 'add_card', card: 'status_slimed', to: 'discard', amount: 2 },
        ],
      },
      drown: { name: 'Drowning Curse', intent: 'attack', effects: [{ op: 'damage', amount: 9, times: 2 }] },
      mend: {
        name: 'Mend Sea-Rot',
        intent: 'buff',
        effects: [
          { op: 'heal', amount: 6, to: 'self' },
          { op: 'block', amount: 6, to: 'self' },
        ],
      },
    },
    pattern: {
      type: 'random',
      weights: { hex: 25, slime: 30, drown: 25, mend: 20 },
      noRepeat: 2,
      first: 'hex',
    },
  });

  // ------------------------------------------------------------------
  // ELITES
  // ------------------------------------------------------------------

  // Punishes multi-hit attack chains: every hit is answered with thorns.
  DS.defineEnemy({
    id: 'a2_drowned_knight',
    name: 'The Drowned Knight',
    act: 2,
    tier: 'elite',
    hp: [135, 144],
    icon: '⚓',
    scale: 1.4,
    onSpawn: [{ op: 'apply', status: 'thorns', amount: 2, to: 'self' }],
    moves: {
      oath: {
        name: 'Oath of the Deep',
        intent: 'buff',
        effects: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }],
      },
      tide_cleave: { name: 'Tidal Cleave', intent: 'attack', effects: [{ op: 'damage', amount: 11 }] },
      brine_shield: {
        name: 'Brine Shield',
        intent: 'attack_defend',
        effects: [
          { op: 'damage', amount: 5 },
          { op: 'block', amount: 14, to: 'self' },
        ],
      },
      drag_under: {
        name: 'Drag Under',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 9 },
          { op: 'apply', status: 'weak', amount: 1 },
        ],
      },
      last_tide: { name: 'Last Tide', intent: 'attack', effects: [{ op: 'damage', amount: 16 }] },
    },
    // Opens with its oath, cycles through its strikes, and once below half health
    // unleashes the Last Tide every third turn.
    ai: (ctx) => {
      const low = ctx.self.hp <= ctx.self.maxHp * 0.5;
      if (low && ctx.turn % 3 === 0) return 'last_tide';
      const order = ['oath', 'tide_cleave', 'brine_shield', 'drag_under'];
      return order[(ctx.turn - 1) % order.length];
    },
  });

  // Punishes skill-heavy decks: every skill the player plays feeds its strength.
  DS.defineEnemy({
    id: 'a2_hoard_mimic',
    name: 'Hoard Mimic',
    act: 2,
    tier: 'elite',
    hp: [126, 135],
    icon: '🎁',
    scale: 1.2,
    onSpawn: [{ op: 'apply', status: 'enrage', amount: 1, to: 'self' }],
    moves: {
      lurk: { name: 'Lie Still', intent: 'sleep', effects: [] },
      gobble: { name: 'Gobble', intent: 'attack', effects: [{ op: 'damage', amount: 12 }] },
      tongue: {
        name: 'Sticky Tongue',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 6 },
          { op: 'apply', status: 'entangle', amount: 1 },
        ],
      },
      swallow: { name: 'Swallow Whole', intent: 'attack', effects: [{ op: 'damage', amount: 7, times: 2 }] },
      spit: {
        name: 'Spit Coins',
        intent: 'debuff',
        effects: [{ op: 'add_card', card: 'status_wound', to: 'discard', amount: 2 }],
      },
    },
    // Sleeps through the first turn, then cycles. Entangle locks the player out of attacks for a turn.
    ai: (ctx) => {
      if (ctx.turn === 1) return 'lurk';
      const cycle = ['gobble', 'tongue', 'swallow', 'spit'];
      return cycle[(ctx.turn - 2) % cycle.length];
    },
  });

  // Punishes debuff-heavy plays: its gutter armour blunts the first two debuffs.
  DS.defineEnemy({
    id: 'a2_gutter_captain',
    name: 'Gutter Captain',
    act: 2,
    tier: 'elite',
    hp: [130, 138],
    icon: '🦹',
    scale: 1.1,
    onSpawn: [{ op: 'apply', status: 'artifact', amount: 2, to: 'self' }],
    moves: {
      pilfer: {
        name: 'Pilfer the Purse',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 11 },
          { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 2 },
        ],
      },
      smoke: {
        name: 'Smoke Bomb',
        intent: 'debuff',
        effects: [
          { op: 'block', amount: 12, to: 'self' },
          { op: 'apply', status: 'no_draw', amount: 1, to: 'target' },
        ],
      },
      flurry: { name: 'Knife Flurry', intent: 'attack', effects: [{ op: 'damage', amount: 5, times: 4 }] },
      hold: {
        name: 'Hold Up',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 9 },
          { op: 'apply', status: 'weak', amount: 2 },
        ],
      },
    },
    pattern: { type: 'sequence', moves: ['pilfer', 'smoke', 'flurry', 'hold'], loop: true },
  });

  // Summons plague rats; the rats' deaths feed the priest.
  DS.defineEnemy({
    id: 'a2_plague_priest',
    name: 'Plague Priest',
    act: 2,
    tier: 'elite',
    hp: [113, 119],
    icon: '☣️',
    scale: 1.2,
    triggers: {
      onEnemyDeath: [{ op: 'heal', amount: 3, to: 'self' }],
    },
    moves: {
      summon_rats: {
        name: 'Call the Swarm',
        intent: 'buff',
        effects: [{ op: 'summon', enemy: 'a2_plague_rat', amount: 2 }],
      },
      censer: {
        name: 'Pestilent Censer',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 7 },
          { op: 'apply', status: 'poison', amount: 4 },
        ],
      },
      rot: {
        name: 'Rot Bloom',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 5 },
          { op: 'add_card', card: 'status_slimed', to: 'discard', amount: 2 },
        ],
      },
      bless: {
        name: 'Plague Blessing',
        intent: 'buff',
        effects: [
          { op: 'heal', amount: 10, to: 'self' },
          { op: 'apply', status: 'strength', amount: 2, to: 'self' },
        ],
      },
    },
    ai: (ctx) => {
      const rats = ctx.combat.livingEnemies().filter((e) => e.id === 'a2_plague_rat').length;
      const low = ctx.self.hp <= ctx.self.maxHp * 0.5;
      if (ctx.turn === 1 || rats === 0) return 'summon_rats';
      if (rats === 1 && ctx.turn % 3 === 0) return 'summon_rats';
      const cycle = low ? ['censer', 'bless', 'rot'] : ['censer', 'rot', 'censer'];
      return cycle[(ctx.turn - 1) % cycle.length];
    },
  });

  // ------------------------------------------------------------------
  // BOSSES
  // ------------------------------------------------------------------

  // Phase 1: lulls and undertows, with a choir of handmaids re-summoned as needed.
  // Phase 2 (below half): a Tidal Throne every third turn, and the crowd thins out.
  // Every handmaid that dies stirs her strength.
  DS.defineEnemy({
    id: 'a2_siren_queen',
    name: 'The Siren Queen',
    act: 2,
    tier: 'boss',
    hp: [227, 239],
    icon: '👑',
    scale: 1.7,
    onSpawn: [{ op: 'apply', status: 'artifact', amount: 1, to: 'self' }],
    triggers: {
      onEnemyDeath: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }],
    },
    moves: {
      lull: {
        name: 'Lull of the Deep',
        intent: 'debuff',
        effects: [
          { op: 'apply', status: 'weak', amount: 2 },
          { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 },
        ],
      },
      choir: {
        name: 'Summon Choir',
        intent: 'buff',
        effects: [{ op: 'summon', enemy: 'a2_siren_handmaid', amount: 2 }],
      },
      undertow: {
        name: 'Undertow',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 10 },
          { op: 'apply', status: 'vulnerable', amount: 1 },
        ],
      },
      hymn: {
        name: 'Void Hymn',
        intent: 'debuff',
        effects: [{ op: 'add_card', card: 'status_void', to: 'draw', amount: 2 }],
      },
      throne: {
        name: 'Tidal Throne',
        intent: 'attack_buff',
        effects: [
          { op: 'damage', amount: 19 },
          { op: 'apply', status: 'strength', amount: 3, to: 'self' },
        ],
      },
    },
    ai: (ctx) => {
      const low = ctx.self.hp <= ctx.self.maxHp * 0.5;
      const maids = ctx.combat.livingEnemies().filter((e) => e.id === 'a2_siren_handmaid').length;
      if (!low) {
        if (ctx.turn === 1 || maids === 0) return 'choir';
        return ['lull', 'undertow', 'hymn', 'undertow'][(ctx.turn - 1) % 4];
      }
      if (ctx.turn % 3 === 0) return 'throne';
      if (maids < 2 && ctx.turn % 2 === 0) return 'choir';
      return ['undertow', 'hymn', 'lull', 'undertow'][ctx.turn % 4];
    },
  });

  // Signature: Winding. Each turn adds a charge to the Colossus; a full charge
  // releases OVERWIND (24 damage). The charge fills every 3 turns, or every 2 below half health.
  // Cog drones it builds sputter in and each one destroyed re-plates its armour.
  DS.defineEnemy({
    id: 'a2_clockwork_colossus',
    name: 'Clockwork Colossus',
    act: 2,
    tier: 'boss',
    hp: [231, 243],
    icon: '🦾',
    scale: 2.0,
    onSpawn: [{ op: 'apply', status: 'plated_armor', amount: 6, to: 'self' }],
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'a2_winding', amount: 1, to: 'self' }],
      onEnemyDeath: [{ op: 'apply', status: 'plated_armor', amount: 2, to: 'self' }],
    },
    moves: {
      gear: { name: 'Gear Grind', intent: 'attack', effects: [{ op: 'damage', amount: 9, times: 2 }] },
      piston: {
        name: 'Piston Punch',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 9 },
          { op: 'apply', status: 'vulnerable', amount: 1 },
        ],
      },
      boiler: {
        name: 'Boiler Vent',
        intent: 'buff',
        effects: [
          { op: 'block', amount: 18, to: 'self' },
          { op: 'apply', status: 'strength', amount: 1, to: 'self' },
        ],
      },
      deploy: {
        name: 'Deploy Cogs',
        intent: 'buff',
        effects: [{ op: 'summon', enemy: 'a2_cog_drone', amount: 2 }],
      },
      overwind: {
        name: 'OVERWIND',
        intent: 'attack',
        effects: [
          { op: 'damage', amount: 20 },
          { op: 'remove_status', status: 'a2_winding', to: 'self' },
        ],
      },
    },
    ai: (ctx) => {
      const wound = ctx.self.statuses.a2_winding || 0;
      const low = ctx.self.hp <= ctx.self.maxHp * 0.5;
      const cogs = ctx.combat.livingEnemies().filter((e) => e.id === 'a2_cog_drone').length;
      if (wound >= (low ? 1 : 2)) return 'overwind';
      if (ctx.turn === 1 || (cogs === 0 && ctx.turn % 3 === 0)) return 'deploy';
      const cycle = low ? ['gear', 'piston', 'boiler', 'gear'] : ['gear', 'piston', 'boiler'];
      return cycle[(ctx.turn - 1) % cycle.length];
    },
  });

  // Twin knights. Each one's death heals the survivor and hardens it with strength.
  // Harrow's Bulwark Oath also raises a shield for his sister.
  const oathBond = () => ({
    onEnemyDeath: [
      { op: 'heal', amount: 25, to: 'self' },
      { op: 'apply', status: 'strength', amount: 4, to: 'self' },
    ],
  });

  DS.defineEnemy({
    id: 'a2_sir_harrow',
    name: 'Sir Harrow the Unbroken',
    act: 2,
    tier: 'boss',
    hp: [135, 144],
    icon: '⚔️',
    scale: 1.5,
    onSpawn: [{ op: 'apply', status: 'plated_armor', amount: 8, to: 'self' }],
    triggers: oathBond(),
    moves: {
      bash: {
        name: 'Shield Bash',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 9 },
          { op: 'apply', status: 'vulnerable', amount: 1 },
        ],
      },
      bulwark: {
        name: 'Bulwark Oath',
        intent: 'defend',
        effects: [
          { op: 'block', amount: 16, to: 'self' },
          {
            op: 'custom',
            fn: async (ctx) => {
              const allies = ctx.combat.livingEnemies().filter((e) => e.uid !== ctx.source.uid);
              for (const ally of allies) {
                await ctx.combat.runEffects([{ op: 'block', amount: 10, to: 'self' }], { source: ally });
              }
            },
          },
        ],
      },
      ruin: {
        name: 'Oath of Ruin',
        intent: 'debuff',
        effects: [{ op: 'add_card', card: 'status_wound', to: 'draw', amount: 2 }],
      },
      charge: { name: 'Sworn Charge', intent: 'attack', effects: [{ op: 'damage', amount: 14 }] },
    },
    // Below half health the oath breaks: he stops reciting it and charges between bashes.
    ai: (ctx) => {
      const low = ctx.self.hp <= ctx.self.maxHp * 0.5;
      if (low) return ['charge', 'bash', 'charge', 'bulwark'][(ctx.turn - 1) % 4];
      return ['bash', 'bulwark', 'ruin', 'charge'][(ctx.turn - 1) % 4];
    },
  });

  DS.defineEnemy({
    id: 'a2_dame_veyl',
    name: 'Dame Veyl the Pale',
    act: 2,
    tier: 'boss',
    hp: [113, 122],
    icon: '🤺',
    scale: 1.3,
    onSpawn: [{ op: 'apply', status: 'artifact', amount: 1, to: 'self' }],
    triggers: oathBond(),
    moves: {
      hex: {
        name: 'Hex Lance',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 6 },
          { op: 'apply', status: 'weak', amount: 2 },
        ],
      },
      pierce: { name: 'Piercing Oath', intent: 'attack', effects: [{ op: 'damage', amount: 4, times: 3 }] },
      swear: {
        name: 'Swear Again',
        intent: 'buff',
        effects: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }],
      },
    },
    // Below half health her oaths turn into lances: she pierces three times for every hex, and stops swearing.
    ai: (ctx) => {
      const low = ctx.self.hp <= ctx.self.maxHp * 0.5;
      if (low) return ['pierce', 'hex', 'pierce', 'pierce'][(ctx.turn - 1) % 4];
      return ['hex', 'pierce', 'swear', 'pierce'][(ctx.turn - 1) % 4];
    },
  });

  // ------------------------------------------------------------------
  // ENCOUNTERS
  // ------------------------------------------------------------------
  const encounters = [
    // Easy: one or two weak enemies
    { id: 'a2_enc_flooded_stair', name: 'Flooded Stairwell', tier: 'easy', enemies: ['a2_drowned_thrall', 'a2_drowned_thrall'] },
    { id: 'a2_enc_rat_nest', name: 'Rat Nest', tier: 'easy', enemies: ['a2_sewer_rat', 'a2_sewer_rat'] },
    { id: 'a2_enc_gull_roost', name: 'Gull Roost', tier: 'easy', enemies: ['a2_tidal_gull', 'a2_tidal_gull'] },
    { id: 'a2_enc_pickpocket_alley', name: 'Pickpocket Alley', tier: 'easy', enemies: ['a2_pale_pickpocket', 'a2_pale_pickpocket'] },
    { id: 'a2_enc_bell_vigil', name: 'Bell Chapel Vigil', tier: 'easy', enemies: ['a2_plague_acolyte'] },
    { id: 'a2_enc_squire_patrol', name: 'Squire Patrol', tier: 'easy', enemies: ['a2_cursed_squire'] },
    { id: 'a2_enc_leech_pool', name: 'Leech Pool', tier: 'easy', enemies: ['a2_mire_leech', 'a2_mire_leech'] },

    // Normal: varied 1-3 enemy groups
    { id: 'a2_enc_thrall_pack', name: 'Thrall Pack', tier: 'normal', enemies: ['a2_drowned_thrall', 'a2_drowned_thrall', 'a2_drowned_thrall'] },
    { id: 'a2_enc_rat_warren', name: 'Rat Warren', tier: 'normal', enemies: ['a2_sewer_rat', 'a2_sewer_rat', 'a2_sewer_rat'] },
    { id: 'a2_enc_gull_acolyte', name: 'Gull and Acolyte', tier: 'normal', enemies: ['a2_tidal_gull', 'a2_plague_acolyte'] },
    { id: 'a2_enc_squire_thrall', name: 'Squire and Thrall', tier: 'normal', enemies: ['a2_cursed_squire', 'a2_drowned_thrall'] },
    { id: 'a2_enc_oathbroken', name: 'The Oathbroken', tier: 'normal', enemies: ['a2_oathbroken_knight'] },
    { id: 'a2_enc_siren_shore', name: "Siren's Shore", tier: 'normal', enemies: ['a2_siren'] },
    { id: 'a2_enc_lantern_eel', name: 'Lantern Eel', tier: 'normal', enemies: ['a2_lantern_eel'] },
    { id: 'a2_enc_clockwork_patrol', name: 'Clockwork Patrol', tier: 'normal', enemies: ['a2_clockwork_sentry', 'a2_mire_leech'] },
    { id: 'a2_enc_sunken_archers', name: 'Sunken Archers', tier: 'normal', enemies: ['a2_sunken_archer', 'a2_pale_pickpocket'] },
    { id: 'a2_enc_brine_wraith', name: 'Brine Wraith', tier: 'normal', enemies: ['a2_brine_wraith'] },
    { id: 'a2_enc_dockhand', name: 'Dockhand Brute', tier: 'normal', enemies: ['a2_dockhand_brute'] },
    { id: 'a2_enc_hag_leeches', name: 'Hag and Leeches', tier: 'normal', enemies: ['a2_drowned_hag', 'a2_mire_leech', 'a2_mire_leech'] },
    { id: 'a2_enc_pickpocket_crew', name: 'Pickpocket Crew', tier: 'normal', enemies: ['a2_pale_pickpocket', 'a2_pale_pickpocket', 'a2_cursed_squire'] },
    { id: 'a2_enc_lantern_gulls', name: 'Lantern and Gull', tier: 'normal', enemies: ['a2_lantern_eel', 'a2_tidal_gull'] },
    { id: 'a2_enc_knights_escort', name: "Knight's Escort", tier: 'normal', enemies: ['a2_oathbroken_knight', 'a2_cursed_squire'] },
    { id: 'a2_enc_wailing_chapel', name: 'Wailing Chapel', tier: 'normal', enemies: ['a2_brine_wraith', 'a2_plague_acolyte'] },

    // Elite: gimmick fights, some with minions
    { id: 'a2_enc_elite_drowned_knight', name: 'The Drowned Knight', tier: 'elite', enemies: ['a2_drowned_knight'] },
    { id: 'a2_enc_elite_hoard_mimic', name: 'Hoard Mimic', tier: 'elite', enemies: ['a2_hoard_mimic'] },
    { id: 'a2_enc_elite_gutter_captain', name: 'Gutter Captain', tier: 'elite', enemies: ['a2_gutter_captain', 'a2_pale_pickpocket'] },
    { id: 'a2_enc_elite_plague_cathedral', name: 'Plague Cathedral', tier: 'elite', enemies: ['a2_plague_priest'] },
    { id: 'a2_enc_elite_siren_choir', name: 'Siren Choir', tier: 'elite', enemies: ['a2_siren', 'a2_siren_handmaid', 'a2_siren_handmaid', 'a2_siren_handmaid'] },

    // Boss
    { id: 'a2_enc_boss_siren_queen', name: 'The Siren Queen', tier: 'boss', enemies: ['a2_siren_queen'] },
    { id: 'a2_enc_boss_colossus', name: 'Clockwork Colossus', tier: 'boss', enemies: ['a2_clockwork_colossus'] },
    { id: 'a2_enc_boss_oathbound_twins', name: 'Oathbound Twins', tier: 'boss', enemies: ['a2_sir_harrow', 'a2_dame_veyl'] },
  ];

  for (const enc of encounters) {
    DS.defineEncounter({ ...enc, act: 2 });
  }
})();
