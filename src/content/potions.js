(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------- COMMON (18)

  DS.definePotion({
    id: 'po_fire', name: 'Fire Potion', rarity: 'common', icon: '🔥', color: '#e8602c', target: 'enemy',
    desc: 'Deal 20 damage to one enemy.',
    effects: [{op: 'damage', amount: 20, to: 'target'}]
  });

  DS.definePotion({
    id: 'po_bomb', name: 'Bomb Flask', rarity: 'common', icon: '💣', color: '#ff8c1a', target: 'all_enemies',
    desc: 'Deal 8 damage to ALL enemies.',
    effects: [{op: 'damage', amount: 8, to: 'all_enemies'}]
  });

  DS.definePotion({
    id: 'po_iron_draught', name: 'Iron Draught', rarity: 'common', icon: '🛡️', color: '#9aa5b1', target: 'self',
    desc: 'Gain 12 Block.',
    effects: [{op: 'block', amount: 12, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_might', name: 'Potion of Might', rarity: 'common', icon: '💪', color: '#d35400', target: 'self',
    desc: 'Gain 2 Strength.',
    effects: [{op: 'apply', status: 'strength', amount: 2, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_agility', name: 'Agility Tonic', rarity: 'common', icon: '🌿', color: '#27ae60', target: 'self',
    desc: 'Gain 2 Dexterity.',
    effects: [{op: 'apply', status: 'dexterity', amount: 2, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_swiftness', name: 'Swiftness Elixir', rarity: 'common', icon: '⚡', color: '#f4d03f', target: 'none',
    desc: 'Gain 2 Energy.',
    effects: [{op: 'energy', amount: 2}]
  });

  DS.definePotion({
    id: 'po_sight', name: 'Draught of Sight', rarity: 'common', icon: '👁️', color: '#3498db', target: 'none',
    desc: 'Draw 3 cards.',
    effects: [{op: 'draw', amount: 3}]
  });

  DS.definePotion({
    id: 'po_weak_mist', name: 'Weakening Mist', rarity: 'common', icon: '💨', color: '#8e9aa6', target: 'all_enemies',
    desc: 'Apply 3 Weak to ALL enemies.',
    effects: [{op: 'apply', status: 'weak', amount: 3, to: 'all_enemies'}]
  });

  DS.definePotion({
    id: 'po_venom', name: 'Venom Flask', rarity: 'common', icon: '🧪', color: '#6ab04c', target: 'enemy',
    desc: 'Apply 6 Poison to one enemy.',
    effects: [{op: 'apply', status: 'poison', amount: 6, to: 'target'}]
  });

  DS.definePotion({
    id: 'po_brittle', name: 'Brittle Powder', rarity: 'common', icon: '✨', color: '#bdc3c7', target: 'enemy',
    desc: 'Apply 2 Vulnerable to one enemy.',
    effects: [{op: 'apply', status: 'vulnerable', amount: 2, to: 'target'}]
  });

  DS.definePotion({
    id: 'po_healing', name: 'Healing Draught', rarity: 'common', icon: '❤️', color: '#e74c3c', target: 'self',
    desc: 'Heal 15 HP.',
    effects: [{op: 'heal', amount: 15, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_ember', name: 'Ember Flask', rarity: 'common', icon: '🌋', color: '#c0392b', target: 'enemy',
    desc: 'Apply 4 Burn to one enemy.',
    effects: [{op: 'apply', status: 'burn', amount: 4, to: 'target'}]
  });

  DS.definePotion({
    id: 'po_bramble', name: 'Bramble Tonic', rarity: 'common', icon: '🌵', color: '#2e8b57', target: 'self',
    desc: 'Gain 3 Thorns.',
    effects: [{op: 'apply', status: 'thorns', amount: 3, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_verdant', name: 'Verdant Brew', rarity: 'common', icon: '🍃', color: '#58d68d', target: 'self',
    desc: 'Gain 4 Regen.',
    effects: [{op: 'apply', status: 'regen', amount: 4, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_bulwark', name: 'Bulwark Salve', rarity: 'common', icon: '🧴', color: '#5dade2', target: 'self',
    desc: 'Gain 6 Block at the start of your next turn.',
    effects: [{op: 'apply', status: 'next_turn_block', amount: 6, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_glitter', name: 'Glittering Dust', rarity: 'common', icon: '🪙', color: '#f5b041', target: 'none',
    desc: 'Gain 25 gold.',
    effects: [{op: 'gold', amount: 25}]
  });

  DS.definePotion({
    id: 'po_clear_mind', name: 'Clear Mind', rarity: 'common', icon: '🧠', color: '#d7bde2', target: 'self',
    desc: 'Remove Weak, Vulnerable and Frail from yourself.',
    effects: [
      {op: 'remove_status', status: 'weak', to: 'self'},
      {op: 'remove_status', status: 'vulnerable', to: 'self'},
      {op: 'remove_status', status: 'frail', to: 'self'}
    ]
  });

  DS.definePotion({
    id: 'po_ink', name: "Scribe's Ink", rarity: 'common', icon: '🖋️', color: '#8e44ad', target: 'none',
    desc: 'Add a random Attack to your hand.',
    effects: [{op: 'add_card', card: 'random', type: 'attack', to: 'hand', amount: 1}]
  });

  // ---------------------------------------------------------------- UNCOMMON (14)

  DS.definePotion({
    id: 'po_berserk', name: "Berserker's Brew", rarity: 'uncommon', icon: '🍺', color: '#c0392b', target: 'self',
    desc: 'Gain 4 Strength this turn.',
    effects: [
      {op: 'apply', status: 'strength', amount: 4, to: 'self'},
      {op: 'apply', status: 'strength_down', amount: 4, to: 'self'}
    ]
  });

  DS.definePotion({
    id: 'po_stoneskin', name: 'Stoneskin Draught', rarity: 'uncommon', icon: '🪨', color: '#7f8c8d', target: 'self',
    desc: 'Gain 4 Dexterity this turn.',
    effects: [
      {op: 'apply', status: 'dexterity', amount: 4, to: 'self'},
      {op: 'apply', status: 'dexterity_down', amount: 4, to: 'self'}
    ]
  });

  DS.definePotion({
    id: 'po_ghost', name: 'Ghost Vial', rarity: 'uncommon', icon: '👻', color: '#d6eaf8', target: 'self',
    desc: 'Gain 1 Intangible.',
    effects: [{op: 'apply', status: 'intangible', amount: 1, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_shard', name: 'Artifact Shard', rarity: 'uncommon', icon: '🔷', color: '#5499c6', target: 'self',
    desc: 'Gain 2 Artifact.',
    effects: [{op: 'apply', status: 'artifact', amount: 2, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_plated', name: 'Plated Tincture', rarity: 'uncommon', icon: '⚙️', color: '#95a5a6', target: 'self',
    desc: 'Gain 3 Plated Armor.',
    effects: [{op: 'apply', status: 'plated_armor', amount: 3, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_bubble', name: 'Bubble Flask', rarity: 'uncommon', icon: '🫧', color: '#aed6f1', target: 'self',
    desc: 'Gain 1 Buffer.',
    effects: [{op: 'apply', status: 'buffer', amount: 1, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_twinflame', name: 'Twinflame Tonic', rarity: 'uncommon', icon: '🎭', color: '#af7ac5', target: 'self',
    desc: 'Your next 2 Attacks are played twice.',
    effects: [{op: 'apply', status: 'double_tap', amount: 2, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_dreamer', name: "Dreamer's Nectar", rarity: 'uncommon', icon: '🌙', color: '#5d6d7e', target: 'self',
    desc: 'Draw 2 extra cards at the start of your next turn.',
    effects: [{op: 'apply', status: 'draw_next', amount: 2, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_battery', name: 'Battery Cordial', rarity: 'uncommon', icon: '🔋', color: '#f7dc6f', target: 'self',
    desc: 'Gain 2 Energy at the start of your next turn.',
    effects: [{op: 'apply', status: 'energized', amount: 2, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_forge', name: 'Forge Oil', rarity: 'uncommon', icon: '🔨', color: '#b9770e', target: 'none',
    desc: 'Upgrade every card in your hand for this combat.',
    effects: [{op: 'upgrade_hand', amount: 'all'}]
  });

  DS.definePotion({
    id: 'po_ashen', name: 'Ashen Draught', rarity: 'uncommon', icon: '⚱️', color: '#5d4037', target: 'none',
    desc: 'Exhaust 2 cards from your hand. Draw 2 cards.',
    effects: [{op: 'exhaust', amount: 2}, {op: 'draw', amount: 2}]
  });

  DS.definePotion({
    id: 'po_rummage', name: "Rummager's Draught", rarity: 'uncommon', icon: '🎲', color: '#7d6608', target: 'none',
    desc: 'Discard 3 cards, then draw 3 cards.',
    effects: [{op: 'discard', amount: 3}, {op: 'draw', amount: 3}]
  });

  DS.definePotion({
    id: 'po_gambit', name: "Alchemist's Gambit", rarity: 'uncommon', icon: '🎴', color: '#1abc9c', target: 'none',
    desc: 'Add 2 random Skills to your hand.',
    effects: [{op: 'add_card', card: 'random', type: 'skill', to: 'hand', amount: 2}]
  });

  DS.definePotion({
    id: 'po_sunder', name: 'Sunder Flask', rarity: 'uncommon', icon: '🗡️', color: '#7b8a99', target: 'enemy',
    desc: 'Deal damage equal to your Block to one enemy.',
    effects: [{op: 'damage', amount: {v: 'block', of: 'self'}, to: 'target'}]
  });

  // ---------------------------------------------------------------- RARE (8)

  DS.definePotion({
    id: 'po_fruit_juice', name: 'Vitality Fruit Juice', rarity: 'rare', icon: '🍹', color: '#ff6f91', target: 'self',
    desc: 'Gain 5 Max HP.',
    effects: [{op: 'max_hp', amount: 5}]
  });

  DS.definePotion({
    id: 'po_toxin', name: 'Toxin Concentrate', rarity: 'rare', icon: '☠️', color: '#76448a', target: 'enemy',
    desc: 'Apply 4 Poison to one enemy, then double its Poison.',
    effects: [
      {op: 'apply', status: 'poison', amount: 4, to: 'target'},
      {op: 'multiply_status', status: 'poison', factor: 2, to: 'target'}
    ]
  });

  DS.definePotion({
    id: 'po_blood_vial', name: 'Blood Vial', rarity: 'rare', icon: '🩸', color: '#8b0000', target: 'self',
    desc: 'Lose 6 HP. Gain 4 Strength.',
    effects: [
      {op: 'lose_hp', amount: 6, to: 'self'},
      {op: 'apply', status: 'strength', amount: 4, to: 'self'}
    ]
  });

  DS.definePotion({
    id: 'po_iron_wall', name: 'Iron Wall Elixir', rarity: 'rare', icon: '🏰', color: '#566573', target: 'self',
    desc: 'Gain 3 Block for each card in your hand.',
    effects: [{op: 'block', amount: {v: 'hand', mul: 3}, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_phoenix', name: 'Phoenix Tear', rarity: 'rare', icon: '🌅', color: '#f39c12', target: 'self',
    desc: 'Gain 6 Regen.',
    effects: [{op: 'apply', status: 'regen', amount: 6, to: 'self'}]
  });

  DS.definePotion({
    id: 'po_plague', name: 'Plague Cloud', rarity: 'rare', icon: '🦠', color: '#7dcea0', target: 'all_enemies',
    desc: 'Apply 8 Poison to ALL enemies.',
    effects: [{op: 'apply', status: 'poison', amount: 8, to: 'all_enemies'}]
  });

  DS.definePotion({
    id: 'po_dragonfire', name: 'Dragonfire Flask', rarity: 'rare', icon: '🐉', color: '#e67e22', target: 'all_enemies',
    desc: 'Deal 16 damage to ALL enemies.',
    effects: [{op: 'damage', amount: 16, to: 'all_enemies'}]
  });

  DS.definePotion({
    id: 'po_hourglass', name: 'Hourglass Sand', rarity: 'rare', icon: '⌛', color: '#d4ac0d', target: 'none',
    desc: 'Gain 2 Energy. Draw 3 extra cards at the start of your next turn.',
    effects: [
      {op: 'energy', amount: 2},
      {op: 'apply', status: 'draw_next', amount: 3, to: 'self'}
    ]
  });

})();
