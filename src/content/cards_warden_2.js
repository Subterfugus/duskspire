(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // =====================================================================
  // WARDEN expansion (v2). Adds the BULWARK BASH archetype and deepens Block, Thorns, Regen and Growth.
  //   RETALIATION : Riposte (an attack breaks your Block), Iron Counter (you are hit), Thorn Mantle (first Block each turn)
  //   TAUNT       : Taunt marks on enemies (you gain Block whenever they are hit), Sentinel's Due (debuffs grant Block)
  //   BASH        : attacks that spend Block for damage, Block-gated strikes, self-cost bloodbursts
  //   SWIFT       : 0-1 cost pressure, Momentum (every Attack pings a random enemy), Growth ramps
  //   SANCTUARY   : Sapwell / Sapling Tithe sustain, doubled Thorns, Regen
  // =====================================================================

  // Shared escape hatch for the two "spend Block" cards. The card's damage effect is resolved
  // first (it reads the Block the card was played with), then this clears the player's Block.
  const spendAllBlock = async function (ctx) {
    const combat = ctx && ctx.combat;
    if (combat && combat.player) combat.player.block = 0;
  };

  // =====================================================================
  // Custom statuses (new powers). Ids are prefixed wd_ and never equal a card id.
  // =====================================================================

  DS.defineStatus({
    id: 'wd_riposte', name: 'Riposte', type: 'buff', icon: '⚔️', stacks: true, decay: null, expire: null,
    desc: 'Whenever an attack breaks your Block, deal {n} damage to the attacker.',
    triggers: {
      onBlockBroken: [{ op: 'damage', amount: { v: 'stacks' }, to: 'target' }]
    }
  });

  DS.defineStatus({
    id: 'wd_taunt', name: 'Taunt', type: 'debuff', icon: '📣', stacks: true, decay: 'turn_end', expire: null,
    desc: 'Whenever this enemy is attacked, you gain {n} Block. Loses 1 stack each turn.',
    triggers: {
      onAttacked: [{ op: 'block', amount: { v: 'stacks' }, to: 'player' }]
    }
  });

  DS.defineStatus({
    id: 'wd_sentinels_due', name: "Sentinel's Due", type: 'buff', icon: '🧭', stacks: true, decay: null, expire: null,
    desc: 'Whenever you apply a debuff to an enemy, gain {n} Block.',
    triggers: {
      onApplyDebuff: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'wd_thorn_mantle', name: 'Thorn Mantle', type: 'buff', icon: '🪸', stacks: true, decay: null, expire: null,
    desc: 'Whenever you first gain Block each turn, gain {n} Thorns.',
    triggers: {
      onBlockGained: {
        oncePerTurn: true,
        effects: [{ op: 'apply', status: 'thorns', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  DS.defineStatus({
    id: 'wd_sapling_tithe', name: 'Sapling Tithe', type: 'buff', icon: '🎍', stacks: false, decay: null, expire: null,
    desc: 'At the start of your turn, gain Block equal to your Growth.',
    triggers: {
      onTurnStart: [{ op: 'block', amount: { v: 'status', status: 'wd_growth', of: 'self' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'wd_sapwell', name: 'Sapwell', type: 'buff', icon: '🪣', stacks: true, decay: null, expire: null,
    desc: 'At the end of your turn, gain {n} Regen.',
    triggers: {
      onTurnEnd: [{ op: 'apply', status: 'regen', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'wd_iron_counter', name: 'Iron Counter', type: 'buff', icon: '🔩', stacks: true, decay: null, expire: null,
    desc: 'Whenever you are hit by an attack, deal half your remaining Block to the attacker, {n} times.',
    triggers: {
      onAttacked: [{
        op: 'damage',
        amount: { v: 'block', of: 'self', mul: 0.5 },
        times: { v: 'stacks' },
        to: 'target'
      }]
    }
  });

  DS.defineStatus({
    id: 'wd_momentum', name: 'Momentum', type: 'buff', icon: '💨', stacks: true, decay: null, expire: null,
    desc: 'Whenever you play an Attack, deal {n} damage to a random enemy.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
      }
    }
  });

  // =====================================================================
  // COMMON (14): 6 attacks, 5 skills, 3 powers
  // =====================================================================

  DS.defineCard({
    id: 'wd_shove', name: 'Shove', class: 'warden', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '👊',
    desc: 'Deal 4 damage. Gain 1 Block.',
    effects: [
      { op: 'damage', amount: 4, to: 'target' },
      { op: 'block', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 5 damage. Gain 2 Block.',
      effects: [
        { op: 'damage', amount: 5, to: 'target' },
        { op: 'block', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_taunting_swipe', name: 'Taunting Swipe', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🎣',
    desc: 'Deal 6 damage. Apply 1 Taunt.',
    effects: [
      { op: 'damage', amount: 6, to: 'target' },
      { op: 'apply', status: 'wd_taunt', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 8 damage. Apply 2 Taunt.',
      effects: [
        { op: 'damage', amount: 8, to: 'target' },
        { op: 'apply', status: 'wd_taunt', amount: 2, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_bark_ram', name: 'Bark Ram', class: 'warden', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🐏',
    desc: 'Deal 9 damage. Gain 4 Block.',
    effects: [
      { op: 'damage', amount: 9, to: 'target' },
      { op: 'block', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 12 damage. Gain 6 Block.',
      effects: [
        { op: 'damage', amount: 12, to: 'target' },
        { op: 'block', amount: 6, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_sprout_lunge', name: 'Sprout Lunge', class: 'warden', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '🪲',
    desc: 'Deal 3 damage. Gain 1 Growth.',
    effects: [
      { op: 'damage', amount: 3, to: 'target' },
      { op: 'apply', status: 'wd_growth', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 4 damage. Gain 2 Growth.',
      effects: [
        { op: 'damage', amount: 4, to: 'target' },
        { op: 'apply', status: 'wd_growth', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_brambled_fist', name: 'Brambled Fist', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🥊',
    desc: 'Deal 5 damage. Gain 1 Thorns.',
    effects: [
      { op: 'damage', amount: 5, to: 'target' },
      { op: 'apply', status: 'thorns', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 7 damage. Gain 2 Thorns.',
      effects: [
        { op: 'damage', amount: 7, to: 'target' },
        { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_root_crush', name: 'Root Crush', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🦶',
    desc: 'Deal 8 damage. Apply 1 Weak.',
    effects: [
      { op: 'damage', amount: 8, to: 'target' },
      { op: 'apply', status: 'weak', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 10 damage. Apply 2 Weak.',
      effects: [
        { op: 'damage', amount: 10, to: 'target' },
        { op: 'apply', status: 'weak', amount: 2, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_guarded_step', name: 'Guarded Step', class: 'warden', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '👣',
    desc: 'Gain 2 Block. Draw 1 card.',
    effects: [
      { op: 'block', amount: 2, to: 'self' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Gain 3 Block. Draw 2 cards.',
      effects: [
        { op: 'block', amount: 3, to: 'self' },
        { op: 'draw', amount: 2 }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_sap_bind', name: 'Sap Bind', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🧵',
    desc: 'Apply 2 Taunt. Gain 4 Block.',
    effects: [
      { op: 'apply', status: 'wd_taunt', amount: 2, to: 'target' },
      { op: 'block', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Apply 3 Taunt. Gain 6 Block.',
      effects: [
        { op: 'apply', status: 'wd_taunt', amount: 3, to: 'target' },
        { op: 'block', amount: 6, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_lichen_coat', name: 'Lichen Coat', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🧥',
    desc: 'Gain 3 Block. Gain 1 Regen.',
    effects: [
      { op: 'block', amount: 3, to: 'self' },
      { op: 'apply', status: 'regen', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 5 Block. Gain 2 Regen.',
      effects: [
        { op: 'block', amount: 5, to: 'self' },
        { op: 'apply', status: 'regen', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_bloodbark_ward', name: 'Bloodbark Ward', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🩸',
    desc: 'Gain 8 Block. Lose 3 HP. Cannot be played at 3 HP or less.',
    playableIf: { left: { v: 'hp' }, cmp: '>', right: 3 },
    effects: [
      { op: 'block', amount: 8, to: 'self' },
      { op: 'lose_hp', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 11 Block. Lose 3 HP. Cannot be played at 3 HP or less.',
      effects: [
        { op: 'block', amount: 11, to: 'self' },
        { op: 'lose_hp', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_thick_rind', name: 'Thick Rind', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🥥',
    desc: 'Double your Thorns. Gain 2 Block.',
    effects: [
      { op: 'multiply_status', status: 'thorns', factor: 2, to: 'self' },
      { op: 'block', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Double your Thorns. Gain 4 Block.',
      effects: [
        { op: 'multiply_status', status: 'thorns', factor: 2, to: 'self' },
        { op: 'block', amount: 4, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_power_riposte_stance', name: 'Riposte Stance', class: 'warden', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '⚔️',
    desc: 'Gain 2 Riposte: whenever an attack breaks your Block, deal 2 damage to the attacker.',
    effects: [{ op: 'apply', status: 'wd_riposte', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Riposte: whenever an attack breaks your Block, deal 3 damage to the attacker.',
      effects: [{ op: 'apply', status: 'wd_riposte', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_power_thorn_mantle', name: 'Thorn Mantle', class: 'warden', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🪸',
    desc: 'Gain 1 Thorn Mantle: whenever you first gain Block each turn, gain 1 Thorns.',
    effects: [{ op: 'apply', status: 'wd_thorn_mantle', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain 2 Thorn Mantle: whenever you first gain Block each turn, gain 2 Thorns.',
      effects: [{ op: 'apply', status: 'wd_thorn_mantle', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_power_sapwell', name: 'Sapwell', class: 'warden', type: 'power', rarity: 'common',
    cost: 2, target: 'self', icon: '🪣',
    desc: 'Gain 1 Sapwell: at the end of each of your turns, gain 1 Regen.',
    effects: [{ op: 'apply', status: 'wd_sapwell', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain 2 Sapwell: at the end of each of your turns, gain 2 Regen.',
      effects: [{ op: 'apply', status: 'wd_sapwell', amount: 2, to: 'self' }]
    }
  });

  // =====================================================================
  // UNCOMMON (17): 8 attacks, 5 skills, 4 powers
  // =====================================================================

  // ---- uncommon attacks ----
  DS.defineCard({
    id: 'wd_bulwark_bash', name: 'Bulwark Bash', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🗡️',
    desc: 'Spend all your Block. Deal 2 damage for each Block spent.',
    effects: [
      { op: 'damage', amount: { v: 'block', of: 'self', mul: 2 }, to: 'target' },
      { op: 'custom', fn: spendAllBlock }
    ],
    upgrade: {
      cost: 1,
      desc: 'Spend all your Block. Deal 2 damage for each Block spent.'
    }
  });

  DS.defineCard({
    id: 'wd_shield_breaker', name: 'Shield Breaker', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '⚒️',
    desc: 'Deal 6 damage. If the target is Taunted, deal 6 more.',
    effects: [
      { op: 'damage', amount: 6, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'wd_taunt', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 6, to: 'target' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 8 damage. If the target is Taunted, deal 8 more.',
      effects: [
        { op: 'damage', amount: 8, to: 'target' },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'wd_taunt', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 8, to: 'target' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_counter_thrust', name: 'Counter Thrust', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪃',
    desc: 'Deal 7 damage. Gain 2 Riposte.',
    effects: [
      { op: 'damage', amount: 7, to: 'target' },
      { op: 'apply', status: 'wd_riposte', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 9 damage. Gain 3 Riposte.',
      effects: [
        { op: 'damage', amount: 9, to: 'target' },
        { op: 'apply', status: 'wd_riposte', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_thorn_flail', name: 'Thorn Flail', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '🦴',
    desc: 'Deal 4 damage to ALL enemies. Gain 2 Block.',
    effects: [
      { op: 'damage', amount: 4, to: 'all_enemies' },
      { op: 'block', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 6 damage to ALL enemies. Gain 3 Block.',
      effects: [
        { op: 'damage', amount: 6, to: 'all_enemies' },
        { op: 'block', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_quickthorn_flurry', name: 'Quickthorn Flurry', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 0, target: 'enemy', icon: '✨',
    desc: 'Deal 3 damage 2 times.',
    effects: [{ op: 'damage', amount: 3, times: 2, to: 'target' }],
    upgrade: {
      desc: 'Deal 4 damage 2 times.',
      effects: [{ op: 'damage', amount: 4, times: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'wd_bloodied_lunge', name: 'Bloodied Lunge', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪚',
    desc: 'Deal 8 damage. Lose 2 HP. Cannot be played at 2 HP or less.',
    playableIf: { left: { v: 'hp' }, cmp: '>', right: 2 },
    effects: [
      { op: 'damage', amount: 8, to: 'target' },
      { op: 'lose_hp', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 11 damage. Lose 2 HP. Cannot be played at 2 HP or less.',
      effects: [
        { op: 'damage', amount: 11, to: 'target' },
        { op: 'lose_hp', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_baiting_thorn', name: 'Baiting Thorn', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🦞',
    desc: 'Deal 5 damage. Apply 2 Taunt. Gain 2 Block.',
    effects: [
      { op: 'damage', amount: 5, to: 'target' },
      { op: 'apply', status: 'wd_taunt', amount: 2, to: 'target' },
      { op: 'block', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 7 damage. Apply 3 Taunt. Gain 3 Block.',
      effects: [
        { op: 'damage', amount: 7, to: 'target' },
        { op: 'apply', status: 'wd_taunt', amount: 3, to: 'target' },
        { op: 'block', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_bulwark_strike', name: 'Bulwark Strike', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🏗️',
    desc: 'Deal 4 damage. If you have at least 10 Block, deal 8 more.',
    effects: [
      { op: 'damage', amount: 4, to: 'target' },
      {
        op: 'if',
        cond: { left: { v: 'block', of: 'self' }, cmp: '>=', right: 10 },
        then: [{ op: 'damage', amount: 8, to: 'target' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 5 damage. If you have at least 8 Block, deal 10 more.',
      effects: [
        { op: 'damage', amount: 5, to: 'target' },
        {
          op: 'if',
          cond: { left: { v: 'block', of: 'self' }, cmp: '>=', right: 8 },
          then: [{ op: 'damage', amount: 10, to: 'target' }],
          else: []
        }
      ]
    }
  });

  // ---- uncommon skills ----
  DS.defineCard({
    id: 'wd_taunting_roar', name: 'Taunting Roar', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '📣',
    desc: 'Apply 2 Taunt to ALL enemies. Gain 6 Block.',
    effects: [
      { op: 'apply', status: 'wd_taunt', amount: 2, to: 'all_enemies' },
      { op: 'block', amount: 6, to: 'self' }
    ],
    upgrade: {
      desc: 'Apply 3 Taunt to ALL enemies. Gain 8 Block.',
      effects: [
        { op: 'apply', status: 'wd_taunt', amount: 3, to: 'all_enemies' },
        { op: 'block', amount: 8, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_thornbloom', name: 'Thornbloom', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪷',
    desc: 'Gain 2 Regen. Double your Thorns.',
    effects: [
      { op: 'apply', status: 'regen', amount: 2, to: 'self' },
      { op: 'multiply_status', status: 'thorns', factor: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 3 Regen. Double your Thorns.',
      effects: [
        { op: 'apply', status: 'regen', amount: 3, to: 'self' },
        { op: 'multiply_status', status: 'thorns', factor: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_bulwark_shell', name: 'Bulwark Shell', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🐚',
    desc: 'Gain 9 Block. Gain 2 Riposte.',
    effects: [
      { op: 'block', amount: 9, to: 'self' },
      { op: 'apply', status: 'wd_riposte', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 12 Block. Gain 3 Riposte.',
      effects: [
        { op: 'block', amount: 12, to: 'self' },
        { op: 'apply', status: 'wd_riposte', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_parry_guard', name: 'Parry Guard', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🤺',
    desc: 'Gain 5 Block. Gain 1 Riposte.',
    effects: [
      { op: 'block', amount: 5, to: 'self' },
      { op: 'apply', status: 'wd_riposte', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 7 Block. Gain 2 Riposte.',
      effects: [
        { op: 'block', amount: 7, to: 'self' },
        { op: 'apply', status: 'wd_riposte', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_sentinel_snare', name: 'Sentinel Snare', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪬',
    desc: 'Apply 1 Weak and 1 Taunt. Gain 3 Block.',
    effects: [
      { op: 'apply', status: 'weak', amount: 1, to: 'target' },
      { op: 'apply', status: 'wd_taunt', amount: 1, to: 'target' },
      { op: 'block', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Apply 2 Weak and 2 Taunt. Gain 4 Block.',
      effects: [
        { op: 'apply', status: 'weak', amount: 2, to: 'target' },
        { op: 'apply', status: 'wd_taunt', amount: 2, to: 'target' },
        { op: 'block', amount: 4, to: 'self' }
      ]
    }
  });

  // ---- uncommon powers ----
  DS.defineCard({
    id: 'wd_power_sentinels_due', name: "Sentinel's Due", class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧭',
    desc: "Gain 2 Sentinel's Due: whenever you apply a debuff to an enemy, gain 2 Block.",
    effects: [{ op: 'apply', status: 'wd_sentinels_due', amount: 2, to: 'self' }],
    upgrade: {
      desc: "Gain 3 Sentinel's Due: whenever you apply a debuff to an enemy, gain 3 Block.",
      effects: [{ op: 'apply', status: 'wd_sentinels_due', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_power_sapling_tithe', name: 'Sapling Tithe', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🎍',
    desc: 'Gain Sapling Tithe: at the start of each of your turns, gain Block equal to your Growth.',
    effects: [{ op: 'apply', status: 'wd_sapling_tithe', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain Sapling Tithe and 2 Growth: at the start of each of your turns, gain Block equal to your Growth.',
      effects: [
        { op: 'apply', status: 'wd_sapling_tithe', amount: 1, to: 'self' },
        { op: 'apply', status: 'wd_growth', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_power_iron_counter', name: 'Iron Counter', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔩',
    desc: 'Gain 1 Iron Counter: whenever you are hit by an attack, deal half your remaining Block to the attacker 1 time.',
    effects: [{ op: 'apply', status: 'wd_iron_counter', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain 2 Iron Counter: whenever you are hit by an attack, deal half your remaining Block to the attacker 2 times.',
      effects: [{ op: 'apply', status: 'wd_iron_counter', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_power_rush_of_thorns', name: 'Rush of Thorns', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '💨',
    desc: 'Gain 2 Momentum: whenever you play an Attack, deal 2 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'wd_momentum', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Momentum: whenever you play an Attack, deal 3 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'wd_momentum', amount: 3, to: 'self' }]
    }
  });

  // =====================================================================
  // RARE (9): 3 attacks, 2 skills, 4 powers
  // =====================================================================

  DS.defineCard({
    id: 'wd_avalanche_bash', name: 'Avalanche Bash', class: 'warden', type: 'attack', rarity: 'rare',
    cost: 3, target: 'all_enemies', icon: '⛰️',
    desc: 'Spend all your Block. Deal 2 damage for each Block spent to ALL enemies.',
    effects: [
      { op: 'damage', amount: { v: 'block', of: 'self', mul: 2 }, to: 'all_enemies' },
      { op: 'custom', fn: spendAllBlock }
    ],
    upgrade: {
      cost: 2,
      desc: 'Spend all your Block. Deal 2 damage for each Block spent to ALL enemies.'
    }
  });

  DS.defineCard({
    id: 'wd_bloodrush', name: 'Bloodrush', class: 'warden', type: 'attack', rarity: 'rare',
    cost: 1, target: 'enemy', icon: '🐗',
    desc: 'Deal 12 damage. Lose 3 HP. Cannot be played at 3 HP or less.',
    playableIf: { left: { v: 'hp' }, cmp: '>', right: 3 },
    effects: [
      { op: 'damage', amount: 12, to: 'target' },
      { op: 'lose_hp', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 16 damage. Lose 3 HP. Cannot be played at 3 HP or less.',
      effects: [
        { op: 'damage', amount: 16, to: 'target' },
        { op: 'lose_hp', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_verdant_onslaught', name: 'Verdant Onslaught', class: 'warden', type: 'attack', rarity: 'rare',
    cost: 2, target: 'random_enemy', icon: '🧬',
    desc: 'Deal 4 damage to a random enemy 5 times. Gain 2 Growth.',
    effects: [
      { op: 'damage', amount: 4, times: 5, to: 'random_enemy' },
      { op: 'apply', status: 'wd_growth', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 5 damage to a random enemy 5 times. Gain 3 Growth.',
      effects: [
        { op: 'damage', amount: 5, times: 5, to: 'random_enemy' },
        { op: 'apply', status: 'wd_growth', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_heartbark_ward', name: 'Heartbark Ward', class: 'warden', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🏺',
    desc: 'Gain 12 Block. Double your Thorns. Heal 4 HP.',
    effects: [
      { op: 'block', amount: 12, to: 'self' },
      { op: 'multiply_status', status: 'thorns', factor: 2, to: 'self' },
      { op: 'heal', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 16 Block. Double your Thorns. Heal 6 HP.',
      effects: [
        { op: 'block', amount: 16, to: 'self' },
        { op: 'multiply_status', status: 'thorns', factor: 2, to: 'self' },
        { op: 'heal', amount: 6, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_bellow_of_the_warden', name: 'Bellow of the Warden', class: 'warden', type: 'skill', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🗣️',
    desc: 'Gain 10 Block. Apply 2 Weak and 3 Taunt to ALL enemies.',
    effects: [
      { op: 'block', amount: 10, to: 'self' },
      { op: 'apply', status: 'weak', amount: 2, to: 'all_enemies' },
      { op: 'apply', status: 'wd_taunt', amount: 3, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Gain 14 Block. Apply 3 Weak and 4 Taunt to ALL enemies.',
      effects: [
        { op: 'block', amount: 14, to: 'self' },
        { op: 'apply', status: 'weak', amount: 3, to: 'all_enemies' },
        { op: 'apply', status: 'wd_taunt', amount: 4, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_power_bulwark_colossus', name: 'Bulwark Colossus', class: 'warden', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🗼',
    desc: 'Gain 1 Iron Counter and 2 Riposte.',
    effects: [
      { op: 'apply', status: 'wd_iron_counter', amount: 1, to: 'self' },
      { op: 'apply', status: 'wd_riposte', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 2 Iron Counter and 3 Riposte.',
      effects: [
        { op: 'apply', status: 'wd_iron_counter', amount: 2, to: 'self' },
        { op: 'apply', status: 'wd_riposte', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_everbloom', name: 'Everbloom', class: 'warden', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🌼',
    desc: 'Gain 2 Sapwell: at the end of each of your turns, gain 2 Regen. Gain Sapling Tithe: at the start of each of your turns, gain Block equal to your Growth.',
    effects: [
      { op: 'apply', status: 'wd_sapwell', amount: 2, to: 'self' },
      { op: 'apply', status: 'wd_sapling_tithe', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 3 Sapwell: at the end of each of your turns, gain 3 Regen. Gain Sapling Tithe: at the start of each of your turns, gain Block equal to your Growth.',
      effects: [
        { op: 'apply', status: 'wd_sapwell', amount: 3, to: 'self' },
        { op: 'apply', status: 'wd_sapling_tithe', amount: 1, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_thornwarden_oath', name: 'Thornwarden Oath', class: 'warden', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🪄',
    desc: 'Gain 3 Thorn Mantle and 4 Thorns.',
    effects: [
      { op: 'apply', status: 'wd_thorn_mantle', amount: 3, to: 'self' },
      { op: 'apply', status: 'thorns', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 4 Thorn Mantle and 6 Thorns.',
      effects: [
        { op: 'apply', status: 'wd_thorn_mantle', amount: 4, to: 'self' },
        { op: 'apply', status: 'thorns', amount: 6, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_living_fortress', name: 'Living Fortress', class: 'warden', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🗻',
    desc: "Gain Barricade and 2 Sentinel's Due: whenever you apply a debuff to an enemy, gain 2 Block.",
    effects: [
      { op: 'apply', status: 'barricade', amount: 1, to: 'self' },
      { op: 'apply', status: 'wd_sentinels_due', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: "Gain Barricade and 3 Sentinel's Due: whenever you apply a debuff to an enemy, gain 3 Block.",
      effects: [
        { op: 'apply', status: 'barricade', amount: 1, to: 'self' },
        { op: 'apply', status: 'wd_sentinels_due', amount: 3, to: 'self' }
      ]
    }
  });

  // =====================================================================
  // Class relics (warden), one per rarity. They reward the Bulwark Bash archetype.
  // =====================================================================

  DS.defineRelic({
    id: 'wd_relic2_splintered_aegis',
    name: 'Splintered Aegis',
    desc: 'Whenever an attack breaks your Block, deal 3 damage to ALL enemies.',
    flavor: 'Every shard that flies off a broken guard still wants to hurt someone.',
    rarity: 'common',
    icon: '🔰',
    class: 'warden',
    passive: {},
    triggers: {
      onBlockBroken: { effects: [{ op: 'damage', amount: 3, to: 'all_enemies' }] }
    }
  });

  DS.defineRelic({
    id: 'wd_relic2_briar_crown',
    name: 'Briar Crown',
    desc: 'At the start of each combat, apply 2 Taunt to ALL enemies.',
    flavor: 'Worn by the first warden to hold a gate against the thornbeasts.',
    rarity: 'uncommon',
    icon: '👑',
    class: 'warden',
    passive: {},
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'wd_taunt', amount: 2, to: 'all_enemies' }]
    }
  });

  DS.defineRelic({
    id: 'wd_relic2_bastion_core',
    name: 'Bastion Core',
    desc: 'Once per turn, when an attack breaks your Block, gain 1 Energy and draw 1 card.',
    flavor: 'A seed of the old keep, still warm under the stone.',
    rarity: 'rare',
    icon: '💎',
    class: 'warden',
    passive: {},
    triggers: {
      onBlockBroken: {
        oncePerTurn: true,
        effects: [
          { op: 'energy', amount: 1 },
          { op: 'draw', amount: 1 }
        ]
      }
    }
  });
})();
