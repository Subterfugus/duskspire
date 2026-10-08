(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // Act 3, second bestiary wave: star-eaten pilgrims, mirror wraiths that copy your strength,
  // hourglass sentinels on a timer, void leeches that grow when you block, a choir of fallen
  // seraphs that heal each other, living constellations, gold-stealing tithe men and curse crows.
  // Ids are prefixed a3_ and never collide with enemies_act3.js.
  // Numbers: same power level as the act 3 tiers in enemies_act3.js.

  // ---------- effect builders (each returns a plain contract effect) ----------
  const dmg = (amount, times) => ({ op: 'damage', amount: amount, times: times || 1 });
  const hitPlayer = (amount) => ({ op: 'damage', amount: amount, times: 1, to: 'player' });
  const blk = (amount) => ({ op: 'block', amount: amount, to: 'self' });
  const healSelf = (amount) => ({ op: 'heal', amount: amount, to: 'self' });
  const buffSelf = (status, amount) => ({ op: 'apply', status: status, amount: amount, to: 'self' });
  const debuffPlayer = (status, amount) => ({ op: 'apply', status: status, amount: amount, to: 'player' });
  const addCard = (card, to, amount) => ({ op: 'add_card', card: card, to: to, amount: amount || 1 });
  const summon = (enemy, amount) => ({ op: 'summon', enemy: enemy, amount: amount || 1 });
  const gold = (amount) => ({ op: 'gold', amount: amount });

  // ---------- custom status (a3_ prefix) ----------
  // The leech's tether: the player's guard feeds every enemy. Stays for the whole fight.
  DS.defineStatus({
    id: 'a3_tether',
    name: 'Leech Tether',
    desc: 'Void leeches cling to your guard. Every third time you gain block, every enemy gains 1 strength.',
    type: 'debuff',
    icon: '🩸',
    stacks: false,
    decay: null,
    expire: null,
    mods: {},
    triggers: {
      onBlockGained: { every: 3, effects: [{ op: 'apply', status: 'strength', amount: 1, to: 'all_enemies' }] }
    }
  });

  // ---------- custom effect helpers (escape hatch, used sparingly) ----------
  // Choir: every living seraph mends every living enemy (including itself).
  async function mendChoir(ctx) {
    const combat = ctx.combat;
    // Heals only the most wounded ally: three choir members healing everyone could outpace a deck's damage forever.
    const hurt = combat.livingEnemies().filter((e) => e.hp < e.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (hurt) await combat.heal(hurt, 5, ctx.source);
  }

  // Aegis bearer: guards the Star-Eaten caster if one is alive, otherwise itself.
  async function shieldCaster(ctx) {
    const combat = ctx.combat;
    const caster = combat.livingEnemies().find((e) => e.id === 'a3_star_cantor');
    if (caster) await combat.gainBlock(caster, 12, false);
    else await combat.gainBlock(ctx.source, 10, false);
  }

  // ======================= MINIONS =======================

  // Steals gold on every pilfer and sometimes jeers you into weakness. Killing it returns the purse.
  DS.defineEnemy({
    id: 'a3_gilt_imp',
    name: 'Gilt Imp',
    act: 3,
    tier: 'minion',
    hp: [16, 20],
    icon: '🪙',
    scale: 0.7,
    desc: 'A pilfering imp with a purse full of your gold. Each pilfer takes 10 gold; killing it returns 10.',
    triggers: {
      onDeath: [gold(10)]
    },
    moves: {
      pilfer: { name: 'Pilfer', intent: 'attack', effects: [dmg(5), gold(-10)] },
      scurry: { name: 'Scurry', intent: 'defend', effects: [blk(6)] },
      jeer: { name: 'Jeer', intent: 'debuff', effects: [debuffPlayer('weak', 1)] }
    },
    pattern: { type: 'sequence', moves: ['pilfer', 'scurry', 'pilfer', 'jeer'], loop: true }
  });

  // A dying star: brightens, wanes, then goes supernova and removes itself. A timer you must beat.
  DS.defineEnemy({
    id: 'a3_nova_mote',
    name: 'Nova Mote',
    act: 3,
    tier: 'minion',
    hp: [12, 16],
    icon: '☄️',
    scale: 0.7,
    desc: 'A dying star. It brightens, wanes, and on its third turn goes supernova, dealing damage and dying in the blast.',
    moves: {
      brighten: { name: 'Brighten', intent: 'buff', effects: [buffSelf('strength', 1)] },
      wane: { name: 'Wane', intent: 'defend', effects: [blk(5)] },
      supernova: { name: 'Supernova', intent: 'attack', effects: [dmg(12), { op: 'lose_hp', amount: 999, to: 'self' }] }
    },
    pattern: { type: 'sequence', moves: ['brighten', 'wane', 'supernova'], loop: true }
  });

  // ======================= NORMAL =======================

  // Every third card you play lights its star and scorches you.
  DS.defineEnemy({
    id: 'a3_star_pilgrim',
    name: 'Star-Eaten Pilgrim',
    act: 3,
    tier: 'normal',
    hp: [50, 58],
    icon: '🌟',
    scale: 1.0,
    desc: 'A pilgrim who swallowed a dead star. Every third card you play lights it up and scorches you.',
    triggers: {
      onCardPlayed: { every: 3, effects: [hitPlayer(5)] }
    },
    moves: {
      pilgrim_step: { name: 'Pilgrim Step', intent: 'attack', effects: [dmg(8)] },
      starfast: { name: 'Starfast', intent: 'defend', effects: [blk(12), healSelf(4)] },
      hungry_prayer: { name: 'Hungry Prayer', intent: 'attack_debuff', effects: [dmg(7), debuffPlayer('weak', 1)] }
    },
    pattern: { type: 'sequence', moves: ['pilgrim_step', 'starfast', 'hungry_prayer'], loop: true }
  });

  // Copies your strength: once you have more than it, it takes half of yours, then strikes for yours plus 4.
  DS.defineEnemy({
    id: 'a3_mirror_wraith',
    name: 'Mirror Wraith',
    act: 3,
    tier: 'normal',
    hp: [44, 52],
    icon: '🫥',
    scale: 1.0,
    desc: 'A wraith that copies your power. When you out-muscle it, it takes half your strength. Its Mirror Strike hits for your strength plus 6.',
    moves: {
      mirror_strike: {
        name: 'Mirror Strike',
        intent: 'attack',
        effects: [{ op: 'damage', amount: { v: 'status', status: 'strength', of: 'target', mul: 1, add: 6 }, times: 1 }]
      },
      mimic: {
        name: 'Mimic',
        intent: 'buff',
        effects: [{ op: 'apply', status: 'strength', amount: { v: 'status', status: 'strength', of: 'target', mul: 0.5, add: 0 }, to: 'self' }]
      },
      glass_veil: { name: 'Glass Veil', intent: 'defend', effects: [blk(12)] },
      stolen_breath: { name: 'Stolen Breath', intent: 'attack_debuff', effects: [dmg(6), debuffPlayer('weak', 1)] }
    },
    ai: ({ turn, self, combat }) => {
      const yours = combat.player.statuses.strength || 0;
      const mine = self.statuses.strength || 0;
      if (yours - mine >= 2) return 'mimic';
      const cycle = ['mirror_strike', 'stolen_breath', 'glass_veil'];
      return cycle[(turn - 1) % cycle.length];
    }
  });

  // A timer: a three-turn glass cycle. Below 35% health the glass runs twice as fast.
  DS.defineEnemy({
    id: 'a3_hourglass_sentinel',
    name: 'Hourglass Sentinel',
    act: 3,
    tier: 'normal',
    hp: [62, 70],
    icon: '🕰️',
    scale: 1.0,
    desc: 'A knight with a grain-filled hourglass for a chest. Trickle, flip the glass, then the sands fall. Below 35% health the glass runs faster.',
    moves: {
      trickle: { name: 'Trickle', intent: 'attack', effects: [dmg(8)] },
      turn_glass: { name: 'Turn Glass', intent: 'defend', effects: [blk(14)] },
      sands_fall: { name: 'Sands Fall', intent: 'attack_debuff', effects: [dmg(20), debuffPlayer('a3_unravel', 2)] }
    },
    ai: ({ turn, self }) => {
      const low = self.hp <= self.maxHp * 0.35;
      const seq = low ? ['sands_fall', 'trickle'] : ['trickle', 'turn_glass', 'sands_fall'];
      return seq[(turn - 1) % seq.length];
    }
  });

  // Latches on with a tether. While the tether holds, every second block you raise feeds all enemies.
  DS.defineEnemy({
    id: 'a3_void_leech',
    name: 'Void Leech',
    act: 3,
    tier: 'normal',
    hp: [38, 44],
    icon: '🪱',
    scale: 0.9,
    desc: 'A leech of void. It latches on with a tether, and every third time you gain block every enemy grows stronger.',
    moves: {
      latch: { name: 'Latch', intent: 'attack_debuff', effects: [dmg(6), debuffPlayer('a3_tether', 1)] },
      gorge: { name: 'Gorge', intent: 'attack', effects: [dmg(9), healSelf(3)] },
      coil: { name: 'Coil', intent: 'defend', effects: [blk(10)] }
    },
    ai: ({ combat, lastMoves }) => {
      const last = lastMoves[lastMoves.length - 1];
      if (!combat.player.statuses.a3_tether) return 'latch';
      return last === 'gorge' ? 'coil' : 'gorge';
    }
  });

  // Heals the most wounded living enemy. Kill them one at a time.
  DS.defineEnemy({
    id: 'a3_choir_seraph',
    name: 'Fallen Seraph Choir Member',
    act: 3,
    tier: 'normal',
    hp: [34, 40],
    icon: '👼',
    scale: 0.9,
    desc: 'One voice of a fallen choir. Its Mending Hymn heals the most wounded enemy for 5.',
    moves: {
      halo_lance: { name: 'Halo Lance', intent: 'attack', effects: [dmg(9)] },
      mending_hymn: { name: 'Mending Hymn', intent: 'buff', effects: [{ op: 'custom', fn: mendChoir }] },
      choir_wing: { name: 'Choir Wing', intent: 'defend', effects: [blk(10)] }
    },
    pattern: { type: 'random', weights: { halo_lance: 55, mending_hymn: 20, choir_wing: 25 }, noRepeat: 1 }
  });

  // Caws curses into your discard pile on a random cycle.
  DS.defineEnemy({
    id: 'a3_omen_crow',
    name: 'Omen Crow',
    act: 3,
    tier: 'normal',
    hp: [34, 40],
    icon: '🐦',
    scale: 0.9,
    desc: 'A crow that caws doubt into your discard pile. Its omens are never kind.',
    moves: {
      omen_caw: { name: 'Omen Caw', intent: 'attack_debuff', effects: [dmg(6), addCard('curse_doubt', 'discard', 1)] },
      talon_peck: { name: 'Talon Peck', intent: 'attack', effects: [dmg(10)] },
      dark_wing: { name: 'Dark Wing', intent: 'defend', effects: [blk(9)] }
    },
    pattern: { type: 'random', weights: { omen_caw: 45, talon_peck: 30, dark_wing: 25 }, noRepeat: 2 }
  });

  // Shield-bearer: guards the caster every third turn while the caster lives.
  DS.defineEnemy({
    id: 'a3_aegis_bearer',
    name: 'Aegis Bearer',
    act: 3,
    tier: 'normal',
    hp: [58, 66],
    icon: '🧱',
    scale: 1.05,
    desc: 'A heavy shield-bearer. While a Star-Eaten caster lives, it raises a ward of block around the caster.',
    moves: {
      shield_bash: { name: 'Shield Bash', intent: 'attack', effects: [dmg(10)] },
      raise_aegis: { name: 'Raise Aegis', intent: 'defend', effects: [blk(16)] },
      shield_caster: { name: 'Ward the Caster', intent: 'defend', effects: [{ op: 'custom', fn: shieldCaster }] }
    },
    ai: ({ turn, combat }) => {
      const caster = combat.livingEnemies().some((e) => e.id === 'a3_star_cantor');
      const cycle = caster ? ['shield_caster', 'shield_bash', 'raise_aegis'] : ['shield_bash', 'raise_aegis'];
      return cycle[(turn - 1) % cycle.length];
    }
  });

  // Caster: weakens you, hits, then grows its own chant. Guarded by aegis bearers.
  DS.defineEnemy({
    id: 'a3_star_cantor',
    name: 'Star-Eaten Cantor',
    act: 3,
    tier: 'normal',
    hp: [40, 46],
    icon: '📜',
    scale: 1.0,
    desc: 'A caster who reads hexes from a star-chart. Its chant makes it stronger every third turn.',
    moves: {
      hex_of_stars: { name: 'Hex of Stars', intent: 'attack_debuff', effects: [dmg(6), debuffPlayer('frail', 1)] },
      psalm: { name: 'Starward Psalm', intent: 'attack', effects: [dmg(9)] },
      chant: { name: 'Chant of Lenses', intent: 'buff', effects: [buffSelf('strength', 1)] }
    },
    pattern: { type: 'sequence', moves: ['hex_of_stars', 'psalm', 'chant'], loop: true }
  });

  // A living constellation. Its song makes every draw cost you HP, and it grows with every death around it.
  DS.defineEnemy({
    id: 'a3_lyra_constellation',
    name: 'Lyra Constellation',
    act: 3,
    tier: 'normal',
    hp: [64, 72],
    icon: '✨',
    scale: 1.0,
    desc: 'A constellation that stepped down from the sky. Its song makes each card you draw hurt, and it grows stronger whenever anything dies.',
    triggers: {
      onEnemyDeath: [buffSelf('strength', 1)]
    },
    moves: {
      lyra_song: { name: 'Lyra Song', intent: 'attack_debuff', effects: [dmg(8), debuffPlayer('a3_dread', 1)] },
      harp_string: { name: 'Harp String', intent: 'attack', effects: [dmg(12)] },
      starlight_veil: { name: 'Starlight Veil', intent: 'defend', effects: [blk(16)] }
    },
    pattern: { type: 'sequence', moves: ['lyra_song', 'harp_string', 'starlight_veil', 'harp_string'], loop: true }
  });

  // Enrage at low HP: below 35% it rages once (gaining strength), then fights in a quicker rhythm.
  DS.defineEnemy({
    id: 'a3_ashen_martyr',
    name: 'Ashen Martyr',
    act: 3,
    tier: 'normal',
    hp: [62, 70],
    icon: '🥀',
    scale: 1.0,
    desc: 'A martyr burned to ash who will not lie down. Below 35% health it rages once, then strikes faster.',
    moves: {
      ash_lash: { name: 'Ash Lash', intent: 'attack', effects: [dmg(12)] },
      smolder: { name: 'Smolder', intent: 'defend', effects: [blk(12)] },
      rage_burst: { name: 'Rage Burst', intent: 'attack', effects: [dmg(18), buffSelf('strength', 3), buffSelf('mark', 1)] }
    },
    ai: ({ turn, self }) => {
      if (!self.statuses.mark && self.hp <= self.maxHp * 0.35) return 'rage_burst';
      const seq = self.statuses.mark ? ['ash_lash', 'ash_lash', 'smolder'] : ['ash_lash', 'smolder', 'ash_lash'];
      return seq[(turn - 1) % seq.length];
    }
  });

  // Steals gold, then coughs curses into your discard pile.
  DS.defineEnemy({
    id: 'a3_tithe_collector',
    name: 'Tithe Collector',
    act: 3,
    tier: 'normal',
    hp: [56, 62],
    icon: '💰',
    scale: 1.0,
    desc: 'A tax-man in a grey coat. Collect Tithe takes your gold; its audits leave Regret in your discard pile.',
    moves: {
      collect_tithe: { name: 'Collect Tithe', intent: 'attack', effects: [dmg(11), gold(-15)] },
      audit: { name: 'Audit', intent: 'attack_debuff', effects: [dmg(6), addCard('curse_regret', 'discard', 1)] },
      coffer: { name: 'Shuttered Coffer', intent: 'defend', effects: [blk(14)] }
    },
    pattern: { type: 'random', weights: { collect_tithe: 45, audit: 30, coffer: 25 }, noRepeat: 2 }
  });

  // ======================= ELITES =======================

  // Punishes card-spam: every fourth card you play sparks a comet at you. Its four-turn orbit
  // charges Align, then Eclipse Ring. Below half health the orbit tightens into a comet storm.
  DS.defineEnemy({
    id: 'a3_orrery_titan',
    name: 'Orrery Titan',
    act: 3,
    tier: 'elite',
    hp: [185, 200],
    icon: '⚙️',
    scale: 1.8,
    desc: 'A clockwork planetarium. Every fourth card you play sparks a comet at you. It runs a four-turn orbit that ends in Eclipse Ring; below half health the orbit tightens.',
    triggers: {
      onCardPlayed: { every: 4, effects: [hitPlayer(6)] }
    },
    moves: {
      revolve: { name: 'Revolve', intent: 'attack', effects: [dmg(11, 2)] },
      retrograde: { name: 'Retrograde', intent: 'attack_debuff', effects: [dmg(8), debuffPlayer('frail', 1)] },
      align: { name: 'Align', intent: 'defend', effects: [blk(20), buffSelf('strength', 2)] },
      eclipse_ring: { name: 'Eclipse Ring', intent: 'attack', effects: [dmg(24)] },
      comet_storm: { name: 'Comet Storm', intent: 'attack', effects: [dmg(6, 4)] }
    },
    ai: ({ turn, self }) => {
      const low = self.hp <= self.maxHp * 0.5;
      const seq = low
        ? ['comet_storm', 'eclipse_ring', 'revolve', 'align']
        : ['revolve', 'retrograde', 'align', 'eclipse_ring'];
      return seq[(turn - 1) % seq.length];
    }
  });

  // Tithe Sovereign: steals gold with every levy, curses the deck, and calls seraphs to its court.
  DS.defineEnemy({
    id: 'a3_tithe_sovereign',
    name: 'The Tithe Sovereign',
    act: 3,
    tier: 'elite',
    hp: [190, 205],
    icon: '👑',
    scale: 1.8,
    desc: 'It taxes everything. Its levies take your gold, its ledgers curse your deck, and whenever its court thins it calls two fallen seraphs.',
    moves: {
      levy: { name: 'Levy', intent: 'attack', effects: [dmg(10), gold(-15)] },
      tithe_ledger: { name: 'Tithe Ledger', intent: 'attack_debuff', effects: [dmg(6), addCard('curse_regret', 'discard', 1)] },
      call_choir: { name: 'Call the Choir', intent: 'special', effects: [summon('a3_choir_seraph', 2), buffSelf('mark', 1)] },
      coinbound: { name: 'Coinbound Shield', intent: 'defend', effects: [blk(22), buffSelf('strength', 1)] }
    },
    ai: ({ turn, self, combat, lastMoves }) => {
      const last = lastMoves[lastMoves.length - 1];
      const seraphs = combat.livingEnemies().filter((e) => e.id === 'a3_choir_seraph').length;
      const calls = self.statuses.mark || 0;
      if (turn >= 2 && seraphs < 2 && calls < 2 && last !== 'call_choir') return 'call_choir';
      const seq = ['levy', 'tithe_ledger', 'coinbound', 'levy'];
      return seq[(turn - 1) % seq.length];
    }
  });

  // Mirror Regent: its blade strikes for your strength (twice). It copies half your strength whenever you
  // out-muscle it, and its silver tethers feed on your guard.
  DS.defineEnemy({
    id: 'a3_mirror_regent',
    name: 'Mirror Regent',
    act: 3,
    tier: 'elite',
    hp: [200, 215],
    icon: '🔮',
    scale: 1.9,
    desc: 'A regent of polished silver. Its Mirror Blade strikes for your strength twice, it copies half your strength when you outgrow it, and its silver veil tethers your guard.',
    moves: {
      mirror_blade: {
        name: 'Mirror Blade',
        intent: 'attack',
        effects: [{ op: 'damage', amount: { v: 'status', status: 'strength', of: 'target', mul: 1, add: 4 }, times: 2 }]
      },
      mimic_crown: {
        name: 'Mimic Crown',
        intent: 'buff',
        effects: [{ op: 'apply', status: 'strength', amount: { v: 'status', status: 'strength', of: 'target', mul: 0.5, add: 0 }, to: 'self' }]
      },
      silvered_veil: { name: 'Silvered Veil', intent: 'defend', effects: [blk(24), debuffPlayer('a3_tether', 1)] },
      shatter_reflection: { name: 'Shatter Reflection', intent: 'attack_debuff', effects: [dmg(12), debuffPlayer('weak', 1)] }
    },
    ai: ({ turn, self, combat, lastMoves }) => {
      const last = lastMoves[lastMoves.length - 1];
      const yours = combat.player.statuses.strength || 0;
      const mine = self.statuses.strength || 0;
      if (turn === 1) return 'silvered_veil';
      if (yours - mine >= 2 && last !== 'mimic_crown') return 'mimic_crown';
      if (last === 'mirror_blade') return 'shatter_reflection';
      if (last === 'shatter_reflection') return 'silvered_veil';
      return 'mirror_blade';
    }
  });

  // ======================= BOSSES =======================

  // A wheel of four constellations. Every fourth turn Cygnus heals it. Below half health it collapses
  // into a nursery of nova motes and the wheel turns the other way.
  DS.defineEnemy({
    id: 'a3_eternal_constellation',
    name: 'The Eternal Constellation',
    act: 3,
    tier: 'boss',
    hp: [420, 440],
    icon: '🔭',
    scale: 2.0,
    desc: 'A sky-sized figure that turns its constellations like a wheel. Every fourth turn it heals. Below half health it collapses into a nursery of nova motes, and every death around it makes it stronger.',
    triggers: {
      onEnemyDeath: [buffSelf('strength', 1)]
    },
    moves: {
      aries_ram: { name: 'Aries Ram', intent: 'attack', effects: [dmg(22)] },
      lyra_requiem: { name: 'Lyra Requiem', intent: 'attack_debuff', effects: [dmg(12), debuffPlayer('a3_dread', 1)] },
      draco_coil: { name: 'Draco Coil', intent: 'attack_debuff', effects: [dmg(10, 2), debuffPlayer('a3_unravel', 2)] },
      cygnus_radiance: { name: 'Cygnus Radiance', intent: 'defend', effects: [blk(20), healSelf(18)] },
      stellar_collapse: {
        name: 'Stellar Collapse',
        intent: 'special',
        effects: [buffSelf('mark', 1), buffSelf('strength', 2), summon('a3_nova_mote', 2)]
      }
    },
    ai: ({ turn, self }) => {
      const reborn = !!self.statuses.mark;
      if (!reborn && self.hp <= self.maxHp * 0.5) return 'stellar_collapse';
      const wheel = reborn
        ? ['draco_coil', 'aries_ram', 'lyra_requiem', 'aries_ram', 'cygnus_radiance']
        : ['aries_ram', 'lyra_requiem', 'draco_coil', 'cygnus_radiance'];
      return wheel[(turn - 1) % wheel.length];
    }
  });

  // The pilgrim that ate the sun: every fourth card you play burns you, its Tithe of Night takes your gold,
  // and at half health its hunger becomes totality.
  DS.defineEnemy({
    id: 'a3_eclipse_pilgrim',
    name: 'The Eclipse Pilgrim',
    act: 3,
    tier: 'boss',
    hp: [400, 420],
    icon: '🌘',
    scale: 2.0,
    desc: 'The pilgrim that ate the sun. Every fourth card you play burns you, its Tithe of Night steals your gold, and below half health its hunger becomes totality.',
    triggers: {
      onCardPlayed: { every: 4, effects: [hitPlayer(6)] }
    },
    moves: {
      pilgrims_stride: { name: "Pilgrim's Stride", intent: 'attack', effects: [dmg(16)] },
      tithe_of_night: { name: 'Tithe of Night', intent: 'attack_debuff', effects: [dmg(10), gold(-20), debuffPlayer('weak', 1)] },
      starfast_rite: { name: 'Starfast Rite', intent: 'defend', effects: [blk(20), healSelf(10)] },
      eclipse_hymn: { name: 'Eclipse Hymn', intent: 'special', effects: [summon('a3_nova_mote', 2), addCard('curse_decay', 'discard', 1)] },
      totality: { name: 'Totality', intent: 'attack', effects: [dmg(11, 3)] }
    },
    ai: ({ turn, self, combat }) => {
      const totality = self.hp <= self.maxHp * 0.5;
      const seq = totality
        ? ['totality', 'starfast_rite', 'tithe_of_night', 'totality', 'pilgrims_stride']
        : ['pilgrims_stride', 'tithe_of_night', 'starfast_rite', 'eclipse_hymn', 'tithe_of_night'];
      const pick = seq[(turn - 1) % seq.length];
      const motes = combat.livingEnemies().filter((e) => e.id === 'a3_nova_mote').length;
      return pick === 'eclipse_hymn' && motes >= 2 ? 'pilgrims_stride' : pick;
    }
  });

  // ======================= ENCOUNTERS =======================

  const encounters = [
    // ---- easy ----
    { id: 'a3_enc_b_easy_novae', tier: 'easy', name: 'Dying Stars', enemies: ['a3_nova_mote', 'a3_nova_mote'] },
    { id: 'a3_enc_b_easy_purse', tier: 'easy', name: 'Purse Snatchers', enemies: ['a3_gilt_imp', 'a3_nova_mote'] },
    { id: 'a3_enc_b_easy_crow', tier: 'easy', name: 'Single Omen', enemies: ['a3_omen_crow'] },
    { id: 'a3_enc_b_easy_leech', tier: 'easy', name: 'Lone Leech', enemies: ['a3_void_leech'] },
    { id: 'a3_enc_b_easy_imps', tier: 'easy', name: 'Gilt Imps', enemies: ['a3_gilt_imp', 'a3_gilt_imp'] },

    // ---- normal ----
    { id: 'a3_enc_b_pilgrim_road', tier: 'normal', name: 'The Pilgrim Road', enemies: ['a3_star_pilgrim'] },
    { id: 'a3_enc_b_hourglass_vigil', tier: 'normal', name: 'Hourglass Vigil', enemies: ['a3_hourglass_sentinel'] },
    { id: 'a3_enc_b_leech_brood', tier: 'normal', name: 'Leech Brood', enemies: ['a3_void_leech', 'a3_void_leech', 'a3_void_leech'] },
    { id: 'a3_enc_b_choir_hymn', tier: 'normal', name: 'Choir of the Fallen', enemies: ['a3_choir_seraph', 'a3_choir_seraph', 'a3_choir_seraph'] },
    { id: 'a3_enc_b_crow_murder', tier: 'normal', name: 'Murder of Omens', enemies: ['a3_omen_crow', 'a3_omen_crow', 'a3_nova_mote'] },
    { id: 'a3_enc_b_bastion', tier: 'normal', name: 'Aegis and Cantor', enemies: ['a3_aegis_bearer', 'a3_star_cantor'] },
    { id: 'a3_enc_b_lyra_watch', tier: 'normal', name: 'Lyra Watch', enemies: ['a3_lyra_constellation'] },
    { id: 'a3_enc_b_martyr_pyre', tier: 'normal', name: 'Martyr Pyre', enemies: ['a3_ashen_martyr', 'a3_nova_mote', 'a3_nova_mote'] },
    { id: 'a3_enc_b_tithe_office', tier: 'normal', name: 'The Tithe Office', enemies: ['a3_tithe_collector', 'a3_gilt_imp'] },
    { id: 'a3_enc_b_pilgrim_pair', tier: 'normal', name: 'Pilgrim and Cantor', enemies: ['a3_star_pilgrim', 'a3_star_cantor'] },
    { id: 'a3_enc_b_mirror_pair', tier: 'normal', name: 'Mirror Pair', enemies: ['a3_mirror_wraith', 'a3_mirror_wraith'] },
    { id: 'a3_enc_b_star_choir', tier: 'normal', name: 'Lyra and Choir', enemies: ['a3_lyra_constellation', 'a3_choir_seraph'] },
    { id: 'a3_enc_b_hourglass_crow', tier: 'normal', name: 'Sand and Omen', enemies: ['a3_hourglass_sentinel', 'a3_omen_crow'] },
    { id: 'a3_enc_b_bastion_martyr', tier: 'normal', name: 'Shield and Pyre', enemies: ['a3_aegis_bearer', 'a3_ashen_martyr'] },

    // ---- elite ----
    { id: 'a3_enc_b_orrery', tier: 'elite', name: 'The Orrery', enemies: ['a3_orrery_titan'] },
    { id: 'a3_enc_b_tithe_court', tier: 'elite', name: 'Tithe Court', enemies: ['a3_tithe_sovereign', 'a3_gilt_imp', 'a3_gilt_imp'] },
    { id: 'a3_enc_b_mirror_regent', tier: 'elite', name: 'The Mirror Regent', enemies: ['a3_mirror_regent', 'a3_star_cantor'] },
    { id: 'a3_enc_b_orrery_novae', tier: 'elite', name: 'Orrery and Novae', enemies: ['a3_orrery_titan', 'a3_nova_mote', 'a3_nova_mote'] },

    // ---- boss ----
    { id: 'a3_enc_b_eternal_constellation', tier: 'boss', name: 'The Eternal Constellation', enemies: ['a3_eternal_constellation'] },
    { id: 'a3_enc_b_eclipse_pilgrim', tier: 'boss', name: 'The Eclipse Pilgrim', enemies: ['a3_eclipse_pilgrim'] }
  ];

  for (const enc of encounters) {
    DS.defineEncounter({ id: enc.id, act: 3, tier: enc.tier, name: enc.name, enemies: enc.enemies.slice() });
  }
})();
