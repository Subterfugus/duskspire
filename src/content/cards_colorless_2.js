(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // Colorless expansion (version 2). Ids prefixed cl_ (cards and custom statuses), curse_ (curses),
  // status_ (status cards). Built-in statuses and existing cards from cards_colorless.js are only referenced.

  // =====================================================================
  // Custom statuses owned by this file (prefix cl_)
  // =====================================================================

  // Power: at the start of each turn, gain Block.
  DS.defineStatus({
    id: 'cl_scales_st', name: 'Iron Scales', desc: 'At the start of each turn, gain {n} Block.',
    type: 'buff', icon: '🐉', stacks: true, expire: null, decay: null,
    triggers: {
      onTurnStart: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Power: whenever you kill an enemy, gain Gold.
  DS.defineStatus({
    id: 'cl_robber_st', name: 'Grave Robbing', desc: 'Whenever you kill an enemy, gain {n} Gold.',
    type: 'buff', icon: '🪦', stacks: true, expire: null, decay: null,
    triggers: {
      onKill: [{ op: 'gold', amount: { v: 'stacks' } }]
    }
  });

  // Power: energy each turn, paid for with a Dazed in hand.
  DS.defineStatus({
    id: 'cl_dread_st', name: 'Dread Pact', desc: 'At the start of each turn, gain {n} Energy and add a Dazed to your hand.',
    type: 'buff', icon: '🌑', stacks: true, expire: null, decay: null,
    triggers: {
      onTurnStart: [
        { op: 'energy', amount: { v: 'stacks' } },
        { op: 'add_card', card: 'status_dazed', to: 'hand', amount: 1 }
      ]
    }
  });

  // Power: whenever you draw a Curse, gain Energy.
  DS.defineStatus({
    id: 'cl_black_market_st', name: 'Black Market', desc: 'Whenever you draw a Curse, gain {n} Energy.',
    type: 'buff', icon: '🕴️', stacks: true, expire: null, decay: null,
    triggers: {
      onCardDrawn: {
        when: { cardType: 'curse' },
        effects: [{ op: 'energy', amount: { v: 'stacks' } }]
      }
    }
  });

  // Power: whenever you play a Skill, hit a random enemy.
  DS.defineStatus({
    id: 'cl_sparks_st', name: 'Skill Sparks', desc: 'Whenever you play a Skill, deal {n} damage to a random enemy.',
    type: 'buff', icon: '🎇', stacks: true, expire: null, decay: null,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
      }
    }
  });

  // Power: at the start of each turn, hit every enemy.
  DS.defineStatus({
    id: 'cl_siege_st', name: 'Siege Engine', desc: 'At the start of each turn, deal {n} damage to ALL enemies.',
    type: 'buff', icon: '🛠️', stacks: true, expire: null, decay: null,
    triggers: {
      onTurnStart: [{ op: 'damage', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  // Power: at the start of each turn, heal.
  DS.defineStatus({
    id: 'cl_sanctuary_st', name: 'Sanctuary', desc: 'At the start of each turn, heal {n} HP.',
    type: 'buff', icon: '⛪', stacks: true, expire: null, decay: null,
    triggers: {
      onTurnStart: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Power: whenever you play an expensive card, gain Block.
  DS.defineStatus({
    id: 'cl_mirror_st', name: 'Mirror Sigil', desc: 'Whenever you play a card that costs 2 or more, gain {n} Block.',
    type: 'buff', icon: '🔯', stacks: true, expire: null, decay: null,
    triggers: {
      onCardPlayed: {
        when: { costAtLeast: 2 },
        effects: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // Power: at the start of each turn, add random colorless Skills to your hand.
  DS.defineStatus({
    id: 'cl_idol_st', name: 'Forgotten Idol', desc: 'At the start of each turn, add {n} random colorless Skill(s) to your hand.',
    type: 'buff', icon: '🗿', stacks: true, expire: null, decay: null,
    triggers: {
      onTurnStart: [{ op: 'add_card', card: 'random', class: 'colorless', type: 'skill', to: 'hand', amount: { v: 'stacks' } }]
    }
  });

  // Power: at the start of each turn, gain Strength and pay HP.
  DS.defineStatus({
    id: 'cl_oath_st', name: 'Oath of Dusk', desc: 'At the start of each turn, gain {n} Strength and lose 1 HP.',
    type: 'buff', icon: '🌒', stacks: true, expire: null, decay: null,
    triggers: {
      onTurnStart: [
        { op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' },
        { op: 'lose_hp', amount: 1, to: 'self' }
      ]
    }
  });

  // =====================================================================
  // Colorless cards: UNCOMMON (20)
  // =====================================================================

  DS.defineCard({
    id: 'cl_counterpoint', name: 'Counterpoint', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'none', icon: '⚖️',
    desc: 'If you have played an Attack this turn, draw 2 cards. Otherwise, gain 4 Block.',
    effects: [{
      op: 'if', cond: { left: { v: 'attacks_played' }, cmp: '>=', right: 1 },
      then: [{ op: 'draw', amount: 2 }],
      else: [{ op: 'block', amount: 4, to: 'self' }]
    }],
    upgrade: {
      desc: 'If you have played an Attack this turn, draw 3 cards. Otherwise, gain 6 Block.',
      effects: [{
        op: 'if', cond: { left: { v: 'attacks_played' }, cmp: '>=', right: 1 },
        then: [{ op: 'draw', amount: 3 }],
        else: [{ op: 'block', amount: 6, to: 'self' }]
      }]
    }
  });

  DS.defineCard({
    id: 'cl_cross_rhythm', name: 'Cross Rhythm', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🥁',
    desc: 'Deal 5 damage. If you have played a non-Attack card this turn, deal 5 more.',
    effects: [
      { op: 'damage', amount: 5 },
      {
        op: 'if', cond: { left: { v: 'cards_played' }, cmp: '>', right: { v: 'attacks_played' } },
        then: [{ op: 'damage', amount: 5 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 7 damage. If you have played a non-Attack card this turn, deal 7 more.',
      effects: [
        { op: 'damage', amount: 7 },
        {
          op: 'if', cond: { left: { v: 'cards_played' }, cmp: '>', right: { v: 'attacks_played' } },
          then: [{ op: 'damage', amount: 7 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'cl_tandem_strike', name: 'Tandem Strike', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🤝',
    desc: 'Deal 4 damage, plus 2 more for each other Attack you have played this turn.',
    effects: [{ op: 'damage', amount: { v: 'attacks_played', mul: 2, add: 2 } }],
    upgrade: {
      desc: 'Deal 6 damage, plus 3 more for each other Attack you have played this turn.',
      effects: [{ op: 'damage', amount: { v: 'attacks_played', mul: 3, add: 3 } }]
    }
  });

  DS.defineCard({
    id: 'cl_bounty_shot', name: 'Bounty Shot', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🏹',
    desc: 'Deal 6 damage. If this kills, gain 10 Gold.',
    effects: [{ op: 'damage', amount: 6, onKill: [{ op: 'gold', amount: 10 }] }],
    upgrade: {
      desc: 'Deal 8 damage. If this kills, gain 15 Gold.',
      effects: [{ op: 'damage', amount: 8, onKill: [{ op: 'gold', amount: 15 }] }]
    }
  });

  DS.defineCard({
    id: 'cl_gilded_blade', name: 'Gilded Blade', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '💴',
    desc: 'Deal 4 damage, plus 1 for every 10 Gold you have.',
    effects: [{ op: 'damage', amount: { v: 'gold', mul: 0.1, add: 4 } }],
    upgrade: {
      desc: 'Deal 6 damage, plus 1 for every 10 Gold you have.',
      effects: [{ op: 'damage', amount: { v: 'gold', mul: 0.1, add: 6 } }]
    }
  });

  DS.defineCard({
    id: 'cl_dark_bargain', name: 'Midnight Bargain', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'none', icon: '📿',
    desc: 'Gain 2 Energy. Add a Wound to your discard pile.',
    effects: [
      { op: 'energy', amount: 2 },
      { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }
    ],
    upgrade: {
      desc: 'Gain 3 Energy. Add a Wound to your discard pile.',
      effects: [
        { op: 'energy', amount: 3 },
        { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'cl_cull', name: 'Cull', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '✂️',
    desc: 'Exhaust a card in your hand. Gain 4 Block.',
    effects: [
      { op: 'exhaust', amount: 1 },
      { op: 'block', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Exhaust a card in your hand. Gain 6 Block.',
      effects: [
        { op: 'exhaust', amount: 1 },
        { op: 'block', amount: 6, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'cl_sift', name: 'Sift', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🔍',
    desc: 'Draw 1 card. Then discard 1 card.',
    effects: [{ op: 'draw', amount: 1 }, { op: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Draw 2 cards. Then discard 1 card.',
      effects: [{ op: 'draw', amount: 2 }, { op: 'discard', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'cl_long_watch', name: 'Long Watch', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🏰', retain: true,
    desc: 'Gain 5 Block. Retain.',
    effects: [{ op: 'block', amount: 5, to: 'self' }],
    upgrade: {
      desc: 'Gain 7 Block. Retain.',
      effects: [{ op: 'block', amount: 7, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_flash_jab', name: 'Flash Jab', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 0, target: 'enemy', icon: '💨', ethereal: true,
    desc: 'Deal 4 damage. Ethereal.',
    effects: [{ op: 'damage', amount: 4 }],
    upgrade: {
      desc: 'Deal 6 damage. Ethereal.',
      effects: [{ op: 'damage', amount: 6 }]
    }
  });

  DS.defineCard({
    id: 'cl_reckless_lunge', name: 'Reckless Lunge', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 0, target: 'enemy', icon: '🤺',
    desc: 'Deal 7 damage. Lose 3 HP.',
    effects: [{ op: 'damage', amount: 7 }, { op: 'lose_hp', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Deal 10 damage. Lose 3 HP.',
      effects: [{ op: 'damage', amount: 10 }, { op: 'lose_hp', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_bulwark', name: 'Bulwark', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🧱',
    desc: 'Gain 12 Block.',
    effects: [{ op: 'block', amount: 12, to: 'self' }],
    upgrade: {
      desc: 'Gain 16 Block.',
      effects: [{ op: 'block', amount: 16, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_parry', name: 'Parry', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🤚',
    desc: 'Gain 5 Block. Draw 1 card.',
    effects: [{ op: 'block', amount: 5, to: 'self' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Gain 7 Block. Draw 1 card.',
      effects: [{ op: 'block', amount: 7, to: 'self' }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'cl_hardened_scales', name: 'Hardened Scales', class: 'colorless', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🐉',
    desc: 'At the start of each turn, gain 2 Block.',
    effects: [{ op: 'apply', status: 'cl_scales_st', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, gain 3 Block.',
      effects: [{ op: 'apply', status: 'cl_scales_st', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_grave_robber', name: 'Grave Robber', class: 'colorless', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪦',
    desc: 'Whenever you kill an enemy, gain 5 Gold.',
    effects: [{ op: 'apply', status: 'cl_robber_st', amount: 5, to: 'self' }],
    upgrade: {
      desc: 'Whenever you kill an enemy, gain 8 Gold.',
      effects: [{ op: 'apply', status: 'cl_robber_st', amount: 8, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_bloodwine', name: 'Bloodwine', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🍷', exhaust: true,
    desc: 'Lose 3 HP. Gain 2 Energy. Exhaust.',
    effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, { op: 'energy', amount: 2 }],
    upgrade: {
      desc: 'Lose 2 HP. Gain 2 Energy. Exhaust.',
      effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'energy', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'cl_whirlwind_kick', name: 'Whirlwind Kick', class: 'colorless', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '🦵',
    desc: 'Deal 5 damage to ALL enemies. Gain 3 Block.',
    effects: [{ op: 'damage', amount: 5, to: 'all_enemies' }, { op: 'block', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Deal 7 damage to ALL enemies. Gain 4 Block.',
      effects: [{ op: 'damage', amount: 7, to: 'all_enemies' }, { op: 'block', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_stitch_up', name: 'Stitch Up', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪡',
    desc: 'Heal 4 HP. Draw 1 card.',
    effects: [{ op: 'heal', amount: 4, to: 'self' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Heal 6 HP. Draw 1 card.',
      effects: [{ op: 'heal', amount: 6, to: 'self' }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'cl_loaded_dice', name: 'Loaded Dice', class: 'colorless', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🎰',
    desc: 'Add a random colorless Attack to your hand. Add a Dazed to your discard pile.',
    effects: [
      { op: 'add_card', card: 'random', class: 'colorless', type: 'attack', to: 'hand', amount: 1 },
      { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 }
    ],
    upgrade: {
      desc: 'Add 2 random colorless Attacks to your hand. Add a Dazed to your discard pile.',
      effects: [
        { op: 'add_card', card: 'random', class: 'colorless', type: 'attack', to: 'hand', amount: 2 },
        { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'cl_dread_pact', name: 'Dread Pact', class: 'colorless', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🌑',
    desc: 'At the start of each turn, gain 1 Energy and add a Dazed to your hand.',
    effects: [{ op: 'apply', status: 'cl_dread_st', amount: 1, to: 'self' }],
    upgrade: {
      cost: 0,
      desc: 'At the start of each turn, gain 1 Energy and add a Dazed to your hand.',
      effects: [{ op: 'apply', status: 'cl_dread_st', amount: 1, to: 'self' }]
    }
  });

  // =====================================================================
  // Colorless cards: RARE (15)
  // =====================================================================

  DS.defineCard({
    id: 'cl_powder_keg', name: 'Powder Keg', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🧨', ethereal: true,
    desc: 'Ethereal. Deal 18 damage to ALL enemies.',
    effects: [{ op: 'damage', amount: 18, to: 'all_enemies' }],
    upgrade: {
      desc: 'Ethereal. Deal 24 damage to ALL enemies.',
      effects: [{ op: 'damage', amount: 24, to: 'all_enemies' }]
    }
  });

  // Anti-boss: percent of the target's max HP, capped.
  DS.defineCard({
    id: 'cl_executors_mark', name: "Executor's Mark", class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '⚰️',
    desc: "Deal damage equal to 10% of the enemy's max HP, up to 30.",
    effects: [{
      op: 'if', cond: { left: { v: 'max_hp', mul: 0.1, of: 'target' }, cmp: '>=', right: 30 },
      then: [{ op: 'damage', amount: 30 }],
      else: [{ op: 'damage', amount: { v: 'max_hp', mul: 0.1, of: 'target' } }]
    }],
    upgrade: {
      desc: "Deal damage equal to 20% of the enemy's max HP, up to 45.",
      effects: [{
        op: 'if', cond: { left: { v: 'max_hp', mul: 0.2, of: 'target' }, cmp: '>=', right: 45 },
        then: [{ op: 'damage', amount: 45 }],
        else: [{ op: 'damage', amount: { v: 'max_hp', mul: 0.2, of: 'target' } }]
      }]
    }
  });

  // Finisher: percent of the target's missing HP, capped.
  DS.defineCard({
    id: 'cl_grudge_strike', name: 'Grudge Strike', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🔱',
    desc: "Deal damage equal to 25% of the enemy's missing HP, up to 40.",
    effects: [{
      op: 'if', cond: { left: { v: 'missing_hp', mul: 0.25, of: 'target' }, cmp: '>=', right: 40 },
      then: [{ op: 'damage', amount: 40 }],
      else: [{ op: 'damage', amount: { v: 'missing_hp', mul: 0.25, of: 'target' } }]
    }],
    upgrade: {
      desc: "Deal damage equal to 50% of the enemy's missing HP, up to 60.",
      effects: [{
        op: 'if', cond: { left: { v: 'missing_hp', mul: 0.5, of: 'target' }, cmp: '>=', right: 60 },
        then: [{ op: 'damage', amount: 60 }],
        else: [{ op: 'damage', amount: { v: 'missing_hp', mul: 0.5, of: 'target' } }]
      }]
    }
  });

  // Economy: gold-scaled damage, capped.
  DS.defineCard({
    id: 'cl_midas_touch', name: 'Midas Touch', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '✨',
    desc: 'Deal 1 damage for every 4 Gold you have, up to 40.',
    effects: [{
      op: 'if', cond: { left: { v: 'gold', mul: 0.25 }, cmp: '>=', right: 40 },
      then: [{ op: 'damage', amount: 40 }],
      else: [{ op: 'damage', amount: { v: 'gold', mul: 0.25 } }]
    }],
    upgrade: {
      desc: 'Deal 1 damage for every 4 Gold you have, up to 60.',
      effects: [{
        op: 'if', cond: { left: { v: 'gold', mul: 0.25 }, cmp: '>=', right: 60 },
        then: [{ op: 'damage', amount: 60 }],
        else: [{ op: 'damage', amount: { v: 'gold', mul: 0.25 } }]
      }]
    }
  });

  // Risk power: curses become energy.
  DS.defineCard({
    id: 'cl_black_market', name: 'Black Market', class: 'colorless', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '🕴️',
    desc: 'Whenever you draw a Curse, gain 2 Energy.',
    effects: [{ op: 'apply', status: 'cl_black_market_st', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you draw a Curse, gain 3 Energy.',
      effects: [{ op: 'apply', status: 'cl_black_market_st', amount: 3, to: 'self' }]
    }
  });

  // Defensive staple: big retained block.
  DS.defineCard({
    id: 'cl_aegis', name: 'Aegis', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🪽', retain: true,
    desc: 'Gain 16 Block. Retain.',
    effects: [{ op: 'block', amount: 16, to: 'self' }],
    upgrade: {
      desc: 'Gain 22 Block. Retain.',
      effects: [{ op: 'block', amount: 22, to: 'self' }]
    }
  });

  // Cross-class enabler: rewards playing Skills.
  DS.defineCard({
    id: 'cl_skill_sparks', name: 'Skill Sparks', class: 'colorless', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '🎇',
    desc: 'Whenever you play a Skill, deal 4 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'cl_sparks_st', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play a Skill, deal 6 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'cl_sparks_st', amount: 6, to: 'self' }]
    }
  });

  // Attack that refunds tempo when it kills.
  DS.defineCard({
    id: 'cl_reaper_chain', name: 'Reaper Chain', class: 'colorless', type: 'attack', rarity: 'rare',
    cost: 1, target: 'enemy', icon: '🔗',
    desc: 'Deal 8 damage. If this kills, draw 2 cards and gain 1 Energy.',
    effects: [{ op: 'damage', amount: 8, onKill: [{ op: 'draw', amount: 2 }, { op: 'energy', amount: 1 }] }],
    upgrade: {
      desc: 'Deal 11 damage. If this kills, draw 2 cards and gain 1 Energy.',
      effects: [{ op: 'damage', amount: 11, onKill: [{ op: 'draw', amount: 2 }, { op: 'energy', amount: 1 }] }]
    }
  });

  // Economy with a risk: big gold, paid in junk cards.
  DS.defineCard({
    id: 'cl_plunder', name: 'Plunder', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '💎', exhaust: true,
    desc: 'Gain 40 Gold. Add 2 Dazed to your hand. Exhaust.',
    effects: [{ op: 'gold', amount: 40 }, { op: 'add_card', card: 'status_dazed', to: 'hand', amount: 2 }],
    upgrade: {
      desc: 'Gain 60 Gold. Add 2 Dazed to your hand. Exhaust.',
      effects: [{ op: 'gold', amount: 60 }, { op: 'add_card', card: 'status_dazed', to: 'hand', amount: 2 }]
    }
  });

  // Exhaust-for-value.
  DS.defineCard({
    id: 'cl_burnt_offering', name: 'Ash Tithe', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🔥',
    desc: 'Gain 2 Energy for each other card in your hand. Exhaust all cards in your hand.',
    effects: [{ op: 'energy', amount: { v: 'hand', mul: 2 } }, { op: 'exhaust', amount: 'all' }],
    upgrade: {
      desc: 'Gain 3 Energy for each other card in your hand. Exhaust all cards in your hand.',
      effects: [{ op: 'energy', amount: { v: 'hand', mul: 3 } }, { op: 'exhaust', amount: 'all' }]
    }
  });

  // Retain helper.
  DS.defineCard({
    id: 'cl_eternal_draw', name: 'Eternal Draw', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '♾️', retain: true,
    desc: 'Draw 2 cards. Retain.',
    effects: [{ op: 'draw', amount: 2 }],
    upgrade: {
      desc: 'Draw 3 cards. Retain.',
      effects: [{ op: 'draw', amount: 3 }]
    }
  });

  // Anti-boss / board control: damage to every enemy each turn.
  DS.defineCard({
    id: 'cl_siege_engine', name: 'Siege Engine', class: 'colorless', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🛠️',
    desc: 'At the start of each turn, deal 3 damage to ALL enemies.',
    effects: [{ op: 'apply', status: 'cl_siege_st', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, deal 4 damage to ALL enemies.',
      effects: [{ op: 'apply', status: 'cl_siege_st', amount: 4, to: 'self' }]
    }
  });

  // Risk draw: pay HP for cards.
  DS.defineCard({
    id: 'cl_blood_price', name: 'Blood Price', class: 'colorless', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🩸',
    desc: 'Lose 6 HP. Draw 3 cards.',
    effects: [{ op: 'lose_hp', amount: 6, to: 'self' }, { op: 'draw', amount: 3 }],
    upgrade: {
      desc: 'Lose 4 HP. Draw 4 cards.',
      effects: [{ op: 'lose_hp', amount: 4, to: 'self' }, { op: 'draw', amount: 4 }]
    }
  });

  // Defensive staple: healing each turn.
  DS.defineCard({
    id: 'cl_sanctuary', name: 'Sanctuary', class: 'colorless', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '⛪',
    desc: 'At the start of each turn, heal 3 HP.',
    effects: [{ op: 'apply', status: 'cl_sanctuary_st', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, heal 4 HP.',
      effects: [{ op: 'apply', status: 'cl_sanctuary_st', amount: 4, to: 'self' }]
    }
  });

  // Cross-class / cost enabler: rewards expensive cards.
  DS.defineCard({
    id: 'cl_mirror_sigil', name: 'Mirror Sigil', class: 'colorless', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '🔯',
    desc: 'Whenever you play a card that costs 2 or more, gain 4 Block.',
    effects: [{ op: 'apply', status: 'cl_mirror_st', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play a card that costs 2 or more, gain 6 Block.',
      effects: [{ op: 'apply', status: 'cl_mirror_st', amount: 6, to: 'self' }]
    }
  });

  // =====================================================================
  // Colorless cards: SPECIAL (5, never offered in rewards; granted by events and relics)
  // =====================================================================

  DS.defineCard({
    id: 'cl_ancient_ledger', name: 'Ancient Ledger', class: 'colorless', type: 'skill', rarity: 'special',
    cost: 0, target: 'none', icon: '📖',
    desc: 'Gain 20 Gold. Add a Debt to your discard pile.',
    effects: [{ op: 'gold', amount: 20 }, { op: 'add_card', card: 'curse_debt', to: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Gain 30 Gold. Add a Debt to your discard pile.',
      effects: [{ op: 'gold', amount: 30 }, { op: 'add_card', card: 'curse_debt', to: 'discard', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'cl_second_breath', name: 'Second Breath', class: 'colorless', type: 'skill', rarity: 'special',
    cost: 1, target: 'none', icon: '🌅', exhaust: true,
    desc: 'Heal 10 HP. Draw 1 card. Exhaust.',
    effects: [{ op: 'heal', amount: 10, to: 'self' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Heal 14 HP. Draw 1 card. Exhaust.',
      effects: [{ op: 'heal', amount: 14, to: 'self' }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'cl_warded_soul', name: 'Warded Soul', class: 'colorless', type: 'power', rarity: 'special',
    cost: 1, target: 'self', icon: '🔮',
    desc: 'Gain 2 Buffer.',
    effects: [{ op: 'apply', status: 'buffer', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Buffer.',
      effects: [{ op: 'apply', status: 'buffer', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_forgotten_idol', name: 'Forgotten Idol', class: 'colorless', type: 'power', rarity: 'special',
    cost: 1, target: 'self', icon: '🗿',
    desc: 'At the start of each turn, add a random colorless Skill to your hand.',
    effects: [{ op: 'apply', status: 'cl_idol_st', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, add 2 random colorless Skills to your hand.',
      effects: [{ op: 'apply', status: 'cl_idol_st', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'cl_oath_of_dusk', name: 'Oath of Dusk', class: 'colorless', type: 'power', rarity: 'special',
    cost: 2, target: 'self', icon: '🌒',
    desc: 'At the start of each turn, gain 1 Strength and lose 1 HP.',
    effects: [{ op: 'apply', status: 'cl_oath_st', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, gain 2 Strength and lose 1 HP.',
      effects: [{ op: 'apply', status: 'cl_oath_st', amount: 2, to: 'self' }]
    }
  });

  // =====================================================================
  // Curses (class curse, unplayable). Each has a distinct drawback.
  // =====================================================================

  // Drawback: gold loss.
  DS.defineCard({
    id: 'curse_debt', name: 'Debt', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '🧾',
    desc: 'Unplayable. When drawn, lose 5 Gold.',
    effects: [],
    onDraw: [{ op: 'gold', amount: -5 }]
  });

  // Drawback: self-applied Vulnerable each time it is drawn.
  DS.defineCard({
    id: 'curse_brand', name: 'Brand', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '🧷',
    desc: 'Unplayable. When drawn, gain 1 Vulnerable.',
    effects: [],
    onDraw: [{ op: 'apply', status: 'vulnerable', amount: 1, to: 'self' }]
  });

  // Drawback: permanent max HP loss.
  DS.defineCard({
    id: 'curse_brittle', name: 'Brittle', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '🦴',
    desc: 'Unplayable. When drawn, lose 1 max HP.',
    effects: [],
    onDraw: [{ op: 'max_hp', amount: -1 }]
  });

  // Drawback: ethereal, and each exhaust leaves a Wound behind.
  DS.defineCard({
    id: 'curse_hunger', name: 'Hunger', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '🪤', ethereal: true,
    desc: 'Unplayable. Ethereal. When exhausted, add a Wound to your discard pile.',
    effects: [],
    onExhaust: [{ op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }]
  });

  // Drawback: clogs the discard pile with a Slimed each time it is drawn.
  DS.defineCard({
    id: 'curse_stain', name: 'Stain', class: 'curse', type: 'curse', rarity: 'special',
    cost: -1, target: 'none', icon: '💧',
    desc: 'Unplayable. When drawn, add a Slimed to your discard pile.',
    effects: [],
    onDraw: [{ op: 'add_card', card: 'status_slimed', to: 'discard', amount: 1 }]
  });

  // =====================================================================
  // Status cards (class status, unplayable)
  // =====================================================================

  // Lose HP when drawn.
  DS.defineCard({
    id: 'status_bruise', name: 'Bruise', class: 'status', type: 'status', rarity: 'special',
    cost: -1, target: 'none', icon: '🫀',
    desc: 'Unplayable. When drawn, lose 2 HP.',
    effects: [],
    onDraw: [{ op: 'lose_hp', amount: 2, to: 'self' }]
  });

  // Ethereal; lose HP when it is exhausted.
  DS.defineCard({
    id: 'status_cinder', name: 'Cinder', class: 'status', type: 'status', rarity: 'special',
    cost: -1, target: 'none', icon: '🧯', ethereal: true,
    desc: 'Unplayable. Ethereal. When exhausted, lose 3 HP.',
    effects: [],
    onExhaust: [{ op: 'lose_hp', amount: 3, to: 'self' }]
  });

  // Lose Energy when it is discarded.
  DS.defineCard({
    id: 'status_frostbite', name: 'Frostbite', class: 'status', type: 'status', rarity: 'special',
    cost: -1, target: 'none', icon: '❄️',
    desc: 'Unplayable. When discarded, lose 1 Energy.',
    effects: [],
    onDiscard: [{ op: 'energy', amount: -1 }]
  });

})();
