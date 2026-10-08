(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // ARCANIST: Mirell, the Glasswright. Glass-cannon spellcaster, 75 HP.
  // Four archetypes that reward different deck choices:
  //   Arcane Charge : skills and attacks bank Arcane Charge (ar_arcane_charge); finishers spend it
  //                   through Value objects (ar_arcane_finale, ar_arcane_aegis, ar_charged_bolt, ar_spell_tithe).
  //   Cinderfall    : Burn and all-enemy fire (ar_ember_lash, ar_cinder_gust, ar_ember_storm, ar_meteor_rain,
  //                   ar_pyre_heart, ar_burning_hymn, ar_kindling_gaze, ar_cinder_feast).
  //   Frostglass    : Chill (punishes enemy attacks), Weak and block (ar_frost_lance, ar_hailstorm, ar_glacial_ward,
  //                   ar_frost_mantle, ar_absolute_zero, ar_shatter_ice).
  //   Mana Engine   : X-cost, energy ramp and card generation (ar_overcharge_bolt, ar_maelstrom, ar_mana_spring,
  //                   ar_wild_magic, ar_conjure_ember, ar_arcane_cascade).
  // ---------------------------------------------------------------------------

  DS.defineCharacter({
    id: 'arcanist',
    name: 'Mirell',
    title: 'The Glasswright',
    desc: 'A brittle, brilliant spellcaster who hoards arcane charge and unleashes it in one devastating finisher. Fire, frost and raw mana all answer to her.',
    hp: 75,
    gold: 99,
    icon: '🔮',
    color: '#2980b9',
    starterDeck: [
      'ar_strike', 'ar_strike', 'ar_strike', 'ar_strike', 'ar_strike',
      'ar_defend', 'ar_defend', 'ar_defend', 'ar_defend',
      'ar_kindling_bolt', 'ar_focus_rune'
    ],
    starterRelic: 'ar_cinder_lamp'
  });

  // ===========================================================================
  // STARTER RELIC
  // ===========================================================================
  DS.defineRelic({
    id: 'ar_cinder_lamp',
    name: 'Cinder Lamp',
    desc: 'Gain 1 Energy at the start of the first turn of each combat.',
    flavor: 'It never goes out, and it never stops humming.',
    rarity: 'starter',
    icon: '🏮',
    class: 'arcanist',
    passive: {},
    triggers: {
      onTurnStart: { when: { turn: 1 }, effects: [{ op: 'energy', amount: 1 }] }
    }
  });

  // ===========================================================================
  // CUSTOM STATUSES (13). Power cards apply these to self.
  // ===========================================================================

  // The resource itself. Skills and attacks build it; finishers spend it via Value objects.
  DS.defineStatus({
    id: 'ar_arcane_charge',
    name: 'Arcane Charge',
    desc: 'Stored arcane power ({n}). Finisher spells spend it for bonus damage or block.',
    type: 'buff',
    icon: '🔷',
    stacks: true
  });

  // Skill engine: each Skill you play banks Arcane Charge.
  DS.defineStatus({
    id: 'ar_st_resonance',
    name: 'Resonance',
    desc: 'Whenever you play a Skill, gain {n} Arcane Charge.',
    type: 'buff',
    icon: '📿',
    stacks: true,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'apply', status: 'ar_arcane_charge', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // Attack engine: each Attack you play banks Arcane Charge.
  DS.defineStatus({
    id: 'ar_st_attunement',
    name: 'Attunement',
    desc: 'Whenever you play an Attack, gain {n} Arcane Charge.',
    type: 'buff',
    icon: '🎵',
    stacks: true,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [{ op: 'apply', status: 'ar_arcane_charge', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // Draw engine: extra cards every turn.
  DS.defineStatus({
    id: 'ar_st_scholars_insight',
    name: 'Scholar’s Insight',
    desc: 'At the start of each turn, draw {n} card(s).',
    type: 'buff',
    icon: '📚',
    stacks: true,
    triggers: {
      onTurnStart: [{ op: 'draw', amount: { v: 'stacks' } }]
    }
  });

  // Energy engine: extra energy every turn.
  DS.defineStatus({
    id: 'ar_st_mana_spring',
    name: 'Mana Spring',
    desc: 'At the start of each turn, gain {n} Energy.',
    type: 'buff',
    icon: '⛲',
    stacks: true,
    triggers: {
      onTurnStart: [{ op: 'energy', amount: { v: 'stacks' } }]
    }
  });

  // Fire engine: burns every enemy at the end of each of your turns.
  DS.defineStatus({
    id: 'ar_st_burning_hymn',
    name: 'Burning Hymn',
    desc: 'At the end of each turn, deal {n} damage to ALL enemies.',
    type: 'buff',
    icon: '🎼',
    stacks: true,
    triggers: {
      onTurnEnd: [{ op: 'damage', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  // Exhaust engine: exhausting cards sets every enemy alight.
  DS.defineStatus({
    id: 'ar_st_pyre_heart',
    name: 'Pyre Heart',
    desc: 'Whenever you Exhaust a card, apply {n} Burn to ALL enemies.',
    type: 'buff',
    icon: '♨️',
    stacks: true,
    triggers: {
      onCardExhausted: [{ op: 'apply', status: 'burn', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  // Frost engine: anything that hits you chills the attacker.
  DS.defineStatus({
    id: 'ar_st_frost_mantle',
    name: 'Frost Mantle',
    desc: 'Whenever you are attacked, apply {n} Chill to the attacker.',
    type: 'buff',
    icon: '🧣',
    stacks: true,
    triggers: {
      onAttacked: [{ op: 'apply', status: 'ar_chill', amount: { v: 'stacks' }, to: 'target' }]
    }
  });

  // Frost engine: gaining Block chills a random enemy.
  DS.defineStatus({
    id: 'ar_st_glacial_ward',
    name: 'Glacial Ward',
    desc: 'Whenever you gain Block, apply {n} Chill to a random enemy.',
    type: 'buff',
    icon: '💠',
    stacks: true,
    triggers: {
      onBlockGained: [{ op: 'apply', status: 'ar_chill', amount: { v: 'stacks' }, to: 'random_enemy' }]
    }
  });

  // Fire engine: every Skill you play pricks a random enemy.
  DS.defineStatus({
    id: 'ar_st_kindling_gaze',
    name: 'Kindling Gaze',
    desc: 'Whenever you play a Skill, deal {n} damage to a random enemy.',
    type: 'buff',
    icon: '👁️',
    stacks: true,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
      }
    }
  });

  // Mana engine: a free random Arcane card every turn.
  DS.defineStatus({
    id: 'ar_st_wild_magic',
    name: 'Wild Magic',
    desc: 'At the start of each turn, add {n} random Arcane card(s) to your hand.',
    type: 'buff',
    icon: '🎲',
    stacks: true,
    triggers: {
      onTurnStart: [{ op: 'add_card', card: 'random', class: 'arcanist', to: 'hand', amount: { v: 'stacks' } }]
    }
  });

  // Sustain engine: kills heal you.
  DS.defineStatus({
    id: 'ar_st_soul_siphon',
    name: 'Soul Siphon',
    desc: 'Whenever you kill an enemy, heal {n} HP.',
    type: 'buff',
    icon: '💜',
    stacks: true,
    triggers: {
      onKill: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Enemy debuff: Chill blunts an enemy's attacks and fades each turn. Shatter spells consume it.
  DS.defineStatus({
    id: 'ar_chill',
    name: 'Chill',
    desc: 'Deals 1 less damage per stack ({n} now). Loses 1 stack at the end of its turn.',
    type: 'debuff',
    icon: '🥶',
    stacks: true,
    decay: 'turn_end',
    mods: { attackDealtAdd: -1 }
  });

  // ===========================================================================
  // STARTER CARDS (4 kinds; the starter deck uses 4 Strikes, 4 Defends, 2 signatures)
  // ===========================================================================
  DS.defineCard({
    id: 'ar_strike', name: 'Arcane Strike', class: 'arcanist', type: 'attack', rarity: 'starter',
    cost: 1, target: 'enemy', icon: '🪄',
    desc: 'Deal 6 damage.',
    effects: [{ op: 'damage', amount: 6 }],
    upgrade: { desc: 'Deal 9 damage.', effects: [{ op: 'damage', amount: 9 }] }
  });

  DS.defineCard({
    id: 'ar_defend', name: 'Mage Ward', class: 'arcanist', type: 'skill', rarity: 'starter',
    cost: 1, target: 'self', icon: '🛡️',
    desc: 'Gain 5 Block.',
    effects: [{ op: 'block', amount: 5 }],
    upgrade: { desc: 'Gain 8 Block.', effects: [{ op: 'block', amount: 8 }] }
  });

  DS.defineCard({
    id: 'ar_kindling_bolt', name: 'Kindling Bolt', class: 'arcanist', type: 'attack', rarity: 'starter',
    cost: 1, target: 'enemy', icon: '🔥',
    desc: 'Deal 4 damage. Apply 2 Burn.',
    effects: [
      { op: 'damage', amount: 4 },
      { op: 'apply', status: 'burn', amount: 2, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 5 damage. Apply 3 Burn.',
      effects: [
        { op: 'damage', amount: 5 },
        { op: 'apply', status: 'burn', amount: 3, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_focus_rune', name: 'Focus Rune', class: 'arcanist', type: 'skill', rarity: 'starter',
    cost: 1, target: 'self', icon: '🔷',
    desc: 'Gain 2 Arcane Charge.',
    effects: [{ op: 'apply', status: 'ar_arcane_charge', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Arcane Charge.',
      effects: [{ op: 'apply', status: 'ar_arcane_charge', amount: 3, to: 'self' }]
    }
  });

  // ===========================================================================
  // COMMON ATTACKS (10)
  // ===========================================================================
  DS.defineCard({
    id: 'ar_arc_bolt', name: 'Arc Bolt', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '⚡',
    desc: 'Deal 8 damage.',
    effects: [{ op: 'damage', amount: 8 }],
    upgrade: { desc: 'Deal 11 damage.', effects: [{ op: 'damage', amount: 11 }] }
  });

  DS.defineCard({
    id: 'ar_ember_lash', name: 'Ember Lash', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🔥',
    desc: 'Deal 6 damage. Apply 2 Burn.',
    effects: [
      { op: 'damage', amount: 6 },
      { op: 'apply', status: 'burn', amount: 2, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 8 damage. Apply 3 Burn.',
      effects: [
        { op: 'damage', amount: 8 },
        { op: 'apply', status: 'burn', amount: 3, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_frost_lance', name: 'Frost Lance', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🧊',
    desc: 'Deal 7 damage. Apply 1 Chill.',
    effects: [
      { op: 'damage', amount: 7 },
      { op: 'apply', status: 'ar_chill', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 9 damage. Apply 2 Chill.',
      effects: [
        { op: 'damage', amount: 9 },
        { op: 'apply', status: 'ar_chill', amount: 2, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_spark_jab', name: 'Spark Jab', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '✴️',
    desc: 'Deal 3 damage. Gain 1 Arcane Charge.',
    effects: [
      { op: 'damage', amount: 3 },
      { op: 'apply', status: 'ar_arcane_charge', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 4 damage. Gain 2 Arcane Charge.',
      effects: [
        { op: 'damage', amount: 4 },
        { op: 'apply', status: 'ar_arcane_charge', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_glyph_cut', name: 'Glyph Cut', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '✂️',
    desc: 'Deal 7 damage. If the target has Burn, draw 1 card.',
    effects: [
      { op: 'damage', amount: 7 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'burn', of: 'target' }, cmp: '>=', right: 1 },
        then: [{ op: 'draw', amount: 1 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 9 damage. If the target has Burn, draw 2 cards.',
      effects: [
        { op: 'damage', amount: 9 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'burn', of: 'target' }, cmp: '>=', right: 1 },
          then: [{ op: 'draw', amount: 2 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_twin_sparks', name: 'Twin Sparks', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '✨',
    desc: 'Deal 4 damage 2 times.',
    effects: [{ op: 'damage', amount: 4, times: 2 }],
    upgrade: { desc: 'Deal 5 damage 2 times.', effects: [{ op: 'damage', amount: 5, times: 2 }] }
  });

  DS.defineCard({
    id: 'ar_cinder_gust', name: 'Cinder Gust', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '💨',
    desc: 'Deal 4 damage to ALL enemies. Apply 1 Burn to ALL enemies.',
    effects: [
      { op: 'damage', amount: 4, to: 'all_enemies' },
      { op: 'apply', status: 'burn', amount: 1, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 6 damage to ALL enemies. Apply 2 Burn to ALL enemies.',
      effects: [
        { op: 'damage', amount: 6, to: 'all_enemies' },
        { op: 'apply', status: 'burn', amount: 2, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_cold_snap', name: 'Cold Snap', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🥶',
    desc: 'Deal 5 damage. Apply 1 Weak.',
    effects: [
      { op: 'damage', amount: 5 },
      { op: 'apply', status: 'weak', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 7 damage. Apply 2 Weak.',
      effects: [
        { op: 'damage', amount: 7 },
        { op: 'apply', status: 'weak', amount: 2, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_arc_flick', name: 'Arc Flick', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '💫',
    desc: 'Deal 4 damage.',
    effects: [{ op: 'damage', amount: 4 }],
    upgrade: { desc: 'Deal 5 damage.', effects: [{ op: 'damage', amount: 5 }] }
  });

  DS.defineCard({
    id: 'ar_scorch_bolt', name: 'Scorch Bolt', class: 'arcanist', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🌶️',
    desc: 'Deal 8 damage. If the target has Burn, deal 5 more damage.',
    effects: [
      { op: 'damage', amount: 8 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'burn', of: 'target' }, cmp: '>=', right: 1 },
        then: [{ op: 'damage', amount: 5 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 10 damage. If the target has Burn, deal 7 more damage.',
      effects: [
        { op: 'damage', amount: 10 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'burn', of: 'target' }, cmp: '>=', right: 1 },
          then: [{ op: 'damage', amount: 7 }],
          else: []
        }
      ]
    }
  });

  // ===========================================================================
  // COMMON SKILLS (10)
  // ===========================================================================
  DS.defineCard({
    id: 'ar_glass_ward', name: 'Glass Ward', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🪟', innate: true,
    desc: 'Innate. Gain 6 Block. Gain 1 Arcane Charge.',
    effects: [
      { op: 'block', amount: 6 },
      { op: 'apply', status: 'ar_arcane_charge', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Innate. Gain 8 Block. Gain 2 Arcane Charge.',
      effects: [
        { op: 'block', amount: 8 },
        { op: 'apply', status: 'ar_arcane_charge', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_quick_study', name: 'Quick Study', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 0, target: 'none', icon: '📖', exhaust: true,
    desc: 'Draw 2 cards. Exhaust.',
    effects: [{ op: 'draw', amount: 2 }],
    upgrade: { desc: 'Draw 3 cards. Exhaust.', effects: [{ op: 'draw', amount: 3 }] }
  });

  DS.defineCard({
    id: 'ar_gather_light', name: 'Gather Light', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '💡',
    desc: 'Gain 3 Arcane Charge.',
    effects: [{ op: 'apply', status: 'ar_arcane_charge', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Gain 4 Arcane Charge.',
      effects: [{ op: 'apply', status: 'ar_arcane_charge', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_frost_veil', name: 'Frost Veil', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'none', icon: '❄️',
    desc: 'Gain 5 Block. Apply 1 Weak to a random enemy.',
    effects: [
      { op: 'block', amount: 5, to: 'self' },
      { op: 'apply', status: 'weak', amount: 1, to: 'random_enemy' }
    ],
    upgrade: {
      desc: 'Gain 7 Block. Apply 2 Weak to a random enemy.',
      effects: [
        { op: 'block', amount: 7, to: 'self' },
        { op: 'apply', status: 'weak', amount: 2, to: 'random_enemy' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_ember_ward', name: 'Ember Ward', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'none', icon: '🧯',
    desc: 'Gain 4 Block. Apply 1 Burn to a random enemy.',
    effects: [
      { op: 'block', amount: 4, to: 'self' },
      { op: 'apply', status: 'burn', amount: 1, to: 'random_enemy' }
    ],
    upgrade: {
      desc: 'Gain 6 Block. Apply 2 Burn to a random enemy.',
      effects: [
        { op: 'block', amount: 6, to: 'self' },
        { op: 'apply', status: 'burn', amount: 2, to: 'random_enemy' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_mirror_shield', name: 'Mirror Shield', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🪞',
    desc: 'Gain 5 Block. If you have 5 or more Arcane Charge, gain 3 more Block.',
    effects: [
      { op: 'block', amount: 5, to: 'self' },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'ar_arcane_charge', of: 'self' }, cmp: '>=', right: 5 },
        then: [{ op: 'block', amount: 3, to: 'self' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Gain 6 Block. If you have 5 or more Arcane Charge, gain 4 more Block.',
      effects: [
        { op: 'block', amount: 6, to: 'self' },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'ar_arcane_charge', of: 'self' }, cmp: '>=', right: 5 },
          then: [{ op: 'block', amount: 4, to: 'self' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_cold_breath', name: 'Cold Breath', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🌬️',
    desc: 'Apply 2 Weak to the target. Gain 3 Block.',
    effects: [
      { op: 'apply', status: 'weak', amount: 2, to: 'target' },
      { op: 'block', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Apply 3 Weak to the target. Gain 5 Block.',
      effects: [
        { op: 'apply', status: 'weak', amount: 3, to: 'target' },
        { op: 'block', amount: 5, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_mana_tap', name: 'Mana Tap', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🔋', exhaust: true,
    desc: 'Gain 1 Energy. Exhaust.',
    effects: [{ op: 'energy', amount: 1 }],
    upgrade: { desc: 'Gain 2 Energy. Exhaust.', effects: [{ op: 'energy', amount: 2 }] }
  });

  DS.defineCard({
    id: 'ar_candle_thought', name: 'Candle Thought', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'none', icon: '🕯️',
    desc: 'Draw 2 cards, then discard 1 card.',
    effects: [
      { op: 'draw', amount: 2 },
      { op: 'discard', amount: 1 }
    ],
    upgrade: {
      desc: 'Draw 3 cards, then discard 1 card.',
      effects: [
        { op: 'draw', amount: 3 },
        { op: 'discard', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_rune_scribe', name: 'Rune Scribe', class: 'arcanist', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🖋️',
    desc: 'Gain 3 Block. Add 1 Frost Rune to your draw pile.',
    effects: [
      { op: 'block', amount: 3, to: 'self' },
      { op: 'add_card', card: 'ar_frost_rune', to: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Gain 4 Block. Add 2 Frost Runes to your draw pile.',
      effects: [
        { op: 'block', amount: 4, to: 'self' },
        { op: 'add_card', card: 'ar_frost_rune', to: 'draw', amount: 2 }
      ]
    }
  });

  // ===========================================================================
  // COMMON POWERS (4)
  // ===========================================================================
  DS.defineCard({
    id: 'ar_resonance', name: 'Arcane Resonance', class: 'arcanist', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '📿',
    desc: 'Whenever you play a Skill, gain 1 Arcane Charge.',
    effects: [{ op: 'apply', status: 'ar_st_resonance', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play a Skill, gain 2 Arcane Charge.',
      effects: [{ op: 'apply', status: 'ar_st_resonance', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_hearthstone_ward', name: 'Hearthstone Ward', class: 'arcanist', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🪨',
    desc: 'At the end of each turn, gain 2 Block.',
    effects: [{ op: 'apply', status: 'metallicize', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'At the end of each turn, gain 3 Block.',
      effects: [{ op: 'apply', status: 'metallicize', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_crystal_lattice', name: 'Crystal Lattice', class: 'arcanist', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '💎',
    desc: 'Gain 2 Dexterity.',
    effects: [{ op: 'apply', status: 'dexterity', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Dexterity.',
      effects: [{ op: 'apply', status: 'dexterity', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_ember_mantle', name: 'Ember Mantle', class: 'arcanist', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🧥',
    desc: 'Whenever you are attacked, deal 2 damage to the attacker.',
    effects: [{ op: 'apply', status: 'thorns', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you are attacked, deal 3 damage to the attacker.',
      effects: [{ op: 'apply', status: 'thorns', amount: 3, to: 'self' }]
    }
  });

  // ===========================================================================
  // UNCOMMON ATTACKS (12)
  // ===========================================================================
  DS.defineCard({
    id: 'ar_ember_storm', name: 'Ember Storm', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🌋',
    desc: 'Deal 8 damage to ALL enemies. Apply 3 Burn to ALL enemies.',
    effects: [
      { op: 'damage', amount: 8, to: 'all_enemies' },
      { op: 'apply', status: 'burn', amount: 3, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 11 damage to ALL enemies. Apply 4 Burn to ALL enemies.',
      effects: [
        { op: 'damage', amount: 11, to: 'all_enemies' },
        { op: 'apply', status: 'burn', amount: 4, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_shatter_ice', name: 'Shatter Ice', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '💠',
    desc: 'Deal 4 damage, plus 3 for each Chill on the target. Remove all Chill from the target.',
    effects: [
      { op: 'damage', amount: { v: 'status', status: 'ar_chill', of: 'target', mul: 3, add: 4 } },
      { op: 'remove_status', status: 'ar_chill', to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 6 damage, plus 3 for each Chill on the target. Remove all Chill from the target.',
      effects: [
        { op: 'damage', amount: { v: 'status', status: 'ar_chill', of: 'target', mul: 3, add: 6 } },
        { op: 'remove_status', status: 'ar_chill', to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_cinder_feast', name: 'Cinder Feast', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🍖',
    desc: 'Deal 3 damage, plus 2 for each Burn on the target. Remove all Burn from the target.',
    effects: [
      { op: 'damage', amount: { v: 'status', status: 'burn', of: 'target', mul: 2, add: 3 } },
      { op: 'remove_status', status: 'burn', to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 4 damage, plus 3 for each Burn on the target. Remove all Burn from the target.',
      effects: [
        { op: 'damage', amount: { v: 'status', status: 'burn', of: 'target', mul: 3, add: 4 } },
        { op: 'remove_status', status: 'burn', to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_thunderclap', name: 'Thunderclap', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '⛈️',
    desc: 'Deal 6 damage to ALL enemies. Gain 2 Arcane Charge.',
    effects: [
      { op: 'damage', amount: 6, to: 'all_enemies' },
      { op: 'apply', status: 'ar_arcane_charge', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 8 damage to ALL enemies. Gain 3 Arcane Charge.',
      effects: [
        { op: 'damage', amount: 8, to: 'all_enemies' },
        { op: 'apply', status: 'ar_arcane_charge', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_charged_bolt', name: 'Charged Bolt', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🌟',
    desc: 'Deal 4 damage, plus 2 for each Arcane Charge you have.',
    effects: [
      { op: 'damage', amount: { v: 'status', status: 'ar_arcane_charge', of: 'self', mul: 2, add: 4 } }
    ],
    upgrade: {
      desc: 'Deal 5 damage, plus 3 for each Arcane Charge you have.',
      effects: [
        { op: 'damage', amount: { v: 'status', status: 'ar_arcane_charge', of: 'self', mul: 3, add: 5 } }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_chain_spark', name: 'Chain Spark', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'random_enemy', icon: '🔗',
    desc: 'Deal 3 damage to a random enemy 3 times.',
    effects: [{ op: 'damage', amount: 3, times: 3, to: 'random_enemy' }],
    upgrade: {
      desc: 'Deal 4 damage to a random enemy 3 times.',
      effects: [{ op: 'damage', amount: 4, times: 3, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'ar_frostbite_rend', name: 'Frostbite Rend', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🌨️',
    desc: 'Deal 10 damage. Apply 2 Chill to the target.',
    effects: [
      { op: 'damage', amount: 10 },
      { op: 'apply', status: 'ar_chill', amount: 2, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 13 damage. Apply 3 Chill to the target.',
      effects: [
        { op: 'damage', amount: 13 },
        { op: 'apply', status: 'ar_chill', amount: 3, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_hailstorm', name: 'Hailstorm', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '☃️',
    desc: 'Deal 6 damage to ALL enemies. Apply 2 Chill to ALL enemies.',
    effects: [
      { op: 'damage', amount: 6, to: 'all_enemies' },
      { op: 'apply', status: 'ar_chill', amount: 2, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 8 damage to ALL enemies. Apply 3 Chill to ALL enemies.',
      effects: [
        { op: 'damage', amount: 8, to: 'all_enemies' },
        { op: 'apply', status: 'ar_chill', amount: 3, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_arcane_sweep', name: 'Arcane Sweep', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '🌀',
    desc: 'Deal 3 damage to ALL enemies 2 times.',
    effects: [{ op: 'damage', amount: 3, times: 2, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 4 damage to ALL enemies 2 times.',
      effects: [{ op: 'damage', amount: 4, times: 2, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'ar_overcharge_bolt', name: 'Overcharge Bolt', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 'X', target: 'enemy', icon: '🌩️',
    desc: 'Spend all your Energy. Deal 4 damage per Energy spent.',
    effects: [{ op: 'damage', amount: { v: 'x', mul: 4 } }],
    upgrade: {
      desc: 'Spend all your Energy. Deal 5 damage per Energy spent.',
      effects: [{ op: 'damage', amount: { v: 'x', mul: 5 } }]
    }
  });

  DS.defineCard({
    id: 'ar_glass_spear', name: 'Glass Spear', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🔱',
    desc: 'Deal 6 damage. Gain 3 Block.',
    effects: [
      { op: 'damage', amount: 6 },
      { op: 'block', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 8 damage. Gain 4 Block.',
      effects: [
        { op: 'damage', amount: 8 },
        { op: 'block', amount: 4, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_arcane_barrage', name: 'Arcane Barrage', class: 'arcanist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🎆',
    desc: 'Deal 3 damage 4 times.',
    effects: [{ op: 'damage', amount: 3, times: 4 }],
    upgrade: { desc: 'Deal 4 damage 4 times.', effects: [{ op: 'damage', amount: 4, times: 4 }] }
  });

  // ===========================================================================
  // UNCOMMON SKILLS (12)
  // ===========================================================================
  DS.defineCard({
    id: 'ar_mana_siphon', name: 'Mana Siphon', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🫙', exhaust: true,
    desc: 'Gain 2 Arcane Charge. Exhaust.',
    effects: [{ op: 'apply', status: 'ar_arcane_charge', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Arcane Charge. Exhaust.',
      effects: [{ op: 'apply', status: 'ar_arcane_charge', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_conjure_ember', name: 'Conjure Ember', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🎇',
    desc: 'Add 2 Ember Sparks to your hand.',
    effects: [{ op: 'add_card', card: 'ar_ember_spark', to: 'hand', amount: 2 }],
    upgrade: {
      desc: 'Add 3 Ember Sparks to your hand.',
      effects: [{ op: 'add_card', card: 'ar_ember_spark', to: 'hand', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'ar_summon_wisp', name: 'Summon Wisps', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🌠',
    desc: 'Add 2 Arcane Wisps to your hand.',
    effects: [{ op: 'add_card', card: 'ar_arcane_wisp', to: 'hand', amount: 2 }],
    upgrade: {
      cost: 0,
      desc: 'Add 2 Arcane Wisps to your hand.',
      effects: [{ op: 'add_card', card: 'ar_arcane_wisp', to: 'hand', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'ar_cold_study', name: 'Cold Study', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🧐',
    desc: 'Apply 2 Weak to the target. If the target has Chill, draw 2 cards.',
    effects: [
      { op: 'apply', status: 'weak', amount: 2, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'ar_chill', of: 'target' }, cmp: '>=', right: 1 },
        then: [{ op: 'draw', amount: 2 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Apply 3 Weak to the target. If the target has Chill, draw 3 cards.',
      effects: [
        { op: 'apply', status: 'weak', amount: 3, to: 'target' },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'ar_chill', of: 'target' }, cmp: '>=', right: 1 },
          then: [{ op: 'draw', amount: 3 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_pyre_ritual', name: 'Pyre Ritual', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '⚗️',
    desc: 'Exhaust 1 card in your hand. Gain 3 Arcane Charge.',
    effects: [
      { op: 'exhaust', amount: 1 },
      { op: 'apply', status: 'ar_arcane_charge', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Exhaust 1 card in your hand. Gain 4 Arcane Charge.',
      effects: [
        { op: 'exhaust', amount: 1 },
        { op: 'apply', status: 'ar_arcane_charge', amount: 4, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_glacier_bulwark', name: 'Glacier Bulwark', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'none', icon: '🏔️',
    desc: 'Gain 9 Block. Apply 2 Chill to ALL enemies.',
    effects: [
      { op: 'block', amount: 9, to: 'self' },
      { op: 'apply', status: 'ar_chill', amount: 2, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Gain 12 Block. Apply 3 Chill to ALL enemies.',
      effects: [
        { op: 'block', amount: 12, to: 'self' },
        { op: 'apply', status: 'ar_chill', amount: 3, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_arcane_intuition', name: 'Arcane Intuition', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🧠',
    desc: 'Draw 2 cards. Gain 1 Arcane Charge.',
    effects: [
      { op: 'draw', amount: 2 },
      { op: 'apply', status: 'ar_arcane_charge', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Draw 3 cards. Gain 1 Arcane Charge.',
      effects: [
        { op: 'draw', amount: 3 },
        { op: 'apply', status: 'ar_arcane_charge', amount: 1, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_arcane_aegis', name: 'Arcane Aegis', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪬',
    desc: 'Gain 2 Block for each Arcane Charge you have. Remove all Arcane Charge.',
    effects: [
      { op: 'block', amount: { v: 'status', status: 'ar_arcane_charge', of: 'self', mul: 2 }, to: 'self' },
      { op: 'remove_status', status: 'ar_arcane_charge', to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 3 Block for each Arcane Charge you have. Remove all Arcane Charge.',
      effects: [
        { op: 'block', amount: { v: 'status', status: 'ar_arcane_charge', of: 'self', mul: 3 }, to: 'self' },
        { op: 'remove_status', status: 'ar_arcane_charge', to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_mana_vial', name: 'Mana Vial', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧪', exhaust: true,
    desc: 'Gain 2 Energy. Exhaust.',
    effects: [{ op: 'energy', amount: 2 }],
    upgrade: { cost: 0, desc: 'Gain 2 Energy. Exhaust.', effects: [{ op: 'energy', amount: 2 }] }
  });

  DS.defineCard({
    id: 'ar_rune_draft', name: 'Rune Draft', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔖',
    desc: 'Add 1 Frost Rune to your hand and 1 Ember Spark to your draw pile.',
    effects: [
      { op: 'add_card', card: 'ar_frost_rune', to: 'hand', amount: 1 },
      { op: 'add_card', card: 'ar_ember_spark', to: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Add 2 Frost Runes to your hand and 1 Ember Spark to your draw pile.',
      effects: [
        { op: 'add_card', card: 'ar_frost_rune', to: 'hand', amount: 2 },
        { op: 'add_card', card: 'ar_ember_spark', to: 'draw', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_hex_mark', name: 'Hex Mark', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🎯',
    desc: 'Apply 3 Chill to the target. Draw 1 card.',
    effects: [
      { op: 'apply', status: 'ar_chill', amount: 3, to: 'target' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Apply 4 Chill to the target. Draw 1 card.',
      effects: [
        { op: 'apply', status: 'ar_chill', amount: 4, to: 'target' },
        { op: 'draw', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_spell_tithe', name: 'Spell Tithe', class: 'arcanist', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🪙',
    desc: 'Lose 3 HP. Gain 4 Arcane Charge.',
    effects: [
      { op: 'lose_hp', amount: 3, to: 'self' },
      { op: 'apply', status: 'ar_arcane_charge', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Lose 2 HP. Gain 5 Arcane Charge.',
      effects: [
        { op: 'lose_hp', amount: 2, to: 'self' },
        { op: 'apply', status: 'ar_arcane_charge', amount: 5, to: 'self' }
      ]
    }
  });

  // ===========================================================================
  // UNCOMMON POWERS (6)
  // ===========================================================================
  DS.defineCard({
    id: 'ar_attunement', name: 'Attunement', class: 'arcanist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🎵',
    desc: 'Whenever you play an Attack, gain 1 Arcane Charge.',
    effects: [{ op: 'apply', status: 'ar_st_attunement', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play an Attack, gain 2 Arcane Charge.',
      effects: [{ op: 'apply', status: 'ar_st_attunement', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_scholars_insight', name: 'Scholar’s Insight', class: 'arcanist', type: 'power', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '📚',
    desc: 'At the start of each turn, draw 1 card.',
    effects: [{ op: 'apply', status: 'ar_st_scholars_insight', amount: 1, to: 'self' }],
    upgrade: {
      cost: 1,
      desc: 'At the start of each turn, draw 1 card.',
      effects: [{ op: 'apply', status: 'ar_st_scholars_insight', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_burning_hymn', name: 'Burning Hymn', class: 'arcanist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🎼',
    desc: 'At the end of each turn, deal 3 damage to ALL enemies.',
    effects: [{ op: 'apply', status: 'ar_st_burning_hymn', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'At the end of each turn, deal 4 damage to ALL enemies.',
      effects: [{ op: 'apply', status: 'ar_st_burning_hymn', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_pyre_heart', name: 'Pyre Heart', class: 'arcanist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '♨️',
    desc: 'Whenever you Exhaust a card, apply 2 Burn to ALL enemies.',
    effects: [{ op: 'apply', status: 'ar_st_pyre_heart', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you Exhaust a card, apply 3 Burn to ALL enemies.',
      effects: [{ op: 'apply', status: 'ar_st_pyre_heart', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_frost_mantle', name: 'Frost Mantle', class: 'arcanist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧣',
    desc: 'Whenever you are attacked, apply 1 Chill to the attacker.',
    effects: [{ op: 'apply', status: 'ar_st_frost_mantle', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you are attacked, apply 2 Chill to the attacker.',
      effects: [{ op: 'apply', status: 'ar_st_frost_mantle', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_kindling_gaze', name: 'Kindling Gaze', class: 'arcanist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '👁️',
    desc: 'Whenever you play a Skill, deal 2 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'ar_st_kindling_gaze', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play a Skill, deal 3 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'ar_st_kindling_gaze', amount: 3, to: 'self' }]
    }
  });

  // ===========================================================================
  // RARE ATTACKS (6)
  // ===========================================================================
  DS.defineCard({
    id: 'ar_arcane_finale', name: 'Arcane Finale', class: 'arcanist', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '💥',
    desc: 'Deal 8 damage, plus 5 for each Arcane Charge you have. Spend all Arcane Charge.',
    effects: [
      { op: 'damage', amount: { v: 'status', status: 'ar_arcane_charge', of: 'self', mul: 5, add: 8 } },
      { op: 'remove_status', status: 'ar_arcane_charge', to: 'self' }
    ],
    upgrade: {
      cost: 1,
      desc: 'Deal 10 damage, plus 6 for each Arcane Charge you have. Spend all Arcane Charge.',
      effects: [
        { op: 'damage', amount: { v: 'status', status: 'ar_arcane_charge', of: 'self', mul: 6, add: 10 } },
        { op: 'remove_status', status: 'ar_arcane_charge', to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_meteor_rain', name: 'Meteor Rain', class: 'arcanist', type: 'attack', rarity: 'rare',
    cost: 3, target: 'all_enemies', icon: '☄️',
    desc: 'Deal 12 damage to ALL enemies. Apply 3 Burn to ALL enemies.',
    effects: [
      { op: 'damage', amount: 12, to: 'all_enemies' },
      { op: 'apply', status: 'burn', amount: 3, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 15 damage to ALL enemies. Apply 4 Burn to ALL enemies.',
      effects: [
        { op: 'damage', amount: 15, to: 'all_enemies' },
        { op: 'apply', status: 'burn', amount: 4, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_absolute_zero', name: 'Absolute Zero', class: 'arcanist', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🌌',
    desc: 'Deal 8 damage. Apply 4 Chill and 1 Weak to the target.',
    effects: [
      { op: 'damage', amount: 8 },
      { op: 'apply', status: 'ar_chill', amount: 4, to: 'target' },
      { op: 'apply', status: 'weak', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 10 damage. Apply 5 Chill and 2 Weak to the target.',
      effects: [
        { op: 'damage', amount: 10 },
        { op: 'apply', status: 'ar_chill', amount: 5, to: 'target' },
        { op: 'apply', status: 'weak', amount: 2, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_prism_lance', name: 'Prism Lance', class: 'arcanist', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🔺',
    desc: 'Deal 3 damage 5 times.',
    effects: [{ op: 'damage', amount: 3, times: 5 }],
    upgrade: { desc: 'Deal 4 damage 5 times.', effects: [{ op: 'damage', amount: 4, times: 5 }] }
  });

  DS.defineCard({
    id: 'ar_maelstrom', name: 'Maelstrom of Embers', class: 'arcanist', type: 'attack', rarity: 'rare',
    cost: 'X', target: 'all_enemies', icon: '🌪️',
    desc: 'Spend all your Energy. Deal 3 damage per Energy spent to ALL enemies.',
    effects: [{ op: 'damage', amount: { v: 'x', mul: 3 }, to: 'all_enemies' }],
    upgrade: {
      desc: 'Spend all your Energy. Deal 4 damage per Energy spent to ALL enemies.',
      effects: [{ op: 'damage', amount: { v: 'x', mul: 4 }, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'ar_ruinous_glyph', name: 'Ruinous Glyph', class: 'arcanist', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🔻',
    desc: 'Deal 9 damage. If the target has Burn, deal 9 more damage.',
    effects: [
      { op: 'damage', amount: 9 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'burn', of: 'target' }, cmp: '>=', right: 1 },
        then: [{ op: 'damage', amount: 9 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 11 damage. If the target has Burn, deal 11 more damage.',
      effects: [
        { op: 'damage', amount: 11 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'burn', of: 'target' }, cmp: '>=', right: 1 },
          then: [{ op: 'damage', amount: 11 }],
          else: []
        }
      ]
    }
  });

  // ===========================================================================
  // RARE SKILLS (6)
  // ===========================================================================
  DS.defineCard({
    id: 'ar_lingering_glyph', name: 'Lingering Glyph', class: 'arcanist', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '📜', retain: true,
    desc: 'Gain 6 Block. Gain 2 Arcane Charge. Retain.',
    effects: [
      { op: 'block', amount: 6, to: 'self' },
      { op: 'apply', status: 'ar_arcane_charge', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 8 Block. Gain 3 Arcane Charge. Retain.',
      effects: [
        { op: 'block', amount: 8, to: 'self' },
        { op: 'apply', status: 'ar_arcane_charge', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_font_of_mana', name: 'Font of Mana', class: 'arcanist', type: 'skill', rarity: 'rare',
    cost: 1, target: 'none', icon: '🌊', exhaust: true,
    desc: 'Gain 2 Energy. Draw 2 cards. Exhaust.',
    effects: [
      { op: 'energy', amount: 2 },
      { op: 'draw', amount: 2 }
    ],
    upgrade: {
      desc: 'Gain 3 Energy. Draw 3 cards. Exhaust.',
      effects: [
        { op: 'energy', amount: 3 },
        { op: 'draw', amount: 3 }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_phantom_ward', name: 'Phantom Ward', class: 'arcanist', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '👻', ethereal: true,
    desc: 'Gain 12 Block. Ethereal.',
    effects: [{ op: 'block', amount: 12, to: 'self' }],
    upgrade: { ethereal: false, desc: 'Gain 15 Block.', effects: [{ op: 'block', amount: 15, to: 'self' }] }
  });

  DS.defineCard({
    id: 'ar_mind_palace', name: 'Mind Palace', class: 'arcanist', type: 'skill', rarity: 'rare',
    cost: 2, target: 'none', icon: '🏛️',
    desc: 'Draw 4 cards.',
    effects: [{ op: 'draw', amount: 4 }],
    upgrade: { desc: 'Draw 5 cards.', effects: [{ op: 'draw', amount: 5 }] }
  });

  DS.defineCard({
    id: 'ar_burnt_offering', name: 'Burnt Offering', class: 'arcanist', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🍂',
    desc: 'Exhaust 2 cards in your hand. Gain 6 Block and 4 Arcane Charge.',
    effects: [
      { op: 'exhaust', amount: 2 },
      { op: 'block', amount: 6, to: 'self' },
      { op: 'apply', status: 'ar_arcane_charge', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Exhaust 2 cards in your hand. Gain 8 Block and 5 Arcane Charge.',
      effects: [
        { op: 'exhaust', amount: 2 },
        { op: 'block', amount: 8, to: 'self' },
        { op: 'apply', status: 'ar_arcane_charge', amount: 5, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'ar_arcane_cascade', name: 'Arcane Cascade', class: 'arcanist', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🌈',
    desc: 'Add 2 random Arcane Skills to your hand.',
    effects: [{ op: 'add_card', card: 'random', class: 'arcanist', type: 'skill', to: 'hand', amount: 2 }],
    upgrade: {
      desc: 'Add 3 random Arcane Skills to your hand.',
      effects: [{ op: 'add_card', card: 'random', class: 'arcanist', type: 'skill', to: 'hand', amount: 3 }]
    }
  });

  // ===========================================================================
  // RARE POWERS (4)
  // ===========================================================================
  DS.defineCard({
    id: 'ar_mana_spring', name: 'Mana Spring', class: 'arcanist', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '⛲',
    desc: 'At the start of each turn, gain 1 Energy.',
    effects: [{ op: 'apply', status: 'ar_st_mana_spring', amount: 1, to: 'self' }],
    upgrade: {
      cost: 1,
      desc: 'At the start of each turn, gain 1 Energy.',
      effects: [{ op: 'apply', status: 'ar_st_mana_spring', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_wild_magic', name: 'Wild Magic', class: 'arcanist', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🎲',
    desc: 'At the start of each turn, add 1 random Arcane card to your hand.',
    effects: [{ op: 'apply', status: 'ar_st_wild_magic', amount: 1, to: 'self' }],
    upgrade: {
      cost: 1,
      desc: 'At the start of each turn, add 1 random Arcane card to your hand.',
      effects: [{ op: 'apply', status: 'ar_st_wild_magic', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_glacial_ward', name: 'Glacial Ward', class: 'arcanist', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '💠',
    desc: 'Whenever you gain Block, apply 1 Chill to a random enemy.',
    effects: [{ op: 'apply', status: 'ar_st_glacial_ward', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you gain Block, apply 2 Chill to a random enemy.',
      effects: [{ op: 'apply', status: 'ar_st_glacial_ward', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_soul_siphon', name: 'Soul Siphon', class: 'arcanist', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '💜',
    desc: 'Whenever you kill an enemy, heal 4 HP.',
    effects: [{ op: 'apply', status: 'ar_st_soul_siphon', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Whenever you kill an enemy, heal 6 HP.',
      effects: [{ op: 'apply', status: 'ar_st_soul_siphon', amount: 6, to: 'self' }]
    }
  });

  // ===========================================================================
  // TOKENS (rarity 'special': created by other cards, never offered as rewards)
  // ===========================================================================
  DS.defineCard({
    id: 'ar_ember_spark', name: 'Ember Spark', class: 'arcanist', type: 'attack', rarity: 'special',
    cost: 0, target: 'enemy', icon: '🔸', exhaust: true,
    desc: 'Deal 3 damage. Exhaust.',
    effects: [{ op: 'damage', amount: 3 }],
    upgrade: { desc: 'Deal 4 damage. Exhaust.', effects: [{ op: 'damage', amount: 4 }] }
  });

  DS.defineCard({
    id: 'ar_arcane_wisp', name: 'Arcane Wisp', class: 'arcanist', type: 'skill', rarity: 'special',
    cost: 0, target: 'self', icon: '💫', exhaust: true,
    desc: 'Gain 1 Arcane Charge. Exhaust.',
    effects: [{ op: 'apply', status: 'ar_arcane_charge', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain 2 Arcane Charge. Exhaust.',
      effects: [{ op: 'apply', status: 'ar_arcane_charge', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'ar_frost_rune', name: 'Frost Rune', class: 'arcanist', type: 'skill', rarity: 'special',
    cost: 0, target: 'none', icon: '❄️',
    desc: 'Gain 4 Block. Apply 1 Chill to a random enemy.',
    effects: [
      { op: 'block', amount: 4, to: 'self' },
      { op: 'apply', status: 'ar_chill', amount: 1, to: 'random_enemy' }
    ],
    upgrade: {
      desc: 'Gain 6 Block. Apply 2 Chill to a random enemy.',
      effects: [
        { op: 'block', amount: 6, to: 'self' },
        { op: 'apply', status: 'ar_chill', amount: 2, to: 'random_enemy' }
      ]
    }
  });

})();
