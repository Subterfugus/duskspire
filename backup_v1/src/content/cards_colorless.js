(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // =====================================================================
  // Custom statuses owned by this file (prefix cl_)
  // =====================================================================

  // Applied by curse_pain while it sits in hand; cleared at end of turn.
  DS.defineStatus({
    id: 'cl_pain', name: 'Pain', desc: 'Lose {n} HP each time you play a card this turn.',
    type: 'debuff', icon: '😖', stacks: true, expire: 'turn_end', decay: null,
    triggers: {
      onCardPlayed: [{ op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Power: whenever you kill an enemy, gain Block.
  DS.defineStatus({
    id: 'cl_bloodlust_st', name: 'Bloodlust', desc: 'Whenever you kill an enemy, gain {n} Block.',
    type: 'buff', icon: '😈', stacks: true, expire: null, decay: null,
    triggers: {
      onKill: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Power: whenever you are attacked, gain Strength.
  DS.defineStatus({
    id: 'cl_blood_pact', name: 'Blood Pact', desc: 'Whenever you are attacked, gain {n} Strength.',
    type: 'buff', icon: '🔺', stacks: true, expire: null, decay: null,
    triggers: {
      onAttacked: [{ op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Power: whenever you hit an enemy with an attack, heal.
  DS.defineStatus({
    id: 'cl_vampirism', name: 'Vampiric Touch', desc: 'Whenever you hit an enemy with an attack, heal {n} HP.',
    type: 'buff', icon: '🧛', stacks: true, expire: null, decay: null,
    triggers: {
      onAttack: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Power: whenever any enemy dies, gain energy.
  DS.defineStatus({
    id: 'cl_philosophers', name: "Philosopher's Stone", desc: 'Whenever any enemy dies, gain {n} Energy.',
    type: 'buff', icon: '⚗️', stacks: true, expire: null, decay: null,
    triggers: {
      onEnemyDeath: [{ op: 'energy', amount: { v: 'stacks' } }]
    }
  });

  // Power: draw extra cards at the start of each turn.
  DS.defineStatus({
    id: 'cl_hourglass', name: 'Hourglass', desc: 'At the start of each turn, draw {n} extra card(s).',
    type: 'buff', icon: '⌛', stacks: true, expire: null, decay: null,
    triggers: {
      onTurnStart: [{ op: 'draw', amount: { v: 'stacks' } }]
    }
  });

  // Power: gain energy at the start of each turn.
  DS.defineStatus({
    id: 'cl_surge', name: 'Surge', desc: 'At the start of each turn, gain {n} Energy.',
    type: 'buff', icon: '🔋', stacks: true, expire: null, decay: null,
    triggers: {
      onTurnStart: [{ op: 'energy', amount: { v: 'stacks' } }]
    }
  });

  // =====================================================================
  // Curses (class curse, unplayable, shared ids)
  // =====================================================================

  DS.defineCard({
    id: 'curse_regret', name: 'Regret', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '😩',
    desc: 'Unplayable. At the end of your turn, lose HP equal to the number of cards in your hand.',
    effects: [],
    onEndTurnInHand: [{ op: 'lose_hp', amount: { v: 'hand' }, to: 'self' }]
  });

  DS.defineCard({
    id: 'curse_pain', name: 'Pain', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '😖',
    desc: 'Unplayable. While this is in your hand, lose 1 HP each time you play a card.',
    effects: [],
    onDraw: [{ op: 'apply', status: 'cl_pain', amount: 1, to: 'self' }]
  });

  DS.defineCard({
    id: 'curse_doubt', name: 'Doubt', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '❓',
    desc: 'Unplayable. At the end of your turn, gain 1 Weak.',
    effects: [],
    onEndTurnInHand: [{ op: 'apply', status: 'weak', amount: 1, to: 'self' }]
  });

  DS.defineCard({
    id: 'curse_injury', name: 'Injury', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '🩹',
    desc: 'Unplayable.',
    effects: []
  });

  DS.defineCard({
    id: 'curse_decay', name: 'Decay', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '🍄',
    desc: 'Unplayable. At the end of your turn, take 2 damage.',
    effects: [],
    onEndTurnInHand: [{ op: 'lose_hp', amount: 2, to: 'self' }]
  });

  DS.defineCard({
    id: 'curse_clumsy', name: 'Clumsy', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '🥴',
    desc: 'Unplayable. Ethereal (exhausted at the end of your turn if still in hand).',
    effects: [],
    ethereal: true
  });

  DS.defineCard({
    id: 'curse_parasite', name: 'Parasite', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '🪱',
    desc: 'Unplayable.',
    effects: []
  });

  DS.defineCard({
    id: 'curse_writhe', name: 'Writhe', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '🐍',
    desc: 'Unplayable. Innate (always drawn in your opening hand).',
    effects: [],
    innate: true
  });

  DS.defineCard({
    id: 'curse_shame', name: 'Shame', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '😳',
    desc: 'Unplayable. At the end of your turn, gain 1 Frail.',
    effects: [],
    onEndTurnInHand: [{ op: 'apply', status: 'frail', amount: 1, to: 'self' }]
  });

  DS.defineCard({
    id: 'curse_normality', name: 'Normality', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '📏',
    desc: 'Unplayable. When drawn, you cannot play attacks this turn.',
    effects: [],
    onDraw: [{ op: 'apply', status: 'entangle', amount: 1, to: 'self' }]
  });

  // =====================================================================
  // Status cards (class status, unplayable, shared ids)
  // =====================================================================

  DS.defineCard({
    id: 'status_wound', name: 'Wound', class: 'status', type: 'status', rarity: 'special',
    cost: -1, target: 'none', icon: '🩸',
    desc: 'Unplayable.',
    effects: []
  });

  DS.defineCard({
    id: 'status_dazed', name: 'Dazed', class: 'status', type: 'status', rarity: 'special',
    cost: -1, target: 'none', icon: '💫',
    desc: 'Unplayable. Ethereal (exhausted at the end of your turn if still in hand).',
    effects: [],
    ethereal: true
  });

  DS.defineCard({
    id: 'status_burn', name: 'Burn', class: 'status', type: 'status', rarity: 'special',
    cost: -1, target: 'none', icon: '🔥',
    desc: 'Unplayable. At the end of your turn, take 2 damage.',
    effects: [],
    onEndTurnInHand: [{ op: 'lose_hp', amount: 2, to: 'self' }]
  });

  DS.defineCard({
    id: 'status_slimed', name: 'Slimed', class: 'status', type: 'status', rarity: 'special',
    cost: 1, target: 'none', icon: '🟢',
    desc: 'Exhaust. Does nothing else.',
    effects: [],
    exhaust: true
  });

  DS.defineCard({
    id: 'status_void', name: 'Void', class: 'status', type: 'status', rarity: 'special',
    cost: -1, target: 'none', icon: '🕳️',
    desc: 'Unplayable. Ethereal. When drawn, lose 1 Energy.',
    effects: [],
    ethereal: true,
    onDraw: [{ op: 'energy', amount: -1 }]
  });

  // =====================================================================
  // Colorless cards
  // =====================================================================

  // --- UNCOMMON ---

  DS.defineCard({
    id: 'cl_quick_jab', name: 'Quick Jab', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 0, target: 'enemy', icon: '👊',
    desc: 'Deal 4 damage. Draw 1 card.',
    effects: [{ op: 'damage', amount: 4 }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Deal 6 damage. Draw 1 card.',
      effects: [{ op: 'damage', amount: 6 }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'cl_brass_knuckles', name: 'Brass Knuckles', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🥊',
    desc: 'Deal 9 damage. If this kills, gain 1 Energy.',
    effects: [{ op: 'damage', amount: 9, onKill: [{ op: 'energy', amount: 1 }] }],
    upgrade: {
      desc: 'Deal 12 damage. If this kills, gain 1 Energy.',
      effects: [{ op: 'damage', amount: 12, onKill: [{ op: 'energy', amount: 1 }] }]
    }
  });

  DS.defineCard({
    id: 'cl_cleaving_gale', name: 'Cleaving Gale', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '🌪️',
    desc: 'Deal 6 damage to ALL enemies.',
    effects: [{ op: 'damage', amount: 6, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 9 damage to ALL enemies.',
      effects: [{ op: 'damage', amount: 9, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'cl_bloodletting_knife', name: 'Bloodletting Knife', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🔪',
    desc: 'Lose 2 HP. Deal 12 damage.',
    effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'damage', amount: 12 }],
    upgrade: {
      desc: 'Lose 2 HP. Deal 16 damage.',
      effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'damage', amount: 16 }]
    }
  });

  DS.defineCard({
    id: 'cl_leech_strike', name: 'Leech Strike', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🧛',
    desc: 'Deal 6 damage. Heal 3 HP.',
    effects: [{ op: 'damage', amount: 6 }, { op: 'heal', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Deal 8 damage. Heal 4 HP.',
      effects: [{ op: 'damage', amount: 8 }, { op: 'heal', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_executioners_edge', name: "Executioner's Edge", class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🗡️',
    desc: 'Deal 7 damage. If this kills, gain 2 max HP.',
    effects: [{ op: 'damage', amount: 7, onKill: [{ op: 'max_hp', amount: 2 }] }],
    upgrade: {
      desc: 'Deal 10 damage. If this kills, gain 3 max HP.',
      effects: [{ op: 'damage', amount: 10, onKill: [{ op: 'max_hp', amount: 3 }] }]
    }
  });

  DS.defineCard({
    id: 'cl_twin_fang', name: 'Twin Fang', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🦷',
    desc: 'Deal 4 damage twice.',
    effects: [{ op: 'damage', amount: 4, times: 2 }],
    upgrade: {
      desc: 'Deal 5 damage twice.',
      effects: [{ op: 'damage', amount: 5, times: 2 }]
    }
  });

  DS.defineCard({
    id: 'cl_stray_bolt', name: 'Stray Bolt', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'random_enemy', icon: '⚡',
    desc: 'Deal 4 damage to a random enemy 3 times.',
    effects: [{ op: 'damage', amount: 4, times: 3, to: 'random_enemy' }],
    upgrade: {
      desc: 'Deal 5 damage to a random enemy 3 times.',
      effects: [{ op: 'damage', amount: 5, times: 3, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'cl_skewer', name: 'Skewer', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🍢',
    desc: 'Deal 3 damage, plus 2 for each card you have played this turn.',
    effects: [{ op: 'damage', amount: { v: 'cards_played', mul: 2, add: 3 } }],
    upgrade: {
      desc: 'Deal 4 damage, plus 3 for each card you have played this turn.',
      effects: [{ op: 'damage', amount: { v: 'cards_played', mul: 3, add: 4 } }]
    }
  });

  DS.defineCard({
    id: 'cl_iron_guard', name: 'Iron Guard', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🛡️',
    desc: 'Gain 10 Block. Exhaust.',
    effects: [{ op: 'block', amount: 10, to: 'self' }],
    exhaust: true,
    upgrade: {
      desc: 'Gain 14 Block. Exhaust.',
      effects: [{ op: 'block', amount: 14, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_second_wind', name: 'Second Wind', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🌬️',
    desc: 'Heal 4 HP. Gain 6 Block.',
    effects: [{ op: 'heal', amount: 4, to: 'self' }, { op: 'block', amount: 6, to: 'self' }],
    upgrade: {
      desc: 'Heal 6 HP. Gain 8 Block.',
      effects: [{ op: 'heal', amount: 6, to: 'self' }, { op: 'block', amount: 8, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_scavenge', name: 'Scavenge', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🎒',
    desc: 'Draw 3 cards. Then discard 1 card.',
    effects: [{ op: 'draw', amount: 3 }, { op: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Draw 4 cards. Then discard 1 card.',
      effects: [{ op: 'draw', amount: 4 }, { op: 'discard', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'cl_recycle', name: 'Recycle', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '♻️',
    desc: 'Discard 2 cards. Draw 3 cards.',
    effects: [{ op: 'discard', amount: 2 }, { op: 'draw', amount: 3 }],
    upgrade: {
      desc: 'Discard 1 card. Draw 3 cards.',
      effects: [{ op: 'discard', amount: 1 }, { op: 'draw', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'cl_adrenaline', name: 'Adrenaline', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '💉',
    desc: 'Gain 2 Energy. Draw 2 cards. Exhaust.',
    effects: [{ op: 'energy', amount: 2 }, { op: 'draw', amount: 2 }],
    exhaust: true,
    upgrade: {
      desc: 'Gain 2 Energy. Draw 3 cards. Exhaust.',
      effects: [{ op: 'energy', amount: 2 }, { op: 'draw', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'cl_fortify', name: 'Fortify', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧱',
    desc: 'Gain 5 Block. Next turn, gain 5 Block.',
    effects: [{ op: 'block', amount: 5, to: 'self' }, { op: 'apply', status: 'next_turn_block', amount: 5, to: 'self' }],
    upgrade: {
      desc: 'Gain 7 Block. Next turn, gain 7 Block.',
      effects: [{ op: 'block', amount: 7, to: 'self' }, { op: 'apply', status: 'next_turn_block', amount: 7, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_hoard', name: 'Hoard', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '💰',
    desc: 'Gain 15 gold. Add a Wound to your discard pile.',
    effects: [{ op: 'gold', amount: 15 }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Gain 20 gold. Add a Dazed to your discard pile.',
      effects: [{ op: 'gold', amount: 20 }, { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'cl_tinkering', name: 'Tinkering', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔧',
    desc: 'Add a random colorless skill to your hand.',
    effects: [{ op: 'add_card', card: 'random', class: 'colorless', type: 'skill', to: 'hand', amount: 1 }],
    upgrade: {
      desc: 'Add 2 random colorless skills to your hand.',
      effects: [{ op: 'add_card', card: 'random', class: 'colorless', type: 'skill', to: 'hand', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'cl_bandage', name: 'Bandage', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🩹',
    desc: 'Heal 6 HP. Exhaust.',
    effects: [{ op: 'heal', amount: 6, to: 'self' }],
    exhaust: true,
    upgrade: {
      desc: 'Heal 9 HP. Exhaust.',
      effects: [{ op: 'heal', amount: 9, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_reforge', name: 'Reforge', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔨',
    desc: 'Upgrade 2 cards in your hand for this combat.',
    effects: [{ op: 'upgrade_hand', amount: 2 }],
    upgrade: {
      desc: 'Upgrade 3 cards in your hand for this combat.',
      effects: [{ op: 'upgrade_hand', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'cl_double_down', name: 'Double Down', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🎲',
    desc: 'Your next 2 attacks are played twice.',
    effects: [{ op: 'apply', status: 'double_tap', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Your next 3 attacks are played twice.',
      effects: [{ op: 'apply', status: 'double_tap', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_thick_skin', name: 'Thick Skin', class: 'colorless', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🦔',
    desc: 'Gain 2 Dexterity.',
    effects: [{ op: 'apply', status: 'dexterity', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Dexterity.',
      effects: [{ op: 'apply', status: 'dexterity', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_stoneskin', name: 'Stoneskin', class: 'colorless', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪨',
    desc: 'At the end of your turn, gain 2 Block.',
    effects: [{ op: 'apply', status: 'metallicize', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'At the end of your turn, gain 3 Block.',
      effects: [{ op: 'apply', status: 'metallicize', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_bloodlust', name: 'Bloodlust', class: 'colorless', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '😈',
    desc: 'Whenever you kill an enemy, gain 4 Block.',
    effects: [{ op: 'apply', status: 'cl_bloodlust_st', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Whenever you kill an enemy, gain 6 Block.',
      effects: [{ op: 'apply', status: 'cl_bloodlust_st', amount: 6, to: 'self' }]
    }
  });

  // --- RARE ---

  DS.defineCard({
    id: 'cl_power_surge', name: 'Power Surge', class: 'colorless', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🔋',
    desc: 'At the start of each turn, gain 1 Energy.',
    effects: [{ op: 'apply', status: 'cl_surge', amount: 1, to: 'self' }],
    upgrade: {
      cost: 1,
      desc: 'At the start of each turn, gain 1 Energy.',
      effects: [{ op: 'apply', status: 'cl_surge', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_vampiric_covenant', name: 'Vampiric Covenant', class: 'colorless', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '🧛',
    desc: 'Whenever you hit an enemy with an attack, heal 1 HP.',
    effects: [{ op: 'apply', status: 'cl_vampirism', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you hit an enemy with an attack, heal 2 HP.',
      effects: [{ op: 'apply', status: 'cl_vampirism', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_pact_of_iron', name: 'Pact of Iron', class: 'colorless', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '🪝',
    desc: 'Whenever you are attacked, gain 1 Strength.',
    effects: [{ op: 'apply', status: 'cl_blood_pact', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you are attacked, gain 2 Strength.',
      effects: [{ op: 'apply', status: 'cl_blood_pact', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_alchemists_stone', name: "Alchemist's Stone", class: 'colorless', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '⚗️',
    desc: 'Whenever any enemy dies, gain 1 Energy.',
    effects: [{ op: 'apply', status: 'cl_philosophers', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever any enemy dies, gain 2 Energy.',
      effects: [{ op: 'apply', status: 'cl_philosophers', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_sands_of_time', name: 'Sands of Time', class: 'colorless', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '⌛',
    desc: 'At the start of each turn, draw 1 extra card.',
    effects: [{ op: 'apply', status: 'cl_hourglass', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, draw 2 extra cards.',
      effects: [{ op: 'apply', status: 'cl_hourglass', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_mirror_guard', name: 'Mirror Guard', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🪞',
    desc: 'Gain 14 Block. Exhaust.',
    effects: [{ op: 'block', amount: 14, to: 'self' }],
    exhaust: true,
    upgrade: {
      desc: 'Gain 18 Block. Exhaust.',
      effects: [{ op: 'block', amount: 18, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_reaping_scythe', name: 'Reaping Scythe', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🌙',
    desc: 'Deal 10 damage to ALL enemies. Heal 4 HP for each enemy killed.',
    effects: [{ op: 'damage', amount: 10, to: 'all_enemies', onKill: [{ op: 'heal', amount: 4, to: 'self' }] }],
    upgrade: {
      desc: 'Deal 13 damage to ALL enemies. Heal 5 HP for each enemy killed.',
      effects: [{ op: 'damage', amount: 13, to: 'all_enemies', onKill: [{ op: 'heal', amount: 5, to: 'self' }] }]
    }
  });

  DS.defineCard({
    id: 'cl_last_stand', name: 'Last Stand', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🕯️',
    desc: 'Heal 30% of your max HP. Exhaust.',
    effects: [{ op: 'heal', amount: { v: 'max_hp', mul: 0.3 }, to: 'self' }],
    exhaust: true,
    upgrade: {
      desc: 'Heal 50% of your max HP. Exhaust.',
      effects: [{ op: 'heal', amount: { v: 'max_hp', mul: 0.5 }, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_chrono_shift', name: 'Chrono Shift', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🕰️',
    desc: 'Draw 4 cards. Exhaust.',
    effects: [{ op: 'draw', amount: 4 }],
    exhaust: true,
    upgrade: {
      desc: 'Draw 5 cards.',
      effects: [{ op: 'draw', amount: 5 }],
      exhaust: false
    }
  });

  DS.defineCard({
    id: 'cl_meteor_strike', name: 'Meteor Strike', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 3, target: 'enemy', icon: '🌠',
    desc: 'Deal 24 damage.',
    effects: [{ op: 'damage', amount: 24 }],
    upgrade: {
      desc: 'Deal 30 damage.',
      effects: [{ op: 'damage', amount: 30 }]
    }
  });

  DS.defineCard({
    id: 'cl_ancient_pact', name: 'Ancient Pact', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '📜',
    desc: 'Lose 6 HP. Gain 3 Strength.',
    effects: [{ op: 'lose_hp', amount: 6, to: 'self' }, { op: 'apply', status: 'strength', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Lose 4 HP. Gain 4 Strength.',
      effects: [{ op: 'lose_hp', amount: 4, to: 'self' }, { op: 'apply', status: 'strength', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_overload', name: 'Overload', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 'X', target: 'enemy', icon: '💥',
    desc: 'Deal 7 damage X times.',
    effects: [{ op: 'damage', amount: 7, times: { v: 'x' } }],
    upgrade: {
      desc: 'Deal 9 damage X times.',
      effects: [{ op: 'damage', amount: 9, times: { v: 'x' } }]
    }
  });

  DS.defineCard({
    id: 'cl_conjure', name: 'Conjure', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 1, target: 'none', icon: '🪄',
    desc: 'Add 2 random colorless cards to your hand.',
    effects: [{ op: 'add_card', card: 'random', class: 'colorless', to: 'hand', amount: 2 }],
    upgrade: {
      desc: 'Add 3 random colorless cards to your hand.',
      effects: [{ op: 'add_card', card: 'random', class: 'colorless', to: 'hand', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'cl_cataclysm', name: 'Cataclysm', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 3, target: 'all_enemies', icon: '🌋',
    desc: 'Deal 16 damage to ALL enemies. Apply 2 Vulnerable to ALL enemies.',
    effects: [{ op: 'damage', amount: 16, to: 'all_enemies' }, { op: 'apply', status: 'vulnerable', amount: 2, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 20 damage to ALL enemies. Apply 2 Vulnerable to ALL enemies.',
      effects: [{ op: 'damage', amount: 20, to: 'all_enemies' }, { op: 'apply', status: 'vulnerable', amount: 2, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'cl_time_warp', name: 'Time Warp', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 1, target: 'none', icon: '🌀',
    desc: 'Next turn, gain 3 Energy and draw 2 extra cards.',
    effects: [{ op: 'apply', status: 'energized', amount: 3, to: 'self' }, { op: 'apply', status: 'draw_next', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Next turn, gain 4 Energy and draw 3 extra cards.',
      effects: [{ op: 'apply', status: 'energized', amount: 4, to: 'self' }, { op: 'apply', status: 'draw_next', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_phantom_step', name: 'Phantom Step', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 2, target: 'none', icon: '👻',
    desc: 'Gain 1 Intangible. Exhaust.',
    effects: [{ op: 'apply', status: 'intangible', amount: 1, to: 'self' }],
    exhaust: true,
    upgrade: {
      desc: 'Gain 2 Intangible. Exhaust.',
      effects: [{ op: 'apply', status: 'intangible', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_regen_aura', name: 'Regen Aura', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 1, target: 'none', icon: '💚',
    desc: 'Gain 5 Regen.',
    effects: [{ op: 'apply', status: 'regen', amount: 5, to: 'self' }],
    upgrade: {
      desc: 'Gain 7 Regen.',
      effects: [{ op: 'apply', status: 'regen', amount: 7, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_fortress', name: 'Fortress', class: 'colorless', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🏯',
    desc: 'Your Block is no longer removed at the start of each turn.',
    effects: [{ op: 'apply', status: 'barricade', amount: 1, to: 'self' }],
    upgrade: {
      cost: 1,
      desc: 'Your Block is no longer removed at the start of each turn.',
      effects: [{ op: 'apply', status: 'barricade', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_gravebind', name: 'Gravebind', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🪢',
    desc: 'Deal 8 damage. Apply 2 Vulnerable.',
    effects: [{ op: 'damage', amount: 8, to: 'target' }, { op: 'apply', status: 'vulnerable', amount: 2, to: 'target' }],
    upgrade: {
      desc: 'Deal 11 damage. Apply 3 Vulnerable.',
      effects: [{ op: 'damage', amount: 11, to: 'target' }, { op: 'apply', status: 'vulnerable', amount: 3, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'cl_stormcall', name: 'Stormcall', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '⛈️',
    desc: 'Deal 6 damage to ALL enemies twice.',
    effects: [{ op: 'damage', amount: 6, times: 2, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 8 damage to ALL enemies twice.',
      effects: [{ op: 'damage', amount: 8, times: 2, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'cl_grand_forge', name: 'Grand Forge', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 2, target: 'none', icon: '🏭',
    desc: 'Upgrade all cards in your hand for this combat. Exhaust.',
    effects: [{ op: 'upgrade_hand', amount: 'all' }],
    exhaust: true,
    upgrade: {
      cost: 1,
      desc: 'Upgrade all cards in your hand for this combat. Exhaust.',
      effects: [{ op: 'upgrade_hand', amount: 'all' }]
    }
  });

  // --- SPECIAL (never offered in rewards; granted by events and relics by id) ---

  // Power status used by cl_dusk_crown.
  DS.defineStatus({
    id: 'cl_crown', name: 'Dusk Crown', desc: 'At the start of each turn, gain {n} Strength and {n} Dexterity.',
    type: 'buff', icon: '👑', stacks: true, expire: null, decay: null,
    triggers: {
      onTurnStart: [
        { op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' },
        { op: 'apply', status: 'dexterity', amount: { v: 'stacks' }, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'cl_ancient_blessing', name: 'Ancient Blessing', class: 'colorless', type: 'power', rarity: 'special',
    cost: 1, target: 'self', icon: '🏺',
    desc: 'Gain 2 Strength and 2 Dexterity.',
    effects: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }, { op: 'apply', status: 'dexterity', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Strength and 3 Dexterity.',
      effects: [{ op: 'apply', status: 'strength', amount: 3, to: 'self' }, { op: 'apply', status: 'dexterity', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_second_heart', name: 'Second Heart', class: 'colorless', type: 'skill', rarity: 'special',
    cost: 1, target: 'none', icon: '💗',
    desc: 'Gain 8 max HP. Exhaust.',
    effects: [{ op: 'max_hp', amount: 8 }],
    exhaust: true,
    upgrade: {
      desc: 'Gain 12 max HP. Exhaust.',
      effects: [{ op: 'max_hp', amount: 12 }]
    }
  });

  DS.defineCard({
    id: 'cl_oblivion_seed', name: 'Oblivion Seed', class: 'colorless', type: 'skill', rarity: 'special',
    cost: 0, target: 'none', icon: '🥀',
    desc: 'Exhaust all cards in your hand. Draw 4 cards.',
    effects: [{ op: 'exhaust', amount: 'all' }, { op: 'draw', amount: 4 }],
    upgrade: {
      desc: 'Exhaust all cards in your hand. Draw 5 cards.',
      effects: [{ op: 'exhaust', amount: 'all' }, { op: 'draw', amount: 5 }]
    }
  });

  DS.defineCard({
    id: 'cl_gilded_wager', name: 'Gilded Wager', class: 'colorless', type: 'skill', rarity: 'special',
    cost: 0, target: 'none', icon: '🪙',
    desc: 'Gain 25 gold. Lose 6 HP. Exhaust.',
    effects: [{ op: 'gold', amount: 25 }, { op: 'lose_hp', amount: 6, to: 'self' }],
    exhaust: true,
    upgrade: {
      desc: 'Gain 40 gold. Lose 6 HP. Exhaust.',
      effects: [{ op: 'gold', amount: 40 }, { op: 'lose_hp', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_dusk_crown', name: 'Dusk Crown', class: 'colorless', type: 'power', rarity: 'special',
    cost: 2, target: 'self', icon: '👑',
    desc: 'At the start of each turn, gain 1 Strength and 1 Dexterity.',
    effects: [{ op: 'apply', status: 'cl_crown', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, gain 2 Strength and 2 Dexterity.',
      effects: [{ op: 'apply', status: 'cl_crown', amount: 2, to: 'self' }]
    }
  });

})();
