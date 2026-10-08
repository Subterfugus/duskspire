/* DUSKSPIRE, Act 2 (second bestiary wave): drowned shantymen, tide witches, brass automatons,
   tax collectors, coral golems and a kraken brood. Ids prefixed a2_. */
(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ------------------------------------------------------------------
  // Custom statuses
  // ------------------------------------------------------------------

  // Gold a thief is carrying off. Half of it falls out when the carrier dies.
  DS.defineStatus({
    id: 'a2_stolen',
    name: 'Stolen Gold',
    desc: 'Carrying {n} gold taken from you. Half of it drops when this unit dies.',
    type: 'buff',
    icon: '🪙',
    stacks: true,
    decay: null,
    expire: null,
    triggers: {
      onDeath: [{ op: 'gold', amount: { v: 'stacks', mul: 0.5 } }],
    },
  });

  // Coral overgrowth on the player: the first block each turn makes every enemy stronger.
  DS.defineStatus({
    id: 'a2_barnacle',
    name: 'Barnacled',
    desc: 'Coral has grown over you. The first time each turn you gain Block, every enemy gains 1 Strength.',
    type: 'debuff',
    icon: '🐚',
    stacks: false,
    decay: null,
    expire: 'turn_end',
    triggers: {
      onBlockGained: {
        oncePerTurn: true,
        effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'all_enemies' }],
      },
    },
  });

  // Timer on a depth charge: burns down one turn at a time.
  DS.defineStatus({
    id: 'a2_fuse',
    name: 'Lit Fuse',
    desc: 'The fuse burns down each turn. The charge detonates when it runs out ({n} turns left).',
    type: 'buff',
    icon: '🧨',
    stacks: true,
    decay: 'turn_end',
    expire: null,
  });

  // Wind-up of a brass automaton: built by winding, spent on a release.
  DS.defineStatus({
    id: 'a2_spring',
    name: 'Wound Spring',
    desc: 'Wound tight: {n}. At two or more the automaton lets it go.',
    type: 'buff',
    icon: '🌀',
    stacks: true,
    decay: null,
    expire: null,
  });

  // Protection from bearers: halves attack damage taken while the bearers stand.
  DS.defineStatus({
    id: 'a2_ward',
    name: 'Bearer Ward',
    desc: 'Shielded by its bearers: takes half damage from attacks while they stand.',
    type: 'buff',
    icon: '🛡️',
    stacks: false,
    decay: null,
    expire: null,
    mods: { attackTakenMul: 0.5 },
  });

  // ------------------------------------------------------------------
  // MINIONS (only summoned or accompanying)
  // ------------------------------------------------------------------

  // Shield-bearer: braces in front of its caster and keeps the ward up.
  DS.defineEnemy({
    id: 'a2_drowned_bearer',
    name: 'Drowned Bearer',
    act: 2,
    tier: 'minion',
    hp: [26, 30],
    icon: '🐚',
    scale: 0.8,
    moves: {
      brace: { name: 'Brace the Line', intent: 'defend', effects: [{ op: 'block', amount: 9, to: 'self' }] },
      shove: {
        name: 'Shield Shove',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 5 },
          { op: 'apply', status: 'weak', amount: 1 },
        ],
      },
      bash: { name: 'Barnacle Bash', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
    },
    pattern: { type: 'sequence', moves: ['brace', 'shove', 'brace', 'bash'], loop: true },
  });

  // Kraken brood: called in by the Kraken Mother, and it feeds on what it bites.
  DS.defineEnemy({
    id: 'a2_kraken_tentacle',
    name: 'Kraken Tentacle',
    act: 2,
    tier: 'minion',
    hp: [24, 28],
    icon: '🪼',
    scale: 0.8,
    moves: {
      lash: { name: 'Lash', intent: 'attack', effects: [{ op: 'damage', amount: 6 }] },
      suckle: {
        name: 'Suckle',
        intent: 'attack',
        effects: [
          { op: 'damage', amount: 3 },
          { op: 'heal', amount: 4, to: 'self' },
        ],
      },
      coil: { name: 'Coil Up', intent: 'defend', effects: [{ op: 'block', amount: 7, to: 'self' }] },
    },
    pattern: { type: 'random', weights: { lash: 45, suckle: 35, coil: 20 }, noRepeat: 2, first: 'lash' },
  });

  // ------------------------------------------------------------------
  // NORMAL
  // ------------------------------------------------------------------

  // Heals its mates: every shanty knits the crew back together.
  DS.defineEnemy({
    id: 'a2_drowned_shantyman',
    name: 'Drowned Shantyman',
    act: 2,
    tier: 'normal',
    hp: [36, 40],
    icon: '🎶',
    scale: 0.9,
    moves: {
      cutlass: { name: 'Rusted Cutlass', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
      shanty: {
        name: 'Drowned Shanty',
        intent: 'buff',
        effects: [
          { op: 'block', amount: 4, to: 'self' },
          {
            op: 'custom',
            fn: async (ctx) => {
              const mates = ctx.combat.livingEnemies().filter((e) => e.uid !== ctx.source.uid);
              for (const mate of mates) await ctx.combat.heal(mate, 5, ctx.source);
            },
          },
        ],
      },
      bellow: {
        name: 'Sea-Lung Bellow',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 4 },
          { op: 'apply', status: 'weak', amount: 1 },
        ],
      },
    },
    pattern: { type: 'random', weights: { cutlass: 40, shanty: 30, bellow: 30 }, noRepeat: 2, first: 'cutlass' },
  });

  // Tax clerk: levies 10 gold when you can pay it. Half of what it carries drops when it dies.
  DS.defineEnemy({
    id: 'a2_toll_clerk',
    name: 'Toll Clerk',
    act: 2,
    tier: 'normal',
    hp: [30, 34],
    icon: '🧾',
    scale: 0.8,
    moves: {
      stamp: { name: 'Stamp Fee', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
      levy: {
        name: 'Levy',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 4 },
          {
            op: 'if',
            cond: { left: { v: 'gold' }, cmp: '>=', right: 10 },
            then: [
              { op: 'gold', amount: -10 },
              { op: 'apply', status: 'a2_stolen', amount: 10, to: 'self' },
            ],
          },
        ],
      },
      ledger: {
        name: 'Ledger Entry',
        intent: 'debuff',
        effects: [
          { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 },
          { op: 'apply', status: 'weak', amount: 1 },
        ],
      },
    },
    pattern: { type: 'random', weights: { stamp: 35, levy: 40, ledger: 25 }, noRepeat: 2, first: 'levy' },
  });

  // Wind-up timer: winds its spring twice, then unwinds into a heavy strike. Light strikes between.
  DS.defineEnemy({
    id: 'a2_brass_ratchet',
    name: 'Brass Ratchet',
    act: 2,
    tier: 'normal',
    hp: [58, 64],
    icon: '🔧',
    scale: 1.1,
    moves: {
      wind: {
        name: 'Wind the Spring',
        intent: 'buff',
        effects: [
          { op: 'block', amount: 6, to: 'self' },
          { op: 'apply', status: 'a2_spring', amount: 1, to: 'self' },
        ],
      },
      strike: { name: 'Ratchet Strike', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
      release: {
        name: 'Unwind!',
        intent: 'attack',
        effects: [
          { op: 'damage', amount: 18 },
          { op: 'remove_status', status: 'a2_spring', to: 'self' },
        ],
      },
    },
    // Winds when the spring is slack, winds or strikes while it is half-wound, releases at two turns of winding.
    ai: (ctx) => {
      const spring = ctx.self.statuses.a2_spring || 0;
      if (spring >= 2) return 'release';
      if (spring === 0) return 'wind';
      return ctx.turn % 2 === 0 ? 'wind' : 'strike';
    },
  });

  // Kraken swarm: a knot of tendrils that lashes several times and drags its prey down.
  DS.defineEnemy({
    id: 'a2_tentacle_swarm',
    name: 'Tentacle Swarm',
    act: 2,
    tier: 'normal',
    hp: [40, 46],
    icon: '🦑',
    scale: 1.1,
    moves: {
      thrash: { name: 'Thrashing Tendrils', intent: 'attack', effects: [{ op: 'damage', amount: 3, times: 3 }] },
      constrict: {
        name: 'Constrict',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 6 },
          { op: 'apply', status: 'weak', amount: 1 },
        ],
      },
      slam: { name: 'Drowning Slam', intent: 'attack', effects: [{ op: 'damage', amount: 10 }] },
      coil: { name: 'Coil Round', intent: 'defend', effects: [{ op: 'block', amount: 8, to: 'self' }] },
    },
    pattern: { type: 'random', weights: { thrash: 35, constrict: 30, slam: 20, coil: 15 }, noRepeat: 2, first: 'thrash' },
  });

  // Tide witch's apprentice: pushes curses into your deck, through the discard pile and the draw pile.
  DS.defineEnemy({
    id: 'a2_tidecaller',
    name: 'Tidecaller',
    act: 2,
    tier: 'normal',
    hp: [44, 50],
    icon: '🌊',
    scale: 1.0,
    moves: {
      omen: {
        name: 'Ill Omen',
        intent: 'debuff',
        effects: [{ op: 'add_card', card: 'curse_doubt', to: 'discard', amount: 1 }],
      },
      crash: { name: 'Riptide Crash', intent: 'attack', effects: [{ op: 'damage', amount: 11 }] },
      whisper: {
        name: 'Salt Whisper',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 5 },
          { op: 'add_card', card: 'curse_shame', to: 'draw', amount: 1 },
        ],
      },
      tide_ward: { name: 'Tidal Ward', intent: 'defend', effects: [{ op: 'block', amount: 9, to: 'self' }] },
    },
    pattern: {
      type: 'random',
      weights: { omen: 25, crash: 30, whisper: 25, tide_ward: 20 },
      noRepeat: 2,
      first: 'omen',
    },
  });

  // Grows when you block: its coral overgrowth makes every enemy stronger on each turn you guard.
  DS.defineEnemy({
    id: 'a2_coral_golem',
    name: 'Coral Golem',
    act: 2,
    tier: 'normal',
    hp: [72, 80],
    icon: '🪸',
    scale: 1.3,
    onSpawn: [{ op: 'apply', status: 'thorns', amount: 1, to: 'self' }],
    moves: {
      slam: { name: 'Reef Slam', intent: 'attack', effects: [{ op: 'damage', amount: 10 }] },
      grow: {
        name: 'Coral Overgrowth',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 6 },
          { op: 'apply', status: 'a2_barnacle', amount: 1, to: 'player' },
        ],
      },
      calcify: { name: 'Calcify', intent: 'defend', effects: [{ op: 'block', amount: 14, to: 'self' }] },
    },
    pattern: { type: 'random', weights: { slam: 40, grow: 35, calcify: 25 }, noRepeat: 2, first: 'grow' },
  });

  // Punishes card-heavy turns: from the fourth card you play each turn, it snaps at you.
  DS.defineEnemy({
    id: 'a2_ledger_hound',
    name: 'Ledger Hound',
    act: 2,
    tier: 'normal',
    hp: [36, 40],
    icon: '🐕',
    scale: 0.9,
    triggers: {
      onCardPlayed: [
        {
          op: 'if',
          cond: { left: { v: 'cards_played' }, cmp: '>=', right: 4 },
          then: [{ op: 'damage', amount: 5, to: 'player' }],
        },
      ],
    },
    moves: {
      snap: { name: 'Ledger Snap', intent: 'attack', effects: [{ op: 'damage', amount: 7 }] },
      sniff: {
        name: 'Sniff the Books',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 3 },
          { op: 'apply', status: 'weak', amount: 1 },
        ],
      },
      guard: { name: 'Guard the Purse', intent: 'defend', effects: [{ op: 'block', amount: 9, to: 'self' }] },
    },
    pattern: { type: 'random', weights: { snap: 40, sniff: 30, guard: 30 }, noRepeat: 2, first: 'snap' },
  });

  // Enrages once battered below half health: a surge of strength and a fresh guard.
  DS.defineEnemy({
    id: 'a2_dock_stevedore',
    name: 'Dock Stevedore',
    act: 2,
    tier: 'normal',
    hp: [56, 62],
    icon: '🔨',
    scale: 1.2,
    triggers: {
      onDamaged: {
        when: { hpBelowPct: 50 },
        oncePerCombat: true,
        effects: [
          { op: 'apply', status: 'strength', amount: 3, to: 'self' },
          { op: 'block', amount: 10, to: 'self' },
        ],
      },
    },
    moves: {
      swing: { name: 'Hook Swing', intent: 'attack', effects: [{ op: 'damage', amount: 9 }] },
      drop: {
        name: 'Crate Drop',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 6 },
          { op: 'apply', status: 'vulnerable', amount: 1 },
        ],
      },
      heave: { name: 'Heave', intent: 'defend', effects: [{ op: 'block', amount: 8, to: 'self' }] },
    },
    pattern: { type: 'random', weights: { swing: 40, drop: 35, heave: 25 }, noRepeat: 2, first: 'swing' },
  });

  // Hardens its shell every time it is struck.
  DS.defineEnemy({
    id: 'a2_shell_crab',
    name: 'Shell Crab',
    act: 2,
    tier: 'normal',
    hp: [42, 48],
    icon: '🦀',
    scale: 1.0,
    triggers: {
      onAttacked: [{ op: 'block', amount: 4, to: 'self' }],
    },
    moves: {
      pinch: { name: 'Pinch', intent: 'attack', effects: [{ op: 'damage', amount: 6 }] },
      shell_up: { name: 'Shell Up', intent: 'defend', effects: [{ op: 'block', amount: 12, to: 'self' }] },
      crush: { name: 'Crushing Claw', intent: 'attack', effects: [{ op: 'damage', amount: 10 }] },
    },
    pattern: { type: 'random', weights: { pinch: 40, shell_up: 30, crush: 30 }, noRepeat: 2, first: 'pinch' },
  });

  // Bursts when it dies, spraying the player with poison.
  DS.defineEnemy({
    id: 'a2_bloated_corpse',
    name: 'Bloated Corpse',
    act: 2,
    tier: 'normal',
    hp: [46, 52],
    icon: '🐡',
    scale: 1.0,
    triggers: {
      onDeath: [{ op: 'apply', status: 'poison', amount: 4, to: 'player' }],
    },
    moves: {
      belch: {
        name: 'Foul Belch',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 6 },
          { op: 'apply', status: 'poison', amount: 2 },
        ],
      },
      spines: { name: 'Bone Spines', intent: 'attack', effects: [{ op: 'damage', amount: 8 }] },
      puff: {
        name: 'Puff Up',
        intent: 'defend',
        effects: [
          { op: 'block', amount: 10, to: 'self' },
          { op: 'apply', status: 'thorns', amount: 2, to: 'self' },
        ],
      },
    },
    pattern: { type: 'random', weights: { belch: 35, spines: 35, puff: 30 }, noRepeat: 2, first: 'puff' },
  });

  // A timed bomb: its fuse burns one turn at a time, and it blows itself up on the third turn.
  DS.defineEnemy({
    id: 'a2_depth_charge',
    name: 'Depth Charge',
    act: 2,
    tier: 'normal',
    hp: [26, 30],
    icon: '💣',
    scale: 0.8,
    onSpawn: [{ op: 'apply', status: 'a2_fuse', amount: 3, to: 'self' }],
    moves: {
      sputter: { name: 'Sputter', intent: 'attack', effects: [{ op: 'damage', amount: 5 }] },
      hiss: {
        name: 'Acrid Hiss',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 3 },
          { op: 'apply', status: 'weak', amount: 1 },
        ],
      },
      detonate: {
        name: 'Detonate',
        intent: 'attack',
        effects: [
          { op: 'damage', amount: 14 },
          { op: 'lose_hp', amount: 999, to: 'self' },
        ],
      },
    },
    // Sputters, hisses, then detonates when the fuse has burned down to its last turn.
    ai: (ctx) => {
      if ((ctx.self.statuses.a2_fuse || 0) <= 1) return 'detonate';
      return ctx.turn % 2 === 0 ? 'hiss' : 'sputter';
    },
  });

  // ------------------------------------------------------------------
  // ELITES
  // ------------------------------------------------------------------

  // Mirror tide: whenever her Strength trails half of yours, she draws it up. Curses the deck with regret.
  DS.defineEnemy({
    id: 'a2_tide_witch',
    name: 'Tide Witch',
    act: 2,
    tier: 'elite',
    hp: [138, 146],
    icon: '🧙',
    scale: 1.2,
    moves: {
      mirror: {
        name: 'Mirror Tide',
        intent: 'buff',
        effects: [
          {
            op: 'apply',
            status: 'strength',
            amount: { v: 'status', status: 'strength', of: 'target', mul: 0.5 },
            to: 'self',
          },
        ],
      },
      hex: {
        name: 'Salt Hex',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 9 },
          { op: 'add_card', card: 'curse_regret', to: 'discard', amount: 1 },
        ],
      },
      drown: { name: 'Riptide Curse', intent: 'attack', effects: [{ op: 'damage', amount: 10, times: 2 }] },
      hymn: {
        name: 'Tide Hymn',
        intent: 'buff',
        effects: [
          { op: 'heal', amount: 8, to: 'self' },
          { op: 'block', amount: 6, to: 'self' },
        ],
      },
    },
    ai: (ctx) => {
      const mine = ctx.self.statuses.strength || 0;
      const theirs = ctx.combat.player.statuses.strength || 0;
      if (mine < Math.floor(theirs * 0.5)) return 'mirror';
      return ['hex', 'drown', 'hymn', 'drown'][(ctx.turn - 1) % 4];
    },
  });

  // Steals gold with every levy (half of it drops when it falls). Enrages below half health.
  DS.defineEnemy({
    id: 'a2_tax_collector',
    name: 'Tax Collector',
    act: 2,
    tier: 'elite',
    hp: [146, 154],
    icon: '💼',
    scale: 1.2,
    triggers: {
      onDamaged: {
        when: { hpBelowPct: 50 },
        oncePerCombat: true,
        effects: [{ op: 'apply', status: 'strength', amount: 3, to: 'self' }],
      },
    },
    moves: {
      assess: { name: 'Assessment', intent: 'attack', effects: [{ op: 'damage', amount: 18 }] },
      levy: {
        name: 'Levy the Purse',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 8 },
          {
            op: 'if',
            cond: { left: { v: 'gold' }, cmp: '>=', right: 15 },
            then: [
              { op: 'gold', amount: -15 },
              { op: 'apply', status: 'a2_stolen', amount: 15, to: 'self' },
            ],
          },
        ],
      },
      seize: {
        name: 'Seize Collateral',
        intent: 'attack_defend',
        effects: [
          { op: 'damage', amount: 11 },
          { op: 'block', amount: 8, to: 'self' },
        ],
      },
      seal: {
        name: 'Sealed Writ',
        intent: 'debuff',
        effects: [
          { op: 'apply', status: 'frail', amount: 2 },
          { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 1 },
        ],
      },
    },
    ai: (ctx) => {
      const cycle = ['levy', 'assess', 'seal', 'levy', 'seize'];
      return cycle[(ctx.turn - 1) % cycle.length];
    },
  });

  // Protected caster: its bearers keep the ward up. When the last bearer falls, the ward breaks.
  DS.defineEnemy({
    id: 'a2_coral_hierophant',
    name: 'Coral Hierophant',
    act: 2,
    tier: 'elite',
    hp: [116, 124],
    icon: '🔱',
    scale: 1.2,
    onSpawn: [{ op: 'apply', status: 'a2_ward', amount: 1, to: 'self' }],
    triggers: {
      onEnemyDeath: [
        {
          op: 'if',
          cond: { left: { v: 'enemies' }, cmp: '<=', right: 1 },
          then: [{ op: 'remove_status', status: 'a2_ward', to: 'self' }],
        },
      ],
    },
    moves: {
      // 'mark' stacks count how many times she has called her bearers (only two waves are called).
      call_bearers: {
        name: 'Call the Bearers',
        intent: 'buff',
        effects: [
          { op: 'summon', enemy: 'a2_drowned_bearer', amount: 2 },
          { op: 'apply', status: 'a2_ward', amount: 1, to: 'self' },
          { op: 'apply', status: 'mark', amount: 1, to: 'self' },
        ],
      },
      lance: { name: 'Coral Lance', intent: 'attack', effects: [{ op: 'damage', amount: 10 }] },
      burst: {
        name: 'Spore Burst',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 6 },
          { op: 'apply', status: 'poison', amount: 3 },
        ],
      },
      sanctify: {
        name: 'Sanctify the Reef',
        intent: 'buff',
        effects: [
          { op: 'heal', amount: 8, to: 'self' },
          { op: 'block', amount: 8, to: 'self' },
        ],
      },
    },
    // Two waves of bearers guard her; once the second wave falls she is left exposed.
    ai: (ctx) => {
      const bearers = ctx.combat.livingEnemies().filter((e) => e.id === 'a2_drowned_bearer').length;
      const calls = ctx.self.statuses.mark || 0;
      if (ctx.turn === 1) return 'call_bearers';
      if (calls < 2 && (bearers === 0 || (bearers < 2 && ctx.turn % 3 === 0))) return 'call_bearers';
      return ['lance', 'burst', 'sanctify', 'lance'][(ctx.turn - 1) % 4];
    },
  });

  // ------------------------------------------------------------------
  // BOSSES
  // ------------------------------------------------------------------

  // Summons a brood of tentacles and feeds on every death in the fight. Enrages below half health.
  DS.defineEnemy({
    id: 'a2_kraken_mother',
    name: 'The Kraken Mother',
    act: 2,
    tier: 'boss',
    hp: [246, 262],
    icon: '🐙',
    scale: 1.9,
    onSpawn: [{ op: 'apply', status: 'plated_armor', amount: 6, to: 'self' }],
    triggers: {
      onEnemyDeath: [{ op: 'heal', amount: 5, to: 'self' }],
      onDamaged: {
        when: { hpBelowPct: 50 },
        oncePerCombat: true,
        effects: [{ op: 'apply', status: 'strength', amount: 3, to: 'self' }],
      },
    },
    moves: {
      maul: { name: 'Maw Crush', intent: 'attack', effects: [{ op: 'damage', amount: 14 }] },
      squeeze: { name: 'Squeezing Coils', intent: 'attack', effects: [{ op: 'damage', amount: 8, times: 2 }] },
      ink: {
        name: 'Ink Veil',
        intent: 'debuff',
        effects: [
          { op: 'apply', status: 'frail', amount: 2 },
          { op: 'apply', status: 'weak', amount: 1 },
        ],
      },
      brood: {
        name: 'Spawn the Brood',
        intent: 'buff',
        effects: [{ op: 'summon', enemy: 'a2_kraken_tentacle', amount: 2 }],
      },
      embrace: { name: 'Final Embrace', intent: 'attack', effects: [{ op: 'damage', amount: 20 }] },
    },
    ai: (ctx) => {
      const low = ctx.self.hp <= ctx.self.maxHp * 0.5;
      const brood = ctx.combat.livingEnemies().filter((e) => e.id === 'a2_kraken_tentacle').length;
      const last = ctx.lastMoves[ctx.lastMoves.length - 1];
      if (ctx.turn === 1) return 'brood';
      if (brood === 0 && last !== 'brood') return 'brood';
      if (low && ctx.turn % 3 === 0) return 'embrace';
      if (brood < 2 && ctx.turn % 4 === 0) return 'brood';
      const cycle = low ? ['maul', 'squeeze', 'ink', 'squeeze'] : ['maul', 'squeeze', 'ink', 'maul'];
      return cycle[(ctx.turn - 1) % cycle.length];
    },
  });

  // Brass tax boss: winds a spring it lets go as a heavy assessment, curses the deck, and carries off gold.
  DS.defineEnemy({
    id: 'a2_brass_assessor',
    name: 'The Brass Assessor',
    act: 2,
    tier: 'boss',
    hp: [262, 280],
    icon: '🧮',
    scale: 1.8,
    onSpawn: [{ op: 'apply', status: 'plated_armor', amount: 10, to: 'self' }],
    moves: {
      audit: {
        name: 'Audit',
        intent: 'attack_debuff',
        effects: [
          { op: 'damage', amount: 13 },
          { op: 'add_card', card: 'curse_doubt', to: 'discard', amount: 1 },
        ],
      },
      levy: {
        name: 'Confiscate',
        intent: 'attack',
        effects: [
          { op: 'damage', amount: 12 },
          {
            op: 'if',
            cond: { left: { v: 'gold' }, cmp: '>=', right: 25 },
            then: [
              { op: 'gold', amount: -25 },
              { op: 'apply', status: 'a2_stolen', amount: 25, to: 'self' },
            ],
          },
        ],
      },
      wind: {
        name: 'Wind the Ledger',
        intent: 'buff',
        effects: [
          { op: 'block', amount: 12, to: 'self' },
          { op: 'apply', status: 'a2_spring', amount: 1, to: 'self' },
        ],
      },
      release: {
        name: 'Compound Interest',
        intent: 'attack',
        effects: [
          { op: 'damage', amount: 40 },
          { op: 'remove_status', status: 'a2_spring', to: 'self' },
        ],
      },
      subpoena: {
        name: 'Subpoena',
        intent: 'debuff',
        effects: [
          { op: 'apply', status: 'vulnerable', amount: 1 },
          { op: 'add_card', card: 'status_dazed', to: 'discard', amount: 2 },
        ],
      },
    },
    ai: (ctx) => {
      const spring = ctx.self.statuses.a2_spring || 0;
      const low = ctx.self.hp <= ctx.self.maxHp * 0.5;
      if (spring >= (low ? 1 : 2)) return 'release';
      if (ctx.turn === 1) return 'wind';
      const cycle = low ? ['levy', 'audit', 'subpoena', 'levy', 'wind'] : ['audit', 'levy', 'audit', 'wind'];
      return cycle[(ctx.turn - 1) % cycle.length];
    },
  });

  // ------------------------------------------------------------------
  // ENCOUNTERS
  // ------------------------------------------------------------------
  const encounters = [
    // Easy
    { id: 'a2_enc_dock_shakedown', name: 'Dock Shakedown', tier: 'easy', enemies: ['a2_drowned_shantyman', 'a2_toll_clerk'] },
    { id: 'a2_enc_tentacle_pier', name: 'Tentacle Pier', tier: 'easy', enemies: ['a2_tentacle_swarm'] },
    { id: 'a2_enc_tidepool_crab', name: 'Tidepool Crab', tier: 'easy', enemies: ['a2_shell_crab'] },
    { id: 'a2_enc_bloat_barge', name: 'Bloat Barge', tier: 'easy', enemies: ['a2_bloated_corpse'] },

    // Normal
    { id: 'a2_enc_toll_booth', name: 'Toll Booth', tier: 'normal', enemies: ['a2_toll_clerk', 'a2_toll_clerk'] },
    { id: 'a2_enc_brass_and_brine', name: 'Brass and Brine', tier: 'normal', enemies: ['a2_brass_ratchet', 'a2_tidecaller'] },
    { id: 'a2_enc_tendril_pack', name: 'Tendril Pack', tier: 'normal', enemies: ['a2_tentacle_swarm', 'a2_drowned_thrall'] },
    { id: 'a2_enc_curse_tide', name: 'Curse Tide', tier: 'normal', enemies: ['a2_tidecaller', 'a2_pale_pickpocket'] },
    { id: 'a2_enc_reef_golem', name: 'Reef Golem', tier: 'normal', enemies: ['a2_coral_golem'] },
    { id: 'a2_enc_reef_vanguard', name: 'Reef Vanguard', tier: 'normal', enemies: ['a2_coral_golem', 'a2_sewer_rat'] },
    { id: 'a2_enc_ledger_hound', name: 'Ledger Hound', tier: 'normal', enemies: ['a2_ledger_hound'] },
    { id: 'a2_enc_hound_and_clerk', name: 'Hound and Clerk', tier: 'normal', enemies: ['a2_ledger_hound', 'a2_toll_clerk'] },
    { id: 'a2_enc_stevedore_crew', name: 'Stevedore Crew', tier: 'normal', enemies: ['a2_dock_stevedore', 'a2_drowned_shantyman'] },
    { id: 'a2_enc_dock_brawl', name: 'Dock Brawl', tier: 'normal', enemies: ['a2_dock_stevedore', 'a2_cursed_squire'] },
    { id: 'a2_enc_crab_flats', name: 'Crab Flats', tier: 'normal', enemies: ['a2_shell_crab', 'a2_tidal_gull'] },
    { id: 'a2_enc_bloated_plague', name: 'Bloated Plague', tier: 'normal', enemies: ['a2_bloated_corpse', 'a2_plague_rat', 'a2_plague_rat'] },
    { id: 'a2_enc_ticking_wreck', name: 'Ticking Wreck', tier: 'normal', enemies: ['a2_depth_charge', 'a2_mire_leech'] },
    { id: 'a2_enc_mine_field', name: 'Mine Field', tier: 'normal', enemies: ['a2_depth_charge', 'a2_sewer_rat', 'a2_depth_charge'] },

    // Elite
    { id: 'a2_enc_elite_tide_witch', name: 'The Tide Witch', tier: 'elite', enemies: ['a2_tide_witch'] },
    { id: 'a2_enc_elite_tax_office', name: 'Tax Office', tier: 'elite', enemies: ['a2_tax_collector', 'a2_toll_clerk'] },
    { id: 'a2_enc_elite_hierophant', name: "Hierophant's Ward", tier: 'elite', enemies: ['a2_coral_hierophant', 'a2_drowned_bearer', 'a2_drowned_bearer'] },
    { id: 'a2_enc_elite_audit_day', name: 'Audit Day', tier: 'elite', enemies: ['a2_tax_collector', 'a2_ledger_hound'] },

    // Boss
    { id: 'a2_enc_boss_kraken_mother', name: 'The Kraken Mother', tier: 'boss', enemies: ['a2_kraken_mother'] },
    { id: 'a2_enc_boss_brass_assessor', name: 'The Brass Assessor', tier: 'boss', enemies: ['a2_brass_assessor'] },
  ];

  for (const enc of encounters) {
    DS.defineEncounter({ ...enc, act: 2 });
  }
})();
