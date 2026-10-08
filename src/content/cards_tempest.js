(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // TEMPEST: Kaze, the Wandering Tempest (storm-monk).
  // Four interlocking archetypes:
  //   Momentum : every card played builds Momentum (tp_flow). Finishers spend it (tp_releasing_gust,
  //              tp_tailwind_finale, tp_thunder_vault pays Storm). Cheap cards and draw reward long turns.
  //   Stances  : Gale (tp_gale: hit harder, take more) and Stillness (tp_stillness: block each turn end).
  //              Mutually exclusive. Leaving Stillness with an enter-Gale card pays 1 Energy.
  //   Static   : enemies collect Static (tp_static). Lightning Conduit detonates it at a threshold,
  //              Discharge detonates it on demand, Static Field spreads it every turn.
  //   Storm    : Stored Storm (tp_storm_store) is banked by retained and exhaust cards and spent by Release cards.
  // ---------------------------------------------------------------------------

  DS.defineCharacter({
    id: 'tempest',
    name: 'Kaze',
    title: 'The Wandering Tempest',
    desc: 'A storm-monk who walks between weathers. Builds Momentum from every card, shifts between the raging Gale and the still eye of Stillness, and charges enemies with Static until the storm breaks.',
    hp: 72,
    gold: 99,
    icon: '🌩️',
    color: '#8e44ad',
    starterDeck: [
      'tp_strike', 'tp_strike', 'tp_strike', 'tp_strike', 'tp_strike',
      'tp_defend', 'tp_defend', 'tp_defend', 'tp_defend',
      'tp_gust_lash', 'tp_still_breath'
    ],
    starterRelic: 'tp_wind_bell'
  });

  // ===========================================================================
  // RELICS (5): starter, common, uncommon, rare, boss
  // ===========================================================================
  DS.defineRelic({
    id: 'tp_wind_bell',
    name: 'Wind Bell',
    desc: 'At the start of your turn, gain 2 Momentum. The first card you play each turn that costs 2 or more gives 1 Energy back.',
    flavor: 'It only rings for something worth the breath.',
    rarity: 'starter',
    icon: '🔔',
    class: 'tempest',
    passive: {},
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'tp_momentum', amount: 2, to: 'self' }],
      onCardPlayed: {
        when: { costAtLeast: 2 },
        oncePerTurn: true,
        effects: [{ op: 'energy', amount: 1 }]
      }
    }
  });

  DS.defineRelic({
    id: 'tp_prayer_beads',
    name: 'Prayer Beads of the Wind',
    desc: 'The 3rd card you play each turn gives 2 Block.',
    flavor: 'Each bead is a breath held and released.',
    rarity: 'common',
    icon: '📿',
    class: 'tempest',
    passive: {},
    triggers: {
      onCardPlayed: [
        {
          op: 'if',
          cond: { left: { v: 'cards_played' }, cmp: '==', right: 3 },
          then: [{ op: 'block', amount: 2, to: 'self' }],
          else: []
        }
      ]
    }
  });

  DS.defineRelic({
    id: 'tp_stillness_charm',
    name: 'Stillness Charm',
    desc: 'At the start of each combat, enter Stillness, gaining 2 Block at the end of each turn.',
    flavor: 'A pebble from the eye of a typhoon. It never moves, even when you do.',
    rarity: 'uncommon',
    icon: '🎐',
    class: 'tempest',
    passive: {},
    triggers: {
      onCombatStart: [
        { op: 'remove_status', status: 'tp_gale', to: 'self' },
        { op: 'apply', status: 'tp_stillness', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineRelic({
    id: 'tp_stormglass_orrery',
    name: 'Stormglass Orrery',
    desc: 'At the start of each turn, store 2 Storm.',
    flavor: 'Tiny spheres of lightning turn slowly around a glass sun.',
    rarity: 'rare',
    icon: '🪐',
    class: 'tempest',
    passive: {},
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'tp_storm_store', amount: 2, to: 'self' }]
    }
  });

  DS.defineRelic({
    id: 'tp_typhoon_heart',
    name: 'Typhoon Heart',
    desc: 'Gain 1 additional Energy each turn.',
    flavor: 'The storm that first carried Kaze over the mountains still beats inside this stone.',
    rarity: 'boss',
    icon: '🌪️',
    class: 'tempest',
    passive: { energy: 1 }
  });

  // ===========================================================================
  // CUSTOM STATUSES (21). Power cards apply the engine statuses to self.
  // ===========================================================================

  // Momentum engine: every card played gains Momentum (stacks = Momentum per card).
  DS.defineStatus({
    id: 'tp_flow',
    name: 'Flow',
    type: 'buff',
    icon: '🌊',
    stacks: true,
    desc: 'Whenever you play a card, gain {n} Momentum.',
    triggers: {
      onCardPlayed: [{ op: 'apply', status: 'tp_momentum', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Momentum counter: spent by Finisher cards, gone at end of turn.
  DS.defineStatus({
    id: 'tp_momentum',
    name: 'Momentum',
    type: 'buff',
    icon: '💨',
    stacks: true,
    expire: 'turn_end',
    desc: 'Your attacks deal +1 damage per Momentum. Spent by Finisher cards. Ends at the end of your turn.',
    mods: { attackDealtAdd: 1 }
  });

  // Momentum: the fourth card you play each turn draws cards.
  DS.defineStatus({
    id: 'tp_tempo',
    name: 'Tempo',
    type: 'buff',
    icon: '🥁',
    stacks: true,
    desc: 'On the 4th card you play each turn, draw {n} card(s).',
    triggers: {
      onCardPlayed: [
        {
          op: 'if',
          cond: { left: { v: 'cards_played' }, cmp: '==', right: 4 },
          then: [{ op: 'draw', amount: { v: 'stacks' } }],
          else: []
        }
      ]
    }
  });

  // Stance: Gale. Attacks hit harder, you take more attack damage. Hits grant Momentum.
  DS.defineStatus({
    id: 'tp_gale',
    name: 'Gale',
    type: 'buff',
    icon: '🌪️',
    stacks: false,
    desc: 'Your attacks deal 30% more damage and you take 25% more attack damage. Each attack that hits grants 1 Momentum.',
    mods: { attackDealtMul: 1.3, attackTakenMul: 1.25 },
    triggers: {
      onAttack: [{ op: 'apply', status: 'tp_momentum', amount: 1, to: 'self' }]
    }
  });

  // Stance: Stillness. Block at the end of your turn. Mutually exclusive with Gale.
  DS.defineStatus({
    id: 'tp_stillness',
    name: 'Stillness',
    type: 'buff',
    icon: '🧘',
    stacks: true,
    desc: 'At the end of your turn, gain {n} Block.',
    triggers: {
      onTurnEnd: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // While in Stillness, attacks against you grant Block.
  DS.defineStatus({
    id: 'tp_grounded',
    name: 'Grounded',
    type: 'buff',
    icon: '🪨',
    stacks: true,
    desc: 'Whenever you are attacked while in Stillness, gain {n} Block.',
    triggers: {
      onAttacked: [
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }],
          else: []
        }
      ]
    }
  });

  // Static charge on enemies. Stacks gained from Static cards; threshold-detonated by Conduit.
  DS.defineStatus({
    id: 'tp_static',
    name: 'Static',
    type: 'debuff',
    icon: '⚡',
    stacks: true,
    desc: 'Charged with {n} Static. Takes 1 more attack damage per 2 Static. Detonated by Lightning Conduit or Discharge.',
    mods: { attackTakenAdd: 0.5 }
  });

  // Threshold engine (stacks = threshold): when an enemy's Static reaches it, detonate for its Static.
  DS.defineStatus({
    id: 'tp_conduit',
    name: 'Lightning Conduit',
    type: 'buff',
    icon: '🔌',
    stacks: true,
    desc: 'Whenever an enemy\'s Static reaches {n}, detonate it for damage equal to its Static.',
    triggers: {
      onApplyDebuff: [
        {
          op: 'if',
          cond: {
            left: { v: 'status', status: 'tp_static', of: 'target' },
            cmp: '>=',
            right: { v: 'stacks' }
          },
          then: [
            { op: 'damage', amount: { v: 'status', status: 'tp_static', of: 'target' }, to: 'target' },
            { op: 'remove_status', status: 'tp_static', to: 'target' }
          ],
          else: []
        }
      ]
    }
  });

  // Banked storm. Release cards spend it. Gives Block at the start of your turn (a fifth of it).
  DS.defineStatus({
    id: 'tp_storm_store',
    name: 'Stored Storm',
    type: 'buff',
    icon: '🌩️',
    stacks: true,
    desc: 'Holding {n} Storm. Storm Release cards spend it. At the start of your turn, gain Block equal to a fifth of it.',
    triggers: {
      onTurnStart: [{ op: 'block', amount: { v: 'stacks', mul: 0.2 }, to: 'self' }]
    }
  });

  // Losing HP feeds Momentum.
  DS.defineStatus({
    id: 'tp_bruised_wind',
    name: 'Bruised Wind',
    type: 'buff',
    icon: '🩸',
    stacks: true,
    desc: 'Whenever you lose HP, gain {n} Momentum.',
    triggers: {
      onDamaged: [{ op: 'apply', status: 'tp_momentum', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Each turn, every enemy gains Static.
  DS.defineStatus({
    id: 'tp_static_field',
    name: 'Static Field',
    type: 'buff',
    icon: '🌫️',
    stacks: true,
    desc: 'At the start of each turn, apply {n} Static to ALL enemies.',
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'tp_static', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  // Energy from a full storm bank.
  DS.defineStatus({
    id: 'tp_overcharge',
    name: 'Overcharge',
    type: 'buff',
    icon: '🔋',
    stacks: true,
    desc: 'At the start of each turn, if you have at least 6 Stored Storm, gain {n} Energy.',
    triggers: {
      onTurnStart: [
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_storm_store', of: 'self' }, cmp: '>=', right: 6 },
          then: [{ op: 'energy', amount: { v: 'stacks' } }],
          else: []
        }
      ]
    }
  });

  // Attacks played with 3+ Momentum also strike a random enemy.
  DS.defineStatus({
    id: 'tp_whirling_wind',
    name: 'Whirling Blades',
    type: 'buff',
    icon: '🗡️',
    stacks: true,
    desc: 'Whenever you play an Attack while you have at least 3 Momentum, deal {n} damage to a random enemy.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'status', status: 'tp_momentum', of: 'self' }, cmp: '>=', right: 3 },
            then: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }],
            else: []
          }
        ]
      }
    }
  });

  // Exhausting cards banks storm.
  DS.defineStatus({
    id: 'tp_storm_eye',
    name: 'Eye of the Storm',
    type: 'buff',
    icon: '👁️',
    stacks: true,
    desc: 'Whenever you Exhaust a card, store {n} Storm.',
    triggers: {
      onCardExhausted: [{ op: 'apply', status: 'tp_storm_store', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Discarding by effect draws cards.
  DS.defineStatus({
    id: 'tp_eddy',
    name: 'Eddy',
    type: 'buff',
    icon: '🌀',
    stacks: true,
    desc: 'Whenever you discard a card by effect, draw {n} card(s).',
    triggers: {
      onCardDiscarded: [{ op: 'draw', amount: { v: 'stacks' } }]
    }
  });

  // Losing HP while in Gale draws cards.
  DS.defineStatus({
    id: 'tp_gale_heart',
    name: 'Heart of the Gale',
    type: 'buff',
    icon: '💗',
    stacks: true,
    desc: 'Whenever you lose HP while in Gale, draw {n} card(s).',
    triggers: {
      onDamaged: [
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'draw', amount: { v: 'stacks' } }],
          else: []
        }
      ]
    }
  });

  // Skills feed Momentum.
  DS.defineStatus({
    id: 'tp_drum',
    name: 'Momentum Drum',
    type: 'buff',
    icon: '🪘',
    stacks: true,
    desc: 'Whenever you play a Skill, gain {n} Momentum.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'apply', status: 'tp_momentum', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // The third Attack each turn grants Energy.
  DS.defineStatus({
    id: 'tp_stormcaller',
    name: 'Stormcaller',
    type: 'buff',
    icon: '🔮',
    stacks: true,
    desc: 'Whenever you play your 3rd Attack each turn, gain {n} Energy.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'attacks_played' }, cmp: '==', right: 3 },
            then: [{ op: 'energy', amount: { v: 'stacks' } }],
            else: []
          }
        ]
      }
    }
  });

  // Playing Powers banks storm.
  DS.defineStatus({
    id: 'tp_storm_crown',
    name: 'Crown of Storms',
    type: 'buff',
    icon: '🪄',
    stacks: true,
    desc: 'Whenever you play a Power, store {n} Storm.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'power' },
        effects: [{ op: 'apply', status: 'tp_storm_store', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // Each turn: bank storm and gain a little Momentum.
  DS.defineStatus({
    id: 'tp_eye_of_typhoon',
    name: 'Eye of the Typhoon',
    type: 'buff',
    icon: '🌀',
    stacks: true,
    desc: 'At the start of each turn, store {n} Storm and gain 1 Momentum.',
    triggers: {
      onTurnStart: [
        { op: 'apply', status: 'tp_storm_store', amount: { v: 'stacks' }, to: 'self' },
        { op: 'apply', status: 'tp_momentum', amount: 1, to: 'self' }
      ]
    }
  });

  // A stored tempest: with 10+ Storm, unleash it on all enemies at the start of each turn.
  DS.defineStatus({
    id: 'tp_thunder_reserve',
    name: 'Thunder Vault',
    type: 'buff',
    icon: '🏦',
    stacks: true,
    desc: 'At the start of each turn, if you have 10 or more Stored Storm, deal {n} damage to ALL enemies and spend 10 Storm.',
    triggers: {
      onTurnStart: [
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_storm_store', of: 'self' }, cmp: '>=', right: 10 },
          then: [
            { op: 'damage', amount: { v: 'stacks' }, to: 'all_enemies' },
            { op: 'apply', status: 'tp_storm_store', amount: -10, to: 'self' }
          ],
          else: []
        }
      ]
    }
  });

  // ===========================================================================
  // STARTER CARDS (4 distinct; deck = 5 Strike, 4 Defend, 2 signatures)
  // ===========================================================================
  DS.defineCard({
    id: 'tp_strike', name: 'Strike', class: 'tempest', type: 'attack', rarity: 'starter',
    cost: 1, target: 'enemy', icon: '🪁',
    desc: 'Deal 6 damage.',
    effects: [{ op: 'damage', amount: 6 }],
    upgrade: { desc: 'Deal 9 damage.', effects: [{ op: 'damage', amount: 9 }] }
  });

  DS.defineCard({
    id: 'tp_defend', name: 'Defend', class: 'tempest', type: 'skill', rarity: 'starter',
    cost: 1, target: 'self', icon: '🛡️',
    desc: 'Gain 5 Block.',
    effects: [{ op: 'block', amount: 5, to: 'self' }],
    upgrade: { desc: 'Gain 8 Block.', effects: [{ op: 'block', amount: 8, to: 'self' }] }
  });

  DS.defineCard({
    id: 'tp_gust_lash', name: 'Gust Lash', class: 'tempest', type: 'attack', rarity: 'starter',
    cost: 1, target: 'enemy', icon: '🪶',
    desc: 'Gain 2 Momentum. Deal 5 damage.',
    effects: [{ op: 'apply', status: 'tp_momentum', amount: 2, to: 'self' }, { op: 'damage', amount: 5 }],
    upgrade: {
      desc: 'Gain 3 Momentum. Deal 7 damage.',
      effects: [{ op: 'apply', status: 'tp_momentum', amount: 3, to: 'self' }, { op: 'damage', amount: 7 }]
    }
  });

  DS.defineCard({
    id: 'tp_still_breath', name: 'Still Breath', class: 'tempest', type: 'skill', rarity: 'starter',
    cost: 1, target: 'self', icon: '🌫️',
    desc: 'Gain 3 Block. Enter Stillness: gain 2 Block at the end of each turn.',
    effects: [
      { op: 'block', amount: 3, to: 'self' },
      { op: 'remove_status', status: 'tp_gale', to: 'self' },
      { op: 'apply', status: 'tp_stillness', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 4 Block. Enter Stillness: gain 3 Block at the end of each turn.',
      effects: [
        { op: 'block', amount: 4, to: 'self' },
        { op: 'remove_status', status: 'tp_gale', to: 'self' },
        { op: 'apply', status: 'tp_stillness', amount: 3, to: 'self' }
      ]
    }
  });

  // ===========================================================================
  // COMMON (26): 10 attacks, 10 skills, 6 powers
  // ===========================================================================

  // ----- common attacks (10) -----
  DS.defineCard({
    id: 'tp_gust_jab', name: 'Gust Jab', class: 'tempest', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '💨',
    desc: 'Deal 6 damage. Gain 1 Momentum.',
    effects: [{ op: 'damage', amount: 6 }, { op: 'apply', status: 'tp_momentum', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Deal 8 damage. Gain 2 Momentum.',
      effects: [{ op: 'damage', amount: 8 }, { op: 'apply', status: 'tp_momentum', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_wind_cut', name: 'Wind Cut', class: 'tempest', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🗡️',
    desc: 'Deal 8 damage. If you are in Gale, draw 1 card.',
    effects: [
      { op: 'damage', amount: 8 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'draw', amount: 1 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 11 damage. If you are in Gale, draw 1 card.',
      effects: [
        { op: 'damage', amount: 11 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'draw', amount: 1 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_flurry_fan', name: 'Flurry Fan', class: 'tempest', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🪭',
    desc: 'Deal 3 damage 3 times.',
    effects: [{ op: 'damage', amount: 3, times: 3 }],
    upgrade: { desc: 'Deal 4 damage 3 times.', effects: [{ op: 'damage', amount: 4, times: 3 }] }
  });

  DS.defineCard({
    id: 'tp_thunder_palm', name: 'Thunder Palm', class: 'tempest', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '⚡',
    desc: 'Deal 12 damage. Apply 1 Static.',
    effects: [{ op: 'damage', amount: 12 }, { op: 'apply', status: 'tp_static', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Deal 15 damage. Apply 2 Static.',
      effects: [{ op: 'damage', amount: 15 }, { op: 'apply', status: 'tp_static', amount: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'tp_rolling_thunder', name: 'Rolling Thunder', class: 'tempest', type: 'attack', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '🌩️',
    desc: 'Deal 5 damage to ALL enemies.',
    effects: [{ op: 'damage', amount: 5, to: 'all_enemies' }],
    upgrade: { desc: 'Deal 7 damage to ALL enemies.', effects: [{ op: 'damage', amount: 7, to: 'all_enemies' }] }
  });

  DS.defineCard({
    id: 'tp_storm_knee', name: 'Storm Knee', class: 'tempest', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🦵',
    desc: 'Deal 6 damage. Apply 1 Weak.',
    effects: [{ op: 'damage', amount: 6 }, { op: 'apply', status: 'weak', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Deal 8 damage. Apply 2 Weak.',
      effects: [{ op: 'damage', amount: 8 }, { op: 'apply', status: 'weak', amount: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'tp_quick_feint', name: 'Quick Feint', class: 'tempest', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '🌀', innate: true,
    desc: 'Innate. Deal 4 damage. Gain 1 Momentum.',
    effects: [{ op: 'damage', amount: 4 }, { op: 'apply', status: 'tp_momentum', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Innate. Deal 5 damage. Gain 2 Momentum.',
      effects: [{ op: 'damage', amount: 5 }, { op: 'apply', status: 'tp_momentum', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_whirl_kick', name: 'Whirl Kick', class: 'tempest', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🦶',
    desc: 'Deal 10 damage. Draw 1 card.',
    effects: [{ op: 'damage', amount: 10 }, { op: 'draw', amount: 1 }],
    upgrade: { desc: 'Deal 13 damage. Draw 1 card.', effects: [{ op: 'damage', amount: 13 }, { op: 'draw', amount: 1 }] }
  });

  DS.defineCard({
    id: 'tp_scatter_shot', name: 'Scatter Shot', class: 'tempest', type: 'attack', rarity: 'common',
    cost: 1, target: 'random_enemy', icon: '🎯',
    desc: 'Deal 4 damage to a random enemy twice.',
    effects: [{ op: 'damage', amount: 4, times: 2, to: 'random_enemy' }],
    upgrade: { desc: 'Deal 5 damage to a random enemy twice.', effects: [{ op: 'damage', amount: 5, times: 2, to: 'random_enemy' }] }
  });

  DS.defineCard({
    id: 'tp_galewind_hammer', name: 'Galewind Hammer', class: 'tempest', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🔨',
    desc: 'Deal 10 damage. If you are in Gale, deal 6 more.',
    effects: [
      { op: 'damage', amount: 10 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 6 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 13 damage. If you are in Gale, deal 8 more.',
      effects: [
        { op: 'damage', amount: 13 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 8 }],
          else: []
        }
      ]
    }
  });

  // ----- common skills (10) -----
  DS.defineCard({
    id: 'tp_draft_step', name: 'Draft Step', class: 'tempest', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🍃',
    desc: 'Draw 1 card. Gain 1 Momentum.',
    effects: [{ op: 'draw', amount: 1 }, { op: 'apply', status: 'tp_momentum', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Draw 2 cards. Gain 1 Momentum.',
      effects: [{ op: 'draw', amount: 2 }, { op: 'apply', status: 'tp_momentum', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_enter_gale', name: 'Enter Gale', class: 'tempest', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🌬️',
    desc: 'Enter Gale: your attacks deal 30% more damage and you take 25% more attack damage. If you leave Stillness, gain 1 Energy.',
    effects: [
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'energy', amount: 1 }],
        else: []
      },
      { op: 'remove_status', status: 'tp_stillness', to: 'self' },
      { op: 'apply', status: 'tp_gale', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Enter Gale: your attacks deal 30% more damage and you take 25% more attack damage. If you leave Stillness, gain 2 Energy.',
      effects: [
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'energy', amount: 2 }],
          else: []
        },
        { op: 'remove_status', status: 'tp_stillness', to: 'self' },
        { op: 'apply', status: 'tp_gale', amount: 1, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_still_water', name: 'Still Water', class: 'tempest', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '💧',
    desc: 'Gain 4 Block. If you are in Stillness, draw 1 card.',
    effects: [
      { op: 'block', amount: 4, to: 'self' },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'draw', amount: 1 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Gain 6 Block. If you are in Stillness, draw 1 card.',
      effects: [
        { op: 'block', amount: 6, to: 'self' },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'draw', amount: 1 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_static_brand', name: 'Static Brand', class: 'tempest', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🧷',
    desc: 'Apply 4 Static to the enemy.',
    effects: [{ op: 'apply', status: 'tp_static', amount: 4, to: 'target' }],
    upgrade: { desc: 'Apply 6 Static to the enemy.', effects: [{ op: 'apply', status: 'tp_static', amount: 6, to: 'target' }] }
  });

  DS.defineCard({
    id: 'tp_static_mist', name: 'Static Mist', class: 'tempest', type: 'skill', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '🌁',
    desc: 'Apply 2 Static to ALL enemies.',
    effects: [{ op: 'apply', status: 'tp_static', amount: 2, to: 'all_enemies' }],
    upgrade: { desc: 'Apply 3 Static to ALL enemies.', effects: [{ op: 'apply', status: 'tp_static', amount: 3, to: 'all_enemies' }] }
  });

  DS.defineCard({
    id: 'tp_winds_turn', name: 'Wind\'s Turn', class: 'tempest', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🔄',
    desc: 'Discard 1 card. Draw 2 cards.',
    effects: [{ op: 'discard', amount: 1 }, { op: 'draw', amount: 2 }],
    upgrade: { desc: 'Discard 1 card. Draw 3 cards.', effects: [{ op: 'discard', amount: 1 }, { op: 'draw', amount: 3 }] }
  });

  DS.defineCard({
    id: 'tp_exhale', name: 'Exhale', class: 'tempest', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '💨',
    desc: 'Exhaust 1 card from your hand. Gain 4 Block.',
    effects: [{ op: 'exhaust', amount: 1 }, { op: 'block', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Exhaust 1 card from your hand. Gain 6 Block.',
      effects: [{ op: 'exhaust', amount: 1 }, { op: 'block', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_gather_breath', name: 'Gather Breath', class: 'tempest', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🫁', retain: true,
    desc: 'Retain. Gain 5 Block.',
    effects: [{ op: 'block', amount: 5, to: 'self' }],
    upgrade: { desc: 'Retain. Gain 7 Block.', effects: [{ op: 'block', amount: 7, to: 'self' }] }
  });

  DS.defineCard({
    id: 'tp_hoard_wind', name: 'Hoard Wind', class: 'tempest', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🏺',
    desc: 'Store 3 Storm.',
    effects: [{ op: 'apply', status: 'tp_storm_store', amount: 3, to: 'self' }],
    upgrade: { desc: 'Store 5 Storm.', effects: [{ op: 'apply', status: 'tp_storm_store', amount: 5, to: 'self' }] }
  });

  DS.defineCard({
    id: 'tp_mend_wind', name: 'Mend Wind', class: 'tempest', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🌿',
    desc: 'Heal 4 HP. Gain 1 Momentum.',
    effects: [{ op: 'heal', amount: 4, to: 'self' }, { op: 'apply', status: 'tp_momentum', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Heal 6 HP. Gain 2 Momentum.',
      effects: [{ op: 'heal', amount: 6, to: 'self' }, { op: 'apply', status: 'tp_momentum', amount: 2, to: 'self' }]
    }
  });

  // ----- common powers (6) -----
  DS.defineCard({
    id: 'tp_flowing_motion', name: 'Flowing Motion', class: 'tempest', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🌊',
    desc: 'Whenever you play a card, gain 1 Momentum.',
    effects: [{ op: 'apply', status: 'tp_flow', amount: 1, to: 'self' }],
    upgrade: { desc: 'Whenever you play a card, gain 2 Momentum.', effects: [{ op: 'apply', status: 'tp_flow', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'tp_tempo_beat', name: 'Tempo Beat', class: 'tempest', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🥁',
    desc: 'On the 4th card you play each turn, draw 1 card.',
    effects: [{ op: 'apply', status: 'tp_tempo', amount: 1, to: 'self' }],
    upgrade: { desc: 'On the 4th card you play each turn, draw 2 cards.', effects: [{ op: 'apply', status: 'tp_tempo', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'tp_static_banner', name: 'Static Banner', class: 'tempest', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🚩',
    desc: 'At the start of each turn, apply 1 Static to ALL enemies.',
    effects: [{ op: 'apply', status: 'tp_static_field', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, apply 2 Static to ALL enemies.',
      effects: [{ op: 'apply', status: 'tp_static_field', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_grounding', name: 'Grounding', class: 'tempest', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🪨',
    desc: 'Whenever you are attacked while in Stillness, gain 2 Block.',
    effects: [{ op: 'apply', status: 'tp_grounded', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you are attacked while in Stillness, gain 3 Block.',
      effects: [{ op: 'apply', status: 'tp_grounded', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_bloodwind', name: 'Bloodwind', class: 'tempest', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🩸',
    desc: 'Whenever you lose HP, gain 1 Momentum.',
    effects: [{ op: 'apply', status: 'tp_bruised_wind', amount: 1, to: 'self' }],
    upgrade: { desc: 'Whenever you lose HP, gain 2 Momentum.', effects: [{ op: 'apply', status: 'tp_bruised_wind', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'tp_eddy_current', name: 'Eddy Current', class: 'tempest', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🌀',
    desc: 'Whenever you discard a card by effect, draw 1 card.',
    effects: [{ op: 'apply', status: 'tp_eddy', amount: 1, to: 'self' }],
    upgrade: { desc: 'Whenever you discard a card by effect, draw 2 cards.', effects: [{ op: 'apply', status: 'tp_eddy', amount: 2, to: 'self' }] }
  });

  // ===========================================================================
  // UNCOMMON (33): 14 attacks, 13 skills, 6 powers
  // ===========================================================================

  // ----- uncommon attacks (13) -----
  DS.defineCard({
    id: 'tp_releasing_gust', name: 'Releasing Gust', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '💫',
    desc: 'Deal 3 damage for each Momentum you have. Spend all Momentum.',
    effects: [
      { op: 'damage', amount: { v: 'status', status: 'tp_momentum', of: 'self', mul: 3 } },
      { op: 'remove_status', status: 'tp_momentum', to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 4 damage for each Momentum you have. Spend all Momentum.',
      effects: [
        { op: 'damage', amount: { v: 'status', status: 'tp_momentum', of: 'self', mul: 4 } },
        { op: 'remove_status', status: 'tp_momentum', to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_tailwind_finale', name: 'Tailwind Finale', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🏄',
    desc: 'Deal 2 damage to ALL enemies for each Momentum you have. Spend all Momentum.',
    effects: [
      { op: 'damage', amount: { v: 'status', status: 'tp_momentum', of: 'self', mul: 2 }, to: 'all_enemies' },
      { op: 'remove_status', status: 'tp_momentum', to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 3 damage to ALL enemies for each Momentum you have. Spend all Momentum.',
      effects: [
        { op: 'damage', amount: { v: 'status', status: 'tp_momentum', of: 'self', mul: 3 }, to: 'all_enemies' },
        { op: 'remove_status', status: 'tp_momentum', to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_zephyr_slash', name: 'Zephyr Slash', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '⚔️',
    desc: 'Deal 11 damage. If you are in Gale, deal 5 more and gain 1 Momentum.',
    effects: [
      { op: 'damage', amount: 11 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 5 }, { op: 'apply', status: 'tp_momentum', amount: 1, to: 'self' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 14 damage. If you are in Gale, deal 7 more and gain 1 Momentum.',
      effects: [
        { op: 'damage', amount: 14 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 7 }, { op: 'apply', status: 'tp_momentum', amount: 1, to: 'self' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_static_lance', name: 'Static Lance', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🔱',
    desc: 'Deal 8 damage. Apply 3 Static.',
    effects: [{ op: 'damage', amount: 8 }, { op: 'apply', status: 'tp_static', amount: 3, to: 'target' }],
    upgrade: {
      desc: 'Deal 10 damage. Apply 4 Static.',
      effects: [{ op: 'damage', amount: 10 }, { op: 'apply', status: 'tp_static', amount: 4, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'tp_gale_burst', name: 'Gale Burst', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 'X', target: 'enemy', icon: '🌋',
    desc: 'Spend all Energy. Deal 6 damage once per Energy spent.',
    effects: [{ op: 'damage', amount: 6, times: { v: 'x' } }],
    upgrade: {
      desc: 'Spend all Energy. Deal 8 damage once per Energy spent.',
      effects: [{ op: 'damage', amount: 8, times: { v: 'x' } }]
    }
  });

  DS.defineCard({
    id: 'tp_cloudburst', name: 'Cloudburst', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 'X', target: 'all_enemies', icon: '🌧️',
    desc: 'Spend all Energy. Deal 4 damage to ALL enemies once per Energy spent.',
    effects: [{ op: 'damage', amount: 4, times: { v: 'x' }, to: 'all_enemies' }],
    upgrade: {
      desc: 'Spend all Energy. Deal 5 damage to ALL enemies once per Energy spent.',
      effects: [{ op: 'damage', amount: 5, times: { v: 'x' }, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'tp_hurricane_kick', name: 'Hurricane Kick', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '👢',
    desc: 'Deal 9 damage. If you have at least 3 Momentum, deal 6 more.',
    effects: [
      { op: 'damage', amount: 9 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'tp_momentum', of: 'self' }, cmp: '>=', right: 3 },
        then: [{ op: 'damage', amount: 6 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 12 damage. If you have at least 3 Momentum, deal 8 more.',
      effects: [
        { op: 'damage', amount: 12 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_momentum', of: 'self' }, cmp: '>=', right: 3 },
          then: [{ op: 'damage', amount: 8 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_wisp_strike', name: 'Wisp Strike', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🫧',
    desc: 'Deal 6 damage. Add 1 Wisp to your hand.',
    effects: [{ op: 'damage', amount: 6 }, { op: 'add_card', card: 'tp_wisp', to: 'hand', amount: 1 }],
    upgrade: {
      desc: 'Deal 8 damage. Add 2 Wisps to your hand.',
      effects: [{ op: 'damage', amount: 8 }, { op: 'add_card', card: 'tp_wisp', to: 'hand', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'tp_gale_crash', name: 'Gale Crash', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 3, target: 'all_enemies', icon: '🌊', ethereal: true,
    desc: 'Ethereal. Deal 14 damage to ALL enemies. If you are in Gale, apply 2 Static to ALL enemies.',
    effects: [
      { op: 'damage', amount: 14, to: 'all_enemies' },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'apply', status: 'tp_static', amount: 2, to: 'all_enemies' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Ethereal. Deal 18 damage to ALL enemies. If you are in Gale, apply 3 Static to ALL enemies.',
      effects: [
        { op: 'damage', amount: 18, to: 'all_enemies' },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'apply', status: 'tp_static', amount: 3, to: 'all_enemies' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_bramble_storm', name: 'Bramble Storm', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🍂',
    desc: 'Deal 7 damage to ALL enemies. Apply 1 Vulnerable to ALL enemies.',
    effects: [
      { op: 'damage', amount: 7, to: 'all_enemies' },
      { op: 'apply', status: 'vulnerable', amount: 1, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 9 damage to ALL enemies. Apply 2 Vulnerable to ALL enemies.',
      effects: [
        { op: 'damage', amount: 9, to: 'all_enemies' },
        { op: 'apply', status: 'vulnerable', amount: 2, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_tempest_fist', name: 'Tempest Fist', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🥊', innate: true,
    desc: 'Innate. Deal 10 damage. Apply 1 Static.',
    effects: [{ op: 'damage', amount: 10 }, { op: 'apply', status: 'tp_static', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Innate. Deal 13 damage. Apply 2 Static.',
      effects: [{ op: 'damage', amount: 13 }, { op: 'apply', status: 'tp_static', amount: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'tp_spiral_kick', name: 'Spiral Kick', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🦅',
    desc: 'Deal 5 damage twice. Gain 1 Momentum.',
    effects: [{ op: 'damage', amount: 5, times: 2 }, { op: 'apply', status: 'tp_momentum', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Deal 6 damage twice. Gain 2 Momentum.',
      effects: [{ op: 'damage', amount: 6, times: 2 }, { op: 'apply', status: 'tp_momentum', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_thousand_leaves', name: 'Thousand Leaves', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'random_enemy', icon: '🍁',
    desc: 'Deal 3 damage to a random enemy 4 times.',
    effects: [{ op: 'damage', amount: 3, times: 4, to: 'random_enemy' }],
    upgrade: {
      desc: 'Deal 4 damage to a random enemy 4 times.',
      effects: [{ op: 'damage', amount: 4, times: 4, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'tp_discharge', name: 'Discharge', class: 'tempest', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🎈',
    desc: 'Deal 2 damage for each Static on the enemy. Spend all of its Static.',
    effects: [
      { op: 'damage', amount: { v: 'status', status: 'tp_static', of: 'target', mul: 2 } },
      { op: 'remove_status', status: 'tp_static', to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 3 damage for each Static on the enemy. Spend all of its Static.',
      effects: [
        { op: 'damage', amount: { v: 'status', status: 'tp_static', of: 'target', mul: 3 } },
        { op: 'remove_status', status: 'tp_static', to: 'target' }
      ]
    }
  });

  // ----- uncommon skills (13) -----
  DS.defineCard({
    id: 'tp_cloud_cache', name: 'Cloud Cache', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '☁️', retain: true,
    desc: 'Store 2 Storm. Retain. At the end of each turn this stays in your hand, store 2 more Storm.',
    effects: [{ op: 'apply', status: 'tp_storm_store', amount: 2, to: 'self' }],
    onEndTurnInHand: [{ op: 'apply', status: 'tp_storm_store', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Store 3 Storm. Retain. At the end of each turn this stays in your hand, store 3 more Storm.',
      effects: [{ op: 'apply', status: 'tp_storm_store', amount: 3, to: 'self' }],
      onEndTurnInHand: [{ op: 'apply', status: 'tp_storm_store', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_gust_guard', name: 'Gust Guard', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧱',
    desc: 'Gain 9 Block. If you are in Stillness, gain 4 more Block.',
    effects: [
      { op: 'block', amount: 9, to: 'self' },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'block', amount: 4, to: 'self' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Gain 12 Block. If you are in Stillness, gain 6 more Block.',
      effects: [
        { op: 'block', amount: 12, to: 'self' },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'block', amount: 6, to: 'self' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_gale_brace', name: 'Gale Brace', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🕊️',
    desc: 'Enter Gale: your attacks deal 30% more damage and you take 25% more attack damage. Draw 2 cards. If you leave Stillness, gain 1 Energy.',
    effects: [
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'energy', amount: 1 }],
        else: []
      },
      { op: 'remove_status', status: 'tp_stillness', to: 'self' },
      { op: 'apply', status: 'tp_gale', amount: 1, to: 'self' },
      { op: 'draw', amount: 2 }
    ],
    upgrade: {
      desc: 'Enter Gale: your attacks deal 30% more damage and you take 25% more attack damage. Draw 3 cards. If you leave Stillness, gain 1 Energy.',
      effects: [
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'energy', amount: 1 }],
          else: []
        },
        { op: 'remove_status', status: 'tp_stillness', to: 'self' },
        { op: 'apply', status: 'tp_gale', amount: 1, to: 'self' },
        { op: 'draw', amount: 3 }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_enter_stillness', name: 'Enter Stillness', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪷',
    desc: 'Gain 6 Block. Enter Stillness: gain 4 Block at the end of each turn.',
    effects: [
      { op: 'block', amount: 6, to: 'self' },
      { op: 'remove_status', status: 'tp_gale', to: 'self' },
      { op: 'apply', status: 'tp_stillness', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 8 Block. Enter Stillness: gain 5 Block at the end of each turn.',
      effects: [
        { op: 'block', amount: 8, to: 'self' },
        { op: 'remove_status', status: 'tp_gale', to: 'self' },
        { op: 'apply', status: 'tp_stillness', amount: 5, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_scattering_wind', name: 'Scattering Wind', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🌾',
    desc: 'Discard 2 cards. Draw 3 cards.',
    effects: [{ op: 'discard', amount: 2 }, { op: 'draw', amount: 3 }],
    upgrade: { desc: 'Discard 2 cards. Draw 4 cards.', effects: [{ op: 'discard', amount: 2 }, { op: 'draw', amount: 4 }] }
  });

  DS.defineCard({
    id: 'tp_mantle_of_wind', name: 'Mantle of Wind', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧣', retain: true,
    desc: 'Retain. Gain 6 Block. Store 1 Storm.',
    effects: [{ op: 'block', amount: 6, to: 'self' }, { op: 'apply', status: 'tp_storm_store', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Retain. Gain 9 Block. Store 2 Storm.',
      effects: [{ op: 'block', amount: 9, to: 'self' }, { op: 'apply', status: 'tp_storm_store', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_cyclone_guard', name: 'Cyclone Guard', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🏔️',
    desc: 'Gain 12 Block. Exhaust 1 card from your hand.',
    effects: [{ op: 'block', amount: 12, to: 'self' }, { op: 'exhaust', amount: 1 }],
    upgrade: { desc: 'Gain 16 Block. Exhaust 1 card from your hand.', effects: [{ op: 'block', amount: 16, to: 'self' }, { op: 'exhaust', amount: 1 }] }
  });

  DS.defineCard({
    id: 'tp_momentum_surge', name: 'Momentum Surge', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🔆', exhaust: true,
    desc: 'Gain 3 Momentum. Exhaust.',
    effects: [{ op: 'apply', status: 'tp_momentum', amount: 3, to: 'self' }],
    upgrade: { desc: 'Gain 4 Momentum. Exhaust.', effects: [{ op: 'apply', status: 'tp_momentum', amount: 4, to: 'self' }] }
  });

  DS.defineCard({
    id: 'tp_wild_breath', name: 'Wild Breath', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🌱',
    desc: 'Heal 5 HP. Gain 2 Momentum.',
    effects: [{ op: 'heal', amount: 5, to: 'self' }, { op: 'apply', status: 'tp_momentum', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Heal 7 HP. Gain 3 Momentum.',
      effects: [{ op: 'heal', amount: 7, to: 'self' }, { op: 'apply', status: 'tp_momentum', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_static_snare', name: 'Static Snare', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🕸️',
    desc: 'Apply 5 Static. Apply 1 Weak.',
    effects: [{ op: 'apply', status: 'tp_static', amount: 5, to: 'target' }, { op: 'apply', status: 'weak', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Apply 7 Static. Apply 2 Weak.',
      effects: [{ op: 'apply', status: 'tp_static', amount: 7, to: 'target' }, { op: 'apply', status: 'weak', amount: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'tp_reversal_gale', name: 'Reversal Gale', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔀',
    desc: 'If you are in Gale, enter Stillness, gaining 3 Block each turn. Otherwise enter Gale. Leaving Stillness grants 1 Energy.',
    effects: [
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
        then: [
          { op: 'remove_status', status: 'tp_gale', to: 'self' },
          { op: 'apply', status: 'tp_stillness', amount: 3, to: 'self' }
        ],
        else: [
          {
            op: 'if',
            cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
            then: [
              { op: 'energy', amount: 1 },
              { op: 'remove_status', status: 'tp_stillness', to: 'self' },
              { op: 'apply', status: 'tp_gale', amount: 1, to: 'self' }
            ],
            else: [{ op: 'apply', status: 'tp_gale', amount: 1, to: 'self' }]
          }
        ]
      }
    ],
    upgrade: {
      desc: 'If you are in Gale, enter Stillness, gaining 4 Block each turn. Otherwise enter Gale. Leaving Stillness grants 2 Energy.',
      effects: [
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
          then: [
            { op: 'remove_status', status: 'tp_gale', to: 'self' },
            { op: 'apply', status: 'tp_stillness', amount: 4, to: 'self' }
          ],
          else: [
            {
              op: 'if',
              cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
              then: [
                { op: 'energy', amount: 2 },
                { op: 'remove_status', status: 'tp_stillness', to: 'self' },
                { op: 'apply', status: 'tp_gale', amount: 1, to: 'self' }
              ],
              else: [{ op: 'apply', status: 'tp_gale', amount: 1, to: 'self' }]
            }
          ]
        }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_static_weave', name: 'Static Weave', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '🕷️',
    desc: 'Apply 3 Static to ALL enemies. Draw 1 card.',
    effects: [{ op: 'apply', status: 'tp_static', amount: 3, to: 'all_enemies' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Apply 4 Static to ALL enemies. Draw 1 card.',
      effects: [{ op: 'apply', status: 'tp_static', amount: 4, to: 'all_enemies' }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'tp_storm_sip', name: 'Storm Sip', class: 'tempest', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '💦',
    desc: 'Heal 2 HP. Store 2 Storm.',
    effects: [{ op: 'heal', amount: 2, to: 'self' }, { op: 'apply', status: 'tp_storm_store', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Heal 3 HP. Store 3 Storm.',
      effects: [{ op: 'heal', amount: 3, to: 'self' }, { op: 'apply', status: 'tp_storm_store', amount: 3, to: 'self' }]
    }
  });

  // ----- uncommon powers (6) -----
  DS.defineCard({
    id: 'tp_eye_of_storm', name: 'Eye of the Storm', class: 'tempest', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '👁️',
    desc: 'Whenever you Exhaust a card, store 2 Storm.',
    effects: [{ op: 'apply', status: 'tp_storm_eye', amount: 2, to: 'self' }],
    upgrade: { desc: 'Whenever you Exhaust a card, store 3 Storm.', effects: [{ op: 'apply', status: 'tp_storm_eye', amount: 3, to: 'self' }] }
  });

  DS.defineCard({
    id: 'tp_overcharged', name: 'Overcharged', class: 'tempest', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔋',
    desc: 'At the start of each turn, if you have at least 6 Stored Storm, gain 1 Energy.',
    effects: [{ op: 'apply', status: 'tp_overcharge', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, if you have at least 6 Stored Storm, gain 2 Energy.',
      effects: [{ op: 'apply', status: 'tp_overcharge', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_whirling_blades', name: 'Whirling Blades', class: 'tempest', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔪',
    desc: 'Whenever you play an Attack while you have at least 3 Momentum, deal 3 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'tp_whirling_wind', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play an Attack while you have at least 3 Momentum, deal 5 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'tp_whirling_wind', amount: 5, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_lightning_conduit', name: 'Lightning Conduit', class: 'tempest', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔌',
    desc: "Whenever an enemy's Static reaches 10, detonate it for damage equal to its Static.",
    effects: [{ op: 'apply', status: 'tp_conduit', amount: 10, to: 'self' }],
    upgrade: {
      desc: "Whenever an enemy's Static reaches 8, detonate it for damage equal to its Static.",
      effects: [{ op: 'apply', status: 'tp_conduit', amount: 8, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_heart_of_gale', name: 'Heart of the Gale', class: 'tempest', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '💗',
    desc: 'Whenever you lose HP while in Gale, draw 1 card.',
    effects: [{ op: 'apply', status: 'tp_gale_heart', amount: 1, to: 'self' }],
    upgrade: { desc: 'Whenever you lose HP while in Gale, draw 2 cards.', effects: [{ op: 'apply', status: 'tp_gale_heart', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'tp_momentum_drum', name: 'Momentum Drum', class: 'tempest', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪘',
    desc: 'Whenever you play a Skill, gain 1 Momentum.',
    effects: [{ op: 'apply', status: 'tp_drum', amount: 1, to: 'self' }],
    upgrade: { desc: 'Whenever you play a Skill, gain 2 Momentum.', effects: [{ op: 'apply', status: 'tp_drum', amount: 2, to: 'self' }] }
  });

  // ===========================================================================
  // RARE (17): 7 attacks, 6 skills, 4 powers
  // ===========================================================================

  // ----- rare attacks (7) -----
  DS.defineCard({
    id: 'tp_storm_release', name: 'Storm Release', class: 'tempest', type: 'attack', rarity: 'rare',
    cost: 1, target: 'enemy', icon: '🌩️',
    desc: 'Deal 2 damage for each Stored Storm. Spend all Stored Storm.',
    effects: [
      { op: 'damage', amount: { v: 'status', status: 'tp_storm_store', of: 'self', mul: 2 } },
      { op: 'remove_status', status: 'tp_storm_store', to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 3 damage for each Stored Storm. Spend all Stored Storm.',
      effects: [
        { op: 'damage', amount: { v: 'status', status: 'tp_storm_store', of: 'self', mul: 3 } },
        { op: 'remove_status', status: 'tp_storm_store', to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_typhoon_fist', name: 'Typhoon Fist', class: 'tempest', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🌪️',
    desc: 'Deal 16 damage. If you are in Gale, deal 10 more.',
    effects: [
      { op: 'damage', amount: 16 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 10 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 20 damage. If you are in Gale, deal 14 more.',
      effects: [
        { op: 'damage', amount: 20 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_gale', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 14 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_typhoon_sweep', name: 'Typhoon Sweep', class: 'tempest', type: 'attack', rarity: 'rare',
    cost: 3, target: 'all_enemies', icon: '🌀',
    desc: 'Deal 14 damage to ALL enemies. Gain 2 Momentum.',
    effects: [{ op: 'damage', amount: 14, to: 'all_enemies' }, { op: 'apply', status: 'tp_momentum', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Deal 18 damage to ALL enemies. Gain 3 Momentum.',
      effects: [{ op: 'damage', amount: 18, to: 'all_enemies' }, { op: 'apply', status: 'tp_momentum', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_maelstrom', name: 'Maelstrom', class: 'tempest', type: 'attack', rarity: 'rare',
    cost: 'X', target: 'all_enemies', icon: '🎆',
    desc: 'Spend all Energy. Deal 7 damage to ALL enemies once per Energy spent. Gain 1 Momentum per Energy spent.',
    effects: [
      { op: 'damage', amount: 7, times: { v: 'x' }, to: 'all_enemies' },
      { op: 'apply', status: 'tp_momentum', amount: { v: 'x' }, to: 'self' }
    ],
    upgrade: {
      desc: 'Spend all Energy. Deal 9 damage to ALL enemies once per Energy spent. Gain 1 Momentum per Energy spent.',
      effects: [
        { op: 'damage', amount: 9, times: { v: 'x' }, to: 'all_enemies' },
        { op: 'apply', status: 'tp_momentum', amount: { v: 'x' }, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_thunderfall', name: 'Thunderfall', class: 'tempest', type: 'attack', rarity: 'rare',
    cost: 2, target: 'random_enemy', icon: '🎇',
    desc: 'Deal 5 damage to a random enemy 4 times.',
    effects: [{ op: 'damage', amount: 5, times: 4, to: 'random_enemy' }],
    upgrade: { desc: 'Deal 7 damage to a random enemy 4 times.', effects: [{ op: 'damage', amount: 7, times: 4, to: 'random_enemy' }] }
  });

  DS.defineCard({
    id: 'tp_zenith_strike', name: 'Zenith Strike', class: 'tempest', type: 'attack', rarity: 'rare',
    cost: 1, target: 'enemy', icon: '🏹',
    desc: 'Deal 4 damage, plus 2 for each card you have played this turn.',
    effects: [{ op: 'damage', amount: { v: 'cards_played', mul: 2, add: 4 } }],
    upgrade: {
      desc: 'Deal 4 damage, plus 3 for each card you have played this turn.',
      effects: [{ op: 'damage', amount: { v: 'cards_played', mul: 3, add: 4 } }]
    }
  });

  DS.defineCard({
    id: 'tp_hurricane_crown', name: 'Hurricane Crown', class: 'tempest', type: 'attack', rarity: 'rare',
    cost: 3, target: 'all_enemies', icon: '👑',
    desc: 'Deal 10 damage to ALL enemies twice. Apply 1 Static to ALL enemies.',
    effects: [
      { op: 'damage', amount: 10, times: 2, to: 'all_enemies' },
      { op: 'apply', status: 'tp_static', amount: 1, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 12 damage to ALL enemies twice. Apply 2 Static to ALL enemies.',
      effects: [
        { op: 'damage', amount: 12, times: 2, to: 'all_enemies' },
        { op: 'apply', status: 'tp_static', amount: 2, to: 'all_enemies' }
      ]
    }
  });

  // ----- rare skills (6) -----
  DS.defineCard({
    id: 'tp_storm_vessel', name: 'Storm Vessel', class: 'tempest', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🫙', retain: true,
    desc: 'Retain. Gain 4 Block. At the end of each turn this stays in your hand, store 3 Storm.',
    effects: [{ op: 'block', amount: 4, to: 'self' }],
    onEndTurnInHand: [{ op: 'apply', status: 'tp_storm_store', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Retain. Gain 6 Block. At the end of each turn this stays in your hand, store 4 Storm.',
      effects: [{ op: 'block', amount: 6, to: 'self' }],
      onEndTurnInHand: [{ op: 'apply', status: 'tp_storm_store', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_stillness_anchor', name: 'Stillness Anchor', class: 'tempest', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '⚓',
    desc: 'Gain 10 Block. Enter Stillness: gain 5 Block at the end of each turn.',
    effects: [
      { op: 'block', amount: 10, to: 'self' },
      { op: 'remove_status', status: 'tp_gale', to: 'self' },
      { op: 'apply', status: 'tp_stillness', amount: 5, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 13 Block. Enter Stillness: gain 7 Block at the end of each turn.',
      effects: [
        { op: 'block', amount: 13, to: 'self' },
        { op: 'remove_status', status: 'tp_gale', to: 'self' },
        { op: 'apply', status: 'tp_stillness', amount: 7, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_forced_gale', name: 'Forced Gale', class: 'tempest', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🌬️',
    desc: 'Enter Gale: your attacks deal 30% more damage and you take 25% more attack damage. Draw 3 cards. If you leave Stillness, gain 2 Energy.',
    effects: [
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'energy', amount: 2 }],
        else: []
      },
      { op: 'remove_status', status: 'tp_stillness', to: 'self' },
      { op: 'apply', status: 'tp_gale', amount: 1, to: 'self' },
      { op: 'draw', amount: 3 }
    ],
    upgrade: {
      desc: 'Enter Gale: your attacks deal 30% more damage and you take 25% more attack damage. Draw 4 cards. If you leave Stillness, gain 2 Energy.',
      effects: [
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'tp_stillness', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'energy', amount: 2 }],
          else: []
        },
        { op: 'remove_status', status: 'tp_stillness', to: 'self' },
        { op: 'apply', status: 'tp_gale', amount: 1, to: 'self' },
        { op: 'draw', amount: 4 }
      ]
    }
  });

  DS.defineCard({
    id: 'tp_wind_mantle', name: 'Wind Mantle', class: 'tempest', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🪽', exhaust: true,
    desc: 'Gain 5 Momentum. Draw 1 card. Exhaust.',
    effects: [{ op: 'apply', status: 'tp_momentum', amount: 5, to: 'self' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Gain 7 Momentum. Draw 2 cards. Exhaust.',
      effects: [{ op: 'apply', status: 'tp_momentum', amount: 7, to: 'self' }, { op: 'draw', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'tp_gather_clouds', name: 'Gather Clouds', class: 'tempest', type: 'skill', rarity: 'rare',
    cost: 'X', target: 'self', icon: '🌥️',
    desc: 'Spend all Energy. Store 2 Storm per Energy spent.',
    effects: [{ op: 'apply', status: 'tp_storm_store', amount: { v: 'x', mul: 2 }, to: 'self' }],
    upgrade: {
      desc: 'Spend all Energy. Store 3 Storm per Energy spent.',
      effects: [{ op: 'apply', status: 'tp_storm_store', amount: { v: 'x', mul: 3 }, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_tempest_veil', name: 'Tempest Veil', class: 'tempest', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🧥', retain: true,
    desc: 'Retain. Gain 14 Block.',
    effects: [{ op: 'block', amount: 14, to: 'self' }],
    upgrade: { desc: 'Retain. Gain 18 Block.', effects: [{ op: 'block', amount: 18, to: 'self' }] }
  });

  // ----- rare powers (4) -----
  DS.defineCard({
    id: 'tp_crown_of_storms', name: 'Crown of Storms', class: 'tempest', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '🪄',
    desc: 'Whenever you play a Power, store 3 Storm.',
    effects: [{ op: 'apply', status: 'tp_storm_crown', amount: 3, to: 'self' }],
    upgrade: { desc: 'Whenever you play a Power, store 4 Storm.', effects: [{ op: 'apply', status: 'tp_storm_crown', amount: 4, to: 'self' }] }
  });

  DS.defineCard({
    id: 'tp_typhoon_eye', name: 'Typhoon Eye', class: 'tempest', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🧿',
    desc: 'At the start of each turn, store 2 Storm and gain 1 Momentum.',
    effects: [{ op: 'apply', status: 'tp_eye_of_typhoon', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, store 3 Storm and gain 1 Momentum.',
      effects: [{ op: 'apply', status: 'tp_eye_of_typhoon', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_stormcaller_sigil', name: 'Stormcaller Sigil', class: 'tempest', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🔮',
    desc: 'Whenever you play your 3rd Attack each turn, gain 1 Energy.',
    effects: [{ op: 'apply', status: 'tp_stormcaller', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play your 3rd Attack each turn, gain 2 Energy.',
      effects: [{ op: 'apply', status: 'tp_stormcaller', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'tp_thunder_vault', name: 'Thunder Vault', class: 'tempest', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🏦',
    desc: 'At the start of each turn, if you have 10 or more Stored Storm, deal 8 damage to ALL enemies and spend 10 Storm.',
    effects: [{ op: 'apply', status: 'tp_thunder_reserve', amount: 8, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, if you have 10 or more Stored Storm, deal 12 damage to ALL enemies and spend 10 Storm.',
      effects: [{ op: 'apply', status: 'tp_thunder_reserve', amount: 12, to: 'self' }]
    }
  });

  // ===========================================================================
  // SPECIAL TOKEN (created by Wisp Strike; never offered as a reward)
  // ===========================================================================
  DS.defineCard({
    id: 'tp_wisp', name: 'Wisp', class: 'tempest', type: 'attack', rarity: 'special',
    cost: 0, target: 'enemy', icon: '🫧', ethereal: true,
    desc: 'Deal 4 damage. Ethereal.',
    effects: [{ op: 'damage', amount: 4 }],
    upgrade: { desc: 'Deal 6 damage. Ethereal.', effects: [{ op: 'damage', amount: 6 }] }
  });
})();
