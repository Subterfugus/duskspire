(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // Second potion set (ids prefixed pb_). Novel effects only: each one is built from the
  // effect DSL and most lean on Value sources (enemies, hand, status) or conditional ops.
  // This file also defines one status of its own, pb_barbed, used by Barbed Hex.

  DS.defineStatus({
    id: 'pb_barbed', name: 'Barbed', type: 'debuff', icon: '🪝', stacks: true, decay: 'turn_end',
    desc: 'Whenever this unit lands an attack, it loses HP equal to its {n} stacks of Barbed. Loses 1 stack each turn.',
    triggers: {
      onAttack: [{ op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // ---------------------------------------------------------------- COMMON (10)

  DS.definePotion({
    id: 'pb_bastion', name: 'Bastion Draught', rarity: 'common', icon: '🏯', color: '#4a6fa5', target: 'none',
    desc: 'Gain 4 Block for each living enemy.',
    effects: [{op: 'block', amount: {v: 'enemies', mul: 4}, to: 'self'}]
  });

  DS.definePotion({
    id: 'pb_gutting', name: 'Gutting Draught', rarity: 'common', icon: '🔪', color: '#922b21', target: 'enemy',
    desc: 'Deal 6 damage to one enemy. If it is Vulnerable, draw 1 card.',
    effects: [
      {op: 'damage', amount: 6, to: 'target'},
      {
        op: 'if',
        cond: {left: {v: 'status', status: 'vulnerable', of: 'target'}, cmp: '>', right: 0},
        then: [{op: 'draw', amount: 1}],
        else: []
      }
    ]
  });

  DS.definePotion({
    id: 'pb_cinder_rain', name: 'Cinder Rain', rarity: 'common', icon: '☄️', color: '#d35400', target: 'all_enemies',
    desc: 'Apply 2 Burn to ALL enemies.',
    effects: [{op: 'apply', status: 'burn', amount: 2, to: 'all_enemies'}]
  });

  DS.definePotion({
    id: 'pb_reaper_vial', name: "Reaper's Vial", rarity: 'common', icon: '⚰️', color: '#4a235a', target: 'none',
    desc: 'Deal 9 damage to a random enemy. If it dies, gain 8 Block and draw 1 card.',
    effects: [
      {
        op: 'damage', amount: 9, to: 'random_enemy',
        onKill: [{op: 'block', amount: 8, to: 'self'}, {op: 'draw', amount: 1}]
      }
    ]
  });

  DS.definePotion({
    id: 'pb_overclock', name: 'Overclock Tonic', rarity: 'common', icon: '⏱️', color: '#f5b041', target: 'none',
    desc: 'Draw 2 cards. Gain 1 Energy at the start of your next turn.',
    effects: [
      {op: 'draw', amount: 2},
      {op: 'apply', status: 'energized', amount: 1, to: 'self'}
    ]
  });

  DS.definePotion({
    id: 'pb_mirror_bark', name: 'Mirror Bark Tea', rarity: 'common', icon: '🪵', color: '#6e2c00', target: 'self',
    desc: 'Gain Thorns equal to half the cards in your hand, rounded down.',
    effects: [{op: 'apply', status: 'thorns', amount: {v: 'hand', mul: 0.5}, to: 'self'}]
  });

  DS.definePotion({
    id: 'pb_ashen_shard', name: 'Ashen Shard', rarity: 'common', icon: '⚗️', color: '#616a6b', target: 'none',
    desc: 'Exhaust 1 random card from your draw pile. Gain 5 Block.',
    effects: [
      {op: 'exhaust', amount: 1, from: 'draw', random: true},
      {op: 'block', amount: 5, to: 'self'}
    ]
  });

  DS.definePotion({
    id: 'pb_quickfire', name: 'Quickfire Flask', rarity: 'common', icon: '🏹', color: '#b7950b', target: 'none',
    desc: 'Deal 4 damage to a random enemy, twice.',
    effects: [{op: 'damage', amount: 4, times: 2, to: 'random_enemy'}]
  });

  DS.definePotion({
    id: 'pb_grave_salt', name: 'Grave Salt', rarity: 'common', icon: '🧂', color: '#aab7b8', target: 'none',
    desc: 'Gain 5 Block. Exhaust 1 card from your hand.',
    effects: [
      {op: 'block', amount: 5, to: 'self'},
      {op: 'exhaust', amount: 1}
    ]
  });

  DS.definePotion({
    id: 'pb_tallow_light', name: 'Tallow Light', rarity: 'common', icon: '🕯️', color: '#f9e79f', target: 'none',
    desc: 'Gain 1 Energy and draw 1 card. Lose 2 HP.',
    effects: [
      {op: 'energy', amount: 1},
      {op: 'draw', amount: 1},
      {op: 'lose_hp', amount: 2, to: 'self'}
    ]
  });

  // ---------------------------------------------------------------- UNCOMMON (9)

  DS.definePotion({
    id: 'pb_echo', name: 'Echo Draught', rarity: 'uncommon', icon: '🪞', color: '#c39bd3', target: 'self',
    desc: 'Double your Strength.',
    effects: [{op: 'multiply_status', status: 'strength', factor: 2, to: 'self'}]
  });

  DS.definePotion({
    id: 'pb_barbed_hex', name: 'Barbed Hex', rarity: 'uncommon', icon: '🪝', color: '#4d5656', target: 'enemy',
    desc: 'Give one enemy 2 Barbed. Whenever it lands an attack, it loses HP equal to its Barbed stacks. Barbed fades 1 per turn.',
    effects: [{op: 'apply', status: 'pb_barbed', amount: 2, to: 'target'}]
  });

  DS.definePotion({
    id: 'pb_summoners_bane', name: "Summoner's Bane", rarity: 'uncommon', icon: '🧿', color: '#2874a6', target: 'all_enemies',
    desc: 'Apply 2 Weak and 2 Vulnerable to ALL enemies.',
    effects: [
      {op: 'apply', status: 'weak', amount: 2, to: 'all_enemies'},
      {op: 'apply', status: 'vulnerable', amount: 2, to: 'all_enemies'}
    ]
  });

  DS.definePotion({
    id: 'pb_bloodbond', name: 'Bloodbond Draught', rarity: 'uncommon', icon: '⚔️', color: '#a93226', target: 'self',
    desc: 'Lose 3 HP. Your next Attack deals 8 more damage.',
    effects: [
      {op: 'lose_hp', amount: 3, to: 'self'},
      {op: 'apply', status: 'vigor', amount: 8, to: 'self'}
    ]
  });

  DS.definePotion({
    id: 'pb_rage_brew', name: 'Rage Brew', rarity: 'uncommon', icon: '😤', color: '#cb4335', target: 'self',
    desc: 'Gain 4 Rage. Each Attack you play this turn grants 4 Block.',
    effects: [{op: 'apply', status: 'rage', amount: 4, to: 'self'}]
  });

  DS.definePotion({
    id: 'pb_sieve_draught', name: 'Sieve Draught', rarity: 'uncommon', icon: '🗂️', color: '#5b2c6f', target: 'none',
    desc: 'Draw 3 cards, then discard 1 card of your choice.',
    effects: [
      {op: 'draw', amount: 3},
      {op: 'discard', amount: 1}
    ]
  });

  DS.definePotion({
    id: 'pb_blood_bomb', name: 'Blood Bomb', rarity: 'uncommon', icon: '💥', color: '#7b241c', target: 'all_enemies',
    desc: 'Deal 6 damage to ALL enemies. Lose 3 HP.',
    effects: [
      {op: 'damage', amount: 6, to: 'all_enemies'},
      {op: 'lose_hp', amount: 3, to: 'self'}
    ]
  });

  DS.definePotion({
    id: 'pb_cursed_bargain', name: 'Cursed Bargain', rarity: 'uncommon', icon: '🖤', color: '#2c3e50', target: 'none',
    desc: 'Gain 3 Strength. Add Regret, a Curse, to your discard pile.',
    effects: [
      {op: 'apply', status: 'strength', amount: 3, to: 'self'},
      {op: 'add_card', card: 'curse_regret', to: 'discard', amount: 1}
    ]
  });

  DS.definePotion({
    id: 'pb_barricade_glass', name: 'Barricade Glass', rarity: 'uncommon', icon: '🧱', color: '#935116', target: 'self',
    desc: 'Gain Barricade. Your Block is not removed at the start of your turn.',
    effects: [{op: 'apply', status: 'barricade', amount: 1, to: 'self'}]
  });

  // ---------------------------------------------------------------- RARE (6)

  DS.definePotion({
    id: 'pb_gilded_scroll', name: 'Gilded Scroll', rarity: 'rare', icon: '📜', color: '#d4ac0d', target: 'none',
    desc: 'Add a random upgraded Rare card to your hand.',
    effects: [{op: 'add_card', card: 'random', rarity: 'rare', upgraded: true, to: 'hand', amount: 1}]
  });

  DS.definePotion({
    id: 'pb_eclipse', name: 'Eclipse Vial', rarity: 'rare', icon: '🌑', color: '#1c2833', target: 'enemy',
    desc: 'Double the Weak and Vulnerable stacks of one enemy.',
    effects: [
      {op: 'multiply_status', status: 'weak', factor: 2, to: 'target'},
      {op: 'multiply_status', status: 'vulnerable', factor: 2, to: 'target'}
    ]
  });

  DS.definePotion({
    id: 'pb_undying_ash', name: 'Undying Ash', rarity: 'rare', icon: '🪽', color: '#aab7b8', target: 'self',
    desc: 'Gain 3 Buffer. Gain 6 Block.',
    effects: [
      {op: 'apply', status: 'buffer', amount: 3, to: 'self'},
      {op: 'block', amount: 6, to: 'self'}
    ]
  });

  DS.definePotion({
    id: 'pb_crown_of_ash', name: 'Crown of Ash', rarity: 'rare', icon: '👑', color: '#6e2c00', target: 'all_enemies',
    desc: 'Apply 3 Burn and 2 Weak to ALL enemies.',
    effects: [
      {op: 'apply', status: 'burn', amount: 3, to: 'all_enemies'},
      {op: 'apply', status: 'weak', amount: 2, to: 'all_enemies'}
    ]
  });

  DS.definePotion({
    id: 'pb_soul_siphon', name: 'Soul Siphon', rarity: 'rare', icon: '🫀', color: '#922b21', target: 'enemy',
    desc: 'Deal 12 damage to one enemy. Heal 6 HP.',
    effects: [
      {op: 'damage', amount: 12, to: 'target'},
      {op: 'heal', amount: 6, to: 'self'}
    ]
  });

  DS.definePotion({
    id: 'pb_hollow_ward', name: 'Hollow Ward', rarity: 'rare', icon: '🫙', color: '#5d6d7e', target: 'none',
    desc: 'Discard your whole hand. Gain 12 Block.',
    effects: [
      {op: 'discard', amount: 'all'},
      {op: 'block', amount: 12, to: 'self'}
    ]
  });

})();
