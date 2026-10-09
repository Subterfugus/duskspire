(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // BEASTCALLER: Wren Ashfang, the Wilds-Born Packleader.
  // Three archetypes that also cross over:
  //   Pack         : bc_pack counts your companions. They bite a random enemy at the start of your turn, and
  //                  many small multi-hit attacks scale their hit count or damage with the Pack. Some cards
  //                  grow the Pack, others spend it for a burst.
  //   Bleed & Hunt : bc_bleed is a damage-over-time debuff (it also ticks on every hit the victim takes, which
  //                  rewards multi-hit cards). bc_quarry marks prey: it takes extra damage from each attack.
  //                  Cards check "is Bleeding" / "has Quarry" for bonus damage.
  //   Feral        : cards that read your HP ("50% HP or less") or Attacks played this turn. bc_frenzy adds
  //                  damage to every Attack until end of turn. Self-damage cards feed it.
  //   Crossovers   : Rending Aura (Pack-style engine for Bleed), Alpha's Dominion (Pack hits everyone),
  //                  Triumphant Howl (kills grow the Pack), Cornered (low HP becomes Frenzy).
  // Id prefix bc_. Custom statuses use the same prefix; no status id equals a card id.
  // Only engine-supported pieces are used: ops damage/apply/block/heal/draw/energy/lose_hp/if/repeat/
  // multiply_status/remove_status/add_card/exhaust, Value sources status/missing_hp/hp/max_hp/attacks_played/x,
  // and the triggers onCombatStart/onTurnStart/onTurnEnd/onCardPlayed/onAttacked/onKill/onEnemyDeath/onApplyDebuff.
  // ---------------------------------------------------------------------------

  // ----- small builders (keep desc and effects in one place so they cannot drift apart) -----
  const PACK = 'bc_pack';
  const stat = (id, extra) => Object.assign({ v: 'status', status: id, of: 'self' }, extra || {});
  const tstat = (id, extra) => Object.assign({ v: 'status', status: id, of: 'target' }, extra || {});
  const packV = (extra) => stat(PACK, extra);
  const dmg = (amount, o) => Object.assign({ op: 'damage', amount: amount }, o || {});
  const blk = (amount) => ({ op: 'block', amount: amount, to: 'self' });
  const app = (status, amount, to) => ({ op: 'apply', status: status, amount: amount, to: to });
  const self = (status, amount) => app(status, amount, 'self');
  const onT = (status, amount) => app(status, amount, 'target');
  const gt0 = (v) => ({ left: v, cmp: '>', right: 0 });
  const bleeding = gt0(tstat('bc_bleed'));
  const hasQuarry = gt0(tstat('bc_quarry'));
  const lowHp = { left: { v: 'hp', mul: 2 }, cmp: '<=', right: { v: 'max_hp' } };
  const packAtLeast = (n) => ({ left: packV(), cmp: '>=', right: n });
  const iff = (cond, then, els) => ({ op: 'if', cond: cond, then: then, else: els || [] });

  // ===========================================================================
  // CHARACTER
  // ===========================================================================
  DS.defineCharacter({
    id: 'beastcaller',
    name: 'Wren Ashfang',
    title: 'The Wilds-Born Packleader',
    desc: 'Raised by wolves at the edge of the Duskspire. Calls a Pack that bites on its own and swells small attacks into storms, opens wounds that bleed the prey dry, and grows deadlier the closer she is to death.',
    hp: 80,
    gold: 99,
    icon: '🐺',
    color: '#5fa043',
    starterDeck: [
      'bc_strike', 'bc_strike', 'bc_strike', 'bc_strike', 'bc_strike',
      'bc_defend', 'bc_defend', 'bc_defend', 'bc_defend',
      'bc_snapping_pack', 'bc_rend_and_rally'
    ],
    starterRelic: 'bc_bone_whistle'
  });

  // ===========================================================================
  // RELICS (5): starter, common, uncommon, rare, boss
  // ===========================================================================
  DS.defineRelic({
    id: 'bc_bone_whistle',
    name: 'Bone Whistle',
    desc: 'At the start of each combat, gain 2 Pack.',
    flavor: 'Carved from the first wolf that ever licked her face.',
    rarity: 'starter',
    icon: '🦴',
    class: 'beastcaller',
    passive: {},
    triggers: {
      onCombatStart: [self(PACK, 2)]
    }
  });

  DS.defineRelic({
    id: 'bc_cracked_fang',
    name: 'Cracked Fang',
    desc: 'At the start of each combat, apply 4 Bleed to ALL enemies.',
    flavor: 'Whatever it bit never closed the wound.',
    rarity: 'common',
    icon: '🦷',
    class: 'beastcaller',
    passive: {},
    triggers: {
      onCombatStart: [app('bc_bleed', 4, 'all_enemies')]
    }
  });

  DS.defineRelic({
    id: 'bc_hunters_horn',
    name: "Hunter's Horn",
    desc: 'Every 3rd Attack you play, gain 1 Pack.',
    flavor: 'Three notes: found, chased, cornered.',
    rarity: 'uncommon',
    icon: '📯',
    class: 'beastcaller',
    passive: {},
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        every: 3,
        effects: [self(PACK, 1)]
      }
    }
  });

  DS.defineRelic({
    id: 'bc_alpha_mantle',
    name: "Alpha's Mantle",
    desc: 'At the start of your turn, if you are at 50% HP or less, gain 1 Energy and 3 Frenzy.',
    flavor: 'Torn, bloodied, and worn only by the one who still stands.',
    rarity: 'rare',
    icon: '🧥',
    class: 'beastcaller',
    passive: {},
    triggers: {
      onTurnStart: {
        when: { hpBelowPct: 50.01 },
        effects: [{ op: 'energy', amount: 1 }, self('bc_frenzy', 3)]
      }
    }
  });

  DS.defineRelic({
    id: 'bc_primal_totem',
    name: 'Primal Totem',
    desc: 'Gain 1 additional Energy each turn. At the start of each combat, gain 3 Pack. At the start of your turn, lose 1 HP.',
    flavor: 'It hums with a hunger that was old before the spire was built.',
    rarity: 'boss',
    icon: '🗿',
    class: 'beastcaller',
    passive: { energy: 1 },
    triggers: {
      onCombatStart: [self(PACK, 3)],
      onTurnStart: [{ op: 'lose_hp', amount: 1, to: 'self' }]
    }
  });

  // ===========================================================================
  // CUSTOM STATUSES (14)
  // ===========================================================================

  // Pack: companions that bite at the start of your turn.
  DS.defineStatus({
    id: 'bc_pack',
    name: 'Pack',
    type: 'buff',
    icon: '🐾',
    stacks: true,
    desc: 'Your companions. At the start of your turn, they deal {n} damage to a random enemy. Many Beastcaller cards count or spend them.',
    triggers: {
      onTurnStart: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
    }
  });

  // Bleed: ticks at turn start, halves, and also costs 1 HP whenever the victim is attacked.
  DS.defineStatus({
    id: 'bc_bleed',
    name: 'Bleed',
    type: 'debuff',
    icon: '🩸',
    stacks: true,
    desc: 'Loses 1 HP each time it is attacked. At the start of its turn, loses {n} HP, then half of its Bleed (rounded up) fades.',
    triggers: {
      onAttacked: [{ op: 'lose_hp', amount: 1, to: 'self' }],
      onTurnStart: [
        { op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' },
        { op: 'apply', status: 'bc_bleed', amount: { v: 'stacks', mul: -0.5 }, to: 'self' }
      ]
    }
  });

  // Quarry: prey takes extra damage from every attack hit.
  DS.defineStatus({
    id: 'bc_quarry',
    name: 'Quarry',
    type: 'debuff',
    icon: '🎯',
    stacks: true,
    decay: 'turn_end',
    desc: 'Hunted. Takes {n} more damage from each attack. Loses 1 stack each turn.',
    mods: { attackTakenAdd: 1 }
  });

  // Frenzy: flat attack damage until the end of your turn.
  DS.defineStatus({
    id: 'bc_frenzy',
    name: 'Frenzy',
    type: 'buff',
    icon: '💢',
    stacks: true,
    expire: 'turn_end',
    desc: 'Your Attacks deal {n} more damage until the end of your turn.',
    mods: { attackDealtAdd: 1 }
  });

  // Stalk: the next attack deals 50% more, then it is spent.
  DS.defineStatus({
    id: 'bc_stalking',
    name: 'Stalk',
    type: 'buff',
    icon: '🐆',
    stacks: false,
    desc: 'Your next Attack deals 50% more damage.',
    mods: { attackDealtMul: 1.5 },
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [{ op: 'remove_status', status: 'bc_stalking', to: 'self' }]
      }
    }
  });

  // Carrion Feast: kills restore HP.
  DS.defineStatus({
    id: 'bc_feast',
    name: 'Carrion Feast',
    type: 'buff',
    icon: '🍖',
    stacks: true,
    desc: 'Whenever an enemy dies, heal {n} HP.',
    triggers: {
      onEnemyDeath: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Blood Frenzy Scent: applying any debuff to an enemy bites for flat damage.
  DS.defineStatus({
    id: 'bc_scent',
    name: 'Hunter Scent',
    type: 'buff',
    icon: '👃',
    stacks: true,
    desc: 'Whenever you apply a debuff to an enemy, deal {n} damage to it.',
    triggers: {
      onApplyDebuff: [{ op: 'damage', amount: { v: 'stacks' }, to: 'target' }]
    }
  });

  // Den: a growing Pack.
  DS.defineStatus({
    id: 'bc_den',
    name: 'Warm Den',
    type: 'buff',
    icon: '🏕️',
    stacks: true,
    desc: 'At the start of your turn, gain {n} Pack.',
    triggers: {
      onTurnStart: [self(PACK, { v: 'stacks' })]
    }
  });

  // Serrated Fangs: attacks open wounds.
  DS.defineStatus({
    id: 'bc_serrated',
    name: 'Serrated Fangs',
    type: 'buff',
    icon: '🦈',
    stacks: true,
    desc: 'Whenever you play an Attack, apply {n} Bleed to its target.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [onT('bc_bleed', { v: 'stacks' })]
      }
    }
  });

  // Cornered: low HP becomes Frenzy.
  DS.defineStatus({
    id: 'bc_cornered_rage',
    name: 'Cornered',
    type: 'buff',
    icon: '😾',
    stacks: true,
    desc: 'At the start of your turn, if you are at 50% HP or less, gain {n} Frenzy.',
    triggers: {
      onTurnStart: {
        when: { hpBelowPct: 50.01 },
        effects: [self('bc_frenzy', { v: 'stacks' })]
      }
    }
  });

  // Bloodlust: every attack feeds the next.
  DS.defineStatus({
    id: 'bc_lust',
    name: 'Feral Hunger',
    type: 'buff',
    icon: '😈',
    stacks: true,
    desc: 'Whenever you play an Attack, gain {n} Frenzy.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [self('bc_frenzy', { v: 'stacks' })]
      }
    }
  });

  // Alpha's Dominion: the Pack bites everyone.
  DS.defineStatus({
    id: 'bc_alpha',
    name: "Alpha's Dominion",
    type: 'buff',
    icon: '👑',
    stacks: false,
    desc: 'At the start of your turn, deal damage equal to half your Pack to ALL enemies.',
    triggers: {
      onTurnStart: [{ op: 'damage', amount: packV({ mul: 0.5 }), to: 'all_enemies' }]
    }
  });

  // Triumphant Howl: kills grow the Pack.
  DS.defineStatus({
    id: 'bc_triumph',
    name: 'Triumphant Howl',
    type: 'buff',
    icon: '🌕',
    stacks: true,
    desc: 'Whenever you kill an enemy, gain {n} Pack and draw 1 card.',
    triggers: {
      onKill: [self(PACK, { v: 'stacks' }), { op: 'draw', amount: 1 }]
    }
  });

  // Rending Aura: Bleed on everything, every turn.
  DS.defineStatus({
    id: 'bc_aura',
    name: 'Rending Aura',
    type: 'buff',
    icon: '🥀',
    stacks: true,
    desc: 'At the end of your turn, apply {n} Bleed to ALL enemies.',
    triggers: {
      onTurnEnd: [app('bc_bleed', { v: 'stacks' }, 'all_enemies')]
    }
  });

  // ===========================================================================
  // CARD BUILDER
  // f(u) -> {desc, effects, [cost], [exhaust], [retain]} for u = 0 (base) and u = 1 (upgraded).
  // ===========================================================================
  function card(id, name, o) {
    const base = o.f(0);
    const up = o.f(1);
    const def = {
      id: id, name: name, class: 'beastcaller', type: o.type, rarity: o.rarity,
      cost: base.cost !== undefined ? base.cost : o.cost,
      target: o.target, icon: o.icon,
      desc: base.desc, effects: base.effects
    };
    if (base.exhaust || o.exhaust) def.exhaust = true;
    if (base.retain || o.retain) def.retain = true;
    if (o.playableIf) def.playableIf = o.playableIf;
    const upgrade = { desc: up.desc, effects: up.effects };
    if (up.cost !== undefined && up.cost !== def.cost) upgrade.cost = up.cost;
    if (up.exhaust !== undefined) upgrade.exhaust = up.exhaust;
    if (up.retain !== undefined) upgrade.retain = up.retain;
    def.upgrade = upgrade;
    DS.defineCard(def);
  }
  const pick = (u, a, b) => (u ? b : a);

  // ===========================================================================
  // STARTER CARDS
  // ===========================================================================
  card('bc_strike', 'Strike', {
    type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', icon: '🗡️',
    f: (u) => ({ desc: 'Deal ' + pick(u, 6, 9) + ' damage.', effects: [dmg(pick(u, 6, 9))] })
  });
  card('bc_defend', 'Defend', {
    type: 'skill', rarity: 'starter', cost: 1, target: 'self', icon: '🛡️',
    f: (u) => ({ desc: 'Gain ' + pick(u, 5, 8) + ' Block.', effects: [blk(pick(u, 5, 8))] })
  });
  // 2 damage, once plus once per Pack.
  card('bc_snapping_pack', 'Snapping Pack', {
    type: 'attack', rarity: 'starter', cost: 1, target: 'enemy', icon: '🐕',
    f: (u) => {
      const d = pick(u, 2, 3);
      return {
        desc: 'Deal ' + d + ' damage once, plus once per Pack.',
        effects: [dmg(d, { times: packV({ add: 1 }) })]
      };
    }
  });
  card('bc_rend_and_rally', 'Rend and Rally', {
    type: 'skill', rarity: 'starter', cost: 1, target: 'enemy', icon: '🐾',
    f: (u) => ({
      desc: 'Apply ' + pick(u, 4, 6) + ' Bleed. Gain ' + pick(u, 1, 2) + ' Pack.',
      effects: [onT('bc_bleed', pick(u, 4, 6)), self(PACK, pick(u, 1, 2))]
    })
  });

  // ===========================================================================
  // COMMON (25): 13 attacks, 10 skills, 2 powers
  // ===========================================================================

  // ----- attacks -----
  card('bc_pounce', 'Leap', {
    type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '🐈',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 7, 9) + ' damage. Apply ' + pick(u, 2, 3) + ' Quarry.',
      effects: [dmg(pick(u, 7, 9)), onT('bc_quarry', pick(u, 2, 3))]
    })
  });
  card('bc_gnaw', 'Gnaw', {
    type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '🐀',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 2, 3) + ' damage 3 times. Apply ' + pick(u, 2, 3) + ' Bleed.',
      effects: [dmg(pick(u, 2, 3), { times: 3 }), onT('bc_bleed', pick(u, 2, 3))]
    })
  });
  card('bc_pack_rush', 'Pack Rush', {
    type: 'attack', rarity: 'common', cost: 2, target: 'enemy', icon: '🐕‍🦺',
    f: (u) => {
      const d = pick(u, 3, 4);
      return {
        desc: 'Deal ' + d + ' damage 2 times, plus once per Pack.',
        effects: [dmg(d, { times: packV({ add: 2 }) })]
      };
    }
  });
  card('bc_ragged_bite', 'Ragged Bite', {
    type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '😬',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 6, 8) + ' damage. If the target is Bleeding, deal ' + pick(u, 6, 8) + ' more.',
      effects: [dmg(pick(u, 6, 8)), iff(bleeding, [dmg(pick(u, 6, 8))])]
    })
  });
  card('bc_wolf_snap', 'Wolf Snap', {
    type: 'attack', rarity: 'common', cost: 0, target: 'enemy', icon: '🐺',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 4, 6) + ' damage. Gain 1 Pack. Exhaust.',
      effects: [dmg(pick(u, 4, 6)), self(PACK, 1)],
      exhaust: true
    })
  });
  card('bc_hamstring', 'Cripple', {
    type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '🦵',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 5, 7) + ' damage. Apply ' + pick(u, 1, 2) + ' Weak. Apply 2 Bleed.',
      effects: [dmg(pick(u, 5, 7)), onT('weak', pick(u, 1, 2)), onT('bc_bleed', 2)]
    })
  });
  card('bc_tooth_and_nail', 'Tooth and Nail', {
    type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '🐾',
    f: (u) => {
      const d = pick(u, 4, 5);
      return {
        desc: 'Deal ' + d + ' damage twice. If you are at 50% HP or less, deal ' + d + ' damage twice more.',
        effects: [dmg(d, { times: 2 }), iff(lowHp, [dmg(d, { times: 2 })])]
      };
    }
  });
  card('bc_whirling_claws', 'Whirling Claws', {
    type: 'attack', rarity: 'common', cost: 1, target: 'all_enemies', icon: '🌀',
    f: (u) => {
      const d = pick(u, 5, 7);
      return {
        desc: 'Deal ' + d + ' damage to ALL enemies, plus 1 per Pack.',
        effects: [dmg(packV({ add: d }), { to: 'all_enemies' })]
      };
    }
  });
  card('bc_savage_rake', 'Savage Rake', {
    type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '🪓',
    f: (u) => {
      const m = pick(u, 3, 4);
      return {
        desc: 'Deal 4 damage, plus ' + m + ' for each Attack you have played this turn (including this one).',
        effects: [dmg({ v: 'attacks_played', mul: m, add: 4 })]
      };
    }
  });
  card('bc_lunge', 'Lunge', {
    type: 'attack', rarity: 'common', cost: 2, target: 'enemy', icon: '🦁',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 12, 16) + ' damage. If the target has Quarry, draw 1 card.',
      effects: [dmg(pick(u, 12, 16)), iff(hasQuarry, [{ op: 'draw', amount: 1 }])]
    })
  });
  card('bc_hurled_hatchets', 'Hurled Hatchets', {
    type: 'attack', rarity: 'common', cost: 1, target: 'random_enemy', icon: '🪃',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 5, 7) + ' damage to a random enemy 2 times.',
      effects: [dmg(pick(u, 5, 7), { times: 2, to: 'random_enemy' })]
    })
  });
  card('bc_shoulder_charge', 'Boar Charge', {
    type: 'attack', rarity: 'common', cost: 1, target: 'enemy', icon: '🐗',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 5, 7) + ' damage. Gain ' + pick(u, 5, 7) + ' Block.',
      effects: [dmg(pick(u, 5, 7)), blk(pick(u, 5, 7))]
    })
  });
  card('bc_rake_the_flock', 'Rake the Flock', {
    type: 'attack', rarity: 'common', cost: 1, target: 'all_enemies', icon: '🦅',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 3, 4) + ' damage to ALL enemies. Apply ' + pick(u, 2, 3) + ' Bleed to ALL enemies.',
      effects: [dmg(pick(u, 3, 4), { to: 'all_enemies' }), app('bc_bleed', pick(u, 2, 3), 'all_enemies')]
    })
  });

  // ----- skills -----
  card('bc_wild_howl', 'Wild Howl', {
    type: 'skill', rarity: 'common', cost: 1, target: 'all_enemies', icon: '📢',
    f: (u) => ({
      desc: 'Apply ' + pick(u, 1, 2) + ' Weak to ALL enemies. Gain 1 Pack.',
      effects: [app('weak', pick(u, 1, 2), 'all_enemies'), self(PACK, 1)]
    })
  });
  card('bc_den_guard', 'Den Guard', {
    type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '🪨',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 7, 9) + ' Block. If you have 3 or more Pack, gain ' + pick(u, 4, 5) + ' more.',
      effects: [blk(pick(u, 7, 9)), iff(packAtLeast(3), [blk(pick(u, 4, 5))])]
    })
  });
  card('bc_scent_the_wound', 'Scent the Wound', {
    type: 'skill', rarity: 'common', cost: 1, target: 'enemy', icon: '🐽',
    f: (u) => ({
      desc: 'Apply ' + pick(u, 6, 8) + ' Bleed.',
      effects: [onT('bc_bleed', pick(u, 6, 8))]
    })
  });
  card('bc_mark_the_prey', 'Mark the Prey', {
    type: 'skill', rarity: 'common', cost: 0, target: 'enemy', icon: '🔍',
    f: (u) => ({
      desc: 'Apply ' + pick(u, 2, 3) + ' Quarry. Draw 1 card.',
      effects: [onT('bc_quarry', pick(u, 2, 3)), { op: 'draw', amount: 1 }]
    })
  });
  card('bc_call_the_cubs', 'Call the Cubs', {
    type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '🐕',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 2, 3) + ' Pack. Gain ' + pick(u, 4, 5) + ' Block.',
      effects: [self(PACK, pick(u, 2, 3)), blk(pick(u, 4, 5))]
    })
  });
  card('bc_thick_pelt', 'Thick Pelt', {
    type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '🧶',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 5, 7) + ' Block. Gain ' + pick(u, 2, 3) + ' Thorns.',
      effects: [blk(pick(u, 5, 7)), self('thorns', pick(u, 2, 3))]
    })
  });
  card('bc_lick_wounds', 'Lick Wounds', {
    type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '👅',
    f: (u) => ({
      desc: 'Heal ' + pick(u, 5, 8) + ' HP. Exhaust.',
      effects: [{ op: 'heal', amount: pick(u, 5, 8), to: 'self' }],
      exhaust: true
    })
  });
  card('bc_slink', 'Slink', {
    type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '🦊',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 6, 8) + ' Block. Draw 1 card.',
      effects: [blk(pick(u, 6, 8)), { op: 'draw', amount: 1 }]
    })
  });
  card('bc_feral_instinct', 'Feral Instinct', {
    type: 'skill', rarity: 'common', cost: 0, target: 'self', icon: '👁️',
    f: (u) => ({
      desc: 'Lose ' + pick(u, 3, 2) + ' HP. Draw 2 cards.',
      effects: [{ op: 'lose_hp', amount: pick(u, 3, 2), to: 'self' }, { op: 'draw', amount: 2 }]
    })
  });
  card('bc_stalk_prey', 'Stalk', {
    type: 'skill', rarity: 'common', cost: 1, target: 'self', icon: '🐆',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 5, 8) + ' Block. Your next Attack deals 50% more damage.',
      effects: [blk(pick(u, 5, 8)), self('bc_stalking', 1)]
    })
  });

  // ----- powers -----
  card('bc_ravenous', 'Ravenous', {
    type: 'power', rarity: 'common', cost: 1, target: 'self', icon: '🍖',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 3, 5) + ' Carrion Feast. (Whenever an enemy dies, heal ' + pick(u, 3, 5) + ' HP.)',
      effects: [self('bc_feast', pick(u, 3, 5))]
    })
  });
  card('bc_carrion_scent', 'Carrion Scent', {
    type: 'power', rarity: 'common', cost: 1, target: 'self', icon: '👃',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 2, 3) + ' Hunter Scent. (Whenever you apply a debuff to an enemy, deal ' + pick(u, 2, 3) + ' damage to it.)',
      effects: [self('bc_scent', pick(u, 2, 3))]
    })
  });

  // ===========================================================================
  // UNCOMMON (28): 13 attacks, 10 skills, 5 powers
  // ===========================================================================

  // ----- attacks -----
  card('bc_open_the_vein', 'Open the Vein', {
    type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '🔪',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 7, 9) + ' damage. Double the target\'s Bleed.',
      effects: [dmg(pick(u, 7, 9)), { op: 'multiply_status', status: 'bc_bleed', factor: 2, to: 'target' }]
    })
  });
  card('bc_rabid_frenzy', 'Rabid Frenzy', {
    type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', icon: '🐕‍🦺',
    f: (u) => ({
      desc: 'Lose 4 HP. Deal ' + pick(u, 3, 4) + ' damage 5 times.',
      effects: [{ op: 'lose_hp', amount: 4, to: 'self' }, dmg(pick(u, 3, 4), { times: 5 })]
    })
  });
  card('bc_alpha_strike', 'Alpha Strike', {
    type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '🐻',
    f: (u) => {
      const a = pick(u, 6, 8);
      return {
        desc: 'Deal ' + a + ' damage, plus 2 per Pack.',
        effects: [dmg(packV({ mul: 2, add: a }))]
      };
    }
  });
  card('bc_run_down', 'Run Down', {
    type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '🏃',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 6, 8) + ' damage. If the target has Quarry, deal ' + pick(u, 8, 10) + ' more.',
      effects: [dmg(pick(u, 6, 8)), iff(hasQuarry, [dmg(pick(u, 8, 10))])]
    })
  });
  card('bc_thrash', 'Thrash', {
    type: 'attack', rarity: 'uncommon', cost: 1, target: 'all_enemies', icon: '🐊',
    f: (u) => {
      const d = pick(u, 3, 4);
      return {
        desc: 'Deal ' + d + ' damage to ALL enemies twice. If you are at 50% HP or less, hit a third time.',
        effects: [dmg(d, { times: 2, to: 'all_enemies' }), iff(lowHp, [dmg(d, { to: 'all_enemies' })])]
      };
    }
  });
  card('bc_blood_feast', 'Blood Feast', {
    type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '🥩',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 8, 10) + ' damage. If the target is Bleeding, heal ' + pick(u, 4, 6) + ' HP.',
      effects: [dmg(pick(u, 8, 10)), iff(bleeding, [{ op: 'heal', amount: pick(u, 4, 6), to: 'self' }])]
    })
  });
  card('bc_cornered_beast', 'Cornered Beast', {
    type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '🐯',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 7, 9) + ' damage. If you are at 50% HP or less, deal ' + pick(u, 8, 10) + ' more.',
      effects: [dmg(pick(u, 7, 9)), iff(lowHp, [dmg(pick(u, 8, 10))])]
    })
  });
  card('bc_maul', 'Maul', {
    type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', icon: '🐻',
    playableIf: packAtLeast(2),
    f: (u) => ({
      desc: 'Spend 2 Pack. Deal ' + pick(u, 8, 10) + ' damage 3 times. (Needs 2 Pack.)',
      effects: [self(PACK, -2), dmg(pick(u, 8, 10), { times: 3 })]
    })
  });
  card('bc_ambush', 'Hidden Fang', {
    type: 'attack', rarity: 'uncommon', cost: 0, target: 'enemy', icon: '🌿',
    playableIf: { left: { v: 'attacks_played' }, cmp: '==', right: 0 },
    f: (u) => ({
      desc: 'Can only be played as the first Attack of the turn. Deal ' + pick(u, 9, 12) + ' damage.',
      effects: [dmg(pick(u, 9, 12))]
    })
  });
  card('bc_bloodhound', 'Bloodhound', {
    type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '🐶',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 3, 6) + ' damage, plus damage equal to the target\'s Bleed.',
      effects: [dmg(tstat('bc_bleed', { add: pick(u, 3, 6) }))]
    })
  });
  card('bc_pack_hunt', 'Pack Hunt', {
    type: 'attack', rarity: 'uncommon', cost: 2, target: 'all_enemies', icon: '🐺',
    f: (u) => {
      const d = pick(u, 3, 4);
      return {
        desc: 'Deal ' + d + ' damage to ALL enemies once, plus once per Pack.',
        effects: [dmg(d, { times: packV({ add: 1 }), to: 'all_enemies' })]
      };
    }
  });
  card('bc_tearing_charge', 'Tearing Charge', {
    type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy', icon: '🦏',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 4, 5) + ' damage 3 times. Gain 1 Pack.',
      effects: [dmg(pick(u, 4, 5), { times: 3 }), self(PACK, 1)]
    })
  });
  card('bc_jugular', 'Jugular', {
    type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '🧛',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 6, 8) + ' damage. If the target has both Bleed and Quarry, deal ' + pick(u, 10, 12) + ' more.',
      effects: [dmg(pick(u, 6, 8)), iff(bleeding, [iff(hasQuarry, [dmg(pick(u, 10, 12))])])]
    })
  });

  // ----- skills -----
  card('bc_rally_the_pack', 'Rally the Pack', {
    type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', icon: '📣',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 3, 4) + ' Pack. Exhaust.',
      effects: [self(PACK, pick(u, 3, 4))],
      exhaust: true
    })
  });
  card('bc_share_the_kill', 'Share the Kill', {
    type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', icon: '🍗',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 6, 8) + ' Block. If you have 2 or more Pack, spend 2 Pack to gain ' + pick(u, 8, 10) + ' more.',
      effects: [blk(pick(u, 6, 8)), iff(packAtLeast(2), [self(PACK, -2), blk(pick(u, 8, 10))])]
    })
  });
  card('bc_hunt_them_down', 'Hunt Them Down', {
    type: 'skill', rarity: 'uncommon', cost: 1, target: 'all_enemies', icon: '🏹',
    f: (u) => ({
      desc: 'Apply ' + pick(u, 2, 3) + ' Quarry to ALL enemies. Gain 1 Pack.',
      effects: [app('bc_quarry', pick(u, 2, 3), 'all_enemies'), self(PACK, 1)]
    })
  });
  card('bc_spread_the_blood', 'Spread the Blood', {
    type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '💧',
    f: (u) => ({
      desc: 'Apply Bleed to ALL enemies equal to the target\'s Bleed.',
      effects: [app('bc_bleed', tstat('bc_bleed'), 'all_enemies')],
      cost: pick(u, 1, 0)
    })
  });
  card('bc_adrenaline', 'Adrenaline Surge', {
    type: 'skill', rarity: 'uncommon', cost: 0, target: 'self', icon: '💉',
    f: (u) => ({
      desc: 'Lose 3 HP. Gain 1 Energy. Draw ' + pick(u, 1, 2) + ' card' + pick(u, '', 's') + '. Exhaust.',
      effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, { op: 'energy', amount: 1 }, { op: 'draw', amount: pick(u, 1, 2) }],
      exhaust: true
    })
  });
  card('bc_blood_rush', 'Blood Rush', {
    type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', icon: '🔥',
    f: (u) => ({
      desc: 'Lose 3 HP. Gain ' + pick(u, 3, 4) + ' Frenzy.',
      effects: [{ op: 'lose_hp', amount: 3, to: 'self' }, self('bc_frenzy', pick(u, 3, 4))]
    })
  });
  card('bc_bear_trap', 'Bear Trap', {
    type: 'skill', rarity: 'uncommon', cost: 1, target: 'enemy', icon: '🪤',
    f: (u) => ({
      desc: 'Apply ' + pick(u, 3, 4) + ' Bleed. Apply ' + pick(u, 3, 4) + ' Quarry.',
      effects: [onT('bc_bleed', pick(u, 3, 4)), onT('bc_quarry', pick(u, 3, 4))]
    })
  });
  card('bc_lone_wolf', 'Lone Wolf', {
    type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', icon: '🌙',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 18, 24) + ' Block. Lose all Pack.',
      effects: [blk(pick(u, 18, 24)), { op: 'remove_status', status: PACK, to: 'self' }]
    })
  });
  card('bc_gather_herbs', 'Gather Herbs', {
    type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', icon: '🌿',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 4, 6) + ' Regeneration. Gain 1 Pack.',
      effects: [self('regen', pick(u, 4, 6)), self(PACK, 1)]
    })
  });
  card('bc_lie_in_wait', 'Patient Hunter', {
    type: 'skill', rarity: 'uncommon', cost: 1, target: 'self', icon: '🪵',
    f: (u) => ({
      desc: 'Retain. Gain ' + pick(u, 7, 10) + ' Block. Your next Attack deals 50% more damage.',
      effects: [blk(pick(u, 7, 10)), self('bc_stalking', 1)],
      retain: true
    })
  });

  // ----- powers -----
  card('bc_warm_den', 'Warm Den', {
    type: 'power', rarity: 'uncommon', cost: 2, target: 'self', icon: '🏕️',
    f: (u) => ({
      desc: 'At the start of your turn, gain 1 Pack.',
      effects: [self('bc_den', 1)],
      cost: pick(u, 2, 1)
    })
  });
  card('bc_serrated_fangs', 'Serrated Fangs', {
    type: 'power', rarity: 'uncommon', cost: 1, target: 'self', icon: '🦈',
    f: (u) => ({
      desc: 'Whenever you play an Attack, apply ' + pick(u, 1, 2) + ' Bleed to its target.',
      effects: [self('bc_serrated', pick(u, 1, 2))]
    })
  });
  card('bc_cornered', 'Cornered', {
    type: 'power', rarity: 'uncommon', cost: 1, target: 'self', icon: '😾',
    f: (u) => ({
      desc: 'At the start of your turn, if you are at 50% HP or less, gain ' + pick(u, 2, 3) + ' Frenzy.',
      effects: [self('bc_cornered_rage', pick(u, 2, 3))]
    })
  });
  card('bc_barbed_hide', 'Barbed Hide', {
    type: 'power', rarity: 'uncommon', cost: 1, target: 'self', icon: '🦔',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 3, 4) + ' Thorns. Gain ' + pick(u, 3, 4) + ' Plated Armor.',
      effects: [self('thorns', pick(u, 3, 4)), self('plated_armor', pick(u, 3, 4))]
    })
  });
  card('bc_thick_fur', 'Thick Fur', {
    type: 'power', rarity: 'uncommon', cost: 1, target: 'self', icon: '🐻‍❄️',
    f: (u) => ({
      desc: 'Gain ' + pick(u, 2, 3) + ' Metallicize. Gain 1 Pack.',
      effects: [self('metallicize', pick(u, 2, 3)), self(PACK, 1)]
    })
  });

  // ===========================================================================
  // RARE (17): 8 attacks, 5 skills, 4 powers
  // ===========================================================================

  // ----- attacks -----
  card('bc_unleash_the_pack', 'Unleash the Pack', {
    type: 'attack', rarity: 'rare', cost: 2, target: 'all_enemies', icon: '🌪️',
    f: (u) => {
      const d = pick(u, 4, 5);
      return {
        desc: 'Deal ' + d + ' damage to ALL enemies once per Pack. Lose all Pack.',
        effects: [dmg(d, { times: packV(), to: 'all_enemies' }), { op: 'remove_status', status: PACK, to: 'self' }]
      };
    }
  });
  card('bc_exsanguinate', 'Drain the Prey', {
    type: 'attack', rarity: 'rare', cost: 1, target: 'enemy', icon: '☠️',
    f: (u) => ({
      desc: 'Deal damage equal to ' + pick(u, 3, 4) + ' times the target\'s Bleed. Remove its Bleed.',
      effects: [dmg(tstat('bc_bleed', { mul: pick(u, 3, 4) })), { op: 'remove_status', status: 'bc_bleed', to: 'target' }]
    })
  });
  card('bc_apex_predator', 'Apex Predator', {
    type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', icon: '🦖',
    f: (u) => {
      const d = pick(u, 22, 30);
      return {
        desc: 'Deal ' + d + ' damage. If this kills the target, gain 3 Pack and heal 8 HP.',
        effects: [dmg(d, { onKill: [self(PACK, 3), { op: 'heal', amount: 8, to: 'self' }] })]
      };
    }
  });
  card('bc_bloodbath', 'Gore Storm', {
    type: 'attack', rarity: 'rare', cost: 1, target: 'all_enemies', icon: '🌊',
    f: (u) => {
      const d = pick(u, 4, 5);
      return {
        desc: 'Deal ' + d + ' damage to ALL enemies once for each Attack you have played this turn (including this one).',
        effects: [dmg(d, { times: { v: 'attacks_played' }, to: 'all_enemies' })]
      };
    }
  });
  card('bc_death_roll', 'Death Roll', {
    type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', icon: '🐊',
    f: (u) => {
      const d = pick(u, 6, 8);
      return {
        desc: 'Deal ' + d + ' damage and apply 2 Bleed, 3 times.',
        effects: [{ op: 'repeat', times: 3, effects: [dmg(d), onT('bc_bleed', 2)] }]
      };
    }
  });
  card('bc_whirlwind_of_teeth', 'Whirlwind of Teeth', {
    type: 'attack', rarity: 'rare', cost: 'X', target: 'enemy', icon: '🦈',
    f: (u) => {
      const a = pick(u, 4, 5);
      const b = pick(u, 2, 3);
      return {
        desc: 'Deal ' + a + ' damage X times, then ' + b + ' damage once per Pack.',
        effects: [dmg(a, { times: { v: 'x' } }), dmg(b, { times: packV() })]
      };
    }
  });
  card('bc_desperate_maul', 'Desperate Maul', {
    type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', icon: '💀',
    f: (u) => {
      const a = pick(u, 8, 12);
      return {
        desc: 'Deal ' + a + ' damage, plus 1 for every 2 HP you are missing.',
        effects: [dmg({ v: 'missing_hp', mul: 0.5, add: a })]
      };
    }
  });
  card('bc_coup_de_grace', 'Mercy Kill', {
    type: 'attack', rarity: 'rare', cost: 2, target: 'enemy', icon: '⚔️',
    f: (u) => ({
      desc: 'Deal ' + pick(u, 14, 18) + ' damage. If the target is Bleeding and has Quarry, deal ' + pick(u, 28, 34) + ' more.',
      effects: [dmg(pick(u, 14, 18)), iff(bleeding, [iff(hasQuarry, [dmg(pick(u, 28, 34))])])]
    })
  });

  // ----- skills -----
  card('bc_call_of_the_wilds', 'Call of the Wilds', {
    type: 'skill', rarity: 'rare', cost: 2, target: 'self', icon: '🌲',
    f: (u) => ({
      desc: 'Gain 5 Pack. Exhaust.',
      effects: [self(PACK, 5)],
      exhaust: true,
      cost: pick(u, 2, 1)
    })
  });
  card('bc_primal_surge', 'Primal Surge', {
    type: 'skill', rarity: 'rare', cost: 0, target: 'self', icon: '⚡',
    f: (u) => ({
      desc: 'Lose ' + pick(u, 6, 4) + ' HP. Gain 2 Energy. Draw 2 cards. Gain 2 Frenzy. Exhaust.',
      effects: [
        { op: 'lose_hp', amount: pick(u, 6, 4), to: 'self' },
        { op: 'energy', amount: 2 },
        { op: 'draw', amount: 2 },
        self('bc_frenzy', 2)
      ],
      exhaust: true
    })
  });
  card('bc_hunt_together', 'Hunt Together', {
    type: 'skill', rarity: 'rare', cost: 1, target: 'self', icon: '👥',
    f: (u) => ({
      desc: 'Double your Pack.' + pick(u, ' Exhaust.', ''),
      effects: [{ op: 'multiply_status', status: PACK, factor: 2, to: 'self' }],
      exhaust: pick(u, true, false)
    })
  });
  card('bc_primal_roar', 'Primal Roar', {
    type: 'skill', rarity: 'rare', cost: 1, target: 'self', icon: '🦁',
    f: (u) => ({
      desc: 'Gain Block equal to ' + pick(u, 'three quarters of', 'all of') + ' your missing HP, plus 6. Exhaust.',
      effects: [blk({ v: 'missing_hp', mul: pick(u, 0.75, 1), add: 6 })],
      exhaust: true
    })
  });
  card('bc_feral_rebirth', 'Feral Rebirth', {
    type: 'skill', rarity: 'rare', cost: 2, target: 'self', icon: '🌱',
    f: (u) => ({
      desc: 'Heal ' + pick(u, 15, 22) + ' HP. Gain 2 Pack. Exhaust.',
      effects: [{ op: 'heal', amount: pick(u, 15, 22), to: 'self' }, self(PACK, 2)],
      exhaust: true
    })
  });

  // ----- powers -----
  card('bc_alphas_dominion', "Alpha's Dominion", {
    type: 'power', rarity: 'rare', cost: 2, target: 'self', icon: '👑',
    f: (u) => ({
      desc: 'At the start of your turn, deal damage equal to half your Pack to ALL enemies.',
      effects: [self('bc_alpha', 1)],
      cost: pick(u, 2, 1)
    })
  });
  card('bc_bloodlust', 'Feral Hunger', {
    type: 'power', rarity: 'rare', cost: 2, target: 'self', icon: '😈',
    f: (u) => ({
      desc: 'Whenever you play an Attack, gain 1 Frenzy.',
      effects: [self('bc_lust', 1)],
      cost: pick(u, 2, 1)
    })
  });
  card('bc_triumphant_howl', 'Triumphant Howl', {
    type: 'power', rarity: 'rare', cost: 1, target: 'self', icon: '🌕',
    f: (u) => ({
      desc: 'Whenever you kill an enemy, gain ' + pick(u, 2, 3) + ' Pack and draw 1 card.',
      effects: [self('bc_triumph', pick(u, 2, 3))]
    })
  });
  card('bc_rending_aura', 'Rending Aura', {
    type: 'power', rarity: 'rare', cost: 2, target: 'self', icon: '🥀',
    f: (u) => ({
      desc: 'At the end of your turn, apply ' + pick(u, 2, 3) + ' Bleed to ALL enemies.',
      effects: [self('bc_aura', pick(u, 2, 3))]
    })
  });
})();
