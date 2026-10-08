(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // =====================================================================
  // relics_c.js — version 2 relics (prefix rc_)
  // Build-arounds: curses and status cards, deck size, gold held, potions,
  // exhaust count, exact card counts per turn, turn number, elite rooms,
  // HP thresholds, block broken, shuffles. Two class relics per class.
  // Note: block and energy gained in onCombatStart are wiped by the turn
  // start, so these relics grant Block and Energy from onTurnStart instead.
  // =====================================================================

  // ----------------------------- COMMON -------------------------------

  DS.defineRelic({
    id: 'rc_crowded_shelf',
    name: 'Crowded Shelf',
    rarity: 'common',
    icon: '📚',
    desc: 'At the start of each combat, gain 1 Strength for every 8 cards in your deck.',
    flavor: 'Every book you never finished adds a little weight to the argument.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'strength', amount: { v: 'deck_size', mul: 0.125 }, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rc_hoarded_scraps',
    name: 'Hoarded Scraps',
    rarity: 'common',
    icon: '🥡',
    desc: 'At the end of each turn, gain 1 Block for every 2 cards still in your hand.',
    flavor: "Nothing goes to waste in a traveler's pack, least of all the leftovers.",
    triggers: {
      onTurnEnd: [{ op: 'block', amount: { v: 'hand', mul: 0.5 }, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rc_scar_tissue',
    name: 'Scar Tissue',
    rarity: 'common',
    icon: '🪡',
    desc: 'Whenever you draw a Status card, gain 3 Block.',
    flavor: 'Every ugly mark the world has left on you has taught the skin to hold firm.',
    triggers: {
      onCardDrawn: { when: { cardType: 'status' }, effects: [{ op: 'block', amount: 3, to: 'self' }] },
    },
  });

  DS.defineRelic({
    id: 'rc_heavy_purse',
    name: 'Heavy Purse',
    rarity: 'common',
    icon: '👝',
    desc: 'On the first turn of each combat, gain 1 Block for every 25 Gold you hold.',
    flavor: 'It clinks when you walk, and it clinks louder when you need a wall.',
    triggers: {
      onTurnStart: { when: { turn: 1 }, effects: [{ op: 'block', amount: { v: 'gold', mul: 0.04 }, to: 'self' }] },
    },
  });

  DS.defineRelic({
    id: 'rc_opening_gambit',
    name: 'Opening Gambit',
    rarity: 'common',
    icon: '♟️',
    desc: 'The first card you play each turn gives 2 Block.',
    flavor: 'Lead with something solid, and let the rest of the board react to it.',
    triggers: {
      onCardPlayed: {
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'cards_played' }, cmp: '==', right: 1 },
            then: [{ op: 'block', amount: 2, to: 'self' }],
            else: [],
          },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_ashmoth_wing',
    name: 'Ashmoth Wing',
    rarity: 'common',
    icon: '🦋',
    desc: 'Whenever you Exhaust a card, deal 2 damage to a random enemy.',
    flavor: 'It drifts toward the embers and comes back with its wings dusted in ash.',
    triggers: {
      onCardExhausted: [{ op: 'damage', amount: 2, to: 'random_enemy' }],
    },
  });

  DS.defineRelic({
    id: 'rc_second_breath',
    name: 'Second Breath',
    rarity: 'common',
    icon: '🫁',
    desc: 'On the second turn of each combat, heal 4 HP.',
    flavor: 'The first breath is for panic. The second is for doing something about it.',
    triggers: {
      onTurnStart: { when: { turn: 2 }, effects: [{ op: 'heal', amount: 4, to: 'self' }] },
    },
  });

  DS.defineRelic({
    id: 'rc_pocket_sundial',
    name: 'Pocket Sundial',
    rarity: 'common',
    icon: '🕰️',
    desc: 'On the fourth turn of each combat, gain 2 Energy.',
    flavor: 'It only tells the time once the fight has settled into a rhythm.',
    triggers: {
      onTurnStart: { when: { turn: 4 }, effects: [{ op: 'energy', amount: 2 }] },
    },
  });

  DS.defineRelic({
    id: 'rc_tandem_whistle',
    name: 'Tandem Whistle',
    rarity: 'common',
    icon: '📯',
    desc: 'Whenever you play your second card each turn, deal 3 damage to a random enemy.',
    flavor: 'Two notes make a call. Everyone hears it, and the wrong ones answer.',
    triggers: {
      onCardPlayed: {
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'cards_played' }, cmp: '==', right: 2 },
            then: [{ op: 'damage', amount: 3, to: 'random_enemy' }],
            else: [],
          },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_warding_bead',
    name: 'Warding Bead',
    rarity: 'common',
    icon: '🪬',
    desc: 'Whenever you draw a Curse, heal 2 HP.',
    flavor: 'Carved from the knuckle of a saint who grew tired of being cursed at.',
    triggers: {
      onCardDrawn: { when: { cardType: 'curse' }, effects: [{ op: 'heal', amount: 2, to: 'self' }] },
    },
  });

  DS.defineRelic({
    id: 'rc_travelers_staff',
    name: "Traveler's Staff",
    rarity: 'common',
    icon: '🦯',
    desc: 'Whenever you enter a room, heal 1 HP.',
    flavor: 'Worn smooth by a thousand doorways and one or two slammed doors.',
    triggers: {
      onRoomEnter: [{ op: 'heal', amount: 1 }],
    },
  });

  DS.defineRelic({
    id: 'rc_bitter_rind',
    name: 'Bitter Rind',
    rarity: 'common',
    icon: '🍋',
    desc: 'Whenever you lose HP from something other than an attack, gain 2 Block.',
    flavor: 'Sour enough to make you pucker, and sour enough to make the poison pucker too.',
    triggers: {
      onDamaged: { when: { fromAttack: false }, effects: [{ op: 'block', amount: 2, to: 'self' }] },
    },
  });

  DS.defineRelic({
    id: 'rc_field_medics_kit',
    name: "Field Medic's Kit",
    rarity: 'common',
    icon: '🩺',
    desc: 'The first time each turn you are healed, draw 1 card.',
    flavor: 'Bandages, a needle, and a rule that the surgeon always gets the first look.',
    triggers: {
      onHeal: { oncePerTurn: true, effects: [{ op: 'draw', amount: 1 }] },
    },
  });

  DS.defineRelic({
    id: 'rc_dented_helmet',
    name: 'Dented Helmet',
    rarity: 'common',
    icon: '⛑️',
    desc: 'The first time each turn you lose HP, draw 1 card.',
    flavor: 'Somebody else took a blow to the head and left the helmet behind as a reminder.',
    triggers: {
      onDamaged: { oncePerTurn: true, effects: [{ op: 'draw', amount: 1 }] },
    },
  });

  DS.defineRelic({
    id: 'rc_pepper_pouch',
    name: 'Pepper Pouch',
    rarity: 'common',
    icon: '🌶️',
    desc: 'Whenever you apply a debuff to an enemy, gain 1 Block.',
    flavor: 'A pinch in the eyes, and a sudden need for a wall.',
    triggers: {
      onApplyDebuff: [{ op: 'block', amount: 1, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rc_bared_teeth',
    name: 'Bared Teeth',
    rarity: 'common',
    icon: '😬',
    desc: 'At the end of your turn, if you have no Block, deal 3 damage to ALL enemies.',
    flavor: 'Nothing stands between you and them except your own stubbornness.',
    triggers: {
      onTurnEnd: [
        {
          op: 'if',
          cond: { left: { v: 'block' }, cmp: '==', right: 0 },
          then: [{ op: 'damage', amount: 3, to: 'all_enemies' }],
          else: [],
        },
      ],
    },
  });

  DS.defineRelic({
    id: 'rc_sentinels_whistle',
    name: "Sentinel's Whistle",
    rarity: 'common',
    icon: '🪈',
    desc: 'On the first turn of each combat, gain 2 Block for each living enemy.',
    flavor: 'Three shrill notes call the wall up out of the floor.',
    triggers: {
      onTurnStart: {
        when: { turn: 1 },
        effects: [{ op: 'block', amount: { v: 'enemies', mul: 2 }, to: 'self' }],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_jangle_bracelet',
    name: 'Jangle Bracelet',
    rarity: 'common',
    icon: '🧷',
    desc: 'Whenever you play a Power card, draw 1 card.',
    flavor: 'Every ring and clasp rattles a little louder when something lasting is summoned.',
    triggers: {
      onCardPlayed: { when: { cardType: 'power' }, effects: [{ op: 'draw', amount: 1 }] },
    },
  });

  // ----------------------------- UNCOMMON -----------------------------

  DS.defineRelic({
    id: 'rc_dry_well',
    name: 'Dry Well',
    rarity: 'uncommon',
    icon: '🪣',
    desc: 'Whenever a card you play leaves you with 0 Energy, draw 1 card.',
    flavor: 'Draw until the bucket comes up empty, then draw once more out of spite.',
    triggers: {
      onCardPlayed: {
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'energy' }, cmp: '==', right: 0 },
            then: [{ op: 'draw', amount: 1 }],
            else: [],
          },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_empty_palm',
    name: 'Empty Palm',
    rarity: 'uncommon',
    icon: '🤲',
    desc: 'At the end of your turn, if your hand is empty, gain 2 Energized (+2 Energy next turn).',
    flavor: 'Open, unarmed, and somehow ready to strike harder next time.',
    triggers: {
      onTurnEnd: [
        {
          op: 'if',
          cond: { left: { v: 'hand' }, cmp: '==', right: 0 },
          then: [{ op: 'apply', status: 'energized', amount: 2, to: 'self' }],
          else: [],
        },
      ],
    },
  });

  DS.defineRelic({
    id: 'rc_shattered_greave',
    name: 'Shattered Greave',
    rarity: 'uncommon',
    icon: '🦿',
    desc: 'Whenever an attack breaks your Block completely, gain 4 Vigor (your next Attack deals 4 more damage).',
    flavor: 'The plate split under the blow, and the leg beneath it learned to kick back.',
    triggers: {
      onBlockBroken: [{ op: 'apply', status: 'vigor', amount: 4, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rc_ember_stoker',
    name: 'Ember Stoker',
    rarity: 'uncommon',
    icon: '🪵',
    desc: 'Every 3rd card you Exhaust in a combat gives 2 Strength.',
    flavor: 'Feed it what you have burned, and it returns the favour as heat.',
    triggers: {
      onCardExhausted: {
        every: 3,
        effects: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_minimalists_sash',
    name: "Minimalist's Sash",
    rarity: 'uncommon',
    icon: '🎗️',
    desc: 'While your deck has 12 or fewer cards, each Attack you play draws 1 card.',
    flavor: 'Fewer things to carry means quicker hands to carry them with.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'deck_size' }, cmp: '<=', right: 12 },
            then: [{ op: 'draw', amount: 1 }],
            else: [],
          },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_death_ripple',
    name: 'Death Ripple',
    rarity: 'uncommon',
    icon: '💫',
    desc: 'Whenever an enemy dies, deal 3 damage to ALL remaining enemies.',
    flavor: 'Every fall shakes the ground the rest of them are standing on.',
    triggers: {
      onEnemyDeath: [{ op: 'damage', amount: 3, to: 'all_enemies' }],
    },
  });

  DS.defineRelic({
    id: 'rc_tempo_metronome',
    name: 'Tempo Metronome',
    rarity: 'uncommon',
    icon: '🎼',
    desc: 'At the end of your turn, if you played exactly 3 cards this turn, gain 1 Energized (+1 Energy next turn).',
    flavor: 'Three beats, a pause, and the next measure starts a little early.',
    triggers: {
      onTurnEnd: {
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'cards_played' }, cmp: '==', right: 3 },
            then: [{ op: 'apply', status: 'energized', amount: 1, to: 'self' }],
            else: [],
          },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_ruddy_fist',
    name: 'Ruddy Fist',
    rarity: 'uncommon',
    icon: '✊',
    desc: 'At the start of each turn you have more than 80% HP, gain 2 Vigor (your next Attack deals 2 more damage).',
    flavor: 'Blood runs hot in a healthy hand, and it hits harder for it.',
    triggers: {
      onTurnStart: {
        when: { hpAbovePct: 80 },
        effects: [{ op: 'apply', status: 'vigor', amount: 2, to: 'self' }],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_cursed_tithe',
    name: 'Cursed Tithe',
    rarity: 'uncommon',
    icon: '🕷️',
    desc: 'Whenever you draw a Curse, deal 5 damage to ALL enemies.',
    flavor: 'The dark takes a bad card as a toll, and pays the bearer back in ruin.',
    triggers: {
      onCardDrawn: { when: { cardType: 'curse' }, effects: [{ op: 'damage', amount: 5, to: 'all_enemies' }] },
    },
  });

  DS.defineRelic({
    id: 'rc_alchemists_spark',
    name: "Alchemist's Spark",
    rarity: 'uncommon',
    icon: '⚡',
    desc: 'Whenever you use a Potion, gain 1 Energized (+1 Energy next turn).',
    flavor: 'Every bottle you empty is a little fire you can keep for later.',
    triggers: {
      onPotionUsed: [{ op: 'apply', status: 'energized', amount: 1, to: 'self' }],
    },
  });

  // ----------------------- UNCOMMON (class-specific) ---------------------

  DS.defineRelic({
    id: 'rc_frenzied_totem',
    name: 'Frenzied Totem',
    rarity: 'uncommon',
    class: 'berserker',
    icon: '🦬',
    desc: 'Whenever you play an Attack while you have less than 50% HP, gain 1 Strength.',
    flavor: 'The closer you get to the grave, the more the hide wants to bite.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack', hpBelowPct: 50 },
        effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_silent_step',
    name: 'Silent Step',
    rarity: 'uncommon',
    class: 'shade',
    icon: '🥷',
    desc: 'At the end of each turn in which you played no Attacks, gain 3 Block.',
    flavor: 'Nobody hears a blade that never leaves its sheath, so nobody swings back.',
    triggers: {
      onTurnEnd: {
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'attacks_played' }, cmp: '==', right: 0 },
            then: [{ op: 'block', amount: 3, to: 'self' }],
            else: [],
          },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_quill_of_second_thoughts',
    name: 'Quill of Second Thoughts',
    rarity: 'uncommon',
    class: 'arcanist',
    icon: '✒️',
    desc: 'If the second card you play each turn is a Skill, draw 2 cards.',
    flavor: 'The first line is a guess. The second line is the one that counts.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'cards_played' }, cmp: '==', right: 2 },
            then: [{ op: 'draw', amount: 2 }],
            else: [],
          },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_bastion_bell',
    name: 'Bastion Bell',
    rarity: 'uncommon',
    class: 'warden',
    icon: '🏛️',
    desc: 'Whenever you gain Block while you have at least 12 Block, deal 2 damage to ALL enemies.',
    flavor: 'Ring it once for every wall that holds, and the enemy hears how many there are.',
    triggers: {
      onBlockGained: [
        {
          op: 'if',
          cond: { left: { v: 'block' }, cmp: '>=', right: 12 },
          then: [{ op: 'damage', amount: 2, to: 'all_enemies' }],
          else: [],
        },
      ],
    },
  });

  DS.defineRelic({
    id: 'rc_stormcallers_tally',
    name: "Stormcaller's Tally",
    rarity: 'uncommon',
    class: 'tempest',
    icon: '🌩️',
    desc: 'The third Attack you play each turn gives 1 Draw Next (draw 1 more card next turn).',
    flavor: 'Count the thunder, and the sky owes you one card for every count.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'attacks_played' }, cmp: '==', right: 3 },
            then: [{ op: 'apply', status: 'draw_next', amount: 1, to: 'self' }],
            else: [],
          },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_ritual_codex',
    name: 'Ritual Codex',
    rarity: 'uncommon',
    class: 'occultist',
    icon: '🔯',
    desc: 'Whenever you draw a Curse, gain 1 Ritual (gain 1 Strength at the end of each turn).',
    flavor: 'Every hateful word on the page is a little more of you, and the page is grateful.',
    triggers: {
      onCardDrawn: {
        when: { cardType: 'curse' },
        effects: [{ op: 'apply', status: 'ritual', amount: 1, to: 'self' }],
      },
    },
  });

  // ----------------------------- RARE ---------------------------------

  DS.defineRelic({
    id: 'rc_ossuary_lamp',
    name: 'Ossuary Lamp',
    rarity: 'rare',
    icon: '🪔',
    desc: 'At the start of each turn, gain Block equal to half the cards in your Exhaust pile.',
    flavor: 'It burns on the bones of everything you have already used up.',
    triggers: {
      onTurnStart: [{ op: 'block', amount: { v: 'exhaust_pile', mul: 0.5 }, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rc_packrat_bundle',
    name: 'Packrat Bundle',
    rarity: 'rare',
    icon: '🧳',
    desc: 'At the start of each turn, gain Block equal to half your deck size (rounded down), minus 7, to a minimum of 0.',
    flavor: 'It bulges with everything you ever meant to throw away and never did.',
    triggers: {
      onTurnStart: [{ op: 'block', amount: { v: 'deck_size', mul: 0.5, add: -7 }, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rc_lone_wolf_mask',
    name: 'Lone Wolf Mask',
    rarity: 'rare',
    icon: '🐺',
    desc: 'At the end of your turn, if you played exactly 1 card this turn, gain 2 Strength.',
    flavor: 'One clean stroke, and the whole pack goes quiet to watch you.',
    triggers: {
      onTurnEnd: {
        effects: [
          {
            op: 'if',
            cond: { left: { v: 'cards_played' }, cmp: '==', right: 1 },
            then: [{ op: 'apply', status: 'strength', amount: 2, to: 'self' }],
            else: [],
          },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_gravewarden_seal',
    name: "Gravewarden's Seal",
    rarity: 'rare',
    icon: '🪦',
    desc: 'At the end of each turn, gain 1 Strength for every 10 Block you have.',
    flavor: 'The wall you raise becomes the blade you sharpen with it.',
    triggers: {
      onTurnEnd: [{ op: 'apply', status: 'strength', amount: { v: 'block', mul: 0.1 }, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rc_tumbling_dice',
    name: 'Tumbling Dice',
    rarity: 'rare',
    icon: '🎰',
    desc: 'Whenever your draw pile is reshuffled, gain 1 Energy.',
    flavor: 'Roll them back into the bag. Luck is only luck until the bag is shaken.',
    triggers: {
      onShuffle: [{ op: 'energy', amount: 1 }],
    },
  });

  DS.defineRelic({
    id: 'rc_warhorn_of_the_vanquished',
    name: 'Warhorn of the Vanquished',
    rarity: 'rare',
    icon: '🎺',
    desc: 'On the first turn of each elite fight, gain 6 Block and 1 Strength.',
    flavor: 'Its brass still sings for the champion who carried it last.',
    triggers: {
      onTurnStart: {
        when: { turn: 1, roomType: 'elite' },
        effects: [
          { op: 'block', amount: 6, to: 'self' },
          { op: 'apply', status: 'strength', amount: 1, to: 'self' },
        ],
      },
    },
  });

  // ----------------------- RARE (class-specific) ------------------------

  DS.defineRelic({
    id: 'rc_butchers_trophy',
    name: "Butcher's Trophy",
    rarity: 'rare',
    class: 'berserker',
    icon: '🏆',
    desc: 'Whenever you kill an enemy, gain Block equal to twice your Strength.',
    flavor: 'Hang the ear on your belt, and let the belt hold up your guard as well.',
    triggers: {
      onKill: [{ op: 'block', amount: { v: 'status', status: 'strength', mul: 2 }, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rc_tally_of_venoms',
    name: 'Tally of Venoms',
    rarity: 'rare',
    class: 'shade',
    icon: '🫙',
    desc: 'At the end of your turn, apply 1 Poison to a random enemy for every 3 cards still in your hand.',
    flavor: 'Count the cards you did not play, and the poison counts them back.',
    triggers: {
      onTurnEnd: [{ op: 'apply', status: 'poison', amount: { v: 'hand', mul: 0.34 }, to: 'random_enemy' }],
    },
  });

  DS.defineRelic({
    id: 'rc_codex_of_quiet_pages',
    name: 'Codex of Quiet Pages',
    rarity: 'rare',
    class: 'arcanist',
    icon: '📘',
    desc: 'Whenever you play a Power card, gain 1 Strength.',
    flavor: 'The pages stay blank until you dare to make something permanent of them.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'power' },
        effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_rampart_clock',
    name: 'Rampart Clock',
    rarity: 'rare',
    class: 'warden',
    icon: '🏯',
    desc: 'At the end of your turn, if you have at least 15 Block, gain 1 Energized (+1 Energy next turn).',
    flavor: 'Its gears only turn while the walls are still standing.',
    triggers: {
      onTurnEnd: [
        {
          op: 'if',
          cond: { left: { v: 'block' }, cmp: '>=', right: 15 },
          then: [{ op: 'apply', status: 'energized', amount: 1, to: 'self' }],
          else: [],
        },
      ],
    },
  });

  DS.defineRelic({
    id: 'rc_tempest_lodestar',
    name: 'Tempest Lodestar',
    rarity: 'rare',
    class: 'tempest',
    icon: '🌪️',
    desc: 'At the end of your turn, if you played 4 or more cards this turn, gain 1 Draw Next (draw 1 more card next turn).',
    flavor: 'It pulls the storm toward whichever hand has been busiest.',
    triggers: {
      onTurnEnd: [
        {
          op: 'if',
          cond: { left: { v: 'cards_played' }, cmp: '>=', right: 4 },
          then: [{ op: 'apply', status: 'draw_next', amount: 1, to: 'self' }],
          else: [],
        },
      ],
    },
  });

  DS.defineRelic({
    id: 'rc_ossuary_dice',
    name: 'Ossuary Dice',
    rarity: 'rare',
    class: 'occultist',
    icon: '☠️',
    desc: 'Whenever you Exhaust a card, apply 1 Vulnerable to ALL enemies.',
    flavor: 'Roll them over the bones of spent things, and bet on the ones still moving.',
    triggers: {
      onCardExhausted: [{ op: 'apply', status: 'vulnerable', amount: 1, to: 'all_enemies' }],
    },
  });

  // ----------------------------- BOSS ---------------------------------
  // Each one is a real trade-off. None of them grants extra Energy.

  DS.defineRelic({
    id: 'rc_bloodstone_scale',
    name: 'Bloodstone Scale',
    rarity: 'boss',
    icon: '💎',
    desc: 'At the start of each combat, gain 5 Thorns. Once each turn, when you gain Block, lose 2 HP.',
    flavor: 'Every shield you raise is paid for with a little blood from the same vein.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'thorns', amount: 5, to: 'self' }],
      onBlockGained: { oncePerTurn: true, effects: [{ op: 'lose_hp', amount: 2, to: 'self' }] },
    },
  });

  DS.defineRelic({
    id: 'rc_ossuary_covenant',
    name: 'Ossuary Covenant',
    rarity: 'boss',
    icon: '🏺',
    desc: 'At the start of each combat, add a Wound to your discard pile. Whenever you Exhaust a card, heal 6 HP.',
    flavor: 'The dead accept what you spend, and they send a little warmth back for it.',
    triggers: {
      onCombatStart: [{ op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 }],
      onCardExhausted: [{ op: 'heal', amount: 6, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rc_usurers_crown',
    name: "Usurer's Crown",
    rarity: 'boss',
    icon: '🤑',
    desc: 'At the start of each turn, gain 1 Block for every 10 Gold you hold. At the start of each combat, lose 30 Gold.',
    flavor: 'It pays out in walls, and it collects in coin.',
    triggers: {
      onTurnStart: [{ op: 'block', amount: { v: 'gold', mul: 0.1 }, to: 'self' }],
      onCombatStart: [{ op: 'gold', amount: -30 }],
    },
  });

  DS.defineRelic({
    id: 'rc_pruners_oath',
    name: "Pruner's Oath",
    rarity: 'boss',
    icon: '🪚',
    desc: 'When you pick this up, remove 2 random cards from your deck. Whenever a card is added to your deck, gain 4 Max HP.',
    flavor: 'Cut away the dead wood, and the living tree grows toward the cut.',
    triggers: {
      onPickup: [{ op: 'remove_card', amount: 2, random: true }],
      onCardAdded: [{ op: 'max_hp', amount: 4 }],
    },
  });

  DS.defineRelic({
    id: 'rc_revenants_mantle',
    name: "Revenant's Mantle",
    rarity: 'boss',
    icon: '🧥',
    desc: 'At the start of each combat, gain 2 Buffer (prevents your next 2 HP losses). Whenever you rest, lose 10% of your Max HP.',
    flavor: 'It was buried with someone who refused to stay that way, and it refuses too.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'buffer', amount: 2, to: 'self' }],
      onRest: [{ op: 'lose_hp', amount: { v: 'max_hp', mul: 0.1 } }],
    },
  });

  DS.defineRelic({
    id: 'rc_shadowed_halo',
    name: 'Shadowed Halo',
    rarity: 'boss',
    icon: '🌑',
    desc: 'Whenever you play an Attack, deal 3 damage to ALL enemies and give each of them 1 Strength.',
    flavor: 'It shines on your swings, and it shines on theirs as well.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [
          { op: 'damage', amount: 3, to: 'all_enemies' },
          { op: 'apply', status: 'strength', amount: 1, to: 'all_enemies' },
        ],
      },
    },
  });

  // ----------------------------- SHOP ---------------------------------
  // Economy and utility. Found in shops and as rewards.

  DS.defineRelic({
    id: 'rc_exorcists_ink',
    name: "Exorcist's Ink",
    rarity: 'shop',
    icon: '🖍️',
    desc: 'When you pick this up, remove a random Curse from your deck.',
    flavor: 'Scribble the name of the thing you regret, and watch it smear out of the book.',
    triggers: {
      onPickup: [{ op: 'remove_card', amount: 1, random: true, type: 'curse' }],
    },
  });

  DS.defineRelic({
    id: 'rc_curse_brokers_fee',
    name: "Curse Broker's Fee",
    rarity: 'shop',
    icon: '💸',
    desc: 'Whenever a Curse is added to your deck, gain 15 Gold.',
    flavor: "He takes the bad luck off your hands and bills you a finder's fee for the bother.",
    triggers: {
      onCardAdded: { when: { cardType: 'curse' }, effects: [{ op: 'gold', amount: 15 }] },
    },
  });

  DS.defineRelic({
    id: 'rc_lockbox_key',
    name: 'Lockbox Key',
    rarity: 'shop',
    icon: '🔑',
    desc: 'Whenever you open a treasure chest, gain 20 Gold.',
    flavor: 'Nobody remembers which chest it fits. Every chest seems to remember you.',
    triggers: {
      onChestOpen: [{ op: 'gold', amount: 20 }],
    },
  });

  DS.defineRelic({
    id: 'rc_picnic_basket',
    name: 'Picnic Basket',
    rarity: 'shop',
    icon: '🧺',
    desc: 'Whenever you rest, gain a random Potion, if you have a free slot.',
    flavor: 'Bread, cheese, and a bottle the innkeeper swore was harmless.',
    triggers: {
      onRest: [{ op: 'add_potion', potion: 'random' }],
    },
  });

  // ----------------------------- EVENT --------------------------------
  // Quirky, double-edged relics handed out by events.

  DS.defineRelic({
    id: 'rc_gilded_debt',
    name: 'Gilded Debt',
    rarity: 'event',
    icon: '💰',
    desc: 'When you pick this up, gain 40 Gold. At the start of each combat, lose 10 Gold.',
    flavor: 'The lender smiles, and every smile is itemised on the back of the note.',
    triggers: {
      onPickup: [{ op: 'gold', amount: 40 }],
      onCombatStart: [{ op: 'gold', amount: -10 }],
    },
  });

  DS.defineRelic({
    id: 'rc_ferrymans_obol',
    name: "Ferryman's Obol",
    rarity: 'event',
    icon: '🛶',
    desc: 'When you pick this up, lose 15 Gold. Whenever you rest, heal 12 HP more and lose 3 Max HP.',
    flavor: 'Pay the ferryman and he carries you back across. Some of you stays on the far bank.',
    triggers: {
      onPickup: [{ op: 'gold', amount: -15 }],
      onRest: [
        { op: 'heal', amount: 12 },
        { op: 'max_hp', amount: -3 },
      ],
    },
  });

  DS.defineRelic({
    id: 'rc_hungry_lantern',
    name: 'Hungry Lantern',
    rarity: 'event',
    icon: '👻',
    desc: 'Whenever you enter a fight, gain 6 Gold and lose 1 Max HP.',
    flavor: 'It lights the road ahead and feeds on whoever walks it.',
    triggers: {
      onRoomEnter: {
        when: { roomType: 'fight' },
        effects: [
          { op: 'gold', amount: 6 },
          { op: 'max_hp', amount: -1 },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'rc_cursed_ledger',
    name: 'Cursed Ledger',
    rarity: 'event',
    icon: '📓',
    desc: 'When you pick this up, add a Doubt to your deck. Whenever you draw a Curse, gain 1 Energy.',
    flavor: 'Every debt you record in it is paid in a currency you do not own.',
    triggers: {
      onPickup: [{ op: 'add_card', card: 'curse_doubt' }],
      onCardDrawn: {
        when: { cardType: 'curse' },
        effects: [{ op: 'energy', amount: 1 }],
      },
    },
  });
})();
