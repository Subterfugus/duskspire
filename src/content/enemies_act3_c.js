(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // Act 3, third bestiary wave: the storm-wracked summit. Lightning wardens, frost-bound titans,
  // a mirror knight that copies your guard, gnats and rime sprites, and two bosses: the Corona Eclipse
  // (three phases) and the Rimebound Colossus. Ids are prefixed a3_ and never collide with
  // enemies_act3.js or enemies_act3_b.js.
  // Numbers: act 3 tiers only. Minions 14-22 hp, normal 36-106 hp, elite 168-192 hp, boss 380-410 hp.
  // Single hits stay at or under 24 damage, and every heal is 6 or less.

  // ---------- effect builders (each returns a plain contract effect) ----------
  const dmg = (amount, times) => ({ op: 'damage', amount: amount, times: times || 1 });
  const blk = (amount) => ({ op: 'block', amount: amount, to: 'self' });
  const healSelf = (amount) => ({ op: 'heal', amount: amount, to: 'self' });
  const buffSelf = (status, amount) => ({ op: 'apply', status: status, amount: amount, to: 'self' });
  const debuffPlayer = (status, amount) => ({ op: 'apply', status: status, amount: amount, to: 'player' });
  const addCard = (card, to, amount) => ({ op: 'add_card', card: card, to: to, amount: amount || 1 });
  const summon = (enemy, amount) => ({ op: 'summon', enemy: enemy, amount: amount || 1 });

  // ---------- custom status (a3_ prefix) ----------
  // Numbed Hands: the frost numbs the player's hands. Each skill played costs HP equal to the stacks.
  // Named apart from the existing status card "Frostbite" (status_frostbite, cards_colorless_2.js).
  DS.defineStatus({
    id: 'a3_frostbite',
    name: 'Numbed Hands',
    desc: 'Frost numbs your hands. Each Skill you play costs you {n} HP. Fades by 1 each turn.',
    type: 'debuff',
    icon: '🧤',
    stacks: true,
    decay: 'turn_end',
    expire: null,
    mods: {},
    triggers: {
      onCardPlayed: { when: { cardType: 'skill' }, effects: [{ op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' }] }
    }
  });

  // ======================= MINIONS =======================

  // A gnat with a thunderhead in its belly. It zaps, stings twice, then hovers.
  DS.defineEnemy({
    id: 'a3_spark_gnat',
    name: 'Spark Gnat',
    act: 3,
    tier: 'minion',
    hp: [14, 18],
    icon: '🪰',
    scale: 0.7,
    desc: 'A gnat with a thunderhead in its belly. Zaps for 6, stings twice for 4 each, and hovers for 5 Block.',
    moves: {
      zap: { name: 'Zap', intent: 'attack', effects: [dmg(6)] },
      sting: { name: 'Double Sting', intent: 'attack', effects: [dmg(4, 2)] },
      hover: { name: 'Hover', intent: 'defend', effects: [blk(5)] }
    },
    pattern: { type: 'sequence', moves: ['zap', 'sting', 'hover'], loop: true }
  });

  // A chip of frozen air. Its shattering leaves a Wound behind.
  DS.defineEnemy({
    id: 'a3_rime_sprite',
    name: 'Rime Sprite',
    act: 3,
    tier: 'minion',
    hp: [16, 22],
    icon: '🧊',
    scale: 0.7,
    desc: 'A chip of frozen air. Icicles hit for 7, frost nip hits for 4 and makes you Frail, and when it shatters a Wound goes into your discard pile.',
    triggers: {
      onDeath: [addCard('status_wound', 'discard', 1)]
    },
    moves: {
      icicle: { name: 'Icicle', intent: 'attack', effects: [dmg(7)] },
      frost_nip: { name: 'Frost Nip', intent: 'attack_debuff', effects: [dmg(4), debuffPlayer('frail', 1)] },
      shiver: { name: 'Shiver', intent: 'defend', effects: [blk(7)] }
    },
    pattern: { type: 'random', weights: { icicle: 40, frost_nip: 35, shiver: 25 }, noRepeat: 2 }
  });

  // ======================= NORMAL =======================

  // A lightning warden. Its wiring starts with 3 Thorns, so every hit on it hurts the attacker.
  DS.defineEnemy({
    id: 'a3_storm_warden',
    name: 'Storm Warden',
    act: 3,
    tier: 'normal',
    hp: [60, 68],
    icon: '⚡',
    scale: 1.0,
    desc: 'A warden wired into the summit. It starts with 3 Thorns. Chain Bolt hits twice for 7, Grounding Plate gains 14 Block, and Arc Slam hits for 12 and makes you Vulnerable.',
    onSpawn: [buffSelf('thorns', 3)],
    moves: {
      chain_bolt: { name: 'Chain Bolt', intent: 'attack', effects: [dmg(7, 2)] },
      grounding_plate: { name: 'Grounding Plate', intent: 'defend', effects: [blk(14)] },
      arc_slam: { name: 'Arc Slam', intent: 'attack_debuff', effects: [dmg(12), debuffPlayer('vulnerable', 1)] }
    },
    pattern: { type: 'sequence', moves: ['chain_bolt', 'grounding_plate', 'arc_slam'], loop: true }
  });

  // A stag of hoar-frost. Its breath weakens your attacks.
  DS.defineEnemy({
    id: 'a3_rime_stag',
    name: 'Rime Stag',
    act: 3,
    tier: 'normal',
    hp: [52, 60],
    icon: '🦌',
    scale: 1.1,
    desc: 'A stag with antlers of hoar-frost. Antler Charge hits for 13, Frost Breath hits for 8 and makes you Weak, and Frozen Coat gains 14 Block.',
    moves: {
      antler_charge: { name: 'Antler Charge', intent: 'attack', effects: [dmg(13)] },
      frost_breath: { name: 'Frost Breath', intent: 'attack_debuff', effects: [dmg(8), debuffPlayer('weak', 1)] },
      frozen_coat: { name: 'Frozen Coat', intent: 'defend', effects: [blk(14)] }
    },
    pattern: { type: 'random', weights: { antler_charge: 40, frost_breath: 35, frozen_coat: 25 }, noRepeat: 2, first: 'antler_charge' }
  });

  // A mirror knight. Its Mirror Guard copies half of your Dexterity when you out-guard it by 2 or more.
  DS.defineEnemy({
    id: 'a3_mirror_knight',
    name: 'Mirror Knight',
    act: 3,
    tier: 'normal',
    hp: [70, 78],
    icon: '🪞',
    scale: 1.05,
    desc: 'A knight in polished plate that reflects your guard. Mirror Guard copies half your Dexterity when you have 2 more Dexterity than it. Reflected Blade hits for 11; Parry Strike hits for 8 and gains 6 Block.',
    moves: {
      mirror_guard: {
        name: 'Mirror Guard',
        intent: 'buff',
        effects: [{ op: 'apply', status: 'dexterity', amount: { v: 'status', status: 'dexterity', of: 'target', mul: 0.5, add: 0 }, to: 'self' }]
      },
      reflect_blade: { name: 'Reflected Blade', intent: 'attack', effects: [dmg(11)] },
      parry_strike: { name: 'Parry Strike', intent: 'attack_defend', effects: [dmg(8), blk(6)] }
    },
    ai: ({ turn, self, combat, lastMoves }) => {
      const last = lastMoves[lastMoves.length - 1];
      const yours = combat.player.statuses.dexterity || 0;
      const mine = self.statuses.dexterity || 0;
      if (yours - mine >= 2 && last !== 'mirror_guard') return 'mirror_guard';
      const cycle = ['reflect_blade', 'parry_strike', 'reflect_blade'];
      return cycle[(turn - 1) % cycle.length];
    }
  });

  // An archer of the frozen pass. Its piercing shot makes your guard clumsy.
  DS.defineEnemy({
    id: 'a3_frost_archer',
    name: 'Frost Archer',
    act: 3,
    tier: 'normal',
    hp: [36, 42],
    icon: '🏹',
    scale: 0.9,
    desc: 'A bowman who fires arrows of hard frost. Frost Arrow hits twice for 6, Piercing Frost hits for 7 and makes you Frail, and Brace gains 8 Block.',
    moves: {
      frost_arrow: { name: 'Frost Arrow', intent: 'attack', effects: [dmg(6, 2)] },
      piercing_frost: { name: 'Piercing Frost', intent: 'attack_debuff', effects: [dmg(7), debuffPlayer('frail', 1)] },
      brace: { name: 'Brace', intent: 'defend', effects: [blk(8)] }
    },
    pattern: { type: 'sequence', moves: ['frost_arrow', 'piercing_frost', 'brace'], loop: true }
  });

  // A horned beast that walks inside storms. Heavy charges and a trampling stampede.
  DS.defineEnemy({
    id: 'a3_thunder_ox',
    name: 'Thunder Ox',
    act: 3,
    tier: 'normal',
    hp: [84, 92],
    icon: '🐂',
    scale: 1.3,
    desc: 'A horned beast that walks inside storms. Horn Charge hits for 16, Stampede hits three times for 7, and Thunder Hide gains 18 Block.',
    moves: {
      horn_charge: { name: 'Horn Charge', intent: 'attack', effects: [dmg(16)] },
      stampede: { name: 'Stampede', intent: 'attack', effects: [dmg(7, 3)] },
      thunder_hide: { name: 'Thunder Hide', intent: 'defend', effects: [blk(18)] }
    },
    pattern: { type: 'sequence', moves: ['horn_charge', 'thunder_hide', 'stampede'], loop: true }
  });

  // A lancer riding the summit updrafts. Its dive leaves you open; each gust hardens its guard.
  DS.defineEnemy({
    id: 'a3_sky_lancer',
    name: 'Sky Lancer',
    act: 3,
    tier: 'normal',
    hp: [48, 54],
    icon: '🪁',
    scale: 1.0,
    desc: 'A lancer who rides the summit updrafts. Skewer hits for 12, Dive Bomb hits for 6 and makes you Vulnerable, and Updraft gains 1 Dexterity.',
    moves: {
      skewer: { name: 'Skewer', intent: 'attack', effects: [dmg(12)] },
      dive_bomb: { name: 'Dive Bomb', intent: 'attack_debuff', effects: [dmg(6), debuffPlayer('vulnerable', 1)] },
      updraft: { name: 'Updraft', intent: 'buff', effects: [buffSelf('dexterity', 1)] }
    },
    pattern: { type: 'random', weights: { skewer: 40, dive_bomb: 35, updraft: 25 }, noRepeat: 2 }
  });

  // A monk who meditates in the hail. Its heal is small and only ever mends itself.
  DS.defineEnemy({
    id: 'a3_hail_monk',
    name: 'Hail Monk',
    act: 3,
    tier: 'normal',
    hp: [50, 56],
    icon: '🧘',
    scale: 1.0,
    desc: 'A monk who meditates in the hail. Hail Strike hits for 9, Frost Fist hits for 7 and makes you Frail, and Mend Frost gains 10 Block and heals it for 5.',
    moves: {
      hail_strike: { name: 'Hail Strike', intent: 'attack', effects: [dmg(9)] },
      frost_fist: { name: 'Frost Fist', intent: 'attack_debuff', effects: [dmg(7), debuffPlayer('frail', 1)] },
      mend_frost: { name: 'Mend Frost', intent: 'defend', effects: [blk(10), healSelf(5)] }
    },
    pattern: { type: 'random', weights: { hail_strike: 40, frost_fist: 30, mend_frost: 30 }, noRepeat: 2 }
  });

  // A slow mountain of blue ice. It starts with 8 Plated Armor and buries your deck in Slime.
  DS.defineEnemy({
    id: 'a3_glacier_shell',
    name: 'Glacier Shell',
    act: 3,
    tier: 'normal',
    hp: [96, 106],
    icon: '🏔️',
    scale: 1.3,
    desc: 'A slow mountain of blue ice. It starts with 8 Plated Armor. Shell Slam hits for 18, Hard Freeze gains 20 Block, and Icicle Rain hits twice for 7 and adds a Slimed to your discard pile.',
    onSpawn: [buffSelf('plated_armor', 8)],
    moves: {
      shell_slam: { name: 'Shell Slam', intent: 'attack', effects: [dmg(18)] },
      hard_freeze: { name: 'Hard Freeze', intent: 'defend', effects: [blk(20)] },
      icicle_rain: { name: 'Icicle Rain', intent: 'attack_debuff', effects: [dmg(7, 2), addCard('status_slimed', 'discard', 1)] }
    },
    pattern: { type: 'sequence', moves: ['shell_slam', 'hard_freeze', 'icicle_rain', 'hard_freeze'], loop: true }
  });

  // A serpent of coiled lightning. It grows stronger as it sheds.
  DS.defineEnemy({
    id: 'a3_lightning_serpent',
    name: 'Lightning Serpent',
    act: 3,
    tier: 'normal',
    hp: [58, 64],
    icon: '🐍',
    scale: 1.0,
    desc: 'A serpent of coiled lightning. Coil Strike hits twice for 9, Spark Spit hits for 6 and adds a Burn to your discard pile, and Shed Scales gains 1 Strength.',
    moves: {
      coil_strike: { name: 'Coil Strike', intent: 'attack', effects: [dmg(9, 2)] },
      spark_spit: { name: 'Spark Spit', intent: 'attack_debuff', effects: [dmg(6), addCard('status_burn', 'discard', 1)] },
      shed_scales: { name: 'Shed Scales', intent: 'buff', effects: [buffSelf('strength', 1)] }
    },
    pattern: { type: 'sequence', moves: ['coil_strike', 'spark_spit', 'shed_scales'], loop: true }
  });

  // A wyvern that breathes ice. Its breath makes your guard clumsy.
  DS.defineEnemy({
    id: 'a3_rime_wyvern',
    name: 'Rime Wyvern',
    act: 3,
    tier: 'normal',
    hp: [66, 72],
    icon: '🐉',
    scale: 1.2,
    desc: 'A wyvern that breathes ice. Ice Breath hits for 12 and makes you Frail, Wing Gust hits twice for 7, and Frozen Roost gains 16 Block.',
    moves: {
      ice_breath: { name: 'Ice Breath', intent: 'attack_debuff', effects: [dmg(12), debuffPlayer('frail', 1)] },
      wing_gust: { name: 'Wing Gust', intent: 'attack', effects: [dmg(7, 2)] },
      frozen_roost: { name: 'Frozen Roost', intent: 'defend', effects: [blk(16)] }
    },
    pattern: { type: 'random', weights: { ice_breath: 40, wing_gust: 35, frozen_roost: 25 }, noRepeat: 2, first: 'wing_gust' }
  });

  // ======================= ELITES =======================

  // A titan wrapped in glacier. Its frozen grip stops you drawing on your next turn.
  DS.defineEnemy({
    id: 'a3_frostbound_titan',
    name: 'Frostbound Titan',
    act: 3,
    tier: 'elite',
    hp: [172, 186],
    icon: '🗻',
    scale: 1.9,
    desc: 'A titan wrapped in glacier. It starts with 5 Plated Armor. Glacier Fist hits for 17, Avalanche hits twice for 8 and makes you Frail, Hoarfrost Shell gains 24 Block and 1 Strength, and Frozen Grip hits for 10 and stops you drawing next turn.',
    onSpawn: [buffSelf('plated_armor', 5)],
    moves: {
      glacier_fist: { name: 'Glacier Fist', intent: 'attack', effects: [dmg(17)] },
      avalanche: { name: 'Avalanche', intent: 'attack_debuff', effects: [dmg(8, 2), debuffPlayer('frail', 1)] },
      hoarfrost: { name: 'Hoarfrost Shell', intent: 'defend', effects: [blk(24), buffSelf('strength', 1)] },
      frozen_grip: { name: 'Frozen Grip', intent: 'attack_debuff', effects: [dmg(10), debuffPlayer('no_draw', 1)] }
    },
    pattern: { type: 'sequence', moves: ['glacier_fist', 'avalanche', 'hoarfrost', 'frozen_grip'], loop: true }
  });

  // The marshal of the storm wardens. It starts with Thorns, every third attack that hits it is answered by lightning, and it calls gnats when they thin out.
  DS.defineEnemy({
    id: 'a3_thunder_marshal',
    name: 'Thunder Marshal',
    act: 3,
    tier: 'elite',
    hp: [178, 192],
    icon: '🎖️',
    scale: 1.9,
    desc: 'A marshal of the storm wardens. It starts with 3 Thorns, and every third time it is hit by an attack, lightning lashes back for 8. Chain Lightning hits three times for 8, Arc Hammer hits for 19 and makes you Vulnerable, and Storm Ward gains 20 Block. With fewer than two Spark Gnats it calls two.',
    onSpawn: [buffSelf('thorns', 3)],
    triggers: {
      onAttacked: { every: 3, effects: [{ op: 'damage', amount: 8, to: 'player' }] }
    },
    moves: {
      chain_lightning: { name: 'Chain Lightning', intent: 'attack', effects: [dmg(8, 3)] },
      arc_hammer: { name: 'Arc Hammer', intent: 'attack_debuff', effects: [dmg(19), debuffPlayer('vulnerable', 1)] },
      storm_ward: { name: 'Storm Ward', intent: 'defend', effects: [blk(20)] },
      call_gnats: { name: 'Call the Gnats', intent: 'special', effects: [summon('a3_spark_gnat', 2)] }
    },
    ai: ({ turn, combat, lastMoves }) => {
      const last = lastMoves[lastMoves.length - 1];
      const gnats = combat.livingEnemies().filter((e) => e.id === 'a3_spark_gnat').length;
      if (turn === 1) return 'storm_ward';
      if (gnats < 2 && last !== 'call_gnats') return 'call_gnats';
      const seq = ['chain_lightning', 'arc_hammer', 'storm_ward', 'chain_lightning'];
      return seq[(turn - 2) % seq.length];
    }
  });

  // A roc riding the summit gales. Its feathers harden every turn; it calls gnats when none are left.
  DS.defineEnemy({
    id: 'a3_gale_roc',
    name: 'Gale Roc',
    act: 3,
    tier: 'elite',
    hp: [168, 182],
    icon: '🌪️',
    scale: 1.8,
    desc: 'A roc riding the summit gales. It gains 1 Dexterity at the start of each of its turns. Gale Dive hits for 19, Talon Rake hits three times for 7 and makes you Weak, Wing Wall gains 18 Block, and with no Spark Gnats left it calls two.',
    triggers: {
      onTurnStart: [buffSelf('dexterity', 1)]
    },
    moves: {
      dive: { name: 'Gale Dive', intent: 'attack', effects: [dmg(19)] },
      talon_rake: { name: 'Talon Rake', intent: 'attack_debuff', effects: [dmg(7, 3), debuffPlayer('weak', 1)] },
      wing_wall: { name: 'Wing Wall', intent: 'defend', effects: [blk(18)] },
      call_gnats: { name: 'Gale Call', intent: 'special', effects: [summon('a3_spark_gnat', 2)] }
    },
    ai: ({ turn, combat, lastMoves }) => {
      const last = lastMoves[lastMoves.length - 1];
      const gnats = combat.livingEnemies().filter((e) => e.id === 'a3_spark_gnat').length;
      if (gnats === 0 && last !== 'call_gnats') return 'call_gnats';
      const seq = ['dive', 'talon_rake', 'wing_wall', 'talon_rake'];
      return seq[(turn - 1) % seq.length];
    }
  });

  // ======================= BOSSES =======================

  // Three phases. Above two thirds health it strikes and rings itself in light. Below two thirds it calls
  // two spark gnats (once) and its flares strike three times. Below a third its corona burst and eclipse
  // shroud alternate; the shroud is its only heal and calls a rime sprite each time it is raised.
  DS.defineEnemy({
    id: 'a3_corona_eclipse',
    name: 'The Corona Eclipse',
    act: 3,
    tier: 'boss',
    hp: [380, 400],
    icon: '🌞',
    scale: 2.0,
    desc: 'The sun, swallowed. Every fourth card you play adds Dazed to your discard pile. Penumbra Lash hits for 15 and makes you Weak, and Corona Ring gains 22 Block and 1 Strength. Below two thirds health it calls two Spark Gnats and gains 1 Strength (once), and Eclipse Flare hits three times for 9. Below a third, Corona Burst hits for 24, and Eclipse Shroud gains 24 Block, heals 6, and calls a Rime Sprite.',
    triggers: {
      onCardPlayed: { every: 4, effects: [addCard('status_dazed', 'discard', 1)] },
      onDamaged: {
        when: { hpBelowPct: 66 },
        oncePerCombat: true,
        effects: [summon('a3_spark_gnat', 2), buffSelf('strength', 1)]
      }
    },
    moves: {
      penumbra_lash: { name: 'Penumbra Lash', intent: 'attack_debuff', effects: [dmg(15), debuffPlayer('weak', 1)] },
      corona_ring: { name: 'Corona Ring', intent: 'defend', effects: [blk(22), buffSelf('strength', 1)] },
      eclipse_flare: { name: 'Eclipse Flare', intent: 'attack', effects: [dmg(9, 3)] },
      corona_burst: { name: 'Corona Burst', intent: 'attack', effects: [dmg(24)] },
      eclipse_shroud: { name: 'Eclipse Shroud', intent: 'defend', effects: [blk(24), healSelf(6), summon('a3_rime_sprite', 1)] }
    },
    ai: ({ turn, self }) => {
      const frac = self.hp / self.maxHp;
      if (frac <= 0.33) {
        const late = ['corona_burst', 'eclipse_shroud', 'eclipse_flare', 'corona_burst'];
        return late[(turn - 1) % late.length];
      }
      if (frac <= 0.66) {
        const mid = ['eclipse_flare', 'penumbra_lash', 'corona_ring', 'eclipse_flare'];
        return mid[(turn - 1) % mid.length];
      }
      const early = ['penumbra_lash', 'corona_ring', 'penumbra_lash'];
      return early[(turn - 1) % early.length];
    }
  });

  // A colossus of frozen stone. Its rime clings to your hands; below half health it hurls blizzards.
  DS.defineEnemy({
    id: 'a3_rimebound_colossus',
    name: 'The Rimebound Colossus',
    act: 3,
    tier: 'boss',
    hp: [390, 410],
    icon: '🪨',
    scale: 2.0,
    desc: 'A colossus of frozen stone. Glacier Stomp hits for 20. Rime Wall gives you 2 Numbed Hands: each Skill you play costs you 2 HP, and it fades by 1 each turn. Hoar Call summons two Rime Sprites. Blizzard hits four times for 6, and Avalanche Crush hits for 22 and makes you Frail. Below half health it gains 2 Strength and calls two Rime Sprites.',
    triggers: {
      onDamaged: {
        when: { hpBelowPct: 50 },
        oncePerCombat: true,
        effects: [buffSelf('strength', 2), summon('a3_rime_sprite', 2)]
      }
    },
    moves: {
      glacier_stomp: { name: 'Glacier Stomp', intent: 'attack', effects: [dmg(20)] },
      rime_wall: { name: 'Rime Wall', intent: 'debuff', effects: [debuffPlayer('a3_frostbite', 2)] },
      hoar_call: { name: 'Hoar Call', intent: 'special', effects: [summon('a3_rime_sprite', 2)] },
      blizzard: { name: 'Blizzard', intent: 'attack', effects: [dmg(6, 4)] },
      avalanche_crush: { name: 'Avalanche Crush', intent: 'attack_debuff', effects: [dmg(22), debuffPlayer('frail', 1)] }
    },
    ai: ({ turn, self, combat }) => {
      const enraged = self.hp <= self.maxHp * 0.5;
      const sprites = combat.livingEnemies().filter((e) => e.id === 'a3_rime_sprite').length;
      const seq = enraged
        ? ['blizzard', 'avalanche_crush', 'rime_wall', 'blizzard', 'glacier_stomp']
        : ['glacier_stomp', 'rime_wall', 'hoar_call', 'avalanche_crush'];
      const pick = seq[(turn - 1) % seq.length];
      return pick === 'hoar_call' && sprites >= 2 ? 'glacier_stomp' : pick;
    }
  });

  // ======================= ENCOUNTERS =======================

  const encounters = [
    // ---- easy: 1-2 weak enemies ----
    { id: 'a3_enc_c_easy_gnats', tier: 'easy', name: 'Spark Nest', enemies: ['a3_spark_gnat', 'a3_spark_gnat'] },
    { id: 'a3_enc_c_easy_frost_post', tier: 'easy', name: 'Frost Post', enemies: ['a3_frost_archer', 'a3_rime_sprite'] },
    { id: 'a3_enc_c_easy_lancer', tier: 'easy', name: 'Lone Lancer', enemies: ['a3_sky_lancer'] },
    { id: 'a3_enc_c_easy_sprites', tier: 'easy', name: 'Sprite Drift', enemies: ['a3_rime_sprite', 'a3_rime_sprite'] },
    { id: 'a3_enc_c_easy_archer', tier: 'easy', name: 'Lone Archer', enemies: ['a3_frost_archer'] },
    { id: 'a3_enc_c_easy_gnat_sprite', tier: 'easy', name: 'Gnat and Sprite', enemies: ['a3_spark_gnat', 'a3_rime_sprite'] },

    // ---- normal: 1-4 enemies, at most one healer each ----
    { id: 'a3_enc_c_storm_watch', tier: 'normal', name: 'Storm Watch', enemies: ['a3_storm_warden'] },
    { id: 'a3_enc_c_stag_archer', tier: 'normal', name: 'Stag and Archer', enemies: ['a3_rime_stag', 'a3_frost_archer'] },
    { id: 'a3_enc_c_mirror_frost', tier: 'normal', name: 'Mirror and Frost', enemies: ['a3_mirror_knight', 'a3_rime_sprite'] },
    { id: 'a3_enc_c_ox_charge', tier: 'normal', name: 'Ox Charge', enemies: ['a3_thunder_ox'] },
    { id: 'a3_enc_c_wyvern_roost', tier: 'normal', name: 'Wyvern Roost', enemies: ['a3_rime_wyvern', 'a3_sky_lancer'] },
    { id: 'a3_enc_c_hail_chapel', tier: 'normal', name: 'Hail Chapel', enemies: ['a3_hail_monk', 'a3_frost_archer'] },
    { id: 'a3_enc_c_glacier_vigil', tier: 'normal', name: 'Glacier Vigil', enemies: ['a3_glacier_shell'] },
    { id: 'a3_enc_c_serpent_coil', tier: 'normal', name: 'Serpent Coil', enemies: ['a3_lightning_serpent', 'a3_spark_gnat', 'a3_spark_gnat'] },
    { id: 'a3_enc_c_storm_pair', tier: 'normal', name: 'Storm Pair', enemies: ['a3_storm_warden', 'a3_spark_gnat'] },
    { id: 'a3_enc_c_stag_hail', tier: 'normal', name: 'Stag and Hail', enemies: ['a3_rime_stag', 'a3_hail_monk'] },
    { id: 'a3_enc_c_ox_hail', tier: 'normal', name: 'Ox and Hail', enemies: ['a3_thunder_ox', 'a3_hail_monk'] },
    { id: 'a3_enc_c_lancer_squad', tier: 'normal', name: 'Lancer Squad', enemies: ['a3_sky_lancer', 'a3_rime_sprite', 'a3_rime_sprite', 'a3_spark_gnat'] },
    { id: 'a3_enc_c_hound_sprite', tier: 'normal', name: 'Hound and Sprite', enemies: ['a3_gloam_hound', 'a3_rime_sprite'] },

    // ---- elite: some with minions, none with a second healer ----
    { id: 'a3_enc_c_frostbound_titan', tier: 'elite', name: 'The Frostbound Titan', enemies: ['a3_frostbound_titan'] },
    { id: 'a3_enc_c_thunder_court', tier: 'elite', name: 'Thunder Court', enemies: ['a3_thunder_marshal', 'a3_spark_gnat', 'a3_spark_gnat'] },
    { id: 'a3_enc_c_roc_above', tier: 'elite', name: 'Roc Above', enemies: ['a3_gale_roc', 'a3_spark_gnat'] },
    { id: 'a3_enc_c_frost_guard', tier: 'elite', name: 'Frost Guard', enemies: ['a3_frostbound_titan', 'a3_frost_archer'] },

    // ---- boss ----
    { id: 'a3_enc_c_corona_eclipse', tier: 'boss', name: 'The Corona Eclipse', enemies: ['a3_corona_eclipse'] },
    { id: 'a3_enc_c_rimebound', tier: 'boss', name: 'The Rimebound Colossus', enemies: ['a3_rimebound_colossus'] }
  ];

  for (const enc of encounters) {
    DS.defineEncounter({ id: enc.id, act: 3, tier: enc.tier, name: enc.name, enemies: enc.enemies.slice() });
  }
})();
