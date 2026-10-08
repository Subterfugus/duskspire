(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // =====================================================================
  // relics_a.js — common and uncommon relics (prefix ra_)
  // =====================================================================

  // ----------------------------- COMMON -------------------------------

  DS.defineRelic({
    id: 'ra_rusty_buckle',
    name: 'Rusty Buckle',
    rarity: 'common',
    icon: '🔗',
    desc: 'At the start of each combat, gain 3 Block.',
    flavor: 'It has held nothing together for years, and it still insists on trying.',
    triggers: {
      onCombatStart: [{ op: 'block', amount: 3 }],
    },
  });

  DS.defineRelic({
    id: 'ra_bent_nail',
    name: 'Bent Nail',
    rarity: 'common',
    icon: '🔩',
    desc: 'On the first turn of each combat, gain 1 Strength. Lose it at the end of that turn.',
    flavor: 'Crooked, but a crooked nail still drives into something.',
    triggers: {
      onTurnStart: { when: { turn: 1 }, effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] },
      onTurnEnd: { when: { turn: 1 }, effects: [{ op: 'apply', status: 'strength', amount: -1, to: 'self' }] },
    },
  });

  DS.defineRelic({
    id: 'ra_chipped_mug',
    name: 'Chipped Mug',
    rarity: 'common',
    icon: '☕',
    desc: 'After winning a fight, heal 2 HP.',
    flavor: 'Still warm, somehow, after three campaigns in the field.',
    triggers: {
      onCombatEnd: [{ op: 'heal', amount: 2 }],
    },
  });

  DS.defineRelic({
    id: 'ra_trail_rations',
    name: 'Trail Rations',
    rarity: 'common',
    icon: '🍲',
    desc: 'When you pick this up, gain 5 Max HP.',
    flavor: 'Salted, dried, and somehow nourishing enough to make you grow.',
    triggers: {
      onPickup: [{ op: 'max_hp', amount: 5 }],
    },
  });

  DS.defineRelic({
    id: 'ra_pilgrims_coin',
    name: "Pilgrim's Coin",
    rarity: 'common',
    icon: '🪙',
    desc: 'Gain 2 Gold whenever you enter a room.',
    flavor: 'Every road has a toll, and every toll has a little change.',
    triggers: {
      onRoomEnter: [{ op: 'gold', amount: 2 }],
    },
  });

  DS.defineRelic({
    id: 'ra_sharpening_pebble',
    name: 'Sharpening Pebble',
    rarity: 'common',
    icon: '🪨',
    desc: 'At the start of each combat, your next Attack deals 4 extra damage.',
    flavor: 'Rub it against the blade and wait for the blade to remember.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'vigor', amount: 4, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'ra_knotted_cord',
    name: 'Knotted Cord',
    rarity: 'common',
    icon: '🧶',
    desc: 'Every 3rd card you play draws 1 card.',
    flavor: 'One knot for every idea you almost had.',
    triggers: {
      onCardPlayed: { every: 3, effects: [{ op: 'draw', amount: 1 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_cracked_hourglass',
    name: 'Cracked Hourglass',
    rarity: 'common',
    icon: '⌛',
    desc: 'Every 4th card you play gives 1 Energy.',
    flavor: 'The sand leaks through the crack, but it leaks in your favour.',
    triggers: {
      onCardPlayed: { every: 4, effects: [{ op: 'energy', amount: 1 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_vulture_feather',
    name: 'Vulture Feather',
    rarity: 'common',
    icon: '🪶',
    desc: 'Whenever an enemy dies, heal 2 HP.',
    flavor: 'The carrion birds circle, and they leave something useful behind.',
    triggers: {
      onEnemyDeath: [{ op: 'heal', amount: 2 }],
    },
  });

  DS.defineRelic({
    id: 'ra_bristle_bark',
    name: 'Bristle Bark',
    rarity: 'common',
    icon: '🌵',
    desc: 'At the start of each combat, gain 2 Thorns.',
    flavor: 'Touch it once and you will not touch it twice.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'thorns', amount: 2, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'ra_lantern_wick',
    name: 'Lantern Wick',
    rarity: 'common',
    icon: '🏮',
    desc: 'On the first turn of each combat, draw 1 extra card.',
    flavor: 'It burns brightest in the first hour of a fight.',
    triggers: {
      onTurnStart: { when: { turn: 1 }, effects: [{ op: 'draw', amount: 1 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_travelers_blanket',
    name: "Traveler's Blanket",
    rarity: 'common',
    icon: '🧣',
    desc: 'Whenever you rest, heal 4 HP more.',
    flavor: 'Patched in six different colours, each from a different inn.',
    triggers: {
      onRest: [{ op: 'heal', amount: 4 }],
    },
  });

  DS.defineRelic({
    id: 'ra_tin_compass',
    name: 'Tin Compass',
    rarity: 'common',
    icon: '🧭',
    desc: 'Heal 4 HP whenever you enter an elite room.',
    flavor: 'It points at trouble, and then, reluctantly, at the nearest cot.',
    triggers: {
      onRoomEnter: { when: { roomType: 'elite' }, effects: [{ op: 'heal', amount: 4 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_lucky_rabbits_foot',
    name: "Lucky Rabbit's Foot",
    rarity: 'common',
    icon: '🐇',
    desc: 'Every 3rd time you gain Gold, heal 3 HP.',
    flavor: 'Lucky for the rabbit, at least. Less so for the rabbit.',
    triggers: {
      onGoldGained: { every: 3, effects: [{ op: 'heal', amount: 3 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_hunters_notch',
    name: "Hunter's Notch",
    rarity: 'common',
    icon: '🏹',
    desc: 'Whenever you kill an enemy, draw 1 card.',
    flavor: 'Every fallen beast is a notch, and every notch is a lesson.',
    triggers: {
      onKill: [{ op: 'draw', amount: 1 }],
    },
  });

  DS.defineRelic({
    id: 'ra_spare_candle',
    name: 'Spare Candle',
    rarity: 'common',
    icon: '🕯️',
    desc: 'On the first turn of each combat, gain 1 Energy.',
    flavor: 'Light it before the fight and you will see the fight coming.',
    triggers: {
      onTurnStart: { when: { turn: 1 }, effects: [{ op: 'energy', amount: 1 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_barnacled_shell',
    name: 'Barnacled Shell',
    rarity: 'common',
    icon: '🐚',
    desc: 'Whenever you are attacked, gain 1 Block.',
    flavor: 'Gathered from the tide line. The barnacles bite back, a little.',
    triggers: {
      onAttacked: [{ op: 'block', amount: 1 }],
    },
  });

  DS.defineRelic({
    id: 'ra_cinder_tile',
    name: 'Cinder Tile',
    rarity: 'common',
    icon: '🧱',
    desc: 'Whenever a card is Exhausted, gain 2 Block.',
    flavor: 'Warm from the forge, and a little fragile, like everything that burns.',
    triggers: {
      onCardExhausted: [{ op: 'block', amount: 2 }],
    },
  });

  DS.defineRelic({
    id: 'ra_pressed_flower',
    name: 'Pressed Flower',
    rarity: 'common',
    icon: '🌼',
    desc: 'Whenever an effect makes you discard a card, heal 1 HP.',
    flavor: 'Kept in a book for a hundred years, and still it remembers the sun.',
    triggers: {
      onCardDiscarded: [{ op: 'heal', amount: 1 }],
    },
  });

  DS.defineRelic({
    id: 'ra_wooden_idol',
    name: 'Wooden Idol',
    rarity: 'common',
    icon: '🗿',
    desc: 'Whenever your draw pile is shuffled, gain 2 Block.',
    flavor: 'It has no face, which is why it can see everything.',
    triggers: {
      onShuffle: [{ op: 'block', amount: 2 }],
    },
  });

  DS.defineRelic({
    id: 'ra_bandage_roll',
    name: 'Bandage Roll',
    rarity: 'common',
    icon: '🩹',
    desc: 'At the end of each turn, while you have less than half your HP, heal 2 HP.',
    flavor: 'Wrap it tight, wrap it often, and do not look at the stains.',
    triggers: {
      onTurnEnd: { when: { hpBelowPct: 50 }, effects: [{ op: 'heal', amount: 2 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_tin_funnel',
    name: 'Tin Funnel',
    rarity: 'common',
    icon: '⚗️',
    desc: 'Whenever you use a Potion, gain 3 Block.',
    flavor: 'Nothing is ever wasted by a good alchemist. Least of all the spills.',
    triggers: {
      onPotionUsed: [{ op: 'block', amount: 3 }],
    },
  });

  DS.defineRelic({
    id: 'ra_brass_ward',
    name: 'Brass Ward',
    rarity: 'common',
    icon: '🔔',
    desc: 'At the start of each combat, gain 1 Artifact.',
    flavor: 'Ring it once for luck, and again for the curse that failed to land.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'artifact', amount: 1, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'ra_pawn_ticket',
    name: 'Pawn Ticket',
    rarity: 'common',
    icon: '🎫',
    desc: 'Whenever you enter a shop, gain 8 Gold.',
    flavor: 'Someone else\'s heirloom, now your rent money.',
    triggers: {
      onShopEnter: [{ op: 'gold', amount: 8 }],
    },
  });

  // Class-specific commons

  DS.defineRelic({
    id: 'ra_warpaint_sash',
    name: 'Warpaint Sash',
    rarity: 'common',
    class: 'berserker',
    icon: '🎌',
    desc: 'At the start of each combat, lose 3 HP and gain 1 Strength.',
    flavor: 'Paint your skin, bleed a little, and swing harder for it.',
    triggers: {
      onCombatStart: [
        { op: 'lose_hp', amount: 3, to: 'self' },
        { op: 'apply', status: 'strength', amount: 1, to: 'self' },
      ],
    },
  });

  DS.defineRelic({
    id: 'ra_venom_vial',
    name: 'Venom Vial',
    rarity: 'common',
    class: 'shade',
    icon: '🧪',
    desc: 'At the start of each combat, apply 3 Poison to a random enemy.',
    flavor: 'Do not shake it. Do not lick it. Do not wonder what it is for.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'poison', amount: 3, to: 'random_enemy' }],
    },
  });

  DS.defineRelic({
    id: 'ra_ember_inkwell',
    name: 'Ember Inkwell',
    rarity: 'common',
    class: 'arcanist',
    icon: '🖋️',
    desc: 'Whenever you play a Skill, apply 1 Burn to a random enemy.',
    flavor: 'Every spell is a sentence, and every sentence has a little fire in it.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'apply', status: 'burn', amount: 1, to: 'random_enemy' }],
      },
    },
  });

  DS.defineRelic({
    id: 'ra_mossy_pauldron',
    name: 'Mossy Pauldron',
    rarity: 'common',
    class: 'warden',
    icon: '🌿',
    desc: 'At the start of each combat, gain 2 Regen.',
    flavor: 'Grown over a decade of standing still in the rain.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'regen', amount: 2, to: 'self' }],
    },
  });

  // ----------------------------- UNCOMMON -----------------------------

  DS.defineRelic({
    id: 'ra_war_drum',
    name: 'War Drum',
    rarity: 'uncommon',
    icon: '🥁',
    desc: 'At the start of each combat, gain 2 Strength.',
    flavor: 'Every beat carries you one step closer to the front line.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'ra_iron_kettle',
    name: 'Iron Kettle',
    rarity: 'uncommon',
    icon: '🫖',
    desc: 'Every 5th card you play gains 6 Block.',
    flavor: 'It simmers with a stock that nobody remembers adding.',
    triggers: {
      onCardPlayed: { every: 5, effects: [{ op: 'block', amount: 6 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_mirror_shard',
    name: 'Mirror Shard',
    rarity: 'uncommon',
    icon: '🪞',
    desc: 'The first time each turn an enemy attacks you, it takes 3 damage.',
    flavor: 'It shows the attacker their own reflection, and the reflection bleeds.',
    triggers: {
      onAttacked: { oncePerTurn: true, effects: [{ op: 'damage', amount: 3, to: 'target' }] },
    },
  });

  DS.defineRelic({
    id: 'ra_sand_of_ages',
    name: 'Sand of Ages',
    rarity: 'uncommon',
    icon: '⏳',
    desc: 'On the first turn of each combat, draw 2 cards and gain 1 Energy.',
    flavor: 'Poured from a glass that has watched a thousand battles begin.',
    triggers: {
      onTurnStart: {
        when: { turn: 1 },
        effects: [
          { op: 'draw', amount: 2 },
          { op: 'energy', amount: 1 },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'ra_reapers_tally',
    name: "Reaper's Tally",
    rarity: 'uncommon',
    icon: '💀',
    desc: 'Whenever you kill an enemy, heal 4 HP.',
    flavor: 'Every notch is a name, and every name weighs a little less than the last.',
    triggers: {
      onKill: [{ op: 'heal', amount: 4 }],
    },
  });

  DS.defineRelic({
    id: 'ra_alchemists_bandolier',
    name: "Alchemist's Bandolier",
    rarity: 'uncommon',
    icon: '🧴',
    desc: 'Whenever you use a Potion, draw 2 cards.',
    flavor: 'Twelve pockets, twelve nasty surprises, and a strap that never quite fits.',
    triggers: {
      onPotionUsed: [{ op: 'draw', amount: 2 }],
    },
  });

  DS.defineRelic({
    id: 'ra_ouroboros_ring',
    name: 'Ouroboros Ring',
    rarity: 'uncommon',
    icon: '💍',
    desc: 'The first time each turn an effect makes you discard a card, draw 1 card.',
    flavor: 'What is cast aside always finds its way back into the hand.',
    triggers: {
      onCardDiscarded: { oncePerTurn: true, effects: [{ op: 'draw', amount: 1 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_hearthstone_kettle',
    name: 'Hearthstone Kettle',
    rarity: 'uncommon',
    icon: '🍵',
    desc: 'Whenever you rest, gain 4 Max HP.',
    flavor: 'Boiled water, a pinch of bark, and the stubborn hope that tomorrow is kinder.',
    triggers: {
      onRest: [{ op: 'max_hp', amount: 4 }],
    },
  });

  DS.defineRelic({
    id: 'ra_phoenix_ember',
    name: 'Phoenix Ember',
    rarity: 'uncommon',
    icon: '🔥',
    desc: 'The first time each combat you drop below 30% HP, heal 10 HP.',
    flavor: 'It stays warm in the ashes, waiting for a reason to flare.',
    triggers: {
      onDamaged: { when: { hpBelowPct: 30 }, oncePerCombat: true, effects: [{ op: 'heal', amount: 10 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_duelists_glove',
    name: "Duelist's Glove",
    rarity: 'uncommon',
    icon: '🥊',
    desc: 'Every 4th Attack you land draws 1 card.',
    flavor: 'Leather stained by a hundred practice bouts, and a few real ones.',
    triggers: {
      onAttack: { every: 4, effects: [{ op: 'draw', amount: 1 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_stonewall_buckler',
    name: 'Stonewall Buckler',
    rarity: 'uncommon',
    icon: '🛡️',
    desc: 'The first time each turn you are attacked, gain 3 Block.',
    flavor: 'Cut from the gate of a city that never fell. It has not been tested since.',
    triggers: {
      onAttacked: { oncePerTurn: true, effects: [{ op: 'block', amount: 3 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_cracked_aegis',
    name: 'Cracked Aegis',
    rarity: 'uncommon',
    icon: '💥',
    desc: 'Whenever an attack breaks your Block completely, deal 4 damage to ALL enemies.',
    flavor: 'Every crack is a promise the shield makes to the blow that broke it.',
    triggers: {
      onBlockBroken: [{ op: 'damage', amount: 4, to: 'all_enemies' }],
    },
  });

  DS.defineRelic({
    id: 'ra_overflow_chalice',
    name: 'Overflow Chalice',
    rarity: 'uncommon',
    icon: '🍷',
    desc: 'Whenever you heal during combat, gain 2 Block.',
    flavor: 'Whatever spills over the rim still belongs to you.',
    triggers: {
      onHeal: [{ op: 'block', amount: 2 }],
    },
  });

  DS.defineRelic({
    id: 'ra_sentry_bell',
    name: 'Sentry Bell',
    rarity: 'uncommon',
    icon: '🛎️',
    desc: 'At the end of each turn, gain 3 Block at the start of your next turn.',
    flavor: 'Ring it at dusk, and the watch keeps itself until dawn.',
    triggers: {
      onTurnEnd: [{ op: 'apply', status: 'next_turn_block', amount: 3, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'ra_frugal_vow',
    name: 'Frugal Vow',
    rarity: 'uncommon',
    icon: '🧾',
    desc: 'At the end of each turn, gain 1 Block for each unspent Energy.',
    flavor: 'Waste not, want not, and never let the enemy see how much you saved.',
    triggers: {
      onTurnEnd: [{ op: 'block', amount: { v: 'energy', mul: 1, add: 0 } }],
    },
  });

  DS.defineRelic({
    id: 'ra_elite_bounty_purse',
    name: 'Elite Bounty Purse',
    rarity: 'uncommon',
    icon: '👛',
    desc: 'Whenever you enter an elite room, gain 12 Gold.',
    flavor: 'A dead champion has no use for a purse. You do.',
    triggers: {
      onRoomEnter: { when: { roomType: 'elite' }, effects: [{ op: 'gold', amount: 12 }] },
    },
  });

  DS.defineRelic({
    id: 'ra_heartwood_seed',
    name: 'Heartwood Seed',
    rarity: 'uncommon',
    icon: '🌰',
    desc: 'When you pick this up, gain 8 Max HP.',
    flavor: 'Warm to the touch, and very patient about where its roots go.',
    triggers: {
      onPickup: [{ op: 'max_hp', amount: 8 }],
    },
  });

  DS.defineRelic({
    id: 'ra_brewers_belt',
    name: "Brewer's Belt",
    rarity: 'uncommon',
    icon: '🪢',
    desc: 'You have 1 additional Potion slot.',
    flavor: 'Each loop of leather is tailored to a different kind of disaster.',
    passive: { potionSlots: 1 },
  });

  // ------------------------ CLASS-SPECIFIC UNCOMMON ----------------------

  DS.defineRelic({
    id: 'ra_bloodsoaked_gorget',
    name: 'Bloodsoaked Gorget',
    rarity: 'uncommon',
    class: 'berserker',
    icon: '📿',
    desc: 'The first time each turn you lose HP, gain 1 Strength.',
    flavor: 'The collar is stiff with old blood, and it is glad of more.',
    triggers: {
      onDamaged: { oncePerTurn: true, effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] },
    },
  });

  DS.defineRelic({
    id: 'ra_serpents_tooth',
    name: "Serpent's Tooth",
    rarity: 'uncommon',
    class: 'shade',
    icon: '🐍',
    desc: 'Whenever an effect makes you discard a card, apply 2 Poison to a random enemy.',
    flavor: 'Pulled from a sinuous jaw, still slick with the last thing it bit.',
    triggers: {
      onCardDiscarded: [{ op: 'apply', status: 'poison', amount: 2, to: 'random_enemy' }],
    },
  });

  DS.defineRelic({
    id: 'ra_ashen_grimoire',
    name: 'Ashen Grimoire',
    rarity: 'uncommon',
    class: 'arcanist',
    icon: '📕',
    desc: 'The first Skill you play each turn applies 2 Burn to ALL enemies.',
    flavor: 'Every page is warm to the touch, and the margins are scorched brown.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        oncePerTurn: true,
        effects: [{ op: 'apply', status: 'burn', amount: 2, to: 'all_enemies' }],
      },
    },
  });

  DS.defineRelic({
    id: 'ra_bulwark_keystone',
    name: 'Bulwark Keystone',
    rarity: 'uncommon',
    class: 'warden',
    icon: '🗝️',
    desc: 'At the end of each turn, if you have at least 6 Block, gain 1 Thorns.',
    flavor: 'Wedge it into the wall and the whole fortress leans on it.',
    triggers: {
      onTurnEnd: [
        {
          op: 'if',
          cond: { left: { v: 'block' }, cmp: '>=', right: 6 },
          then: [{ op: 'apply', status: 'thorns', amount: 1, to: 'self' }],
          else: [],
        },
      ],
    },
  });
})();
