(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // Third potion set (ids prefixed pc_). Themes: delayed effects carried by custom statuses (pc_ prefix),
  // stance-like temporary statuses that change how attacks and blocks resolve, conditional branches on
  // living enemy count and HP, card generation into draw and hand, and discard / exhaust manipulation.
  // Every custom status id here is distinct from every potion id (the registries share one id check).

  // ---------------------------------------------------------------- CUSTOM STATUSES (12)

  // Delayed: at the end of the owner's current turn, deal damage to every enemy, then vanish.
  DS.defineStatus({
    id: 'pc_tail_flame', name: 'Lingering Flame', type: 'buff', icon: '♨️', stacks: true,
    desc: 'At the end of this turn, deal {n} damage to ALL enemies. Then removed.',
    triggers: {
      onTurnEnd: [
        { op: 'damage', amount: { v: 'stacks' }, to: 'all_enemies' },
        { op: 'remove_status', status: 'pc_tail_flame', to: 'self' }
      ]
    }
  });

  // Delayed: at the start of the owner's next turn, deal damage to every enemy, then vanish.
  DS.defineStatus({
    id: 'pc_omen', name: 'Looming Omen', type: 'buff', icon: '🕳️', stacks: true,
    desc: 'At the start of your next turn, deal {n} damage to ALL enemies. Then removed.',
    triggers: {
      onTurnStart: [
        { op: 'damage', amount: { v: 'stacks' }, to: 'all_enemies' },
        { op: 'remove_status', status: 'pc_omen', to: 'self' }
      ]
    }
  });

  // Delayed: at the start of the owner's next turn, lose HP (ignores block), then vanish.
  DS.defineStatus({
    id: 'pc_debt', name: "Creditor's Debt", type: 'debuff', icon: '📕', stacks: true,
    desc: 'At the start of your next turn, lose {n} HP. Then removed.',
    triggers: {
      onTurnStart: [
        { op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' },
        { op: 'remove_status', status: 'pc_debt', to: 'self' }
      ]
    }
  });

  // Delayed, enemy-facing: at the start of the enemy's next turn, it loses HP (ignores block), then vanish.
  DS.defineStatus({
    id: 'pc_delayed_cut', name: 'Festering Cut', type: 'debuff', icon: '🩸', stacks: true,
    desc: 'At the start of its next turn, it loses {n} HP. Then removed.',
    triggers: {
      onTurnStart: [
        { op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' },
        { op: 'remove_status', status: 'pc_delayed_cut', to: 'self' }
      ]
    }
  });

  // Stance: block gained from cards and potions is 50% larger for the rest of this turn.
  DS.defineStatus({
    id: 'pc_iron_stance', name: 'Ironbound', type: 'buff', icon: '🛡️', stacks: false, expire: 'turn_end',
    desc: 'Block you gain from cards and potions is increased by 50% until the end of this turn.',
    mods: { blockMul: 1.5 }
  });

  // Stance: your attacks deal 50% more damage this turn; each attack you play costs 1 HP.
  DS.defineStatus({
    id: 'pc_wrath', name: 'Wrathful', type: 'buff', icon: '🦂', stacks: false, expire: 'turn_end',
    desc: 'Your Attacks deal 50% more damage. Whenever you play an Attack, lose 1 HP. Ends at the end of this turn.',
    mods: { attackDealtMul: 1.5 },
    triggers: {
      onCardPlayed: { when: { cardType: 'attack' }, effects: [{ op: 'lose_hp', amount: 1, to: 'self' }] }
    }
  });

  // Stance: incoming attack damage is halved. Lasts through the enemy phase, so it expires at turn START.
  DS.defineStatus({
    id: 'pc_stillwater', name: 'Stillwater', type: 'buff', icon: '🌊', stacks: false, expire: 'turn_start',
    desc: 'You take 50% less attack damage. Ends at the start of your next turn.',
    mods: { attackTakenMul: 0.5 }
  });

  // Stance: every Skill played this turn grants energy equal to the stack count.
  DS.defineStatus({
    id: 'pc_focus_stance', name: 'Still Focus', type: 'buff', icon: '🧘', stacks: true, expire: 'turn_end',
    desc: 'Whenever you play a Skill, gain {n} Energy. Ends at the end of this turn.',
    triggers: {
      onCardPlayed: { when: { cardType: 'skill' }, effects: [{ op: 'energy', amount: { v: 'stacks' } }] }
    }
  });

  // Glass stance: double damage dealt by your attacks, and double attack damage taken, for this turn.
  DS.defineStatus({
    id: 'pc_glass_stance', name: 'Glass Stance', type: 'buff', icon: '🔮', stacks: false, expire: 'turn_end',
    desc: 'Attacks you play deal double damage, and Attack damage you take is doubled, until the end of this turn.',
    mods: { attackDealtMul: 2, attackTakenMul: 2 }
  });

  // Reactive, turn-scoped: whenever you lose HP, deal {n} damage to ALL enemies.
  DS.defineStatus({
    id: 'pc_martyr', name: 'Martyr', type: 'buff', icon: '🎗️', stacks: true, expire: 'turn_end',
    desc: 'Whenever you lose HP, deal {n} damage to ALL enemies. Ends at the end of this turn.',
    triggers: {
      onDamaged: [{ op: 'damage', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  // Reactive, turn-scoped: whenever you kill an enemy, heal {n} HP.
  DS.defineStatus({
    id: 'pc_bloodlust', name: 'Reaping', type: 'buff', icon: '🩸', stacks: true, expire: 'turn_end',
    desc: 'Whenever you kill an enemy, heal {n} HP. Ends at the end of this turn.',
    triggers: {
      onKill: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Reactive, turn-scoped: whenever you play a Skill, draw {n} extra cards.
  DS.defineStatus({
    id: 'pc_quickening', name: 'Quickening', type: 'buff', icon: '🌀', stacks: true, expire: 'turn_end',
    desc: 'Whenever you play a Skill, draw {n} extra cards. Ends at the end of this turn.',
    triggers: {
      onCardPlayed: { when: { cardType: 'skill' }, effects: [{ op: 'draw', amount: { v: 'stacks' } }] }
    }
  });

  // ---------------------------------------------------------------- COMMON (10)

  DS.definePotion({
    id: 'pc_smolder_oil', name: 'Smoldering Oil', rarity: 'common', icon: '🛢️', color: '#7e5109', target: 'none',
    desc: 'At the end of this turn, deal 6 damage to ALL enemies.',
    effects: [{op: 'apply', status: 'pc_tail_flame', amount: 6, to: 'self'}]
  });

  DS.definePotion({
    id: 'pc_energy_tithe', name: 'Energy Tithe', rarity: 'common', icon: '💫', color: '#f7dc6f', target: 'none',
    desc: 'Gain 1 Energy, plus 1 more for every 2 living enemies, rounded down.',
    effects: [{op: 'energy', amount: {v: 'enemies', mul: 0.5, add: 1}}]
  });

  DS.definePotion({
    id: 'pc_blade_sand', name: 'Blade Sand', rarity: 'common', icon: '⏳', color: '#b0a48a', target: 'none',
    desc: 'Shuffle 2 random Attacks into your draw pile.',
    effects: [{op: 'add_card', card: 'random', type: 'attack', to: 'draw', amount: 2}]
  });

  DS.definePotion({
    id: 'pc_cinder_recall', name: 'Cinder Recall', rarity: 'common', icon: '🧹', color: '#616a6b', target: 'none',
    desc: 'Exhaust 1 random card from your discard pile. Draw 1 card.',
    effects: [
      {op: 'exhaust', amount: 1, from: 'discard', random: true},
      {op: 'draw', amount: 1}
    ]
  });

  DS.definePotion({
    id: 'pc_ash_reckoning', name: 'Ash Reckoning', rarity: 'common', icon: '🧮', color: '#515a5a', target: 'none',
    desc: 'Draw cards equal to half the cards in your discard pile, rounded down.',
    effects: [{op: 'draw', amount: {v: 'discard_pile', mul: 0.5}}]
  });

  DS.definePotion({
    id: 'pc_crowd_ward', name: 'Crowd Ward', rarity: 'common', icon: '🔰', color: '#2e86c1', target: 'none',
    desc: 'Gain 8 Block. If 3 or more enemies are alive, draw 2 cards.',
    effects: [
      {op: 'block', amount: 8, to: 'self'},
      {
        op: 'if',
        cond: {left: {v: 'enemies'}, cmp: '>=', right: 3},
        then: [{op: 'draw', amount: 2}],
        else: []
      }
    ]
  });

  DS.definePotion({
    id: 'pc_patchwork_salve', name: 'Patchwork Salve', rarity: 'common', icon: '🩹', color: '#a04000', target: 'none',
    desc: 'Gain 4 Block. Upgrade 1 random card in your hand for this combat.',
    effects: [
      {op: 'block', amount: 4, to: 'self'},
      {op: 'upgrade_hand', amount: 1}
    ]
  });

  DS.definePotion({
    id: 'pc_witch_foresight', name: "Witch's Foresight", rarity: 'common', icon: '🔮', color: '#6c3483', target: 'none',
    desc: 'Draw 1 card. Shuffle 1 random Skill into your draw pile.',
    effects: [
      {op: 'draw', amount: 1},
      {op: 'add_card', card: 'random', type: 'skill', to: 'draw', amount: 1}
    ]
  });

  DS.definePotion({
    id: 'pc_sap_draught', name: 'Sap Draught', rarity: 'common', icon: '🌱', color: '#4d7c0f', target: 'enemy',
    desc: 'Remove all Strength from one enemy.',
    effects: [
      {op: 'apply', status: 'strength', amount: {v: 'status', status: 'strength', of: 'target', mul: -1}, to: 'target'}
    ]
  });

  DS.definePotion({
    id: 'pc_feather_draught', name: 'Feather Draught', rarity: 'common', icon: '🪶', color: '#aed6f1', target: 'none',
    desc: 'Gain 6 Block. If you have fewer than 3 cards in hand, draw 1 card.',
    effects: [
      {op: 'block', amount: 6, to: 'self'},
      {
        op: 'if',
        cond: {left: {v: 'hand'}, cmp: '<', right: 3},
        then: [{op: 'draw', amount: 1}],
        else: []
      }
    ]
  });

  // ---------------------------------------------------------------- UNCOMMON (12)

  DS.definePotion({
    id: 'pc_lone_hunter', name: 'Lone Hunter Draught', rarity: 'uncommon', icon: '🦅', color: '#7d3c98', target: 'enemy',
    desc: 'Deal 7 damage to one enemy. If it is the only enemy alive, deal 14 more.',
    effects: [
      // The enemy count is read before any damage: one living enemy means the chosen target is that enemy.
      {
        op: 'if',
        cond: {left: {v: 'enemies'}, cmp: '==', right: 1},
        then: [{op: 'damage', amount: 14, to: 'target'}],
        else: []
      },
      {op: 'damage', amount: 7, to: 'target'}
    ]
  });

  DS.definePotion({
    id: 'pc_crowd_breaker', name: 'Crowd Breaker', rarity: 'uncommon', icon: '🌪️', color: '#884ea0', target: 'all_enemies',
    desc: 'Deal 6 damage to ALL enemies. If 2 or more enemies are still alive, deal 6 more to ALL enemies.',
    effects: [
      {op: 'damage', amount: 6, to: 'all_enemies'},
      {
        op: 'if',
        cond: {left: {v: 'enemies'}, cmp: '>=', right: 2},
        then: [{op: 'damage', amount: 6, to: 'all_enemies'}],
        else: []
      }
    ]
  });

  DS.definePotion({
    id: 'pc_census_hex', name: 'Census Hex', rarity: 'uncommon', icon: '🧭', color: '#1f618d', target: 'all_enemies',
    desc: 'Apply Vulnerable to ALL enemies equal to the number of living enemies.',
    effects: [{op: 'apply', status: 'vulnerable', amount: {v: 'enemies'}, to: 'all_enemies'}]
  });

  DS.definePotion({
    id: 'pc_dire_tonic', name: 'Dire Tonic', rarity: 'uncommon', icon: '💗', color: '#c2185b', target: 'self',
    desc: 'If you have less than half your maximum HP, heal 15 HP. Otherwise, gain 5 Block.',
    effects: [
      {
        op: 'if',
        cond: {left: {v: 'hp', mul: 2}, cmp: '<', right: {v: 'max_hp'}},
        then: [{op: 'heal', amount: 15, to: 'self'}],
        else: [{op: 'block', amount: 5, to: 'self'}]
      }
    ]
  });

  DS.definePotion({
    id: 'pc_deep_cut', name: 'Deep Cut', rarity: 'uncommon', icon: '🦷', color: '#922b21', target: 'enemy',
    desc: 'Deal 6 damage to one enemy. If it then has less than half its maximum HP, deal 6 more.',
    effects: [
      {op: 'damage', amount: 6, to: 'target'},
      {
        op: 'if',
        cond: {left: {v: 'hp', of: 'target', mul: 2}, cmp: '<', right: {v: 'max_hp', of: 'target'}},
        then: [{op: 'damage', amount: 6, to: 'target'}],
        else: []
      }
    ]
  });

  DS.definePotion({
    id: 'pc_cull_draught', name: 'Cull Draught', rarity: 'uncommon', icon: '🪓', color: '#6e2c00', target: 'none',
    desc: 'Exhaust every Attack in your hand, then gain 2 Strength.',
    effects: [
      {op: 'exhaust', amount: 'all', type: 'attack'},
      {op: 'apply', status: 'strength', amount: 2, to: 'self'}
    ]
  });

  DS.definePotion({
    id: 'pc_ironbound_draught', name: 'Ironbound Draught', rarity: 'uncommon', icon: '🏔️', color: '#5d6d7e', target: 'self',
    desc: 'Until the end of this turn, Block you gain from cards and potions is increased by 50%.',
    effects: [{op: 'apply', status: 'pc_iron_stance', amount: 1, to: 'self'}]
  });

  DS.definePotion({
    id: 'pc_wrath_tonic', name: 'Wrath Tonic', rarity: 'uncommon', icon: '🦂', color: '#943126', target: 'self',
    desc: 'Until the end of this turn, your Attacks deal 50% more damage, but each Attack you play costs you 1 HP.',
    effects: [{op: 'apply', status: 'pc_wrath', amount: 1, to: 'self'}]
  });

  DS.definePotion({
    id: 'pc_stillwater_draught', name: 'Stillwater Draught', rarity: 'uncommon', icon: '🌊', color: '#2471a3', target: 'self',
    desc: 'You take 50% less attack damage until the start of your next turn.',
    effects: [{op: 'apply', status: 'pc_stillwater', amount: 1, to: 'self'}]
  });

  DS.definePotion({
    id: 'pc_omen_ink', name: 'Omen Ink', rarity: 'uncommon', icon: '🪄', color: '#4a235a', target: 'self',
    desc: 'At the start of your next turn, deal 10 damage to ALL enemies.',
    effects: [{op: 'apply', status: 'pc_omen', amount: 10, to: 'self'}]
  });

  DS.definePotion({
    id: 'pc_sundering_mark', name: 'Sundering Mark', rarity: 'uncommon', icon: '🪤', color: '#7b7d7d', target: 'enemy',
    desc: "At the start of that enemy's next turn, it loses 8 HP.",
    effects: [{op: 'apply', status: 'pc_delayed_cut', amount: 8, to: 'target'}]
  });

  DS.definePotion({
    id: 'pc_wager_of_blood', name: 'Wager of Blood', rarity: 'uncommon', icon: '🎲', color: '#78281f', target: 'none',
    desc: 'Lose 4 HP. Add a random Uncommon card to your hand.',
    effects: [
      {op: 'lose_hp', amount: 4, to: 'self'},
      {op: 'add_card', card: 'random', rarity: 'uncommon', to: 'hand', amount: 1}
    ]
  });

  // ---------------------------------------------------------------- RARE (8)

  DS.definePotion({
    id: 'pc_salt_of_ruin', name: 'Salt of Ruin', rarity: 'rare', icon: '🪦', color: '#566573', target: 'all_enemies',
    desc: 'Deal damage to ALL enemies equal to half your missing HP, rounded down.',
    effects: [{op: 'damage', amount: {v: 'missing_hp', mul: 0.5}, to: 'all_enemies'}]
  });

  DS.definePotion({
    id: 'pc_hollow_forge', name: 'Hollow Forge', rarity: 'rare', icon: '⚒️', color: '#7b241c', target: 'none',
    desc: 'Exhaust your whole hand, then draw 3 cards and gain 2 Energy.',
    effects: [
      {op: 'exhaust', amount: 'all'},
      {op: 'draw', amount: 3},
      {op: 'energy', amount: 2}
    ]
  });

  DS.definePotion({
    id: 'pc_creditors_ledger', name: "Creditor's Ledger", rarity: 'rare', icon: '📒', color: '#8e6e1e', target: 'self',
    desc: 'Gain 9 Block. At the start of your next turn, lose 6 HP.',
    effects: [
      {op: 'block', amount: 9, to: 'self'},
      {op: 'apply', status: 'pc_debt', amount: 6, to: 'self'}
    ]
  });

  DS.definePotion({
    id: 'pc_quiet_focus', name: 'Quiet Focus', rarity: 'rare', icon: '🪷', color: '#a9cce3', target: 'self',
    desc: 'Whenever you play a Skill this turn, gain 1 Energy.',
    effects: [{op: 'apply', status: 'pc_focus_stance', amount: 1, to: 'self'}]
  });

  DS.definePotion({
    id: 'pc_mirror_bulwark', name: 'Mirror Bulwark', rarity: 'rare', icon: '🏛️', color: '#bfc9ca', target: 'self',
    desc: 'Gain Block equal to your current Block. Dexterity and Frail still apply to this Block.',
    effects: [{op: 'block', amount: {v: 'block'}, to: 'self'}]
  });

  DS.definePotion({
    id: 'pc_grip_elixir', name: 'Grip Elixir', rarity: 'rare', icon: '✊', color: '#d68910', target: 'self',
    desc: 'Gain 1 Strength for every 2 cards in your hand, rounded down.',
    effects: [{op: 'apply', status: 'strength', amount: {v: 'hand', mul: 0.5}, to: 'self'}]
  });

  DS.definePotion({
    id: 'pc_seed_of_might', name: 'Seed of Might', rarity: 'rare', icon: '🌰', color: '#935116', target: 'none',
    desc: 'Add a random Power card to your hand.',
    effects: [{op: 'add_card', card: 'random', type: 'power', to: 'hand', amount: 1}]
  });

  DS.definePotion({
    id: 'pc_grave_tally', name: 'Grave Tally', rarity: 'rare', icon: '💀', color: '#212f3d', target: 'enemy',
    desc: 'Deal 10 damage to one enemy. If it dies, add a random Rare card to your hand.',
    effects: [
      {
        op: 'damage', amount: 10, to: 'target',
        onKill: [{op: 'add_card', card: 'random', rarity: 'rare', to: 'hand', amount: 1}]
      }
    ]
  });

})();
