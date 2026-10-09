(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // ARTIFICER: Ottilie Brass, the Brass-Fingered Inventor.
  // Three archetypes that also cross over:
  //   Constructs : turrets that live on the player and act every turn (af_sentry, af_bulwark, af_vent,
  //                af_mender, af_lattice). Cards install them and detonate or scale them.
  //   Overclock  : extra Energy or cards now, paid for with Strain (af_strain), a self debuff that bleeds
  //                HP at the end of the turn. Core, Afterburner and Heat Sink turn Strain into a payoff.
  //   Scrap      : cards exhaust other cards (or themselves) for payoffs. Salvage, Scrapyard and Recycler
  //                react to exhaust. Payoffs count cards exhausted this combat (the exhaust pile).
  //   Crossovers : Salvage Turret (exhaust builds Sentries), Gearbox and Assembly Line (skill and turn
  //                engines), Pressure Valve (HP loss becomes Block).
  // Id prefix af_. Statuses use the same prefix; no status id equals a card id.
  // ---------------------------------------------------------------------------

  DS.defineCharacter({
    id: 'artificer',
    name: 'Ottilie Brass',
    title: 'The Brass-Fingered Inventor',
    desc: 'A tinkerer whose workshop never sleeps. Deploys Constructs that fight for her every turn, overclocks her own body for bursts of Energy, and turns spent cards into scrap that powers the next machine.',
    hp: 76,
    gold: 99,
    icon: '⚙️',
    color: '#d08a2e',
    starterDeck: [
      'af_strike', 'af_strike', 'af_strike', 'af_strike', 'af_strike',
      'af_defend', 'af_defend', 'af_defend', 'af_defend',
      'af_wrench_jab', 'af_sentry_kit'
    ],
    starterRelic: 'af_spare_gears'
  });

  // ===========================================================================
  // RELICS (5): starter, common, uncommon, rare, boss
  // ===========================================================================
  DS.defineRelic({
    id: 'af_spare_gears',
    name: 'Spare Gears',
    desc: 'At the start of each combat, gain 1 Sentry Turret. Whenever you exhaust a card, gain 1 Block.',
    flavor: 'Every workshop keeps a drawer of parts that might be useful someday. Someday is today.',
    rarity: 'starter',
    icon: '🔩',
    class: 'artificer',
    passive: {},
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'af_sentry', amount: 1, to: 'self' }],
      onCardExhausted: [{ op: 'block', amount: 1, to: 'self' }]
    }
  });

  DS.defineRelic({
    id: 'af_lucky_rivet',
    name: 'Lucky Rivet',
    desc: 'The first card you exhaust each turn draws 1 card.',
    flavor: 'It fell out of a machine that was working perfectly, which is how you know it was lucky.',
    rarity: 'common',
    icon: '🍀',
    class: 'artificer',
    passive: {},
    triggers: {
      onCardExhausted: {
        oncePerTurn: true,
        effects: [{ op: 'draw', amount: 1 }]
      }
    }
  });

  DS.defineRelic({
    id: 'af_coolant_pump',
    name: 'Coolant Pump',
    desc: 'At the end of each turn, if you have no Strain, gain 4 Block.',
    flavor: 'It hums quietly when the machines are running cool, and rattles when they are not.',
    rarity: 'uncommon',
    icon: '🧪',
    class: 'artificer',
    passive: {},
    triggers: {
      onTurnEnd: [
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'af_strain', of: 'self' }, cmp: '==', right: 0 },
          then: [{ op: 'block', amount: 4, to: 'self' }],
          else: []
        }
      ]
    }
  });

  DS.defineRelic({
    id: 'af_gyro_compass',
    name: 'Gyro Compass',
    desc: 'At the start of every second turn, gain 1 Sentry Turret.',
    flavor: 'It always points toward the next thing that needs shooting.',
    rarity: 'rare',
    icon: '🧭',
    class: 'artificer',
    passive: {},
    triggers: {
      onTurnStart: {
        every: 2,
        effects: [{ op: 'apply', status: 'af_sentry', amount: 1, to: 'self' }]
      }
    }
  });

  DS.defineRelic({
    id: 'af_grand_forge',
    name: 'Master Forge',
    desc: 'Gain 1 additional Energy each turn. At the start of each combat, gain 2 Bulwark Plating.',
    flavor: 'The forge that built the first machine is still hot. It has never been let out.',
    rarity: 'boss',
    icon: '🔥',
    class: 'artificer',
    passive: { energy: 1 },
    triggers: {
      onCombatStart: [{ op: 'apply', status: 'af_bulwark', amount: 2, to: 'self' }]
    }
  });

  // ===========================================================================
  // CUSTOM STATUSES (16). Install cards apply these to self.
  // ===========================================================================

  // ----- Constructs: turrets that act on their own each turn -----

  // Sentry: a turret that fires at the start of your turn.
  DS.defineStatus({
    id: 'af_sentry',
    name: 'Sentry Turret',
    type: 'buff',
    icon: '🤖',
    stacks: true,
    desc: 'At the start of your turn, deal {n} damage to a random enemy.',
    triggers: {
      onTurnStart: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
    }
  });

  // Bulwark: a plate that rebuilds block at the start of your turn.
  DS.defineStatus({
    id: 'af_bulwark',
    name: 'Bulwark Plating',
    type: 'buff',
    icon: '🧱',
    stacks: true,
    desc: 'At the start of your turn, gain {n} Block.',
    triggers: {
      onTurnStart: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Vent: releases heat over every enemy at the end of your turn.
  DS.defineStatus({
    id: 'af_vent',
    name: 'Ember Vent',
    type: 'buff',
    icon: '🌋',
    stacks: true,
    desc: 'At the end of your turn, deal {n} damage to ALL enemies.',
    triggers: {
      onTurnEnd: [{ op: 'damage', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  // Mender: a drone that repairs you at the end of your turn.
  DS.defineStatus({
    id: 'af_mender',
    name: 'Repair Drone',
    type: 'buff',
    icon: '🩺',
    stacks: true,
    desc: 'At the end of your turn, heal {n} HP.',
    triggers: {
      onTurnEnd: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Lattice: a drone that feeds you cards at the start of your turn.
  DS.defineStatus({
    id: 'af_lattice',
    name: 'Lattice Drone',
    type: 'buff',
    icon: '🧩',
    stacks: true,
    desc: 'At the start of your turn, draw {n} card(s).',
    triggers: {
      onTurnStart: [{ op: 'draw', amount: { v: 'stacks' } }]
    }
  });

  // ----- Overclock: Energy and cards now, Strain later -----

  // Strain: the bill for overclocking. Costs its stacks in HP once at the end of your turn, then all of it fades.
  DS.defineStatus({
    id: 'af_strain',
    name: 'Strain',
    type: 'debuff',
    icon: '🌡️',
    stacks: true,
    expire: 'turn_end',
    desc: 'At the end of your turn, lose {n} HP. Then all Strain fades.',
    triggers: {
      onTurnEnd: [{ op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Overclock Core: a standing overclock that pays Energy every turn and adds a Strain.
  DS.defineStatus({
    id: 'af_surge_core',
    name: 'Overclock Core',
    type: 'buff',
    icon: '🔁',
    stacks: true,
    desc: 'At the start of your turn, gain {n} Energy and gain 1 Strain.',
    triggers: {
      onTurnStart: [
        { op: 'energy', amount: { v: 'stacks' } },
        { op: 'apply', status: 'af_strain', amount: 1, to: 'self' }
      ]
    }
  });

  // Afterburner: an attack on overclocked hardware returns Energy, once per turn.
  DS.defineStatus({
    id: 'af_afterburner',
    name: 'Afterburner',
    type: 'buff',
    icon: '🚀',
    stacks: true,
    desc: 'Once per turn, when you play an Attack, gain {n} Energy.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        oncePerTurn: true,
        effects: [{ op: 'energy', amount: { v: 'stacks' } }]
      }
    }
  });

  // Heat Sink: losing HP vents heat into a card, once per turn.
  DS.defineStatus({
    id: 'af_heat_sink',
    name: 'Heat Sink',
    type: 'buff',
    icon: '♨️',
    stacks: true,
    desc: 'Once per turn, when you lose HP, draw {n} card(s).',
    triggers: {
      onDamaged: {
        oncePerTurn: true,
        effects: [{ op: 'draw', amount: { v: 'stacks' } }]
      }
    }
  });

  // ----- Scrap: exhaust for payoff -----

  // Salvage Plate: exhausted cards leave behind armour.
  DS.defineStatus({
    id: 'af_salvage',
    name: 'Salvage Plate',
    type: 'buff',
    icon: '♻️',
    stacks: true,
    desc: 'Whenever you exhaust a card, gain {n} Block.',
    triggers: {
      onCardExhausted: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Scrapyard: exhausted cards are fired at the nearest enemy.
  DS.defineStatus({
    id: 'af_scrapyard',
    name: 'Scrapyard',
    type: 'buff',
    icon: '🗑️',
    stacks: true,
    desc: 'Whenever you exhaust a card, deal {n} damage to a random enemy.',
    triggers: {
      onCardExhausted: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
    }
  });

  // Recycler: exhausting a card digs out a fresh one.
  DS.defineStatus({
    id: 'af_recycler',
    name: 'Recycler',
    type: 'buff',
    icon: '🪣',
    stacks: true,
    desc: 'Whenever you exhaust a card, draw {n} card(s).',
    triggers: {
      onCardExhausted: [{ op: 'draw', amount: { v: 'stacks' } }]
    }
  });

  // ----- Crossovers -----

  // Salvage Turret: scrap becomes Sentries (cross: Scrap feeds Constructs).
  DS.defineStatus({
    id: 'af_salvage_turret',
    name: 'Salvage Turret',
    type: 'buff',
    icon: '🏗️',
    stacks: true,
    desc: 'Whenever you exhaust a card, gain {n} Sentry Turret.',
    triggers: {
      onCardExhausted: [{ op: 'apply', status: 'af_sentry', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Gearbox: skills become Block (cross: Skills feed Block).
  DS.defineStatus({
    id: 'af_gearbox',
    name: 'Gearbox',
    type: 'buff',
    icon: '⚙️',
    stacks: true,
    desc: 'Whenever you play a Skill, gain {n} Block.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // Assembly Line: a standing supply of Spare Parts.
  DS.defineStatus({
    id: 'af_assembly_line',
    name: 'Assembly Line',
    type: 'buff',
    icon: '🏭',
    stacks: true,
    desc: 'At the start of your turn, add {n} Spare Part(s) to your hand.',
    triggers: {
      onTurnStart: [{ op: 'add_card', card: 'af_spare_part', to: 'hand', amount: { v: 'stacks' } }]
    }
  });

  // Pressure Valve: HP lost is turned into Block (cross: Overclock feeds Block).
  DS.defineStatus({
    id: 'af_pressure',
    name: 'Pressure Valve',
    type: 'buff',
    icon: '🚰',
    stacks: true,
    desc: 'Whenever you lose HP, gain {n} Block.',
    triggers: {
      onDamaged: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // ===========================================================================
  // STARTER CARDS (4 distinct; deck = 5 Strike, 4 Defend, 2 signatures)
  // ===========================================================================
  DS.defineCard({
    id: 'af_strike', name: 'Strike', class: 'artificer', type: 'attack', rarity: 'starter',
    cost: 1, target: 'enemy', icon: '🗡️',
    desc: 'Deal 6 damage.',
    effects: [{ op: 'damage', amount: 6 }],
    upgrade: { desc: 'Deal 9 damage.', effects: [{ op: 'damage', amount: 9 }] }
  });

  DS.defineCard({
    id: 'af_defend', name: 'Defend', class: 'artificer', type: 'skill', rarity: 'starter',
    cost: 1, target: 'self', icon: '🛡️',
    desc: 'Gain 5 Block.',
    effects: [{ op: 'block', amount: 5, to: 'self' }],
    upgrade: { desc: 'Gain 8 Block.', effects: [{ op: 'block', amount: 8, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_wrench_jab', name: 'Wrench Jab', class: 'artificer', type: 'attack', rarity: 'starter',
    cost: 1, target: 'enemy', icon: '🔧',
    desc: 'Deal 5 damage. Gain 2 Block.',
    effects: [{ op: 'damage', amount: 5 }, { op: 'block', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Deal 7 damage. Gain 3 Block.',
      effects: [{ op: 'damage', amount: 7 }, { op: 'block', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'af_sentry_kit', name: 'Sentry Kit', class: 'artificer', type: 'skill', rarity: 'starter',
    cost: 1, target: 'self', icon: '🤖',
    desc: 'Gain 3 Sentry Turret.',
    effects: [{ op: 'apply', status: 'af_sentry', amount: 3, to: 'self' }],
    upgrade: { desc: 'Gain 4 Sentry Turret.', effects: [{ op: 'apply', status: 'af_sentry', amount: 4, to: 'self' }] }
  });

  // ===========================================================================
  // COMMON (25): 10 attacks, 8 skills, 7 powers
  // ===========================================================================

  // ----- common attacks (10) -----
  DS.defineCard({
    id: 'af_pneumatic_hammer', name: 'Pneumatic Hammer', class: 'artificer', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🔨',
    desc: 'Deal 9 damage. If you have a Sentry Turret, deal 4 more.',
    effects: [
      { op: 'damage', amount: 9 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'af_sentry', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 4 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 12 damage. If you have a Sentry Turret, deal 5 more.',
      effects: [
        { op: 'damage', amount: 12 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'af_sentry', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 5 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'af_rivet_gun', name: 'Rivet Gun', class: 'artificer', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🔫',
    desc: 'Deal 4 damage twice.',
    effects: [{ op: 'damage', amount: 4, times: 2 }],
    upgrade: { desc: 'Deal 5 damage twice.', effects: [{ op: 'damage', amount: 5, times: 2 }] }
  });

  DS.defineCard({
    id: 'af_piston_punch', name: 'Hydraulic Punch', class: 'artificer', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🦾',
    desc: 'Deal 7 damage. Gain 2 Block.',
    effects: [{ op: 'damage', amount: 7 }, { op: 'block', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Deal 9 damage. Gain 3 Block.',
      effects: [{ op: 'damage', amount: 9 }, { op: 'block', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'af_grapple_hook', name: 'Grapple Hook', class: 'artificer', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🪝',
    desc: 'Deal 6 damage. Apply 1 Vulnerable.',
    effects: [{ op: 'damage', amount: 6 }, { op: 'apply', status: 'vulnerable', amount: 1, to: 'target' }],
    upgrade: {
      desc: 'Deal 8 damage. Apply 2 Vulnerable.',
      effects: [{ op: 'damage', amount: 8 }, { op: 'apply', status: 'vulnerable', amount: 2, to: 'target' }]
    }
  });

  DS.defineCard({
    id: 'af_scrap_cutter', name: 'Scrap Cutter', class: 'artificer', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '✂️',
    desc: 'Exhaust 1 card from your hand. Deal 10 damage.',
    effects: [{ op: 'exhaust', amount: 1 }, { op: 'damage', amount: 10 }],
    upgrade: { desc: 'Exhaust 1 card from your hand. Deal 13 damage.', effects: [{ op: 'exhaust', amount: 1 }, { op: 'damage', amount: 13 }] }
  });

  DS.defineCard({
    id: 'af_arc_coil', name: 'Arc Coil', class: 'artificer', type: 'attack', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '🧲',
    desc: 'Deal 6 damage to ALL enemies. Gain 1 Strain.',
    effects: [{ op: 'damage', amount: 6, to: 'all_enemies' }, { op: 'apply', status: 'af_strain', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Deal 8 damage to ALL enemies. Gain 1 Strain.',
      effects: [{ op: 'damage', amount: 8, to: 'all_enemies' }, { op: 'apply', status: 'af_strain', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'af_jackhammer', name: 'Jackhammer', class: 'artificer', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🪚',
    desc: 'Deal 4 damage 3 times.',
    effects: [{ op: 'damage', amount: 4, times: 3 }],
    upgrade: { desc: 'Deal 5 damage 3 times.', effects: [{ op: 'damage', amount: 5, times: 3 }] }
  });

  DS.defineCard({
    id: 'af_cannon_shot', name: 'Cannon Shot', class: 'artificer', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '💥', exhaust: true,
    desc: 'Deal 12 damage. Exhaust.',
    effects: [{ op: 'damage', amount: 12 }],
    upgrade: { desc: 'Deal 15 damage. Exhaust.', effects: [{ op: 'damage', amount: 15 }] }
  });

  DS.defineCard({
    id: 'af_gear_lash', name: 'Gear Lash', class: 'artificer', type: 'attack', rarity: 'common',
    cost: 1, target: 'random_enemy', icon: '⚙️',
    desc: 'Deal 7 damage to a random enemy. Exhaust 1 random card from your draw pile.',
    effects: [
      { op: 'damage', amount: 7, to: 'random_enemy' },
      { op: 'exhaust', amount: 1, from: 'draw', random: true }
    ],
    upgrade: {
      desc: 'Deal 9 damage to a random enemy. Exhaust 1 random card from your draw pile.',
      effects: [
        { op: 'damage', amount: 9, to: 'random_enemy' },
        { op: 'exhaust', amount: 1, from: 'draw', random: true }
      ]
    }
  });

  DS.defineCard({
    id: 'af_sparkplug', name: 'Sparkplug', class: 'artificer', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '✨',
    desc: 'Deal 4 damage. Gain 1 Strain.',
    effects: [{ op: 'damage', amount: 4 }, { op: 'apply', status: 'af_strain', amount: 1, to: 'self' }],
    upgrade: { desc: 'Deal 6 damage. Gain 1 Strain.', effects: [{ op: 'damage', amount: 6 }, { op: 'apply', status: 'af_strain', amount: 1, to: 'self' }] }
  });

  // ----- common skills (8) -----
  DS.defineCard({
    id: 'af_plating_patch', name: 'Plating Patch', class: 'artificer', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🩹', exhaust: true,
    desc: 'Gain 7 Block. Exhaust.',
    effects: [{ op: 'block', amount: 7, to: 'self' }],
    upgrade: { desc: 'Gain 10 Block. Exhaust.', effects: [{ op: 'block', amount: 10, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_toolbox', name: 'Toolbox', class: 'artificer', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🧰',
    desc: 'Exhaust 1 card from your hand. Draw 2 cards.',
    effects: [{ op: 'exhaust', amount: 1 }, { op: 'draw', amount: 2 }],
    upgrade: { desc: 'Exhaust 1 card from your hand. Draw 3 cards.', effects: [{ op: 'exhaust', amount: 1 }, { op: 'draw', amount: 3 }] }
  });

  DS.defineCard({
    id: 'af_overclock_jolt', name: 'Overclock Jolt', class: 'artificer', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🔌',
    desc: 'Gain 1 Energy. Gain 1 Strain.',
    effects: [{ op: 'energy', amount: 1 }, { op: 'apply', status: 'af_strain', amount: 1, to: 'self' }],
    upgrade: { desc: 'Gain 2 Energy. Gain 1 Strain.', effects: [{ op: 'energy', amount: 2 }, { op: 'apply', status: 'af_strain', amount: 1, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_spare_bolts', name: 'Spare Bolts', class: 'artificer', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🔗',
    desc: 'Gain 4 Block. Add 1 Spare Part to your hand.',
    effects: [{ op: 'block', amount: 4, to: 'self' }, { op: 'add_card', card: 'af_spare_part', to: 'hand', amount: 1 }],
    upgrade: {
      desc: 'Gain 6 Block. Add 2 Spare Parts to your hand.',
      effects: [{ op: 'block', amount: 6, to: 'self' }, { op: 'add_card', card: 'af_spare_part', to: 'hand', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'af_quick_patch', name: 'Quick Patch', class: 'artificer', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '💊',
    desc: 'Heal 4 HP. Gain 3 Block.',
    effects: [{ op: 'heal', amount: 4, to: 'self' }, { op: 'block', amount: 3, to: 'self' }],
    upgrade: { desc: 'Heal 6 HP. Gain 4 Block.', effects: [{ op: 'heal', amount: 6, to: 'self' }, { op: 'block', amount: 4, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_scavenge', name: 'Scrap Forage', class: 'artificer', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🧺',
    desc: 'Exhaust 1 card from your hand. Draw 1 card.',
    effects: [{ op: 'exhaust', amount: 1 }, { op: 'draw', amount: 1 }],
    upgrade: { desc: 'Exhaust 1 card from your hand. Draw 2 cards.', effects: [{ op: 'exhaust', amount: 1 }, { op: 'draw', amount: 2 }] }
  });

  DS.defineCard({
    id: 'af_tune_up', name: 'Tune Up', class: 'artificer', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🎛️',
    desc: 'Gain 5 Block. If you have a Sentry Turret, gain 3 more Block.',
    effects: [
      { op: 'block', amount: 5, to: 'self' },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'af_sentry', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'block', amount: 3, to: 'self' }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Gain 7 Block. If you have a Sentry Turret, gain 4 more Block.',
      effects: [
        { op: 'block', amount: 7, to: 'self' },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'af_sentry', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'block', amount: 4, to: 'self' }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'af_hot_wire', name: 'Hot Wire', class: 'artificer', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🪢',
    desc: 'Draw 2 cards. Gain 1 Strain.',
    effects: [{ op: 'draw', amount: 2 }, { op: 'apply', status: 'af_strain', amount: 1, to: 'self' }],
    upgrade: { desc: 'Draw 3 cards. Gain 1 Strain.', effects: [{ op: 'draw', amount: 3 }, { op: 'apply', status: 'af_strain', amount: 1, to: 'self' }] }
  });

  // ----- common powers (7) -----
  DS.defineCard({
    id: 'af_install_plating', name: 'Install Plating', class: 'artificer', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🧱',
    desc: 'At the start of your turn, gain 3 Block.',
    effects: [{ op: 'apply', status: 'af_bulwark', amount: 3, to: 'self' }],
    upgrade: { desc: 'At the start of your turn, gain 4 Block.', effects: [{ op: 'apply', status: 'af_bulwark', amount: 4, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_install_vent', name: 'Install Vent', class: 'artificer', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🌋',
    desc: 'At the end of your turn, deal 2 damage to ALL enemies.',
    effects: [{ op: 'apply', status: 'af_vent', amount: 2, to: 'self' }],
    upgrade: { desc: 'At the end of your turn, deal 3 damage to ALL enemies.', effects: [{ op: 'apply', status: 'af_vent', amount: 3, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_install_mender', name: 'Install Mender', class: 'artificer', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🩺',
    desc: 'At the end of your turn, heal 3 HP.',
    effects: [{ op: 'apply', status: 'af_mender', amount: 3, to: 'self' }],
    upgrade: { desc: 'At the end of your turn, heal 4 HP.', effects: [{ op: 'apply', status: 'af_mender', amount: 4, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_gearbox_rig', name: 'Gearbox Rig', class: 'artificer', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '⚙️',
    desc: 'Whenever you play a Skill, gain 2 Block.',
    effects: [{ op: 'apply', status: 'af_gearbox', amount: 2, to: 'self' }],
    upgrade: { desc: 'Whenever you play a Skill, gain 3 Block.', effects: [{ op: 'apply', status: 'af_gearbox', amount: 3, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_salvage_rig', name: 'Salvage Rig', class: 'artificer', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '♻️',
    desc: 'Whenever you exhaust a card, gain 2 Block.',
    effects: [{ op: 'apply', status: 'af_salvage', amount: 2, to: 'self' }],
    upgrade: { desc: 'Whenever you exhaust a card, gain 3 Block.', effects: [{ op: 'apply', status: 'af_salvage', amount: 3, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_scrap_rig', name: 'Scrap Rig', class: 'artificer', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🗑️',
    desc: 'Whenever you exhaust a card, deal 2 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'af_scrapyard', amount: 2, to: 'self' }],
    upgrade: { desc: 'Whenever you exhaust a card, deal 3 damage to a random enemy.', effects: [{ op: 'apply', status: 'af_scrapyard', amount: 3, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_pressure_rig', name: 'Pressure Rig', class: 'artificer', type: 'power', rarity: 'common',
    cost: 1, target: 'self', icon: '🚰',
    desc: 'Whenever you lose HP, gain 2 Block.',
    effects: [{ op: 'apply', status: 'af_pressure', amount: 2, to: 'self' }],
    upgrade: { desc: 'Whenever you lose HP, gain 3 Block.', effects: [{ op: 'apply', status: 'af_pressure', amount: 3, to: 'self' }] }
  });

  // ===========================================================================
  // UNCOMMON (28): 11 attacks, 10 skills, 7 powers
  // ===========================================================================

  // ----- uncommon attacks (11) -----
  DS.defineCard({
    id: 'af_overload_strike', name: 'Overload Strike', class: 'artificer', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🔥',
    desc: 'Deal 12 damage. Gain 2 Strain.',
    effects: [{ op: 'damage', amount: 12 }, { op: 'apply', status: 'af_strain', amount: 2, to: 'self' }],
    upgrade: { desc: 'Deal 16 damage. Gain 2 Strain.', effects: [{ op: 'damage', amount: 16 }, { op: 'apply', status: 'af_strain', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_sentry_barrage', name: 'Sentry Barrage', class: 'artificer', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🎆',
    desc: 'Deal 3 damage to ALL enemies for each Sentry Turret you have.',
    effects: [{ op: 'damage', amount: { v: 'status', status: 'af_sentry', of: 'self', mul: 3 }, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 4 damage to ALL enemies for each Sentry Turret you have.',
      effects: [{ op: 'damage', amount: { v: 'status', status: 'af_sentry', of: 'self', mul: 4 }, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'af_piston_lance', name: 'Piston Lance', class: 'artificer', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🦿',
    desc: 'Deal 9 damage. If you have Strain, deal 6 more.',
    effects: [
      { op: 'damage', amount: 9 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'af_strain', of: 'self' }, cmp: '>', right: 0 },
        then: [{ op: 'damage', amount: 6 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 12 damage. If you have Strain, deal 8 more.',
      effects: [
        { op: 'damage', amount: 12 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'af_strain', of: 'self' }, cmp: '>', right: 0 },
          then: [{ op: 'damage', amount: 8 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'af_rotary_saw', name: 'Rotary Saw', class: 'artificer', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪒',
    desc: 'Deal 5 damage 2 times. Exhaust 1 card from your hand.',
    effects: [{ op: 'damage', amount: 5, times: 2 }, { op: 'exhaust', amount: 1 }],
    upgrade: { desc: 'Deal 6 damage 2 times. Exhaust 1 card from your hand.', effects: [{ op: 'damage', amount: 6, times: 2 }, { op: 'exhaust', amount: 1 }] }
  });

  DS.defineCard({
    id: 'af_scrap_storm', name: 'Scrap Storm', class: 'artificer', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all_enemies', icon: '🧹',
    desc: 'Deal 2 damage to ALL enemies for each card exhausted this combat.',
    effects: [{ op: 'damage', amount: { v: 'exhaust_pile', mul: 2 }, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 3 damage to ALL enemies for each card exhausted this combat.',
      effects: [{ op: 'damage', amount: { v: 'exhaust_pile', mul: 3 }, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'af_cog_slash', name: 'Cog Slash', class: 'artificer', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪛',
    desc: 'Deal 5 damage. Deal 3 more damage for each card exhausted this combat.',
    effects: [{ op: 'damage', amount: 5 }, { op: 'damage', amount: { v: 'exhaust_pile', mul: 3 } }],
    upgrade: {
      desc: 'Deal 6 damage. Deal 4 more damage for each card exhausted this combat.',
      effects: [{ op: 'damage', amount: 6 }, { op: 'damage', amount: { v: 'exhaust_pile', mul: 4 } }]
    }
  });

  DS.defineCard({
    id: 'af_hot_piston', name: 'Hot Piston', class: 'artificer', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🌡️',
    desc: 'Deal 9 damage. Lose 2 HP.',
    effects: [{ op: 'damage', amount: 9 }, { op: 'lose_hp', amount: 2, to: 'self' }],
    upgrade: { desc: 'Deal 12 damage. Lose 2 HP.', effects: [{ op: 'damage', amount: 12 }, { op: 'lose_hp', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_shrapnel_burst', name: 'Shrapnel Burst', class: 'artificer', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '💠',
    desc: 'Deal 5 damage to ALL enemies. Exhaust 1 card from your hand.',
    effects: [{ op: 'damage', amount: 5, to: 'all_enemies' }, { op: 'exhaust', amount: 1 }],
    upgrade: {
      desc: 'Deal 7 damage to ALL enemies. Exhaust 1 card from your hand.',
      effects: [{ op: 'damage', amount: 7, to: 'all_enemies' }, { op: 'exhaust', amount: 1 }]
    }
  });

  DS.defineCard({
    id: 'af_thermite_burst', name: 'Thermite Burst', class: 'artificer', type: 'attack', rarity: 'uncommon',
    cost: 'X', target: 'enemy', icon: '☄️', exhaust: true,
    desc: 'Spend all Energy. Deal 5 damage once per Energy spent. Exhaust.',
    effects: [{ op: 'damage', amount: 5, times: { v: 'x' } }],
    upgrade: {
      desc: 'Spend all Energy. Deal 7 damage once per Energy spent. Exhaust.',
      effects: [{ op: 'damage', amount: 7, times: { v: 'x' } }]
    }
  });

  DS.defineCard({
    id: 'af_bolt_gatling', name: 'Bolt Gatling', class: 'artificer', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '🎰',
    desc: 'Deal 3 damage 4 times. Gain 1 Strain.',
    effects: [{ op: 'damage', amount: 3, times: 4 }, { op: 'apply', status: 'af_strain', amount: 1, to: 'self' }],
    upgrade: { desc: 'Deal 4 damage 4 times. Gain 1 Strain.', effects: [{ op: 'damage', amount: 4, times: 4 }, { op: 'apply', status: 'af_strain', amount: 1, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_magnetic_pull', name: 'Magnetic Pull', class: 'artificer', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪄',
    desc: 'Deal 6 damage. Exhaust 1 card from your hand. Draw 2 cards.',
    effects: [{ op: 'damage', amount: 6 }, { op: 'exhaust', amount: 1 }, { op: 'draw', amount: 2 }],
    upgrade: {
      desc: 'Deal 8 damage. Exhaust 1 card from your hand. Draw 3 cards.',
      effects: [{ op: 'damage', amount: 8 }, { op: 'exhaust', amount: 1 }, { op: 'draw', amount: 3 }]
    }
  });

  // ----- uncommon skills (10) -----
  DS.defineCard({
    id: 'af_recycle_bin', name: 'Recycle Bin', class: 'artificer', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🗑️',
    desc: 'Exhaust 2 cards from your hand. Gain 2 Energy.',
    effects: [{ op: 'exhaust', amount: 2 }, { op: 'energy', amount: 2 }],
    upgrade: { desc: 'Exhaust 2 cards from your hand. Gain 3 Energy.', effects: [{ op: 'exhaust', amount: 2 }, { op: 'energy', amount: 3 }] }
  });

  DS.defineCard({
    id: 'af_grid_shield', name: 'Grid Shield', class: 'artificer', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🔰',
    desc: 'Gain 10 Block. Gain 2 Strain.',
    effects: [{ op: 'block', amount: 10, to: 'self' }, { op: 'apply', status: 'af_strain', amount: 2, to: 'self' }],
    upgrade: { desc: 'Gain 14 Block. Gain 2 Strain.', effects: [{ op: 'block', amount: 14, to: 'self' }, { op: 'apply', status: 'af_strain', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_emergency_coolant', name: 'Emergency Coolant', class: 'artificer', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🫗',
    desc: 'Remove all Strain. Gain 8 Block.',
    effects: [{ op: 'remove_status', status: 'af_strain', to: 'self' }, { op: 'block', amount: 8, to: 'self' }],
    upgrade: { desc: 'Remove all Strain. Gain 11 Block.', effects: [{ op: 'remove_status', status: 'af_strain', to: 'self' }, { op: 'block', amount: 11, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_turret_array', name: 'Turret Array', class: 'artificer', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🗼',
    desc: 'Gain 2 Sentry Turret. Gain 2 Bulwark Plating.',
    effects: [{ op: 'apply', status: 'af_sentry', amount: 2, to: 'self' }, { op: 'apply', status: 'af_bulwark', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Sentry Turret. Gain 3 Bulwark Plating.',
      effects: [{ op: 'apply', status: 'af_sentry', amount: 3, to: 'self' }, { op: 'apply', status: 'af_bulwark', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'af_parts_bin', name: 'Parts Bin', class: 'artificer', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '📦',
    desc: 'Add 2 Spare Parts to your draw pile.',
    effects: [{ op: 'add_card', card: 'af_spare_part', to: 'draw', amount: 2 }],
    upgrade: { desc: 'Add 3 Spare Parts to your draw pile.', effects: [{ op: 'add_card', card: 'af_spare_part', to: 'draw', amount: 3 }] }
  });

  DS.defineCard({
    id: 'af_surge_burst', name: 'Surge Burst', class: 'artificer', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'self', icon: '🌟', exhaust: true,
    desc: 'Gain 3 Energy. Gain 2 Strain. Exhaust.',
    effects: [{ op: 'energy', amount: 3 }, { op: 'apply', status: 'af_strain', amount: 2, to: 'self' }],
    upgrade: { desc: 'Gain 4 Energy. Gain 2 Strain. Exhaust.', effects: [{ op: 'energy', amount: 4 }, { op: 'apply', status: 'af_strain', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_oil_slick', name: 'Oil Slick', class: 'artificer', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '🛢️',
    desc: 'Apply 1 Weak to ALL enemies. Gain 3 Block.',
    effects: [{ op: 'apply', status: 'weak', amount: 1, to: 'all_enemies' }, { op: 'block', amount: 3, to: 'self' }],
    upgrade: {
      desc: 'Apply 2 Weak to ALL enemies. Gain 4 Block.',
      effects: [{ op: 'apply', status: 'weak', amount: 2, to: 'all_enemies' }, { op: 'block', amount: 4, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'af_field_repair', name: 'Field Repair', class: 'artificer', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🛠️', exhaust: true,
    desc: 'Heal 5 HP. Exhaust.',
    effects: [{ op: 'heal', amount: 5, to: 'self' }],
    upgrade: { desc: 'Heal 8 HP. Exhaust.', effects: [{ op: 'heal', amount: 8, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_surge_capacitor', name: 'Surge Capacitor', class: 'artificer', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔋', exhaust: true,
    desc: 'Gain 2 Energy. Exhaust.',
    effects: [{ op: 'energy', amount: 2 }],
    upgrade: { desc: 'Gain 3 Energy. Exhaust.', effects: [{ op: 'energy', amount: 3 }] }
  });

  DS.defineCard({
    id: 'af_spring_loader', name: 'Spring Loader', class: 'artificer', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪤',
    desc: 'Gain 4 Block. Next turn, draw 2 more cards.',
    effects: [{ op: 'block', amount: 4, to: 'self' }, { op: 'apply', status: 'draw_next', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 6 Block. Next turn, draw 3 more cards.',
      effects: [{ op: 'block', amount: 6, to: 'self' }, { op: 'apply', status: 'draw_next', amount: 3, to: 'self' }]
    }
  });

  // ----- uncommon powers (7) -----
  DS.defineCard({
    id: 'af_install_lattice', name: 'Install Lattice', class: 'artificer', type: 'power', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🧩',
    desc: 'At the start of your turn, draw 1 card.',
    effects: [{ op: 'apply', status: 'af_lattice', amount: 1, to: 'self' }],
    upgrade: { desc: 'At the start of your turn, draw 2 cards.', effects: [{ op: 'apply', status: 'af_lattice', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_install_core', name: 'Install Overclock Core', class: 'artificer', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🔁',
    desc: 'At the start of your turn, gain 1 Energy and gain 1 Strain.',
    effects: [{ op: 'apply', status: 'af_surge_core', amount: 1, to: 'self' }],
    upgrade: { desc: 'At the start of your turn, gain 2 Energy and gain 1 Strain.', effects: [{ op: 'apply', status: 'af_surge_core', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_install_afterburner', name: 'Install Afterburner', class: 'artificer', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🚀',
    desc: 'Once per turn, when you play an Attack, gain 1 Energy.',
    effects: [{ op: 'apply', status: 'af_afterburner', amount: 1, to: 'self' }],
    upgrade: { desc: 'Once per turn, when you play an Attack, gain 2 Energy.', effects: [{ op: 'apply', status: 'af_afterburner', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_install_heat_sink', name: 'Install Heat Sink', class: 'artificer', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '♨️',
    desc: 'Once per turn, when you lose HP, draw 1 card.',
    effects: [{ op: 'apply', status: 'af_heat_sink', amount: 1, to: 'self' }],
    upgrade: { desc: 'Once per turn, when you lose HP, draw 2 cards.', effects: [{ op: 'apply', status: 'af_heat_sink', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_install_recycler', name: 'Install Recycler', class: 'artificer', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🪣',
    desc: 'Whenever you exhaust a card, draw 1 card.',
    effects: [{ op: 'apply', status: 'af_recycler', amount: 1, to: 'self' }],
    upgrade: { desc: 'Whenever you exhaust a card, draw 2 cards.', effects: [{ op: 'apply', status: 'af_recycler', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_install_salvage_turret', name: 'Install Salvage Turret', class: 'artificer', type: 'power', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🏗️',
    desc: 'Whenever you exhaust a card, gain 1 Sentry Turret.',
    effects: [{ op: 'apply', status: 'af_salvage_turret', amount: 1, to: 'self' }],
    upgrade: { desc: 'Whenever you exhaust a card, gain 2 Sentry Turret.', effects: [{ op: 'apply', status: 'af_salvage_turret', amount: 2, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_install_assembly', name: 'Install Assembly Line', class: 'artificer', type: 'power', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🏭',
    desc: 'At the start of your turn, add 1 Spare Part to your hand.',
    effects: [{ op: 'apply', status: 'af_assembly_line', amount: 1, to: 'self' }],
    upgrade: { desc: 'At the start of your turn, add 2 Spare Parts to your hand.', effects: [{ op: 'apply', status: 'af_assembly_line', amount: 2, to: 'self' }] }
  });

  // ===========================================================================
  // RARE (17): payoffs, big turns and detonations
  // ===========================================================================
  DS.defineCard({
    id: 'af_turret_bay', name: 'Turret Bay', class: 'artificer', type: 'power', rarity: 'rare',
    cost: 3, target: 'self', icon: '🏛️',
    desc: 'At the start of your turn, deal 4 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'af_sentry', amount: 4, to: 'self' }],
    upgrade: { desc: 'At the start of your turn, deal 5 damage to a random enemy.', effects: [{ op: 'apply', status: 'af_sentry', amount: 5, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_scrap_titan', name: 'Scrap Titan', class: 'artificer', type: 'attack', rarity: 'rare',
    cost: 3, target: 'enemy', icon: '🗿',
    desc: 'Deal 22 damage. Exhaust 2 cards from your hand.',
    effects: [{ op: 'damage', amount: 22 }, { op: 'exhaust', amount: 2 }],
    upgrade: { desc: 'Deal 28 damage. Exhaust 2 cards from your hand.', effects: [{ op: 'damage', amount: 28 }, { op: 'exhaust', amount: 2 }] }
  });

  DS.defineCard({
    id: 'af_cannonade', name: 'Cannonade', class: 'artificer', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '🎇',
    desc: 'Deal 8 damage to ALL enemies twice.',
    effects: [{ op: 'damage', amount: 8, times: 2, to: 'all_enemies' }],
    upgrade: { desc: 'Deal 10 damage to ALL enemies twice.', effects: [{ op: 'damage', amount: 10, times: 2, to: 'all_enemies' }] }
  });

  DS.defineCard({
    id: 'af_disassemble', name: 'Disassemble', class: 'artificer', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🧹',
    desc: 'Exhaust all cards in your hand. Gain 3 Block for each card exhausted this combat.',
    effects: [
      { op: 'exhaust', amount: 'all' },
      { op: 'block', amount: { v: 'exhaust_pile', mul: 3 }, to: 'self' }
    ],
    upgrade: {
      desc: 'Exhaust all cards in your hand. Gain 4 Block for each card exhausted this combat.',
      effects: [
        { op: 'exhaust', amount: 'all' },
        { op: 'block', amount: { v: 'exhaust_pile', mul: 4 }, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'af_overdrive_protocol', name: 'Overdrive Protocol', class: 'artificer', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🚨',
    desc: 'Gain 1 Overclock Core, 1 Afterburner and 1 Heat Sink.',
    effects: [
      { op: 'apply', status: 'af_surge_core', amount: 1, to: 'self' },
      { op: 'apply', status: 'af_afterburner', amount: 1, to: 'self' },
      { op: 'apply', status: 'af_heat_sink', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 2 Overclock Core, 1 Afterburner and 1 Heat Sink.',
      effects: [
        { op: 'apply', status: 'af_surge_core', amount: 2, to: 'self' },
        { op: 'apply', status: 'af_afterburner', amount: 1, to: 'self' },
        { op: 'apply', status: 'af_heat_sink', amount: 1, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'af_hyperclock', name: 'Hyperclock', class: 'artificer', type: 'skill', rarity: 'rare',
    cost: 0, target: 'self', icon: '⏱️', exhaust: true,
    desc: 'Gain 4 Energy. Gain 3 Strain. Exhaust.',
    effects: [{ op: 'energy', amount: 4 }, { op: 'apply', status: 'af_strain', amount: 3, to: 'self' }],
    upgrade: { desc: 'Gain 5 Energy. Gain 3 Strain. Exhaust.', effects: [{ op: 'energy', amount: 5 }, { op: 'apply', status: 'af_strain', amount: 3, to: 'self' }] }
  });

  DS.defineCard({
    id: 'af_perpetual_engine', name: 'Perpetual Engine', class: 'artificer', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '♾️',
    desc: 'Whenever you exhaust a card, draw 1 card and gain 1 Block.',
    effects: [{ op: 'apply', status: 'af_recycler', amount: 1, to: 'self' }, { op: 'apply', status: 'af_salvage', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you exhaust a card, draw 2 cards and gain 2 Block.',
      effects: [{ op: 'apply', status: 'af_recycler', amount: 2, to: 'self' }, { op: 'apply', status: 'af_salvage', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'af_meltdown_core', name: 'Meltdown Core', class: 'artificer', type: 'skill', rarity: 'rare',
    cost: 0, target: 'self', icon: '🧯', exhaust: true,
    desc: 'Lose 6 HP. Gain 4 Energy. Draw 2 cards. Exhaust.',
    effects: [{ op: 'lose_hp', amount: 6, to: 'self' }, { op: 'energy', amount: 4 }, { op: 'draw', amount: 2 }],
    upgrade: {
      desc: 'Lose 5 HP. Gain 5 Energy. Draw 2 cards. Exhaust.',
      effects: [{ op: 'lose_hp', amount: 5, to: 'self' }, { op: 'energy', amount: 5 }, { op: 'draw', amount: 2 }]
    }
  });

  DS.defineCard({
    id: 'af_master_gearbox', name: 'Master Gearbox', class: 'artificer', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🛞',
    desc: 'Whenever you play a Skill, gain 3 Block. At the start of your turn, draw 1 card.',
    effects: [{ op: 'apply', status: 'af_gearbox', amount: 3, to: 'self' }, { op: 'apply', status: 'af_lattice', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you play a Skill, gain 4 Block. At the start of your turn, draw 1 card.',
      effects: [{ op: 'apply', status: 'af_gearbox', amount: 4, to: 'self' }, { op: 'apply', status: 'af_lattice', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'af_chrono_gear', name: 'Chrono Gear', class: 'artificer', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '⌛',
    desc: 'At the start of your turn, add 1 Spare Part to your hand and draw 1 card.',
    effects: [{ op: 'apply', status: 'af_assembly_line', amount: 1, to: 'self' }, { op: 'apply', status: 'af_lattice', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'At the start of your turn, add 2 Spare Parts to your hand and draw 1 card.',
      effects: [{ op: 'apply', status: 'af_assembly_line', amount: 2, to: 'self' }, { op: 'apply', status: 'af_lattice', amount: 1, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'af_fortress_rebuild', name: 'Fortress Rebuild', class: 'artificer', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🏰',
    desc: 'Gain 14 Block. Exhaust 2 cards from your hand.',
    effects: [{ op: 'block', amount: 14, to: 'self' }, { op: 'exhaust', amount: 2 }],
    upgrade: { desc: 'Gain 18 Block. Exhaust 2 cards from your hand.', effects: [{ op: 'block', amount: 18, to: 'self' }, { op: 'exhaust', amount: 2 }] }
  });

  DS.defineCard({
    id: 'af_field_armory', name: 'Field Armory', class: 'artificer', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🏯',
    desc: 'At the end of your turn, deal 2 damage to ALL enemies. At the start of your turn, deal 2 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'af_vent', amount: 2, to: 'self' }, { op: 'apply', status: 'af_sentry', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'At the end of your turn, deal 3 damage to ALL enemies. At the start of your turn, deal 3 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'af_vent', amount: 3, to: 'self' }, { op: 'apply', status: 'af_sentry', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'af_scrap_nexus', name: 'Scrap Nexus', class: 'artificer', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🌐',
    desc: 'Whenever you exhaust a card, gain 1 Sentry Turret and deal 1 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'af_salvage_turret', amount: 1, to: 'self' }, { op: 'apply', status: 'af_scrapyard', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Whenever you exhaust a card, gain 2 Sentry Turret and deal 2 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'af_salvage_turret', amount: 2, to: 'self' }, { op: 'apply', status: 'af_scrapyard', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'af_overheat_lance', name: 'Thermal Lance', class: 'artificer', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '🧨',
    desc: 'Deal 14 damage. Deal 4 more damage for each Strain you have.',
    effects: [
      { op: 'damage', amount: 14 },
      { op: 'damage', amount: { v: 'status', status: 'af_strain', of: 'self', mul: 4 } }
    ],
    upgrade: {
      desc: 'Deal 18 damage. Deal 5 more damage for each Strain you have.',
      effects: [
        { op: 'damage', amount: 18 },
        { op: 'damage', amount: { v: 'status', status: 'af_strain', of: 'self', mul: 5 } }
      ]
    }
  });

  DS.defineCard({
    id: 'af_assembly_prime', name: 'Assembly Prime', class: 'artificer', type: 'power', rarity: 'rare',
    cost: 3, target: 'self', icon: '🧬',
    desc: 'At the start of your turn, add 2 Spare Parts to your hand. At the end of your turn, heal 2 HP.',
    effects: [{ op: 'apply', status: 'af_assembly_line', amount: 2, to: 'self' }, { op: 'apply', status: 'af_mender', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'At the start of your turn, add 3 Spare Parts to your hand. At the end of your turn, heal 2 HP.',
      effects: [{ op: 'apply', status: 'af_assembly_line', amount: 3, to: 'self' }, { op: 'apply', status: 'af_mender', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'af_final_salvo', name: 'Final Salvo', class: 'artificer', type: 'attack', rarity: 'rare',
    cost: 3, target: 'all_enemies', icon: '☢️',
    desc: 'Exhaust 1 card from your hand. Deal 4 damage to ALL enemies for each card exhausted this combat.',
    effects: [
      { op: 'exhaust', amount: 1 },
      { op: 'damage', amount: { v: 'exhaust_pile', mul: 4 }, to: 'all_enemies' }
    ],
    upgrade: {
      desc: 'Exhaust 1 card from your hand. Deal 5 damage to ALL enemies for each card exhausted this combat.',
      effects: [
        { op: 'exhaust', amount: 1 },
        { op: 'damage', amount: { v: 'exhaust_pile', mul: 5 }, to: 'all_enemies' }
      ]
    }
  });

  DS.defineCard({
    id: 'af_core_detonation', name: 'Core Detonation', class: 'artificer', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '💢',
    desc: 'Deal 5 damage to ALL enemies for each Ember Vent you have. Remove all Ember Vent.',
    effects: [
      { op: 'damage', amount: { v: 'status', status: 'af_vent', of: 'self', mul: 5 }, to: 'all_enemies' },
      { op: 'remove_status', status: 'af_vent', to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 7 damage to ALL enemies for each Ember Vent you have. Remove all Ember Vent.',
      effects: [
        { op: 'damage', amount: { v: 'status', status: 'af_vent', of: 'self', mul: 7 }, to: 'all_enemies' },
        { op: 'remove_status', status: 'af_vent', to: 'self' }
      ]
    }
  });

  // ===========================================================================
  // SPECIAL (token, never offered as a reward): created by Spare Bolts, Parts Bin and Assembly Line
  // ===========================================================================
  DS.defineCard({
    id: 'af_spare_part', name: 'Spare Part', class: 'artificer', type: 'skill', rarity: 'special',
    cost: 0, target: 'self', icon: '🔩', exhaust: true,
    desc: 'Gain 3 Block. Exhaust.',
    effects: [{ op: 'block', amount: 3, to: 'self' }],
    upgrade: { desc: 'Gain 4 Block. Exhaust.', effects: [{ op: 'block', amount: 4, to: 'self' }] }
  });
})();
