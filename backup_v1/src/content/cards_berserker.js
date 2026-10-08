(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // BERSERKER: Ulfar the Bloodaxe.
  // Four archetypes that reward different deck choices:
  //   Bloodprice : pay HP for power. Lose-HP triggers (bz_bloodlust, bz_martyrdom, bz_hemorrhage).
  //   Scorched   : Exhaust synergy (bz_scorched_soul, bz_ash_skin, bz_kindle_soul, Ember token).
  //   Whirlwind  : multi-hit, Strength and attack triggers (bz_tempest, bz_war_rhythm, bz_bloodthirst).
  //   Warpath    : Vulnerable, heavy single hits, stances and engines (bz_bloodscent, bz_berserk_stance).
  // ---------------------------------------------------------------------------

  DS.defineCharacter({
    id: 'berserker',
    name: 'Ulfar',
    title: 'The Bloodaxe',
    desc: 'A rage-maddened axe warrior who pays in blood for power. Stacks Strength, unleashes multi-hit storms and burns cards away in fury.',
    hp: 80,
    gold: 99,
    icon: '🪓',
    color: '#c0392b',
    starterDeck: [
      'bz_strike', 'bz_strike', 'bz_strike', 'bz_strike', 'bz_strike',
      'bz_defend', 'bz_defend', 'bz_defend', 'bz_defend',
      'bz_bloodied_axe', 'bz_blood_scrape'
    ],
    starterRelic: 'bz_bloodsoaked_bandage'
  });

  // ===========================================================================
  // STARTER RELIC
  // ===========================================================================
  DS.defineRelic({
    id: 'bz_bloodsoaked_bandage',
    name: 'Bloodsoaked Bandage',
    desc: 'At the end of each won combat, heal 6 HP.',
    flavor: 'Still warm. Still sticky. Still working.',
    rarity: 'starter',
    icon: '🩹',
    class: 'berserker',
    passive: {},
    triggers: {
      onCombatEnd: [{ op: 'heal', amount: 6, to: 'self' }]
    }
  });

  // ===========================================================================
  // CUSTOM STATUSES (13). Power cards apply these to self.
  // ===========================================================================

  // Bloodprice: every time you lose HP, gain Strength.
  DS.defineStatus({
    id: 'bz_bloodlust',
    name: 'Bloodlust',
    desc: 'Whenever you lose HP, gain {n} Strength.',
    type: 'buff',
    icon: '🩸',
    stacks: true,
    triggers: {
      onDamaged: [{ op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Bloodprice: every time you lose HP, gain Block.
  DS.defineStatus({
    id: 'bz_martyrdom',
    name: 'Martyrdom',
    desc: 'Whenever you lose HP, gain {n} Block.',
    type: 'buff',
    icon: '🥀',
    stacks: true,
    triggers: {
      onDamaged: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Bloodprice: lose HP at the start of each turn, draw cards.
  DS.defineStatus({
    id: 'bz_hemorrhage',
    name: 'Hemorrhage',
    desc: 'At the start of each turn, lose {n} HP and draw {n} card(s).',
    type: 'buff',
    icon: '💧',
    stacks: true,
    triggers: {
      onTurnStart: [
        { op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' },
        { op: 'draw', amount: { v: 'stacks' } }
      ]
    }
  });

  // Scorched: exhausting a card hurts a random enemy.
  DS.defineStatus({
    id: 'bz_scorched_soul',
    name: 'Scorched Soul',
    desc: 'Whenever you Exhaust a card, deal {n} damage to a random enemy.',
    type: 'buff',
    icon: '🔥',
    stacks: true,
    triggers: {
      onCardExhausted: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
    }
  });

  // Scorched: exhausting a card grants Block.
  DS.defineStatus({
    id: 'bz_ash_skin',
    name: 'Ash Skin',
    desc: 'Whenever you Exhaust a card, gain {n} Block.',
    type: 'buff',
    icon: '🪨',
    stacks: true,
    triggers: {
      onCardExhausted: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Whirlwind: the first Attack each turn draws cards.
  DS.defineStatus({
    id: 'bz_war_rhythm',
    name: 'Marching Rhythm',
    desc: 'The first Attack you play each turn draws {n} card(s).',
    type: 'buff',
    icon: '🥁',
    stacks: true,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        oncePerTurn: true,
        effects: [{ op: 'draw', amount: { v: 'stacks' } }]
      }
    }
  });

  // Whirlwind: every Attack you play also hits all enemies.
  DS.defineStatus({
    id: 'bz_tempest',
    name: 'Tempest',
    desc: 'Whenever you play an Attack, deal {n} damage to ALL enemies.',
    type: 'buff',
    icon: '🌀',
    stacks: true,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [{ op: 'damage', amount: { v: 'stacks' }, to: 'all_enemies' }]
      }
    }
  });

  // Whirlwind: every landed hit heals you (rewards multi-hit attacks).
  DS.defineStatus({
    id: 'bz_bloodthirst',
    name: 'Bloodthirst',
    desc: 'Whenever your attack hits an enemy, heal {n} HP.',
    type: 'buff',
    icon: '🧛',
    stacks: true,
    triggers: {
      onAttack: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Warpath: the first attack that hits each turn applies Vulnerable.
  DS.defineStatus({
    id: 'bz_bloodscent',
    name: 'Bloodscent',
    desc: 'The first attack that hits each turn applies {n} Vulnerable to that enemy.',
    type: 'buff',
    icon: '🐺',
    stacks: true,
    triggers: {
      onAttack: {
        oncePerTurn: true,
        effects: [{ op: 'apply', status: 'vulnerable', amount: { v: 'stacks' }, to: 'target' }]
      }
    }
  });

  // Warpath: a furnace of energy that restarts every turn.
  DS.defineStatus({
    id: 'bz_berserk_engine',
    name: 'Berserk Engine',
    desc: 'At the start of each turn, gain {n} Energy.',
    type: 'buff',
    icon: '💢',
    stacks: true,
    triggers: {
      onTurnStart: [{ op: 'energy', amount: { v: 'stacks' } }]
    }
  });

  // Warpath: breaking your Block feeds your rage.
  DS.defineStatus({
    id: 'bz_unbreakable',
    name: 'Unbroken Pride',
    desc: 'Whenever an attack breaks your Block, gain {n} Strength.',
    type: 'buff',
    icon: '🗿',
    stacks: true,
    triggers: {
      onBlockBroken: [{ op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Killing spree: every kill feeds Strength.
  DS.defineStatus({
    id: 'bz_blood_frenzy',
    name: 'Killing Frenzy',
    desc: 'Whenever you kill an enemy, gain {n} Strength.',
    type: 'buff',
    icon: '💀',
    stacks: true,
    triggers: {
      onKill: [{ op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Warpath: a one-turn stance. Attacks deal 50% more damage until end of turn.
  DS.defineStatus({
    id: 'bz_berserk_stance',
    name: 'Berserk Stance',
    desc: 'Your attacks deal 50% more damage this turn.',
    type: 'buff',
    icon: '😡',
    stacks: false,
    expire: 'turn_end',
    mods: { attackDealtMul: 1.5 }
  });

  // ===========================================================================
  // STARTER CARDS (4 distinct; deck = 4 Strike, 4 Defend, 2 signatures)
  // ===========================================================================
  DS.defineCard({
    id: 'bz_strike', name: 'Strike', class: 'berserker', type: 'attack', rarity: 'starter',
    cost: 1, target: 'enemy', icon: '🔪',
    desc: 'Deal 6 damage.',
    effects: [{ op: 'damage', amount: 6 }],
    upgrade: { desc: 'Deal 9 damage.', effects: [{ op: 'damage', amount: 9 }] }
  });

  DS.defineCard({
    id: 'bz_defend', name: 'Defend', class: 'berserker', type: 'skill', rarity: 'starter',
    cost: 1, target: 'self', icon: '🛡️',
    desc: 'Gain 5 Block.',
    effects: [{ op: 'block', amount: 5, to: 'self' }],
    upgrade: { desc: 'Gain 8 Block.', effects: [{ op: 'block', amount: 8, to: 'self' }] }
  });

  DS.defineCard({
    id: 'bz_bloodied_axe', name: 'Bloodied Axe', class: 'berserker', type: 'attack', rarity: 'starter',
    cost: 1, target: 'enemy', icon: '🪓',
    desc: 'Deal 7 damage. Lose 1 HP.',
    effects: [{ op: 'damage', amount: 7 }, { op: 'lose_hp', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Deal 10 damage. Lose 1 HP.',
      effects: [{ op: 'damage', amount: 10 }, { op: 'lose_hp', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_blood_scrape', name: 'Blood Scrape', class: 'berserker', type: 'skill', rarity: 'starter',
    cost: 0, target: 'self', icon: '🩸',
    desc: 'Lose 2 HP. Draw 1 card.',
    effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Lose 2 HP. Draw 2 cards.',
      effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'draw', amount: 2 }]
    }
  });

  // ===========================================================================
  // COMMON (24): 11 attacks, 10 skills, 3 powers
  // ===========================================================================
  DS.defineCard({
    id: 'bz_cleave', name: 'Cleave', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '💥',
    desc: 'Deal 8 damage to ALL enemies.',
    effects: [{ op: 'damage', amount: 8, to: 'all_enemies' }],
    upgrade: { desc: 'Deal 11 damage to ALL enemies.', effects: [{ op: 'damage', amount: 11, to: 'all_enemies' }] }
  });

  DS.defineCard({
    id: 'bz_chop', name: 'Chop', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🔨',
    desc: 'Deal 7 damage. If the enemy is Vulnerable, draw 1 card.',
    effects: [
      { op: 'damage', amount: 7 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'vulnerable', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'draw', amount: 1 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 10 damage. If the enemy is Vulnerable, draw 1 card.',
      effects: [
        { op: 'damage', amount: 10 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'vulnerable', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'draw', amount: 1 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_skullcracker', name: 'Skullcracker', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '💀',
    desc: 'Deal 6 damage. Apply 1 Vulnerable.',
    effects: [{ op: 'damage', amount: 6 }, { op: 'apply', status: 'vulnerable', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Deal 8 damage. Apply 2 Vulnerable.',
      effects: [{ op: 'damage', amount: 8 }, { op: 'apply', status: 'vulnerable', amount: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'bz_brutal_hew', name: 'Brutal Hew', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🪓',
    desc: 'Deal 14 damage.',
    effects: [{ op: 'damage', amount: 14 }],
    upgrade: { desc: 'Deal 18 damage.', effects: [{ op: 'damage', amount: 18 }] }
  });

  DS.defineCard({
    id: 'bz_swipe', name: 'Swipe', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '🌙',
    desc: 'Deal 4 damage. Gain 2 Block.',
    effects: [{ op: 'damage', amount: 4 }, { op: 'block', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Deal 6 damage. Gain 3 Block.',
      effects: [{ op: 'damage', amount: 6 }, { op: 'block', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_hatchet_volley', name: 'Hatchet Volley', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'random_enemy', icon: '🪃',
    desc: 'Deal 3 damage to a random enemy 3 times.',
    effects: [{ op: 'damage', amount: 3, times: 3 }],
    upgrade: {
      desc: 'Deal 4 damage to a random enemy 3 times.',
      effects: [{ op: 'damage', amount: 4, times: 3 }]
    }
  });

  DS.defineCard({
    id: 'bz_reckless_swing', name: 'Reckless Swing', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '😤',
    desc: 'Deal 9 damage. Lose 1 HP.',
    effects: [{ op: 'damage', amount: 9 }, { op: 'lose_hp', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Deal 12 damage. Lose 1 HP.',
      effects: [{ op: 'damage', amount: 12 }, { op: 'lose_hp', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_shoulder_charge', name: 'Shoulder Charge', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🐂',
    desc: 'Deal 6 damage. Gain 4 Block.',
    effects: [{ op: 'damage', amount: 6 }, { op: 'block', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Deal 8 damage. Gain 6 Block.',
      effects: [{ op: 'damage', amount: 8 }, { op: 'block', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_pummel', name: 'Pummel', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '👊',
    desc: 'Innate. Deal 4 damage twice.',
    innate: true,
    effects: [{ op: 'damage', amount: 4, times: 2 }],
    upgrade: { desc: 'Innate. Deal 5 damage twice.', effects: [{ op: 'damage', amount: 5, times: 2 }] }
  });

  DS.defineCard({
    id: 'bz_gutslash', name: 'Gutslash', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🩸',
    desc: 'Deal 6 damage. If you have lost at least half your max HP, deal 6 more.',
    effects: [
      { op: 'damage', amount: 6 },
      {
        op: 'if',
        cond: { left: { v: 'missing_hp' }, cmp: '>=', right: { v: 'max_hp', mul: 0.5 } },
        then: [{ op: 'damage', amount: 6 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 8 damage. If you have lost at least half your max HP, deal 8 more.',
      effects: [
        { op: 'damage', amount: 8 },
        {
          op: 'if',
          cond: { left: { v: 'missing_hp' }, cmp: '>=', right: { v: 'max_hp', mul: 0.5 } },
          then: [{ op: 'damage', amount: 8 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_hamstring', name: 'Hamstring', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🦵',
    desc: 'Deal 5 damage. Apply 1 Weak.',
    effects: [{ op: 'damage', amount: 5 }, { op: 'apply', status: 'weak', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Deal 7 damage. Apply 2 Weak.',
      effects: [{ op: 'damage', amount: 7 }, { op: 'apply', status: 'weak', amount: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'bz_bull_hide', name: 'Bull Hide', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🦬',
    desc: 'Gain 7 Block.',
    effects: [{ op: 'block', amount: 7, to: 'self' }],
    upgrade: { desc: 'Gain 10 Block.', effects: [{ op: 'block', amount: 10, to: 'self' }] }
  });

  DS.defineCard({
    id: 'bz_tourniquet', name: 'Tourniquet', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🩹',
    desc: 'Lose 2 HP. Gain 6 Block.',
    effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'block', amount: 6, to: 'self' }],
    upgrade: {
      desc: 'Lose 2 HP. Gain 8 Block.',
      effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'block', amount: 8, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_open_vein', name: 'Open Vein', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🫀',
    desc: 'Lose 3 HP. Draw 2 cards.',
    effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, { op: 'draw', amount: 2 }],
    upgrade: {
      desc: 'Lose 3 HP. Draw 3 cards.',
      effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, { op: 'draw', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'bz_clan_roar', name: 'Clan Roar', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '📯',
    desc: 'Apply 2 Weak to ALL enemies.',
    effects: [{ op: 'apply', status: 'weak', amount: 2, to: 'all_enemies' }],
    upgrade: {
      desc: 'Apply 3 Weak to ALL enemies.',
      effects: [{ op: 'apply', status: 'weak', amount: 3, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'bz_glare_down', name: 'Glare Down', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '😠',
    desc: 'Gain 5 Block. Apply 1 Weak to the enemy.',
    effects: [{ op: 'block', amount: 5, to: 'self' }, { op: 'apply', status: 'weak', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Gain 7 Block. Apply 2 Weak to the enemy.',
      effects: [{ op: 'block', amount: 7, to: 'self' }, { op: 'apply', status: 'weak', amount: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'bz_catch_breath', name: 'Catch Breath', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '💨',
    desc: 'Heal 4 HP.',
    effects: [{ op: 'heal', amount: 4, to: 'self' }],
    upgrade: { desc: 'Heal 6 HP.', effects: [{ op: 'heal', amount: 6, to: 'self' }] }
  });

  DS.defineCard({
    id: 'bz_whetstone', name: 'Whetstone', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🪨',
    desc: 'Gain 1 Strength.',
    effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }],
    upgrade: { desc: 'Gain 2 Strength.', effects: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'bz_shieldwall', name: 'Shieldwall', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 2, target: 'self', icon: '🧱',
    desc: 'Gain 12 Block.',
    effects: [{ op: 'block', amount: 12, to: 'self' }],
    upgrade: { desc: 'Gain 15 Block.', effects: [{ op: 'block', amount: 15, to: 'self' }] }
  });

  DS.defineCard({
    id: 'bz_burn_the_past', name: 'Burn the Past', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🔥',
    desc: 'Exhaust 1 card from your hand. Gain 6 Block.',
    effects: [{ op: 'exhaust', amount: 1 }, { op: 'block', amount: 6, to: 'self' }],
    upgrade: {
      desc: 'Exhaust 1 card from your hand. Gain 9 Block.',
      effects: [{ op: 'exhaust', amount: 1 }, { op: 'block', amount: 9, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_ready_axe', name: 'Ready Axe', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🧰',
    desc: 'Draw 1 card. Gain 2 Block.',
    effects: [{ op: 'draw', amount: 1 }, { op: 'block', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Draw 2 cards. Gain 3 Block.',
      effects: [{ op: 'draw', amount: 2 }, { op: 'block', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_martyrs_vow', name: "Martyr's Vow", class: 'berserker', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🥀',
    desc: 'Whenever you lose HP, gain 2 Block.',
    effects: [{ op: 'apply', status: 'bz_martyrdom', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you lose HP, gain 3 Block.',
      effects: [{ op: 'apply', status: 'bz_martyrdom', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_cinder_skin', name: 'Cinder Skin', class: 'berserker', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🌋',
    desc: 'Whenever you Exhaust a card, gain 3 Block.',
    effects: [{ op: 'apply', status: 'bz_ash_skin', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Whenever you Exhaust a card, gain 4 Block.',
      effects: [{ op: 'apply', status: 'bz_ash_skin', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_iron_gut', name: 'Iron Gut', class: 'berserker', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🥩',
    desc: 'Gain 2 Dexterity.',
    effects: [{ op: 'apply', status: 'dexterity', amount: 2, to: 'self' }],
    upgrade: { desc: 'Gain 3 Dexterity.', effects: [{ op: 'apply', status: 'dexterity', amount: 3, to: 'self' }] }
  });

  // ===========================================================================
  // UNCOMMON (30): 12 attacks, 11 skills, 7 powers
  // ===========================================================================

  // ----- uncommon attacks (12) -----
  DS.defineCard({
    id: 'bz_ash_harvest', name: 'Ash Harvest', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🌾',
    desc: 'Deal 4 damage, plus 3 for each card in your Exhaust pile.',
    effects: [{ op: 'damage', amount: { v: 'exhaust_pile', mul: 3, add: 4 } }],
    upgrade: {
      desc: 'Deal 5 damage, plus 4 for each card in your Exhaust pile.',
      effects: [{ op: 'damage', amount: { v: 'exhaust_pile', mul: 4, add: 5 } }]
    }
  });

  DS.defineCard({
    id: 'bz_flurry_of_blades', name: 'Flurry of Blades', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🌀',
    desc: 'Deal 3 damage 4 times.',
    effects: [{ op: 'damage', amount: 3, times: 4 }],
    upgrade: { desc: 'Deal 4 damage 4 times.', effects: [{ op: 'damage', amount: 4, times: 4 }] }
  });

  DS.defineCard({
    id: 'bz_bloodbath', name: 'Bloodbath', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🌊',
    desc: 'Deal 9 damage to ALL enemies. Lose 3 HP.',
    effects: [{ op: 'damage', amount: 9, to: 'all_enemies' }, { op: 'lose_hp', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Deal 12 damage to ALL enemies. Lose 2 HP.',
      effects: [{ op: 'damage', amount: 12, to: 'all_enemies' }, { op: 'lose_hp', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_titans_blow', name: "Titan's Blow", class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 3, target: 'enemy', icon: '🗿',
    desc: 'Ethereal. Deal 24 damage.',
    ethereal: true,
    effects: [{ op: 'damage', amount: 24 }],
    upgrade: { desc: 'Ethereal. Deal 30 damage.', effects: [{ op: 'damage', amount: 30 }] }
  });

  DS.defineCard({
    id: 'bz_bleeding_edge', name: 'Bleeding Edge', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🔪',
    desc: 'Deal 11 damage. Lose 4 HP.',
    effects: [{ op: 'damage', amount: 11 }, { op: 'lose_hp', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Deal 14 damage. Lose 3 HP.',
      effects: [{ op: 'damage', amount: 14 }, { op: 'lose_hp', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_coup_de_grace', name: 'Coup de Grace', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '💀',
    desc: 'Deal 8 damage. If the enemy is below 30% HP, deal 12 more.',
    effects: [
      { op: 'damage', amount: 8 },
      {
        op: 'if',
        cond: { left: { v: 'hp', of: 'target' }, cmp: '<', right: { v: 'max_hp', of: 'target', mul: 0.3 } },
        then: [{ op: 'damage', amount: 12 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 10 damage. If the enemy is below 30% HP, deal 16 more.',
      effects: [
        { op: 'damage', amount: 10 },
        {
          op: 'if',
          cond: { left: { v: 'hp', of: 'target' }, cmp: '<', right: { v: 'max_hp', of: 'target', mul: 0.3 } },
          then: [{ op: 'damage', amount: 16 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_sweeping_arc', name: 'Sweeping Arc', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🌙',
    desc: 'Deal 6 damage to ALL enemies twice.',
    effects: [{ op: 'damage', amount: 6, times: 2, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 8 damage to ALL enemies twice.',
      effects: [{ op: 'damage', amount: 8, times: 2, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'bz_reaving_chop', name: 'Reaving Chop', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🦴',
    desc: 'Deal 9 damage. Apply 2 Vulnerable.',
    effects: [{ op: 'damage', amount: 9 }, { op: 'apply', status: 'vulnerable', amount: 2, to: 'target' }],
    upgrade: {
      desc: 'Deal 12 damage. Apply 3 Vulnerable.',
      effects: [{ op: 'damage', amount: 12 }, { op: 'apply', status: 'vulnerable', amount: 3, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'bz_bloodsip_cut', name: 'Bloodsip Cut', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🍷',
    desc: 'Deal 7 damage. Heal 3 HP.',
    effects: [{ op: 'damage', amount: 7 }, { op: 'heal', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Deal 9 damage. Heal 4 HP.',
      effects: [{ op: 'damage', amount: 9 }, { op: 'heal', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_ember_brand', name: 'Ember Brand', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🔥',
    desc: 'Deal 10 damage. Add 1 Ember to your hand. Exhaust.',
    exhaust: true,
    effects: [{ op: 'damage', amount: 10 }, { op: 'add_card', card: 'bz_ember', to: 'hand', amount: 1 }],
    upgrade: {
      desc: 'Deal 14 damage. Add 2 Embers to your hand. Exhaust.',
      effects: [{ op: 'damage', amount: 14 }, { op: 'add_card', card: 'bz_ember', to: 'hand', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'bz_ravenous_maul', name: 'Ravenous Maul', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🐻',
    desc: 'Deal 5 damage, plus 1 for every 2 HP you are missing.',
    effects: [{ op: 'damage', amount: { v: 'missing_hp', mul: 0.5, add: 5 } }],
    upgrade: {
      desc: 'Deal 7 damage, plus 1 for every 2 HP you are missing.',
      effects: [{ op: 'damage', amount: { v: 'missing_hp', mul: 0.5, add: 7 } }]
    }
  });

  DS.defineCard({
    id: 'bz_whirlwind', name: 'Whirlwind', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 'X', target: 'all_enemies', icon: '🌪️',
    desc: 'Spend all your Energy. Deal 5 damage to ALL enemies once per Energy spent.',
    effects: [{ op: 'damage', amount: 5, times: { v: 'x' }, to: 'all_enemies' }],
    upgrade: {
      desc: 'Spend all your Energy. Deal 7 damage to ALL enemies once per Energy spent.',
      effects: [{ op: 'damage', amount: 7, times: { v: 'x' }, to: 'all_enemies' }]
    }
  });

  // ----- uncommon skills (11) -----
  DS.defineCard({
    id: 'bz_blood_pact', name: 'Blood Pact', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🩸',
    desc: 'Lose 4 HP. Gain 2 Energy.',
    effects: [{ op: 'lose_hp', amount: 4, to: 'self' }, { op: 'energy', amount: 2 }],
    upgrade: {
      desc: 'Lose 3 HP. Gain 2 Energy. Draw 1 card.',
      effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, { op: 'energy', amount: 2 }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'bz_bloody_bulwark', name: 'Bloody Bulwark', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🏰',
    desc: 'Lose 3 HP. Gain 11 Block.',
    effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, { op: 'block', amount: 11, to: 'self' }],
    upgrade: {
      desc: 'Lose 2 HP. Gain 14 Block.',
      effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'block', amount: 14, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_cauterize', name: 'Cauterize', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧯',
    desc: 'Exhaust 1 card from your hand. Draw 2 cards.',
    effects: [{ op: 'exhaust', amount: 1 }, { op: 'draw', amount: 2 }],
    upgrade: {
      desc: 'Exhaust 1 card from your hand. Draw 3 cards.',
      effects: [{ op: 'exhaust', amount: 1 }, { op: 'draw', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'bz_survey_the_field', name: 'Survey the Field', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔭',
    desc: 'Draw 3 cards. Then discard 1 card.',
    effects: [{ op: 'draw', amount: 3 }, { op: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Draw 4 cards. Then discard 1 card.',
      effects: [{ op: 'draw', amount: 4 }, { op: 'discard', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'bz_savage_oath', name: 'Savage Oath', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '📜',
    desc: 'Lose 2 HP. Gain 3 Strength. Exhaust.',
    exhaust: true,
    effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'apply', status: 'strength', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Lose 2 HP. Gain 4 Strength. Exhaust.',
      effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'apply', status: 'strength', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_mark_prey', name: 'Mark Prey', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🎯',
    desc: 'Apply 2 Vulnerable. Draw 1 card.',
    effects: [{ op: 'apply', status: 'vulnerable', amount: 2, to: 'target' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Apply 3 Vulnerable. Draw 1 card.',
      effects: [{ op: 'apply', status: 'vulnerable', amount: 3, to: 'target' }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'bz_hold_the_line', name: 'Hold the Line', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪵',
    desc: 'Retain. Gain 8 Block. Next turn, gain 4 Block.',
    retain: true,
    effects: [{ op: 'block', amount: 8, to: 'self' }, { op: 'apply', status: 'next_turn_block', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Retain. Gain 10 Block. Next turn, gain 6 Block.',
      effects: [{ op: 'block', amount: 10, to: 'self' }, { op: 'apply', status: 'next_turn_block', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_bellow_of_doom', name: 'Bellow of Doom', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '📣',
    desc: 'Apply 2 Vulnerable to ALL enemies.',
    effects: [{ op: 'apply', status: 'vulnerable', amount: 2, to: 'all_enemies' }],
    upgrade: {
      desc: 'Apply 3 Vulnerable to ALL enemies.',
      effects: [{ op: 'apply', status: 'vulnerable', amount: 3, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'bz_adrenal_surge', name: 'Adrenal Surge', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '⚡',
    desc: 'Draw 2 cards. Next turn, gain 1 Energy.',
    effects: [{ op: 'draw', amount: 2 }, { op: 'apply', status: 'energized', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Draw 3 cards. Next turn, gain 2 Energy.',
      effects: [{ op: 'draw', amount: 3 }, { op: 'apply', status: 'energized', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_last_ditch', name: 'Last Ditch', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪦',
    desc: 'Gain 6 Block. If you are below half HP, gain 6 more.',
    effects: [
      { op: 'block', amount: 6, to: 'self' },
      {
        op: 'if',
        cond: { left: { v: 'hp' }, cmp: '<', right: { v: 'max_hp', mul: 0.5 } },
        then: [{ op: 'block', amount: 6, to: 'self' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Gain 8 Block. If you are below half HP, gain 8 more.',
      effects: [
        { op: 'block', amount: 8, to: 'self' },
        {
          op: 'if',
          cond: { left: { v: 'hp' }, cmp: '<', right: { v: 'max_hp', mul: 0.5 } },
          then: [{ op: 'block', amount: 8, to: 'self' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_shrug_it_off', name: 'Shrug It Off', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🤷',
    desc: 'Gain 8 Block. Draw 1 card.',
    effects: [{ op: 'block', amount: 8, to: 'self' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Gain 11 Block. Draw 1 card.',
      effects: [{ op: 'block', amount: 11, to: 'self' }, { op: 'draw', amount: 1 }]
    }
  });

  // ----- uncommon powers (7) -----
  DS.defineCard({
    id: 'bz_blood_hunger', name: 'Blood Hunger', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🩸',
    desc: 'Whenever you lose HP, gain 1 Strength.',
    effects: [{ op: 'apply', status: 'bz_bloodlust', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you lose HP, gain 2 Strength.',
      effects: [{ op: 'apply', status: 'bz_bloodlust', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_gathering_storm', name: 'Gathering Storm', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🌩️',
    desc: 'Whenever you play an Attack, deal 2 damage to ALL enemies.',
    effects: [{ op: 'apply', status: 'bz_tempest', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play an Attack, deal 3 damage to ALL enemies.',
      effects: [{ op: 'apply', status: 'bz_tempest', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_marching_drums', name: 'Marching Drums', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🥁',
    desc: 'The first Attack you play each turn draws 1 card.',
    effects: [{ op: 'apply', status: 'bz_war_rhythm', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'The first Attack you play each turn draws 2 cards.',
      effects: [{ op: 'apply', status: 'bz_war_rhythm', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_bloodthirst_oath', name: 'Bloodthirst Oath', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧛',
    desc: 'Whenever your attack hits an enemy, heal 2 HP.',
    effects: [{ op: 'apply', status: 'bz_bloodthirst', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever your attack hits an enemy, heal 3 HP.',
      effects: [{ op: 'apply', status: 'bz_bloodthirst', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_unbroken_pride', name: 'Unbroken Pride', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🗿',
    desc: 'Whenever an attack breaks your Block, gain 2 Strength.',
    effects: [{ op: 'apply', status: 'bz_unbreakable', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever an attack breaks your Block, gain 3 Strength.',
      effects: [{ op: 'apply', status: 'bz_unbreakable', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_kindle_soul', name: 'Kindle Soul', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔥',
    desc: 'Whenever you Exhaust a card, deal 3 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'bz_scorched_soul', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Whenever you Exhaust a card, deal 4 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'bz_scorched_soul', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_scent_of_blood', name: 'Scent of Blood', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🐺',
    desc: 'The first attack that hits each turn applies 1 Vulnerable.',
    effects: [{ op: 'apply', status: 'bz_bloodscent', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'The first attack that hits each turn applies 2 Vulnerable.',
      effects: [{ op: 'apply', status: 'bz_bloodscent', amount: 2, to: 'self' }]
    }
  });

  // ===========================================================================
  // RARE (16): 5 attacks, 7 skills, 4 powers
  // ===========================================================================

  // ----- rare attacks (5) -----
  DS.defineCard({
    id: 'bz_ragnarok_cleave', name: 'Ragnarok Cleave', class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 3, target: 'all_enemies', icon: '🌠',
    desc: 'Deal 18 damage to ALL enemies.',
    effects: [{ op: 'damage', amount: 18, to: 'all_enemies' }],
    upgrade: { desc: 'Deal 24 damage to ALL enemies.', effects: [{ op: 'damage', amount: 24, to: 'all_enemies' }] }
  });

  DS.defineCard({
    id: 'bz_gorestorm', name: 'Gorestorm', class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 'X', target: 'all_enemies', icon: '🌪️',
    desc: 'Spend all your Energy. Deal 6 damage to ALL enemies once per Energy spent. Lose 2 HP.',
    effects: [
      { op: 'damage', amount: 6, times: { v: 'x' }, to: 'all_enemies' },
      { op: 'lose_hp', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Spend all your Energy. Deal 8 damage to ALL enemies once per Energy spent. Lose 2 HP.',
      effects: [
        { op: 'damage', amount: 8, times: { v: 'x' }, to: 'all_enemies' },
        { op: 'lose_hp', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_wrath_of_ymir', name: 'Wrath of Ymir', class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 3, target: 'enemy', icon: '⚡',
    desc: 'Deal 28 damage. If you have lost at least half your max HP, deal 14 more.',
    effects: [
      { op: 'damage', amount: 28 },
      {
        op: 'if',
        cond: { left: { v: 'missing_hp' }, cmp: '>=', right: { v: 'max_hp', mul: 0.5 } },
        then: [{ op: 'damage', amount: 14 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 36 damage. If you have lost at least half your max HP, deal 18 more.',
      effects: [
        { op: 'damage', amount: 36 },
        {
          op: 'if',
          cond: { left: { v: 'missing_hp' }, cmp: '>=', right: { v: 'max_hp', mul: 0.5 } },
          then: [{ op: 'damage', amount: 18 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_ashen_judgment', name: 'Ashen Judgment', class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🔱',
    desc: 'Deal 4 damage, plus 4 for each card in your Exhaust pile.',
    effects: [{ op: 'damage', amount: { v: 'exhaust_pile', mul: 4, add: 4 } }],
    upgrade: {
      desc: 'Deal 5 damage, plus 5 for each card in your Exhaust pile.',
      effects: [{ op: 'damage', amount: { v: 'exhaust_pile', mul: 5, add: 5 } }]
    }
  });

  DS.defineCard({
    id: 'bz_deathblow', name: 'Deathblow', class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🦷',
    desc: 'Deal 16 damage. If the enemy is Vulnerable, deal 16 more.',
    effects: [
      { op: 'damage', amount: 16 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'vulnerable', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 16 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 20 damage. If the enemy is Vulnerable, deal 20 more.',
      effects: [
        { op: 'damage', amount: 20 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'vulnerable', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 20 }],
          else: []
        }
      ]
    }
  });

  // ----- rare skills (7) -----
  DS.defineCard({
    id: 'bz_blood_sacrifice', name: 'Blood Sacrifice', class: 'berserker', type: 'skill', rarity: 'rare',
    cost: 0, target: 'self', icon: '🕯️',
    desc: 'Lose 8 HP. Draw 4 cards. Gain 2 Energy.',
    effects: [{ op: 'lose_hp', amount: 8, to: 'self' }, { op: 'draw', amount: 4 }, { op: 'energy', amount: 2 }],
    upgrade: {
      desc: 'Lose 6 HP. Draw 4 cards. Gain 2 Energy.',
      effects: [{ op: 'lose_hp', amount: 6, to: 'self' }, { op: 'draw', amount: 4 }, { op: 'energy', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'bz_ancestral_fury', name: 'Ancestral Fury', class: 'berserker', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🏺',
    desc: 'Double your Strength. Requires Strength to play.',
    playableIf: { left: { v: 'status', status: 'strength', of: 'self' }, cmp: '>', right: 0 },
    effects: [{ op: 'multiply_status', status: 'strength', factor: 2, to: 'self' }],
    upgrade: {
      desc: 'Double your Strength. Gain 1 Strength. Requires Strength to play.',
      effects: [
        { op: 'multiply_status', status: 'strength', factor: 2, to: 'self' },
        { op: 'apply', status: 'strength', amount: 1, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_fortress_of_bone', name: 'Fortress of Bone', class: 'berserker', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🏰',
    desc: 'Gain 14 Block. Next turn, gain 6 Block.',
    effects: [{ op: 'block', amount: 14, to: 'self' }, { op: 'apply', status: 'next_turn_block', amount: 6, to: 'self' }],
    upgrade: {
      desc: 'Gain 18 Block. Next turn, gain 8 Block.',
      effects: [{ op: 'block', amount: 18, to: 'self' }, { op: 'apply', status: 'next_turn_block', amount: 8, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_pyre_of_flesh', name: 'Pyre of Flesh', class: 'berserker', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🔥',
    desc: 'Gain 6 Block for each card in your hand. Then Exhaust your hand.',
    effects: [{ op: 'block', amount: { v: 'hand', mul: 6 }, to: 'self' }, { op: 'exhaust', amount: 'all' }],
    upgrade: {
      desc: 'Gain 8 Block for each card in your hand. Then Exhaust your hand.',
      effects: [{ op: 'block', amount: { v: 'hand', mul: 8 }, to: 'self' }, { op: 'exhaust', amount: 'all' }]
    }
  });

  DS.defineCard({
    id: 'bz_last_breath', name: 'Last Breath', class: 'berserker', type: 'skill', rarity: 'rare',
    cost: 0, target: 'self', icon: '💨',
    desc: 'If you are below 40% HP, gain 2 Energy and draw 3 cards. Otherwise, gain 1 Energy.',
    effects: [
      {
        op: 'if',
        cond: { left: { v: 'hp' }, cmp: '<', right: { v: 'max_hp', mul: 0.4 } },
        then: [{ op: 'energy', amount: 2 }, { op: 'draw', amount: 3 }],
        else: [{ op: 'energy', amount: 1 }]
      }
    ],
    upgrade: {
      desc: 'If you are below 40% HP, gain 3 Energy and draw 4 cards. Otherwise, gain 2 Energy.',
      effects: [
        {
          op: 'if',
          cond: { left: { v: 'hp' }, cmp: '<', right: { v: 'max_hp', mul: 0.4 } },
          then: [{ op: 'energy', amount: 3 }, { op: 'draw', amount: 4 }],
          else: [{ op: 'energy', amount: 2 }]
        }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_rage_stance', name: 'Rage Stance', class: 'berserker', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '😡',
    desc: 'Your attacks deal 50% more damage this turn.',
    effects: [{ op: 'apply', status: 'bz_berserk_stance', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Your attacks deal 50% more damage this turn.',
      cost: 0,
      effects: [{ op: 'apply', status: 'bz_berserk_stance', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_unbowed', name: 'Unbowed Spirit', class: 'berserker', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🦁',
    desc: 'Remove Weak and Frail from yourself. Gain 6 Block.',
    effects: [
      { op: 'remove_status', status: 'weak', to: 'self' },
      { op: 'remove_status', status: 'frail', to: 'self' },
      { op: 'block', amount: 6, to: 'self' }
    ],
    upgrade: {
      desc: 'Remove Weak and Frail from yourself. Gain 9 Block.',
      effects: [
        { op: 'remove_status', status: 'weak', to: 'self' },
        { op: 'remove_status', status: 'frail', to: 'self' },
        { op: 'block', amount: 9, to: 'self' }
      ]
    }
  });

  // ----- rare powers (4) -----
  DS.defineCard({
    id: 'bz_engine_of_wrath', name: 'Engine of Wrath', class: 'berserker', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '💢',
    desc: 'At the start of each turn, gain 1 Energy.',
    effects: [{ op: 'apply', status: 'bz_berserk_engine', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, gain 1 Energy.',
      cost: 1,
      effects: [{ op: 'apply', status: 'bz_berserk_engine', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_hemorrhage_engine', name: 'Hemorrhage Engine', class: 'berserker', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '💧',
    desc: 'At the start of each turn, lose 1 HP and draw 1 card.',
    effects: [{ op: 'apply', status: 'bz_hemorrhage', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, lose 2 HP and draw 2 cards.',
      effects: [{ op: 'apply', status: 'bz_hemorrhage', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_kill_frenzy', name: 'Killing Frenzy', class: 'berserker', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '💀',
    desc: 'Whenever you kill an enemy, gain 2 Strength.',
    effects: [{ op: 'apply', status: 'bz_blood_frenzy', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you kill an enemy, gain 3 Strength.',
      effects: [{ op: 'apply', status: 'bz_blood_frenzy', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_ritual_of_blood', name: 'Ritual of Blood', class: 'berserker', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🩸',
    desc: 'At the end of each turn, gain 2 Strength.',
    effects: [{ op: 'apply', status: 'ritual', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'At the end of each turn, gain 3 Strength.',
      effects: [{ op: 'apply', status: 'ritual', amount: 3, to: 'self' }]
    }
  });

  // ===========================================================================
  // SPECIAL TOKEN (created by Ember Brand; never offered as a reward)
  // ===========================================================================
  DS.defineCard({
    id: 'bz_ember', name: 'Ember', class: 'berserker', type: 'skill', rarity: 'special',
    cost: 0, target: 'self', icon: '🔥',
    desc: 'Gain 2 Block. Exhaust. When Exhausted, deal 3 damage to a random enemy.',
    exhaust: true,
    effects: [{ op: 'block', amount: 2, to: 'self' }],
    onExhaust: [{ op: 'damage', amount: 3, to: 'random_enemy' }],
    upgrade: {
      desc: 'Gain 3 Block. Exhaust. When Exhausted, deal 4 damage to a random enemy.',
      effects: [{ op: 'block', amount: 3, to: 'self' }],
      onExhaust: [{ op: 'damage', amount: 4, to: 'random_enemy' }]
    }
  });
})();
