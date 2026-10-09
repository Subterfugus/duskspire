(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // BERSERKER EXPANSION (v3): "Trophies". Ulfar keeps score on the battlefield. Every enemy that
  // dies is a trophy: the counter bz_trophy (on the player) feeds Trophy cards, and trophy powers
  // pay out on each death (Trophies, Block, healing, cards, Strength, Energy). Some cards grow with
  // their own plays instead: each copy keeps its own bonus (card.bzGrowth) for the rest of combat.
  // A few reliable block tools round the set out.
  //
  // New statuses (9): bz_trophy, bz_trophy_hunter, bz_spoils_block, bz_grave_tithe_heal, bz_hunt_draw,
  //   bz_spoil_strength, bz_spark_on_death, bz_totem_block, bz_heart_heal.
  // New cards (32): 11 common, 13 uncommon, 8 rare.
  //
  // Engine notes: Trophy counts are read with {v:'status', status:'bz_trophy', of:'self'}. Spending is an
  // apply with a negative amount, or remove_status. Per-copy growth needs per-card state the effect DSL
  // does not have, so those cards use a custom effect that calls combat.runEffects / combat.gainBlock.
  // ---------------------------------------------------------------------------

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  // Value: floor(Trophies * mul) + add, read from the player.
  function trophies(mul, add) {
    return { v: 'status', status: 'bz_trophy', of: 'self', mul: mul === undefined ? 1 : mul, add: add || 0 };
  }

  // Per-copy damage growth. The combat card keeps its own bonus for the rest of the combat.
  // Each play deals base + bonus, then the bonus grows by `grow`. The hit goes through combat.runEffects,
  // so strength, weak, vulnerable and vigor apply exactly as they do for a normal attack.
  function growingDamage(base, grow, to) {
    return {
      op: 'custom',
      fn: async function (ctx) {
        const combat = ctx.combat;
        const card = ctx.card;
        if (!combat || !card) return;
        const bonus = card.bzGrowth || 0;
        await combat.runEffects([{ op: 'damage', amount: base + bonus, to: to }], {
          source: ctx.source, target: ctx.target, card: card, x: ctx.x,
          kind: 'card', targetKind: card.data ? card.data.target : 'enemy'
        });
        card.bzGrowth = bonus + grow;
      }
    };
  }

  // Per-copy Block growth. Uses gainBlock with modifiable=true, so dexterity and frail apply as they do for a card.
  function growingBlock(base, grow) {
    return {
      op: 'custom',
      fn: async function (ctx) {
        const combat = ctx.combat;
        const card = ctx.card;
        if (!combat || !card) return;
        const bonus = card.bzGrowth || 0;
        await combat.gainBlock(ctx.source, base + bonus, true);
        card.bzGrowth = bonus + grow;
      }
    };
  }

  // ===========================================================================
  // CUSTOM STATUSES (9)
  // ===========================================================================

  // The counter. Trophy cards read it. It is spent with a negative apply or remove_status.
  DS.defineStatus({
    id: 'bz_trophy',
    name: 'Trophies',
    desc: 'Trophies: {n}. Trophy cards grow with each one.',
    type: 'buff',
    icon: '🏆',
    stacks: true
  });

  // Trophy Rack engine: every enemy death adds Trophies (the stacks say how many).
  DS.defineStatus({
    id: 'bz_trophy_hunter',
    name: 'Trophy Gatherer',
    desc: 'Whenever an enemy dies, gain Trophies equal to {n}.',
    type: 'buff',
    icon: '🏹',
    stacks: true,
    triggers: {
      onEnemyDeath: [{ op: 'apply', status: 'bz_trophy', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Every enemy death grants Block.
  DS.defineStatus({
    id: 'bz_spoils_block',
    name: 'Battle Spoils',
    desc: 'Whenever an enemy dies, gain {n} Block.',
    type: 'buff',
    icon: '🎁',
    stacks: true,
    triggers: {
      onEnemyDeath: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Every enemy death heals.
  DS.defineStatus({
    id: 'bz_grave_tithe_heal',
    name: 'Grave Mending',
    desc: 'Whenever an enemy dies, heal {n} HP.',
    type: 'buff',
    icon: '💚',
    stacks: true,
    triggers: {
      onEnemyDeath: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Every enemy death draws cards.
  DS.defineStatus({
    id: 'bz_hunt_draw',
    name: 'Hunting Instinct',
    desc: 'Whenever an enemy dies, draw {n} card(s).',
    type: 'buff',
    icon: '🐾',
    stacks: true,
    triggers: {
      onEnemyDeath: [{ op: 'draw', amount: { v: 'stacks' } }]
    }
  });

  // Every enemy death grants Strength.
  DS.defineStatus({
    id: 'bz_spoil_strength',
    name: 'Blood Tribute',
    desc: 'Whenever an enemy dies, gain {n} Strength.',
    type: 'buff',
    icon: '🏅',
    stacks: true,
    triggers: {
      onEnemyDeath: [{ op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Every enemy death grants Energy.
  DS.defineStatus({
    id: 'bz_spark_on_death',
    name: 'Soul Spark',
    desc: 'Whenever an enemy dies, gain {n} Energy.',
    type: 'buff',
    icon: '🌟',
    stacks: true,
    triggers: {
      onEnemyDeath: [{ op: 'energy', amount: { v: 'stacks' } }]
    }
  });

  // Start of turn: {n} Block for each Trophy. The repeat multiplies the per-Trophy amount by the stacks.
  DS.defineStatus({
    id: 'bz_totem_block',
    name: 'Totem Guard',
    desc: 'At the start of each turn, gain {n} Block for each Trophy.',
    type: 'buff',
    icon: '🛡️',
    stacks: true,
    triggers: {
      onTurnStart: [
        { op: 'repeat', times: { v: 'stacks' }, effects: [{ op: 'block', amount: trophies(1, 0), to: 'self' }] }
      ]
    }
  });

  // Start of turn: {n} HP healed for each Trophy. The repeat multiplies the per-Trophy amount by the stacks.
  DS.defineStatus({
    id: 'bz_heart_heal',
    name: 'Undying Heart',
    desc: 'At the start of each turn, heal {n} HP for each Trophy.',
    type: 'buff',
    icon: '💓',
    stacks: true,
    triggers: {
      onTurnStart: [
        { op: 'repeat', times: { v: 'stacks' }, effects: [{ op: 'heal', amount: trophies(1, 0), to: 'self' }] }
      ]
    }
  });

  // ===========================================================================
  // COMMON (11): 5 attacks, 3 skills, 3 powers
  // ===========================================================================

  // ----- common attacks (5) -----
  DS.defineCard({
    id: 'bz_grim_tally', name: 'Grim Tally', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🏷️',
    desc: 'Deal 5 damage, plus 2 for each Trophy you have.',
    effects: [{ op: 'damage', amount: trophies(2, 5) }],
    upgrade: {
      desc: 'Deal 7 damage, plus 3 for each Trophy you have.',
      effects: [{ op: 'damage', amount: trophies(3, 7) }]
    }
  });

  DS.defineCard({
    id: 'bz_notched_axe', name: 'Notched Axe', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🪚',
    desc: 'Deal 5 damage. Each time you play this card, it deals 2 more damage for the rest of combat.',
    effects: [growingDamage(5, 2, 'target')],
    upgrade: {
      desc: 'Deal 6 damage. Each time you play this card, it deals 3 more damage for the rest of combat.',
      effects: [growingDamage(6, 3, 'target')]
    }
  });

  DS.defineCard({
    id: 'bz_bone_cleaver', name: 'Bone Cleaver', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🪝',
    desc: 'Deal 7 damage. If you have a Trophy, draw 1 card.',
    effects: [
      { op: 'damage', amount: 7 },
      { op: 'if', cond: { left: trophies(), cmp: '>=', right: 1 }, then: [{ op: 'draw', amount: 1 }], else: [] }
    ],
    upgrade: {
      desc: 'Deal 9 damage. If you have a Trophy, draw 1 card.',
      effects: [
        { op: 'damage', amount: 9 },
        { op: 'if', cond: { left: trophies(), cmp: '>=', right: 1 }, then: [{ op: 'draw', amount: 1 }], else: [] }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_sweeping_tally', name: 'Sweeping Tally', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '🧺',
    desc: 'Deal 4 damage to ALL enemies, plus 1 for each Trophy you have.',
    effects: [{ op: 'damage', amount: trophies(1, 4), to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 5 damage to ALL enemies, plus 2 for each Trophy you have.',
      effects: [{ op: 'damage', amount: trophies(2, 5), to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'bz_skewer', name: 'Bone Spear', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🍢',
    desc: 'Deal 10 damage. Apply 1 Vulnerable.',
    effects: [{ op: 'damage', amount: 10 }, { op: 'apply', status: 'vulnerable', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Deal 13 damage. Apply 2 Vulnerable.',
      effects: [{ op: 'damage', amount: 13 }, { op: 'apply', status: 'vulnerable', amount: 2, to: 'target' }]
    }
  });

  // ----- common skills (3) -----
  DS.defineCard({
    id: 'bz_skull_guard', name: 'Skull Guard', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🪖',
    desc: 'Gain 5 Block, plus 2 for each Trophy you have.',
    effects: [{ op: 'block', amount: trophies(2, 5), to: 'self' }],
    upgrade: {
      desc: 'Gain 7 Block, plus 3 for each Trophy you have.',
      effects: [{ op: 'block', amount: trophies(3, 7), to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_pick_clean', name: 'Pick Clean', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🦅',
    desc: 'If you have a Trophy, spend 1 Trophy to draw 2 cards.',
    effects: [{
      op: 'if', cond: { left: trophies(), cmp: '>=', right: 1 },
      then: [{ op: 'apply', status: 'bz_trophy', amount: -1, to: 'self' }, { op: 'draw', amount: 2 }],
      else: []
    }],
    upgrade: {
      desc: 'If you have a Trophy, spend 1 Trophy to draw 3 cards.',
      effects: [{
        op: 'if', cond: { left: trophies(), cmp: '>=', right: 1 },
        then: [{ op: 'apply', status: 'bz_trophy', amount: -1, to: 'self' }, { op: 'draw', amount: 3 }],
        else: []
      }]
    }
  });

  DS.defineCard({
    id: 'bz_burial_cairn', name: 'Burial Cairn', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '⛰️',
    desc: 'Gain 3 Block. Each time you play this card, it gains 2 more Block for the rest of combat.',
    effects: [growingBlock(3, 2)],
    upgrade: {
      desc: 'Gain 4 Block. Each time you play this card, it gains 3 more Block for the rest of combat.',
      effects: [growingBlock(4, 3)]
    }
  });

  // ----- common powers (3) -----
  DS.defineCard({
    id: 'bz_trophy_rack', name: 'Trophy Rack', class: 'berserker', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🏆',
    desc: 'Whenever an enemy dies, gain 1 Trophy.',
    effects: [{ op: 'apply', status: 'bz_trophy_hunter', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever an enemy dies, gain 2 Trophies.',
      effects: [{ op: 'apply', status: 'bz_trophy_hunter', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_spoils_of_war', name: 'Spoils of War', class: 'berserker', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '⚔️',
    desc: 'Whenever an enemy dies, gain 3 Block.',
    effects: [{ op: 'apply', status: 'bz_spoils_block', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Whenever an enemy dies, gain 5 Block.',
      effects: [{ op: 'apply', status: 'bz_spoils_block', amount: 5, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_grave_tithe', name: 'Grave Toll', class: 'berserker', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '💚',
    desc: 'Whenever an enemy dies, heal 2 HP.',
    effects: [{ op: 'apply', status: 'bz_grave_tithe_heal', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever an enemy dies, heal 3 HP.',
      effects: [{ op: 'apply', status: 'bz_grave_tithe_heal', amount: 3, to: 'self' }]
    }
  });

  // ===========================================================================
  // UNCOMMON (13): 5 attacks, 5 skills, 3 powers
  // ===========================================================================

  // ----- uncommon attacks (5) -----
  DS.defineCard({
    id: 'bz_trophy_reaver', name: 'Trophy Reaver', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🦂',
    desc: 'Deal 4 damage, plus 3 for each Trophy you have. Then spend all your Trophies.',
    effects: [{ op: 'damage', amount: trophies(3, 4) }, { op: 'remove_status', status: 'bz_trophy', to: 'self' }],
    upgrade: {
      desc: 'Deal 6 damage, plus 4 for each Trophy you have. Then spend all your Trophies.',
      effects: [{ op: 'damage', amount: trophies(4, 6) }, { op: 'remove_status', status: 'bz_trophy', to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_heirloom_hatchet', name: 'Heirloom Hatchet', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '⚒️',
    desc: 'Deal 6 damage. Each time you play this card, it deals 3 more damage for the rest of combat.',
    effects: [growingDamage(6, 3, 'target')],
    upgrade: {
      desc: 'Deal 8 damage. Each time you play this card, it deals 4 more damage for the rest of combat.',
      effects: [growingDamage(8, 4, 'target')]
    }
  });

  DS.defineCard({
    id: 'bz_crowd_reaver', name: 'Crowd Reaver', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🦑',
    desc: 'Deal 5 damage to ALL enemies, plus 2 for each Trophy you have.',
    effects: [{ op: 'damage', amount: trophies(2, 5), to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 7 damage to ALL enemies, plus 3 for each Trophy you have.',
      effects: [{ op: 'damage', amount: trophies(3, 7), to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'bz_savage_feast', name: 'Savage Feast', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🥓',
    desc: 'Deal 8 damage. Heal 2 HP for each Trophy you have.',
    effects: [{ op: 'damage', amount: 8 }, { op: 'heal', amount: trophies(2, 0), to: 'self' }],
    upgrade: {
      desc: 'Deal 10 damage. Heal 3 HP for each Trophy you have.',
      effects: [{ op: 'damage', amount: 10 }, { op: 'heal', amount: trophies(3, 0), to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_flail_of_skulls', name: 'Flail of Skulls', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🎳',
    desc: 'Deal 4 damage to ALL enemies. Each time you play this card, it deals 2 more damage to ALL enemies for the rest of combat.',
    effects: [growingDamage(4, 2, 'all_enemies')],
    upgrade: {
      desc: 'Deal 5 damage to ALL enemies. Each time you play this card, it deals 3 more damage to ALL enemies for the rest of combat.',
      effects: [growingDamage(5, 3, 'all_enemies')]
    }
  });

  DS.defineCard({
    id: 'bz_ghoulish_feast', name: 'Ghoulish Feast', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧟',
    desc: 'Heal 3 HP for each Trophy you have. Then spend all your Trophies.',
    effects: [{ op: 'heal', amount: trophies(3, 0), to: 'self' }, { op: 'remove_status', status: 'bz_trophy', to: 'self' }],
    upgrade: {
      desc: 'Heal 4 HP for each Trophy you have. Then spend all your Trophies.',
      effects: [{ op: 'heal', amount: trophies(4, 0), to: 'self' }, { op: 'remove_status', status: 'bz_trophy', to: 'self' }]
    }
  });

  // ----- uncommon skills (5) -----
  DS.defineCard({
    id: 'bz_bulwark_of_skulls', name: 'Bulwark of Skulls', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🏛️',
    desc: 'Gain 8 Block, plus 4 for each Trophy you have.',
    effects: [{ op: 'block', amount: trophies(4, 8), to: 'self' }],
    upgrade: {
      desc: 'Gain 11 Block, plus 5 for each Trophy you have.',
      effects: [{ op: 'block', amount: trophies(5, 11), to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_ossuary_vigil', name: 'Ossuary Vigil', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🏚️',
    desc: 'Draw 1 card for each Trophy you have. Gain 3 Block.',
    effects: [{ op: 'draw', amount: trophies(1, 0) }, { op: 'block', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Draw 1 card for each Trophy you have. Gain 5 Block.',
      effects: [{ op: 'draw', amount: trophies(1, 0) }, { op: 'block', amount: 5, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_growing_bulwark', name: 'Growing Bulwark', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🏗️',
    desc: 'Gain 5 Block. Each time you play this card, it gains 3 more Block for the rest of combat.',
    effects: [growingBlock(5, 3)],
    upgrade: {
      desc: 'Gain 6 Block. Each time you play this card, it gains 4 more Block for the rest of combat.',
      effects: [growingBlock(6, 4)]
    }
  });

  DS.defineCard({
    id: 'bz_trophy_ward', name: 'Trophy Ward', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🎖️',
    desc: 'If you have at least 2 Trophies, spend 2 Trophies to gain 10 Block.',
    effects: [{
      op: 'if', cond: { left: trophies(), cmp: '>=', right: 2 },
      then: [{ op: 'apply', status: 'bz_trophy', amount: -2, to: 'self' }, { op: 'block', amount: 10, to: 'self' }],
      else: []
    }],
    upgrade: {
      desc: 'If you have at least 2 Trophies, spend 2 Trophies to gain 14 Block.',
      effects: [{
        op: 'if', cond: { left: trophies(), cmp: '>=', right: 2 },
        then: [{ op: 'apply', status: 'bz_trophy', amount: -2, to: 'self' }, { op: 'block', amount: 14, to: 'self' }],
        else: []
      }]
    }
  });

  // ----- uncommon powers (3) -----
  DS.defineCard({
    id: 'bz_relentless_hunt', name: 'Relentless Hunt', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🐕',
    desc: 'Whenever an enemy dies, draw 1 card.',
    effects: [{ op: 'apply', status: 'bz_hunt_draw', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever an enemy dies, draw 2 cards.',
      effects: [{ op: 'apply', status: 'bz_hunt_draw', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_warlords_spoils', name: "Warlord's Spoils", class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '👑',
    desc: 'Whenever an enemy dies, gain 1 Strength.',
    effects: [{ op: 'apply', status: 'bz_spoil_strength', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever an enemy dies, gain 2 Strength.',
      effects: [{ op: 'apply', status: 'bz_spoil_strength', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_trophy_totem', name: 'Trophy Totem', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪅',
    desc: 'At the start of each turn, gain 1 Block for each Trophy you have.',
    effects: [{ op: 'apply', status: 'bz_totem_block', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, gain 2 Block for each Trophy you have.',
      effects: [{ op: 'apply', status: 'bz_totem_block', amount: 2, to: 'self' }]
    }
  });

  // ===========================================================================
  // RARE (8): 4 attacks, 1 skill, 3 powers
  // ===========================================================================

  // ----- rare attacks (4) -----
  DS.defineCard({
    id: 'bz_trophy_pyre', name: 'Trophy Pyre', class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🎆', exhaust: true,
    desc: 'Deal 4 damage to ALL enemies for each Trophy you have. Then spend all your Trophies. Exhaust.',
    effects: [
      { op: 'damage', amount: 4, times: trophies(), to: 'all_enemies' },
      { op: 'remove_status', status: 'bz_trophy', to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 6 damage to ALL enemies for each Trophy you have. Then spend all your Trophies. Exhaust.',
      effects: [
        { op: 'damage', amount: 6, times: trophies(), to: 'all_enemies' },
        { op: 'remove_status', status: 'bz_trophy', to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_judgment_of_skulls', name: 'Judgment of Skulls', class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '⚖️',
    desc: 'Deal 6 damage, plus 5 for each Trophy you have. Then spend all your Trophies.',
    effects: [{ op: 'damage', amount: trophies(5, 6) }, { op: 'remove_status', status: 'bz_trophy', to: 'self' }],
    upgrade: {
      desc: 'Deal 8 damage, plus 6 for each Trophy you have. Then spend all your Trophies.',
      effects: [{ op: 'damage', amount: trophies(6, 8) }, { op: 'remove_status', status: 'bz_trophy', to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_heirloom_greataxe', name: 'Heirloom Greataxe', class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🪓',
    desc: 'Deal 9 damage. Each time you play this card, it deals 5 more damage for the rest of combat.',
    effects: [growingDamage(9, 5, 'target')],
    upgrade: {
      desc: 'Deal 12 damage. Each time you play this card, it deals 6 more damage for the rest of combat.',
      effects: [growingDamage(12, 6, 'target')]
    }
  });

  DS.defineCard({
    id: 'bz_reaping_scythe', name: "Reaper's Harvest", class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🌑',
    desc: 'Deal 7 damage to ALL enemies, plus 4 for each Trophy you have.',
    effects: [{ op: 'damage', amount: trophies(4, 7), to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 9 damage to ALL enemies, plus 5 for each Trophy you have.',
      effects: [{ op: 'damage', amount: trophies(5, 9), to: 'all_enemies' }]
    }
  });

  // ----- rare skill (1) -----
  DS.defineCard({
    id: 'bz_bloodpyre_shroud', name: 'Bloodpyre Shroud', class: 'berserker', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🪔',
    desc: 'Gain 4 Block for each Trophy you have. Then spend all your Trophies.',
    effects: [{ op: 'block', amount: trophies(4, 0), to: 'self' }, { op: 'remove_status', status: 'bz_trophy', to: 'self' }],
    upgrade: {
      desc: 'Gain 6 Block for each Trophy you have. Then spend all your Trophies.',
      effects: [{ op: 'block', amount: trophies(6, 0), to: 'self' }, { op: 'remove_status', status: 'bz_trophy', to: 'self' }]
    }
  });

  // ----- rare powers (3) -----
  DS.defineCard({
    id: 'bz_hall_of_skulls', name: 'Hall of Skulls', class: 'berserker', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '💎',
    desc: 'Whenever an enemy dies, gain 2 Trophies and 3 Block.',
    effects: [
      { op: 'apply', status: 'bz_trophy_hunter', amount: 2, to: 'self' },
      { op: 'apply', status: 'bz_spoils_block', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Whenever an enemy dies, gain 3 Trophies and 5 Block.',
      effects: [
        { op: 'apply', status: 'bz_trophy_hunter', amount: 3, to: 'self' },
        { op: 'apply', status: 'bz_spoils_block', amount: 5, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_death_spark', name: 'Death Spark', class: 'berserker', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '✨',
    desc: 'Whenever an enemy dies, gain 1 Energy.',
    effects: [{ op: 'apply', status: 'bz_spark_on_death', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever an enemy dies, gain 1 Energy and draw 1 card.',
      effects: [
        { op: 'apply', status: 'bz_spark_on_death', amount: 1, to: 'self' },
        { op: 'apply', status: 'bz_hunt_draw', amount: 1, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_trophy_heart', name: 'Trophy Heart', class: 'berserker', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '💗',
    desc: 'At the start of each turn, heal 1 HP for each Trophy you have.',
    effects: [{ op: 'apply', status: 'bz_heart_heal', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, heal 2 HP for each Trophy you have.',
      effects: [{ op: 'apply', status: 'bz_heart_heal', amount: 2, to: 'self' }]
    }
  });
})();
