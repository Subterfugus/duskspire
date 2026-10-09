(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // =====================================================================
  // SHADE — nimble assassin. Archetypes:
  //   POISON   : Poison stacking, catalysts (multiply_status), poison-scaling damage
  //   SHIV     : 0-cost exhausting shiv/vial tokens, many cheap attacks, multi-hits, X-storms
  //   CYCLE    : discard synergy, draw, exhaust engines (block/draw/energy on discard/exhaust)
  //   EVASION  : weak, dexterity, block, next-turn setup (energized / draw_next), retain
  // =====================================================================

  DS.defineCharacter({
    id: 'shade',
    name: 'Shade',
    title: 'The Silent Knife',
    desc: 'A nimble assassin who wins fights before they begin. Shade poisons enemies from the shadows, showers the battlefield with cheap shivs, and cycles through the deck faster than anyone else.',
    hp: 76,
    gold: 99,
    icon: '🗡️',
    color: '#27ae60',
    starterDeck: [
      'sh_strike', 'sh_strike', 'sh_strike', 'sh_strike', 'sh_strike',
      'sh_defend', 'sh_defend', 'sh_defend', 'sh_defend',
      'sh_venom_dart', 'sh_sidestep'
    ],
    starterRelic: 'sh_shadowcloak'
  });

  DS.defineRelic({
    id: 'sh_shadowcloak',
    name: 'Shadowcloak',
    desc: 'At the start of each combat, draw 2 extra cards. At the start of each of your turns, apply 1 Poison to a random enemy. At the end of each combat, heal 5 HP.',
    flavor: 'Stitched from the night itself. It never quite reflects the light.',
    rarity: 'starter',
    icon: '🧥',
    class: 'shade',
    passive: {},
    triggers: {
      onCombatStart: [{ op: 'draw', amount: 2 }],
      onTurnStart: [{ op: 'apply', status: 'poison', amount: 1, to: 'random_enemy' }],
      onCombatEnd: [{ op: 'heal', amount: 5 }]
    }
  });

  // =====================================================================
  // Custom statuses (granted to self by power cards; each has triggers)
  // =====================================================================

  DS.defineStatus({
    id: 'sh_aura_envenom', name: 'Envenom', type: 'buff', icon: '🧪', stacks: true,
    desc: 'Whenever you play an attack, apply {n} Poison to a random enemy.',
    triggers: {
      onCardPlayed: { when: { cardType: 'attack' }, effects: [{ op: 'apply', status: 'poison', amount: { v: 'stacks' }, to: 'random_enemy' }] }
    }
  });

  DS.defineStatus({
    id: 'sh_aura_plague', name: 'Plague Cloud', type: 'buff', icon: '☁️', stacks: true,
    desc: 'At the start of your turn, apply {n} Poison to ALL enemies.',
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'poison', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  DS.defineStatus({
    id: 'sh_aura_shiv_forge', name: 'Shiv Forge', type: 'buff', icon: '⚒️', stacks: true,
    desc: 'At the start of your turn, add {n} Shiv(s) to your hand.',
    triggers: {
      onTurnStart: [{ op: 'add_card', card: 'sh_shiv', to: 'hand', amount: { v: 'stacks' } }]
    }
  });

  DS.defineStatus({
    id: 'sh_aura_echo', name: 'Echo Blades', type: 'buff', icon: '🔁', stacks: true,
    desc: 'Whenever you play an attack, deal {n} damage to a random enemy.',
    triggers: {
      onCardPlayed: { when: { cardType: 'attack' }, effects: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }] }
    }
  });

  DS.defineStatus({
    id: 'sh_aura_scavenger', name: 'Scavenger', type: 'buff', icon: '🪝', stacks: true,
    desc: 'Whenever you discard a card, gain {n} Block.',
    triggers: {
      onCardDiscarded: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'sh_aura_cycle', name: 'Cycle Engine', type: 'buff', icon: '⚙️', stacks: true,
    desc: 'The first time each turn you discard a card, draw {n} card(s).',
    triggers: {
      onCardDiscarded: { oncePerTurn: true, effects: [{ op: 'draw', amount: { v: 'stacks' } }] }
    }
  });

  DS.defineStatus({
    id: 'sh_aura_tithe', name: 'Grave Tithe', type: 'buff', icon: '🪦', stacks: true,
    desc: 'Whenever you exhaust a card, gain {n} Block.',
    triggers: {
      onCardExhausted: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'sh_aura_evasion', name: 'Slip Away', type: 'buff', icon: '👤', stacks: true,
    desc: 'The first time each turn you are attacked, gain {n} Block.',
    triggers: {
      onAttacked: { oncePerTurn: true, effects: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }] }
    }
  });

  DS.defineStatus({
    id: 'sh_aura_nightshade', name: 'Nightshade', type: 'buff', icon: '🌿', stacks: true,
    desc: 'The first time each turn you apply a debuff, gain {n} Energy.',
    triggers: {
      onApplyDebuff: { oncePerTurn: true, effects: [{ op: 'energy', amount: { v: 'stacks' } }] }
    }
  });

  DS.defineStatus({
    id: 'sh_aura_veil', name: 'Shadow Veil', type: 'buff', icon: '🕶️', stacks: true,
    desc: 'Whenever you play a skill, gain {n} Dexterity.',
    triggers: {
      onCardPlayed: { when: { cardType: 'skill' }, effects: [{ op: 'apply', status: 'dexterity', amount: { v: 'stacks' }, to: 'self' }] }
    }
  });

  DS.defineStatus({
    id: 'sh_aura_backstab', name: 'Backstab', type: 'buff', icon: '🌒', stacks: true,
    desc: 'The first time each turn one of your attacks hits, apply {n} Weak to that enemy.',
    triggers: {
      onAttack: { oncePerTurn: true, effects: [{ op: 'apply', status: 'weak', amount: { v: 'stacks' }, to: 'target' }] }
    }
  });

  DS.defineStatus({
    id: 'sh_aura_bloodscent', name: 'Bloodscent', type: 'buff', icon: '🩸', stacks: true,
    desc: 'Whenever you kill an enemy, heal {n} HP.',
    triggers: {
      onKill: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'sh_aura_cadence', name: 'Cadence', type: 'buff', icon: '🥁', stacks: true,
    desc: 'Every 3rd card you play, gain {n} Energy.',
    triggers: {
      onCardPlayed: { every: 3, effects: [{ op: 'energy', amount: { v: 'stacks' } }] }
    }
  });

  DS.defineStatus({
    id: 'sh_aura_trophy', name: 'Trophy Hunter', type: 'buff', icon: '🏆', stacks: true,
    desc: 'Whenever you kill an enemy, draw {n} card(s).',
    triggers: {
      onKill: [{ op: 'draw', amount: { v: 'stacks' } }]
    }
  });

  DS.defineStatus({
    id: 'sh_aura_tally', name: "Reaper's Tally", type: 'buff', icon: '📿', stacks: true,
    desc: 'Whenever any enemy dies, gain {n} Block.',
    triggers: {
      onEnemyDeath: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // =====================================================================
  // Starter cards
  // =====================================================================

  DS.defineCard({
    id: 'sh_strike', name: 'Strike', class: 'shade', type: 'attack', rarity: 'starter',
    cost: 1, target: 'enemy', icon: '🗡️',
    desc: 'Deal 6 damage.',
    effects: [{ op: 'damage', amount: 6, to: 'target' }],
    upgrade: { desc: 'Deal 9 damage.', effects: [{ op: 'damage', amount: 9, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_defend', name: 'Defend', class: 'shade', type: 'skill', rarity: 'starter',
    cost: 1, target: 'self', icon: '🛡️',
    desc: 'Gain 5 Block.',
    effects: [{ op: 'block', amount: 5 }],
    upgrade: { desc: 'Gain 8 Block.', effects: [{ op: 'block', amount: 8 }] }
  });

  DS.defineCard({
    id: 'sh_venom_dart', name: 'Venom Dart', class: 'shade', type: 'skill', rarity: 'starter',
    cost: 1, target: 'enemy', icon: '🐍',
    desc: 'Apply 3 Poison.',
    effects: [{ op: 'apply', status: 'poison', amount: 3, to: 'target' }],
    upgrade: { desc: 'Apply 5 Poison.', effects: [{ op: 'apply', status: 'poison', amount: 5, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_sidestep', name: 'Sidestep', class: 'shade', type: 'skill', rarity: 'starter',
    cost: 1, target: 'self', icon: '💨',
    desc: 'Gain 5 Block. Draw 1 card.',
    effects: [{ op: 'block', amount: 5 }, { op: 'draw', amount: 1 }],
    upgrade: { desc: 'Gain 7 Block. Draw 1 card.', effects: [{ op: 'block', amount: 7 }, { op: 'draw', amount: 1 }] }
  });

  // =====================================================================
  // Tokens (rarity 'special', never offered as rewards)
  // =====================================================================

  DS.defineCard({
    id: 'sh_shiv', name: 'Shiv', class: 'shade', type: 'attack', rarity: 'special',
    cost: 0, target: 'enemy', icon: '🔪',
    desc: 'Deal 4 damage. Exhaust.',
    effects: [{ op: 'damage', amount: 4, to: 'target' }],
    exhaust: true,
    upgrade: { desc: 'Deal 6 damage. Exhaust.', effects: [{ op: 'damage', amount: 6, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_vial', name: 'Vial', class: 'shade', type: 'skill', rarity: 'special',
    cost: 0, target: 'enemy', icon: '🧪',
    desc: 'Apply 2 Poison. Exhaust.',
    effects: [{ op: 'apply', status: 'poison', amount: 2, to: 'target' }],
    exhaust: true,
    upgrade: { desc: 'Apply 3 Poison. Exhaust.', effects: [{ op: 'apply', status: 'poison', amount: 3, to: 'target' }] }
  });

  // =====================================================================
  // COMMON (24)
  // =====================================================================

  // ---- common attacks ----
  DS.defineCard({
    id: 'sh_quick_stab', name: 'Quick Stab', class: 'shade', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🔪',
    desc: 'Deal 8 damage.',
    effects: [{ op: 'damage', amount: 8, to: 'target' }],
    upgrade: { desc: 'Deal 11 damage.', effects: [{ op: 'damage', amount: 11, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_dagger_flick', name: 'Dagger Flick', class: 'shade', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '🗡️', innate: true,
    desc: 'Innate. Deal 4 damage.',
    effects: [{ op: 'damage', amount: 4, to: 'target' }],
    upgrade: { desc: 'Innate. Deal 6 damage.', effects: [{ op: 'damage', amount: 6, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_viper_bite', name: 'Viper Bite', class: 'shade', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🐍',
    desc: 'Deal 5 damage. Apply 3 Poison.',
    effects: [
      { op: 'damage', amount: 5, to: 'target' },
      { op: 'apply', status: 'poison', amount: 3, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 7 damage. Apply 4 Poison.',
      effects: [
        { op: 'damage', amount: 7, to: 'target' },
        { op: 'apply', status: 'poison', amount: 4, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_throwing_knives', name: 'Throwing Knives', class: 'shade', type: 'attack', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '🎯',
    desc: 'Deal 5 damage to ALL enemies.',
    effects: [{ op: 'damage', amount: 5, to: 'all_enemies' }],
    upgrade: { desc: 'Deal 7 damage to ALL enemies.', effects: [{ op: 'damage', amount: 7, to: 'all_enemies' }] }
  });

  DS.defineCard({
    id: 'sh_ambush', name: 'Ambush', class: 'shade', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🌑',
    desc: 'Deal 6 damage. If the target is Weak, deal 4 more.',
    effects: [
      { op: 'damage', amount: 6, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'weak', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 4, to: 'target' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 8 damage. If the target is Weak, deal 6 more.',
      effects: [
        { op: 'damage', amount: 8, to: 'target' },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'weak', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 6, to: 'target' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_twin_jab', name: 'Twin Jab', class: 'shade', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🤺',
    desc: 'Deal 3 damage 2 times.',
    effects: [{ op: 'damage', amount: 3, times: 2, to: 'target' }],
    upgrade: { desc: 'Deal 4 damage 2 times.', effects: [{ op: 'damage', amount: 4, times: 2, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_hit_and_run', name: 'Hit and Run', class: 'shade', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🏃',
    desc: 'Deal 5 damage. Gain 3 Block.',
    effects: [{ op: 'damage', amount: 5, to: 'target' }, { op: 'block', amount: 3 }],
    upgrade: {
      desc: 'Deal 7 damage. Gain 4 Block.',
      effects: [{ op: 'damage', amount: 7, to: 'target' }, { op: 'block', amount: 4 }]
    }
  });

  DS.defineCard({
    id: 'sh_cutpurse', name: 'Cutpurse', class: 'shade', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '💰',
    desc: 'Deal 6 damage. Gain 5 gold.',
    effects: [{ op: 'damage', amount: 6, to: 'target' }, { op: 'gold', amount: 5 }],
    upgrade: {
      desc: 'Deal 8 damage. Gain 8 gold.',
      effects: [{ op: 'damage', amount: 8, to: 'target' }, { op: 'gold', amount: 8 }]
    }
  });

  DS.defineCard({
    id: 'sh_shadow_slash', name: 'Shadow Slash', class: 'shade', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🌘',
    desc: 'Deal 14 damage.',
    effects: [{ op: 'damage', amount: 14, to: 'target' }],
    upgrade: { desc: 'Deal 18 damage.', effects: [{ op: 'damage', amount: 18, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_alley_brawl', name: 'Alley Brawl', class: 'shade', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '👊',
    desc: 'Deal 9 damage. Discard 1 card.',
    effects: [{ op: 'damage', amount: 9, to: 'target' }, { op: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Deal 12 damage. Discard 1 card.',
      effects: [{ op: 'damage', amount: 12, to: 'target' }, { op: 'discard', amount: 1 }]
    }
  });

  // ---- common skills ----
  DS.defineCard({
    id: 'sh_cloak_step', name: 'Cloak Step', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '💨',
    desc: 'Gain 7 Block.',
    effects: [{ op: 'block', amount: 7 }],
    upgrade: { desc: 'Gain 10 Block.', effects: [{ op: 'block', amount: 10 }] }
  });

  DS.defineCard({
    id: 'sh_vial_rack', name: 'Vial Rack', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🧴',
    desc: 'Add 2 Vials to your hand.',
    effects: [{ op: 'add_card', card: 'sh_vial', to: 'hand', amount: 2 }],
    upgrade: { desc: 'Add 3 Vials to your hand.', effects: [{ op: 'add_card', card: 'sh_vial', to: 'hand', amount: 3 }] }
  });

  DS.defineCard({
    id: 'sh_shiv_pouch', name: 'Shiv Pouch', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🎒',
    desc: 'Add 2 Shivs to your hand.',
    effects: [{ op: 'add_card', card: 'sh_shiv', to: 'hand', amount: 2 }],
    upgrade: { desc: 'Add 3 Shivs to your hand.', effects: [{ op: 'add_card', card: 'sh_shiv', to: 'hand', amount: 3 }] }
  });

  DS.defineCard({
    id: 'sh_hamstring', name: 'Hamstring', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🦵',
    desc: 'Apply 2 Weak.',
    effects: [{ op: 'apply', status: 'weak', amount: 2, to: 'target' }],
    upgrade: { desc: 'Apply 3 Weak.', effects: [{ op: 'apply', status: 'weak', amount: 3, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_quick_hands', name: 'Quick Hands', class: 'shade', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '✋',
    desc: 'Draw 1 card.',
    effects: [{ op: 'draw', amount: 1 }],
    upgrade: { desc: 'Draw 2 cards.', effects: [{ op: 'draw', amount: 2 }] }
  });

  DS.defineCard({
    id: 'sh_stow_away', name: 'Stow Away', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '📦',
    desc: 'Discard 1 card. Draw 2 cards.',
    effects: [{ op: 'discard', amount: 1 }, { op: 'draw', amount: 2 }],
    upgrade: { desc: 'Discard 1 card. Draw 3 cards.', effects: [{ op: 'discard', amount: 1 }, { op: 'draw', amount: 3 }] }
  });

  DS.defineCard({
    id: 'sh_pocket_sand', name: 'Pocket Sand', class: 'shade', type: 'skill', rarity: 'common',
    cost: 0, target: 'enemy', icon: '🏖️',
    desc: 'Apply 1 Weak.',
    effects: [{ op: 'apply', status: 'weak', amount: 1, to: 'target' }],
    upgrade: { desc: 'Apply 2 Weak.', effects: [{ op: 'apply', status: 'weak', amount: 2, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_venom_flask', name: 'Venom Flask', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '⚗️',
    desc: 'Apply 4 Poison.',
    effects: [{ op: 'apply', status: 'poison', amount: 4, to: 'target' }],
    upgrade: { desc: 'Apply 6 Poison.', effects: [{ op: 'apply', status: 'poison', amount: 6, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_lockpick', name: 'Lockpick', class: 'shade', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🔐',
    desc: 'Gain 3 Block. Discard 1 card.',
    effects: [{ op: 'block', amount: 3 }, { op: 'discard', amount: 1 }],
    upgrade: { desc: 'Gain 4 Block. Discard 1 card.', effects: [{ op: 'block', amount: 4 }, { op: 'discard', amount: 1 }] }
  });

  DS.defineCard({
    id: 'sh_afterimage', name: 'Afterimage', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '👥', retain: true,
    desc: 'Gain 4 Block. Retain.',
    effects: [{ op: 'block', amount: 4 }],
    upgrade: { desc: 'Gain 6 Block. Retain.', effects: [{ op: 'block', amount: 6 }] }
  });

  DS.defineCard({
    id: 'sh_dodge_roll', name: 'Dodge Roll', class: 'shade', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🤸',
    desc: 'Gain 5 Block. Next turn, gain 1 Energy.',
    effects: [{ op: 'block', amount: 5 }, { op: 'apply', status: 'energized', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain 7 Block. Next turn, gain 2 Energy.',
      effects: [{ op: 'block', amount: 7 }, { op: 'apply', status: 'energized', amount: 2, to: 'self' }]
    }
  });

  // ---- common powers ----
  DS.defineCard({
    id: 'sh_barbed_cloak', name: 'Barbed Cloak', class: 'shade', type: 'power', rarity: 'common',
    cost: 1, target: 'none', icon: '🦔',
    desc: 'Gain 3 Thorns.',
    effects: [{ op: 'apply', status: 'thorns', amount: 3, to: 'self' }],
    upgrade: { desc: 'Gain 4 Thorns.', effects: [{ op: 'apply', status: 'thorns', amount: 4, to: 'self' }] }
  });

  DS.defineCard({
    id: 'sh_scavenger', name: 'Scavenger', class: 'shade', type: 'power', rarity: 'common',
    cost: 1, target: 'none', icon: '🪝',
    desc: 'Whenever you discard a card, gain 2 Block.',
    effects: [{ op: 'apply', status: 'sh_aura_scavenger', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you discard a card, gain 3 Block.',
      effects: [{ op: 'apply', status: 'sh_aura_scavenger', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_slip_away', name: 'Slip Away', class: 'shade', type: 'power', rarity: 'common',
    cost: 1, target: 'none', icon: '👣',
    desc: 'The first time each turn you are attacked, gain 4 Block.',
    effects: [{ op: 'apply', status: 'sh_aura_evasion', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'The first time each turn you are attacked, gain 6 Block.',
      effects: [{ op: 'apply', status: 'sh_aura_evasion', amount: 6, to: 'self' }]
    }
  });

  // =====================================================================
  // UNCOMMON (31)
  // =====================================================================

  // ---- uncommon attacks ----
  DS.defineCard({
    id: 'sh_flurry_of_knives', name: 'Flurry of Knives', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🌪️',
    desc: 'Deal 3 damage 4 times.',
    effects: [{ op: 'damage', amount: 3, times: 4, to: 'target' }],
    upgrade: { desc: 'Deal 4 damage 4 times.', effects: [{ op: 'damage', amount: 4, times: 4, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_cutthroat', name: 'Cutthroat', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🗝️',
    desc: 'Deal 10 damage. If the target is Poisoned, deal 6 more.',
    effects: [
      { op: 'damage', amount: 10, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'poison', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 6, to: 'target' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 13 damage. If the target is Poisoned, deal 8 more.',
      effects: [
        { op: 'damage', amount: 13, to: 'target' },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'poison', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 8, to: 'target' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_spreading_venom', name: 'Spreading Venom', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '☣️',
    desc: 'Deal 3 damage to ALL enemies. Apply 2 Poison to ALL enemies.',
    effects: [
      { op: 'damage', amount: 3, to: 'all_enemies' },
      { op: 'apply', status: 'poison', amount: 2, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Deal 4 damage to ALL enemies. Apply 3 Poison to ALL enemies.',
      effects: [
        { op: 'damage', amount: 4, to: 'all_enemies' },
        { op: 'apply', status: 'poison', amount: 3, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_rain_of_daggers', name: 'Rain of Daggers', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '🌧️',
    desc: 'Deal 3 damage to ALL enemies 2 times.',
    effects: [{ op: 'damage', amount: 3, times: 2, to: 'all_enemies' }],
    upgrade: { desc: 'Deal 4 damage to ALL enemies 2 times.', effects: [{ op: 'damage', amount: 4, times: 2, to: 'all_enemies' }] }
  });

  DS.defineCard({
    id: 'sh_knife_dance', name: 'Knife Dance', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '💃',
    desc: 'Deal 4 damage 3 times. Draw 1 card.',
    effects: [{ op: 'damage', amount: 4, times: 3, to: 'target' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Deal 5 damage 3 times. Draw 1 card.',
      effects: [{ op: 'damage', amount: 5, times: 3, to: 'target' }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'sh_stiletto_chain', name: 'Stiletto Chain', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '⛓️',
    desc: 'Deal 6 damage. Add 1 Shiv to your hand.',
    effects: [{ op: 'damage', amount: 6, to: 'target' }, { op: 'add_card', card: 'sh_shiv', to: 'hand', amount: 1 }],
    upgrade: {
      desc: 'Deal 8 damage. Add 2 Shivs to your hand.',
      effects: [{ op: 'damage', amount: 8, to: 'target' }, { op: 'add_card', card: 'sh_shiv', to: 'hand', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'sh_plunge', name: 'Plunge', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '⬇️', exhaust: true,
    desc: 'Deal 14 damage. Exhaust.',
    effects: [{ op: 'damage', amount: 14, to: 'target' }],
    upgrade: { desc: 'Deal 18 damage. Exhaust.', effects: [{ op: 'damage', amount: 18, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_gutter_slash', name: 'Gutter Slash', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 0, target: 'enemy', icon: '🩹',
    desc: 'Deal 5 damage. If the target is Weak, draw 1 card.',
    effects: [
      { op: 'damage', amount: 5, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'weak', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'draw', amount: 1 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 7 damage. If the target is Weak, draw 1 card.',
      effects: [
        { op: 'damage', amount: 7, to: 'target' },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'weak', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'draw', amount: 1 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_shadow_pounce', name: 'Shadow Pounce', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🐆',
    desc: 'Deal 7 damage. If you have Block, deal 4 more.',
    effects: [
      { op: 'damage', amount: 7, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'block' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 4, to: 'target' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 9 damage. If you have Block, deal 6 more.',
      effects: [
        { op: 'damage', amount: 9, to: 'target' },
        {
          op: 'if',
          cond: { left: { v: 'block' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 6, to: 'target' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_sever_tendon', name: 'Sever Tendon', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🦴',
    desc: 'Deal 6 damage. Apply 1 Weak.',
    effects: [{ op: 'damage', amount: 6, to: 'target' }, { op: 'apply', status: 'weak', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Deal 8 damage. Apply 2 Weak.',
      effects: [{ op: 'damage', amount: 8, to: 'target' }, { op: 'apply', status: 'weak', amount: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'sh_scorpion_sting', name: 'Scorpion Sting', class: 'shade', type: 'attack', rarity: 'uncommon',
    cost: 0, target: 'enemy', icon: '🦂',
    desc: 'Deal 2 damage. Apply 2 Poison.',
    effects: [{ op: 'damage', amount: 2, to: 'target' }, { op: 'apply', status: 'poison', amount: 2, to: 'target' }],
    upgrade: {
      desc: 'Deal 3 damage. Apply 3 Poison.',
      effects: [{ op: 'damage', amount: 3, to: 'target' }, { op: 'apply', status: 'poison', amount: 3, to: 'target' }]
    }
  });

  // ---- uncommon skills ----
  DS.defineCard({
    id: 'sh_smoke_bomb', name: 'Smoke Bomb', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '💨',
    desc: 'Apply 2 Weak to ALL enemies. Gain 3 Block.',
    effects: [{ op: 'apply', status: 'weak', amount: 2, to: 'all_enemies' }, { op: 'block', amount: 3 }],
    upgrade: {
      desc: 'Apply 3 Weak to ALL enemies. Gain 4 Block.',
      effects: [{ op: 'apply', status: 'weak', amount: 3, to: 'all_enemies' }, { op: 'block', amount: 4 }]
    }
  });

  DS.defineCard({
    id: 'sh_lay_low', name: 'Lay Low', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🕳️',
    desc: 'Gain 5 Block. Next turn, draw 2 extra cards.',
    effects: [{ op: 'block', amount: 5 }, { op: 'apply', status: 'draw_next', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 7 Block. Next turn, draw 3 extra cards.',
      effects: [{ op: 'block', amount: 7 }, { op: 'apply', status: 'draw_next', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_feint', name: 'Feint', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🌀',
    desc: 'Gain 2 Block. When discarded, draw 1 card.',
    effects: [{ op: 'block', amount: 2 }],
    onDiscard: [{ op: 'draw', amount: 1 }],
    upgrade: { desc: 'Gain 3 Block. When discarded, draw 1 card.', effects: [{ op: 'block', amount: 3 }] }
  });

  DS.defineCard({
    id: 'sh_nimble_fingers', name: 'Nimble Fingers', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🖐️',
    desc: 'Discard 2 cards. Draw 2 cards.',
    effects: [{ op: 'discard', amount: 2 }, { op: 'draw', amount: 2 }],
    upgrade: { desc: 'Discard 2 cards. Draw 3 cards.', effects: [{ op: 'discard', amount: 2 }, { op: 'draw', amount: 3 }] }
  });

  DS.defineCard({
    id: 'sh_recycle', name: 'Recycle', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '♻️', exhaust: true,
    desc: 'Exhaust 1 card from your hand. Gain 6 Block. Exhaust.',
    effects: [{ op: 'exhaust', amount: 1 }, { op: 'block', amount: 6 }],
    upgrade: {
      desc: 'Exhaust 1 card from your hand. Gain 9 Block. Exhaust.',
      effects: [{ op: 'exhaust', amount: 1 }, { op: 'block', amount: 9 }]
    }
  });

  DS.defineCard({
    id: 'sh_hidden_cache', name: 'Hidden Cache', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧰', ethereal: true,
    desc: 'Ethereal. Add 2 Shivs to your draw pile.',
    effects: [{ op: 'add_card', card: 'sh_shiv', to: 'draw', amount: 2 }],
    upgrade: { desc: 'Ethereal. Add 3 Shivs to your draw pile.', effects: [{ op: 'add_card', card: 'sh_shiv', to: 'draw', amount: 3 }] }
  });

  DS.defineCard({
    id: 'sh_dead_drop', name: 'Dead Drop', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🃏',
    desc: 'Discard your whole hand. Draw 4 cards.',
    effects: [{ op: 'discard', amount: 'all' }, { op: 'draw', amount: 4 }],
    upgrade: { desc: 'Discard your whole hand. Draw 5 cards.', effects: [{ op: 'discard', amount: 'all' }, { op: 'draw', amount: 5 }] }
  });

  DS.defineCard({
    id: 'sh_ghost_form', name: 'Ghost Form', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '👻',
    desc: 'Gain 1 Intangible. Draw 1 card.',
    effects: [{ op: 'apply', status: 'intangible', amount: 1, to: 'self' }, { op: 'draw', amount: 1 }],
    upgrade: { desc: 'Gain 1 Intangible. Draw 2 cards.', effects: [{ op: 'apply', status: 'intangible', amount: 1, to: 'self' }, { op: 'draw', amount: 2 }] }
  });

  DS.defineCard({
    id: 'sh_toxic_bargain', name: 'Toxic Bargain', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'enemy', icon: '🧫',
    desc: 'Lose 2 HP. Apply 5 Poison.',
    effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'apply', status: 'poison', amount: 5, to: 'target' }],
    upgrade: {
      desc: 'Lose 2 HP. Apply 7 Poison.',
      effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'apply', status: 'poison', amount: 7, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'sh_drain_vial', name: 'Drain Vial', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '⚱️',
    desc: 'Apply 6 Poison. Draw 1 card.',
    effects: [{ op: 'apply', status: 'poison', amount: 6, to: 'target' }, { op: 'draw', amount: 1 }],
    upgrade: { desc: 'Apply 8 Poison. Draw 1 card.', effects: [{ op: 'apply', status: 'poison', amount: 8, to: 'target' }, { op: 'draw', amount: 1 }] }
  });

  DS.defineCard({
    id: 'sh_ankle_tap', name: 'Ankle Tap', class: 'shade', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'enemy', icon: '🦶',
    desc: 'Apply 1 Weak. Draw 1 card.',
    effects: [{ op: 'apply', status: 'weak', amount: 1, to: 'target' }, { op: 'draw', amount: 1 }],
    upgrade: { desc: 'Apply 2 Weak. Draw 1 card.', effects: [{ op: 'apply', status: 'weak', amount: 2, to: 'target' }, { op: 'draw', amount: 1 }] }
  });

  // ---- uncommon powers ----
  DS.defineCard({
    id: 'sh_envenom', name: 'Envenom', class: 'shade', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🧪',
    desc: 'Whenever you play an attack, apply 2 Poison to a random enemy.',
    effects: [{ op: 'apply', status: 'sh_aura_envenom', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play an attack, apply 3 Poison to a random enemy.',
      effects: [{ op: 'apply', status: 'sh_aura_envenom', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_shiv_forge', name: 'Shiv Forge', class: 'shade', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '⚒️',
    desc: 'At the start of your turn, add 1 Shiv to your hand.',
    effects: [{ op: 'apply', status: 'sh_aura_shiv_forge', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of your turn, add 2 Shivs to your hand.',
      effects: [{ op: 'apply', status: 'sh_aura_shiv_forge', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_echo_blades', name: 'Echo Blades', class: 'shade', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🔄',
    desc: 'Whenever you play an attack, deal 2 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'sh_aura_echo', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play an attack, deal 3 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'sh_aura_echo', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_cycle_engine', name: 'Cycle Engine', class: 'shade', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '⚙️',
    desc: 'The first time each turn you discard a card, draw 1 card.',
    effects: [{ op: 'apply', status: 'sh_aura_cycle', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'The first time each turn you discard a card, draw 2 cards.',
      effects: [{ op: 'apply', status: 'sh_aura_cycle', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_nightshade', name: 'Nightshade', class: 'shade', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🌿',
    desc: 'The first time each turn you apply a debuff, gain 1 Energy.',
    effects: [{ op: 'apply', status: 'sh_aura_nightshade', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'The first time each turn you apply a debuff, gain 2 Energy.',
      effects: [{ op: 'apply', status: 'sh_aura_nightshade', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_shadow_veil', name: 'Shadow Veil', class: 'shade', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🕶️',
    desc: 'Whenever you play a skill, gain 1 Dexterity.',
    effects: [{ op: 'apply', status: 'sh_aura_veil', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play a skill, gain 2 Dexterity.',
      effects: [{ op: 'apply', status: 'sh_aura_veil', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_backstab', name: 'Backstab', class: 'shade', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🌒',
    desc: 'The first time each turn one of your attacks hits, apply 1 Weak to that enemy.',
    effects: [{ op: 'apply', status: 'sh_aura_backstab', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'The first time each turn one of your attacks hits, apply 2 Weak to that enemy.',
      effects: [{ op: 'apply', status: 'sh_aura_backstab', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_bloodscent', name: 'Bloodscent', class: 'shade', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '🩸',
    desc: 'Whenever you kill an enemy, heal 3 HP.',
    effects: [{ op: 'apply', status: 'sh_aura_bloodscent', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Whenever you kill an enemy, heal 4 HP.',
      effects: [{ op: 'apply', status: 'sh_aura_bloodscent', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_grave_tithe', name: 'Grave Tithe', class: 'shade', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'none', icon: '⚰️',
    desc: 'Whenever you exhaust a card, gain 2 Block.',
    effects: [{ op: 'apply', status: 'sh_aura_tithe', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you exhaust a card, gain 3 Block.',
      effects: [{ op: 'apply', status: 'sh_aura_tithe', amount: 3, to: 'self' }]
    }
  });

  // =====================================================================
  // RARE (16)
  // =====================================================================

  // ---- rare attacks ----
  DS.defineCard({
    id: 'sh_assassinate', name: 'Assassinate', class: 'shade', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '💀',
    desc: 'Deal 8 damage plus 2 damage for each Poison on the target.',
    effects: [{ op: 'damage', amount: { v: 'status', status: 'poison', of: 'target', mul: 2, add: 8 }, to: 'target' }],
    upgrade: {
      desc: 'Deal 10 damage plus 3 damage for each Poison on the target.',
      effects: [{ op: 'damage', amount: { v: 'status', status: 'poison', of: 'target', mul: 3, add: 10 }, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'sh_death_by_thousand', name: 'Death by a Thousand Cuts', class: 'shade', type: 'attack', rarity: 'rare',
    cost: 'X', target: 'enemy', icon: '🌑',
    desc: 'Spend all Energy. Deal 4 damage X times (X = Energy spent).',
    effects: [{ op: 'damage', amount: 4, times: { v: 'x' }, to: 'target' }],
    upgrade: {
      desc: 'Spend all Energy. Deal 5 damage X times (X = Energy spent).',
      effects: [{ op: 'damage', amount: 5, times: { v: 'x' }, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'sh_shadow_storm', name: 'Shadow Storm', class: 'shade', type: 'attack', rarity: 'rare',
    cost: 'X', target: 'all_enemies', icon: '🌩️',
    desc: 'Spend all Energy. Deal 4 damage to ALL enemies X times (X = Energy spent).',
    effects: [{ op: 'damage', amount: 4, times: { v: 'x' }, to: 'all_enemies' }],
    upgrade: {
      desc: 'Spend all Energy. Deal 5 damage to ALL enemies X times (X = Energy spent).',
      effects: [{ op: 'damage', amount: 5, times: { v: 'x' }, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'sh_grim_harvest', name: 'Grim Harvest', class: 'shade', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '⚰️',
    desc: 'Deal 3 damage plus 2 damage for each card in your Exhaust pile.',
    effects: [{ op: 'damage', amount: { v: 'exhaust_pile', mul: 2, add: 3 }, to: 'target' }],
    upgrade: {
      desc: 'Deal 4 damage plus 3 damage for each card in your Exhaust pile.',
      effects: [{ op: 'damage', amount: { v: 'exhaust_pile', mul: 3, add: 4 }, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'sh_coup_de_grace', name: 'Coup de Grace', class: 'shade', type: 'attack', rarity: 'rare',
    cost: 1, target: 'enemy', icon: '☠️',
    desc: 'Deal 10 damage. If this kills, gain 2 Energy.',
    effects: [{ op: 'damage', amount: 10, to: 'target', onKill: [{ op: 'energy', amount: 2 }] }],
    upgrade: {
      desc: 'Deal 13 damage. If this kills, gain 3 Energy.',
      effects: [{ op: 'damage', amount: 13, to: 'target', onKill: [{ op: 'energy', amount: 3 }] }]
    }
  });

  DS.defineCard({
    id: 'sh_silent_execution', name: 'Silent Execution', class: 'shade', type: 'attack', rarity: 'rare',
    cost: 3, target: 'enemy', icon: '🌙', exhaust: true,
    desc: 'Deal 20 damage. Exhaust.',
    effects: [{ op: 'damage', amount: 20, to: 'target' }],
    upgrade: { cost: 2, desc: 'Deal 24 damage. Exhaust.', effects: [{ op: 'damage', amount: 24, to: 'target' }] }
  });

  DS.defineCard({
    id: 'sh_shadow_reckoning', name: 'Shadow Reckoning', class: 'shade', type: 'attack', rarity: 'rare',
    cost: 1, target: 'enemy', icon: '⚖️',
    desc: 'Deal 4 damage plus 1 damage for each card in your discard pile.',
    effects: [{ op: 'damage', amount: { v: 'discard_pile', mul: 1, add: 4 }, to: 'target' }],
    upgrade: {
      desc: 'Deal 6 damage plus 1 damage for each card in your discard pile.',
      effects: [{ op: 'damage', amount: { v: 'discard_pile', mul: 1, add: 6 }, to: 'target' }]
    }
  });

  // ---- rare skills ----
  DS.defineCard({
    id: 'sh_venom_cascade', name: 'Venom Cascade', class: 'shade', type: 'skill', rarity: 'rare',
    cost: 'X', target: 'enemy', icon: '🌊',
    desc: "Spend all Energy. Apply X Poison, then multiply the target's Poison by 2.",
    effects: [
      { op: 'apply', status: 'poison', amount: { v: 'x' }, to: 'target' },
      { op: 'multiply_status', status: 'poison', factor: 2, to: 'target' }
    ],
    upgrade: {
      desc: "Spend all Energy. Apply X Poison, then multiply the target's Poison by 3.",
      effects: [
        { op: 'apply', status: 'poison', amount: { v: 'x' }, to: 'target' },
        { op: 'multiply_status', status: 'poison', factor: 3, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'sh_obsidian_veil', name: 'Obsidian Veil', class: 'shade', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🖤',
    desc: 'Gain 12 Block. Next turn, gain 2 Energy.',
    effects: [{ op: 'block', amount: 12 }, { op: 'apply', status: 'energized', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 16 Block. Next turn, gain 2 Energy.',
      effects: [{ op: 'block', amount: 16 }, { op: 'apply', status: 'energized', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_shiv_legion', name: 'Shiv Legion', class: 'shade', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '⚔️',
    desc: 'Add 3 Shivs to your hand. Gain 5 Block.',
    effects: [{ op: 'add_card', card: 'sh_shiv', to: 'hand', amount: 3 }, { op: 'block', amount: 5 }],
    upgrade: {
      desc: 'Add 4 Shivs to your hand. Gain 7 Block.',
      effects: [{ op: 'add_card', card: 'sh_shiv', to: 'hand', amount: 4 }, { op: 'block', amount: 7 }]
    }
  });

  DS.defineCard({
    id: 'sh_marrow_feast', name: 'Marrow Feast', class: 'shade', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🍖',
    desc: 'Lose 4 HP. Draw 3 cards.',
    effects: [{ op: 'lose_hp', amount: 4, to: 'self' }, { op: 'draw', amount: 3 }],
    upgrade: { desc: 'Lose 3 HP. Draw 4 cards.', effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, { op: 'draw', amount: 4 }] }
  });

  // ---- rare powers ----
  DS.defineCard({
    id: 'sh_plague_cloud', name: 'Plague Cloud', class: 'shade', type: 'power', rarity: 'rare',
    cost: 2, target: 'none', icon: '☁️',
    desc: 'At the start of your turn, apply 2 Poison to ALL enemies.',
    effects: [{ op: 'apply', status: 'sh_aura_plague', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'At the start of your turn, apply 3 Poison to ALL enemies.',
      effects: [{ op: 'apply', status: 'sh_aura_plague', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_cadence', name: 'Cadence', class: 'shade', type: 'power', rarity: 'rare',
    cost: 1, target: 'none', icon: '🥁',
    desc: 'Every 3rd card you play, gain 1 Energy.',
    effects: [{ op: 'apply', status: 'sh_aura_cadence', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Every 3rd card you play, gain 2 Energy.',
      effects: [{ op: 'apply', status: 'sh_aura_cadence', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_dark_ritual', name: 'Dark Ritual', class: 'shade', type: 'power', rarity: 'rare',
    cost: 1, target: 'none', icon: '🕯️',
    desc: 'At the end of each turn, gain 1 Strength.',
    effects: [{ op: 'apply', status: 'ritual', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the end of each turn, gain 2 Strength.',
      effects: [{ op: 'apply', status: 'ritual', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_trophy_hunter', name: 'Trophy Hunter', class: 'shade', type: 'power', rarity: 'rare',
    cost: 1, target: 'none', icon: '🏆',
    desc: 'Whenever you kill an enemy, draw 1 card.',
    effects: [{ op: 'apply', status: 'sh_aura_trophy', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you kill an enemy, draw 2 cards.',
      effects: [{ op: 'apply', status: 'sh_aura_trophy', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'sh_reapers_tally', name: "Reaper's Tally", class: 'shade', type: 'power', rarity: 'rare',
    cost: 1, target: 'none', icon: '📿',
    desc: 'Whenever any enemy dies, gain 3 Block.',
    effects: [{ op: 'apply', status: 'sh_aura_tally', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Whenever any enemy dies, gain 4 Block.',
      effects: [{ op: 'apply', status: 'sh_aura_tally', amount: 4, to: 'self' }]
    }
  });

})();
