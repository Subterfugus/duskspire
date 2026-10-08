(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // Act 3: the Duskspire Summit. Void horrors, fallen angels, living storms,
  // crystal golems, time-eaters and shadow twins. Ids are prefixed a3_.
  // Numbers: act 3 ~ x2.6 hp, ~ x2 damage versus the act 1 baseline.

  // ---------- effect builders (each returns a plain contract effect) ----------
  const dmg = (amount, times) => ({ op: 'damage', amount: amount, times: times || 1 });
  const blk = (amount) => ({ op: 'block', amount: amount, to: 'self' });
  const healSelf = (amount) => ({ op: 'heal', amount: amount, to: 'self' });
  const buffSelf = (status, amount) => ({ op: 'apply', status: status, amount: amount, to: 'self' });
  const debuffPlayer = (status, amount) => ({ op: 'apply', status: status, amount: amount, to: 'player' });
  const addCard = (card, to, amount) => ({ op: 'add_card', card: card, to: to, amount: amount || 1 });
  const summon = (enemy, amount) => ({ op: 'summon', enemy: enemy, amount: amount || 1 });
  const unstatus = (status) => ({ op: 'remove_status', status: status, to: 'self' });

  // ---------- custom statuses (a3_ prefix) ----------
  DS.defineStatus({
    id: 'a3_storm_charge',
    name: 'Stormcharge',
    desc: 'Gathers from every attack the player plays. Discharge unleashes 8 damage per charge. Charge: {n}.',
    type: 'buff',
    icon: '⚡',
    stacks: true,
    decay: null,
    expire: null,
    mods: {},
    triggers: {}
  });

  DS.defineStatus({
    id: 'a3_unravel',
    name: 'Unravel',
    desc: 'At the start of your turn you lose {n} HP, ignoring block. Fades by 1 each turn.',
    type: 'debuff',
    icon: '🌀',
    stacks: true,
    decay: 'turn_end',
    expire: null,
    mods: {},
    triggers: {
      onTurnStart: [{ op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'a3_dread',
    name: 'Dread',
    desc: 'Whenever you draw a card you lose {n} HP. Fades by 1 at the end of each turn.',
    type: 'debuff',
    icon: '👁️',
    stacks: true,
    decay: 'turn_end',
    expire: null,
    mods: {},
    triggers: {
      onCardDrawn: [{ op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // ======================= MINIONS (summoned or accompanying) =======================

  DS.defineEnemy({
    id: 'a3_umbral_mote',
    name: 'Umbral Mote',
    act: 3,
    tier: 'minion',
    hp: [14, 18],
    icon: '🕳️',
    scale: 0.7,
    desc: 'A sliver of void torn loose from the Herald. Nicks hard, drinks a little life back, and sometimes hides.',
    moves: {
      nick: { name: 'Nick', intent: 'attack', effects: [dmg(8)] },
      drain: { name: 'Drain', intent: 'attack', effects: [dmg(4), healSelf(4)] },
      veil: { name: 'Shroud', intent: 'defend', effects: [blk(6)] }
    },
    pattern: { type: 'sequence', moves: ['nick', 'drain', 'veil'], loop: true }
  });

  DS.defineEnemy({
    id: 'a3_sanctum_idol',
    name: 'Sanctum Idol',
    act: 3,
    tier: 'minion',
    hp: [44, 50],
    icon: '🏛️',
    scale: 0.9,
    desc: 'A gilded idol that hums hymns of frailty and guards its master with plate.',
    onSpawn: [buffSelf('plated_armor', 4)],
    moves: {
      hymn: { name: 'Hymn of Frailty', intent: 'debuff', effects: [debuffPlayer('weak', 1)] },
      ward: { name: 'Ward', intent: 'defend', effects: [blk(14)] },
      rebuke: { name: 'Rebuke', intent: 'attack', effects: [dmg(10)] }
    },
    pattern: { type: 'sequence', moves: ['hymn', 'ward', 'rebuke'], loop: true }
  });

  DS.defineEnemy({
    id: 'a3_chrono_shard',
    name: 'Chrono Shard',
    act: 3,
    tier: 'minion',
    hp: [18, 22],
    icon: '⏱️',
    scale: 0.7,
    desc: 'A broken second of the Time Eater. Tick hits; tock jams your deck with Dazed.',
    moves: {
      tick: { name: 'Tick', intent: 'attack', effects: [dmg(9)] },
      tock: { name: 'Tock', intent: 'debuff', effects: [blk(6), addCard('status_dazed', 'discard', 1)] },
      stillness: { name: 'Stillness', intent: 'defend', effects: [blk(8)] }
    },
    pattern: { type: 'sequence', moves: ['tick', 'tock', 'stillness'], loop: true }
  });

  // ======================= NORMAL: SWARMERS (2-4 per fight) =======================

  DS.defineEnemy({
    id: 'a3_voidling',
    name: 'Voidling',
    act: 3,
    tier: 'normal',
    hp: [28, 34],
    icon: '🌑',
    scale: 0.8,
    desc: 'Hungry shadows that rake at you and leave void-stained cards behind.',
    moves: {
      gnaw: { name: 'Gnaw', intent: 'attack', effects: [dmg(9)] },
      rend: { name: 'Rend', intent: 'attack_debuff', effects: [dmg(6), addCard('status_void', 'discard', 1)] },
      shroud: { name: 'Void Shroud', intent: 'defend', effects: [blk(8)] }
    },
    pattern: { type: 'random', weights: { gnaw: 50, rend: 30, shroud: 20 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a3_ember_wisp',
    name: 'Ember Wisp',
    act: 3,
    tier: 'normal',
    hp: [24, 30],
    icon: '🔥',
    scale: 0.75,
    desc: 'A wandering cinder that burns through your draw pile and grows brighter each turn.',
    moves: {
      flare: { name: 'Flare', intent: 'attack_debuff', effects: [dmg(9), addCard('status_burn', 'discard', 1)] },
      kindle: { name: 'Kindle', intent: 'buff', effects: [buffSelf('strength', 1)] },
      flicker: { name: 'Flicker', intent: 'defend', effects: [blk(8)] }
    },
    pattern: { type: 'random', weights: { flare: 50, kindle: 25, flicker: 25 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a3_fallen_cherub',
    name: 'Fallen Cherub',
    act: 3,
    tier: 'normal',
    hp: [30, 36],
    icon: '🪽',
    scale: 0.85,
    desc: 'A cast-out choir boy. Halo strikes weaken, wings dart, and the wail leaves you exposed.',
    moves: {
      halo_strike: { name: 'Halo Strike', intent: 'attack_debuff', effects: [dmg(10), debuffPlayer('weak', 1)] },
      feather_dart: { name: 'Feather Dart', intent: 'attack', effects: [dmg(6, 2)] },
      wail: { name: 'Fallen Wail', intent: 'debuff', effects: [debuffPlayer('vulnerable', 1)] }
    },
    pattern: { type: 'sequence', moves: ['halo_strike', 'feather_dart', 'wail'], loop: true }
  });

  DS.defineEnemy({
    id: 'a3_dusk_moth',
    name: 'Dusk Moth',
    act: 3,
    tier: 'normal',
    hp: [22, 28],
    icon: '🦋',
    scale: 0.7,
    desc: 'Dust-scattering moth. Its scales make your blocking clumsy.',
    moves: {
      dust: { name: 'Dust Scatter', intent: 'attack_debuff', effects: [dmg(5), debuffPlayer('frail', 1)] },
      flutter: { name: 'Flutter', intent: 'attack', effects: [dmg(8)] },
      shimmer: { name: 'Shimmer', intent: 'defend', effects: [blk(7)] }
    },
    pattern: { type: 'random', weights: { dust: 45, flutter: 30, shimmer: 25 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a3_storm_mote',
    name: 'Storm Mote',
    act: 3,
    tier: 'normal',
    hp: [20, 26],
    icon: '💫',
    scale: 0.7,
    desc: 'Crackling static in a jar. Hits several times and leaves Dazed behind.',
    moves: {
      jolt: { name: 'Jolt', intent: 'attack', effects: [dmg(5, 3)] },
      static: { name: 'Static Burst', intent: 'attack_debuff', effects: [dmg(4), addCard('status_dazed', 'discard', 1)] },
      ground: { name: 'Ground Out', intent: 'defend', effects: [blk(6)] }
    },
    pattern: { type: 'random', weights: { jolt: 50, static: 30, ground: 20 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a3_gloam_hound',
    name: 'Gloam Hound',
    act: 3,
    tier: 'normal',
    hp: [30, 38],
    icon: '🐺',
    scale: 0.9,
    desc: 'Hounds bred in the dusk-fog. They run in packs and howl to stiffen each other.',
    moves: {
      maul: { name: 'Maul', intent: 'attack', effects: [dmg(7, 2)] },
      lunge: { name: 'Lunge', intent: 'attack', effects: [dmg(14)] },
      howl: { name: 'Gloam Howl', intent: 'buff', effects: [buffSelf('strength', 1)] }
    },
    pattern: { type: 'random', weights: { maul: 45, lunge: 30, howl: 25 }, noRepeat: 2, first: 'maul' }
  });

  DS.defineEnemy({
    id: 'a3_bell_wight',
    name: 'Bell Wight',
    act: 3,
    tier: 'normal',
    hp: [38, 44],
    icon: '🔔',
    scale: 0.9,
    desc: 'A dead ringer. Its chime shuffles Dazed into your discard pile.',
    moves: {
      chime: { name: 'Dazing Chime', intent: 'attack_debuff', effects: [dmg(6), addCard('status_dazed', 'discard', 2)] },
      toll: { name: 'Mourning Toll', intent: 'defend', effects: [blk(12)] },
      knell: { name: 'Death Knell', intent: 'attack', effects: [dmg(13)] }
    },
    pattern: { type: 'sequence', moves: ['chime', 'toll', 'knell'], loop: true }
  });

  DS.defineEnemy({
    id: 'a3_shard_sprite',
    name: 'Shard Sprite',
    act: 3,
    tier: 'normal',
    hp: [30, 36],
    icon: '💎',
    scale: 0.8,
    desc: 'A sprite of cut crystal. Plated with shards that fall off as it takes hits.',
    onSpawn: [buffSelf('plated_armor', 3)],
    moves: {
      prick: { name: 'Prick', intent: 'attack', effects: [dmg(9)] },
      refract: { name: 'Refract', intent: 'defend', effects: [blk(10)] },
      splinter: { name: 'Splinter', intent: 'attack_debuff', effects: [dmg(5), addCard('status_wound', 'discard', 1)] }
    },
    pattern: { type: 'sequence', moves: ['prick', 'refract', 'splinter'], loop: true }
  });

  // ======================= NORMAL: SOLO / DUO HEAVIES =======================

  DS.defineEnemy({
    id: 'a3_sand_sentinel',
    name: 'Sand Sentinel',
    act: 3,
    tier: 'normal',
    hp: [60, 68],
    icon: '⌛',
    scale: 1.0,
    desc: 'A hourglass knight. Sifts your footing away, grinds, then hunkers behind a wall of sand.',
    moves: {
      sift: { name: 'Sift', intent: 'attack_debuff', effects: [dmg(11), debuffPlayer('weak', 1)] },
      grind: { name: 'Grind', intent: 'attack', effects: [dmg(18)] },
      sand: { name: 'Sand Wall', intent: 'defend', effects: [blk(16)] }
    },
    pattern: { type: 'sequence', moves: ['sift', 'grind', 'sand', 'grind'], loop: true }
  });

  DS.defineEnemy({
    id: 'a3_crystal_golem',
    name: 'Crystal Golem',
    act: 3,
    tier: 'normal',
    hp: [96, 106],
    icon: '🗿',
    scale: 1.4,
    desc: 'A slow mountain of crystal. Its fractures bury your deck in Wounds; every blow chips its plates.',
    onSpawn: [buffSelf('plated_armor', 6)],
    moves: {
      slam: { name: 'Crystal Slam', intent: 'attack', effects: [dmg(22)] },
      facet: { name: 'Facet', intent: 'defend', effects: [blk(18)] },
      fracture: { name: 'Fracture', intent: 'attack_debuff', effects: [dmg(12), addCard('status_wound', 'discard', 2)] },
      grow: { name: 'Crystal Growth', intent: 'buff', effects: [buffSelf('strength', 2)] }
    },
    pattern: { type: 'sequence', moves: ['slam', 'facet', 'fracture', 'grow'], loop: true }
  });

  DS.defineEnemy({
    id: 'a3_ruined_paladin',
    name: 'Ruined Paladin',
    act: 3,
    tier: 'normal',
    hp: [84, 92],
    icon: '🛡️',
    scale: 1.1,
    desc: 'A knight whose oath rotted into judgment. Every blow you land makes it angrier.',
    onSpawn: [buffSelf('angry', 1)],
    moves: {
      oath_strike: { name: 'Oathbreaker', intent: 'attack', effects: [dmg(18)] },
      bulwark: { name: 'Bulwark', intent: 'defend', effects: [blk(18)] },
      dread_judgment: { name: 'Dread Judgment', intent: 'attack_debuff', effects: [dmg(12, 2), debuffPlayer('vulnerable', 1)] }
    },
    pattern: { type: 'random', weights: { oath_strike: 40, bulwark: 25, dread_judgment: 35 }, noRepeat: 2, first: 'oath_strike' }
  });

  DS.defineEnemy({
    id: 'a3_glass_wraith',
    name: 'Glass Wraith',
    act: 3,
    tier: 'normal',
    hp: [70, 78],
    icon: '👻',
    scale: 1.0,
    desc: 'A ghost of polished glass. Its skin reflects damage back at attackers.',
    onSpawn: [buffSelf('thorns', 4)],
    moves: {
      shatter_touch: { name: 'Shatter Touch', intent: 'attack_debuff', effects: [dmg(15), debuffPlayer('frail', 1)] },
      reflect: { name: 'Reflect', intent: 'defend', effects: [blk(14), buffSelf('thorns', 2)] },
      whisper: { name: 'Glass Whisper', intent: 'debuff', effects: [addCard('status_slimed', 'discard', 2)] }
    },
    pattern: { type: 'random', weights: { shatter_touch: 45, reflect: 25, whisper: 30 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a3_dusk_cultist',
    name: 'Dusk Cultist',
    act: 3,
    tier: 'normal',
    hp: [48, 54],
    icon: '🕯️',
    scale: 1.0,
    desc: 'A robed zealot who chants until the dark answers. Ritual makes it stronger every turn.',
    onSpawn: [buffSelf('ritual', 1)],
    moves: {
      dark_lash: { name: 'Dark Lash', intent: 'attack', effects: [dmg(14)] },
      curse_words: { name: 'Curse Words', intent: 'attack_debuff', effects: [dmg(8), addCard('status_void', 'discard', 1)] },
      chant: { name: 'Deeper Chant', intent: 'buff', effects: [buffSelf('ritual', 1)] }
    },
    pattern: { type: 'random', weights: { dark_lash: 50, curse_words: 30, chant: 20 }, noRepeat: 2, first: 'chant' }
  });

  DS.defineEnemy({
    id: 'a3_shadow_twin',
    name: 'Shadow Twin',
    act: 3,
    tier: 'normal',
    hp: [46, 52],
    icon: '👥',
    scale: 1.0,
    desc: 'A shadow that copies your defense. Mirror Strike hits for your current block plus 8.',
    moves: {
      mirror_strike: {
        name: 'Mirror Strike',
        intent: 'attack',
        effects: [{ op: 'damage', amount: { v: 'block', of: 'target', mul: 1, add: 8 }, times: 1 }]
      },
      veil: { name: 'Veil', intent: 'defend', effects: [blk(14)] },
      drain_gaze: { name: 'Drain Gaze', intent: 'attack_debuff', effects: [dmg(9), debuffPlayer('weak', 1)] }
    },
    pattern: { type: 'random', weights: { mirror_strike: 40, veil: 25, drain_gaze: 35 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a3_ash_harpy',
    name: 'Ash Harpy',
    act: 3,
    tier: 'normal',
    hp: [50, 58],
    icon: '🦅',
    scale: 1.0,
    desc: 'A harpy trailing grey ash. Dives to leave you vulnerable, then roosts behind its wings.',
    moves: {
      talon_dive: { name: 'Talon Dive', intent: 'attack_debuff', effects: [dmg(16), debuffPlayer('vulnerable', 1)] },
      wing_buffet: { name: 'Wing Buffet', intent: 'attack', effects: [dmg(8, 2)] },
      screech: { name: 'Ash Screech', intent: 'attack_debuff', effects: [dmg(6), debuffPlayer('weak', 1)] },
      roost: { name: 'Roost', intent: 'defend', effects: [blk(14)] }
    },
    pattern: { type: 'sequence', moves: ['talon_dive', 'wing_buffet', 'screech', 'roost'], loop: true }
  });

  DS.defineEnemy({
    id: 'a3_rift_crawler',
    name: 'Rift Crawler',
    act: 3,
    tier: 'normal',
    hp: [56, 64],
    icon: '🦂',
    scale: 1.0,
    desc: 'A scorpion that crawled out of a tear in the sky. When it dies the rift scorches your deck.',
    triggers: {
      onDeath: [addCard('status_burn', 'discard', 2)]
    },
    moves: {
      claw: { name: 'Rift Claw', intent: 'attack', effects: [dmg(14)] },
      spit: { name: 'Void Spit', intent: 'attack_debuff', effects: [dmg(8), addCard('status_slimed', 'discard', 1)] },
      scuttle: { name: 'Scuttle', intent: 'defend', effects: [blk(12)] }
    },
    pattern: { type: 'random', weights: { claw: 40, spit: 35, scuttle: 25 }, noRepeat: 2 }
  });

  // ======================= ELITES (gimmicks that punish a play style) =======================

  // Punishes attack-spam: every attack you play charges it; it discharges for 8 per charge.
  DS.defineEnemy({
    id: 'a3_storm_titan',
    name: 'Storm Titan',
    act: 3,
    tier: 'elite',
    hp: [200, 216],
    icon: '🌩️',
    scale: 1.8,
    desc: 'A living thunderhead. Every attack you play adds Stormcharge. At 4 charge it discharges for 8 per charge.',
    triggers: {
      onCardPlayed: { when: { cardType: 'attack' }, effects: [buffSelf('a3_storm_charge', 1)] }
    },
    moves: {
      charge_up: { name: 'Gather Storm', intent: 'buff', effects: [buffSelf('a3_storm_charge', 2)] },
      thunder_wave: { name: 'Thunder Wave', intent: 'attack', effects: [dmg(9, 3)] },
      lightning_lash: { name: 'Lightning Lash', intent: 'attack', effects: [dmg(24)] },
      discharge: {
        name: 'Discharge',
        intent: 'attack',
        effects: [
          { op: 'damage', amount: { v: 'status', status: 'a3_storm_charge', of: 'self', mul: 8, add: 0 }, times: 1 },
          unstatus('a3_storm_charge')
        ]
      }
    },
    ai: ({ turn, self, lastMoves }) => {
      const last = lastMoves[lastMoves.length - 1];
      const charge = self.statuses.a3_storm_charge || 0;
      if (charge >= 4) return 'discharge';
      if (turn === 1 || last === 'discharge') return 'charge_up';
      if (last === 'thunder_wave') return 'lightning_lash';
      return 'thunder_wave';
    }
  });

  // Punishes skill-spam: each skill you play makes it stronger (enrage). Calls idols; mends at half health.
  DS.defineEnemy({
    id: 'a3_fallen_seraph',
    name: 'Fallen Seraph',
    act: 3,
    tier: 'elite',
    hp: [220, 240],
    icon: '😇',
    scale: 1.7,
    desc: 'Once radiant, now furious. It gains strength whenever you play a skill, and calls idols to its side.',
    onSpawn: [buffSelf('enrage', 1)],
    moves: {
      judgment: { name: 'Judgment', intent: 'attack_debuff', effects: [dmg(22), debuffPlayer('weak', 1)] },
      wing_sweep: { name: 'Wing Sweep', intent: 'attack', effects: [dmg(10, 3)] },
      sanctify: { name: 'Sanctify', intent: 'special', effects: [summon('a3_sanctum_idol', 1)] },
      fallen_grace: { name: 'Fallen Grace', intent: 'defend', effects: [blk(22), healSelf(12), buffSelf('mark', 1)] }
    },
    ai: ({ turn, self }) => {
      if (!self.statuses.mark && self.hp <= self.maxHp * 0.5) return 'fallen_grace';
      const cycle = ['judgment', 'wing_sweep', 'sanctify', 'wing_sweep', 'judgment', 'wing_sweep'];
      return cycle[(turn - 1) % cycle.length];
    }
  });

  // Summoner: keeps motes around. Every mote that dies feeds it 2 strength.
  DS.defineEnemy({
    id: 'a3_void_herald',
    name: 'Void Herald',
    act: 3,
    tier: 'elite',
    hp: [205, 225],
    icon: '🪐',
    scale: 1.8,
    desc: 'Summons umbral motes whenever it has none. Every mote that dies gives it 2 strength, so clearing them fast matters.',
    triggers: {
      onEnemyDeath: [buffSelf('strength', 2)]
    },
    moves: {
      summon_motes: { name: 'Summon Motes', intent: 'special', effects: [summon('a3_umbral_mote', 2)] },
      void_lance: { name: 'Void Lance', intent: 'attack', effects: [dmg(24)] },
      hollow_gaze: { name: 'Hollow Gaze', intent: 'debuff', effects: [debuffPlayer('vulnerable', 1), addCard('status_void', 'discard', 1)] },
      eclipse_drain: { name: 'Eclipse Drain', intent: 'attack', effects: [dmg(12), healSelf(12)] }
    },
    ai: ({ turn, combat, lastMoves }) => {
      const last = lastMoves[lastMoves.length - 1];
      const motes = combat.livingEnemies().filter((e) => e.id === 'a3_umbral_mote').length;
      if (motes === 0 && last !== 'summon_motes') return 'summon_motes';
      const seq = ['void_lance', 'hollow_gaze', 'eclipse_drain'];
      return seq[(turn - 1) % seq.length];
    }
  });

  // Punishes power-play: every power you play feeds it 2 strength and 6 block.
  DS.defineEnemy({
    id: 'a3_gilded_colossus',
    name: 'Gilded Colossus',
    act: 3,
    tier: 'elite',
    hp: [232, 250],
    icon: '🏺',
    scale: 1.9,
    desc: 'Armored in gold. Every power you play feeds it 2 strength and 6 block.',
    onSpawn: [buffSelf('plated_armor', 8)],
    triggers: {
      onCardPlayed: { when: { cardType: 'power' }, effects: [buffSelf('strength', 2), blk(6)] }
    },
    moves: {
      coin_storm: { name: 'Coin Storm', intent: 'attack', effects: [dmg(7, 4)] },
      gilded_slam: { name: 'Gilded Slam', intent: 'attack', effects: [dmg(26)] },
      plate_up: { name: 'Plate Up', intent: 'defend', effects: [blk(26)] },
      tithe: { name: 'Tithe of Ash', intent: 'debuff', effects: [addCard('status_wound', 'draw', 2)] }
    },
    pattern: { type: 'random', weights: { coin_storm: 35, gilded_slam: 25, plate_up: 15, tithe: 25 }, noRepeat: 2, first: 'coin_storm' }
  });

  // ======================= BOSSES (multi-phase, signature mechanics) =======================

  // Signature: every third card you play jams your draw pile with Dazed, and its
  // shards mend it. At half health it stops rewinding and starts collapsing time.
  DS.defineEnemy({
    id: 'a3_time_eater',
    name: 'The Time Eater',
    act: 3,
    tier: 'boss',
    hp: [440, 470],
    icon: '⏳',
    scale: 2.0,
    desc: 'It devours moments. Every third card you play adds Dazed to your discard. Each shard that breaks mends it. Below half health it collapses time.',
    triggers: {
      onCardPlayed: { every: 3, effects: [addCard('status_dazed', 'discard', 2), buffSelf('strength', 1)] },
      onEnemyDeath: [healSelf(5)]
    },
    moves: {
      sand_strike: { name: 'Sand Strike', intent: 'attack', effects: [dmg(14, 2)] },
      stop_time: { name: 'Stop Time', intent: 'debuff', effects: [debuffPlayer('a3_unravel', 3)] },
      rewind: { name: 'Rewind', intent: 'buff', effects: [healSelf(30)] },
      time_lash: { name: 'Time Lash', intent: 'attack', effects: [dmg(30)] },
      collapse_time: {
        name: 'Collapse Time',
        intent: 'special',
        effects: [buffSelf('mark', 1), buffSelf('strength', 2), summon('a3_chrono_shard', 2)]
      }
    },
    ai: ({ turn, self }) => {
      const enraged = !!self.statuses.mark;
      if (!enraged && self.hp <= self.maxHp * 0.5) return 'collapse_time';
      const phaseOne = ['sand_strike', 'stop_time', 'rewind', 'time_lash'];
      const phaseTwo = ['time_lash', 'sand_strike', 'collapse_time', 'stop_time', 'time_lash'];
      const seq = enraged ? phaseTwo : phaseOne;
      return seq[(turn - 1) % seq.length];
    }
  });

  // Signature: refuses to stay dead. At 35% health it rebirths once with 120 hp,
  // summons motes and gains strength. Every hit it lands jams the deck with Void.
  DS.defineEnemy({
    id: 'a3_awakened_void',
    name: 'The Awakened Void',
    act: 3,
    tier: 'boss',
    hp: [420, 450],
    icon: '🌌',
    scale: 2.0,
    desc: 'A horror that wakes from the dark between stars. Its attacks seed your deck with Void. At 35% it rebirths once, healing deeply and summoning motes.',
    triggers: {
      onDeath: [addCard('status_void', 'discard', 3)]
    },
    moves: {
      void_pulse: { name: 'Void Pulse', intent: 'attack_debuff', effects: [dmg(16), addCard('status_void', 'discard', 1)] },
      eclipse_veil: { name: 'Eclipse Veil', intent: 'debuff', effects: [blk(22), debuffPlayer('a3_dread', 1)] },
      hollow_gale: { name: 'Hollow Gale', intent: 'attack', effects: [dmg(10, 3)] },
      nullify: { name: 'Nullify', intent: 'attack_debuff', effects: [dmg(26), debuffPlayer('weak', 1)] },
      rebirth: {
        name: 'Rebirth',
        intent: 'special',
        effects: [healSelf(120), buffSelf('mark', 1), summon('a3_umbral_mote', 2), buffSelf('strength', 2)]
      }
    },
    ai: ({ turn, self }) => {
      const reborn = !!self.statuses.mark;
      if (!reborn && self.hp <= self.maxHp * 0.35) return 'rebirth';
      const phaseOne = ['void_pulse', 'hollow_gale', 'eclipse_veil', 'void_pulse', 'nullify'];
      const phaseTwo = ['nullify', 'hollow_gale', 'void_pulse', 'eclipse_veil', 'hollow_gale'];
      const seq = reborn ? phaseTwo : phaseOne;
      return seq[(turn - 1) % seq.length];
    }
  });

  // Heart-like final boss. Telegraphed rhythm: buff, then a huge heart beat.
  // Phases at 50% and 20% health change the rotation and add the final throes.
  DS.defineEnemy({
    id: 'a3_dusk_heart',
    name: 'The Duskspire Heart',
    act: 3,
    tier: 'boss',
    hp: [560, 600],
    icon: '💜',
    scale: 2.0,
    desc: 'The beating core of the Summit. It starts armored against debuffs, swells before each heart beat, and every fifth card you play strengthens it.',
    onSpawn: [buffSelf('artifact', 2)],
    triggers: {
      onCardPlayed: { every: 5, effects: [addCard('status_wound', 'discard', 1), buffSelf('strength', 2)] }
    },
    moves: {
      blood_shots: { name: 'Blood Shots', intent: 'attack', effects: [dmg(7, 4)] },
      buff_heart: { name: 'Swell', intent: 'buff', effects: [buffSelf('strength', 3), blk(10)] },
      heart_beat: { name: 'Heart Beat', intent: 'attack', effects: [dmg(36)] },
      debilitate: {
        name: 'Debilitate',
        intent: 'debuff',
        effects: [debuffPlayer('vulnerable', 2), debuffPlayer('weak', 2), addCard('status_dazed', 'discard', 2)]
      },
      final_throes: { name: 'Final Throes', intent: 'attack', effects: [dmg(8, 6)] }
    },
    ai: ({ turn, self }) => {
      const frac = self.hp / self.maxHp;
      let seq;
      if (frac <= 0.2) seq = ['final_throes', 'blood_shots', 'buff_heart', 'heart_beat', 'final_throes'];
      else if (frac <= 0.5) seq = ['blood_shots', 'debilitate', 'buff_heart', 'heart_beat', 'final_throes'];
      else seq = ['blood_shots', 'debilitate', 'buff_heart', 'heart_beat', 'blood_shots'];
      return seq[(turn - 1) % seq.length];
    }
  });

  // ======================= ENCOUNTERS =======================

  const encounters = [
    // ---- easy: 1-2 weak enemies ----
    { id: 'a3_enc_easy_voidlings', tier: 'easy', name: 'Voidling Nest', enemies: ['a3_voidling', 'a3_voidling'] },
    { id: 'a3_enc_easy_wisps', tier: 'easy', name: 'Ember Flicker', enemies: ['a3_ember_wisp', 'a3_ember_wisp'] },
    { id: 'a3_enc_easy_choir', tier: 'easy', name: 'Fallen Choir', enemies: ['a3_fallen_cherub', 'a3_dusk_moth'] },
    { id: 'a3_enc_easy_motes', tier: 'easy', name: 'Static Drift', enemies: ['a3_storm_mote', 'a3_storm_mote'] },
    { id: 'a3_enc_easy_sprite', tier: 'easy', name: 'Glimmer Glade', enemies: ['a3_shard_sprite'] },
    { id: 'a3_enc_easy_moths', tier: 'easy', name: 'Dusk Moths', enemies: ['a3_dusk_moth', 'a3_dusk_moth'] },

    // ---- normal: 1-4 enemies ----
    { id: 'a3_enc_gloam_pack', tier: 'normal', name: 'Gloam Pack', enemies: ['a3_gloam_hound', 'a3_gloam_hound'] },
    { id: 'a3_enc_hound_cherub', tier: 'normal', name: 'Hound and Cherub', enemies: ['a3_gloam_hound', 'a3_fallen_cherub'] },
    { id: 'a3_enc_wisp_swarm', tier: 'normal', name: 'Wisp Swarm', enemies: ['a3_ember_wisp', 'a3_ember_wisp', 'a3_ember_wisp'] },
    { id: 'a3_enc_storm_cloud', tier: 'normal', name: 'Storm Cloud', enemies: ['a3_storm_mote', 'a3_storm_mote', 'a3_storm_mote'] },
    { id: 'a3_enc_bell_chapel', tier: 'normal', name: 'Bell Chapel', enemies: ['a3_bell_wight', 'a3_shard_sprite'] },
    { id: 'a3_enc_sand_vigil', tier: 'normal', name: 'Sand Vigil', enemies: ['a3_sand_sentinel'] },
    { id: 'a3_enc_crystal_vigil', tier: 'normal', name: 'Crystal Vigil', enemies: ['a3_crystal_golem'] },
    { id: 'a3_enc_ruined_oath', tier: 'normal', name: 'The Ruined Oath', enemies: ['a3_ruined_paladin'] },
    { id: 'a3_enc_glass_ritual', tier: 'normal', name: 'Glass and Ritual', enemies: ['a3_glass_wraith', 'a3_dusk_cultist'] },
    { id: 'a3_enc_mirror_twins', tier: 'normal', name: 'Mirror Twins', enemies: ['a3_shadow_twin', 'a3_shadow_twin'] },
    { id: 'a3_enc_harpy_roost', tier: 'normal', name: 'Ash Harpy Roost', enemies: ['a3_ash_harpy', 'a3_dusk_moth', 'a3_dusk_moth'] },
    { id: 'a3_enc_rift_crawlers', tier: 'normal', name: 'Rift Crawlers', enemies: ['a3_rift_crawler', 'a3_rift_crawler'] },
    { id: 'a3_enc_voidling_brood', tier: 'normal', name: 'Voidling Brood', enemies: ['a3_voidling', 'a3_voidling', 'a3_voidling', 'a3_voidling'] },
    { id: 'a3_enc_shard_storm', tier: 'normal', name: 'Shard and Storm', enemies: ['a3_shard_sprite', 'a3_storm_mote', 'a3_storm_mote'] },
    { id: 'a3_enc_paladin_escort', tier: 'normal', name: 'Paladin Escort', enemies: ['a3_ruined_paladin', 'a3_fallen_cherub', 'a3_fallen_cherub'] },

    // ---- elite: some with minions ----
    { id: 'a3_enc_storm_titan', tier: 'elite', name: 'The Living Storm', enemies: ['a3_storm_titan'] },
    { id: 'a3_enc_fallen_seraph', tier: 'elite', name: 'Fallen Seraph', enemies: ['a3_fallen_seraph', 'a3_sanctum_idol'] },
    { id: 'a3_enc_void_herald', tier: 'elite', name: 'The Void Herald', enemies: ['a3_void_herald', 'a3_umbral_mote', 'a3_umbral_mote'] },
    { id: 'a3_enc_gilded_colossus', tier: 'elite', name: 'Gilded Colossus', enemies: ['a3_gilded_colossus', 'a3_sanctum_idol'] },

    // ---- boss ----
    { id: 'a3_enc_time_eater', tier: 'boss', name: 'The Time Eater', enemies: ['a3_time_eater'] },
    { id: 'a3_enc_awakened_void', tier: 'boss', name: 'The Awakened Void', enemies: ['a3_awakened_void'] },
    { id: 'a3_enc_dusk_heart', tier: 'boss', name: 'The Duskspire Heart', enemies: ['a3_dusk_heart'] }
  ];

  for (const enc of encounters) {
    DS.defineEncounter({ id: enc.id, act: 3, tier: enc.tier, name: enc.name, enemies: enc.enemies.slice() });
  }
})();
