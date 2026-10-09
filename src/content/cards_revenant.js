(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // REVENANT: Sir Aldous Vane, the Knight Who Would Not Stay Dead.
  // Three archetypes that also cross over:
  //   Grave     : work from, and count, the discard and exhaust piles; return cards to hand.
  //               (rv_grave_pull, rv_unearth, rv_exhume, rv_judgment_day, rv_requiem, rv_ossuary (card ids), rv_dead_mans_hand)
  //   Deathless : spend HP on purpose and get paid when HP is lost (rv_spite, rv_grudge, rv_hard_to_kill),
  //               carry Block over (rv_ironbound card, next_turn_block, barricade), and refuse death once
  //               per combat (rv_undying via an onDeath trigger; the Phylactery relic does the same).
  //   Dread     : custom enemy debuffs (rv_dread, rv_rot, rv_wither) and cards that pay out per debuff.
  //   Crossovers: exhaust fuels Grave and the Requiem; HP loss pays for Dread attacks; Dread attackers
  //               get Block back from the Reliquary; Bone Thralls are cheap exhaust fodder.
  // Id prefix rv_. Status ids differ from every card id (statuses are rv_<noun>, cards rv_<verb phrase>).
  //
  // Engine notes (everything here is traceable to combat.js):
  //  * 'custom' effects use ctx.combat: pile moves go through combat._detach / hand / _chooseCards,
  //    extra damage goes back through combat.runEffects.
  //  * Reviving: Combat._onDeath sets unit.dead and then fires onDeath BEFORE _checkEnd can end the
  //    fight, so an onDeath listener that clears player.dead and restores hp keeps the run alive.
  // ---------------------------------------------------------------------------

  const HAND_LIMIT = 10;

  // ===========================================================================
  // Helpers
  // ===========================================================================
  function debuffTypes(unit) {
    let n = 0;
    if (!unit || !unit.statuses) return 0;
    for (const id in unit.statuses) {
      const d = DS.statuses[id];
      if (d && d.type === 'debuff' && unit.statuses[id] > 0) n++;
    }
    return n;
  }

  // Custom effect: move cards from a pile to the hand.
  //   from: 'discard' | 'exhaust'; n: number or (combat) => number
  //   opts: {random: choose randomly, type: card type filter}
  function retrieve(from, n, opts) {
    opts = opts || {};
    return {
      op: 'custom',
      fn: async function (ctx) {
        const combat = ctx.combat;
        if (!combat || combat._halted(false)) return;
        const src = from === 'exhaust' ? combat.exhaustPile : combat.discardPile;
        const pool = src.filter(function (c) { return !opts.type || c.data.type === opts.type; });
        const want = typeof n === 'function' ? n(combat) : n;
        const k = Math.min(want, pool.length);
        if (k <= 0) return;
        let picks;
        if (k >= pool.length) picks = pool.slice();
        else if (opts.random) picks = DS.rng.shuffle(pool.slice()).slice(0, k);
        else picks = await combat._chooseCards(pool, k, 'Choose ' + k + ' card' + (k > 1 ? 's' : '') + ' to return to your hand.', false);
        for (let i = 0; i < picks.length; i++) {
          if (combat.hand.length >= HAND_LIMIT) break;
          if (!combat._detach(picks[i])) continue;
          combat.hand.push(picks[i]);
          combat._log(picks[i].data.name + ' returns to your hand.');
        }
        combat._update();
      }
    };
  }

  // Custom effect: extra attack damage equal to base + per * (distinct debuffs on the target).
  function perDebuff(per) {
    return {
      op: 'custom',
      fn: async function (ctx) {
        const combat = ctx.combat;
        if (!combat || !ctx.target) return;
        const n = debuffTypes(ctx.target);
        if (n <= 0) return;
        await combat.runEffects([{ op: 'damage', amount: per * n }], {
          source: combat.player, target: ctx.target, card: ctx.card, kind: 'card', targetKind: 'enemy'
        });
      }
    };
  }

  // Custom effect: bring the player back from death. getHp(player) -> hp to return with.
  function reviveEffect(getHp, consumeStatus) {
    return {
      op: 'custom',
      fn: async function (ctx) {
        const combat = ctx.combat;
        const p = combat && combat.player;
        if (!p || !(p.dead || p.hp <= 0) || combat._abandoned || combat._ended) return;
        const hp = Math.max(1, Math.min(p.maxHp, Math.floor(getHp(p))));
        if (consumeStatus && p.statuses[consumeStatus] !== undefined) {
          const had = p.statuses[consumeStatus];
          delete p.statuses[consumeStatus];
          combat._emit('combat:status', { target: p, status: consumeStatus, amount: -had });
        }
        p.dead = false;
        p.hp = hp;
        combat._syncRun();
        combat._emit('combat:heal', { target: p, amount: hp });
        combat._log('You refuse to die and rise with ' + hp + ' HP.');
        combat._update();
      }
    };
  }

  const dmg = function (n, extra) { return Object.assign({ op: 'damage', amount: n }, extra || {}); };
  const dmgAll = function (n) { return { op: 'damage', amount: n, to: 'all_enemies' }; };
  const blk = function (n) { return { op: 'block', amount: n, to: 'self' }; };
  const hit = function (status, n) { return { op: 'apply', status: status, amount: n, to: 'target' }; };
  const hitAll = function (status, n) { return { op: 'apply', status: status, amount: n, to: 'all_enemies' }; };
  const self = function (status, n) { return { op: 'apply', status: status, amount: n, to: 'self' }; };
  const lose = function (n) { return { op: 'lose_hp', amount: n, to: 'self' }; };
  const exhaustHand = function (n) { return { op: 'exhaust', amount: n }; };
  const when = function (cond, then, els) { return { op: 'if', cond: cond, then: then, else: els || [] }; };
  const exhaustedAny = { left: { v: 'exhaust_pile' }, cmp: '>', right: 0 };
  const belowHalf = { left: { v: 'hp', mul: 2 }, cmp: '<', right: { v: 'max_hp' } };

  function card(def) {
    DS.defineCard(Object.assign({ class: 'revenant' }, def));
  }

  // ===========================================================================
  // CHARACTER
  // ===========================================================================
  DS.defineCharacter({
    id: 'revenant',
    name: 'Sir Aldous Vane',
    title: 'The Knight Who Would Not Stay Dead',
    desc: 'A knight who died at the gate and was not told to stay down. Digs his spent cards out of the grave, makes pain pay him back, and fills his enemies with Dread until they unravel.',
    hp: 76,
    gold: 99,
    icon: '⚰️',
    color: '#7f8fa6',
    starterDeck: [
      'rv_strike', 'rv_strike', 'rv_strike', 'rv_strike', 'rv_strike',
      'rv_defend', 'rv_defend', 'rv_defend', 'rv_defend',
      'rv_grave_pull', 'rv_hollow_stare'
    ],
    starterRelic: 'rv_cracked_reliquary'
  });

  // ===========================================================================
  // RELICS (5): starter, common, uncommon, rare, boss
  // ===========================================================================
  DS.defineRelic({
    id: 'rv_cracked_reliquary',
    name: 'Cracked Reliquary',
    desc: 'After winning a fight, heal 4 HP. The first time each turn you lose HP, gain 4 Block.',
    flavor: 'The saint inside has long since left. The knight stayed to keep the box warm.',
    rarity: 'starter',
    icon: '🏺',
    class: 'revenant',
    passive: {},
    triggers: {
      onCombatEnd: [{ op: 'heal', amount: 4 }],
      onDamaged: { oncePerTurn: true, effects: [blk(4)] }
    }
  });

  DS.defineRelic({
    id: 'rv_gravediggers_spade',
    name: "Gravedigger's Spade",
    desc: 'Whenever you shuffle your discard pile into your draw pile, gain 8 Block.',
    flavor: 'Worn smooth by a hand that is no longer attached to anything.',
    rarity: 'common',
    icon: '⛏️',
    class: 'revenant',
    passive: {},
    triggers: {
      onShuffle: [blk(8)]
    }
  });

  DS.defineRelic({
    id: 'rv_widows_ring',
    name: "Widow's Ring",
    desc: 'At the start of each combat, apply 3 Dread to ALL enemies.',
    flavor: 'It was given with a promise. Everyone who has met the wearer remembers it differently.',
    rarity: 'uncommon',
    icon: '💍',
    class: 'revenant',
    passive: {},
    triggers: {
      onCombatStart: [hitAll('rv_dread', 3)]
    }
  });

  DS.defineRelic({
    id: 'rv_phylactery',
    name: 'Phylactery of the Fallen',
    desc: 'Once per combat, when you would die, instead return to 25% of your Max HP.',
    flavor: 'A small black vessel. It is warm, and it is not yours, and it has been waiting.',
    rarity: 'rare',
    icon: '⚱️',
    class: 'revenant',
    passive: {},
    triggers: {
      onDeath: {
        oncePerCombat: true,
        effects: [reviveEffect(function (p) { return p.maxHp * 0.25; }, null)]
      }
    }
  });

  DS.defineRelic({
    id: 'rv_unquiet_crown',
    name: 'Unquiet Crown',
    desc: 'Gain 1 additional Energy each turn. At the start of your turn, lose 2 HP.',
    flavor: 'Whoever wore it last did not rest. Neither will you, and you will be so very productive.',
    rarity: 'boss',
    icon: '👑',
    class: 'revenant',
    passive: { energy: 1 },
    triggers: {
      onTurnStart: [lose(2)]
    }
  });

  // ===========================================================================
  // CUSTOM STATUSES (14)
  // ===========================================================================

  // ----- Dread: debuffs on enemies -----
  DS.defineStatus({
    id: 'rv_dread', name: 'Dread', type: 'debuff', icon: '😱', stacks: true, decay: 'turn_end',
    desc: 'Takes {n} extra damage from every attack. Loses 1 stack each turn.',
    mods: { attackTakenAdd: 1 }
  });

  DS.defineStatus({
    id: 'rv_rot', name: 'Rot', type: 'debuff', icon: '🍄', stacks: true,
    desc: 'At the end of its turn, loses {n} HP, then gains 1 more Rot.',
    triggers: {
      onTurnEnd: [
        { op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' },
        { op: 'apply', status: 'rv_rot', amount: 1, to: 'self' }
      ]
    }
  });

  DS.defineStatus({
    id: 'rv_wither', name: 'Wither', type: 'debuff', icon: '🥀', stacks: true, decay: 'turn_end',
    desc: 'Deals {n} less damage with each attack. Loses 1 stack each turn.',
    mods: { attackDealtAdd: -1 }
  });

  DS.defineStatus({
    id: 'rv_pallor', name: 'Pallid Aura', type: 'buff', icon: '👻', stacks: true,
    desc: 'At the start of your turn, apply {n} Dread to ALL enemies.',
    triggers: {
      onTurnStart: [{ op: 'apply', status: 'rv_dread', amount: { v: 'stacks' }, to: 'all_enemies' }]
    }
  });

  DS.defineStatus({
    id: 'rv_reaper', name: 'Harvester of Woe', type: 'buff', icon: '🪦', stacks: true,
    desc: 'Whenever you apply a debuff to an enemy, deal {n} damage to it.',
    triggers: {
      onApplyDebuff: [{ op: 'damage', amount: { v: 'stacks' }, to: 'target' }]
    }
  });

  DS.defineStatus({
    id: 'rv_sovereign', name: 'Dread Sovereign', type: 'buff', icon: '👑', stacks: true,
    desc: 'Whenever you hit an enemy with an Attack, apply {n} Dread to it.',
    triggers: {
      onAttack: [{ op: 'apply', status: 'rv_dread', amount: { v: 'stacks' }, to: 'target' }]
    }
  });

  // ----- Deathless: HP loss pays, Block carries, death is refused -----
  DS.defineStatus({
    id: 'rv_spiteful', name: 'Spite', type: 'buff', icon: '😤', stacks: true,
    desc: 'Whenever you lose HP, gain {n} Block.',
    triggers: {
      onDamaged: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'rv_grudging', name: 'Grudge', type: 'buff', icon: '💢', stacks: true,
    desc: 'Whenever you lose HP, deal {n} damage to a random enemy.',
    triggers: {
      onDamaged: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
    }
  });

  DS.defineStatus({
    id: 'rv_resolve', name: 'Hard Resolve', type: 'buff', icon: '🔥', stacks: true,
    desc: 'The first time each turn you lose HP, draw {n} card(s).',
    triggers: {
      onDamaged: { oncePerTurn: true, effects: [{ op: 'draw', amount: { v: 'stacks' } }] }
    }
  });

  DS.defineStatus({
    id: 'rv_ironclad', name: 'Ironbound', type: 'buff', icon: '⛓️', stacks: false,
    desc: 'At the end of your turn, half of your remaining Block is kept for next turn.',
    triggers: {
      onTurnEnd: [{ op: 'apply', status: 'next_turn_block', amount: { v: 'block', mul: 0.5 }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'rv_undying', name: 'Undying', type: 'buff', icon: '💀', stacks: true,
    desc: 'The next time you would die, return with {n} HP instead. Used up once.',
    triggers: {
      onDeath: [reviveEffect(function (p) { return p.statuses.rv_undying || 1; }, 'rv_undying')]
    }
  });

  // ----- Grave: exhaust and discard payoffs -----
  DS.defineStatus({
    id: 'rv_knell', name: 'Requiem', type: 'buff', icon: '🎼', stacks: true,
    desc: 'Whenever you exhaust a card, deal {n} damage to a random enemy.',
    triggers: {
      onCardExhausted: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
    }
  });

  DS.defineStatus({
    id: 'rv_bonehoard', name: 'Ossuary', type: 'buff', icon: '🦴', stacks: true,
    desc: 'At the start of your turn, gain Block equal to half the cards in your exhaust pile, {n} time(s).',
    triggers: {
      onTurnStart: [{
        op: 'repeat', times: { v: 'stacks' },
        effects: [{ op: 'block', amount: { v: 'exhaust_pile', mul: 0.5 }, to: 'self' }]
      }]
    }
  });

  DS.defineStatus({
    id: 'rv_deadhand', name: 'Dead Hand', type: 'buff', icon: '🤚', stacks: true,
    desc: 'At the start of your turn, return {n} random card(s) from your discard pile to your hand.',
    triggers: {
      onTurnStart: [retrieve('discard', function (combat) { return combat.player.statuses.rv_deadhand || 0; }, { random: true })]
    }
  });

  // ===========================================================================
  // STARTER CARDS (4)
  // ===========================================================================
  card({
    id: 'rv_strike', name: 'Strike', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', icon: '🗡️',
    desc: 'Deal 6 damage.',
    effects: [dmg(6)],
    upgrade: { desc: 'Deal 9 damage.', effects: [dmg(9)] }
  });

  card({
    id: 'rv_defend', name: 'Defend', type: 'skill', rarity: 'starter', cost: 1, target: 'self', icon: '🛡️',
    desc: 'Gain 5 Block.',
    effects: [blk(5)],
    upgrade: { desc: 'Gain 8 Block.', effects: [blk(8)] }
  });

  card({
    id: 'rv_grave_pull', name: 'Grave Pull', type: 'skill', rarity: 'starter', cost: 1, target: 'self', icon: '🪦',
    desc: 'Gain 4 Block. Return a card from your discard pile to your hand.',
    effects: [blk(4), retrieve('discard', 1)],
    upgrade: { desc: 'Gain 7 Block. Return a card from your discard pile to your hand.', effects: [blk(7), retrieve('discard', 1)] }
  });

  card({
    id: 'rv_hollow_stare', name: 'Hollow Stare', type: 'skill', rarity: 'starter', cost: 1, target: 'enemy', icon: '👁️',
    desc: 'Apply 3 Dread.',
    effects: [hit('rv_dread', 3)],
    upgrade: { desc: 'Apply 5 Dread.', effects: [hit('rv_dread', 5)] }
  });

  // Token created by Raise Dead.
  card({
    id: 'rv_bone_thrall', name: 'Bone Thrall', type: 'attack', rarity: 'special', cost: 0, target: 'enemy', icon: '💀',
    desc: 'Deal 5 damage. Exhaust.',
    exhaust: true,
    effects: [dmg(5)],
    upgrade: { desc: 'Deal 8 damage. Exhaust.', effects: [dmg(8)] }
  });

  // ===========================================================================
  // COMMON (25): 10 attacks, 12 skills, 3 powers
  // ===========================================================================

  // ----- common attacks -----
  card({
    id: 'rv_bone_cleave', name: 'Bone Cleave', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '🦴',
    desc: 'Deal 8 damage. If you have a card in your exhaust pile, deal 3 more.',
    effects: [dmg(8), when(exhaustedAny, [dmg(3)])],
    upgrade: {
      desc: 'Deal 10 damage. If you have a card in your exhaust pile, deal 4 more.',
      effects: [dmg(10), when(exhaustedAny, [dmg(4)])]
    }
  });

  card({
    id: 'rv_grave_rake', name: 'Tomb Rake', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '⛏️',
    desc: 'Deal 5 damage. Return a card from your discard pile to your hand. Exhaust.',
    exhaust: true,
    effects: [dmg(5), retrieve('discard', 1)],
    upgrade: {
      desc: 'Deal 8 damage. Return a card from your discard pile to your hand. Exhaust.',
      effects: [dmg(8), retrieve('discard', 1)]
    }
  });

  card({
    id: 'rv_rusted_edge', name: 'Rusted Edge', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '🔪',
    desc: 'Deal 7 damage. Apply 2 Dread.',
    effects: [dmg(7), hit('rv_dread', 2)],
    upgrade: { desc: 'Deal 9 damage. Apply 3 Dread.', effects: [dmg(9), hit('rv_dread', 3)] }
  });

  card({
    id: 'rv_martyrs_cut', name: "Martyr's Cut", type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '🩸',
    desc: 'Lose 3 HP. Deal 12 damage.',
    effects: [lose(3), dmg(12)],
    upgrade: { desc: 'Lose 3 HP. Deal 16 damage.', effects: [lose(3), dmg(16)] }
  });

  card({
    id: 'rv_reaping_sweep', name: 'Reaping Sweep', type: 'attack', rarity: 'common', cost: 1, target: 'all_enemies', icon: '🌾',
    desc: 'Deal 5 damage to ALL enemies. Apply 1 Dread to ALL enemies.',
    effects: [dmgAll(5), hitAll('rv_dread', 1)],
    upgrade: {
      desc: 'Deal 7 damage to ALL enemies. Apply 2 Dread to ALL enemies.',
      effects: [dmgAll(7), hitAll('rv_dread', 2)]
    }
  });

  card({
    id: 'rv_sepulcher_strike', name: 'Sepulcher Strike', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '🏺',
    desc: 'Deal 4 damage plus 1 for every 2 cards in your discard pile.',
    effects: [dmg({ v: 'discard_pile', mul: 0.5, add: 4 })],
    upgrade: {
      desc: 'Deal 6 damage plus 1 for every 2 cards in your discard pile.',
      effects: [dmg({ v: 'discard_pile', mul: 0.5, add: 6 })]
    }
  });

  card({
    id: 'rv_hollow_jab', name: 'Hollow Jab', type: 'attack', rarity: 'common', cost: 0, target: 'enemy', icon: '🦷',
    desc: 'Deal 4 damage. Apply 1 Dread.',
    effects: [dmg(4), hit('rv_dread', 1)],
    upgrade: { desc: 'Deal 6 damage. Apply 1 Dread.', effects: [dmg(6), hit('rv_dread', 1)] }
  });

  card({
    id: 'rv_crypt_flurry', name: 'Crypt Flurry', type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '⚔️',
    desc: 'Deal 3 damage 3 times.',
    effects: [dmg(3, { times: 3 })],
    upgrade: { desc: 'Deal 4 damage 3 times.', effects: [dmg(4, { times: 3 })] }
  });

  card({
    id: 'rv_deaths_door', name: "Death's Door", type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '🚪',
    desc: 'Deal 6 damage. If you are below half HP, deal 8 more.',
    effects: [dmg(6), when(belowHalf, [dmg(8)])],
    upgrade: {
      desc: 'Deal 8 damage. If you are below half HP, deal 10 more.',
      effects: [dmg(8), when(belowHalf, [dmg(10)])]
    }
  });

  card({
    id: 'rv_grim_lunge', name: 'Grim Lunge', type: 'attack', rarity: 'common', cost: 2, target: 'enemy', icon: '🐎',
    desc: 'Deal 12 damage. Gain 6 Block.',
    effects: [dmg(12), blk(6)],
    upgrade: { desc: 'Deal 15 damage. Gain 8 Block.', effects: [dmg(15), blk(8)] }
  });

  // ----- common skills -----
  card({
    id: 'rv_burial_shroud', name: 'Burial Shroud', type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '🧣',
    desc: 'Lose 2 HP. Gain 10 Block.',
    effects: [lose(2), blk(10)],
    upgrade: { desc: 'Lose 2 HP. Gain 14 Block.', effects: [lose(2), blk(14)] }
  });

  card({
    id: 'rv_dig_in', name: 'Dig In', type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '🛡️',
    desc: 'Gain 5 Block. Next turn, gain 5 Block.',
    effects: [blk(5), self('next_turn_block', 5)],
    upgrade: { desc: 'Gain 7 Block. Next turn, gain 7 Block.', effects: [blk(7), self('next_turn_block', 7)] }
  });

  card({
    id: 'rv_unearth', name: 'Unearth', type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '⚰️',
    desc: 'Return a card from your discard pile to your hand. Exhaust.',
    exhaust: true,
    effects: [retrieve('discard', 1)],
    upgrade: { cost: 0, desc: 'Return a card from your discard pile to your hand. Exhaust.', effects: [retrieve('discard', 1)] }
  });

  card({
    id: 'rv_bone_ward', name: 'Bone Ward', type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '🦴',
    desc: 'Exhaust a card from your hand. Gain 8 Block.',
    effects: [exhaustHand(1), blk(8)],
    upgrade: { desc: 'Exhaust a card from your hand. Gain 11 Block.', effects: [exhaustHand(1), blk(11)] }
  });

  card({
    id: 'rv_dread_wail', name: 'Dread Wail', type: 'skill', rarity: 'common', cost: 1, target: 'all_enemies', icon: '😨',
    desc: 'Apply 2 Dread to ALL enemies.',
    effects: [hitAll('rv_dread', 2)],
    upgrade: { desc: 'Apply 3 Dread to ALL enemies.', effects: [hitAll('rv_dread', 3)] }
  });

  card({
    id: 'rv_creeping_rot', name: 'Creeping Rot', type: 'skill', rarity: 'common', cost: 1, target: 'enemy', icon: '🍄',
    desc: 'Apply 3 Rot.',
    effects: [hit('rv_rot', 3)],
    upgrade: { desc: 'Apply 4 Rot.', effects: [hit('rv_rot', 4)] }
  });

  card({
    id: 'rv_withering_glare', name: 'Withering Glare', type: 'skill', rarity: 'common', cost: 1, target: 'enemy', icon: '🥀',
    desc: 'Apply 2 Wither. Apply 1 Dread.',
    effects: [hit('rv_wither', 2), hit('rv_dread', 1)],
    upgrade: { desc: 'Apply 3 Wither. Apply 2 Dread.', effects: [hit('rv_wither', 3), hit('rv_dread', 2)] }
  });

  card({
    id: 'rv_cold_comfort', name: 'Cold Comfort', type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '🕯️',
    desc: 'Heal 5 HP. Exhaust.',
    exhaust: true,
    effects: [{ op: 'heal', amount: 5, to: 'self' }],
    upgrade: { desc: 'Heal 8 HP. Exhaust.', effects: [{ op: 'heal', amount: 8, to: 'self' }] }
  });

  card({
    id: 'rv_ashen_insight', name: 'Ashen Insight', type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '📜',
    desc: 'Draw 2 cards. Discard 1 card.',
    effects: [{ op: 'draw', amount: 2 }, { op: 'discard', amount: 1 }],
    upgrade: { desc: 'Draw 3 cards. Discard 1 card.', effects: [{ op: 'draw', amount: 3 }, { op: 'discard', amount: 1 }] }
  });

  card({
    id: 'rv_dirge', name: 'Dirge', type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '🔔',
    desc: 'Gain 6 Block plus 1 for each card in your exhaust pile.',
    effects: [{ op: 'block', amount: { v: 'exhaust_pile', add: 6 }, to: 'self' }],
    upgrade: {
      desc: 'Gain 9 Block plus 1 for each card in your exhaust pile.',
      effects: [{ op: 'block', amount: { v: 'exhaust_pile', add: 9 }, to: 'self' }]
    }
  });

  card({
    id: 'rv_chalice_of_pain', name: 'Chalice of Pain', type: 'skill', rarity: 'common', cost: 0, target: 'self', icon: '🏆',
    desc: 'Lose 4 HP. Draw 2 cards.',
    effects: [lose(4), { op: 'draw', amount: 2 }],
    upgrade: { desc: 'Lose 2 HP. Draw 2 cards.', effects: [lose(2), { op: 'draw', amount: 2 }] }
  });

  card({
    id: 'rv_bastion_stance', name: 'Bastion Stance', type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '🏰',
    desc: 'Gain 6 Block. Retain.',
    retain: true,
    effects: [blk(6)],
    upgrade: { desc: 'Gain 9 Block. Retain.', effects: [blk(9)] }
  });

  // ----- common powers -----
  card({
    id: 'rv_spite', name: 'Spite', type: 'power', rarity: 'common', cost: 1, target: 'self', icon: '😤',
    desc: 'Whenever you lose HP, gain 3 Block.',
    effects: [self('rv_spiteful', 3)],
    upgrade: { desc: 'Whenever you lose HP, gain 4 Block.', effects: [self('rv_spiteful', 4)] }
  });

  card({
    id: 'rv_requiem', name: 'Requiem', type: 'power', rarity: 'common', cost: 1, target: 'self', icon: '🎼',
    desc: 'Whenever you exhaust a card, deal 3 damage to a random enemy.',
    effects: [self('rv_knell', 3)],
    upgrade: { desc: 'Whenever you exhaust a card, deal 4 damage to a random enemy.', effects: [self('rv_knell', 4)] }
  });

  card({
    id: 'rv_bonemail', name: 'Bonemail', type: 'power', rarity: 'common', cost: 1, target: 'self', icon: '🦺',
    desc: 'Gain 2 Metallicize.',
    effects: [self('metallicize', 2)],
    upgrade: { desc: 'Gain 3 Metallicize.', effects: [self('metallicize', 3)] }
  });

  // ===========================================================================
  // UNCOMMON (28): 11 attacks, 11 skills, 6 powers
  // ===========================================================================

  // ----- uncommon attacks -----
  card({
    id: 'rv_risen_blow', name: 'Risen Blow', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', icon: '🧟',
    desc: 'Deal 14 damage. Return a card from your discard pile to your hand.',
    effects: [dmg(14), retrieve('discard', 1)],
    upgrade: { desc: 'Deal 18 damage. Return a card from your discard pile to your hand.', effects: [dmg(18), retrieve('discard', 1)] }
  });

  card({
    id: 'rv_bulwark_slam', name: 'Bulwark Slam', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', icon: '🔨',
    desc: 'Deal damage equal to your Block.',
    effects: [dmg({ v: 'block' })],
    upgrade: { cost: 1, desc: 'Deal damage equal to your Block.', effects: [dmg({ v: 'block' })] }
  });

  card({
    id: 'rv_harrowing', name: 'Harrowing', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '💀',
    desc: 'Deal 6 damage plus 3 for each Dread on the enemy.',
    effects: [dmg({ v: 'status', status: 'rv_dread', of: 'target', mul: 3, add: 6 })],
    upgrade: {
      desc: 'Deal 8 damage plus 4 for each Dread on the enemy.',
      effects: [dmg({ v: 'status', status: 'rv_dread', of: 'target', mul: 4, add: 8 })]
    }
  });

  card({
    id: 'rv_wretched_slash', name: 'Wretched Slash', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '🗡️',
    desc: 'Deal 4 damage. Deal 4 more for each debuff on the enemy.',
    effects: [dmg(4), perDebuff(4)],
    upgrade: { desc: 'Deal 5 damage. Deal 5 more for each debuff on the enemy.', effects: [dmg(5), perDebuff(5)] }
  });

  card({
    id: 'rv_crimson_oath', name: 'Crimson Oath', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', icon: '🩸',
    desc: 'Lose 6 HP. Deal 24 damage.',
    effects: [lose(6), dmg(24)],
    upgrade: { desc: 'Lose 6 HP. Deal 30 damage.', effects: [lose(6), dmg(30)] }
  });

  card({
    id: 'rv_grave_miasma', name: 'Grave Miasma', type: 'attack', rarity: 'uncommon', cost: 2, target: 'all_enemies', icon: '☣️',
    desc: 'Deal 8 damage to ALL enemies. Apply 2 Rot to ALL enemies.',
    effects: [dmgAll(8), hitAll('rv_rot', 2)],
    upgrade: { desc: 'Deal 11 damage to ALL enemies. Apply 3 Rot to ALL enemies.', effects: [dmgAll(11), hitAll('rv_rot', 3)] }
  });

  card({
    id: 'rv_grave_robber', name: 'Crypt Looter', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '🪙',
    desc: 'Deal 8 damage. Exhaust a card from your discard pile. Draw 1 card.',
    effects: [dmg(8), { op: 'exhaust', from: 'discard', amount: 1 }, { op: 'draw', amount: 1 }],
    upgrade: {
      desc: 'Deal 11 damage. Exhaust a card from your discard pile. Draw 1 card.',
      effects: [dmg(11), { op: 'exhaust', from: 'discard', amount: 1 }, { op: 'draw', amount: 1 }]
    }
  });

  card({
    id: 'rv_carrion_storm', name: 'Carrion Storm', type: 'attack', rarity: 'uncommon', cost: 'X', target: 'all_enemies', icon: '🦅',
    desc: 'Deal 5 damage to ALL enemies X times.',
    effects: [{ op: 'repeat', times: { v: 'x' }, effects: [dmgAll(5)] }],
    upgrade: {
      desc: 'Deal 7 damage to ALL enemies X times.',
      effects: [{ op: 'repeat', times: { v: 'x' }, effects: [dmgAll(7)] }]
    }
  });

  card({
    id: 'rv_dread_lash', name: 'Dread Lash', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '🪢',
    desc: 'Apply 1 Dread. Double the enemy\'s Dread. Deal 6 damage.',
    effects: [hit('rv_dread', 1), { op: 'multiply_status', status: 'rv_dread', factor: 2, to: 'target' }, dmg(6)],
    upgrade: {
      desc: 'Apply 2 Dread. Double the enemy\'s Dread. Deal 8 damage.',
      effects: [hit('rv_dread', 2), { op: 'multiply_status', status: 'rv_dread', factor: 2, to: 'target' }, dmg(8)]
    }
  });

  card({
    id: 'rv_spent_soul', name: 'Spent Soul', type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy', icon: '👤',
    desc: 'Deal 11 damage. Exhaust.',
    exhaust: true,
    effects: [dmg(11)],
    upgrade: { desc: 'Deal 15 damage. Exhaust.', effects: [dmg(15)] }
  });

  card({
    id: 'rv_reapers_due', name: "Reaper's Due", type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', icon: '☠️',
    desc: 'Deal 12 damage. If this kills, heal 6 HP and draw 1 card.',
    effects: [dmg(12, { onKill: [{ op: 'heal', amount: 6, to: 'self' }, { op: 'draw', amount: 1 }] })],
    upgrade: {
      desc: 'Deal 16 damage. If this kills, heal 8 HP and draw 1 card.',
      effects: [dmg(16, { onKill: [{ op: 'heal', amount: 8, to: 'self' }, { op: 'draw', amount: 1 }] })]
    }
  });

  // ----- uncommon skills -----
  card({
    id: 'rv_exhume', name: 'Exhume', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', icon: '⚱️',
    desc: 'Return a card from your exhaust pile to your hand. Exhaust.',
    exhaust: true,
    effects: [retrieve('exhaust', 1)],
    upgrade: { cost: 0, desc: 'Return a card from your exhaust pile to your hand. Exhaust.', effects: [retrieve('exhaust', 1)] }
  });

  card({
    id: 'rv_ossuary_rite', name: 'Ossuary Rite', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', icon: '📿',
    desc: 'Draw 1 card, plus 1 for every 3 cards in your exhaust pile.',
    effects: [{ op: 'draw', amount: { v: 'exhaust_pile', mul: 0.34, add: 1 } }],
    upgrade: {
      desc: 'Draw 2 cards, plus 1 for every 3 cards in your exhaust pile.',
      effects: [{ op: 'draw', amount: { v: 'exhaust_pile', mul: 0.34, add: 2 } }]
    }
  });

  card({
    id: 'rv_shallow_grave', name: 'Shallow Grave', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', icon: '🌱',
    desc: 'Gain 7 Block. Exhaust all Curses and Statuses in your hand.',
    effects: [blk(7), { op: 'exhaust', amount: 'all', type: 'curse' }, { op: 'exhaust', amount: 'all', type: 'status' }],
    upgrade: {
      desc: 'Gain 10 Block. Exhaust all Curses and Statuses in your hand.',
      effects: [blk(10), { op: 'exhaust', amount: 'all', type: 'curse' }, { op: 'exhaust', amount: 'all', type: 'status' }]
    }
  });

  card({
    id: 'rv_cremation', name: 'Cremation', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self', icon: '🔥',
    desc: 'Exhaust a card from your hand. Draw 2 cards.',
    effects: [exhaustHand(1), { op: 'draw', amount: 2 }],
    upgrade: { desc: 'Exhaust a card from your hand. Draw 3 cards.', effects: [exhaustHand(1), { op: 'draw', amount: 3 }] }
  });

  card({
    id: 'rv_unbowed', name: 'Unbowed', type: 'skill', rarity: 'uncommon', cost: 2, target: 'self', icon: '🏴',
    desc: 'Gain 7 Block. Gain 1 Buffer.',
    effects: [blk(7), self('buffer', 1)],
    upgrade: { desc: 'Gain 11 Block. Gain 1 Buffer.', effects: [blk(11), self('buffer', 1)] }
  });

  card({
    id: 'rv_wounded_pride', name: 'Wounded Pride', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', icon: '🎖️',
    desc: 'Lose 4 HP. Gain Block equal to half your missing HP plus 4.',
    effects: [lose(4), { op: 'block', amount: { v: 'missing_hp', mul: 0.5, add: 4 }, to: 'self' }],
    upgrade: {
      desc: 'Lose 4 HP. Gain Block equal to half your missing HP plus 8.',
      effects: [lose(4), { op: 'block', amount: { v: 'missing_hp', mul: 0.5, add: 8 }, to: 'self' }]
    }
  });

  card({
    id: 'rv_pain_forge', name: 'Pain Forge', type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', icon: '🔨',
    desc: 'Lose 4 HP. Gain 1 Strength.',
    effects: [lose(4), self('strength', 1)],
    upgrade: { desc: 'Lose 4 HP. Gain 2 Strength.', effects: [lose(4), self('strength', 2)] }
  });

  card({
    id: 'rv_spreading_rot', name: 'Spreading Rot', type: 'skill', rarity: 'uncommon', cost: 1, target: 'all_enemies', icon: '🦠',
    desc: 'Apply 2 Rot to ALL enemies.',
    effects: [hitAll('rv_rot', 2)],
    upgrade: { desc: 'Apply 3 Rot to ALL enemies.', effects: [hitAll('rv_rot', 3)] }
  });

  card({
    id: 'rv_triple_hex', name: 'Triple Hex', type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '🔯',
    desc: 'Apply 2 Rot. Apply 2 Dread. Apply 1 Vulnerable.',
    effects: [hit('rv_rot', 2), hit('rv_dread', 2), hit('vulnerable', 1)],
    upgrade: {
      desc: 'Apply 3 Rot. Apply 3 Dread. Apply 2 Vulnerable.',
      effects: [hit('rv_rot', 3), hit('rv_dread', 3), hit('vulnerable', 2)]
    }
  });

  card({
    id: 'rv_grim_bargain', name: 'Grim Bargain', type: 'skill', rarity: 'uncommon', cost: 0, target: 'self', icon: '🤝',
    desc: 'Lose 6 HP. Gain 2 Energy. Exhaust.',
    exhaust: true,
    effects: [lose(6), { op: 'energy', amount: 2 }],
    upgrade: { desc: 'Lose 4 HP. Gain 2 Energy. Exhaust.', effects: [lose(4), { op: 'energy', amount: 2 }] }
  });

  card({
    id: 'rv_dread_chorus', name: 'Dread Chorus', type: 'skill', rarity: 'uncommon', cost: 2, target: 'all_enemies', icon: '📣',
    desc: 'Apply 3 Dread to ALL enemies. Apply 1 Weak to ALL enemies.',
    effects: [hitAll('rv_dread', 3), hitAll('weak', 1)],
    upgrade: {
      desc: 'Apply 4 Dread to ALL enemies. Apply 2 Weak to ALL enemies.',
      effects: [hitAll('rv_dread', 4), hitAll('weak', 2)]
    }
  });

  // ----- uncommon powers -----
  card({
    id: 'rv_grudge', name: 'Grudge', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', icon: '💢',
    desc: 'Whenever you lose HP, deal 4 damage to a random enemy.',
    effects: [self('rv_grudging', 4)],
    upgrade: { desc: 'Whenever you lose HP, deal 6 damage to a random enemy.', effects: [self('rv_grudging', 6)] }
  });

  card({
    id: 'rv_ironbound', name: 'Ironbound', type: 'power', rarity: 'uncommon', cost: 2, target: 'self', icon: '⛓️',
    desc: 'At the end of your turn, half of your remaining Block is kept for next turn.',
    effects: [self('rv_ironclad', 1)],
    upgrade: {
      cost: 1,
      desc: 'At the end of your turn, half of your remaining Block is kept for next turn.',
      effects: [self('rv_ironclad', 1)]
    }
  });

  card({
    id: 'rv_hard_to_kill', name: 'Hard to Kill', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', icon: '🔥',
    desc: 'The first time each turn you lose HP, draw 1 card.',
    effects: [self('rv_resolve', 1)],
    upgrade: { desc: 'The first time each turn you lose HP, draw 2 cards.', effects: [self('rv_resolve', 2)] }
  });

  card({
    id: 'rv_ossuary', name: 'Ossuary', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', icon: '💀',
    desc: 'At the start of your turn, gain Block equal to half the cards in your exhaust pile.',
    effects: [self('rv_bonehoard', 1)],
    upgrade: {
      desc: 'At the start of your turn, gain Block equal to the cards in your exhaust pile.',
      effects: [self('rv_bonehoard', 2)]
    }
  });

  card({
    id: 'rv_pallid_aura', name: 'Pallid Aura', type: 'power', rarity: 'uncommon', cost: 2, target: 'self', icon: '👻',
    desc: 'At the start of your turn, apply 1 Dread to ALL enemies.',
    effects: [self('rv_pallor', 1)],
    upgrade: { desc: 'At the start of your turn, apply 2 Dread to ALL enemies.', effects: [self('rv_pallor', 2)] }
  });

  card({
    id: 'rv_soul_reaper', name: 'Harvester of Woe', type: 'power', rarity: 'uncommon', cost: 1, target: 'self', icon: '🪦',
    desc: 'Whenever you apply a debuff to an enemy, deal 2 damage to it.',
    effects: [self('rv_reaper', 2)],
    upgrade: { desc: 'Whenever you apply a debuff to an enemy, deal 3 damage to it.', effects: [self('rv_reaper', 3)] }
  });

  // ===========================================================================
  // RARE (17): 5 attacks, 6 skills, 6 powers
  // ===========================================================================

  // ----- rare attacks -----
  card({
    id: 'rv_judgment_day', name: 'Judgment Day', type: 'attack', rarity: 'rare', cost: 2, target: 'all_enemies', icon: '⚖️',
    desc: 'Deal 8 damage plus 2 for each card in your exhaust pile to ALL enemies. Exhaust.',
    exhaust: true,
    effects: [{ op: 'damage', amount: { v: 'exhaust_pile', mul: 2, add: 8 }, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 12 damage plus 2 for each card in your exhaust pile to ALL enemies. Exhaust.',
      effects: [{ op: 'damage', amount: { v: 'exhaust_pile', mul: 2, add: 12 }, to: 'all_enemies' }]
    }
  });

  card({
    id: 'rv_defiant_blow', name: 'Defiant Blow', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', icon: '🗡️',
    desc: 'Deal 8 damage plus your missing HP.',
    effects: [dmg({ v: 'missing_hp', add: 8 })],
    upgrade: { desc: 'Deal 12 damage plus your missing HP.', effects: [dmg({ v: 'missing_hp', add: 12 })] }
  });

  card({
    id: 'rv_executioners_toll', name: "Executioner's Toll", type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', icon: '🪓',
    desc: 'Deal 8 damage. Deal 7 more for each debuff on the enemy.',
    effects: [dmg(8), perDebuff(7)],
    upgrade: { desc: 'Deal 10 damage. Deal 9 more for each debuff on the enemy.', effects: [dmg(10), perDebuff(9)] }
  });

  card({
    id: 'rv_soul_rend', name: 'Soul Rend', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', icon: '💥',
    desc: 'Deal 10 damage plus 5 for each Dread on the enemy. Remove all of its Dread.',
    effects: [
      dmg({ v: 'status', status: 'rv_dread', of: 'target', mul: 5, add: 10 }),
      { op: 'remove_status', status: 'rv_dread', to: 'target' }
    ],
    upgrade: {
      desc: 'Deal 14 damage plus 6 for each Dread on the enemy. Remove all of its Dread.',
      effects: [
        dmg({ v: 'status', status: 'rv_dread', of: 'target', mul: 6, add: 14 }),
        { op: 'remove_status', status: 'rv_dread', to: 'target' }
      ]
    }
  });

  card({
    id: 'rv_dying_flurry', name: 'Dying Flurry', type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', icon: '⚡',
    desc: 'Lose 8 HP. Deal 6 damage 4 times.',
    effects: [lose(8), dmg(6, { times: 4 })],
    upgrade: { desc: 'Lose 8 HP. Deal 8 damage 4 times.', effects: [lose(8), dmg(8, { times: 4 })] }
  });

  // ----- rare skills -----
  card({
    id: 'rv_raise_dead', name: 'Raise Dead', type: 'skill', rarity: 'rare', cost: 2, target: 'self', icon: '🧟',
    desc: 'Add 3 Bone Thralls to your hand.',
    effects: [{ op: 'add_card', card: 'rv_bone_thrall', to: 'hand', amount: 3 }],
    upgrade: {
      desc: 'Add 3 upgraded Bone Thralls to your hand.',
      effects: [{ op: 'add_card', card: 'rv_bone_thrall', to: 'hand', amount: 3, upgraded: true }]
    }
  });

  card({
    id: 'rv_grave_tide', name: 'Grave Tide', type: 'skill', rarity: 'rare', cost: 1, target: 'self', icon: '🌊',
    desc: 'Move all cards from your exhaust pile to your discard pile. Draw 2 cards. Exhaust.',
    exhaust: true,
    effects: [
      {
        op: 'custom',
        fn: async function (ctx) {
          const combat = ctx.combat;
          if (!combat || combat._halted(false)) return;
          const moved = combat.exhaustPile.splice(0, combat.exhaustPile.length);
          for (let i = 0; i < moved.length; i++) combat.discardPile.push(moved[i]);
          if (moved.length) combat._log(moved.length + ' card(s) rise from the exhaust pile.');
          combat._update();
        }
      },
      { op: 'draw', amount: 2 }
    ],
    upgrade: {
      cost: 0,
      desc: 'Move all cards from your exhaust pile to your discard pile. Draw 2 cards. Exhaust.'
    }
  });

  card({
    id: 'rv_walk_the_veil', name: 'Walk the Veil', type: 'skill', rarity: 'rare', cost: 1, target: 'self', icon: '🕳️',
    desc: 'Lose 8 HP. Gain 2 Intangible. Exhaust.',
    exhaust: true,
    effects: [lose(8), self('intangible', 2)],
    upgrade: { desc: 'Lose 5 HP. Gain 2 Intangible. Exhaust.', effects: [lose(5), self('intangible', 2)] }
  });

  card({
    id: 'rv_plague_of_dread', name: 'Plague of Dread', type: 'skill', rarity: 'rare', cost: 2, target: 'all_enemies', icon: '🌑',
    desc: 'Apply 4 Dread, 2 Rot and 2 Wither to ALL enemies. Exhaust.',
    exhaust: true,
    effects: [hitAll('rv_dread', 4), hitAll('rv_rot', 2), hitAll('rv_wither', 2)],
    upgrade: {
      desc: 'Apply 5 Dread, 3 Rot and 3 Wither to ALL enemies. Exhaust.',
      effects: [hitAll('rv_dread', 5), hitAll('rv_rot', 3), hitAll('rv_wither', 3)]
    }
  });

  card({
    id: 'rv_memento_mori', name: 'Memento Mori', type: 'skill', rarity: 'rare', cost: 1, target: 'self', icon: '⏳',
    desc: 'Double your Block. Exhaust.',
    exhaust: true,
    effects: [{ op: 'block', amount: { v: 'block' }, to: 'self' }],
    upgrade: { cost: 0, desc: 'Double your Block. Exhaust.', effects: [{ op: 'block', amount: { v: 'block' }, to: 'self' }] }
  });

  card({
    id: 'rv_soul_ledger', name: 'Soul Ledger', type: 'skill', rarity: 'rare', cost: 0, target: 'enemy', icon: '📖',
    desc: 'Draw 1 card for each debuff on the enemy.',
    effects: [{
      op: 'custom',
      fn: async function (ctx) {
        if (!ctx.combat || !ctx.target) return;
        const n = debuffTypes(ctx.target);
        if (n > 0) await ctx.combat.draw(n);
      }
    }],
    upgrade: {
      desc: 'Draw 1 card for each debuff on the enemy. Gain 1 Energy.',
      effects: [{
        op: 'custom',
        fn: async function (ctx) {
          if (!ctx.combat || !ctx.target) return;
          const n = debuffTypes(ctx.target);
          if (n > 0) await ctx.combat.draw(n);
        }
      }, { op: 'energy', amount: 1 }]
    }
  });

  // ----- rare powers -----
  card({
    id: 'rv_undying_oath', name: 'Undying Oath', type: 'power', rarity: 'rare', cost: 2, target: 'self', icon: '💀',
    desc: 'The next time you would die this combat, return with 14 HP instead.',
    effects: [self('rv_undying', 14)],
    upgrade: { desc: 'The next time you would die this combat, return with 24 HP instead.', effects: [self('rv_undying', 24)] }
  });

  card({
    id: 'rv_dead_mans_hand', name: "Dead Man's Hand", type: 'power', rarity: 'rare', cost: 2, target: 'self', icon: '🤚',
    desc: 'At the start of your turn, return a random card from your discard pile to your hand.',
    effects: [self('rv_deadhand', 1)],
    upgrade: {
      cost: 1,
      desc: 'At the start of your turn, return a random card from your discard pile to your hand.',
      effects: [self('rv_deadhand', 1)]
    }
  });

  card({
    id: 'rv_dread_sovereign', name: 'Dread Sovereign', type: 'power', rarity: 'rare', cost: 2, target: 'self', icon: '👑',
    desc: 'Whenever you hit an enemy with an Attack, apply 1 Dread to it.',
    effects: [self('rv_sovereign', 1)],
    upgrade: {
      cost: 1,
      desc: 'Whenever you hit an enemy with an Attack, apply 1 Dread to it.',
      effects: [self('rv_sovereign', 1)]
    }
  });

  card({
    id: 'rv_bone_bastion', name: 'Bone Bastion', type: 'power', rarity: 'rare', cost: 3, target: 'self', icon: '🏯',
    desc: 'Your Block is not removed at the start of your turn.',
    effects: [self('barricade', 1)],
    upgrade: {
      cost: 2,
      desc: 'Your Block is not removed at the start of your turn.',
      effects: [self('barricade', 1)]
    }
  });

  card({
    id: 'rv_barbed_shroud', name: 'Barbed Shroud', type: 'power', rarity: 'rare', cost: 2, target: 'self', icon: '🌵',
    desc: 'Gain 3 Thorns. Gain 3 Plated Armor.',
    effects: [self('thorns', 3), self('plated_armor', 3)],
    upgrade: { desc: 'Gain 4 Thorns. Gain 4 Plated Armor.', effects: [self('thorns', 4), self('plated_armor', 4)] }
  });

  card({
    id: 'rv_dire_vow', name: 'Dire Vow', type: 'power', rarity: 'rare', cost: 2, target: 'self', icon: '📿',
    desc: 'Lose 10 HP. Gain 2 Ritual.',
    effects: [lose(10), self('ritual', 2)],
    upgrade: { desc: 'Lose 6 HP. Gain 2 Ritual.', effects: [lose(6), self('ritual', 2)] }
  });
})();
