(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // BERSERKER EXPANSION (v2): Ulfar the Bloodaxe.
  // New archetype WARCRY: skills that buff your next Attack (Vigor, Double Tap), Wounds added to your
  // own piles as fuel (exhausted for Strength, drawn for damage or Block), and Block earned by fighting.
  // Existing archetypes also get supporting cards: Bloodprice (bz_hemoclot, bz_exsanguinate, bz_bloodfall),
  // Scorched (bz_ash_breath, bz_cinder_toss, bz_cinder_storm), Whirlwind (bz_flail_round, bz_hurricane_chop,
  // bz_thousand_cuts), Warpath (bz_pounce, bz_warpath_strike, bz_war_stomp).
  // New statuses (9): bz_battle_chant, bz_double_cry, bz_war_hunger, bz_scar_feast, bz_wound_brand,
  // bz_wound_bulwark, bz_reprisal, bz_battle_footing, bz_grim_resolve.
  // ---------------------------------------------------------------------------

  // ===========================================================================
  // CUSTOM STATUSES (9). Power cards apply these to self.
  // ===========================================================================

  // Warcry: every Skill you play chants up Vigor for your next Attack.
  DS.defineStatus({
    id: 'bz_battle_chant',
    name: 'Battle Chant',
    desc: 'Whenever you play a Skill, gain {n} Vigor.',
    type: 'buff',
    icon: '📯',
    stacks: true,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'apply', status: 'vigor', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // Warcry: every Skill you play primes your next Attack(s) to be played twice.
  DS.defineStatus({
    id: 'bz_double_cry',
    name: 'Double Cry',
    desc: 'Whenever you play a Skill, gain {n} Double Tap.',
    type: 'buff',
    icon: '📢',
    stacks: true,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'apply', status: 'double_tap', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // Warcry: at the start of every turn, stir up more Vigor (it waits until your next Attack).
  DS.defineStatus({
    id: 'bz_war_hunger',
    name: 'War Hunger',
    desc: 'At the start of each turn, gain {n} Vigor.',
    type: 'buff',
    icon: '🐗',
    stacks: true,
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'vigor', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Warcry: exhausting a Status card (a Wound, usually) feeds Strength.
  DS.defineStatus({
    id: 'bz_scar_feast',
    name: 'Scar Feast',
    desc: 'Whenever you Exhaust a Status card, gain {n} Strength.',
    type: 'buff',
    icon: '🍖',
    stacks: true,
    triggers: {
      onCardExhausted: {
        when: { cardType: 'status' },
        effects: [{ op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // Warcry: drawing a Status card (a Wound) burns a random enemy.
  DS.defineStatus({
    id: 'bz_wound_brand',
    name: 'Wound Brand',
    desc: 'Whenever you draw a Status card, deal {n} damage to a random enemy.',
    type: 'buff',
    icon: '🖤',
    stacks: true,
    triggers: {
      onCardDrawn: {
        when: { cardType: 'status' },
        effects: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
      }
    }
  });

  // Defence: drawing a Status card (a Wound) hardens you.
  DS.defineStatus({
    id: 'bz_wound_bulwark',
    name: 'Wound Bulwark',
    desc: 'Whenever you draw a Status card, gain {n} Block.',
    type: 'buff',
    icon: '🏯',
    stacks: true,
    triggers: {
      onCardDrawn: {
        when: { cardType: 'status' },
        effects: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // Defence: every hit that lands on you is answered with Block.
  DS.defineStatus({
    id: 'bz_reprisal',
    name: 'Reprisal',
    desc: 'Whenever you are attacked, gain {n} Block.',
    type: 'buff',
    icon: '🔰',
    stacks: true,
    triggers: {
      onAttacked: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Defence: attacking plants your feet; every Attack you play grants Block.
  DS.defineStatus({
    id: 'bz_battle_footing',
    name: 'Battle Footing',
    desc: 'Whenever you play an Attack, gain {n} Block.',
    type: 'buff',
    icon: '🥾',
    stacks: true,
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // Defence (bloodprice side): losing HP to an attack hardens your guard.
  DS.defineStatus({
    id: 'bz_grim_resolve',
    name: 'Grim Resolve',
    desc: 'Whenever you lose HP from an attack, gain {n} Block.',
    type: 'buff',
    icon: '🗡️',
    stacks: true,
    triggers: {
      onDamaged: {
        when: { fromAttack: true },
        effects: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // ===========================================================================
  // COMMON (14): 6 attacks, 6 skills, 2 powers
  // ===========================================================================

  // ----- common attacks (6) -----
  DS.defineCard({
    id: 'bz_gore_lunge', name: 'Gore Lunge', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🦏',
    desc: 'Deal 7 damage. Add 1 Wound to your discard pile.',
    effects: [{ op: 'damage', amount: 7 }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Deal 10 damage. Add 1 Wound to your discard pile.',
      effects: [{ op: 'damage', amount: 10 }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'bz_cinder_toss', name: 'Cinder Toss', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🧨',
    desc: 'Deal 5 damage. Exhaust 1 random card from your hand.',
    effects: [{ op: 'damage', amount: 5 }, { op: 'exhaust', amount: 1, random: true }],
    upgrade: {
      desc: 'Deal 7 damage. Exhaust 1 random card from your hand.',
      effects: [{ op: 'damage', amount: 7 }, { op: 'exhaust', amount: 1, random: true }]
    }
  });

  DS.defineCard({
    id: 'bz_pounce', name: 'Pounce', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🐆',
    desc: 'Deal 6 damage. If the enemy is Vulnerable, gain 1 Energy.',
    effects: [
      { op: 'damage', amount: 6 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'vulnerable', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'energy', amount: 1 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 9 damage. If the enemy is Vulnerable, gain 1 Energy.',
      effects: [
        { op: 'damage', amount: 9 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'vulnerable', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'energy', amount: 1 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_flail_round', name: 'Flail Round', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '🔄',
    desc: 'Deal 4 damage to ALL enemies. Draw 1 card.',
    effects: [{ op: 'damage', amount: 4, to: 'all_enemies' }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Deal 5 damage to ALL enemies. Draw 1 card.',
      effects: [{ op: 'damage', amount: 5, to: 'all_enemies' }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'bz_cauterizing_cut', name: 'Cauterizing Cut', class: 'berserker', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '♨️',
    desc: 'Deal 6 damage. Exhaust 1 random card from your discard pile.',
    effects: [{ op: 'damage', amount: 6 }, { op: 'exhaust', amount: 1, from: 'discard', random: true }],
    upgrade: {
      desc: 'Deal 8 damage. Exhaust 1 random card from your discard pile.',
      effects: [{ op: 'damage', amount: 8 }, { op: 'exhaust', amount: 1, from: 'discard', random: true }]
    }
  });

  DS.defineCard({
    id: 'bz_war_stomp', name: 'War Stomp', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '🦶',
    desc: 'Apply 1 Vulnerable to ALL enemies. Gain 4 Block.',
    effects: [
      { op: 'apply', status: 'vulnerable', amount: 1, to: 'all_enemies' },
      { op: 'block', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Apply 2 Vulnerable to ALL enemies. Gain 6 Block.',
      effects: [
        { op: 'apply', status: 'vulnerable', amount: 2, to: 'all_enemies' },
        { op: 'block', amount: 6, to: 'self' }
      ]
    }
  });

  // ----- common skills (6) -----
  DS.defineCard({
    id: 'bz_battle_shout', name: 'Battle Shout', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '📣',
    desc: 'Gain 4 Vigor. Your next Attack deals 4 more damage.',
    effects: [{ op: 'apply', status: 'vigor', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Gain 6 Vigor. Your next Attack deals 6 more damage.',
      effects: [{ op: 'apply', status: 'vigor', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_self_gash', name: 'Self-Gash', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '✂️',
    desc: 'Add 1 Wound to your discard pile. Draw 2 cards.',
    effects: [{ op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }, { op: 'draw', amount: 2 }],
    upgrade: {
      desc: 'Add 1 Wound to your discard pile. Draw 3 cards.',
      effects: [{ op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }, { op: 'draw', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'bz_ash_breath', name: 'Ash Breath', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '💨', exhaust: true,
    desc: 'Gain 4 Block. Exhaust.',
    effects: [{ op: 'block', amount: 4, to: 'self' }],
    upgrade: { desc: 'Gain 6 Block. Exhaust.', effects: [{ op: 'block', amount: 6, to: 'self' }] }
  });

  DS.defineCard({
    id: 'bz_bristle_hide', name: 'Bristle Hide', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🦔',
    desc: 'Gain 5 Block. Gain 2 Thorns.',
    effects: [{ op: 'block', amount: 5, to: 'self' }, { op: 'apply', status: 'thorns', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 7 Block. Gain 3 Thorns.',
      effects: [{ op: 'block', amount: 7, to: 'self' }, { op: 'apply', status: 'thorns', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_hemoclot', name: 'Hemoclot', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🧪', exhaust: true,
    desc: 'Lose 2 HP. Gain 2 Strength. Exhaust.',
    effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'apply', status: 'strength', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Lose 1 HP. Gain 3 Strength. Exhaust.',
      effects: [{ op: 'lose_hp', amount: 1, to: 'self' }, { op: 'apply', status: 'strength', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_grit_teeth', name: 'Grit Teeth', class: 'berserker', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '😬',
    desc: 'Gain 7 Block. Add 1 Wound to your discard pile.',
    effects: [{ op: 'block', amount: 7, to: 'self' }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Gain 9 Block. Add 1 Wound to your discard pile.',
      effects: [{ op: 'block', amount: 9, to: 'self' }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }]
    }
  });

  // ----- common powers (2) -----
  DS.defineCard({
    id: 'bz_war_chant', name: 'War Chant', class: 'berserker', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🎶',
    desc: 'Whenever you play a Skill, gain 2 Vigor.',
    effects: [{ op: 'apply', status: 'bz_battle_chant', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play a Skill, gain 3 Vigor.',
      effects: [{ op: 'apply', status: 'bz_battle_chant', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_footwork', name: 'Footwork', class: 'berserker', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '👣',
    desc: 'Whenever you play an Attack, gain 2 Block.',
    effects: [{ op: 'apply', status: 'bz_battle_footing', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play an Attack, gain 3 Block.',
      effects: [{ op: 'apply', status: 'bz_battle_footing', amount: 3, to: 'self' }]
    }
  });

  // ===========================================================================
  // UNCOMMON (18): 7 attacks, 6 skills, 5 powers
  // ===========================================================================

  // ----- uncommon powers (5) -----
  DS.defineCard({
    id: 'bz_nerve_of_steel', name: 'Nerve of Steel', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🛑',
    desc: 'Whenever you are attacked, gain 2 Block.',
    effects: [{ op: 'apply', status: 'bz_reprisal', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you are attacked, gain 3 Block.',
      effects: [{ op: 'apply', status: 'bz_reprisal', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_brand_of_wounds', name: 'Brand of Wounds', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🖤',
    desc: 'Whenever you draw a Status card, deal 4 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'bz_wound_brand', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Whenever you draw a Status card, deal 6 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'bz_wound_brand', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_feast_of_scars', name: 'Feast of Scars', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🍖',
    desc: 'Whenever you Exhaust a Status card, gain 2 Strength.',
    effects: [{ op: 'apply', status: 'bz_scar_feast', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Whenever you Exhaust a Status card, gain 3 Strength.',
      effects: [{ op: 'apply', status: 'bz_scar_feast', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_twin_cry', name: 'Twin Cry', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '📢',
    desc: 'Whenever you play a Skill, gain 1 Double Tap.',
    effects: [{ op: 'apply', status: 'bz_double_cry', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play a Skill, gain 1 Double Tap.',
      cost: 0,
      effects: [{ op: 'apply', status: 'bz_double_cry', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_hunger_for_war', name: 'Hunger for War', class: 'berserker', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🐗',
    desc: 'At the start of each turn, gain 2 Vigor.',
    effects: [{ op: 'apply', status: 'bz_war_hunger', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'At the start of each turn, gain 3 Vigor.',
      effects: [{ op: 'apply', status: 'bz_war_hunger', amount: 3, to: 'self' }]
    }
  });

  // ----- uncommon skills (5) -----
  DS.defineCard({
    id: 'bz_warcall', name: 'Warcall', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '📯',
    desc: 'Gain 6 Vigor. Add 1 Wound to your discard pile.',
    effects: [{ op: 'apply', status: 'vigor', amount: 6, to: 'self' }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Gain 8 Vigor. Add 1 Wound to your discard pile.',
      effects: [{ op: 'apply', status: 'vigor', amount: 8, to: 'self' }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'bz_purge_scars', name: 'Purge Scars', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🧹',
    desc: 'Exhaust all Status cards in your hand. Gain 4 Block.',
    effects: [{ op: 'exhaust', amount: 'all', type: 'status' }, { op: 'block', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Exhaust all Status cards in your hand. Gain 6 Block.',
      effects: [{ op: 'exhaust', amount: 'all', type: 'status' }, { op: 'block', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_spiked_bulwark', name: 'Spiked Bulwark', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🌵',
    desc: 'Gain 10 Block. Gain 3 Thorns.',
    effects: [{ op: 'block', amount: 10, to: 'self' }, { op: 'apply', status: 'thorns', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Gain 13 Block. Gain 4 Thorns.',
      effects: [{ op: 'block', amount: 13, to: 'self' }, { op: 'apply', status: 'thorns', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_blood_tithe', name: 'Blood Tithe', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '⚰️',
    desc: 'Lose 3 HP. Draw 2 cards. Add 1 Wound to your discard pile.',
    effects: [
      { op: 'lose_hp', amount: 3, to: 'self' },
      { op: 'draw', amount: 2 },
      { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }
    ],
    upgrade: {
      desc: 'Lose 3 HP. Draw 3 cards. Add 1 Wound to your discard pile.',
      effects: [
        { op: 'lose_hp', amount: 3, to: 'self' },
        { op: 'draw', amount: 3 },
        { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_battle_guard', name: 'Battle Guard', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪖',
    desc: 'Gain 6 Block. Gain 3 Vigor.',
    effects: [{ op: 'block', amount: 6, to: 'self' }, { op: 'apply', status: 'vigor', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Gain 8 Block. Gain 4 Vigor.',
      effects: [{ op: 'block', amount: 8, to: 'self' }, { op: 'apply', status: 'vigor', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_stoke_the_wound', name: 'Stoke the Wound', class: 'berserker', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🌡️',
    desc: 'Add 1 Wound to your discard pile. Gain 2 Strength.',
    effects: [{ op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }, { op: 'apply', status: 'strength', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Add 1 Wound to your discard pile. Gain 3 Strength.',
      effects: [{ op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }, { op: 'apply', status: 'strength', amount: 3, to: 'self' }]
    }
  });

  // ----- uncommon attacks (7) -----
  DS.defineCard({
    id: 'bz_raging_rend', name: 'Raging Rend', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🦖',
    desc: 'Deal 12 damage. Add 1 Wound to your discard pile.',
    effects: [{ op: 'damage', amount: 12 }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }],
    upgrade: {
      desc: 'Deal 15 damage. Add 1 Wound to your discard pile.',
      effects: [{ op: 'damage', amount: 15 }, { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'bz_scorched_cleave', name: 'Scorched Cleave', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '☄️',
    desc: 'Deal 7 damage to ALL enemies. Exhaust 1 card from your hand.',
    effects: [{ op: 'damage', amount: 7, to: 'all_enemies' }, { op: 'exhaust', amount: 1 }],
    upgrade: {
      desc: 'Deal 10 damage to ALL enemies. Exhaust 1 card from your hand.',
      effects: [{ op: 'damage', amount: 10, to: 'all_enemies' }, { op: 'exhaust', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'bz_hurricane_chop', name: 'Hurricane Chop', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🌬️',
    desc: 'Deal 4 damage to ALL enemies 3 times. Lose 1 HP.',
    effects: [{ op: 'damage', amount: 4, times: 3, to: 'all_enemies' }, { op: 'lose_hp', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Deal 5 damage to ALL enemies 3 times. Lose 1 HP.',
      effects: [{ op: 'damage', amount: 5, times: 3, to: 'all_enemies' }, { op: 'lose_hp', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_bloodfall', name: 'Bloodfall', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '💦',
    desc: 'Deal 5 damage. Lose 2 HP. Draw 2 cards.',
    effects: [{ op: 'damage', amount: 5 }, { op: 'lose_hp', amount: 2, to: 'self' }, { op: 'draw', amount: 2 }],
    upgrade: {
      desc: 'Deal 7 damage. Lose 2 HP. Draw 2 cards.',
      effects: [{ op: 'damage', amount: 7 }, { op: 'lose_hp', amount: 2, to: 'self' }, { op: 'draw', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'bz_warpath_strike', name: 'Warpath Strike', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🐾',
    desc: 'Deal 8 damage. If the enemy is Vulnerable, gain 5 Block.',
    effects: [
      { op: 'damage', amount: 8 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'vulnerable', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'block', amount: 5, to: 'self' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 10 damage. If the enemy is Vulnerable, gain 7 Block.',
      effects: [
        { op: 'damage', amount: 10 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'vulnerable', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'block', amount: 7, to: 'self' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_ember_cleave', name: 'Ember Cleave', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '💫',
    desc: 'Deal 9 damage. Exhaust 1 random card from your discard pile.',
    effects: [{ op: 'damage', amount: 9 }, { op: 'exhaust', amount: 1, from: 'discard', random: true }],
    upgrade: {
      desc: 'Deal 12 damage. Exhaust 1 random card from your discard pile.',
      effects: [{ op: 'damage', amount: 12 }, { op: 'exhaust', amount: 1, from: 'discard', random: true }]
    }
  });

  // ----- uncommon Warcry attack (1) -----
  DS.defineCard({
    id: 'bz_warcry_smash', name: 'Warcry Smash', class: 'berserker', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🗯️',
    desc: 'Double your Vigor. Deal 6 damage.',
    effects: [{ op: 'multiply_status', status: 'vigor', factor: 2, to: 'self' }, { op: 'damage', amount: 6 }],
    upgrade: {
      desc: 'Double your Vigor. Deal 8 damage.',
      effects: [{ op: 'multiply_status', status: 'vigor', factor: 2, to: 'self' }, { op: 'damage', amount: 8 }]
    }
  });

  // ===========================================================================
  // RARE (9): 4 attacks, 3 skills, 2 powers
  // ===========================================================================

  // ----- rare powers (2) -----
  DS.defineCard({
    id: 'bz_last_stand', name: 'Vow of Iron', class: 'berserker', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🎖️',
    desc: 'Whenever you lose HP from an attack, gain 4 Block.',
    effects: [{ op: 'apply', status: 'bz_grim_resolve', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Whenever you lose HP from an attack, gain 6 Block.',
      effects: [{ op: 'apply', status: 'bz_grim_resolve', amount: 6, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'bz_bulwark_of_wounds', name: 'Bulwark of Wounds', class: 'berserker', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🏯',
    desc: 'Whenever you draw a Status card, gain 4 Block.',
    effects: [{ op: 'apply', status: 'bz_wound_bulwark', amount: 4, to: 'self' }],
    upgrade: {
      desc: 'Whenever you draw a Status card, gain 6 Block.',
      effects: [{ op: 'apply', status: 'bz_wound_bulwark', amount: 6, to: 'self' }]
    }
  });

  // ----- rare skills (3) -----
  DS.defineCard({
    id: 'bz_warborn_pact', name: 'Warborn Pact', class: 'berserker', type: 'skill', rarity: 'rare',
    cost: 0, target: 'self', icon: '🔮',
    desc: 'Add 2 Wounds to your discard pile. Gain 2 Energy.',
    effects: [{ op: 'add_card', card: 'status_wound', to: 'discard', amount: 2 }, { op: 'energy', amount: 2 }],
    upgrade: {
      desc: 'Add 2 Wounds to your discard pile. Gain 3 Energy.',
      effects: [{ op: 'add_card', card: 'status_wound', to: 'discard', amount: 2 }, { op: 'energy', amount: 3 }]
    }
  });

  DS.defineCard({
    id: 'bz_war_trance', name: 'War Trance', class: 'berserker', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🎭',
    desc: 'Gain 5 Vigor. Gain 1 Double Tap. Draw 1 card.',
    effects: [
      { op: 'apply', status: 'vigor', amount: 5, to: 'self' },
      { op: 'apply', status: 'double_tap', amount: 1, to: 'self' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Gain 7 Vigor. Gain 2 Double Tap. Draw 1 card.',
      effects: [
        { op: 'apply', status: 'vigor', amount: 7, to: 'self' },
        { op: 'apply', status: 'double_tap', amount: 2, to: 'self' },
        { op: 'draw', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'bz_unyielding_rage', name: 'Unyielding Rage', class: 'berserker', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🐃',
    desc: 'Lose 3 HP. Gain 12 Block. Gain 2 Strength.',
    effects: [
      { op: 'lose_hp', amount: 3, to: 'self' },
      { op: 'block', amount: 12, to: 'self' },
      { op: 'apply', status: 'strength', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Lose 2 HP. Gain 15 Block. Gain 3 Strength.',
      effects: [
        { op: 'lose_hp', amount: 2, to: 'self' },
        { op: 'block', amount: 15, to: 'self' },
        { op: 'apply', status: 'strength', amount: 3, to: 'self' }
      ]
    }
  });

  // ----- rare attacks (4) -----
  DS.defineCard({
    id: 'bz_ragnarok_warcry', name: 'Ragnarok Warcry', class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 3, target: 'all_enemies', icon: '🌅',
    desc: 'Double your Vigor. Deal 12 damage to ALL enemies.',
    effects: [{ op: 'multiply_status', status: 'vigor', factor: 2, to: 'self' }, { op: 'damage', amount: 12, to: 'all_enemies' }],
    upgrade: {
      desc: 'Double your Vigor. Deal 15 damage to ALL enemies.',
      effects: [{ op: 'multiply_status', status: 'vigor', factor: 2, to: 'self' }, { op: 'damage', amount: 15, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'bz_cinder_storm', name: 'Cinder Storm', class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🎇',
    desc: 'Deal 6 damage to ALL enemies. Exhaust 2 random cards from your hand.',
    effects: [{ op: 'damage', amount: 6, to: 'all_enemies' }, { op: 'exhaust', amount: 2, random: true }],
    upgrade: {
      desc: 'Deal 8 damage to ALL enemies. Exhaust 2 random cards from your hand.',
      effects: [{ op: 'damage', amount: 8, to: 'all_enemies' }, { op: 'exhaust', amount: 2, random: true }]
    }
  });

  DS.defineCard({
    id: 'bz_exsanguinate', name: 'Exsanguinate', class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 1, target: 'enemy', icon: '🫗',
    desc: 'Lose 3 HP. Deal 16 damage. Draw 1 card.',
    effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, { op: 'damage', amount: 16 }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Lose 2 HP. Deal 20 damage. Draw 1 card.',
      effects: [{ op: 'lose_hp', amount: 2, to: 'self' }, { op: 'damage', amount: 20 }, { op: 'draw', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'bz_thousand_cuts', name: 'Thousand Cuts', class: 'berserker', type: 'attack', rarity: 'rare',
    cost: 2, target: 'random_enemy', icon: '🗡️',
    desc: 'Deal 3 damage to a random enemy 6 times.',
    effects: [{ op: 'damage', amount: 3, times: 6, to: 'random_enemy' }],
    upgrade: {
      desc: 'Deal 4 damage to a random enemy 6 times.',
      effects: [{ op: 'damage', amount: 4, times: 6, to: 'random_enemy' }]
    }
  });

  // ===========================================================================
  // CLASS RELICS (one per rarity) that reward Warcry, Wounds and Block.
  // ===========================================================================
  DS.defineRelic({
    id: 'bz_relic2_war_drum',
    name: 'War Drum',
    desc: 'At the start of each combat, gain 3 Vigor.',
    flavor: 'The beat starts before the first blow.',
    rarity: 'common',
    icon: '🥁',
    class: 'berserker',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'vigor', amount: 3, to: 'self' }]
    }
  });

  DS.defineRelic({
    id: 'bz_relic2_woundfist',
    name: 'Woundfist Gauntlet',
    desc: 'The first time each turn you draw a Status card, gain 1 Energy.',
    flavor: 'Every scar is a spark waiting to be struck.',
    rarity: 'uncommon',
    icon: '🧤',
    class: 'berserker',
    triggers: {
      onCardDrawn: {
        when: { cardType: 'status' },
        oncePerTurn: true,
        effects: [{ op: 'energy', amount: 1 }]
      }
    }
  });

  DS.defineRelic({
    id: 'bz_relic2_cinder_horn',
    name: 'Cinder Horn',
    desc: 'Whenever you Exhaust a Status card, deal 6 damage to ALL enemies.',
    flavor: 'Blow it, and the ash answers.',
    rarity: 'rare',
    icon: '🎺',
    class: 'berserker',
    triggers: {
      onCardExhausted: {
        when: { cardType: 'status' },
        effects: [{ op: 'damage', amount: 6, to: 'all_enemies' }]
      }
    }
  });
})();
