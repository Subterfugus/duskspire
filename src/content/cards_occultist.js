(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // OCCULTIST: Hesper Vane, the Forbidden Reader.
  // Four archetypes that interlock:
  //   Hex       : oc_hex stacks on enemies. Hexed foes take +N damage per attack and lose N HP
  //               whenever they attack. Spreads (oc_wailing_chorus, oc_coven_rite), doubles
  //               (oc_hex_scourge), consumes (oc_death_knell, oc_marrow_drain) and triggers
  //               (oc_occult_focus, oc_black_mirror, oc_spite).
  //   Sacrifice : Curses and Statuses are fuel. Exhaust your own cards and draw or exhaust
  //               junk for payoffs (oc_grave_ledger, oc_wound_alchemy, oc_unclean_ward).
  //   Lifedrain : Heal from kills, hits and losses; max HP grows from enemy deaths; missing-HP
  //               scaling (oc_soul_tithe, oc_sanguine_ward, oc_grave_bloom, oc_mourning_veil).
  //   Ritual    : Slow powers and retained cards that scale every turn (oc_mounting_dread,
  //               oc_sigil_circle, oc_hymn_of_ages, oc_eldritch_lance, ritual, metallicize).
  // ---------------------------------------------------------------------------

  DS.defineCharacter({
    id: 'occultist',
    name: 'Hesper Vane',
    title: 'The Forbidden Reader',
    desc: 'A candle-lit witch who reads the books the pyres were meant to burn. Hexes her foes, feeds on her own curses and wounds, drinks life from the dead and builds rituals that grow every turn.',
    hp: 66,
    gold: 99,
    icon: '🕯️',
    color: '#16a085',
    starterDeck: [
      'oc_strike', 'oc_strike', 'oc_strike', 'oc_strike', 'oc_strike',
      'oc_defend', 'oc_defend', 'oc_defend', 'oc_defend',
      'oc_hex_needle', 'oc_forbidden_index'
    ],
    starterRelic: 'oc_wax_seal'
  });

  // ===========================================================================
  // RELICS (starter + 4 class relics: common, uncommon, rare, boss)
  // ===========================================================================
  DS.defineRelic({
    id: 'oc_wax_seal',
    name: 'Wax-Sealed Candle',
    desc: 'Whenever you Exhaust a card, gain 2 Block.',
    flavor: 'The seal still smells of smoke.',
    rarity: 'starter',
    icon: '🕯️',
    class: 'occultist',
    passive: {},
    triggers: {
      onCardExhausted: [{ op: 'block', amount: 2, to: 'self' }]
    }
  });

  DS.defineRelic({
    id: 'oc_bone_dice',
    name: 'Loaded Bone Dice',
    desc: 'At the start of each combat, apply 1 Hex to a random enemy.',
    flavor: 'Every roll comes up the same: a curse.',
    rarity: 'common',
    icon: '🎲',
    class: 'occultist',
    passive: {},
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'oc_hex', amount: 1, to: 'random_enemy' }]
    }
  });

  DS.defineRelic({
    id: 'oc_ledger_of_debts',
    name: 'Ledger of Debts',
    desc: 'The first card you Exhaust each turn draws 1 card.',
    flavor: 'Every sacrifice is entered twice: once in ink, once in blood.',
    rarity: 'uncommon',
    icon: '📕',
    class: 'occultist',
    passive: {},
    triggers: {
      onCardExhausted: {
        oncePerTurn: true,
        effects: [{ op: 'draw', amount: 1 }]
      }
    }
  });

  DS.defineRelic({
    id: 'oc_crimson_chalice',
    name: 'Crimson Chalice',
    desc: 'Whenever an enemy dies, heal 4 HP.',
    flavor: 'It drinks what the dead leave behind.',
    rarity: 'rare',
    icon: '🏆',
    class: 'occultist',
    passive: {},
    triggers: {
      onEnemyDeath: [{ op: 'heal', amount: 4, to: 'self' }]
    }
  });

  DS.defineRelic({
    id: 'oc_codex_of_veils',
    name: 'Codex of Veils',
    desc: 'Gain 1 additional Energy each turn. At the start of each combat, add 1 Dazed to your draw pile.',
    flavor: 'Every page you read makes the next one heavier.',
    rarity: 'boss',
    icon: '📖',
    class: 'occultist',
    passive: { energy: 1 },
    triggers: {
      onCombatStart: [{ op: 'add_card', card: 'status_dazed', to: 'draw', amount: 1 }]
    }
  });

  // ===========================================================================
  // CUSTOM STATUSES (15). Power and skill cards apply these to self (or to enemies, for Hex).
  // ===========================================================================

  // Hex: an enemy-side debuff. Takes more damage per stack from every attack, and loses HP
  // whenever it attacks. Does not decay; cards spread, double, consume or trigger it.
  DS.defineStatus({
    id: 'oc_hex',
    name: 'Hex',
    desc: 'Takes {n} more damage from each attack. Whenever this enemy attacks, it loses {n} HP.',
    type: 'debuff',
    icon: '🔮',
    stacks: true,
    mods: { attackTakenAdd: 1 },
    triggers: {
      onAttack: [{ op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Spite: every debuff you apply to an enemy also burns it.
  DS.defineStatus({
    id: 'oc_spite',
    name: 'Spite',
    desc: 'Whenever you apply a debuff to an enemy, deal {n} damage to that enemy.',
    type: 'buff',
    icon: '🖤',
    stacks: true,
    triggers: {
      onApplyDebuff: [{ op: 'damage', amount: { v: 'stacks' }, to: 'target' }]
    }
  });

  // Black Mirror: attackers are hexed in return.
  DS.defineStatus({
    id: 'oc_black_mirror',
    name: 'Black Mirror',
    desc: 'Whenever an enemy attacks you, apply {n} Hex to that enemy.',
    type: 'buff',
    icon: '🪞',
    stacks: true,
    triggers: {
      onAttacked: [{ op: 'apply', status: 'oc_hex', amount: { v: 'stacks' }, to: 'target' }]
    }
  });

  // Sacrifice: exhausting a Curse draws cards.
  DS.defineStatus({
    id: 'oc_grave_ledger',
    name: 'Grave Ledger',
    desc: 'Whenever you Exhaust a Curse, draw {n} card(s).',
    type: 'buff',
    icon: '📒',
    stacks: true,
    triggers: {
      onCardExhausted: {
        when: { cardType: 'curse' },
        effects: [{ op: 'draw', amount: { v: 'stacks' } }]
      }
    }
  });

  // Sacrifice: exhausting a Status card (Wound, Dazed, Burn...) refunds energy.
  DS.defineStatus({
    id: 'oc_wound_alchemy',
    name: 'Wound Alchemy',
    desc: 'Whenever you Exhaust a Status card, gain {n} Energy.',
    type: 'buff',
    icon: '⚗️',
    stacks: true,
    triggers: {
      onCardExhausted: {
        when: { cardType: 'status' },
        effects: [{ op: 'energy', amount: { v: 'stacks' } }]
      }
    }
  });

  // Sacrifice: drawing a Curse hardens you.
  DS.defineStatus({
    id: 'oc_unclean_ward',
    name: 'Unclean Ward',
    desc: 'Whenever you draw a Curse, gain {n} Block.',
    type: 'buff',
    icon: '🌘',
    stacks: true,
    triggers: {
      onCardDrawn: {
        when: { cardType: 'curse' },
        effects: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // Sacrifice: drawing a Status card (Wound, Dazed...) lashes every enemy.
  DS.defineStatus({
    id: 'oc_wound_resonance',
    name: 'Wound Resonance',
    desc: 'Whenever you draw a Status card, deal {n} damage to ALL enemies.',
    type: 'buff',
    icon: '🔊',
    stacks: true,
    triggers: {
      onCardDrawn: {
        when: { cardType: 'status' },
        effects: [{ op: 'damage', amount: { v: 'stacks' }, to: 'all_enemies' }]
      }
    }
  });

  // Lifedrain: every enemy death feeds you.
  DS.defineStatus({
    id: 'oc_soul_tithe',
    name: 'Soul Tithe',
    desc: 'Whenever an enemy dies, heal {n} HP.',
    type: 'buff',
    icon: '🕊️',
    stacks: true,
    triggers: {
      onEnemyDeath: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Lifedrain: losing HP (from any source) heals you.
  DS.defineStatus({
    id: 'oc_sanguine_ward',
    name: 'Sanguine Ward',
    desc: 'Whenever you lose HP, heal {n} HP.',
    type: 'buff',
    icon: '💗',
    stacks: true,
    triggers: {
      onDamaged: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Lifedrain: enemy deaths grow your maximum HP and heal the same amount.
  DS.defineStatus({
    id: 'oc_grave_bloom',
    name: 'Grave Bloom',
    desc: 'Whenever an enemy dies, gain {n} Max HP and heal that much.',
    type: 'buff',
    icon: '🌸',
    stacks: true,
    triggers: {
      onEnemyDeath: [{ op: 'max_hp', amount: { v: 'stacks' } }]
    }
  });

  // Lifedrain: missing HP becomes armour at the start of every turn.
  DS.defineStatus({
    id: 'oc_mourning_veil',
    name: 'Mourning Veil',
    desc: 'At the start of your turn, gain Block equal to half your missing HP.',
    type: 'buff',
    icon: '🪦',
    stacks: false,
    triggers: {
      onTurnStart: [{ op: 'block', amount: { v: 'missing_hp', mul: 0.5 }, to: 'self' }]
    }
  });

  // Ritual: a circle of damage that restarts every turn.
  DS.defineStatus({
    id: 'oc_sigil_circle',
    name: 'Sigil Circle',
    desc: 'At the start of your turn, deal {n} damage to ALL enemies.',
    type: 'buff',
    icon: '⭕',
    stacks: true,
    triggers: {
      onTurnStart: [{ op: 'damage', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  // Ritual: a growing war-chant. Strength returns every turn.
  DS.defineStatus({
    id: 'oc_mounting_dread',
    name: 'Mounting Dread',
    desc: 'At the start of your turn, gain {n} Strength.',
    type: 'buff',
    icon: '📈',
    stacks: true,
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Lifedrain / Sacrifice: each exhausted card is a small sacrament.
  DS.defineStatus({
    id: 'oc_pale_covenant',
    name: 'Pale Covenant',
    desc: 'Whenever you Exhaust a card, heal {n} HP.',
    type: 'buff',
    icon: '🤍',
    stacks: true,
    triggers: {
      onCardExhausted: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Hex: every skill you play hexes a random enemy.
  DS.defineStatus({
    id: 'oc_occult_focus',
    name: 'Occult Focus',
    desc: 'Whenever you play a Skill, apply {n} Hex to a random enemy.',
    type: 'buff',
    icon: '📿',
    stacks: true,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'apply', status: 'oc_hex', amount: { v: 'stacks' }, to: 'random_enemy' }]
      }
    }
  });

  // ===========================================================================
  // STARTER CARDS (4 distinct: Strike, Defend, 2 signatures). Deck = 5 Strike, 4 Defend, 2 signatures.
  // ===========================================================================
  DS.defineCard({
    id: 'oc_strike', name: 'Strike', class: 'occultist', type: 'attack', rarity: 'starter',
    cost: 1, target: 'enemy', icon: '🗡️',
    desc: 'Deal 6 damage.',
    effects: [{ op: 'damage', amount: 6 }],
    upgrade: { desc: 'Deal 9 damage.', effects: [{ op: 'damage', amount: 9 }] }
  });

  DS.defineCard({
    id: 'oc_defend', name: 'Defend', class: 'occultist', type: 'skill', rarity: 'starter',
    cost: 1, target: 'self', icon: '🔮',
    desc: 'Gain 5 Block.',
    effects: [{ op: 'block', amount: 5, to: 'self' }],
    upgrade: { desc: 'Gain 8 Block.', effects: [{ op: 'block', amount: 8, to: 'self' }] }
  });

  DS.defineCard({
    id: 'oc_hex_needle', name: 'Hex Needle', class: 'occultist', type: 'attack', rarity: 'starter',
    cost: 1, target: 'enemy', icon: '🪡',
    desc: 'Deal 5 damage. Apply 1 Hex.',
    effects: [{ op: 'damage', amount: 5 }, { op: 'apply', status: 'oc_hex', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Deal 6 damage. Apply 2 Hex.',
      effects: [{ op: 'damage', amount: 6 }, { op: 'apply', status: 'oc_hex', amount: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'oc_forbidden_index', name: 'Forbidden Index', class: 'occultist', type: 'skill', rarity: 'starter',
    cost: 1, target: 'self', icon: '📖',
    desc: 'Draw 2 cards. Add 1 Wound to your discard pile.',
    effects: [{ op: 'draw', amount: 2 }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Draw 3 cards. Add 1 Wound to your discard pile.',
      effects: [{ op: 'draw', amount: 3 }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }]
    }
  });

  // ===========================================================================
  // COMMON ATTACKS (11)
  // ===========================================================================
  DS.defineCard({
    id: 'oc_cursed_lash', name: 'Cursed Lash', class: 'occultist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🪢',
    desc: 'Deal 7 damage. If the enemy is Hexed, draw 1 card.',
    effects: [
      { op: 'damage', amount: 7 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'oc_hex', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'draw', amount: 1 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 10 damage. If the enemy is Hexed, draw 1 card.',
      effects: [
        { op: 'damage', amount: 10 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'oc_hex', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'draw', amount: 1 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'oc_grave_rake', name: 'Grave Rake', class: 'occultist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🦴',
    desc: 'Deal 9 damage. Add 1 Wound to your discard pile.',
    effects: [{ op: 'damage', amount: 9 }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Deal 12 damage. Add 1 Wound to your discard pile.',
      effects: [{ op: 'damage', amount: 12 }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'oc_wailing_chorus', name: 'Wailing Chorus', class: 'occultist', type: 'attack', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '🎶',
    desc: 'Deal 5 damage to ALL enemies. Apply 1 Hex to ALL enemies.',
    effects: [
      { op: 'damage', amount: 5, to: 'all_enemies' },
      { op: 'apply', status: 'oc_hex', amount: 1, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 7 damage to ALL enemies. Apply 2 Hex to ALL enemies.',
      effects: [
        { op: 'damage', amount: 7, to: 'all_enemies' },
        { op: 'apply', status: 'oc_hex', amount: 2, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'oc_leech_touch', name: 'Leech Touch', class: 'occultist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🦇',
    desc: 'Deal 5 damage. Heal 3 HP.',
    effects: [{ op: 'damage', amount: 5 }, { op: 'heal', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Deal 7 damage. Heal 4 HP.',
      effects: [{ op: 'damage', amount: 7 }, { op: 'heal', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_hexbolt', name: 'Hexbolt', class: 'occultist', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '✴️',
    desc: 'Deal 3 damage. Apply 1 Hex.',
    effects: [{ op: 'damage', amount: 3 }, { op: 'apply', status: 'oc_hex', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Deal 4 damage. Apply 2 Hex.',
      effects: [{ op: 'damage', amount: 4 }, { op: 'apply', status: 'oc_hex', amount: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'oc_gutter_stab', name: 'Gutter Stab', class: 'occultist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '⚰️',
    desc: 'Deal 6 damage, plus 1 damage for every 4 HP you are missing.',
    effects: [{ op: 'damage', amount: { v: 'missing_hp', mul: 0.25, add: 6 } }],
    upgrade: {
      desc: 'Deal 8 damage, plus 1 damage for every 4 HP you are missing.',
      effects: [{ op: 'damage', amount: { v: 'missing_hp', mul: 0.25, add: 8 } }]
    }
  });

  DS.defineCard({
    id: 'oc_scatter_bones', name: 'Scatter Bones', class: 'occultist', type: 'attack', rarity: 'common',
    cost: 1, target: 'random_enemy', icon: '🎲', innate: true,
    desc: 'Innate. Deal 3 damage to a random enemy 3 times.',
    effects: [{ op: 'damage', amount: 3, times: 3, to: 'random_enemy' }],
    upgrade: {
      desc: 'Innate. Deal 4 damage to a random enemy 3 times.',
      effects: [{ op: 'damage', amount: 4, times: 3, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'oc_sacrificial_knife', name: 'Sacrificial Knife', class: 'occultist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🔪',
    desc: 'Deal 10 damage. Exhaust 1 card from your hand.',
    effects: [{ op: 'damage', amount: 10 }, { op: 'exhaust', amount: 1 }],
    upgrade: {
      desc: 'Deal 13 damage. Exhaust 1 card from your hand.',
      effects: [{ op: 'damage', amount: 13 }, { op: 'exhaust', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'oc_withering_touch', name: 'Withering Touch', class: 'occultist', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🌫️',
    desc: 'Deal 11 damage. Apply 1 Weak.',
    effects: [{ op: 'damage', amount: 11 }, { op: 'apply', status: 'weak', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Deal 14 damage. Apply 1 Weak.',
      effects: [{ op: 'damage', amount: 14 }, { op: 'apply', status: 'weak', amount: 1, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'oc_grave_hammer', name: 'Grave Hammer', class: 'occultist', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '⚒️',
    desc: 'Deal 13 damage. Gain 4 Block.',
    effects: [{ op: 'damage', amount: 13 }, { op: 'block', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Deal 17 damage. Gain 6 Block.',
      effects: [{ op: 'damage', amount: 17 }, { op: 'block', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_hungering_scythe', name: 'Hungering Scythe', class: 'occultist', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🌜',
    desc: 'Deal 6 damage. If the enemy is Hexed, heal 2 HP.',
    effects: [
      { op: 'damage', amount: 6 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'oc_hex', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'heal', amount: 2, to: 'self' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 8 damage. If the enemy is Hexed, heal 3 HP.',
      effects: [
        { op: 'damage', amount: 8 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'oc_hex', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'heal', amount: 3, to: 'self' }],
          else: []
        }
      ]
    }
  });

  // ===========================================================================
  // COMMON SKILLS (10)
  // ===========================================================================
  DS.defineCard({
    id: 'oc_salt_circle', name: 'Salt Circle', class: 'occultist', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🧂',
    desc: 'Gain 6 Block. Apply 1 Hex to a random enemy.',
    effects: [{ op: 'block', amount: 6, to: 'self' }, { op: 'apply', status: 'oc_hex', amount: 1, to: 'random_enemy' }],
    upgrade: {
      desc: 'Gain 8 Block. Apply 2 Hex to a random enemy.',
      effects: [{ op: 'block', amount: 8, to: 'self' }, { op: 'apply', status: 'oc_hex', amount: 2, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'oc_night_tithe', name: 'Night Tithe', class: 'occultist', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🦉',
    desc: 'Lose 1 HP. Draw 2 cards.',
    effects: [{ op: 'lose_hp', amount: 1, to: 'self' }, { op: 'draw', amount: 2 }],
    upgrade: {
      desc: 'Lose 1 HP. Draw 3 cards.',
      effects: [{ op: 'lose_hp', amount: 1, to: 'self' }, { op: 'draw', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'oc_burnt_offering', name: 'Burnt Offering', class: 'occultist', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🔥',
    desc: 'Exhaust 1 card from your hand. Draw 2 cards.',
    effects: [{ op: 'exhaust', amount: 1 }, { op: 'draw', amount: 2 }],
    upgrade: {
      desc: 'Exhaust 1 card from your hand. Draw 3 cards.',
      effects: [{ op: 'exhaust', amount: 1 }, { op: 'draw', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'oc_whispered_index', name: 'Whispered Index', class: 'occultist', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '📜',
    desc: 'Draw 2 cards. Add 1 Dazed to your discard pile.',
    effects: [{ op: 'draw', amount: 2 }, { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Draw 3 cards. Add 1 Dazed to your discard pile.',
      effects: [{ op: 'draw', amount: 3 }, { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'oc_tallow_ward', name: 'Tallow Ward', class: 'occultist', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🧴',
    desc: 'Gain 4 Block. Heal 2 HP.',
    effects: [{ op: 'block', amount: 4, to: 'self' }, { op: 'heal', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 6 Block. Heal 3 HP.',
      effects: [{ op: 'block', amount: 6, to: 'self' }, { op: 'heal', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_rotten_bargain', name: 'Rotten Bargain', class: 'occultist', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🧪',
    desc: 'Add 1 Wound to your hand. Draw 2 cards.',
    effects: [{ op: 'add_card', card: 'status_wound', to: 'hand', amount: 1 }, { op: 'draw', amount: 2 }],
    upgrade: {
      desc: 'Add 1 Wound to your hand. Draw 3 cards.',
      effects: [{ op: 'add_card', card: 'status_wound', to: 'hand', amount: 1 }, { op: 'draw', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'oc_pale_candle', name: 'Pale Candle', class: 'occultist', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '💡',
    desc: 'Gain 2 Block. Gain 1 Energy next turn.',
    effects: [{ op: 'block', amount: 2, to: 'self' }, { op: 'apply', status: 'energized', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Block. Gain 2 Energy next turn.',
      effects: [{ op: 'block', amount: 3, to: 'self' }, { op: 'apply', status: 'energized', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_mournful_dirge', name: 'Mournful Dirge', class: 'occultist', type: 'skill', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '🎺',
    desc: 'Apply 1 Weak to ALL enemies. Draw 1 card.',
    effects: [{ op: 'apply', status: 'weak', amount: 1, to: 'all_enemies' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Apply 2 Weak to ALL enemies. Draw 1 card.',
      effects: [{ op: 'apply', status: 'weak', amount: 2, to: 'all_enemies' }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'oc_witch_mark', name: 'Witch Mark', class: 'occultist', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🖊️',
    desc: 'Apply 2 Hex to the enemy.',
    effects: [{ op: 'apply', status: 'oc_hex', amount: 2, to: 'target' }],
    upgrade: {
      desc: 'Apply 3 Hex to the enemy.',
      effects: [{ op: 'apply', status: 'oc_hex', amount: 3, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'oc_gravewall', name: 'Gravewall', class: 'occultist', type: 'skill', rarity: 'common',
    cost: 2, target: 'self', icon: '🪦',
    desc: 'Gain 10 Block.',
    effects: [{ op: 'block', amount: 10, to: 'self' }],
    upgrade: { desc: 'Gain 13 Block.', effects: [{ op: 'block', amount: 13, to: 'self' }] }
  });

  // ===========================================================================
  // COMMON POWERS (5)
  // ===========================================================================
  DS.defineCard({
    id: 'oc_ember_of_spite', name: 'Ember of Spite', class: 'occultist', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🖤',
    desc: 'Whenever you apply a debuff to an enemy, deal 2 damage to that enemy.',
    effects: [{ op: 'apply', status: 'oc_spite', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you apply a debuff to an enemy, deal 3 damage to that enemy.',
      effects: [{ op: 'apply', status: 'oc_spite', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_tithe_of_souls', name: 'Tithe of Souls', class: 'occultist', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🕊️',
    desc: 'Whenever an enemy dies, heal 3 HP.',
    effects: [{ op: 'apply', status: 'oc_soul_tithe', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Whenever an enemy dies, heal 4 HP.',
      effects: [{ op: 'apply', status: 'oc_soul_tithe', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_ledger_of_graves', name: 'Ledger of Graves', class: 'occultist', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '📒',
    desc: 'Whenever you Exhaust a Curse, draw 1 card.',
    effects: [{ op: 'apply', status: 'oc_grave_ledger', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you Exhaust a Curse, draw 2 cards.',
      effects: [{ op: 'apply', status: 'oc_grave_ledger', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_cursed_vigil', name: 'Cursed Vigil', class: 'occultist', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🌘',
    desc: 'Whenever you draw a Curse, gain 3 Block.',
    effects: [{ op: 'apply', status: 'oc_unclean_ward', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Whenever you draw a Curse, gain 4 Block.',
      effects: [{ op: 'apply', status: 'oc_unclean_ward', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_ritual_chant', name: 'Ritual Chant', class: 'occultist', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🔔',
    desc: 'At the end of your turn, gain 1 Strength.',
    effects: [{ op: 'apply', status: 'ritual', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the end of your turn, gain 2 Strength.',
      effects: [{ op: 'apply', status: 'ritual', amount: 2, to: 'self' }]
    }
  });

  // ===========================================================================
  // UNCOMMON ATTACKS (13)
  // ===========================================================================
  DS.defineCard({
    id: 'oc_plague_of_names', name: 'Plague of Names', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '📯',
    desc: 'Deal 8 damage. Apply 2 Hex.',
    effects: [{ op: 'damage', amount: 8 }, { op: 'apply', status: 'oc_hex', amount: 2, to: 'target' }],
    upgrade: {
      desc: 'Deal 10 damage. Apply 3 Hex.',
      effects: [{ op: 'damage', amount: 10 }, { op: 'apply', status: 'oc_hex', amount: 3, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'oc_whispering_barrage', name: 'Whispering Barrage', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '🌬️',
    desc: 'Deal 3 damage to ALL enemies 2 times.',
    effects: [{ op: 'damage', amount: 3, times: 2, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 4 damage to ALL enemies 2 times.',
      effects: [{ op: 'damage', amount: 4, times: 2, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'oc_marrow_drain', name: 'Marrow Drain', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🧬',
    desc: 'Deal 6 damage. Heal 1 HP for each Hex on the enemy.',
    effects: [
      { op: 'damage', amount: 6 },
      { op: 'heal', amount: { v: 'status', status: 'oc_hex', of: 'target' }, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 8 damage. Heal 2 HP for each Hex on the enemy.',
      effects: [
        { op: 'damage', amount: 8 },
        { op: 'heal', amount: { v: 'status', status: 'oc_hex', of: 'target', mul: 2 }, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'oc_ashen_maw', name: 'Ashen Maw', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🌋',
    desc: 'Deal 12 damage. Exhaust all Status cards in your hand.',
    effects: [{ op: 'damage', amount: 12 }, { op: 'exhaust', amount: 'all', type: 'status' }],
    upgrade: {
      desc: 'Deal 15 damage. Exhaust all Status cards in your hand.',
      effects: [{ op: 'damage', amount: 15 }, { op: 'exhaust', amount: 'all', type: 'status' }]
    }
  });

  DS.defineCard({
    id: 'oc_eclipse_hymn', name: 'Eclipse Hymn', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🌒',
    desc: 'Deal 9 damage to ALL enemies. Apply 1 Hex to ALL enemies.',
    effects: [
      { op: 'damage', amount: 9, to: 'all_enemies' },
      { op: 'apply', status: 'oc_hex', amount: 1, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 12 damage to ALL enemies. Apply 2 Hex to ALL enemies.',
      effects: [
        { op: 'damage', amount: 12, to: 'all_enemies' },
        { op: 'apply', status: 'oc_hex', amount: 2, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'oc_black_sun', name: 'Black Sun', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 3, target: 'all_enemies', icon: '🌑', ethereal: true,
    desc: 'Ethereal. Deal 16 damage to ALL enemies.',
    effects: [{ op: 'damage', amount: 16, to: 'all_enemies' }],
    upgrade: {
      desc: 'Ethereal. Deal 22 damage to ALL enemies.',
      effects: [{ op: 'damage', amount: 22, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'oc_siphon_scream', name: 'Siphon Scream', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '😱',
    desc: 'Deal 8 damage. If you have less than half your max HP, heal 6 HP.',
    effects: [
      { op: 'damage', amount: 8 },
      {
        op: 'if',
        cond: { left: { v: 'hp' }, cmp: '<', right: { v: 'max_hp', mul: 0.5 } },
        then: [{ op: 'heal', amount: 6, to: 'self' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 11 damage. If you have less than half your max HP, heal 8 HP.',
      effects: [
        { op: 'damage', amount: 11 },
        {
          op: 'if',
          cond: { left: { v: 'hp' }, cmp: '<', right: { v: 'max_hp', mul: 0.5 } },
          then: [{ op: 'heal', amount: 8, to: 'self' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'oc_eldritch_lance', name: 'Eldritch Lance', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🔱',
    desc: 'Deal 4 damage, plus 2 for each turn this combat.',
    effects: [{ op: 'damage', amount: { v: 'turn', mul: 2, add: 4 } }],
    upgrade: {
      desc: 'Deal 5 damage, plus 3 for each turn this combat.',
      effects: [{ op: 'damage', amount: { v: 'turn', mul: 3, add: 5 } }]
    }
  });

  DS.defineCard({
    id: 'oc_hex_scourge', name: 'Hex Scourge', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪄',
    desc: 'Deal 4 damage. Double the Hex on the enemy.',
    effects: [{ op: 'damage', amount: 4 }, { op: 'multiply_status', status: 'oc_hex', factor: 2, to: 'target' }],
    upgrade: {
      desc: 'Deal 6 damage. Double the Hex on the enemy.',
      effects: [{ op: 'damage', amount: 6 }, { op: 'multiply_status', status: 'oc_hex', factor: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'oc_blood_oath', name: 'Blood Oath', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🖋️',
    desc: 'Lose 3 HP. Deal 8 damage.',
    effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, { op: 'damage', amount: 8 }],
    upgrade: {
      desc: 'Lose 2 HP. Deal 10 damage.',
      effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'damage', amount: 10 }]
    }
  });

  DS.defineCard({
    id: 'oc_soulbite_cleave', name: 'Soulbite Cleave', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🦷',
    desc: 'Deal 7 damage to ALL enemies. Heal 3 HP.',
    effects: [{ op: 'damage', amount: 7, to: 'all_enemies' }, { op: 'heal', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Deal 10 damage to ALL enemies. Heal 4 HP.',
      effects: [{ op: 'damage', amount: 10, to: 'all_enemies' }, { op: 'heal', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_thousand_pricks', name: 'Thousand Pricks', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'random_enemy', icon: '📍',
    desc: 'Deal 3 damage to a random enemy 4 times.',
    effects: [{ op: 'damage', amount: 3, times: 4, to: 'random_enemy' }],
    upgrade: {
      desc: 'Deal 4 damage to a random enemy 4 times.',
      effects: [{ op: 'damage', amount: 4, times: 4, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'oc_gravebind', name: 'Gravebind', class: 'occultist', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪤',
    desc: 'Deal 6 damage. If the enemy is already Hexed, draw 1 card. Then apply 1 Hex.',
    effects: [
      { op: 'damage', amount: 6 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'oc_hex', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'draw', amount: 1 }],
        else: []
      },
      { op: 'apply', status: 'oc_hex', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 8 damage. If the enemy is already Hexed, draw 1 card. Then apply 2 Hex.',
      effects: [
        { op: 'damage', amount: 8 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'oc_hex', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'draw', amount: 1 }],
          else: []
        },
        { op: 'apply', status: 'oc_hex', amount: 2, to: 'target' }
      ]
    }
  });

  // ===========================================================================
  // UNCOMMON SKILLS (12)
  // ===========================================================================
  DS.defineCard({
    id: 'oc_hex_chorus', name: 'Hex Chorus', class: 'occultist', type: 'skill', rarity: 'uncommon',
    cost: 'X', target: 'all_enemies', icon: '🎆',
    desc: 'Spend all your Energy. Apply X Hex to ALL enemies.',
    effects: [{ op: 'apply', status: 'oc_hex', amount: { v: 'x' }, to: 'all_enemies' }],
    upgrade: {
      desc: 'Spend all your Energy. Apply X + 1 Hex to ALL enemies.',
      effects: [{ op: 'apply', status: 'oc_hex', amount: { v: 'x', add: 1 }, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'oc_harvest_debt', name: 'Harvest Debt', class: 'occultist', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🌾',
    desc: 'Exhaust 1 card from your hand. Gain 4 Block.',
    effects: [{ op: 'exhaust', amount: 1 }, { op: 'block', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Exhaust 1 card from your hand. Gain 6 Block.',
      effects: [{ op: 'exhaust', amount: 1 }, { op: 'block', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_summon_wisp', name: 'Summon Wisp', class: 'occultist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '👁️',
    desc: 'Add 2 Wisps to your hand.',
    effects: [{ op: 'add_card', card: 'oc_wisp', to: 'hand', amount: 2 }],
    upgrade: {
      desc: 'Add 2 upgraded Wisps to your hand.',
      effects: [{ op: 'add_card', card: 'oc_wisp', to: 'hand', amount: 2, upgraded: true }]
    }
  });

  DS.defineCard({
    id: 'oc_cold_communion', name: 'Cold Communion', class: 'occultist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '❄️',
    desc: 'Heal 6 HP. Add 1 Wound to your discard pile.',
    effects: [{ op: 'heal', amount: 6, to: 'self' }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Heal 8 HP. Add 1 Wound to your discard pile.',
      effects: [{ op: 'heal', amount: 8, to: 'self' }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'oc_coven_rite', name: 'Coven Rite', class: 'occultist', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🧙',
    desc: 'Apply 1 Hex to ALL enemies. Draw 2 cards.',
    effects: [{ op: 'apply', status: 'oc_hex', amount: 1, to: 'all_enemies' }, { op: 'draw', amount: 2 }],
    upgrade: {
      desc: 'Apply 2 Hex to ALL enemies. Draw 2 cards.',
      effects: [{ op: 'apply', status: 'oc_hex', amount: 2, to: 'all_enemies' }, { op: 'draw', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'oc_pact_of_ash', name: 'Pact of Ash', class: 'occultist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '⚱️',
    desc: 'Add 2 Wounds to your draw pile. Gain 8 Block.',
    effects: [{ op: 'add_card', card: 'status_wound', to: 'draw', amount: 2 }, { op: 'block', amount: 8, to: 'self' }],
    upgrade: {
      desc: 'Add 2 Wounds to your draw pile. Gain 11 Block.',
      effects: [{ op: 'add_card', card: 'status_wound', to: 'draw', amount: 2 }, { op: 'block', amount: 11, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_tithe_of_teeth', name: 'Tithe of Teeth', class: 'occultist', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🪙',
    desc: 'Exhaust 1 card from your hand. Gain 1 Energy.',
    effects: [{ op: 'exhaust', amount: 1 }, { op: 'energy', amount: 1 }],
    upgrade: {
      desc: 'Exhaust 1 card from your hand. Gain 2 Energy.',
      effects: [{ op: 'exhaust', amount: 1 }, { op: 'energy', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'oc_crypt_ward', name: 'Crypt Ward', class: 'occultist', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🏚️', retain: true,
    desc: 'Retain. Gain 12 Block. Apply 1 Weak to ALL enemies.',
    effects: [{ op: 'block', amount: 12, to: 'self' }, { op: 'apply', status: 'weak', amount: 1, to: 'all_enemies' }],
    upgrade: {
      desc: 'Retain. Gain 15 Block. Apply 2 Weak to ALL enemies.',
      effects: [{ op: 'block', amount: 15, to: 'self' }, { op: 'apply', status: 'weak', amount: 2, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'oc_sealed_pact', name: 'Sealed Pact', class: 'occultist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔏',
    desc: 'Gain 6 Block. Add 1 Dazed to your draw pile.',
    effects: [{ op: 'block', amount: 6, to: 'self' }, { op: 'add_card', card: 'status_dazed', to: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Gain 8 Block. Add 1 Dazed to your draw pile.',
      effects: [{ op: 'block', amount: 8, to: 'self' }, { op: 'add_card', card: 'status_dazed', to: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'oc_sanguine_draught', name: 'Sanguine Draught', class: 'occultist', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🍷',
    desc: 'Lose 3 HP. Draw 3 cards.',
    effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, { op: 'draw', amount: 3 }],
    upgrade: {
      desc: 'Lose 2 HP. Draw 3 cards.',
      effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'draw', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'oc_gallows_prayer', name: 'Gallows Prayer', class: 'occultist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🙏',
    desc: 'Heal 5 HP. Exhaust 1 card from your hand.',
    effects: [{ op: 'heal', amount: 5, to: 'self' }, { op: 'exhaust', amount: 1 }],
    upgrade: {
      desc: 'Heal 7 HP. Exhaust 1 card from your hand.',
      effects: [{ op: 'heal', amount: 7, to: 'self' }, { op: 'exhaust', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'oc_hex_shackles', name: 'Hex Shackles', class: 'occultist', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '⛓️',
    desc: 'Apply 2 Hex and 1 Weak to the enemy.',
    effects: [{ op: 'apply', status: 'oc_hex', amount: 2, to: 'target' }, { op: 'apply', status: 'weak', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Apply 3 Hex and 1 Weak to the enemy.',
      effects: [{ op: 'apply', status: 'oc_hex', amount: 3, to: 'target' }, { op: 'apply', status: 'weak', amount: 1, to: 'target' }]
    }
  });

  // ===========================================================================
  // UNCOMMON POWERS (7)
  // ===========================================================================
  DS.defineCard({
    id: 'oc_mirror_of_bones', name: 'Mirror of Bones', class: 'occultist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪞',
    desc: 'Whenever an enemy attacks you, apply 1 Hex to that enemy.',
    effects: [{ op: 'apply', status: 'oc_black_mirror', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever an enemy attacks you, apply 2 Hex to that enemy.',
      effects: [{ op: 'apply', status: 'oc_black_mirror', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_occult_study', name: 'Occult Study', class: 'occultist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '📿',
    desc: 'Whenever you play a Skill, apply 1 Hex to a random enemy.',
    effects: [{ op: 'apply', status: 'oc_occult_focus', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play a Skill, apply 2 Hex to a random enemy.',
      effects: [{ op: 'apply', status: 'oc_occult_focus', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_sigil_of_circles', name: 'Sigil of Circles', class: 'occultist', type: 'power', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '⭕',
    desc: 'At the start of your turn, deal 3 damage to ALL enemies.',
    effects: [{ op: 'apply', status: 'oc_sigil_circle', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'At the start of your turn, deal 5 damage to ALL enemies.',
      effects: [{ op: 'apply', status: 'oc_sigil_circle', amount: 5, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_sanguine_rite', name: 'Sanguine Rite', class: 'occultist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '💗',
    desc: 'Whenever you lose HP, heal 2 HP.',
    effects: [{ op: 'apply', status: 'oc_sanguine_ward', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you lose HP, heal 3 HP.',
      effects: [{ op: 'apply', status: 'oc_sanguine_ward', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_pale_oath', name: 'Pale Oath', class: 'occultist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🤍',
    desc: 'Whenever you Exhaust a card, heal 2 HP.',
    effects: [{ op: 'apply', status: 'oc_pale_covenant', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you Exhaust a card, heal 3 HP.',
      effects: [{ op: 'apply', status: 'oc_pale_covenant', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_alchemist_of_wounds', name: 'Alchemist of Wounds', class: 'occultist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '⚗️',
    desc: 'Whenever you Exhaust a Status card, gain 1 Energy.',
    effects: [{ op: 'apply', status: 'oc_wound_alchemy', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you Exhaust a Status card, gain 2 Energy.',
      effects: [{ op: 'apply', status: 'oc_wound_alchemy', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_iron_covenant', name: 'Iron Covenant', class: 'occultist', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '⚙️',
    desc: 'At the end of your turn, gain 3 Block.',
    effects: [{ op: 'apply', status: 'metallicize', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'At the end of your turn, gain 4 Block.',
      effects: [{ op: 'apply', status: 'metallicize', amount: 4, to: 'self' }]
    }
  });

  // ===========================================================================
  // RARE ATTACKS (7)
  // ===========================================================================
  DS.defineCard({
    id: 'oc_black_requiem', name: 'Black Requiem', class: 'occultist', type: 'attack', rarity: 'rare',
    cost: 'X', target: 'enemy', icon: '🎼',
    desc: 'Spend all your Energy. Deal 6 damage per Energy spent.',
    effects: [{ op: 'damage', amount: { v: 'x', mul: 6 } }],
    upgrade: {
      desc: 'Spend all your Energy. Deal 8 damage per Energy spent.',
      effects: [{ op: 'damage', amount: { v: 'x', mul: 8 } }]
    }
  });

  DS.defineCard({
    id: 'oc_ritual_of_ruin', name: 'Ritual of Ruin', class: 'occultist', type: 'attack', rarity: 'rare',
    cost: 'X', target: 'all_enemies', icon: '🌌',
    desc: 'Spend all your Energy. Deal 4 damage per Energy spent to ALL enemies.',
    effects: [{ op: 'damage', amount: { v: 'x', mul: 4 }, to: 'all_enemies' }],
    upgrade: {
      desc: 'Spend all your Energy. Deal 5 damage per Energy spent to ALL enemies.',
      effects: [{ op: 'damage', amount: { v: 'x', mul: 5 }, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'oc_hollow_choir', name: 'Hollow Choir', class: 'occultist', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '📣',
    desc: 'Deal 5 damage to ALL enemies 3 times.',
    effects: [{ op: 'damage', amount: 5, times: 3, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 6 damage to ALL enemies 3 times.',
      effects: [{ op: 'damage', amount: 6, times: 3, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'oc_soul_reaper', name: 'Soul Reaper', class: 'occultist', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '☠️',
    desc: 'Deal 12 damage. If this kills the enemy, gain 4 Max HP.',
    effects: [{ op: 'damage', amount: 12, onKill: [{ op: 'max_hp', amount: 4 }] }],
    upgrade: {
      desc: 'Deal 16 damage. If this kills the enemy, gain 6 Max HP.',
      effects: [{ op: 'damage', amount: 16, onKill: [{ op: 'max_hp', amount: 6 }] }]
    }
  });

  DS.defineCard({
    id: 'oc_vampiric_lance', name: 'Vampiric Lance', class: 'occultist', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🏹',
    desc: 'Deal 5 damage 2 times. Heal 3 HP.',
    effects: [{ op: 'damage', amount: 5, times: 2 }, { op: 'heal', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Deal 6 damage 2 times. Heal 4 HP.',
      effects: [{ op: 'damage', amount: 6, times: 2 }, { op: 'heal', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_drown_in_ink', name: 'Drown in Ink', class: 'occultist', type: 'attack', rarity: 'rare',
    cost: 3, target: 'enemy', icon: '🦑',
    desc: 'Deal 20 damage. Apply 3 Hex.',
    effects: [{ op: 'damage', amount: 20 }, { op: 'apply', status: 'oc_hex', amount: 3, to: 'target' }],
    upgrade: {
      desc: 'Deal 26 damage. Apply 4 Hex.',
      effects: [{ op: 'damage', amount: 26 }, { op: 'apply', status: 'oc_hex', amount: 4, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'oc_death_knell', name: 'Death Knell', class: 'occultist', type: 'attack', rarity: 'rare',
    cost: 1, target: 'enemy', icon: '🔔',
    desc: 'Deal 3 damage, plus 4 for each Hex on the enemy.',
    effects: [{ op: 'damage', amount: { v: 'status', status: 'oc_hex', of: 'target', mul: 4, add: 3 } }],
    upgrade: {
      desc: 'Deal 4 damage, plus 5 for each Hex on the enemy.',
      effects: [{ op: 'damage', amount: { v: 'status', status: 'oc_hex', of: 'target', mul: 5, add: 4 } }]
    }
  });

  // ===========================================================================
  // RARE SKILLS (6)
  // ===========================================================================
  DS.defineCard({
    id: 'oc_pestilence', name: 'Pestilence', class: 'occultist', type: 'skill', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🦟',
    desc: 'Apply 3 Hex to ALL enemies.',
    effects: [{ op: 'apply', status: 'oc_hex', amount: 3, to: 'all_enemies' }],
    upgrade: {
      desc: 'Apply 4 Hex to ALL enemies. Draw 1 card.',
      effects: [{ op: 'apply', status: 'oc_hex', amount: 4, to: 'all_enemies' }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'oc_hymn_of_ages', name: 'Hymn of Ages', class: 'occultist', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '⏳', retain: true,
    desc: 'Retain. Gain 3 Block for each turn this combat.',
    effects: [{ op: 'block', amount: { v: 'turn', mul: 3 }, to: 'self' }],
    upgrade: {
      desc: 'Retain. Gain 4 Block for each turn this combat.',
      effects: [{ op: 'block', amount: { v: 'turn', mul: 4 }, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_dark_bargain', name: 'Dark Bargain', class: 'occultist', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🤝',
    desc: 'Add 2 Dazed to your discard pile. Gain 2 Energy.',
    effects: [{ op: 'add_card', card: 'status_dazed', to: 'discard', amount: 2 }, { op: 'energy', amount: 2 }],
    upgrade: {
      desc: 'Add 2 Dazed to your discard pile. Gain 3 Energy.',
      effects: [{ op: 'add_card', card: 'status_dazed', to: 'discard', amount: 2 }, { op: 'energy', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'oc_grim_tithe', name: 'Grim Tithe', class: 'occultist', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '⚖️',
    desc: 'Lose 4 HP. Gain 10 Block. Draw 1 card.',
    effects: [{ op: 'lose_hp', amount: 4, to: 'self' }, { op: 'block', amount: 10, to: 'self' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Lose 3 HP. Gain 13 Block. Draw 1 card.',
      effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, { op: 'block', amount: 13, to: 'self' }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'oc_dying_breath', name: 'Dying Breath', class: 'occultist', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🌅', exhaust: true,
    desc: 'Heal 8 HP. Exhaust this card.',
    effects: [{ op: 'heal', amount: 8, to: 'self' }],
    upgrade: {
      desc: 'Heal 12 HP. Exhaust this card.',
      effects: [{ op: 'heal', amount: 12, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_consuming_rite', name: 'Consuming Rite', class: 'occultist', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🫗',
    desc: 'Gain 1 Energy for each card in your hand. Exhaust your hand.',
    effects: [{ op: 'energy', amount: { v: 'hand' } }, { op: 'exhaust', amount: 'all' }],
    upgrade: {
      desc: 'Gain 2 Energy for each card in your hand. Exhaust your hand.',
      effects: [{ op: 'energy', amount: { v: 'hand', mul: 2 } }, { op: 'exhaust', amount: 'all' }]
    }
  });

  // ===========================================================================
  // RARE POWERS (4)
  // ===========================================================================
  DS.defineCard({
    id: 'oc_echo_of_wounds', name: 'Echo of Wounds', class: 'occultist', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🔊',
    desc: 'Whenever you draw a Status card, deal 3 damage to ALL enemies.',
    effects: [{ op: 'apply', status: 'oc_wound_resonance', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Whenever you draw a Status card, deal 4 damage to ALL enemies.',
      effects: [{ op: 'apply', status: 'oc_wound_resonance', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_blooming_graves', name: 'Blooming Graves', class: 'occultist', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '🌸',
    desc: 'Whenever an enemy dies, gain 3 Max HP and heal that much.',
    effects: [{ op: 'apply', status: 'oc_grave_bloom', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Whenever an enemy dies, gain 4 Max HP and heal that much.',
      effects: [{ op: 'apply', status: 'oc_grave_bloom', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'oc_vigil_of_mourning', name: 'Vigil of Mourning', class: 'occultist', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '🪦',
    desc: 'At the start of your turn, gain Block equal to half your missing HP.',
    effects: [{ op: 'apply', status: 'oc_mourning_veil', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of your turn, gain Block equal to half your missing HP. Gain 1 Dexterity.',
      effects: [
        { op: 'apply', status: 'oc_mourning_veil', amount: 1, to: 'self' },
        { op: 'apply', status: 'dexterity', amount: 1, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'oc_dread_chant', name: 'Dread Chant', class: 'occultist', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '📈',
    desc: 'At the start of your turn, gain 2 Strength.',
    effects: [{ op: 'apply', status: 'oc_mounting_dread', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'At the start of your turn, gain 3 Strength.',
      effects: [{ op: 'apply', status: 'oc_mounting_dread', amount: 3, to: 'self' }]
    }
  });

  // ===========================================================================
  // SPECIAL TOKEN (never offered as a reward)
  // ===========================================================================
  DS.defineCard({
    id: 'oc_wisp', name: 'Wisp', class: 'occultist', type: 'attack', rarity: 'special',
    cost: 0, target: 'random_enemy', icon: '✨', exhaust: true,
    desc: 'Deal 3 damage to a random enemy. Exhaust.',
    effects: [{ op: 'damage', amount: 3, to: 'random_enemy' }],
    upgrade: {
      desc: 'Deal 5 damage to a random enemy. Exhaust.',
      effects: [{ op: 'damage', amount: 5, to: 'random_enemy' }]
    }
  });
})();

