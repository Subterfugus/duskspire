(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // ARCANIST expansion (v2). Adds the LIGHTNING archetype and deepens Arcane Charge, Burn and Frost.
  //   Lightning : random_enemy multi-hits that scale with cards_played, chain effects (hit all, then a bonus
  //               to a random enemy), Lock-On setups, 0-cost Static Spark / Surge Spark tokens.
  //   Defense   : ar_quartz_guard, ar_rime_shell, ar_warding_breath, ar_mirror_step (commons).
  //   Deepened  : Arcane Charge (ar_charge_pulse, ar_scribe_note, ar_crosshair, ar_arcane_overdrive),
  //               Burn (ar_ignite_touch, ar_smolder, ar_ember_relay, ar_tinder_strike, ar_cinder_veil, ar_conflagration),
  //               Frost (ar_rime_shell, ar_frost_nip, ar_hoarfrost_strike, ar_glacial_recall, ar_frozen_pulse,
  //               ar_cold_sovereign, ar_frost_eclipse).
  // Custom statuses (7, ids ar_st_*): arc_relay, conduit, capacitor, storm_cadence, thunder_drum, spark_crown, cold_sovereign.
  // Relics (class arcanist): ar_relic2_copper_coil (common), ar_relic2_lightning_rod (uncommon), ar_relic2_thunderhead (rare).
  // ---------------------------------------------------------------------------

  // ===========================================================================
  // CUSTOM STATUSES (7). Power cards apply these to self.
  // ===========================================================================

  // Lightning engine: each Attack you play also zaps a random enemy.
  DS.defineStatus({
    id: 'ar_st_arc_relay',
    name: 'Arc Relay',
    desc: 'Whenever you play an Attack, deal {n} damage to a random enemy.',
    type: 'buff',
    icon: '🛰️',
    stacks: true,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
      }
    }
  });

  // Debuff engine: every debuff you apply to an enemy becomes a conduit for damage.
  DS.defineStatus({
    id: 'ar_st_conduit',
    name: 'Conduit',
    desc: 'Whenever you apply a debuff to an enemy, deal {n} damage to that enemy.',
    type: 'buff',
    icon: '🧲',
    stacks: true,
    triggers: {
      onApplyDebuff: [{ op: 'damage', amount: { v: 'stacks' }, to: 'target' }]
    }
  });

  // Debuff engine: every debuff you apply to an enemy charges you up.
  DS.defineStatus({
    id: 'ar_st_capacitor',
    name: 'Capacitor',
    desc: 'Whenever you apply a debuff to an enemy, gain {n} Arcane Charge.',
    type: 'buff',
    icon: '🔋',
    stacks: true,
    triggers: {
      onApplyDebuff: [{ op: 'apply', status: 'ar_arcane_charge', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Lightning clock: every third card you play strikes a random enemy.
  DS.defineStatus({
    id: 'ar_st_storm_cadence',
    name: 'Storm Cadence',
    desc: 'Every 3rd card you play deals {n} damage to a random enemy.',
    type: 'buff',
    icon: '🎶',
    stacks: true,
    triggers: {
      onCardPlayed: {
        every: 3,
        effects: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
      }
    }
  });

  // End-of-turn storm: each repeat deals 2 damage to all enemies per card played this turn.
  DS.defineStatus({
    id: 'ar_st_thunder_drum',
    name: 'Thunder Drum',
    desc: 'At the end of each turn, deal 2 damage to ALL enemies for each card you played this turn. Repeats {n} time(s).',
    type: 'buff',
    icon: '🥁',
    stacks: true,
    triggers: {
      onTurnEnd: [{
        op: 'repeat',
        times: { v: 'stacks' },
        effects: [{ op: 'damage', amount: { v: 'cards_played', mul: 2 }, to: 'all_enemies' }]
      }]
    }
  });

  // Spark engine: attacks conjure free 0-cost Static Sparks.
  DS.defineStatus({
    id: 'ar_st_spark_crown',
    name: 'Spark Crown',
    desc: 'Whenever you play an Attack, add {n} Static Spark to your hand.',
    type: 'buff',
    icon: '👑',
    stacks: true,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [{ op: 'add_card', card: 'ar_static_spark', to: 'hand', amount: { v: 'stacks' } }]
      }
    }
  });

  // Frost engine: every turn the cold lands on a random enemy.
  DS.defineStatus({
    id: 'ar_st_cold_sovereign',
    name: 'Cold Sovereign',
    desc: 'At the start of each turn, apply {n} Chill to a random enemy.',
    type: 'buff',
    icon: '🧊',
    stacks: true,
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'ar_chill', amount: { v: 'stacks' }, to: 'random_enemy' }]
    }
  });

  // ===========================================================================
  // COMMON CARDS (14): 4 defensive, Lightning, Burn, Frost and Arcane Charge starters
  // ===========================================================================
  DS.defineCard({
    id: 'ar_static_jolt', name: 'Static Jolt', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 1, target: 'random_enemy', icon: '🔌',
    desc: 'Deal 2 damage to a random enemy for each card played this turn, including this one.',
    effects: [{ op: 'damage', amount: { v: 'cards_played', mul: 2 }, to: 'random_enemy' }],
    upgrade: {
      desc: 'Deal 3 damage to a random enemy for each card played this turn, including this one.',
      effects: [{ op: 'damage', amount: { v: 'cards_played', mul: 3 }, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'ar_quartz_guard', name: 'Quartz Guard', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🔹',
    desc: 'Gain 7 Block.',
    effects: [{ op: 'block', amount: 7, to: 'self' }],
    upgrade: { desc: 'Gain 10 Block.', effects: [{ op: 'block', amount: 10, to: 'self' }] }
  });

  DS.defineCard({
    id: 'ar_rime_shell', name: 'Rime Shell', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'none', icon: '🫧',
    desc: 'Gain 5 Block. Apply 1 Chill to a random enemy.',
    effects: [
      { op: 'block', amount: 5, to: 'self' },
      { op: 'apply', status: 'ar_chill', amount: 1, to: 'random_enemy' }
    ],
    upgrade: {
      desc: 'Gain 7 Block. Apply 2 Chill to a random enemy.',
      effects: [
        { op: 'block', amount: 7, to: 'self' },
        { op: 'apply', status: 'ar_chill', amount: 2, to: 'random_enemy' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_warding_breath', name: 'Warding Breath', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🕊️',
    desc: 'Gain 4 Block. Heal 2 HP.',
    effects: [
      { op: 'block', amount: 4, to: 'self' },
      { op: 'heal', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 6 Block. Heal 3 HP.',
      effects: [
        { op: 'block', amount: 6, to: 'self' },
        { op: 'heal', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_mirror_step', name: 'Mirror Step', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 0, target: 'none', icon: '👣',
    desc: 'Gain 3 Block. Draw 1 card.',
    effects: [
      { op: 'block', amount: 3, to: 'self' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Gain 4 Block. Draw 2 cards.',
      effects: [
        { op: 'block', amount: 4, to: 'self' },
        { op: 'draw', amount: 2 }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_ignite_touch', name: 'Ignite Touch', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '🔆',
    desc: 'Deal 2 damage. Apply 1 Burn.',
    effects: [
      { op: 'damage', amount: 2 },
      { op: 'apply', status: 'burn', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 3 damage. Apply 2 Burn.',
      effects: [
        { op: 'damage', amount: 3 },
        { op: 'apply', status: 'burn', amount: 2, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_charge_pulse', name: 'Charge Pulse', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🔵',
    desc: 'Deal 6 damage. Gain 1 Arcane Charge for each Attack played this turn, including this one.',
    effects: [
      { op: 'damage', amount: 6 },
      { op: 'apply', status: 'ar_arcane_charge', amount: { v: 'attacks_played' }, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 8 damage. Gain 2 Arcane Charge for each Attack played this turn, including this one.',
      effects: [
        { op: 'damage', amount: 8 },
        { op: 'apply', status: 'ar_arcane_charge', amount: { v: 'attacks_played', mul: 2 }, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_frost_nip', name: 'Frost Nip', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '💨',
    desc: 'Deal 4 damage. Apply 2 Chill.',
    effects: [
      { op: 'damage', amount: 4 },
      { op: 'apply', status: 'ar_chill', amount: 2, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 5 damage. Apply 3 Chill.',
      effects: [
        { op: 'damage', amount: 5 },
        { op: 'apply', status: 'ar_chill', amount: 3, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_live_wire', name: 'Live Wire', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 0, target: 'random_enemy', icon: '🪫',
    desc: 'Deal 3 damage to a random enemy. If you have played 2 or more cards this turn, draw 1 card.',
    effects: [
      { op: 'damage', amount: 3, to: 'random_enemy' },
      {
        op: 'if',
        cond: { left: { v: 'cards_played' }, cmp: '>=', right: 2 },
        then: [{ op: 'draw', amount: 1 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 4 damage to a random enemy. If you have played 2 or more cards this turn, draw 1 card.',
      effects: [
        { op: 'damage', amount: 4, to: 'random_enemy' },
        {
          op: 'if',
          cond: { left: { v: 'cards_played' }, cmp: '>=', right: 2 },
          then: [{ op: 'draw', amount: 1 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_smolder', name: 'Smolder', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🪵',
    desc: 'Apply 3 Burn to the target. Draw 1 card.',
    effects: [
      { op: 'apply', status: 'burn', amount: 3, to: 'target' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Apply 4 Burn to the target. Draw 2 cards.',
      effects: [
        { op: 'apply', status: 'burn', amount: 4, to: 'target' },
        { op: 'draw', amount: 2 }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_scribe_note', name: 'Scribe Note', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 0, target: 'none', icon: '📝',
    desc: 'Gain 1 Arcane Charge. Draw 1 card.',
    effects: [
      { op: 'apply', status: 'ar_arcane_charge', amount: 1, to: 'self' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Gain 2 Arcane Charge. Draw 1 card.',
      effects: [
        { op: 'apply', status: 'ar_arcane_charge', amount: 2, to: 'self' },
        { op: 'draw', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_spark_tap', name: 'Spark Tap', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 0, target: 'none', icon: '🧷',
    desc: 'Add 1 Static Spark to your hand.',
    effects: [{ op: 'add_card', card: 'ar_static_spark', to: 'hand', amount: 1 }],
    upgrade: {
      desc: 'Add 2 Static Sparks to your hand.',
      effects: [{ op: 'add_card', card: 'ar_static_spark', to: 'hand', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'ar_hoarfrost_strike', name: 'Hoarfrost Strike', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🗡️',
    desc: 'Deal 6 damage. If the target has Chill, deal 4 more damage.',
    effects: [
      { op: 'damage', amount: 6 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'ar_chill', of: 'target' }, cmp: '>=', right: 1 },
        then: [{ op: 'damage', amount: 4 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 8 damage. If the target has Chill, deal 6 more damage.',
      effects: [
        { op: 'damage', amount: 8 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'ar_chill', of: 'target' }, cmp: '>=', right: 1 },
          then: [{ op: 'damage', amount: 6 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_cycle_sigil', name: 'Cycle Sigil', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'none', icon: '🔀',
    desc: 'Discard 1 card. Draw 2 cards.',
    effects: [
      { op: 'discard', amount: 1 },
      { op: 'draw', amount: 2 }
    ],
    upgrade: {
      desc: 'Discard 1 card. Draw 3 cards.',
      effects: [
        { op: 'discard', amount: 1 },
        { op: 'draw', amount: 3 }
      ]
    }
  });

  // ===========================================================================
  // UNCOMMON CARDS (17): Lightning chains and Lock-On, Burn and Frost utility, four powers
  // ===========================================================================
  DS.defineCard({
    id: 'ar_arc_cascade', name: 'Arc Cascade', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🎐',
    desc: 'Deal 5 damage to ALL enemies. Deal 8 damage to a random enemy.',
    effects: [
      { op: 'damage', amount: 5, to: 'all_enemies' },
      { op: 'damage', amount: 8, to: 'random_enemy' }
    ],
    upgrade: {
      desc: 'Deal 7 damage to ALL enemies. Deal 11 damage to a random enemy.',
      effects: [
        { op: 'damage', amount: 7, to: 'all_enemies' },
        { op: 'damage', amount: 11, to: 'random_enemy' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_relay_bolt', name: 'Relay Bolt', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪢',
    desc: 'Deal 6 damage. Deal 4 damage to a random enemy.',
    effects: [
      { op: 'damage', amount: 6 },
      { op: 'damage', amount: 4, to: 'random_enemy' }
    ],
    upgrade: {
      desc: 'Deal 8 damage. Deal 6 damage to a random enemy.',
      effects: [
        { op: 'damage', amount: 8 },
        { op: 'damage', amount: 6, to: 'random_enemy' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_rolling_thunder', name: 'Rolling Thunder', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'random_enemy', icon: '📶',
    desc: 'Deal 3 damage to a random enemy for each card played this turn, including this one.',
    effects: [{ op: 'damage', amount: { v: 'cards_played', mul: 3 }, to: 'random_enemy' }],
    upgrade: {
      desc: 'Deal 4 damage to a random enemy for each card played this turn, including this one.',
      effects: [{ op: 'damage', amount: { v: 'cards_played', mul: 4 }, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'ar_lock_signal', name: 'Lock Signal', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '📡',
    desc: 'Apply 2 Lock-On to the target. Draw 1 card.',
    effects: [
      { op: 'apply', status: 'lock_on', amount: 2, to: 'target' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Apply 3 Lock-On to the target. Draw 1 card.',
      effects: [
        { op: 'apply', status: 'lock_on', amount: 3, to: 'target' },
        { op: 'draw', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_crosshair', name: 'Crosshair', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'enemy', icon: '🔭',
    desc: 'Apply 1 Lock-On to the target. Gain 1 Arcane Charge.',
    effects: [
      { op: 'apply', status: 'lock_on', amount: 1, to: 'target' },
      { op: 'apply', status: 'ar_arcane_charge', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Apply 2 Lock-On to the target. Gain 2 Arcane Charge.',
      effects: [
        { op: 'apply', status: 'lock_on', amount: 2, to: 'target' },
        { op: 'apply', status: 'ar_arcane_charge', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_glacial_recall', name: 'Glacial Recall', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🗝️',
    desc: 'Gain 5 Block. Apply 2 Chill to a random enemy. Draw 1 card.',
    effects: [
      { op: 'block', amount: 5, to: 'self' },
      { op: 'apply', status: 'ar_chill', amount: 2, to: 'random_enemy' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Gain 7 Block. Apply 3 Chill to a random enemy. Draw 1 card.',
      effects: [
        { op: 'block', amount: 7, to: 'self' },
        { op: 'apply', status: 'ar_chill', amount: 3, to: 'random_enemy' },
        { op: 'draw', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_ember_relay', name: 'Ember Relay', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🧨',
    desc: 'Deal 4 damage. Apply 2 Burn to the target and 1 Burn to a random enemy.',
    effects: [
      { op: 'damage', amount: 4 },
      { op: 'apply', status: 'burn', amount: 2, to: 'target' },
      { op: 'apply', status: 'burn', amount: 1, to: 'random_enemy' }
    ],
    upgrade: {
      desc: 'Deal 5 damage. Apply 3 Burn to the target and 2 Burn to a random enemy.',
      effects: [
        { op: 'damage', amount: 5 },
        { op: 'apply', status: 'burn', amount: 3, to: 'target' },
        { op: 'apply', status: 'burn', amount: 2, to: 'random_enemy' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_tinder_strike', name: 'Tinder Strike', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🪔',
    desc: 'Deal 6 damage, plus 3 for each Burn on the target.',
    effects: [{ op: 'damage', amount: { v: 'status', status: 'burn', of: 'target', mul: 3, add: 6 } }],
    upgrade: {
      desc: 'Deal 8 damage, plus 4 for each Burn on the target.',
      effects: [{ op: 'damage', amount: { v: 'status', status: 'burn', of: 'target', mul: 4, add: 8 } }]
    }
  });

  DS.defineCard({
    id: 'ar_spark_barrier', name: 'Spark Barrier', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🔰',
    desc: 'Gain 5 Block. Deal 3 damage to a random enemy.',
    effects: [
      { op: 'block', amount: 5, to: 'self' },
      { op: 'damage', amount: 3, to: 'random_enemy' }
    ],
    upgrade: {
      desc: 'Gain 7 Block. Deal 4 damage to a random enemy.',
      effects: [
        { op: 'block', amount: 7, to: 'self' },
        { op: 'damage', amount: 4, to: 'random_enemy' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_arc_relay', name: 'Arc Relay', class: 'arcanist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🛰️',
    desc: 'Whenever you play an Attack, deal 2 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'ar_st_arc_relay', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play an Attack, deal 3 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'ar_st_arc_relay', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_conduit', name: 'Conduit', class: 'arcanist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧲',
    desc: 'Whenever you apply a debuff to an enemy, deal 2 damage to that enemy.',
    effects: [{ op: 'apply', status: 'ar_st_conduit', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you apply a debuff to an enemy, deal 3 damage to that enemy.',
      effects: [{ op: 'apply', status: 'ar_st_conduit', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_capacitor', name: 'Capacitor', class: 'arcanist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '⏳',
    desc: 'Whenever you apply a debuff to an enemy, gain 1 Arcane Charge.',
    effects: [{ op: 'apply', status: 'ar_st_capacitor', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you apply a debuff to an enemy, gain 2 Arcane Charge.',
      effects: [{ op: 'apply', status: 'ar_st_capacitor', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_storm_cadence', name: 'Storm Cadence', class: 'arcanist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🎶',
    desc: 'Every 3rd card you play deals 6 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'ar_st_storm_cadence', amount: 6, to: 'self' }],
    upgrade: {
      desc: 'Every 3rd card you play deals 9 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'ar_st_storm_cadence', amount: 9, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_frozen_pulse', name: 'Frozen Pulse', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🩵',
    desc: 'Apply 1 Chill to ALL enemies. Draw 1 card.',
    effects: [
      { op: 'apply', status: 'ar_chill', amount: 1, to: 'all_enemies' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Apply 2 Chill to ALL enemies. Draw 1 card.',
      effects: [
        { op: 'apply', status: 'ar_chill', amount: 2, to: 'all_enemies' },
        { op: 'draw', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_cinder_veil', name: 'Cinder Veil', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🌁',
    desc: 'Gain 5 Block. Apply 2 Burn to ALL enemies.',
    effects: [
      { op: 'block', amount: 5, to: 'self' },
      { op: 'apply', status: 'burn', amount: 2, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Gain 7 Block. Apply 3 Burn to ALL enemies.',
      effects: [
        { op: 'block', amount: 7, to: 'self' },
        { op: 'apply', status: 'burn', amount: 3, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_arc_drain', name: 'Arc Drain', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🩸',
    desc: 'Deal 5 damage. Heal 3 HP.',
    effects: [
      { op: 'damage', amount: 5 },
      { op: 'heal', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 7 damage. Heal 4 HP.',
      effects: [
        { op: 'damage', amount: 7 },
        { op: 'heal', amount: 4, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_surge_kickstart', name: 'Surge Kickstart', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'none', icon: '🌅', exhaust: true,
    desc: 'Gain 1 Energy. Add 1 Static Spark to your hand. Exhaust.',
    effects: [
      { op: 'energy', amount: 1 },
      { op: 'add_card', card: 'ar_static_spark', to: 'hand', amount: 1 }
    ],
    upgrade: {
      desc: 'Gain 2 Energy. Add 2 Static Sparks to your hand. Exhaust.',
      effects: [
        { op: 'energy', amount: 2 },
        { op: 'add_card', card: 'ar_static_spark', to: 'hand', amount: 2 }
      ]
    }
  });

  // ===========================================================================
  // RARE CARDS (9): Lightning finishers and engines, Conflagration, Frost Eclipse, X-cost spells
  // ===========================================================================
  DS.defineCard({
    id: 'ar_thunder_drum', name: 'Thunder Drum', class: 'arcanist', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🥁',
    desc: 'At the end of each turn, deal 2 damage to ALL enemies for each card you played this turn.',
    effects: [{ op: 'apply', status: 'ar_st_thunder_drum', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the end of each turn, deal 4 damage to ALL enemies for each card you played this turn.',
      effects: [{ op: 'apply', status: 'ar_st_thunder_drum', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_stormfront', name: 'Stormfront', class: 'arcanist', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🌩️',
    desc: 'Deal 6 damage to ALL enemies. Deal 4 damage to a random enemy for each card played this turn, including this one.',
    effects: [
      { op: 'damage', amount: 6, to: 'all_enemies' },
      { op: 'damage', amount: { v: 'cards_played', mul: 4 }, to: 'random_enemy' }
    ],
    upgrade: {
      desc: 'Deal 8 damage to ALL enemies. Deal 5 damage to a random enemy for each card played this turn, including this one.',
      effects: [
        { op: 'damage', amount: 8, to: 'all_enemies' },
        { op: 'damage', amount: { v: 'cards_played', mul: 5 }, to: 'random_enemy' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_chain_lightning', name: 'Chain Lightning', class: 'arcanist', type: 'attack', rarity: 'rare',
    cost: 2, target: 'random_enemy', icon: '⚡',
    desc: 'Deal 4 damage to a random enemy 5 times.',
    effects: [{ op: 'damage', amount: 4, times: 5, to: 'random_enemy' }],
    upgrade: {
      desc: 'Deal 5 damage to a random enemy 5 times.',
      effects: [{ op: 'damage', amount: 5, times: 5, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'ar_crown_of_sparks', name: 'Crown of Sparks', class: 'arcanist', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '👑',
    desc: 'Whenever you play an Attack, add 1 Static Spark to your hand.',
    effects: [{ op: 'apply', status: 'ar_st_spark_crown', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play an Attack, add 2 Static Sparks to your hand.',
      effects: [{ op: 'apply', status: 'ar_st_spark_crown', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_conflagration', name: 'Conflagration', class: 'arcanist', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '☀️',
    desc: 'Deal 6 damage to ALL enemies. Double the Burn on ALL enemies.',
    effects: [
      { op: 'damage', amount: 6, to: 'all_enemies' },
      { op: 'multiply_status', status: 'burn', factor: 2, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 9 damage to ALL enemies. Triple the Burn on ALL enemies.',
      effects: [
        { op: 'damage', amount: 9, to: 'all_enemies' },
        { op: 'multiply_status', status: 'burn', factor: 3, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_cold_sovereign', name: 'Cold Sovereign', class: 'arcanist', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🧊',
    desc: 'At the start of each turn, apply 2 Chill to a random enemy.',
    effects: [{ op: 'apply', status: 'ar_st_cold_sovereign', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, apply 3 Chill to a random enemy.',
      effects: [{ op: 'apply', status: 'ar_st_cold_sovereign', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_arcane_overdrive', name: 'Arcane Overdrive', class: 'arcanist', type: 'skill', rarity: 'rare',
    cost: 'X', target: 'none', icon: '🪐',
    desc: 'Spend all your Energy. Gain 1 Arcane Charge per Energy spent. Draw 1 card.',
    effects: [
      { op: 'apply', status: 'ar_arcane_charge', amount: { v: 'x' }, to: 'self' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Spend all your Energy. Gain 2 Arcane Charge per Energy spent. Draw 1 card.',
      effects: [
        { op: 'apply', status: 'ar_arcane_charge', amount: { v: 'x', mul: 2 }, to: 'self' },
        { op: 'draw', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_chain_overload', name: 'Chain Overload', class: 'arcanist', type: 'attack', rarity: 'rare',
    cost: 'X', target: 'random_enemy', icon: '🔩',
    desc: 'Spend all your Energy. Deal 2 damage per Energy spent to a random enemy, 2 times.',
    effects: [{ op: 'damage', amount: { v: 'x', mul: 2 }, times: 2, to: 'random_enemy' }],
    upgrade: {
      desc: 'Spend all your Energy. Deal 3 damage per Energy spent to a random enemy, 2 times.',
      effects: [{ op: 'damage', amount: { v: 'x', mul: 3 }, times: 2, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'ar_frost_eclipse', name: 'Frost Eclipse', class: 'arcanist', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🌑',
    desc: 'Deal 6 damage to ALL enemies. Apply 3 Chill and 1 Lock-On to ALL enemies.',
    effects: [
      { op: 'damage', amount: 6, to: 'all_enemies' },
      { op: 'apply', status: 'ar_chill', amount: 3, to: 'all_enemies' },
      { op: 'apply', status: 'lock_on', amount: 1, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 8 damage to ALL enemies. Apply 4 Chill and 2 Lock-On to ALL enemies.',
      effects: [
        { op: 'damage', amount: 8, to: 'all_enemies' },
        { op: 'apply', status: 'ar_chill', amount: 4, to: 'all_enemies' },
        { op: 'apply', status: 'lock_on', amount: 2, to: 'all_enemies' }
      ]
    }
  });

  // ===========================================================================
  // TOKENS (rarity 'special': created by other cards, never offered as rewards)
  // ===========================================================================
  DS.defineCard({
    id: 'ar_static_spark', name: 'Static Spark', class: 'arcanist', type: 'attack', rarity: 'special',
    cost: 0, target: 'random_enemy', icon: '⚡', exhaust: true,
    desc: 'Deal 2 damage to a random enemy. Exhaust.',
    effects: [{ op: 'damage', amount: 2, to: 'random_enemy' }],
    upgrade: {
      desc: 'Deal 3 damage to a random enemy. Exhaust.',
      effects: [{ op: 'damage', amount: 3, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'ar_surge_spark', name: 'Surge Spark', class: 'arcanist', type: 'attack', rarity: 'special',
    cost: 0, target: 'all_enemies', icon: '🌠', exhaust: true,
    desc: 'Deal 1 damage to ALL enemies. Exhaust.',
    effects: [{ op: 'damage', amount: 1, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 2 damage to ALL enemies. Exhaust.',
      effects: [{ op: 'damage', amount: 2, to: 'all_enemies' }]
    }
  });

  // ===========================================================================
  // CLASS RELICS (3): reward the Lightning archetype
  // ===========================================================================
  DS.defineRelic({
    id: 'ar_relic2_copper_coil',
    name: 'Copper Coil',
    desc: 'The first Attack you play each turn also deals 3 damage to a random enemy.',
    flavor: 'Wound tight by a patient hand, it sings when the first spell leaves the glass.',
    rarity: 'common',
    icon: '🗜️',
    class: 'arcanist',
    passive: {},
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        oncePerTurn: true,
        effects: [{ op: 'damage', amount: 3, to: 'random_enemy' }]
      }
    }
  });

  DS.defineRelic({
    id: 'ar_relic2_lightning_rod',
    name: 'Lightning Rod',
    desc: 'Whenever you apply a debuff to an enemy, deal 2 damage to a random enemy.',
    flavor: 'Every hex finds a second target, and the storm always knows where it is.',
    rarity: 'uncommon',
    icon: '📍',
    class: 'arcanist',
    passive: {},
    triggers: {
      onApplyDebuff: [{ op: 'damage', amount: 2, to: 'random_enemy' }]
    }
  });

  DS.defineRelic({
    id: 'ar_relic2_thunderhead',
    name: 'Thunderhead',
    desc: 'At the end of your turn, if you played 4 or more cards this turn, deal 6 damage to ALL enemies.',
    flavor: 'Mirell never sleeps. Neither does the cloud above her.',
    rarity: 'rare',
    icon: '☁️',
    class: 'arcanist',
    passive: {},
    triggers: {
      onTurnEnd: [{
        op: 'if',
        cond: { left: { v: 'cards_played' }, cmp: '>=', right: 4 },
        then: [{ op: 'damage', amount: 6, to: 'all_enemies' }],
        else: []
      }]
    }
  });

})();

