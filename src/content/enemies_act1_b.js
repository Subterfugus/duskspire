// Act 1 bestiary, wave two: the Ashen Catacombs' grave-robbers, ember sprites, bone hounds,
// a mimic chest, fungus shamans and a cursed bell. Ids are prefixed a1_ (wave one: enemies_act1.js).
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
  // The move this enemy picked last turn (or null).
  const lastMove = (ctx) => (ctx.lastMoves && ctx.lastMoves.length ? ctx.lastMoves[ctx.lastMoves.length - 1] : null);
  // Weighted random pick that avoids repeating the previous move.
  function weighted(ctx, table) {
    const rng = ctx.rng || DS.rng;
    const last = lastMove(ctx);
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
  // Steal up to n gold from the player. Whatever the thief takes is kept as Pilfered Gold on the
  // thief and returned to the player when that unit dies.
  function stealGold(n) {
    return {
      op: 'if',
      cond: { left: { v: 'gold' }, cmp: '>=', right: n },
      then: [
        { op: 'gold', amount: -n },
        { op: 'apply', status: 'a1_pilfered', amount: n, to: 'self' }
      ],
      else: [
        { op: 'apply', status: 'a1_pilfered', amount: { v: 'gold' }, to: 'self' },
        { op: 'gold', amount: { v: 'gold', mul: -1 } }
      ]
    };
  }

  // ---- custom statuses ------------------------------------------------------
  // Pilfered Gold: coins a thief carries off. Killing the thief gives them back.
  DS.defineStatus({
    id: 'a1_pilfered', name: 'Pilfered Gold', type: 'buff', icon: '💰', stacks: true, decay: null,
    desc: 'Carries {n} gold stolen from you. When this unit dies, you recover all of it.',
    triggers: {
      onDeath: [{ op: 'gold', amount: { v: 'stacks' } }]
    }
  });

  // Crew called: a marker that the Plunder Chief has already summoned its crew this fight (stacks: false, never expires).
  DS.defineStatus({
    id: 'a1_crew_called', name: 'Crew Called', type: 'buff', icon: '🏴', stacks: false, decay: null,
    desc: 'The crew has already been called to this fight.'
  });

  // Disguised: a mimic takes half damage until first struck. The first blow springs its lid open.
  DS.defineStatus({
    id: 'a1_disguised', name: 'Disguised', type: 'buff', icon: '🎁', stacks: false, decay: null,
    desc: 'Takes 50% less attack damage until first struck. Then its lid springs open and it gains 2 Strength.',
    mods: { attackTakenMul: 0.5 },
    triggers: {
      onAttacked: [
        { op: 'remove_status', status: 'a1_disguised', to: 'self' },
        { op: 'apply', status: 'strength', amount: 2, to: 'self' }
      ]
    }
  });

  // Mirror Hex: a bulwark's glare laid on you. The first time each turn you gain Block, every enemy
  // gains Strength. Lasts until the end of your turn.
  DS.defineStatus({
    id: 'a1_mirror_hex', name: 'Mirror Hex', type: 'debuff', icon: '🪞', stacks: true, decay: null, expire: 'turn_end',
    desc: 'The first time each turn you gain Block, all enemies gain {n} Strength. Ends at the end of your turn.',
    triggers: {
      onBlockGained: {
        oncePerTurn: true,
        effects: [{ op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'all_enemies' }]
      }
    }
  });

  // ==========================================================================
  // NORMAL enemies
  // ==========================================================================

  DS.defineEnemy({
    id: 'a1_grave_robber', name: 'Grave Robber', act: 1, tier: 'normal', hp: [24, 28], icon: '🔦', scale: 0.95,
    desc: 'Pilfers gold on every grab. Whatever it steals goes back to you when it dies.',
    moves: {
      pilfer: { name: 'Pilfer Purse', intent: 'attack_debuff', effects: [{ op: 'damage', amount: 5 }, stealGold(8)] },
      pry: { name: 'Crowbar Pry', intent: 'attack', effects: [{ op: 'damage', amount: 8 }] },
      slink: { name: 'Slink Behind Stone', intent: 'defend', effects: [{ op: 'block', amount: 7, to: 'self' }] }
    },
    pattern: { type: 'random', weights: { pilfer: 40, pry: 35, slink: 25 }, noRepeat: 2, first: 'pilfer' }
  });

  DS.defineEnemy({
    id: 'a1_ember_sprite', name: 'Ember Sprite', act: 1, tier: 'normal', hp: [15, 18], icon: '🔥', scale: 0.7,
    desc: 'Every fifth card you play makes it flare up, scorching you for 4.',
    // Punishes long turns: fires on every 5th card played in the fight.
    triggers: {
      onCardPlayed: { every: 5, effects: [{ op: 'damage', amount: 4, to: 'player' }] }
    },
    moves: {
      flicker: { name: 'Flicker', intent: 'attack', effects: [{ op: 'damage', amount: 3, times: 2 }] },
      kindle: { name: 'Kindle', intent: 'buff', effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] },
      scorch: { name: 'Scorch', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 4 },
        { op: 'apply', status: 'burn', amount: 2, to: 'target' }
      ] }
    },
    pattern: { type: 'random', weights: { flicker: 40, kindle: 20, scorch: 40 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a1_gravehound', name: 'Gravehound', act: 1, tier: 'normal', hp: [26, 30], icon: '🐺', scale: 0.95,
    desc: 'Hunts the wounded. Once you are below half health it goes straight for the throat.',
    moves: {
      gnash: { name: 'Gnash', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
      drag: { name: 'Drag Down', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 4 },
        { op: 'apply', status: 'weak', amount: 1, to: 'target' }
      ] },
      gnaw_bone: { name: 'Gnaw Bone', intent: 'buff', effects: [{ op: 'heal', amount: 6, to: 'self' }] },
      maul: { name: 'Maul the Weak', intent: 'attack', effects: [{ op: 'damage', amount: 11 }] }
    },
    ai: (ctx) => {
      const p = ctx.combat.player;
      if (p.hp < p.maxHp * 0.5 && lastMove(ctx) !== 'maul') return 'maul';
      return weighted(ctx, { gnash: 50, drag: 30, gnaw_bone: 20 });
    }
  });

  DS.defineEnemy({
    id: 'a1_fungus_shaman', name: 'Fungus Shaman', act: 1, tier: 'normal', hp: [34, 38], icon: '🪄', scale: 1,
    desc: 'Mends every wounded ally in the fight. Its dust clogs your deck with Dazed cards.',
    moves: {
      spore_lash: { name: 'Spore Lash', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 12 },
        { op: 'apply', status: 'weak', amount: 1, to: 'target' }
      ] },
      mend: { name: 'Colony Mending', intent: 'buff', effects: [{
        // Heals every wounded living enemy (the shaman included) for 6.
        op: 'custom',
        fn: async (c) => {
          const living = c.combat.livingEnemies();
          for (let i = 0; i < living.length; i++) {
            if (living[i].hp < living[i].maxHp) await c.combat.heal(living[i], 6, c.source);
          }
        }
      }] },
      hallucinate: { name: 'Hallucinogenic Dust', intent: 'debuff', effects: [
        { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 2 }
      ] }
    },
    ai: (ctx) => {
      const hurt = ctx.combat.livingEnemies().some((e) => e.hp < e.maxHp);
      if (hurt && lastMove(ctx) !== 'mend') return 'mend';
      return weighted(ctx, { spore_lash: 70, hallucinate: 30 });
    }
  });

  DS.defineEnemy({
    id: 'a1_gilded_mimic', name: 'Gilded Mimic', act: 1, tier: 'normal', hp: [30, 34], icon: '🧰', scale: 1,
    desc: 'Plays at being a treasure chest until you strike it. Its jaws gobble coins from your purse.',
    onSpawn: [{ op: 'apply', status: 'a1_disguised', amount: 1, to: 'self' }],
    moves: {
      feign: { name: 'Feign Treasure', intent: 'defend', effects: [{ op: 'block', amount: 8, to: 'self' }] },
      snap: { name: 'Snapping Lid', intent: 'attack', effects: [{ op: 'damage', amount: 11 }] },
      swallow: { name: 'Swallow Coins', intent: 'attack_debuff', effects: [{ op: 'damage', amount: 6 }, stealGold(8)] }
    },
    pattern: { type: 'random', weights: { snap: 40, swallow: 35, feign: 25 }, noRepeat: 2, first: 'feign' }
  });

  DS.defineEnemy({
    id: 'a1_tomb_scribe', name: 'Tomb Scribe', act: 1, tier: 'normal', hp: [26, 30], icon: '📜', scale: 0.95,
    desc: 'Writes curses into your deck while it fights.',
    moves: {
      inscribe: { name: 'Inscribe Doubt', intent: 'debuff', effects: [
        { op: 'add_card', card: 'curse_doubt', to: 'discard', amount: 1 }
      ] },
      quill: { name: 'Quill Stab', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
      ink_wash: { name: 'Ink Wash', intent: 'attack_defend', effects: [
        { op: 'damage', amount: 4 },
        { op: 'block', amount: 5, to: 'self' }
      ] }
    },
    pattern: { type: 'random', weights: { inscribe: 35, quill: 40, ink_wash: 25 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a1_grave_brute', name: 'Grave Brute', act: 1, tier: 'normal', hp: [40, 44], icon: '🪦', scale: 1.05,
    desc: 'Heavy and slow, until it is bloodied. Below half health it flies into a fury (+3 Strength).',
    // Enrage at low HP: once per fight, the first hit that drops it below half health fuels it.
    triggers: {
      onDamaged: {
        when: { hpBelowPct: 50 },
        oncePerCombat: true,
        effects: [{ op: 'apply', status: 'strength', amount: 3, to: 'self' }]
      }
    },
    moves: {
      shovel: { name: 'Shovel Swing', intent: 'attack', effects: [{ op: 'damage', amount: 9 }] },
      grave_dirt: { name: 'Grave Dirt', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 5 },
        { op: 'apply', status: 'weak', amount: 1, to: 'target' }
      ] },
      dig_in: { name: 'Dig In', intent: 'defend', effects: [{ op: 'block', amount: 10, to: 'self' }] }
    },
    pattern: { type: 'random', weights: { shovel: 40, grave_dirt: 35, dig_in: 25 }, noRepeat: 2 }
  });

  DS.defineEnemy({
    id: 'a1_echo_wraith', name: 'Echo Wraith', act: 1, tier: 'normal', hp: [24, 28], icon: '🫥', scale: 0.9,
    desc: 'Mirrors your might. Whenever its Strength falls behind yours, it takes on yours and strikes with it.',
    moves: {
      echo: { name: 'Echo Your Might', intent: 'buff', effects: [{
        op: 'apply', status: 'strength',
        amount: { v: 'status', status: 'strength', of: 'target', add: 1 }, to: 'self'
      }] },
      strike: { name: 'Echoed Strike', intent: 'attack', effects: [{
        op: 'damage', amount: 8
      }] },
      hush: { name: 'Hush', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 5 },
        { op: 'apply', status: 'weak', amount: 1, to: 'target' }
      ] }
    },
    ai: (ctx) => {
      const mine = ctx.self.statuses.strength || 0;
      const yours = ctx.combat.player.statuses.strength || 0;
      if (mine <= yours) return 'echo';
      return cycle(['strike', 'hush'], ctx.turn);
    }
  });

  DS.defineEnemy({
    id: 'a1_bulwark_wisp', name: 'Bulwark Wisp', act: 1, tier: 'normal', hp: [24, 28], icon: '🌀', scale: 0.9,
    desc: 'Feeds on your defence. Its glare hexes you, so the first Block you raise each turn strengthens every foe.',
    moves: {
      glare: { name: 'Warding Glare', intent: 'debuff', effects: [
        { op: 'apply', status: 'a1_mirror_hex', amount: 1, to: 'player' }
      ] },
      bolt: { name: 'Flicker Bolt', intent: 'attack', effects: [{ op: 'damage', amount: 8 }] },
      shimmer: { name: 'Shimmer', intent: 'defend', effects: [{ op: 'block', amount: 8, to: 'self' }] }
    },
    pattern: { type: 'sequence', moves: ['glare', 'bolt', 'shimmer'], loop: true }
  });

  DS.defineEnemy({
    id: 'a1_bell_acolyte', name: 'Bell Acolyte', act: 1, tier: 'normal', hp: [28, 32], icon: '🔔', scale: 0.95,
    desc: 'Rings its hand bell every third turn, and a Wound is rung into your discard pile.',
    // Timer: every third of its turns the bell tolls and sends a Wound into your discard.
    triggers: {
      onTurnEnd: { every: 3, effects: [{ op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }] }
    },
    moves: {
      ring: { name: 'Hand Bell', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 3 },
        { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 }
      ] },
      pull_rope: { name: 'Pull the Rope', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
      toll: { name: 'Muffled Toll', intent: 'defend', effects: [{ op: 'block', amount: 6, to: 'self' }] }
    },
    pattern: { type: 'random', weights: { ring: 35, pull_rope: 40, toll: 25 }, noRepeat: 2 }
  });

  // ==========================================================================
  // MINION enemies (summoned or accompanying)
  // ==========================================================================

  DS.defineEnemy({
    id: 'a1_mycelium_guard', name: 'Mycelium Guard', act: 1, tier: 'minion', hp: [8, 10], icon: '🪵', scale: 0.8,
    desc: 'Shield-bearer. Its cover shields every ally from half damage until that ally next acts.',
    moves: {
      cover: { name: 'Cover the Caster', intent: 'buff', effects: [{
        // Shields every other living enemy (Guarded: half attack damage until its next turn).
        op: 'custom',
        fn: async (c) => {
          const living = c.combat.livingEnemies();
          for (let i = 0; i < living.length; i++) {
            if (living[i] !== c.source) await c.combat.applyStatus(living[i], 'a1_guarded', 1, c.source);
          }
        }
      }] },
      bash: { name: 'Mushroom Bash', intent: 'attack', effects: [{ op: 'damage', amount: 6 }] },
      brace: { name: 'Brace', intent: 'defend', effects: [{ op: 'block', amount: 6, to: 'self' }] }
    },
    // Covers on its first turn and every fourth turn after; otherwise it bashes and braces.
    ai: (ctx) => (ctx.turn % 4 === 1 ? 'cover' : ctx.turn % 2 === 0 ? 'bash' : 'brace')
  });

  DS.defineEnemy({
    id: 'a1_ember_spark', name: 'Ember Spark', act: 1, tier: 'minion', hp: [7, 9], icon: '✨', scale: 0.7,
    desc: 'Bursts into cinders when slain, leaving you burning.',
    triggers: {
      onDeath: [{ op: 'apply', status: 'burn', amount: 2, to: 'player' }]
    },
    moves: {
      flick: { name: 'Flick', intent: 'attack', effects: [{ op: 'damage', amount: 4 }] },
      flare: { name: 'Flare', intent: 'attack', effects: [{ op: 'damage', amount: 3, times: 2 }] },
      flutter: { name: 'Flutter', intent: 'defend', effects: [{ op: 'block', amount: 4, to: 'self' }] }
    },
    pattern: { type: 'random', weights: { flick: 40, flare: 30, flutter: 30 }, noRepeat: 2 }
  });

  // ==========================================================================
  // ELITE enemies
  // ==========================================================================

  DS.defineEnemy({
    id: 'a1_plunder_chief', name: 'Plunder Chief', act: 1, tier: 'elite', hp: [66, 74], icon: '🕵️', scale: 1.4,
    desc: 'Lives off other people\'s coin. Every raid steals gold, and it calls in its crew once, when short-handed. The gold comes back only when it dies.',
    moves: {
      plunder: { name: 'Plunder the Purse', intent: 'attack_debuff', effects: [{ op: 'damage', amount: 6 }, stealGold(15)] },
      crowbar: { name: 'Crowbar Crack', intent: 'attack', effects: [{ op: 'damage', amount: 12 }] },
      call_crew: { name: 'Call the Crew', intent: 'special', effects: [
        { op: 'summon', enemy: 'a1_grave_robber', amount: 1 },
        { op: 'apply', status: 'a1_crew_called', amount: 1, to: 'self' }
      ] },
      hoard: { name: 'Hoard Behind Shield', intent: 'defend', effects: [{ op: 'block', amount: 12, to: 'self' }] }
    },
    ai: (ctx) => {
      const crew = livingOf(ctx, 'a1_grave_robber');
      if (ctx.turn > 1 && crew === 0 && !ctx.self.statuses.a1_crew_called && lastMove(ctx) !== 'call_crew') return 'call_crew';
      return cycle(['plunder', 'crowbar', 'hoard', 'crowbar'], ctx.turn);
    }
  });

  DS.defineEnemy({
    id: 'a1_cursed_bell', name: 'The Cursed Bell', act: 1, tier: 'elite', hp: [70, 78], icon: '🔔', scale: 1.5,
    desc: 'A bronze bell hung with chains. Every third turn it tolls, and a Shame curse is rung into your discard pile. Below half health it cracks and rings harder (+3 Strength).',
    triggers: {
      // Timer: every third enemy turn, a curse goes into your discard pile.
      onTurnEnd: { every: 3, effects: [{ op: 'add_card', card: 'curse_shame', to: 'discard', amount: 1 }] },
      onDamaged: {
        when: { hpBelowPct: 50 },
        oncePerCombat: true,
        effects: [{ op: 'apply', status: 'strength', amount: 3, to: 'self' }]
      }
    },
    moves: {
      dread_peal: { name: 'Dread Peal', intent: 'attack', effects: [{ op: 'damage', amount: 12 }] },
      iron_toll: { name: 'Iron Toll', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 6 },
        { op: 'apply', status: 'weak', amount: 1, to: 'target' }
      ] },
      resonant_wall: { name: 'Resonant Wall', intent: 'defend', effects: [{ op: 'block', amount: 12, to: 'self' }] },
      hymn: { name: 'Hymn of Hollow Iron', intent: 'buff', effects: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }] }
    },
    pattern: { type: 'sequence', moves: ['dread_peal', 'iron_toll', 'resonant_wall', 'hymn'], loop: true }
  });

  DS.defineEnemy({
    id: 'a1_mirrorwight', name: 'Mirrorwight', act: 1, tier: 'elite', hp: [80, 88], icon: '🪞', scale: 1.3,
    desc: 'Copies your Strength whenever it falls behind. Every fourth card you play cracks its mirror, and a shard of Dazed lodges in your discard pile.',
    // Punishes long turns: every 4th card played gives you a Dazed shard.
    triggers: {
      onCardPlayed: { every: 4, effects: [{ op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 }] }
    },
    moves: {
      reflect: { name: 'Reflect Might', intent: 'buff', effects: [{
        op: 'apply', status: 'strength',
        amount: { v: 'status', status: 'strength', of: 'target' }, to: 'self'
      }] },
      shard_strike: { name: 'Shard Strike', intent: 'attack', effects: [{
        op: 'damage', amount: 7
      }] },
      mirror_wall: { name: 'Mirror Wall', intent: 'defend', effects: [{ op: 'block', amount: 16, to: 'self' }] },
      split_image: { name: 'Split Image', intent: 'attack', effects: [{ op: 'damage', amount: 7, times: 2 }] }
    },
    ai: (ctx) => {
      const mine = ctx.self.statuses.strength || 0;
      const yours = ctx.combat.player.statuses.strength || 0;
      if (mine < yours) return 'reflect';
      return cycle(['shard_strike', 'split_image', 'mirror_wall'], ctx.turn);
    }
  });

  // ==========================================================================
  // BOSS enemies
  // ==========================================================================

  DS.defineEnemy({
    id: 'a1_hoard_mimic', name: 'The Gilded Maw', act: 1, tier: 'boss', hp: [175, 185], icon: '👹', scale: 2,
    desc: 'The biggest chest in the Catacombs, and the hungriest. It gulps coins from your purse and keeps them: kill it and every coin it swallowed spills back out. Below half health its lid tears loose and it swings in fury (+2 Strength).',
    onSpawn: [{ op: 'apply', status: 'a1_disguised', amount: 1, to: 'self' }],
    triggers: {
      onDamaged: {
        when: { hpBelowPct: 50 },
        oncePerCombat: true,
        effects: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }]
      }
    },
    moves: {
      lid_guard: { name: 'Lid Guard', intent: 'defend', effects: [{ op: 'block', amount: 18, to: 'self' }] },
      snap_lid: { name: 'Snap Lid', intent: 'attack', effects: [{ op: 'damage', amount: 12 }] },
      gulp_gold: { name: 'Gulp the Hoard', intent: 'attack_debuff', effects: [{ op: 'damage', amount: 6 }, stealGold(20)] },
      coin_storm: { name: 'Coin Storm', intent: 'attack', effects: [{ op: 'damage', amount: 5, times: 3 }] }
    },
    ai: (ctx) => {
      if (ctx.turn === 1) return 'lid_guard';
      if (frac(ctx) <= 0.5) return cycle(['coin_storm', 'gulp_gold', 'snap_lid', 'gulp_gold'], ctx.turn);
      return cycle(['gulp_gold', 'snap_lid', 'lid_guard', 'coin_storm'], ctx.turn);
    }
  });

  DS.defineEnemy({
    id: 'a1_sporemother', name: 'The Sporemother', act: 1, tier: 'boss', hp: [104, 114], icon: '🌸', scale: 2,
    desc: 'A mycelial queen that hides behind her guards. While any Mycelium Guard lives she braces behind a bloom shield, and the guards cover her. When they fall she calls more, and her colony mends her wounds.',
    moves: {
      bloom_shield: { name: 'Bloom Shield', intent: 'defend', effects: [
        { op: 'block', amount: 12, to: 'self' },
        { op: 'apply', status: 'a1_guarded', amount: 1, to: 'self' }
      ] },
      spore_rain: { name: 'Spore Rain', intent: 'attack_debuff', effects: [
        { op: 'damage', amount: 7, times: 2 },
        { op: 'apply', status: 'a1_spores', amount: 2, to: 'target' }
      ] },
      root_lash: { name: 'Root Lash', intent: 'attack', effects: [{ op: 'damage', amount: 16 }] },
      mother_mend: { name: "Mother's Mend", intent: 'buff', effects: [{ op: 'heal', amount: 10, to: 'self' }] },
      call_guards: { name: 'Call the Guards', intent: 'special', effects: [{ op: 'summon', enemy: 'a1_mycelium_guard', amount: 2 }] }
    },
    ai: (ctx) => {
      // While guards live she hides behind her shield; once they are gone she calls new ones every third turn.
      const guards = livingOf(ctx, 'a1_mycelium_guard');
      if (guards > 0) return cycle(['spore_rain', 'root_lash', 'bloom_shield', 'spore_rain'], ctx.turn);
      if (ctx.turn % 3 === 0) return 'call_guards';
      return cycle(['root_lash', 'mother_mend', 'spore_rain'], ctx.turn);
    }
  });

  // ==========================================================================
  // ENCOUNTERS (act 1, wave two)
  // ==========================================================================

  // ---- easy: one or two weak foes ----
  DS.defineEncounter({ id: 'a1_enc_lone_robber', act: 1, tier: 'easy', name: 'Lone Robber',
    enemies: ['a1_grave_robber'] });
  DS.defineEncounter({ id: 'a1_enc_ember_sprites', act: 1, tier: 'easy', name: 'Ember Sprites',
    enemies: ['a1_ember_sprite', 'a1_ember_sprite'] });
  DS.defineEncounter({ id: 'a1_enc_lone_gravehound', act: 1, tier: 'easy', name: 'Gravehound',
    enemies: ['a1_gravehound'] });
  DS.defineEncounter({ id: 'a1_enc_spark_sprite', act: 1, tier: 'easy', name: 'Sprite and Spark',
    enemies: ['a1_ember_sprite', 'a1_ember_spark'] });

  // ---- normal: 1 to 3 foes, balanced threat ----
  DS.defineEncounter({ id: 'a1_enc_robber_scribe', act: 1, tier: 'normal', name: 'Robber and Scribe',
    enemies: ['a1_grave_robber', 'a1_tomb_scribe'] });
  DS.defineEncounter({ id: 'a1_enc_fungal_court', act: 1, tier: 'normal', name: 'Fungal Court',
    enemies: ['a1_fungus_shaman', 'a1_mycelium_guard'] });
  DS.defineEncounter({ id: 'a1_enc_gilded_chest', act: 1, tier: 'normal', name: 'Gilded Chest',
    enemies: ['a1_gilded_mimic'] });
  DS.defineEncounter({ id: 'a1_enc_grave_brute', act: 1, tier: 'normal', name: 'Grave Brute',
    enemies: ['a1_grave_brute'] });
  DS.defineEncounter({ id: 'a1_enc_mirror_shard', act: 1, tier: 'normal', name: 'Mirror Shard',
    enemies: ['a1_echo_wraith', 'a1_ember_sprite'] });
  DS.defineEncounter({ id: 'a1_enc_bulwark_glare', act: 1, tier: 'normal', name: 'Bulwark Glare',
    enemies: ['a1_bulwark_wisp', 'a1_echo_wraith'] });
  DS.defineEncounter({ id: 'a1_enc_bell_sparks', act: 1, tier: 'normal', name: 'Hand Bell',
    enemies: ['a1_bell_acolyte', 'a1_ember_spark', 'a1_ember_spark'] });
  DS.defineEncounter({ id: 'a1_enc_gravehound_pack', act: 1, tier: 'normal', name: 'Gravehound Pack',
    enemies: ['a1_gravehound', 'a1_gravehound'] });
  DS.defineEncounter({ id: 'a1_enc_mimic_thief', act: 1, tier: 'normal', name: 'Mimic and Thief',
    enemies: ['a1_gilded_mimic', 'a1_grave_robber'] });
  DS.defineEncounter({ id: 'a1_enc_scribe_wisp', act: 1, tier: 'normal', name: 'Scribe and Wisp',
    enemies: ['a1_tomb_scribe', 'a1_bulwark_wisp'] });
  DS.defineEncounter({ id: 'a1_enc_spore_ember', act: 1, tier: 'normal', name: 'Spore and Ember',
    enemies: ['a1_fungus_shaman', 'a1_ember_sprite'] });
  DS.defineEncounter({ id: 'a1_enc_brute_spark', act: 1, tier: 'normal', name: 'Brute and Spark',
    enemies: ['a1_grave_brute', 'a1_ember_spark'] });

  // ---- elite: a signature foe with support ----
  DS.defineEncounter({ id: 'a1_enc_plunder_crew', act: 1, tier: 'elite', name: 'Plunder Crew',
    enemies: ['a1_plunder_chief', 'a1_grave_robber'] });
  DS.defineEncounter({ id: 'a1_enc_cursed_bell', act: 1, tier: 'elite', name: 'The Cursed Bell',
    enemies: ['a1_cursed_bell', 'a1_bell_acolyte'] });
  DS.defineEncounter({ id: 'a1_enc_mirrorwight', act: 1, tier: 'elite', name: 'Mirrorwight',
    enemies: ['a1_mirrorwight', 'a1_echo_wraith'] });
  DS.defineEncounter({ id: 'a1_enc_vault_keepers', act: 1, tier: 'elite', name: 'Vault Keepers',
    enemies: ['a1_grave_brute', 'a1_gilded_mimic', 'a1_grave_robber'] });

  // ---- boss: one signature foe each (the Sporemother's guards act after her, so they can cover her) ----
  DS.defineEncounter({ id: 'a1_enc_gilded_maw', act: 1, tier: 'boss', name: 'The Gilded Maw',
    enemies: ['a1_hoard_mimic'] });
  DS.defineEncounter({ id: 'a1_enc_sporemother', act: 1, tier: 'boss', name: 'The Sporemother',
    enemies: ['a1_sporemother', 'a1_mycelium_guard', 'a1_mycelium_guard'] });
})();
