(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // =====================================================================
  // relics_b.js — rare, boss, shop and event relics (prefix rb_)
  // =====================================================================

  // ----------------------------- RARE ---------------------------------

  DS.defineRelic({
    id: 'rb_cathedral_plate',
    name: 'Cathedral Plate',
    rarity: 'rare',
    icon: '⛪',
    desc: 'At the start of each combat, gain 8 Plated Armor.',
    flavor: 'Forged from the roof of a church that fell on its own congregation. Mostly.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'plated_armor', amount: 8, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rb_tenth_bell',
    name: 'Tenth Bell',
    rarity: 'rare',
    icon: '🛎️',
    desc: 'Every 10th card you play draws 2 cards.',
    flavor: 'Each tenth stroke pulls the next hand out of the dark.',
    triggers: {
      onCardPlayed: { every: 10, effects: [{ op: 'draw', amount: 2 }] },
    },
  });

  DS.defineRelic({
    id: 'rb_last_drop_flask',
    name: 'Last Drop Flask',
    rarity: 'rare',
    icon: '🍶',
    desc: 'After winning a fight, if you have less than 50% HP, heal 6 HP.',
    flavor: 'The label says "emergency only." The label is right about the last drop.',
    triggers: {
      onCombatEnd: { when: { hpBelowPct: 50 }, effects: [{ op: 'heal', amount: 6 }] },
    },
  });

  DS.defineRelic({
    id: 'rb_echoing_hilt',
    name: 'Echoing Hilt',
    rarity: 'rare',
    icon: '🗡️',
    desc: 'At the start of each combat, your next Attack is played twice.',
    flavor: 'The sword hums a second verse before the first one has finished.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'double_tap', amount: 1, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rb_surveyors_chalk',
    name: "Surveyor's Chalk",
    rarity: 'rare',
    icon: '📐',
    desc: 'At the start of each combat, apply 1 Vulnerable to all enemies.',
    flavor: 'Every enemy is a measurement waiting to be taken.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'vulnerable', amount: 1, to: 'all_enemies' }],
    },
  });

  DS.defineRelic({
    id: 'rb_bloodletters_heart',
    name: "Bloodletter's Heart",
    rarity: 'rare',
    icon: '🫀',
    desc: 'Once each turn, when you lose HP, gain 1 Strength.',
    flavor: 'It beats harder every time it is cut, which is the entire problem.',
    triggers: {
      onDamaged: { oncePerTurn: true, effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }] },
    },
  });

  DS.defineRelic({
    id: 'rb_brazen_mirror',
    name: 'Brazen Mirror',
    rarity: 'rare',
    icon: '🪞',
    desc: 'Whenever an enemy attacks you, that enemy takes 2 damage.',
    flavor: 'It shows the attacker exactly how foolish they look while swinging.',
    triggers: {
      onAttacked: [{ op: 'damage', amount: 2, to: 'target' }],
    },
  });

  DS.defineRelic({
    id: 'rb_ashen_crown',
    name: 'Ashen Crown',
    rarity: 'rare',
    icon: '👑',
    desc: 'Once each turn, when you Exhaust a card, gain 1 Energy.',
    flavor: 'Burnt at the edges, and worn like a victory.',
    triggers: {
      onCardExhausted: { oncePerTurn: true, effects: [{ op: 'energy', amount: 1 }] },
    },
  });

  DS.defineRelic({
    id: 'rb_everbloom_seed',
    name: 'Everbloom Seed',
    rarity: 'rare',
    icon: '🌱',
    desc: 'At the start of each combat, gain 5 Regen.',
    flavor: 'It never finishes blooming, which is how it keeps you alive.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'regen', amount: 5, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rb_heavy_tithe',
    name: 'Heavy Tithe',
    rarity: 'rare',
    icon: '⚖️',
    desc: 'Whenever you play a card that costs 2 or more, gain 3 Block.',
    flavor: 'The gods take a little from every expensive promise.',
    triggers: {
      onCardPlayed: { when: { costAtLeast: 2 }, effects: [{ op: 'block', amount: 3 }] },
    },
  });

  DS.defineRelic({
    id: 'rb_reapers_tally',
    name: "Gravedigger's Ledger",
    rarity: 'rare',
    icon: '💀',
    desc: 'Whenever you kill an enemy, gain 1 Strength.',
    flavor: 'Every notch is a little heavier than the last.',
    triggers: {
      onKill: [{ op: 'apply', status: 'strength', amount: 1, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rb_last_ember',
    name: 'Last Ember',
    rarity: 'rare',
    icon: '🔥',
    desc: 'At the start of each turn, while you have less than 40% HP, gain 1 Energy.',
    flavor: 'Small, stubborn, and very hot.',
    triggers: {
      onTurnStart: { when: { hpBelowPct: 40 }, effects: [{ op: 'energy', amount: 1 }] },
    },
  });

  DS.defineRelic({
    id: 'rb_quiver_of_threes',
    name: 'Quiver of Threes',
    rarity: 'rare',
    icon: '🎯',
    desc: 'Every 3rd card you play deals 4 damage to a random enemy.',
    flavor: 'Three is the number of arrows that always finds someone.',
    triggers: {
      onCardPlayed: { every: 3, effects: [{ op: 'damage', amount: 4, to: 'random_enemy' }] },
    },
  });

  DS.defineRelic({
    id: 'rb_stillness_pearl',
    name: 'Stillness Pearl',
    rarity: 'rare',
    icon: '🔮',
    desc: 'Whenever you play a Power card, gain 4 Block.',
    flavor: 'The sea is quiet inside it, and it is the only quiet you can carry.',
    triggers: {
      onCardPlayed: { when: { cardType: 'power' }, effects: [{ op: 'block', amount: 4 }] },
    },
  });

  DS.defineRelic({
    id: 'rb_hearthstone',
    name: 'Hearthstone',
    rarity: 'rare',
    icon: '🏡',
    desc: 'Whenever you rest, gain 4 Max HP.',
    flavor: 'A warm stone from the fireplace of every inn you never paid for.',
    triggers: {
      onRest: [{ op: 'max_hp', amount: 4 }],
    },
  });

  DS.defineRelic({
    id: 'rb_bounty_sigil',
    name: 'Bounty Sigil',
    rarity: 'rare',
    icon: '📜',
    desc: 'Whenever you enter an elite room, gain 15 Gold.',
    flavor: 'Painted on the door of every dangerous house, in the hope someone will try.',
    triggers: {
      onRoomEnter: { when: { roomType: 'elite' }, effects: [{ op: 'gold', amount: 15 }] },
    },
  });

  // --------------------- RARE (class-specific) ------------------------

  DS.defineRelic({
    id: 'rb_war_standard',
    name: 'War Standard',
    rarity: 'rare',
    class: 'berserker',
    icon: '🚩',
    desc: 'At the start of each turn, gain 3 Rage. Rage gives 3 Block whenever you play an Attack.',
    flavor: 'Raised at dawn over the line. It does not come home with you.',
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'rage', amount: 3, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rb_umbral_ledger',
    name: 'Umbral Ledger',
    rarity: 'rare',
    class: 'shade',
    icon: '📒',
    desc: 'Once each turn, when you apply a debuff to an enemy, draw 1 card.',
    flavor: 'Every grudge gets written down. Every grudge gets paid back.',
    triggers: {
      onApplyDebuff: { oncePerTurn: true, effects: [{ op: 'draw', amount: 1 }] },
    },
  });

  DS.defineRelic({
    id: 'rb_grimoire_of_sparks',
    name: 'Grimoire of Sparks',
    rarity: 'rare',
    class: 'arcanist',
    icon: '📖',
    desc: 'Whenever you play a Skill, deal 3 damage to a random enemy.',
    flavor: 'Each page is a spell, and each spell is a little bit of trouble.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'damage', amount: 3, to: 'random_enemy' }],
      },
    },
  });

  DS.defineRelic({
    id: 'rb_keystone_of_bastions',
    name: 'Keystone of Bastions',
    rarity: 'rare',
    class: 'warden',
    icon: '🏰',
    desc: 'At the start of each combat, gain Barricade.',
    flavor: 'The stone that keeps the arch from falling in. It is the one stone nobody may move.',
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'barricade', amount: 1, to: 'self' }],
    },
  });

  // ----------------------------- BOSS ---------------------------------
  // Most grant +1 Energy each turn and pay for it with a drawback.

  DS.defineRelic({
    id: 'rb_sunken_crown',
    name: 'Sunken Crown',
    rarity: 'boss',
    icon: '🌊',
    desc: '+1 Energy each turn. Start each combat with 2 Frail.',
    flavor: 'Pulled from the lake. The lake would like it back.',
    passive: { energy: 1 },
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'frail', amount: 2, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rb_clockwork_heart',
    name: 'Clockwork Heart',
    rarity: 'boss',
    icon: '⚙️',
    desc: '+1 Energy each turn. At the start of each turn, add a Dazed to your draw pile.',
    flavor: 'It ticks louder whenever it is about to make you regret something.',
    passive: { energy: 1 },
    triggers: {
      onTurnStart: [{ op: 'add_card', card: 'status_dazed', to: 'draw', amount: 1 }],
    },
  });

  DS.defineRelic({
    id: 'rb_tyrants_gift',
    name: "Tyrant's Gift",
    rarity: 'boss',
    icon: '🎁',
    desc: '+1 Energy each turn. Enemies start each combat with 2 Strength.',
    flavor: 'A gift is simply a debt with better wrapping.',
    passive: { energy: 1 },
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'strength', amount: 2, to: 'all_enemies' }],
    },
  });

  DS.defineRelic({
    id: 'rb_bleeding_idol',
    name: 'Bleeding Idol',
    rarity: 'boss',
    icon: '🩸',
    desc: '+1 Energy each turn. At the start of each turn, lose 2 HP.',
    flavor: 'It asks for very little. It asks every morning.',
    passive: { energy: 1 },
    triggers: {
      onTurnStart: [{ op: 'lose_hp', amount: 2, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rb_marrow_pact',
    name: 'Marrow Pact',
    rarity: 'boss',
    icon: '🦴',
    desc: '+1 Energy each turn. Whenever you play a Skill, lose 2 HP.',
    flavor: 'Sign with the bone, and the bone signs back.',
    passive: { energy: 1 },
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'lose_hp', amount: 2, to: 'self' }],
      },
    },
  });

  DS.defineRelic({
    id: 'rb_thirsting_chalice',
    name: 'Thirsting Chalice',
    rarity: 'boss',
    icon: '🍷',
    desc: '+1 Energy each turn. When you pick this up, lose 15 Max HP.',
    flavor: 'It is never full, and it never lets you be.',
    passive: { energy: 1 },
    triggers: {
      onPickup: [{ op: 'max_hp', amount: -15 }],
    },
  });

  DS.defineRelic({
    id: 'rb_gamblers_pendulum',
    name: "Gambler's Pendulum",
    rarity: 'boss',
    icon: '🎲',
    desc: '+1 Energy each turn. At the start of each combat, add a Doubt to your draw pile.',
    flavor: 'Swings one way for luck, and then the other way for the house.',
    passive: { energy: 1 },
    triggers: {
      onCombatStart: [{ op: 'add_card', card: 'curse_doubt', to: 'draw', amount: 1 }],
    },
  });

  DS.defineRelic({
    id: 'rb_reliquary_of_ash',
    name: 'Reliquary of Ash',
    rarity: 'boss',
    icon: '⚱️',
    desc: '+1 Energy each turn. Start each combat with 3 Burn.',
    flavor: 'The ashes of your last mistake, carefully kept.',
    passive: { energy: 1 },
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'burn', amount: 3, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rb_sovereigns_eye',
    name: "Sovereign's Eye",
    rarity: 'boss',
    icon: '👁️',
    desc: 'Draw 1 extra card each turn. Start each combat with 1 Vulnerable.',
    flavor: 'It sees every blow coming, including the one that is aimed at you.',
    passive: { draw: 1 },
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'vulnerable', amount: 1, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rb_alchemists_ransom',
    name: "Alchemist's Ransom",
    rarity: 'boss',
    icon: '💉',
    desc: '+2 Potion slots. Whenever you use a Potion, lose 3 HP.',
    flavor: 'Every elixir is paid for, and not always in gold.',
    passive: { potionSlots: 2 },
    triggers: {
      onPotionUsed: [{ op: 'lose_hp', amount: 3, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rb_hourglass_of_undoing',
    name: 'Hourglass of Undoing',
    rarity: 'boss',
    icon: '⏳',
    desc: 'When you pick this up, transform 2 cards in your deck into random cards of your class. You choose which.',
    flavor: 'Turn it over, and the past becomes a different past.',
    triggers: {
      onPickup: [{ op: 'transform_card', amount: 2, random: false }],
    },
  });

  DS.defineRelic({
    id: 'rb_colossus_heart',
    name: 'Colossus Heart',
    rarity: 'boss',
    icon: '💗',
    desc: 'When you pick this up, gain 25 Max HP and add a Regret to your deck.',
    flavor: 'It is enormous, and it is very much not your heart.',
    triggers: {
      onPickup: [
        { op: 'max_hp', amount: 25 },
        { op: 'add_card', card: 'curse_regret' },
      ],
    },
  });

  DS.defineRelic({
    id: 'rb_forgemasters_anvil',
    name: "Forgemaster's Anvil",
    rarity: 'boss',
    icon: '🔨',
    desc: 'When you pick this up, upgrade every card in your deck, then add a Pain to your deck.',
    flavor: 'Everything it touches gets stronger. Everything it touches also gets hit.',
    triggers: {
      onPickup: [
        { op: 'upgrade_card', amount: 'all' },
        { op: 'add_card', card: 'curse_pain' },
      ],
    },
  });

  DS.defineRelic({
    id: 'rb_obsidian_regent',
    name: 'Obsidian Regent',
    rarity: 'boss',
    icon: '🌋',
    desc: '+1 Energy each turn. Start each combat with 2 Weak.',
    flavor: 'Hard as glass, and brittle in exactly the same way.',
    passive: { energy: 1 },
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'weak', amount: 2, to: 'self' }],
    },
  });

  // ----------------------------- SHOP ---------------------------------
  // Economy and utility. Found in shops and as rewards.

  DS.defineRelic({
    id: 'rb_street_ledger',
    name: 'Street Ledger',
    rarity: 'shop',
    icon: '🧾',
    desc: 'Whenever you enter a fight, gain 4 Gold.',
    flavor: 'Every alley has a price, and every price has a receipt.',
    triggers: {
      onRoomEnter: { when: { roomType: 'fight' }, effects: [{ op: 'gold', amount: 4 }] },
    },
  });

  DS.defineRelic({
    id: 'rb_cutters_shears',
    name: "Cutter's Shears",
    rarity: 'shop',
    icon: '✂️',
    desc: 'When you pick this up, remove a card of your choice from your deck.',
    flavor: 'Snip. Nobody will miss that one. Probably.',
    triggers: {
      onPickup: [{ op: 'remove_card', amount: 1, random: false }],
    },
  });

  DS.defineRelic({
    id: 'rb_apothecary_coupon',
    name: 'Apothecary Coupon',
    rarity: 'shop',
    icon: '🎟️',
    desc: 'Whenever you enter a shop, gain a random Potion, if you have a free slot.',
    flavor: 'Expires on the day you need it, which is every day.',
    triggers: {
      onShopEnter: [{ op: 'add_potion', potion: 'random' }],
    },
  });

  DS.defineRelic({
    id: 'rb_smiths_voucher',
    name: "Smith's Voucher",
    rarity: 'shop',
    icon: '🪪',
    desc: 'When you pick this up, upgrade 2 random cards in your deck.',
    flavor: 'Redeemable for one free edge, at the forge behind the counter.',
    triggers: {
      onPickup: [{ op: 'upgrade_card', amount: 2, random: true }],
    },
  });

  DS.defineRelic({
    id: 'rb_traveling_satchel',
    name: 'Traveling Satchel',
    rarity: 'shop',
    icon: '🎒',
    desc: '+1 Potion slot.',
    flavor: 'It holds exactly one more thing than you think you can carry.',
    passive: { potionSlots: 1 },
  });

  DS.defineRelic({
    id: 'rb_vendors_balm',
    name: "Vendor's Balm",
    rarity: 'shop',
    icon: '🧴',
    desc: 'Whenever you enter a shop, heal 5 HP.',
    flavor: 'Sold with a smile and a firm warning not to rub it in your eyes.',
    triggers: {
      onShopEnter: [{ op: 'heal', amount: 5 }],
    },
  });

  DS.defineRelic({
    id: 'rb_clinking_pouch',
    name: 'Clinking Pouch',
    rarity: 'shop',
    icon: '👛',
    desc: 'Whenever you gain Gold, heal 1 HP.',
    flavor: 'Each coin that lands in it is a little luck, and a little luck is a little life.',
    triggers: {
      onGoldGained: [{ op: 'heal', amount: 1 }],
    },
  });

  DS.defineRelic({
    id: 'rb_deckbox_sleeve',
    name: 'Deckbox Sleeve',
    rarity: 'shop',
    icon: '🗃️',
    desc: 'Whenever a card is added to your deck, gain 5 Gold.',
    flavor: 'Sleeves sell better when people think you are a collector.',
    triggers: {
      onCardAdded: [{ op: 'gold', amount: 5 }],
    },
  });

  DS.defineRelic({
    id: 'rb_black_market_tag',
    name: 'Black Market Tag',
    rarity: 'shop',
    icon: '🏷️',
    desc: 'When you pick this up, gain a random Common relic.',
    flavor: 'The tag is not for sale. Only the thing it is tied to is.',
    triggers: {
      onPickup: [{ op: 'add_relic', relic: 'random', rarity: 'common' }],
    },
  });

  DS.defineRelic({
    id: 'rb_tithe_quill',
    name: 'Tithe Quill',
    rarity: 'shop',
    icon: '🖊️',
    desc: 'Whenever you rest, gain 10 Gold.',
    flavor: 'It signs for the rest, and the rest is billed to someone else.',
    triggers: {
      onRest: [{ op: 'gold', amount: 10 }],
    },
  });

  // ----------------------------- EVENT --------------------------------
  // Quirky, double-edged relics handed out by events.

  DS.defineRelic({
    id: 'rb_gamblers_coin',
    name: "Gambler's Coin",
    rarity: 'event',
    icon: '🃏',
    desc: 'When you pick this up, flip it. Heads: gain 60 Gold. Tails: lose 8 HP.',
    flavor: 'Heads the house wins. Tails you win, but more slowly.',
    triggers: {
      onPickup: [
        {
          op: 'chance',
          p: 0.5,
          then: [{ op: 'gold', amount: 60 }],
          else: [{ op: 'lose_hp', amount: 8 }],
          thenResult: 'Heads. The coin pays out handsomely.',
          elseResult: 'Tails. The coin takes its cut from you.',
        },
      ],
    },
  });

  DS.defineRelic({
    id: 'rb_ghostly_wishbone',
    name: 'Ghostly Wishbone',
    rarity: 'event',
    icon: '🕊️',
    desc: 'Whenever you enter an event, gain 15 Gold and add a Doubt to your deck.',
    flavor: 'Whoever snapped it in half is still waiting for the other piece.',
    triggers: {
      onRoomEnter: {
        when: { roomType: 'event' },
        effects: [
          { op: 'gold', amount: 15 },
          { op: 'add_card', card: 'curse_doubt' },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'rb_hollow_tooth',
    name: 'Hollow Tooth',
    rarity: 'event',
    icon: '🦷',
    desc: 'When you pick this up, gain 6 Max HP. Whenever you rest, lose 2 HP.',
    flavor: 'Pulled from a grinning stranger on the road, who had a spare.',
    triggers: {
      onPickup: [{ op: 'max_hp', amount: 6 }],
      onRest: [{ op: 'lose_hp', amount: 2, to: 'self' }],
    },
  });

  DS.defineRelic({
    id: 'rb_tricksters_mask',
    name: "Trickster's Mask",
    rarity: 'event',
    icon: '🎭',
    desc: 'When you pick this up, upgrade a random card. Whenever a card is added to your deck, lose a random card from it.',
    flavor: 'It has a grin for every face, and none of them are yours.',
    triggers: {
      onPickup: [{ op: 'upgrade_card', amount: 1, random: true }],
      onCardAdded: [{ op: 'remove_card', amount: 1, random: true }],
    },
  });

  DS.defineRelic({
    id: 'rb_bottled_wind',
    name: 'Bottled Wind',
    rarity: 'event',
    icon: '🌬️',
    desc: 'Whenever you use a Potion, gain 2 Strength and add a Wound to your discard pile.',
    flavor: 'It howls when uncorked, and the howling goes straight into your arms.',
    triggers: {
      onPotionUsed: [
        { op: 'apply', status: 'strength', amount: 2, to: 'self' },
        { op: 'add_card', card: 'status_wound', to: 'discard', amount: 1 },
      ],
    },
  });

  DS.defineRelic({
    id: 'rb_mourners_locket',
    name: "Mourner's Locket",
    rarity: 'event',
    icon: '📿',
    desc: 'At the start of each combat, gain 8 Block and add a Wound to your draw pile.',
    flavor: 'Inside is a lock of hair and a promise made to someone who has since forgotten you.',
    triggers: {
      onCombatStart: [
        { op: 'block', amount: 8, to: 'self' },
        { op: 'add_card', card: 'status_wound', to: 'draw', amount: 1 },
      ],
    },
  });

  DS.defineRelic({
    id: 'rb_flickering_eye',
    name: 'Flickering Eye',
    rarity: 'event',
    icon: '🧿',
    desc: 'Whenever you enter an elite room, gain 25 Gold and lose 5 Max HP.',
    flavor: 'It sees the treasure in the beast\'s belly, and also the bill.',
    triggers: {
      onRoomEnter: {
        when: { roomType: 'elite' },
        effects: [
          { op: 'gold', amount: 25 },
          { op: 'max_hp', amount: -5 },
        ],
      },
    },
  });

  DS.defineRelic({
    id: 'rb_pawned_nightingale',
    name: 'Pawned Nightingale',
    rarity: 'event',
    icon: '🐦',
    desc: 'When you pick this up, gain 80 Gold and lose 8 Max HP.',
    flavor: 'It sings only when someone else is paying for the song.',
    triggers: {
      onPickup: [
        { op: 'gold', amount: 80 },
        { op: 'max_hp', amount: -8 },
      ],
    },
  });
})();
