(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // Colorless expansion (version 3). Ids prefixed cl_ (cards and custom statuses), curse_ (curses),
  // status_ (status cards). Built-in statuses and existing cards are only referenced.
  // 37 new colorless cards: 13 common, 15 uncommon, 9 rare. Plus 4 curses and 2 status cards.

  // =====================================================================
  // Custom statuses owned by this file (prefix cl_)
  // =====================================================================

  // Power: whenever you gain Gold during combat, gain Block.
  DS.defineStatus({
    id: 'cl_glint_st', name: 'Glint of Gold', desc: 'Whenever you gain Gold during combat, gain {n} Block.',
    type: 'buff', icon: '🪙', stacks: true, expire: null, decay: null,
    triggers: {
      onGoldGained: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Power: whenever you play a Skill, draw cards.
  DS.defineStatus({
    id: 'cl_studious_st', name: 'Studious Mind', desc: 'Whenever you play a Skill, draw {n} card(s).',
    type: 'buff', icon: '📖', stacks: true, expire: null, decay: null,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'draw', amount: { v: 'stacks' } }]
      }
    }
  });

  // Power: whenever you use a Potion, gain Block and draw a card.
  DS.defineStatus({
    id: 'cl_resonance_st', name: 'Alchemical Resonance', desc: 'Whenever you use a Potion, gain {n} Block and draw 1 card.',
    type: 'buff', icon: '🎼', stacks: true, expire: null, decay: null,
    triggers: {
      onPotionUsed: [
        { op: 'block', amount: { v: 'stacks' }, to: 'self' },
        { op: 'draw', amount: 1 }
      ]
    }
  });

  // Power: once each turn, when you gain Block, gain Strength.
  DS.defineStatus({
    id: 'cl_adamant_st', name: 'Unbending Will', desc: 'Once each turn, when you gain Block, gain {n} Strength.',
    type: 'buff', icon: '🏛️', stacks: true, expire: null, decay: null,
    triggers: {
      onBlockGained: {
        oncePerTurn: true,
        effects: [{ op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // =====================================================================
  // Colorless cards: COMMON (13)
  // =====================================================================

  DS.defineCard({
    id: 'cl_pocket_jab', name: 'Pocket Jab', class: 'colorless', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '🤜',
    desc: 'Deal 3 damage. Gain 1 Block.',
    effects: [{ op: 'damage', amount: 3 }, { op: 'block', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Deal 4 damage. Gain 2 Block.',
      effects: [{ op: 'damage', amount: 4 }, { op: 'block', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_scrap_guard', name: 'Scrap Guard', class: 'colorless', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🧤',
    desc: 'Gain 3 Block.',
    effects: [{ op: 'block', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Gain 4 Block.',
      effects: [{ op: 'block', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_pocket_change', name: 'Pocket Change', class: 'colorless', type: 'skill', rarity: 'common',
    cost: 0, target: 'none', icon: '💵',
    desc: 'Gain 5 Gold.',
    effects: [{ op: 'gold', amount: 5 }],
    upgrade: {
      desc: 'Gain 8 Gold.',
      effects: [{ op: 'gold', amount: 8 }]
    }
  });

  DS.defineCard({
    id: 'cl_spark_snap', name: 'Spark Snap', class: 'colorless', type: 'skill', rarity: 'common',
    cost: 0, target: 'none', icon: '🔆', exhaust: true,
    desc: 'Gain 1 Energy. Exhaust.',
    effects: [{ op: 'energy', amount: 1 }],
    upgrade: {
      desc: 'Gain 1 Energy. Gain 2 Block. Exhaust.',
      effects: [{ op: 'energy', amount: 1 }, { op: 'block', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_stone_throw', name: 'Stone Throw', class: 'colorless', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🥌',
    desc: 'Deal 6 damage.',
    effects: [{ op: 'damage', amount: 6 }],
    upgrade: {
      desc: 'Deal 8 damage.',
      effects: [{ op: 'damage', amount: 8 }]
    }
  });

  DS.defineCard({
    id: 'cl_wide_swing', name: 'Wide Swing', class: 'colorless', type: 'attack', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '🌊',
    desc: 'Deal 4 damage to ALL enemies.',
    effects: [{ op: 'damage', amount: 4, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 6 damage to ALL enemies.',
      effects: [{ op: 'damage', amount: 6, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'cl_sturdy_guard', name: 'Sturdy Guard', class: 'colorless', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🔰',
    desc: 'Gain 6 Block.',
    effects: [{ op: 'block', amount: 6, to: 'self' }],
    upgrade: {
      desc: 'Gain 8 Block.',
      effects: [{ op: 'block', amount: 8, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_steady_hands', name: 'Steady Hands', class: 'colorless', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🤲',
    desc: 'Gain 4 Block. Draw 1 card.',
    effects: [{ op: 'block', amount: 4, to: 'self' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Gain 6 Block. Draw 1 card.',
      effects: [{ op: 'block', amount: 6, to: 'self' }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'cl_salve', name: 'Salve', class: 'colorless', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🧴',
    desc: 'Heal 4 HP.',
    effects: [{ op: 'heal', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Heal 6 HP.',
      effects: [{ op: 'heal', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_ember_fling', name: 'Ember Fling', class: 'colorless', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🌶️',
    desc: 'Deal 5 damage. Apply 1 Vulnerable.',
    effects: [{ op: 'damage', amount: 5 }, { op: 'apply', status: 'vulnerable', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Deal 7 damage. Apply 1 Vulnerable.',
      effects: [{ op: 'damage', amount: 7 }, { op: 'apply', status: 'vulnerable', amount: 1, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'cl_pickpocket', name: 'Pickpocket', class: 'colorless', type: 'skill', rarity: 'common',
    cost: 1, target: 'none', icon: '🤑',
    desc: 'Gain 8 Gold.',
    effects: [{ op: 'gold', amount: 8 }],
    upgrade: {
      desc: 'Gain 12 Gold.',
      effects: [{ op: 'gold', amount: 12 }]
    }
  });

  DS.defineCard({
    id: 'cl_heavy_swing', name: 'Heavy Swing', class: 'colorless', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🏋️',
    desc: 'Deal 10 damage.',
    effects: [{ op: 'damage', amount: 10 }],
    upgrade: {
      desc: 'Deal 13 damage.',
      effects: [{ op: 'damage', amount: 13 }]
    }
  });

  DS.defineCard({
    id: 'cl_sturdy_wall', name: 'Sturdy Wall', class: 'colorless', type: 'skill', rarity: 'common',
    cost: 2, target: 'self', icon: '🏗️',
    desc: 'Gain 10 Block.',
    effects: [{ op: 'block', amount: 10, to: 'self' }],
    upgrade: {
      desc: 'Gain 13 Block.',
      effects: [{ op: 'block', amount: 13, to: 'self' }]
    }
  });

  // =====================================================================
  // Colorless cards: UNCOMMON (15)
  // =====================================================================

  DS.defineCard({
    id: 'cl_overclock', name: 'Overclock', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'none', icon: '🔌', exhaust: true,
    desc: 'Gain 1 Energy. Draw 1 card. Exhaust.',
    effects: [{ op: 'energy', amount: 1 }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Gain 1 Energy. Draw 2 cards. Exhaust.',
      effects: [{ op: 'energy', amount: 1 }, { op: 'draw', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'cl_bullion', name: 'Bullion', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'none', icon: '🏦', exhaust: true,
    desc: 'Gain 1 Energy for every 100 Gold you have, up to 2. Exhaust.',
    effects: [{
      op: 'if', cond: { left: { v: 'gold', mul: 0.01 }, cmp: '>=', right: 2 },
      then: [{ op: 'energy', amount: 2 }],
      else: [{ op: 'energy', amount: { v: 'gold', mul: 0.01 } }]
    }],
    upgrade: {
      desc: 'Gain 1 Energy for every 100 Gold you have, up to 3. Exhaust.',
      effects: [{
        op: 'if', cond: { left: { v: 'gold', mul: 0.01 }, cmp: '>=', right: 3 },
        then: [{ op: 'energy', amount: 3 }],
        else: [{ op: 'energy', amount: { v: 'gold', mul: 0.01 } }]
      }]
    }
  });

  DS.defineCard({
    id: 'cl_sundering_blow', name: 'Sundering Blow', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🪚',
    desc: 'Deal 12 damage, or 18 if the enemy is Vulnerable.',
    effects: [{
      op: 'if', cond: { left: { v: 'status', status: 'vulnerable', of: 'target' }, cmp: '>=', right: 1 },
      then: [{ op: 'damage', amount: 18 }],
      else: [{ op: 'damage', amount: 12 }]
    }],
    upgrade: {
      desc: 'Deal 14 damage, or 21 if the enemy is Vulnerable.',
      effects: [{
        op: 'if', cond: { left: { v: 'status', status: 'vulnerable', of: 'target' }, cmp: '>=', right: 1 },
        then: [{ op: 'damage', amount: 21 }],
        else: [{ op: 'damage', amount: 14 }]
      }]
    }
  });

  DS.defineCard({
    id: 'cl_counterstrike', name: 'Counterstrike', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🦾',
    desc: 'Deal 6 damage. Gain 4 Block.',
    effects: [{ op: 'damage', amount: 6 }, { op: 'block', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Deal 8 damage. Gain 6 Block.',
      effects: [{ op: 'damage', amount: 8 }, { op: 'block', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_buckshot', name: 'Buckshot', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '🎆',
    desc: 'Deal 4 damage to ALL enemies. Apply 1 Weak to ALL enemies.',
    effects: [
      { op: 'damage', amount: 4, to: 'all_enemies' },
      { op: 'apply', status: 'weak', amount: 1, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 6 damage to ALL enemies. Apply 2 Weak to ALL enemies.',
      effects: [
        { op: 'damage', amount: 6, to: 'all_enemies' },
        { op: 'apply', status: 'weak', amount: 2, to: 'all_enemies' }
      ]
    }
  });

  // Custom effect: block per potion the player is holding (run.potions holds id or null per slot).
  DS.defineCard({
    id: 'cl_flask_ward', name: 'Flask Ward', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧪',
    desc: 'Gain 3 Block for each potion you hold.',
    effects: [{
      op: 'custom',
      fn: async ({ combat, run }) => {
        const held = run && Array.isArray(run.potions) ? run.potions.filter(Boolean).length : 0;
        if (held > 0) await combat.gainBlock(combat.player, 3 * held, true);
      }
    }],
    upgrade: {
      desc: 'Gain 4 Block for each potion you hold.',
      effects: [{
        op: 'custom',
        fn: async ({ combat, run }) => {
          const held = run && Array.isArray(run.potions) ? run.potions.filter(Boolean).length : 0;
          if (held > 0) await combat.gainBlock(combat.player, 4 * held, true);
        }
      }]
    }
  });

  DS.defineCard({
    id: 'cl_cache', name: 'Cache', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '📦',
    desc: 'Add a random colorless Skill to your draw pile. Draw 1 card.',
    effects: [
      { op: 'add_card', card: 'random', class: 'colorless', type: 'skill', to: 'draw', amount: 1 },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Add 2 random colorless Skills to your draw pile. Draw 1 card.',
      effects: [
        { op: 'add_card', card: 'random', class: 'colorless', type: 'skill', to: 'draw', amount: 2 },
        { op: 'draw', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'cl_glitter', name: 'Glitter', class: 'colorless', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🌟',
    desc: 'Whenever you gain Gold during combat, gain 2 Block.',
    effects: [{ op: 'apply', status: 'cl_glint_st', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you gain Gold during combat, gain 3 Block.',
      effects: [{ op: 'apply', status: 'cl_glint_st', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_exorcism', name: 'Exorcism', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🔔',
    desc: 'Exhaust a Curse in your hand. Draw 2 cards.',
    effects: [{ op: 'exhaust', amount: 1, type: 'curse' }, { op: 'draw', amount: 2 }],
    upgrade: {
      desc: 'Exhaust a Curse in your hand. Draw 3 cards.',
      effects: [{ op: 'exhaust', amount: 1, type: 'curse' }, { op: 'draw', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'cl_stored_charge', name: 'Stored Charge', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🌩️', exhaust: true,
    desc: 'Next turn, gain 2 Energy. Exhaust.',
    effects: [{ op: 'apply', status: 'energized', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Next turn, gain 3 Energy. Exhaust.',
      effects: [{ op: 'apply', status: 'energized', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_coin_shield', name: 'Coin Shield', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🥇',
    desc: 'Gain 1 Block for every 10 Gold you have, up to 12.',
    effects: [{
      op: 'if', cond: { left: { v: 'gold', mul: 0.1 }, cmp: '>=', right: 12 },
      then: [{ op: 'block', amount: 12, to: 'self' }],
      else: [{ op: 'block', amount: { v: 'gold', mul: 0.1 }, to: 'self' }]
    }],
    upgrade: {
      desc: 'Gain 1 Block for every 10 Gold you have, up to 16.',
      effects: [{
        op: 'if', cond: { left: { v: 'gold', mul: 0.1 }, cmp: '>=', right: 16 },
        then: [{ op: 'block', amount: 16, to: 'self' }],
        else: [{ op: 'block', amount: { v: 'gold', mul: 0.1 }, to: 'self' }]
      }]
    }
  });

  DS.defineCard({
    id: 'cl_steel_nerves', name: 'Steel Nerves', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧘',
    desc: 'Gain 4 Block. Gain 1 Dexterity.',
    effects: [{ op: 'block', amount: 4, to: 'self' }, { op: 'apply', status: 'dexterity', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain 6 Block. Gain 1 Dexterity.',
      effects: [{ op: 'block', amount: 6, to: 'self' }, { op: 'apply', status: 'dexterity', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_desperate_lunge', name: 'Desperate Lunge', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🏃',
    desc: 'Deal 12 damage. Lose 4 HP.',
    effects: [{ op: 'damage', amount: 12 }, { op: 'lose_hp', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Deal 16 damage. Lose 3 HP.',
      effects: [{ op: 'damage', amount: 16 }, { op: 'lose_hp', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_last_gasp', name: 'Last Gasp', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '⏳',
    desc: 'Deal 6 damage. If you have no Energy left, draw 2 cards.',
    effects: [
      { op: 'damage', amount: 6 },
      {
        op: 'if', cond: { left: { v: 'energy' }, cmp: '<=', right: 0 },
        then: [{ op: 'draw', amount: 2 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 8 damage. If you have no Energy left, draw 3 cards.',
      effects: [
        { op: 'damage', amount: 8 },
        {
          op: 'if', cond: { left: { v: 'energy' }, cmp: '<=', right: 0 },
          then: [{ op: 'draw', amount: 3 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'cl_battle_trance', name: 'Battle Trance', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🎌', exhaust: true,
    desc: 'Lose 4 HP. Gain 2 Strength. Exhaust.',
    effects: [{ op: 'lose_hp', amount: 4, to: 'self' }, { op: 'apply', status: 'strength', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Lose 3 HP. Gain 3 Strength. Exhaust.',
      effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, { op: 'apply', status: 'strength', amount: 3, to: 'self' }]
    }
  });

  // =====================================================================
  // Colorless cards: RARE (9)
  // =====================================================================

  DS.defineCard({
    id: 'cl_reckoning', name: 'Reckoning', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🎴',
    desc: 'Deal 4 damage for each card you have played this turn, including this one.',
    effects: [{ op: 'damage', amount: { v: 'cards_played', mul: 4 } }],
    upgrade: {
      desc: 'Deal 6 damage for each card you have played this turn, including this one.',
      effects: [{ op: 'damage', amount: { v: 'cards_played', mul: 6 } }]
    }
  });

  DS.defineCard({
    id: 'cl_earthshaker', name: 'Earthshaker', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 3, target: 'all_enemies', icon: '🏔️',
    desc: 'Deal 12 damage to ALL enemies. Gain 6 Block.',
    effects: [{ op: 'damage', amount: 12, to: 'all_enemies' }, { op: 'block', amount: 6, to: 'self' }],
    upgrade: {
      desc: 'Deal 16 damage to ALL enemies. Gain 8 Block.',
      effects: [{ op: 'damage', amount: 16, to: 'all_enemies' }, { op: 'block', amount: 8, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_scholars_engine', name: "Scholar's Engine", class: 'colorless', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '📚',
    desc: 'Whenever you play a Skill, draw 1 card.',
    effects: [{ op: 'apply', status: 'cl_studious_st', amount: 1, to: 'self' }],
    upgrade: {
      cost: 1,
      desc: 'Whenever you play a Skill, draw 1 card.',
      effects: [{ op: 'apply', status: 'cl_studious_st', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_high_stakes', name: 'High Stakes', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 1, target: 'none', icon: '♠️',
    desc: 'Lose 15 Gold. Draw 3 cards.',
    effects: [{ op: 'gold', amount: -15 }, { op: 'draw', amount: 3 }],
    upgrade: {
      desc: 'Lose 10 Gold. Draw 4 cards.',
      effects: [{ op: 'gold', amount: -10 }, { op: 'draw', amount: 4 }]
    }
  });

  DS.defineCard({
    id: 'cl_potion_resonance', name: 'Potion Resonance', class: 'colorless', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '🧫',
    desc: 'Whenever you use a Potion, gain 4 Block and draw 1 card.',
    effects: [{ op: 'apply', status: 'cl_resonance_st', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Whenever you use a Potion, gain 6 Block and draw 1 card.',
      effects: [{ op: 'apply', status: 'cl_resonance_st', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_reapers_tithe', name: "Reaper's Tithe", class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 1, target: 'enemy', icon: '🖤',
    desc: 'Deal 10 damage. If this kills, heal 6 HP and gain 20 Gold.',
    effects: [{
      op: 'damage', amount: 10,
      onKill: [{ op: 'heal', amount: 6, to: 'self' }, { op: 'gold', amount: 20 }]
    }],
    upgrade: {
      desc: 'Deal 14 damage. If this kills, heal 8 HP and gain 30 Gold.',
      effects: [{
        op: 'damage', amount: 14,
        onKill: [{ op: 'heal', amount: 8, to: 'self' }, { op: 'gold', amount: 30 }]
      }]
    }
  });

  DS.defineCard({
    id: 'cl_gravity_well', name: 'Gravity Well', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 2, target: 'none', icon: '🌌',
    desc: 'Apply 2 Weak to ALL enemies. Gain 8 Block.',
    effects: [{ op: 'apply', status: 'weak', amount: 2, to: 'all_enemies' }, { op: 'block', amount: 8, to: 'self' }],
    upgrade: {
      desc: 'Apply 3 Weak to ALL enemies. Gain 10 Block.',
      effects: [{ op: 'apply', status: 'weak', amount: 3, to: 'all_enemies' }, { op: 'block', amount: 10, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_adamant_will', name: 'Adamant Will', class: 'colorless', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🗽',
    desc: 'Once each turn, when you gain Block, gain 1 Strength.',
    effects: [{ op: 'apply', status: 'cl_adamant_st', amount: 1, to: 'self' }],
    upgrade: {
      cost: 1,
      desc: 'Once each turn, when you gain Block, gain 1 Strength.',
      effects: [{ op: 'apply', status: 'cl_adamant_st', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_inferno_wave', name: 'Inferno Wave', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🌞',
    desc: 'Deal 6 damage to ALL enemies. Apply 3 Burn to ALL enemies.',
    effects: [{ op: 'damage', amount: 6, to: 'all_enemies' }, { op: 'apply', status: 'burn', amount: 3, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 8 damage to ALL enemies. Apply 4 Burn to ALL enemies.',
      effects: [{ op: 'damage', amount: 8, to: 'all_enemies' }, { op: 'apply', status: 'burn', amount: 4, to: 'all_enemies' }]
    }
  });

  // =====================================================================
  // Curses (class curse, unplayable). Each has a distinct drawback.
  // =====================================================================

  // Drawback: ethereal, so it is exhausted at the end of your turn and costs gold.
  DS.defineCard({
    id: 'curse_tithe', name: 'Tithe', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '💸', ethereal: true,
    desc: 'Unplayable. Ethereal. When exhausted, lose 5 Gold.',
    effects: [],
    onExhaust: [{ op: 'gold', amount: -5 }]
  });

  // Drawback: a Weak each turn you are holding a crowded hand.
  DS.defineCard({
    id: 'curse_gloom', name: 'Gloom', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '🦇', retain: true,
    desc: 'Unplayable. Retain. At the end of your turn, if you hold 4 or more cards, gain 2 Weak.',
    effects: [],
    onEndTurnInHand: [{
      op: 'if', cond: { left: { v: 'hand' }, cmp: '>=', right: 4 },
      then: [{ op: 'apply', status: 'weak', amount: 2, to: 'self' }],
      else: []
    }]
  });

  // Drawback: hurts whenever it is discarded (including at the end of your turn).
  DS.defineCard({
    id: 'curse_shrapnel', name: 'Shrapnel', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '📌',
    desc: 'Unplayable. When discarded, lose 2 HP.',
    effects: [],
    onDiscard: [{ op: 'lose_hp', amount: 2, to: 'self' }]
  });

  // Drawback: fills the discard pile with a Searing Ember each time it is drawn.
  DS.defineCard({
    id: 'curse_omen', name: 'Omen', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '👁️',
    desc: 'Unplayable. When drawn, add a Searing Ember to your discard pile.',
    effects: [],
    onDraw: [{ op: 'add_card', card: 'status_searing_ember', to: 'discard', amount: 1 }]
  });

  // =====================================================================
  // Status cards (class status, unplayable)
  // =====================================================================

  // Ethereal: when it is exhausted (at the end of your turn if still held), it burns every enemy and scorches you.
  DS.defineCard({
    id: 'status_searing_ember', name: 'Searing Ember', class: 'status', type: 'status', rarity: 'special',
    cost: -1, target: 'none', icon: '☄️', ethereal: true,
    desc: 'Unplayable. Ethereal. When exhausted, lose 2 HP and deal 4 damage to ALL enemies.',
    effects: [],
    onExhaust: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'damage', amount: 4, to: 'all_enemies' }]
  });

  // Drawback: applies Weak when it is drawn.
  DS.defineCard({
    id: 'status_numb', name: 'Numb', class: 'status', type: 'status', rarity: 'special',
    cost: -1, target: 'none', icon: '🥶',
    desc: 'Unplayable. When drawn, gain 1 Weak.',
    effects: [],
    onDraw: [{ op: 'apply', status: 'weak', amount: 1, to: 'self' }]
  });

})();
