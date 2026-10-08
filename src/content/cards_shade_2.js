(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // =====================================================================
  // SHADE, expansion set 2. Builds on cards_shade.js (poison, shiv, discard, evasion).
  // New archetype AMBUSH:
  //   MARK    : the built-in 'mark' status is a combo counter. Setup cards stack it,
  //             finishers read it with {v:'status', status:'mark'} and consume it.
  //   TURN 1-2: big payoffs that check {v:'turn'} (turns 1 and 2 only).
  //   SETUP   : innate and retain cards that prepare the opening.
  //   PRICE   : intangible / evasion paid for with Dazed cards in the discard pile.
  // Also deepens poison catalysts, shiv generation from exhaust, and discard synergy.
  // =====================================================================

  // =====================================================================
  // Class relics (rewarding Ambush / Mark)
  // =====================================================================

  DS.defineRelic({
    id: 'sh_relic2_tripwire',
    name: 'Tripwire Cord',
    desc: 'At the start of each combat, apply 2 Mark to a random enemy.',
    flavor: 'Strung across the doorway. Let them walk into their own ending.',
    rarity: 'common',
    icon: '🪢',
    class: 'shade',
    passive: {},
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'mark', amount: 2, to: 'random_enemy' }]
    }
  });

  DS.defineRelic({
    id: 'sh_relic2_nightwatch',
    name: 'Nightwatch Lens',
    desc: 'On turns 1 and 2, gain 1 Energy and draw 1 card at the start of your turn.',
    flavor: 'Ground glass for the first hour of the hunt. The rest of the night belongs to the knives.',
    rarity: 'uncommon',
    icon: '🔦',
    class: 'shade',
    passive: {},
    triggers: {
      onTurnStart: [
        {
          op: 'if',
          cond: { left: { v: 'turn' }, cmp: '<=', right: 2 },
          then: [{ op: 'energy', amount: 1 }, { op: 'draw', amount: 1 }],
          else: []
        }
      ]
    }
  });

  DS.defineRelic({
    id: 'sh_relic2_ledger',
    name: "Assassin's Ledger",
    desc: 'Whenever you play an Attack on a Marked enemy, deal 2 damage to ALL enemies.',
    flavor: 'Every name in it carries a small mark, and every mark is paid in full.',
    rarity: 'rare',
    icon: '📒',
    class: 'shade',
    passive: {},
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'status', status: 'mark', of: 'target' }, cmp: '>', right: 0 },
            then: [{ op: 'damage', amount: 2, to: 'all_enemies' }],
            else: []
          }
        ]
      }
    }
  });

  // =====================================================================
  // Custom statuses (powers granted to self by the cards below)
  // Ids use the sh_aura2_ prefix so they never collide with a card id.
  // =====================================================================

  DS.defineStatus({
    id: 'sh_aura2_venom_hands', name: 'Venomous Hands', type: 'buff', icon: '🕷️', stacks: true,
    desc: 'Whenever you discard a card, apply {n} Poison to a random enemy.',
    triggers: {
      onCardDiscarded: [{ op: 'apply', status: 'poison', amount: { v: 'stacks' }, to: 'random_enemy' }]
    }
  });

  DS.defineStatus({
    id: 'sh_aura2_lurker', name: 'Lurker', type: 'buff', icon: '👁️', stacks: true,
    desc: 'Whenever you play a Skill, apply {n} Mark to a random enemy.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'apply', status: 'mark', amount: { v: 'stacks' }, to: 'random_enemy' }]
      }
    }
  });

  DS.defineStatus({
    id: 'sh_aura2_shard_storm', name: 'Shard Storm', type: 'buff', icon: '💎', stacks: true,
    desc: 'The first time each turn you exhaust a card, add {n} Shiv(s) to your hand.',
    triggers: {
      onCardExhausted: {
        oncePerTurn: true,
        effects: [{ op: 'add_card', card: 'sh_shiv', to: 'hand', amount: { v: 'stacks' } }]
      }
    }
  });

  DS.defineStatus({
    id: 'sh_aura2_contagion', name: 'Toxic Contagion', type: 'buff', icon: '🧬', stacks: true,
    desc: 'Whenever any enemy dies, apply {n} Poison to ALL enemies.',
    triggers: {
      onEnemyDeath: [{ op: 'apply', status: 'poison', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  DS.defineStatus({
    id: 'sh_aura2_hunters_eye', name: "Hunter's Eye", type: 'buff', icon: '🦅', stacks: true,
    desc: 'At the start of your turn, apply {n} Mark to a random enemy.',
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'mark', amount: { v: 'stacks' }, to: 'random_enemy' }]
    }
  });

  DS.defineStatus({
    id: 'sh_aura2_crucible', name: 'Venom Crucible', type: 'buff', icon: '🏺', stacks: true,
    desc: 'Whenever you discard a card, apply {n} Poison to ALL enemies.',
    triggers: {
      onCardDiscarded: [{ op: 'apply', status: 'poison', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  DS.defineStatus({
    id: 'sh_aura2_ambush_ready', name: 'Ambush Ready', type: 'buff', icon: '🌙', stacks: true,
    desc: 'On turns 1 and 2, whenever you play an Attack, deal {n} damage to a random enemy.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'turn' }, cmp: '<=', right: 2 },
            then: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }],
            else: []
          }
        ]
      }
    }
  });

  // =====================================================================
  // COMMON (14)
  // =====================================================================

  DS.defineCard({
    id: 'sh_marking_knife', name: 'Marking Knife', class: 'shade', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '📌',
    desc: 'Deal 5 damage. Apply 2 Mark.',
    effects: [
      { op: 'damage', amount: 5, to: 'target' },
      { op: 'apply', status: 'mark', amount: 2, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 7 damage. Apply 3 Mark.',
      effects: [
        { op: 'damage', amount: 7, to: 'target' },
        { op: 'apply', status: 'mark', amount: 3, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_shadow_jab', name: 'Shadow Jab', class: 'shade', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🥷',
    desc: 'Deal 5 damage. If the target is Marked, deal 5 more.',
    effects: [
      { op: 'damage', amount: 5, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'mark', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 5, to: 'target' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 7 damage. If the target is Marked, deal 7 more.',
      effects: [
        { op: 'damage', amount: 7, to: 'target' },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'mark', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 7, to: 'target' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_venom_spit', name: 'Venom Spit', class: 'shade', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🐸',
    desc: 'Deal 4 damage. Apply 2 Poison.',
    effects: [
      { op: 'damage', amount: 4, to: 'target' },
      { op: 'apply', status: 'poison', amount: 2, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 6 damage. Apply 3 Poison.',
      effects: [
        { op: 'damage', amount: 6, to: 'target' },
        { op: 'apply', status: 'poison', amount: 3, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_night_slash', name: 'Night Slash', class: 'shade', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🌃',
    desc: 'Deal 6 damage. If this is your 2nd or later card this turn, draw 1 card.',
    effects: [
      { op: 'damage', amount: 6, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'cards_played' }, cmp: '>=', right: 2 },
        then: [{ op: 'draw', amount: 1 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 8 damage. If this is your 2nd or later card this turn, draw 1 card.',
      effects: [
        { op: 'damage', amount: 8, to: 'target' },
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
    id: 'sh_pinprick', name: 'Pinprick', class: 'shade', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '📍',
    desc: 'Deal 3 damage. Apply 1 Mark.',
    effects: [
      { op: 'damage', amount: 3, to: 'target' },
      { op: 'apply', status: 'mark', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 4 damage. Apply 2 Mark.',
      effects: [
        { op: 'damage', amount: 4, to: 'target' },
        { op: 'apply', status: 'mark', amount: 2, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_corner_gouge', name: 'Corner Gouge', class: 'shade', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🔱',
    desc: 'Deal 6 damage. If the target is Weak, apply 1 Mark.',
    effects: [
      { op: 'damage', amount: 6, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'weak', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'apply', status: 'mark', amount: 1, to: 'target' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 8 damage. If the target is Weak, apply 2 Mark.',
      effects: [
        { op: 'damage', amount: 8, to: 'target' },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'weak', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'apply', status: 'mark', amount: 2, to: 'target' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_lie_in_wait', name: 'Lie in Wait', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🪤', retain: true,
    desc: 'Gain 6 Block. Retain.',
    effects: [{ op: 'block', amount: 6, to: 'self' }],
    upgrade: { desc: 'Gain 9 Block. Retain.', effects: [{ op: 'block', amount: 9, to: 'self' }] }
  });

  DS.defineCard({
    id: 'sh_quick_snare', name: 'Quick Snare', class: 'shade', type: 'skill', rarity: 'common',
    cost: 0, target: 'enemy', icon: '🪢', innate: true,
    desc: 'Innate. Apply 1 Mark.',
    effects: [{ op: 'apply', status: 'mark', amount: 1, to: 'target' }],
    upgrade: { desc: 'Innate. Apply 2 Mark.', effects: [{ op: 'apply', status: 'mark', amount: 2, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_pocket_toxin', name: 'Pocket Toxin', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🪙',
    desc: 'Discard 1 card. Apply 3 Poison.',
    effects: [
      { op: 'discard', amount: 1 },
      { op: 'apply', status: 'poison', amount: 3, to: 'target' }
    ],
    upgrade: {
      desc: 'Discard 1 card. Apply 4 Poison.',
      effects: [
        { op: 'discard', amount: 1 },
        { op: 'apply', status: 'poison', amount: 4, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_sleeve_blades', name: 'Sleeve Blades', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🧷',
    desc: 'Add 1 Shiv to your hand. Gain 2 Block.',
    effects: [
      { op: 'add_card', card: 'sh_shiv', to: 'hand', amount: 1 },
      { op: 'block', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Add 2 Shivs to your hand. Gain 3 Block.',
      effects: [
        { op: 'add_card', card: 'sh_shiv', to: 'hand', amount: 2 },
        { op: 'block', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_hooded_gaze', name: 'Hooded Gaze', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '👁️',
    desc: 'Gain 1 Dexterity. Draw 1 card.',
    effects: [
      { op: 'apply', status: 'dexterity', amount: 1, to: 'self' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Gain 2 Dexterity. Draw 1 card.',
      effects: [
        { op: 'apply', status: 'dexterity', amount: 2, to: 'self' },
        { op: 'draw', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_tripwire', name: 'Tripwire', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'none', icon: '🧵',
    desc: 'Apply 2 Mark to a random enemy. Draw 1 card.',
    effects: [
      { op: 'apply', status: 'mark', amount: 2, to: 'random_enemy' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Apply 3 Mark to a random enemy. Draw 1 card.',
      effects: [
        { op: 'apply', status: 'mark', amount: 3, to: 'random_enemy' },
        { op: 'draw', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_bandage_roll', name: 'Bandage Roll', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🩹',
    desc: 'Heal 3 HP. Gain 3 Block.',
    effects: [
      { op: 'heal', amount: 3, to: 'self' },
      { op: 'block', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Heal 4 HP. Gain 4 Block.',
      effects: [
        { op: 'heal', amount: 4, to: 'self' },
        { op: 'block', amount: 4, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_venom_hands', name: 'Venomous Hands', class: 'shade', type: 'power', rarity: 'common',
    cost: 1, target: 'none', icon: '🕷️',
    desc: 'Whenever you discard a card, apply 1 Poison to a random enemy.',
    effects: [{ op: 'apply', status: 'sh_aura2_venom_hands', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you discard a card, apply 2 Poison to a random enemy.',
      effects: [{ op: 'apply', status: 'sh_aura2_venom_hands', amount: 2, to: 'self' }]
    }
  });

  // =====================================================================
  // UNCOMMON (17)
  // =====================================================================

  DS.defineCard({
    id: 'sh_reap_marked', name: 'Reap the Marked', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🌾',
    desc: 'Deal 2 damage plus 3 for each Mark on the target. Remove all Mark from it.',
    effects: [
      { op: 'damage', amount: { v: 'status', status: 'mark', of: 'target', mul: 3, add: 2 }, to: 'target' },
      { op: 'remove_status', status: 'mark', to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 3 damage plus 4 for each Mark on the target. Remove all Mark from it.',
      effects: [
        { op: 'damage', amount: { v: 'status', status: 'mark', of: 'target', mul: 4, add: 3 }, to: 'target' },
        { op: 'remove_status', status: 'mark', to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_ambush_blow', name: 'Ambush Blow', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '💥',
    desc: 'Deal 8 damage. On turn 1 or 2, deal 8 more damage.',
    effects: [
      { op: 'damage', amount: 8, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'turn' }, cmp: '<=', right: 2 },
        then: [{ op: 'damage', amount: 8, to: 'target' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 10 damage. On turn 1 or 2, deal 10 more damage.',
      effects: [
        { op: 'damage', amount: 10, to: 'target' },
        {
          op: 'if',
          cond: { left: { v: 'turn' }, cmp: '<=', right: 2 },
          then: [{ op: 'damage', amount: 10, to: 'target' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_shadow_dance', name: 'Shadow Dance', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🕺',
    desc: 'Deal 4 damage 2 times. Discard 1 card.',
    effects: [
      { op: 'damage', amount: 4, times: 2, to: 'target' },
      { op: 'discard', amount: 1 }
    ],
    upgrade: {
      desc: 'Deal 5 damage 2 times. Discard 1 card.',
      effects: [
        { op: 'damage', amount: 5, times: 2, to: 'target' },
        { op: 'discard', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_gut_hook', name: 'Gut Hook', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🎣',
    desc: 'Deal 10 damage. Apply 2 Mark.',
    effects: [
      { op: 'damage', amount: 10, to: 'target' },
      { op: 'apply', status: 'mark', amount: 2, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 13 damage. Apply 3 Mark.',
      effects: [
        { op: 'damage', amount: 13, to: 'target' },
        { op: 'apply', status: 'mark', amount: 3, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_shiv_volley', name: 'Shiv Volley', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '🏹',
    desc: 'Deal 3 damage to ALL enemies. Add 1 Shiv to your hand.',
    effects: [
      { op: 'damage', amount: 3, to: 'all_enemies' },
      { op: 'add_card', card: 'sh_shiv', to: 'hand', amount: 1 }
    ],
    upgrade: {
      desc: 'Deal 4 damage to ALL enemies. Add 2 Shivs to your hand.',
      effects: [
        { op: 'damage', amount: 4, to: 'all_enemies' },
        { op: 'add_card', card: 'sh_shiv', to: 'hand', amount: 2 }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_infected_edge', name: 'Infected Edge', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🤢',
    desc: 'Deal 4 damage. Apply 3 Poison. Discard 1 card.',
    effects: [
      { op: 'damage', amount: 4, to: 'target' },
      { op: 'apply', status: 'poison', amount: 3, to: 'target' },
      { op: 'discard', amount: 1 }
    ],
    upgrade: {
      desc: 'Deal 5 damage. Apply 4 Poison. Discard 1 card.',
      effects: [
        { op: 'damage', amount: 5, to: 'target' },
        { op: 'apply', status: 'poison', amount: 4, to: 'target' },
        { op: 'discard', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_sever_cord', name: 'Sever Cord', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '✂️',
    desc: 'Exhaust 1 card from your hand. Deal 9 damage.',
    effects: [
      { op: 'exhaust', amount: 1 },
      { op: 'damage', amount: 9, to: 'target' }
    ],
    upgrade: {
      desc: 'Exhaust 1 card from your hand. Deal 12 damage.',
      effects: [
        { op: 'exhaust', amount: 1 },
        { op: 'damage', amount: 12, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_silent_sweep', name: 'Silent Sweep', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '🧹',
    desc: 'Deal 4 damage to ALL enemies. Apply 1 Mark to ALL enemies.',
    effects: [
      { op: 'damage', amount: 4, to: 'all_enemies' },
      { op: 'apply', status: 'mark', amount: 1, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 6 damage to ALL enemies. Apply 2 Mark to ALL enemies.',
      effects: [
        { op: 'damage', amount: 6, to: 'all_enemies' },
        { op: 'apply', status: 'mark', amount: 2, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_ankle_hook', name: 'Ankle Hook', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪝',
    desc: 'Deal 3 damage. Apply 1 Weak. Apply 1 Mark.',
    effects: [
      { op: 'damage', amount: 3, to: 'target' },
      { op: 'apply', status: 'weak', amount: 1, to: 'target' },
      { op: 'apply', status: 'mark', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 4 damage. Apply 2 Weak. Apply 2 Mark.',
      effects: [
        { op: 'damage', amount: 4, to: 'target' },
        { op: 'apply', status: 'weak', amount: 2, to: 'target' },
        { op: 'apply', status: 'mark', amount: 2, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_opening_feint', name: 'Opening Feint', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 0, target: 'enemy', icon: '🎭',
    desc: 'Deal 5 damage. On turn 1 or 2, gain 1 Energy.',
    effects: [
      { op: 'damage', amount: 5, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'turn' }, cmp: '<=', right: 2 },
        then: [{ op: 'energy', amount: 1 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 7 damage. On turn 1 or 2, gain 1 Energy.',
      effects: [
        { op: 'damage', amount: 7, to: 'target' },
        {
          op: 'if',
          cond: { left: { v: 'turn' }, cmp: '<=', right: 2 },
          then: [{ op: 'energy', amount: 1 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_dead_ringer', name: 'Dead Ringer', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🔔',
    desc: 'Apply 2 Weak. Apply 2 Mark.',
    effects: [
      { op: 'apply', status: 'weak', amount: 2, to: 'target' },
      { op: 'apply', status: 'mark', amount: 2, to: 'target' }
    ],
    upgrade: {
      desc: 'Apply 3 Weak. Apply 3 Mark.',
      effects: [
        { op: 'apply', status: 'weak', amount: 3, to: 'target' },
        { op: 'apply', status: 'mark', amount: 3, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_veil_of_smoke', name: 'Veil of Smoke', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🌫️',
    desc: 'Gain 2 Intangible. Add 2 Dazed to your discard pile.',
    effects: [
      { op: 'apply', status: 'intangible', amount: 2, to: 'self' },
      { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 2 }
    ],
    upgrade: {
      desc: 'Gain 3 Intangible. Add 2 Dazed to your discard pile.',
      effects: [
        { op: 'apply', status: 'intangible', amount: 3, to: 'self' },
        { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 2 }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_ambush_lair', name: 'Ambush Lair', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🏕️', innate: true, retain: true,
    desc: 'Innate. Retain. Apply 2 Mark to a random enemy.',
    effects: [{ op: 'apply', status: 'mark', amount: 2, to: 'random_enemy' }],
    upgrade: {
      desc: 'Innate. Retain. Apply 3 Mark to a random enemy.',
      effects: [{ op: 'apply', status: 'mark', amount: 3, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'sh_fester', name: 'Fester', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🍄',
    desc: "Apply 1 Poison. Multiply the target's Poison by 2.",
    effects: [
      { op: 'apply', status: 'poison', amount: 1, to: 'target' },
      { op: 'multiply_status', status: 'poison', factor: 2, to: 'target' }
    ],
    upgrade: {
      desc: "Apply 2 Poison. Multiply the target's Poison by 3.",
      effects: [
        { op: 'apply', status: 'poison', amount: 2, to: 'target' },
        { op: 'multiply_status', status: 'poison', factor: 3, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_dredge_up', name: 'Dredge Up', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🪣',
    desc: 'Discard 2 cards. Gain 1 Energy. Draw 1 card.',
    effects: [
      { op: 'discard', amount: 2 },
      { op: 'energy', amount: 1 },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Discard 2 cards. Gain 1 Energy. Draw 2 cards.',
      effects: [
        { op: 'discard', amount: 2 },
        { op: 'energy', amount: 1 },
        { op: 'draw', amount: 2 }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_lurker', name: 'Lurker', class: 'shade', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🦉',
    desc: 'Whenever you play a Skill, apply 1 Mark to a random enemy.',
    effects: [{ op: 'apply', status: 'sh_aura2_lurker', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play a Skill, apply 2 Mark to a random enemy.',
      effects: [{ op: 'apply', status: 'sh_aura2_lurker', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_shard_storm', name: 'Shard Storm', class: 'shade', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '💎',
    desc: 'The first time each turn you exhaust a card, add 1 Shiv to your hand.',
    effects: [{ op: 'apply', status: 'sh_aura2_shard_storm', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'The first time each turn you exhaust a card, add 2 Shivs to your hand.',
      effects: [{ op: 'apply', status: 'sh_aura2_shard_storm', amount: 2, to: 'self' }]
    }
  });

  // =====================================================================
  // RARE (9)
  // =====================================================================

  DS.defineCard({
    id: 'sh_ambush_storm', name: 'Ambush Storm', class: 'shade', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '⛈️',
    desc: 'Deal 6 damage to ALL enemies. On turn 1 or 2, deal 6 more damage to ALL enemies.',
    effects: [
      { op: 'damage', amount: 6, to: 'all_enemies' },
      {
        op: 'if',
        cond: { left: { v: 'turn' }, cmp: '<=', right: 2 },
        then: [{ op: 'damage', amount: 6, to: 'all_enemies' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 8 damage to ALL enemies. On turn 1 or 2, deal 8 more damage to ALL enemies.',
      effects: [
        { op: 'damage', amount: 8, to: 'all_enemies' },
        {
          op: 'if',
          cond: { left: { v: 'turn' }, cmp: '<=', right: 2 },
          then: [{ op: 'damage', amount: 8, to: 'all_enemies' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_opening_verdict', name: 'Opening Verdict', class: 'shade', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🔨',
    desc: 'Deal 14 damage. On turn 1 or 2, deal 10 more damage.',
    effects: [
      { op: 'damage', amount: 14, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'turn' }, cmp: '<=', right: 2 },
        then: [{ op: 'damage', amount: 10, to: 'target' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 18 damage. On turn 1 or 2, deal 12 more damage.',
      effects: [
        { op: 'damage', amount: 18, to: 'target' },
        {
          op: 'if',
          cond: { left: { v: 'turn' }, cmp: '<=', right: 2 },
          then: [{ op: 'damage', amount: 12, to: 'target' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_hunt_the_pack', name: 'Hunt the Pack', class: 'shade', type: 'attack', rarity: 'rare',
    cost: 'X', target: 'enemy', icon: '🐺',
    desc: 'Spend all Energy. Apply X Mark to the target, then deal 2 damage per Mark on it. Remove all Mark from it.',
    effects: [
      { op: 'apply', status: 'mark', amount: { v: 'x' }, to: 'target' },
      { op: 'damage', amount: { v: 'status', status: 'mark', of: 'target', mul: 2 }, to: 'target' },
      { op: 'remove_status', status: 'mark', to: 'target' }
    ],
    upgrade: {
      desc: 'Spend all Energy. Apply X Mark to the target, then deal 3 damage per Mark on it. Remove all Mark from it.',
      effects: [
        { op: 'apply', status: 'mark', amount: { v: 'x' }, to: 'target' },
        { op: 'damage', amount: { v: 'status', status: 'mark', of: 'target', mul: 3 }, to: 'target' },
        { op: 'remove_status', status: 'mark', to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_toxic_contagion', name: 'Toxic Contagion', class: 'shade', type: 'power', rarity: 'rare',
    cost: 2, target: 'none', icon: '🧫',
    desc: 'Whenever any enemy dies, apply 3 Poison to ALL enemies.',
    effects: [{ op: 'apply', status: 'sh_aura2_contagion', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Whenever any enemy dies, apply 4 Poison to ALL enemies.',
      effects: [{ op: 'apply', status: 'sh_aura2_contagion', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_shade_walk', name: 'Shade Walk', class: 'shade', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🚶',
    desc: 'Gain 3 Intangible. Add 1 Dazed to your discard pile. Draw 2 cards.',
    effects: [
      { op: 'apply', status: 'intangible', amount: 3, to: 'self' },
      { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 },
      { op: 'draw', amount: 2 }
    ],
    upgrade: {
      desc: 'Gain 4 Intangible. Add 1 Dazed to your discard pile. Draw 3 cards.',
      effects: [
        { op: 'apply', status: 'intangible', amount: 4, to: 'self' },
        { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 },
        { op: 'draw', amount: 3 }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_hunters_eye', name: "Hunter's Eye", class: 'shade', type: 'power', rarity: 'rare',
    cost: 2, target: 'none', icon: '🦅',
    desc: 'At the start of your turn, apply 2 Mark to a random enemy.',
    effects: [{ op: 'apply', status: 'sh_aura2_hunters_eye', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'At the start of your turn, apply 3 Mark to a random enemy.',
      effects: [{ op: 'apply', status: 'sh_aura2_hunters_eye', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_venom_crucible', name: 'Venom Crucible', class: 'shade', type: 'power', rarity: 'rare',
    cost: 2, target: 'none', icon: '🏺',
    desc: 'Whenever you discard a card, apply 2 Poison to ALL enemies.',
    effects: [{ op: 'apply', status: 'sh_aura2_crucible', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you discard a card, apply 3 Poison to ALL enemies.',
      effects: [{ op: 'apply', status: 'sh_aura2_crucible', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_shadow_harvest', name: 'Shadow Harvest', class: 'shade', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🧺',
    desc: 'Gain 1 Energy for each card in your hand. Discard your whole hand. Draw 2 cards.',
    effects: [
      { op: 'energy', amount: { v: 'hand' } },
      { op: 'discard', amount: 'all' },
      { op: 'draw', amount: 2 }
    ],
    upgrade: {
      desc: 'Gain 1 Energy for each card in your hand. Discard your whole hand. Draw 3 cards.',
      effects: [
        { op: 'energy', amount: { v: 'hand' } },
        { op: 'discard', amount: 'all' },
        { op: 'draw', amount: 3 }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_ambush_ready', name: 'Ambush Ready', class: 'shade', type: 'power', rarity: 'rare',
    cost: 1, target: 'none', icon: '🌙',
    desc: 'On turns 1 and 2, whenever you play an Attack, deal 4 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'sh_aura2_ambush_ready', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'On turns 1 and 2, whenever you play an Attack, deal 6 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'sh_aura2_ambush_ready', amount: 6, to: 'self' }]
    }
  });

})();
