(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // =====================================================================
  // WARDEN — armored guardian of the old forest. Archetypes:
  //   BULWARK  : Block generation, Barricade-style payoffs (damage equal to Block), Rooted / Stone Hide / Enduring Bark
  //   THORNS   : Thorns, Bramble Wall, Thorn Aura, Plated Bark / Living Armor, Mark + Lock On hunting
  //   GROWTH   : Seed of Growth ramps Growth every turn (+1 attack damage per stack), X-cost payoffs, Ancient Lash
  //   SANCTUARY: Grove Heart / Regen / Verdant Pact sustain, Max HP, retain and exhaust-for-value cards
  // =====================================================================

  DS.defineCharacter({
    id: 'warden',
    name: 'Warden',
    title: 'The Verdant Bulwark',
    desc: 'An armored guardian of the old forest. The Warden turns every point of Block into a weapon, lets thorns punish anyone who dares to strike, and grows stronger the longer a battle drags on.',
    hp: 72,
    gold: 99,
    icon: '🛡️',
    color: '#b7950b',
    starterDeck: [
      'wd_strike', 'wd_strike', 'wd_strike', 'wd_strike', 'wd_strike',
      'wd_defend', 'wd_defend', 'wd_defend', 'wd_defend',
      'wd_root_guard', 'wd_thorn_lash'
    ],
    starterRelic: 'wd_ironbark_charm'
  });

  // Block is cleared at the start of the first player turn AFTER onCombatStart, so the charm
  // grants its block on turn 1 start (after that clearing) instead.
  DS.defineRelic({
    id: 'wd_ironbark_charm',
    name: 'Ironbark Charm',
    desc: 'At the start of each combat, gain 4 Block.',
    flavor: 'Carved from the heartwood of a tree that has never once fallen.',
    rarity: 'starter',
    icon: '📿',
    class: 'warden',
    passive: {},
    triggers: {
      onTurnStart: { when: { turn: 1 }, effects: [{ op: 'block', amount: 4, to: 'self' }] }
    }
  });

  // =====================================================================
  // Starter cards
  // =====================================================================

  DS.defineCard({
    id: 'wd_strike',
    name: 'Strike',
    class: 'warden',
    type: 'attack',
    rarity: 'starter',
    cost: 1,
    target: 'enemy',
    icon: '🌿',
    desc: 'Deal 6 damage.',
    effects: [{ op: 'damage', amount: 6 }],
    upgrade: { desc: 'Deal 9 damage.', effects: [{ op: 'damage', amount: 9 }] }
  });

  DS.defineCard({
    id: 'wd_defend',
    name: 'Defend',
    class: 'warden',
    type: 'skill',
    rarity: 'starter',
    cost: 1,
    target: 'self',
    icon: '🪨',
    desc: 'Gain 5 Block.',
    effects: [{ op: 'block', amount: 5, to: 'self' }],
    upgrade: { desc: 'Gain 8 Block.', effects: [{ op: 'block', amount: 8, to: 'self' }] }
  });

  DS.defineCard({
    id: 'wd_root_guard',
    name: 'Root Guard',
    class: 'warden',
    type: 'skill',
    rarity: 'starter',
    cost: 1,
    target: 'self',
    icon: '🌱',
    desc: 'Gain 4 Block. Gain 1 Growth.',
    effects: [
      { op: 'block', amount: 4, to: 'self' },
      { op: 'apply', status: 'wd_growth', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 6 Block. Gain 2 Growth.',
      effects: [
        { op: 'block', amount: 6, to: 'self' },
        { op: 'apply', status: 'wd_growth', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_thorn_lash',
    name: 'Thorn Lash',
    class: 'warden',
    type: 'attack',
    rarity: 'starter',
    cost: 1,
    target: 'enemy',
    icon: '🌵',
    desc: 'Deal 5 damage. Apply 1 Mark.',
    effects: [
      { op: 'damage', amount: 5 },
      { op: 'apply', status: 'mark', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 7 damage. Apply 2 Mark.',
      effects: [
        { op: 'damage', amount: 7 },
        { op: 'apply', status: 'mark', amount: 2, to: 'target' }
      ]
    }
  });

  // =====================================================================
  // Custom statuses (granted to self by power cards, or by cards). Ids are prefixed wd_.
  // =====================================================================

  DS.defineStatus({
    id: 'wd_rooted', name: 'Rooted', type: 'buff', icon: '🌱', stacks: true, decay: null, expire: null,
    desc: 'At the start of your turn, gain {n} Block.',
    triggers: {
      onTurnStart: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'wd_grove', name: 'Grove Heart', type: 'buff', icon: '💚', stacks: true, decay: null, expire: null,
    desc: 'At the start of your turn, heal {n} HP.',
    triggers: {
      onTurnStart: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'wd_bramble', name: 'Bramble Wall', type: 'buff', icon: '🌵', stacks: true, decay: null, expire: null,
    desc: 'Whenever you gain Block, deal {n} damage to a random enemy.',
    triggers: {
      onBlockGained: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
    }
  });

  DS.defineStatus({
    id: 'wd_growth', name: 'Growth', type: 'buff', icon: '🌳', stacks: true, decay: null, expire: null,
    desc: 'Your attacks deal +1 damage per stack of Growth. You have {n}.',
    mods: { attackDealtAdd: 1 }
  });

  DS.defineStatus({
    id: 'wd_seed', name: 'Seed of Growth', type: 'buff', icon: '🌰', stacks: true, decay: null, expire: null,
    desc: 'At the start of your turn, gain {n} Growth.',
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'wd_growth', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'wd_stone_hide', name: 'Stone Hide', type: 'buff', icon: '🪨', stacks: true, decay: null, expire: null,
    desc: 'Whenever you are hit by an attack, gain {n} Block.',
    triggers: {
      onAttacked: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'wd_thorn_aura', name: 'Thorn Aura', type: 'buff', icon: '🥀', stacks: true, decay: null, expire: null,
    desc: 'At the start of your turn, deal {n} damage to ALL enemies.',
    triggers: {
      onTurnStart: [{ op: 'damage', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  DS.defineStatus({
    id: 'wd_wild_fury', name: 'Wild Fury', type: 'buff', icon: '🌪️', stacks: true, decay: null, expire: null,
    desc: 'Whenever you play an attack, gain {n} Block.',
    triggers: {
      onCardPlayed: { when: { cardType: 'attack' }, effects: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }] }
    }
  });

  DS.defineStatus({
    id: 'wd_enduring', name: 'Enduring Bark', type: 'buff', icon: '🪵', stacks: true, decay: null, expire: null,
    desc: 'Whenever you lose HP, gain {n} Block.',
    triggers: {
      onDamaged: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'wd_verdant', name: 'Verdant Pact', type: 'buff', icon: '🍀', stacks: true, decay: null, expire: null,
    desc: 'Whenever you play a Skill, heal {n} HP.',
    triggers: {
      onCardPlayed: { when: { cardType: 'skill' }, effects: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }] }
    }
  });

  DS.defineStatus({
    id: 'wd_spore_cloud', name: 'Spore Cloud', type: 'buff', icon: '🍄', stacks: true, decay: null, expire: null,
    desc: 'At the start of your turn, apply {n} Weak to ALL enemies.',
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'weak', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  DS.defineStatus({
    id: 'wd_predators_bloom', name: "Predator's Bloom", type: 'buff', icon: '🌸', stacks: true, decay: null, expire: null,
    desc: 'Whenever you kill an enemy, gain {n} Growth.',
    triggers: {
      onKill: [{ op: 'apply', status: 'wd_growth', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'wd_hunters_eye', name: "Hunter's Eye", type: 'buff', icon: '👁️', stacks: true, decay: null, expire: null,
    desc: 'Whenever you play an attack against a Marked enemy, draw {n} cards.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [{
          op: 'if',
          cond: { left: { v: 'status', status: 'mark', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'draw', amount: { v: 'stacks' } }],
          else: []
        }]
      }
    }
  });

  // =====================================================================
  // COMMON (24): 10 attacks, 10 skills, 4 powers
  // =====================================================================

  // ---- common attacks ----
  DS.defineCard({
    id: 'wd_vine_whip', name: 'Vine Whip', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🌿',
    desc: 'Deal 7 damage. Apply 1 Mark.',
    effects: [
      { op: 'damage', amount: 7 },
      { op: 'apply', status: 'mark', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 9 damage. Apply 2 Mark.',
      effects: [
        { op: 'damage', amount: 9 },
        { op: 'apply', status: 'mark', amount: 2, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_bark_bash', name: 'Bark Bash', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🪵',
    desc: 'Deal 4 damage, plus half your Block (rounded down).',
    effects: [{ op: 'damage', amount: { v: 'block', mul: 0.5, add: 4 } }],
    upgrade: {
      desc: 'Deal 4 damage, plus all of your Block.',
      effects: [{ op: 'damage', amount: { v: 'block', mul: 1, add: 4 } }]
    }
  });

  DS.defineCard({
    id: 'wd_thorn_swipe', name: 'Thorn Swipe', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '🥀',
    desc: 'Deal 5 damage to ALL enemies.',
    effects: [{ op: 'damage', amount: 5, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 7 damage to ALL enemies.',
      effects: [{ op: 'damage', amount: 7, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'wd_briar_claw', name: 'Briar Claw', class: 'warden', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🐾',
    desc: 'Deal 12 damage.',
    effects: [{ op: 'damage', amount: 12 }],
    upgrade: { desc: 'Deal 15 damage.', effects: [{ op: 'damage', amount: 15 }] }
  });

  DS.defineCard({
    id: 'wd_stone_fist', name: 'Stone Fist', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🪨',
    desc: 'Deal 6 damage. Gain 3 Block.',
    effects: [
      { op: 'damage', amount: 6 },
      { op: 'block', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 8 damage. Gain 4 Block.',
      effects: [
        { op: 'damage', amount: 8 },
        { op: 'block', amount: 4, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_twig_flick', name: 'Twig Flick', class: 'warden', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '🌱',
    desc: 'Deal 3 damage. Draw 1 card.',
    effects: [
      { op: 'damage', amount: 3 },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Deal 4 damage. Draw 2 cards.',
      effects: [
        { op: 'damage', amount: 4 },
        { op: 'draw', amount: 2 }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_pollen_flurry', name: 'Pollen Flurry', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'random_enemy', icon: '🌸',
    desc: 'Deal 3 damage to a random enemy 3 times.',
    effects: [{ op: 'damage', amount: 3, times: 3, to: 'random_enemy' }],
    upgrade: {
      desc: 'Deal 4 damage to a random enemy 3 times.',
      effects: [{ op: 'damage', amount: 4, times: 3, to: 'random_enemy' }]
    }
  });

  DS.defineCard({
    id: 'wd_rootbreaker', name: 'Rootbreaker', class: 'warden', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🪓',
    desc: 'Deal 10 damage. Apply 1 Vulnerable.',
    effects: [
      { op: 'damage', amount: 10 },
      { op: 'apply', status: 'vulnerable', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 13 damage. Apply 2 Vulnerable.',
      effects: [
        { op: 'damage', amount: 13 },
        { op: 'apply', status: 'vulnerable', amount: 2, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_sap_slash', name: 'Sap Slash', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🍃',
    desc: 'Deal 5 damage. Heal 2 HP.',
    effects: [
      { op: 'damage', amount: 5 },
      { op: 'heal', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 7 damage. Heal 3 HP.',
      effects: [
        { op: 'damage', amount: 7 },
        { op: 'heal', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_oak_cudgel', name: 'Oak Cudgel', class: 'warden', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🌲',
    desc: 'Deal 14 damage.',
    effects: [{ op: 'damage', amount: 14 }],
    upgrade: { desc: 'Deal 18 damage.', effects: [{ op: 'damage', amount: 18 }] }
  });

  // ---- common skills ----
  DS.defineCard({
    id: 'wd_bark_shield', name: 'Bark Shield', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🛡️',
    desc: 'Gain 7 Block.',
    effects: [{ op: 'block', amount: 7, to: 'self' }],
    upgrade: { desc: 'Gain 10 Block.', effects: [{ op: 'block', amount: 10, to: 'self' }] }
  });

  DS.defineCard({
    id: 'wd_mossy_wall', name: 'Mossy Wall', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🧱',
    desc: 'Gain 5 Block. Gain 1 Thorns.',
    effects: [
      { op: 'block', amount: 5, to: 'self' },
      { op: 'apply', status: 'thorns', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 7 Block. Gain 2 Thorns.',
      effects: [
        { op: 'block', amount: 7, to: 'self' },
        { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_healing_sap', name: 'Healing Sap', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🍯',
    desc: 'Gain 5 Block. Heal 2 HP.',
    effects: [
      { op: 'block', amount: 5, to: 'self' },
      { op: 'heal', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 7 Block. Heal 3 HP.',
      effects: [
        { op: 'block', amount: 7, to: 'self' },
        { op: 'heal', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_lichen_snare', name: 'Lichen Snare', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🕸️',
    desc: 'Apply 2 Weak. Gain 3 Block.',
    effects: [
      { op: 'apply', status: 'weak', amount: 2, to: 'target' },
      { op: 'block', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Apply 3 Weak. Gain 4 Block.',
      effects: [
        { op: 'apply', status: 'weak', amount: 3, to: 'target' },
        { op: 'block', amount: 4, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_root_bind', name: 'Root Bind', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🪢',
    desc: 'Apply 1 Vulnerable. Draw 1 card.',
    effects: [
      { op: 'apply', status: 'vulnerable', amount: 1, to: 'target' },
      { op: 'draw', amount: 1 }
    ],
    upgrade: {
      desc: 'Apply 2 Vulnerable. Draw 1 card.',
      effects: [
        { op: 'apply', status: 'vulnerable', amount: 2, to: 'target' },
        { op: 'draw', amount: 1 }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_moss_cover', name: 'Moss Cover', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🍀',
    desc: 'Gain 6 Block. Retain.',
    retain: true,
    effects: [{ op: 'block', amount: 6, to: 'self' }],
    upgrade: { desc: 'Gain 8 Block. Retain.', retain: true, effects: [{ op: 'block', amount: 8, to: 'self' }] }
  });

  DS.defineCard({
    id: 'wd_breathe_deep', name: 'Breathe Deep', class: 'warden', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🌬️',
    desc: 'Heal 3 HP. Exhaust.',
    exhaust: true,
    effects: [{ op: 'heal', amount: 3, to: 'self' }],
    upgrade: { desc: 'Heal 5 HP. Exhaust.', exhaust: true, effects: [{ op: 'heal', amount: 5, to: 'self' }] }
  });

  DS.defineCard({
    id: 'wd_drawn_roots', name: 'Drawn Roots', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🌾',
    desc: 'Draw 2 cards. Gain 3 Block.',
    effects: [
      { op: 'draw', amount: 2 },
      { op: 'block', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Draw 3 cards. Gain 4 Block.',
      effects: [
        { op: 'draw', amount: 3 },
        { op: 'block', amount: 4, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_tough_bark', name: 'Tough Bark', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🪵',
    desc: 'Gain 4 Block. Gain 1 Dexterity.',
    effects: [
      { op: 'block', amount: 4, to: 'self' },
      { op: 'apply', status: 'dexterity', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 6 Block. Gain 1 Dexterity.',
      effects: [
        { op: 'block', amount: 6, to: 'self' },
        { op: 'apply', status: 'dexterity', amount: 1, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_sunlit_glade', name: 'Sunlit Glade', class: 'warden', type: 'skill', rarity: 'common',
    cost: 2, target: 'self', icon: '🌞',
    desc: 'Heal 5 HP. Gain 4 Block.',
    effects: [
      { op: 'heal', amount: 5, to: 'self' },
      { op: 'block', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Heal 7 HP. Gain 6 Block.',
      effects: [
        { op: 'heal', amount: 7, to: 'self' },
        { op: 'block', amount: 6, to: 'self' }
      ]
    }
  });

  // ---- common powers ----
  DS.defineCard({
    id: 'wd_rooted_stance', name: 'Rooted Stance', class: 'warden', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🌱',
    desc: 'Gain 2 Rooted: at the start of each of your turns, gain 2 Block.',
    effects: [{ op: 'apply', status: 'wd_rooted', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Rooted: at the start of each of your turns, gain 3 Block.',
      effects: [{ op: 'apply', status: 'wd_rooted', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_grove_blessing', name: 'Grove Blessing', class: 'warden', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '💚',
    desc: 'Gain 1 Grove Heart: at the start of each of your turns, heal 1 HP.',
    effects: [{ op: 'apply', status: 'wd_grove', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain 2 Grove Heart: at the start of each of your turns, heal 2 HP.',
      effects: [{ op: 'apply', status: 'wd_grove', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_bramble_wall', name: 'Bramble Wall', class: 'warden', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🌵',
    desc: 'Gain 1 Bramble Wall: whenever you gain Block, deal 1 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'wd_bramble', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain 2 Bramble Wall: whenever you gain Block, deal 2 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'wd_bramble', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_verdant_pact', name: 'Verdant Pact', class: 'warden', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🌷',
    desc: 'Gain 2 Verdant Pact: whenever you play a Skill, heal 2 HP.',
    effects: [{ op: 'apply', status: 'wd_verdant', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Verdant Pact: whenever you play a Skill, heal 3 HP.',
      effects: [{ op: 'apply', status: 'wd_verdant', amount: 3, to: 'self' }]
    }
  });

  // =====================================================================
  // UNCOMMON (31): 11 attacks, 13 skills, 7 powers
  // =====================================================================

  // ---- uncommon attacks ----
  DS.defineCard({
    id: 'wd_ironbark_slam', name: 'Ironbark Slam', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🔨',
    desc: 'Deal damage equal to your Block.',
    effects: [{ op: 'damage', amount: { v: 'block', of: 'self' } }],
    upgrade: {
      cost: 1,
      desc: 'Deal damage equal to your Block, plus 2.',
      effects: [{ op: 'damage', amount: { v: 'block', of: 'self', add: 2 } }]
    }
  });

  DS.defineCard({
    id: 'wd_fortress_charge', name: 'Fortress Charge', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🏰',
    desc: 'Deal 12 damage. Gain 6 Block.',
    effects: [
      { op: 'damage', amount: 12 },
      { op: 'block', amount: 6, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 15 damage. Gain 8 Block.',
      effects: [
        { op: 'damage', amount: 15 },
        { op: 'block', amount: 8, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_thorn_volley', name: 'Thorn Volley', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🏹',
    desc: 'Deal 4 damage to ALL enemies twice.',
    effects: [{ op: 'damage', amount: 4, times: 2, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 4 damage to ALL enemies 3 times.',
      effects: [{ op: 'damage', amount: 4, times: 3, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'wd_barbed_lash', name: 'Barbed Lash', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪝',
    desc: 'Deal 6 damage. If the target is Marked, deal 6 more.',
    effects: [
      { op: 'damage', amount: 6 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'mark', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 6 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 7 damage. If the target is Marked, deal 9 more.',
      effects: [
        { op: 'damage', amount: 7 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'mark', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 9 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_ancient_lash', name: 'Ancient Lash', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🌳',
    desc: 'Deal 5 damage, plus 2 for each Growth you have.',
    effects: [{ op: 'damage', amount: { v: 'status', status: 'wd_growth', of: 'self', mul: 2, add: 5 } }],
    upgrade: {
      desc: 'Deal 6 damage, plus 3 for each Growth you have.',
      effects: [{ op: 'damage', amount: { v: 'status', status: 'wd_growth', of: 'self', mul: 3, add: 6 } }]
    }
  });

  DS.defineCard({
    id: 'wd_briar_barrage', name: 'Briar Barrage', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 'X', target: 'enemy', icon: '🌠',
    desc: 'Spend all your Energy. Deal 5 damage X times.',
    effects: [{ op: 'damage', amount: 5, times: { v: 'x' } }],
    upgrade: {
      desc: 'Spend all your Energy. Deal 6 damage X times.',
      effects: [{ op: 'damage', amount: 6, times: { v: 'x' } }]
    }
  });

  DS.defineCard({
    id: 'wd_lashing_vines', name: 'Lashing Vines', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🎋',
    desc: 'Deal 4 damage 4 times.',
    effects: [{ op: 'damage', amount: 4, times: 4 }],
    upgrade: { desc: 'Deal 5 damage 4 times.', effects: [{ op: 'damage', amount: 5, times: 4 }] }
  });

  DS.defineCard({
    id: 'wd_snaring_thorn', name: 'Snaring Thorn', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪤',
    desc: 'Deal 5 damage. Apply 2 Lock On.',
    effects: [
      { op: 'damage', amount: 5 },
      { op: 'apply', status: 'lock_on', amount: 2, to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 7 damage. Apply 3 Lock On.',
      effects: [
        { op: 'damage', amount: 7 },
        { op: 'apply', status: 'lock_on', amount: 3, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_growing_strike', name: 'Growing Strike', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🌻',
    desc: 'Deal 6 damage. Gain 1 Growth.',
    effects: [
      { op: 'damage', amount: 6 },
      { op: 'apply', status: 'wd_growth', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 8 damage. Gain 2 Growth.',
      effects: [
        { op: 'damage', amount: 8 },
        { op: 'apply', status: 'wd_growth', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_predator_pounce', name: 'Predator Pounce', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🐅',
    desc: 'Deal 8 damage. If the target is Vulnerable, deal 6 more.',
    effects: [
      { op: 'damage', amount: 8 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'vulnerable', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 6 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 10 damage. If the target is Vulnerable, deal 8 more.',
      effects: [
        { op: 'damage', amount: 10 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'vulnerable', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 8 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_mossback_charge', name: 'Mossback Charge', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🦬',
    desc: 'Deal 7 damage. Gain 1 Thorns.',
    effects: [
      { op: 'damage', amount: 7 },
      { op: 'apply', status: 'thorns', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 9 damage. Gain 2 Thorns.',
      effects: [
        { op: 'damage', amount: 9 },
        { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
      ]
    }
  });

  // ---- uncommon skills ----
  DS.defineCard({
    id: 'wd_iron_bulwark', name: 'Iron Bulwark', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🏯',
    desc: 'Gain 12 Block. Gain 1 Thorns.',
    effects: [
      { op: 'block', amount: 12, to: 'self' },
      { op: 'apply', status: 'thorns', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 16 Block. Gain 2 Thorns.',
      effects: [
        { op: 'block', amount: 16, to: 'self' },
        { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_sprouting_wall', name: 'Sprouting Wall', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪴',
    desc: 'Gain 4 Block, plus 2 per Growth you have.',
    effects: [{ op: 'block', amount: { v: 'status', status: 'wd_growth', of: 'self', mul: 2, add: 4 }, to: 'self' }],
    upgrade: {
      desc: 'Gain 5 Block, plus 3 per Growth you have.',
      effects: [{ op: 'block', amount: { v: 'status', status: 'wd_growth', of: 'self', mul: 3, add: 5 }, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_thorn_snare', name: 'Thorn Snare', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🕷️',
    desc: 'Apply 2 Lock On and 1 Mark.',
    effects: [
      { op: 'apply', status: 'lock_on', amount: 2, to: 'target' },
      { op: 'apply', status: 'mark', amount: 1, to: 'target' }
    ],
    upgrade: {
      desc: 'Apply 3 Lock On and 2 Mark.',
      effects: [
        { op: 'apply', status: 'lock_on', amount: 3, to: 'target' },
        { op: 'apply', status: 'mark', amount: 2, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_root_prison', name: 'Root Prison', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '⛓️',
    desc: 'Apply 2 Weak and 2 Vulnerable.',
    effects: [
      { op: 'apply', status: 'weak', amount: 2, to: 'target' },
      { op: 'apply', status: 'vulnerable', amount: 2, to: 'target' }
    ],
    upgrade: {
      desc: 'Apply 3 Weak and 3 Vulnerable.',
      effects: [
        { op: 'apply', status: 'weak', amount: 3, to: 'target' },
        { op: 'apply', status: 'vulnerable', amount: 3, to: 'target' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_mark_prey', name: 'Mark Prey', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'enemy', icon: '🎯',
    desc: 'Apply 3 Mark. Exhaust.',
    exhaust: true,
    effects: [{ op: 'apply', status: 'mark', amount: 3, to: 'target' }],
    upgrade: {
      desc: 'Apply 4 Mark. Exhaust.',
      exhaust: true,
      effects: [{ op: 'apply', status: 'mark', amount: 4, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'wd_compost', name: 'Compost', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🍂',
    desc: 'Exhaust 1 card in your hand. Gain 6 Block.',
    effects: [
      { op: 'exhaust', amount: 1 },
      { op: 'block', amount: 6, to: 'self' }
    ],
    upgrade: {
      desc: 'Exhaust 1 card in your hand. Gain 9 Block.',
      effects: [
        { op: 'exhaust', amount: 1 },
        { op: 'block', amount: 9, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_deep_roots', name: 'Deep Roots', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 'X', target: 'self', icon: '🌄',
    desc: 'Spend all your Energy. Gain 4 Block per Energy spent.',
    effects: [{ op: 'block', amount: { v: 'x', mul: 4 }, to: 'self' }],
    upgrade: {
      desc: 'Spend all your Energy. Gain 5 Block per Energy spent.',
      effects: [{ op: 'block', amount: { v: 'x', mul: 5 }, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_pollinate', name: 'Pollinate', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🐝',
    desc: 'Gain 2 Regen. Add 1 Sprout to your hand.',
    effects: [
      { op: 'apply', status: 'regen', amount: 2, to: 'self' },
      { op: 'add_card', card: 'wd_sprout', to: 'hand', amount: 1 }
    ],
    upgrade: {
      desc: 'Gain 3 Regen. Add 2 Sprouts to your hand.',
      effects: [
        { op: 'apply', status: 'regen', amount: 3, to: 'self' },
        { op: 'add_card', card: 'wd_sprout', to: 'hand', amount: 2 }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_spore_veil', name: 'Spore Veil', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '💨',
    desc: 'Gain 6 Block. Ethereal.',
    ethereal: true,
    effects: [{ op: 'block', amount: 6, to: 'self' }],
    upgrade: {
      desc: 'Gain 9 Block.',
      ethereal: false,
      effects: [{ op: 'block', amount: 9, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_sentinel_bark', name: 'Sentinel Bark', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🗿',
    desc: 'Gain 5 Block. Innate.',
    innate: true,
    effects: [{ op: 'block', amount: 5, to: 'self' }],
    upgrade: {
      desc: 'Gain 7 Block. Innate.',
      innate: true,
      effects: [{ op: 'block', amount: 7, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_sprout_surge', name: 'Sprout Surge', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪻',
    desc: 'Gain 2 Growth. Gain 3 Block.',
    effects: [
      { op: 'apply', status: 'wd_growth', amount: 2, to: 'self' },
      { op: 'block', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 3 Growth. Gain 4 Block.',
      effects: [
        { op: 'apply', status: 'wd_growth', amount: 3, to: 'self' },
        { op: 'block', amount: 4, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_watchful_root', name: 'Watchful Root', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔍',
    desc: 'Gain 4 Block. If you have at least 10 Block, draw 2 cards.',
    effects: [
      { op: 'block', amount: 4, to: 'self' },
      {
        op: 'if',
        cond: { left: { v: 'block', of: 'self' }, cmp: '>=', right: 10 },
        then: [{ op: 'draw', amount: 2 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Gain 5 Block. If you have at least 8 Block, draw 3 cards.',
      effects: [
        { op: 'block', amount: 5, to: 'self' },
        {
          op: 'if',
          cond: { left: { v: 'block', of: 'self' }, cmp: '>=', right: 8 },
          then: [{ op: 'draw', amount: 3 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_barbed_gift', name: 'Barbed Gift', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🎁',
    desc: 'Gain 2 Thorns. Gain 4 Block.',
    effects: [
      { op: 'apply', status: 'thorns', amount: 2, to: 'self' },
      { op: 'block', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 3 Thorns. Gain 6 Block.',
      effects: [
        { op: 'apply', status: 'thorns', amount: 3, to: 'self' },
        { op: 'block', amount: 6, to: 'self' }
      ]
    }
  });

  // ---- uncommon powers ----
  DS.defineCard({
    id: 'wd_hardened_hide', name: 'Hardened Hide', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪨',
    desc: 'Gain 2 Stone Hide. Whenever you are hit by an attack, gain 2 Block.',
    effects: [{ op: 'apply', status: 'wd_stone_hide', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Stone Hide. Whenever you are hit by an attack, gain 3 Block.',
      effects: [{ op: 'apply', status: 'wd_stone_hide', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_power_wild_fury', name: 'Wild Fury', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🌪️',
    desc: 'Gain 2 Wild Fury: whenever you play an attack, gain 2 Block.',
    effects: [{ op: 'apply', status: 'wd_wild_fury', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Wild Fury: whenever you play an attack, gain 3 Block.',
      effects: [{ op: 'apply', status: 'wd_wild_fury', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_seed_of_growth', name: 'Seed of Growth', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🌰',
    desc: 'Gain 2 Growth. Gain 1 Seed of Growth: at the start of each of your turns, gain 1 Growth.',
    effects: [
      { op: 'apply', status: 'wd_growth', amount: 2, to: 'self' },
      { op: 'apply', status: 'wd_seed', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 3 Growth. Gain 2 Seed of Growth: at the start of each of your turns, gain 2 Growth.',
      effects: [
        { op: 'apply', status: 'wd_growth', amount: 3, to: 'self' },
        { op: 'apply', status: 'wd_seed', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_power_thorn_aura', name: 'Thorn Aura', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🥀',
    desc: 'Gain 3 Thorn Aura: at the start of each of your turns, deal 3 damage to ALL enemies.',
    effects: [{ op: 'apply', status: 'wd_thorn_aura', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Gain 4 Thorn Aura: at the start of each of your turns, deal 4 damage to ALL enemies.',
      effects: [{ op: 'apply', status: 'wd_thorn_aura', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_power_spore_cloud', name: 'Spore Cloud', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🍄',
    desc: 'Gain 1 Spore Cloud: at the start of each of your turns, apply 1 Weak to ALL enemies.',
    effects: [{ op: 'apply', status: 'wd_spore_cloud', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain 2 Spore Cloud: at the start of each of your turns, apply 2 Weak to ALL enemies.',
      effects: [{ op: 'apply', status: 'wd_spore_cloud', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_plated_bark', name: 'Plated Bark', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🐢',
    desc: 'Gain 3 Plated Armor: at the end of each of your turns, gain 3 Block. It loses a stack each time an attack damages you.',
    effects: [{ op: 'apply', status: 'plated_armor', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Gain 4 Plated Armor: at the end of each of your turns, gain 4 Block. It loses a stack each time an attack damages you.',
      effects: [{ op: 'apply', status: 'plated_armor', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_living_armor', name: 'Living Armor', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🦔',
    desc: 'Gain 2 Metallicize: at the end of each of your turns, gain 2 Block.',
    effects: [{ op: 'apply', status: 'metallicize', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Metallicize: at the end of each of your turns, gain 3 Block.',
      effects: [{ op: 'apply', status: 'metallicize', amount: 3, to: 'self' }]
    }
  });

  // =====================================================================
  // RARE (16): 6 attacks, 5 skills, 5 powers
  // =====================================================================

  // ---- rare attacks ----
  DS.defineCard({
    id: 'wd_worldroot_slam', name: 'Worldroot Slam', class: 'warden', type: 'attack', rarity: 'rare',
    cost: 3, target: 'enemy', icon: '💥',
    desc: 'Deal damage equal to twice your Block, plus 4.',
    effects: [{ op: 'damage', amount: { v: 'block', of: 'self', mul: 2, add: 4 } }],
    upgrade: {
      cost: 2,
      desc: 'Deal damage equal to twice your Block, plus 6.',
      effects: [{ op: 'damage', amount: { v: 'block', of: 'self', mul: 2, add: 6 } }]
    }
  });

  DS.defineCard({
    id: 'wd_thornstorm', name: 'Thornstorm', class: 'warden', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🌩️',
    desc: 'Deal 5 damage to ALL enemies 3 times.',
    effects: [{ op: 'damage', amount: 5, times: 3, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 5 damage to ALL enemies 4 times.',
      effects: [{ op: 'damage', amount: 5, times: 4, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'wd_gaias_wrath', name: "Gaia's Wrath", class: 'warden', type: 'attack', rarity: 'rare',
    cost: 'X', target: 'all_enemies', icon: '🌋',
    desc: 'Spend all your Energy. Deal 5 damage to ALL enemies X times.',
    effects: [{ op: 'damage', amount: 5, times: { v: 'x' }, to: 'all_enemies' }],
    upgrade: {
      desc: 'Spend all your Energy. Deal 7 damage to ALL enemies X times.',
      effects: [{ op: 'damage', amount: 7, times: { v: 'x' }, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'wd_heartwood_smash', name: 'Heartwood Smash', class: 'warden', type: 'attack', rarity: 'rare',
    cost: 3, target: 'enemy', icon: '🔱',
    desc: 'Deal 14 damage. Gain 2 Growth.',
    effects: [
      { op: 'damage', amount: 14 },
      { op: 'apply', status: 'wd_growth', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 18 damage. Gain 3 Growth.',
      effects: [
        { op: 'damage', amount: 18 },
        { op: 'apply', status: 'wd_growth', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_ancient_judgement', name: 'Ancient Judgement', class: 'warden', type: 'attack', rarity: 'rare',
    cost: 3, target: 'enemy', icon: '☀️',
    desc: 'Deal 14 damage. If the target is Marked, deal 14 more.',
    effects: [
      { op: 'damage', amount: 14 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'mark', of: 'target' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 14 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 16 damage. If the target is Marked, deal 16 more.',
      effects: [
        { op: 'damage', amount: 16 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'mark', of: 'target' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 16 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_thousand_thorns', name: 'Thousand Thorns', class: 'warden', type: 'attack', rarity: 'rare',
    cost: 2, target: 'random_enemy', icon: '✴️',
    desc: 'Deal 3 damage to a random enemy 6 times.',
    effects: [{ op: 'damage', amount: 3, times: 6, to: 'random_enemy' }],
    upgrade: {
      desc: 'Deal 3 damage to a random enemy 8 times.',
      effects: [{ op: 'damage', amount: 3, times: 8, to: 'random_enemy' }]
    }
  });

  // ---- rare skills ----
  DS.defineCard({
    id: 'wd_worldtree_vigil', name: 'Worldtree Vigil', class: 'warden', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🌳',
    desc: 'Gain 14 Block. Heal 5 HP.',
    effects: [
      { op: 'block', amount: 14, to: 'self' },
      { op: 'heal', amount: 5, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 18 Block. Heal 7 HP.',
      effects: [
        { op: 'block', amount: 18, to: 'self' },
        { op: 'heal', amount: 7, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_mending_grove', name: 'Mending Grove', class: 'warden', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🌺',
    desc: 'Heal 8 HP. Gain 2 Regen.',
    effects: [
      { op: 'heal', amount: 8, to: 'self' },
      { op: 'apply', status: 'regen', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Heal 11 HP. Gain 3 Regen.',
      effects: [
        { op: 'heal', amount: 11, to: 'self' },
        { op: 'apply', status: 'regen', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_ancient_quarry', name: 'Ancient Quarry', class: 'warden', type: 'skill', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🔭',
    desc: 'Apply 2 Mark and 2 Lock On to ALL enemies. Exhaust.',
    exhaust: true,
    effects: [
      { op: 'apply', status: 'mark', amount: 2, to: 'all_enemies' },
      { op: 'apply', status: 'lock_on', amount: 2, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Apply 3 Mark and 3 Lock On to ALL enemies. Exhaust.',
      exhaust: true,
      effects: [
        { op: 'apply', status: 'mark', amount: 3, to: 'all_enemies' },
        { op: 'apply', status: 'lock_on', amount: 3, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_shed_bark', name: 'Shed Bark', class: 'warden', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🍁',
    desc: 'Remove Weak and Frail from yourself. Gain 8 Block.',
    effects: [
      { op: 'remove_status', status: 'weak', to: 'self' },
      { op: 'remove_status', status: 'frail', to: 'self' },
      { op: 'block', amount: 8, to: 'self' }
    ],
    upgrade: {
      desc: 'Remove Weak and Frail from yourself. Gain 11 Block.',
      effects: [
        { op: 'remove_status', status: 'weak', to: 'self' },
        { op: 'remove_status', status: 'frail', to: 'self' },
        { op: 'block', amount: 11, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_ancestral_call', name: 'Ancestral Call', class: 'warden', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '📜',
    desc: 'Gain 2 Growth. Draw 2 cards. Exhaust.',
    exhaust: true,
    effects: [
      { op: 'apply', status: 'wd_growth', amount: 2, to: 'self' },
      { op: 'draw', amount: 2 }
    ],
    upgrade: {
      desc: 'Gain 3 Growth. Draw 3 cards. Exhaust.',
      exhaust: true,
      effects: [
        { op: 'apply', status: 'wd_growth', amount: 3, to: 'self' },
        { op: 'draw', amount: 3 }
      ]
    }
  });

  // ---- rare powers ----
  DS.defineCard({
    id: 'wd_enduring_bark', name: 'Enduring Bark', class: 'warden', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '🪵',
    desc: 'Gain 2 Enduring Bark. Whenever you lose HP, gain 2 Block.',
    effects: [{ op: 'apply', status: 'wd_enduring', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Enduring Bark. Whenever you lose HP, gain 3 Block.',
      effects: [{ op: 'apply', status: 'wd_enduring', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_power_predators_bloom', name: "Predator's Bloom", class: 'warden', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '🌸',
    desc: "Gain 1 Predator's Bloom. Whenever you kill an enemy, gain 1 Growth.",
    effects: [{ op: 'apply', status: 'wd_predators_bloom', amount: 1, to: 'self' }],
    upgrade: {
      desc: "Gain 2 Predator's Bloom. Whenever you kill an enemy, gain 2 Growth.",
      effects: [{ op: 'apply', status: 'wd_predators_bloom', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_power_hunters_eye', name: "Hunter's Eye", class: 'warden', type: 'power', rarity: 'rare',
    cost: 1, target: 'self', icon: '👁️',
    desc: "Gain 1 Hunter's Eye. Whenever you play an attack against a Marked enemy, draw 1 card.",
    effects: [{ op: 'apply', status: 'wd_hunters_eye', amount: 1, to: 'self' }],
    upgrade: {
      desc: "Gain 2 Hunter's Eye. Whenever you play an attack against a Marked enemy, draw 2 cards.",
      effects: [{ op: 'apply', status: 'wd_hunters_eye', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_eternal_bulwark', name: 'Eternal Bulwark', class: 'warden', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🏔️',
    desc: 'Gain Barricade and 4 Rooted: at the start of each of your turns, gain 4 Block.',
    effects: [
      { op: 'apply', status: 'barricade', amount: 1, to: 'self' },
      { op: 'apply', status: 'wd_rooted', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain Barricade and 6 Rooted: at the start of each of your turns, gain 6 Block.',
      effects: [
        { op: 'apply', status: 'barricade', amount: 1, to: 'self' },
        { op: 'apply', status: 'wd_rooted', amount: 6, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_ancient_oak', name: 'Ancient Oak', class: 'warden', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🌲',
    desc: 'Gain 10 Max HP (and 10 HP). Gain 2 Grove Heart: at the start of each of your turns, heal 2 HP.',
    effects: [
      { op: 'max_hp', amount: 10 },
      { op: 'apply', status: 'wd_grove', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 14 Max HP (and 14 HP). Gain 3 Grove Heart: at the start of each of your turns, heal 3 HP.',
      effects: [
        { op: 'max_hp', amount: 14 },
        { op: 'apply', status: 'wd_grove', amount: 3, to: 'self' }
      ]
    }
  });

  // =====================================================================
  // SPECIAL (token, never offered): created by Pollinate
  // =====================================================================

  DS.defineCard({
    id: 'wd_sprout', name: 'Sprout', class: 'warden', type: 'skill', rarity: 'special',
    cost: 0, target: 'self', icon: '🌱',
    desc: 'Gain 3 Block. Exhaust.',
    exhaust: true,
    effects: [{ op: 'block', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Gain 5 Block. Exhaust.',
      exhaust: true,
      effects: [{ op: 'block', amount: 5, to: 'self' }]
    }
  });
})();
