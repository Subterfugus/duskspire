(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  const MAX_DEPTH = 30;
  const HAND_LIMIT = 10;
  const BASE_ENERGY = 3;
  const BASE_DRAW = 5;
  const MAX_ENEMIES = 5;
  const ENEMY_DELAY_MS = 450;
  const HIT_DELAY_MS = 90;

  // Statuses allowed to go below zero (removed only when they reach exactly 0).
  const NEGATIVE_OK = { strength: true, dexterity: true };

  // Triggers whose listeners belong to one subject unit (owner must be the subject).
  // Everything else is global: every living unit's listeners are considered.
  const SUBJECT_TRIGGERS = {
    onAttack: true, onAttacked: true, onDamaged: true, onBlockGained: true, onBlockBroken: true,
    onApplyDebuff: true, onKill: true, onDeath: true, onHeal: true, onTurnStart: true, onTurnEnd: true
  };

  // Card target field -> default target for effects that do not give `to`.
  const CARD_TARGET_MAP = {
    enemy: 'target', all_enemies: 'all_enemies', random_enemy: 'random_enemy', self: 'self', none: 'self'
  };

  const CMP = {
    '>': function (a, b) { return a > b; },
    '>=': function (a, b) { return a >= b; },
    '<': function (a, b) { return a < b; },
    '<=': function (a, b) { return a <= b; },
    '==': function (a, b) { return a === b; },
    '!=': function (a, b) { return a !== b; }
  };

  function warn() {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn.apply(console, ['[DS.Combat]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  const warnedOnce = {};
  function warnOnce(key, msg) {
    if (warnedOnce[key]) return;
    warnedOnce[key] = true;
    warn(msg);
  }

  function stacksOf(unit, id) {
    return (unit && unit.statuses && unit.statuses[id]) || 0;
  }

  function hasStatus(unit, id) {
    return stacksOf(unit, id) > 0;
  }

  function cardTypeOf(card) {
    return card && card.data ? card.data.type : null;
  }

  class Combat {
    constructor(run, encounterId, opts) {
      opts = opts || {};
      this.run = run || null;
      this.encounterId = encounterId;
      this.encounter = DS.encounters[encounterId] || null;
      if (!this.encounter) warn('unknown encounter "' + encounterId + '"');
      this.fromEvent = !!opts.fromEvent;

      const run0 = this.run || {};
      const ch = run0.character && DS.characters ? DS.characters[run0.character] : null;
      const maxHp = typeof run0.maxHp === 'number' ? run0.maxHp : 70;
      const hp = typeof run0.hp === 'number' ? Math.max(0, Math.min(run0.hp, maxHp)) : maxHp;
      this.player = {
        isPlayer: true,
        uid: 'player',
        name: ch ? ch.name : 'You',
        hp: hp,
        maxHp: maxHp,
        block: 0,
        statuses: {},
        energy: 0,
        maxEnergy: BASE_ENERGY + this.relicPassive('energy'),
        dead: false
      };

      this.enemies = [];
      this.hand = [];
      this.drawPile = [];
      this.discardPile = [];
      this.exhaustPile = [];

      this.turn = 0;
      this.phase = 'player';
      this.busy = false;

      // trigger bookkeeping: every-N counters, oncePerTurn / oncePerCombat latches
      this.counters = {};
      this.oncePerTurnFired = {};
      this.oncePerCombatFired = {};

      this.cardsPlayedThisTurn = 0;
      this.attacksPlayedThisTurn = 0;

      this._depth = 0;
      this._ended = false;
      this._started = false;
      this._innateCount = 0;

      DS.combat = this;
    }

    // =========================================================================
    // Small helpers
    // =========================================================================

    livingEnemies() {
      return this.enemies.filter(function (e) { return !e.dead && e.hp > 0; });
    }

    _isLive(u) {
      return !!u && !u.dead && u.hp > 0;
    }

    relicPassive(key) {
      let total = 0;
      const relics = this.run && Array.isArray(this.run.relics) ? this.run.relics : [];
      for (let i = 0; i < relics.length; i++) {
        const rid = relics[i] && relics[i].id;
        const def = DS.relics[rid];
        if (!def) {
          warnOnce('relic:' + rid, 'unknown relic id "' + rid + '" in run.relics');
          continue;
        }
        if (!def.passive) continue;
        const v = def.passive[key];
        if (typeof v === 'number') total += v;
      }
      return total;
    }

    _roomType() {
      const tier = this.encounter ? this.encounter.tier : 'normal';
      if (tier === 'elite' || tier === 'boss') return tier;
      return 'fight';
    }

    _stat(key, n) {
      if (this.run && this.run.stats && typeof this.run.stats[key] === 'number') {
        this.run.stats[key] += n;
      }
    }

    _syncRun() {
      if (this.run) this.run.hp = Math.max(0, this.player.hp);
    }

    _update() {
      try {
        this._refreshIntents();
      } catch (err) {
        console.error('[DS.Combat] intent refresh failed', err);
      }
      DS.events.emit('combat:update', {});
    }

    _unitByUid(uid) {
      if (uid === 'player') return this.player;
      for (let i = 0; i < this.enemies.length; i++) {
        if (this.enemies[i].uid === uid) return this.enemies[i];
      }
      return null;
    }

    _resolveUnit(t) {
      if (!t) return null;
      if (typeof t === 'string') return this._unitByUid(t);
      return t;
    }

    _detach(card) {
      const piles = [this.hand, this.drawPile, this.discardPile, this.exhaustPile];
      for (let p = 0; p < piles.length; p++) {
        const i = piles[p].indexOf(card);
        if (i >= 0) {
          piles[p].splice(i, 1);
          return true;
        }
      }
      return false;
    }

    makeCard(inst) {
      if (!inst || !DS.cards[inst.id]) {
        warn('makeCard: unknown card id "' + (inst && inst.id) + '"');
        return null;
      }
      const data = DS.getCardData(inst);
      return { uid: DS.uid(), id: inst.id, upgraded: !!inst.upgraded, data: data, cost: data.cost };
    }

    upgradeCombatCard(card) {
      if (!card || card.upgraded) return false;
      card.upgraded = true;
      card.data = DS.getCardData({ id: card.id, upgraded: true });
      card.cost = card.data.cost;
      return true;
    }

    // Removes `n` stacks (default 1) of a status; removes it at 0.
    _takeStack(unit, id, n) {
      const cur = unit.statuses[id];
      if (cur === undefined) return false;
      const next = cur - (n === undefined ? 1 : n);
      if (next <= 0) delete unit.statuses[id];
      else unit.statuses[id] = next;
      DS.events.emit('combat:status', { target: unit, status: id, amount: -(n === undefined ? 1 : n) });
      this._update();
      return true;
    }

    _removeStatus(unit, id) {
      const cur = unit.statuses[id];
      if (cur === undefined) return false;
      delete unit.statuses[id];
      DS.events.emit('combat:status', { target: unit, status: id, amount: -cur });
      this._update();
      return true;
    }

    // =========================================================================
    // Values, conditions, targets
    // =========================================================================

    val(v, ctx, def) {
      if (def === undefined) def = 0;
      if (v === undefined || v === null) return def;
      if (typeof v === 'number') return isFinite(v) ? v : def;
      if (typeof v === 'string') {
        if (v.trim() !== '' && !isNaN(Number(v))) return Number(v);
        warn('bad value string', v);
        return def;
      }
      if (typeof v === 'object' && typeof v.v === 'string') {
        const base = this._valueSource(v.v, v, ctx);
        const mul = typeof v.mul === 'number' ? v.mul : 1;
        const add = typeof v.add === 'number' ? v.add : 0;
        return Math.floor(base * mul) + add;
      }
      warn('bad value', v);
      return def;
    }

    _valueSource(src, spec, ctx) {
      const ofUnit = (spec.of === 'target' ? (ctx.target || ctx.source) : (ctx.source || this.player)) || this.player;
      switch (src) {
        case 'x': return ctx.x || 0;
        case 'stacks': return ctx.stacks || 0;
        case 'block': return ofUnit.block || 0;
        case 'hp': return ofUnit.hp || 0;
        case 'max_hp': return ofUnit.maxHp || 0;
        case 'missing_hp': return Math.max(0, (ofUnit.maxHp || 0) - (ofUnit.hp || 0));
        case 'status': return stacksOf(ofUnit, spec.status);
        case 'hand': return this.hand.length;
        case 'draw_pile': return this.drawPile.length;
        case 'discard_pile': return this.discardPile.length;
        case 'exhaust_pile': return this.exhaustPile.length;
        case 'deck_size':
          if (this.run && Array.isArray(this.run.deck)) return this.run.deck.length;
          return this.hand.length + this.drawPile.length + this.discardPile.length + this.exhaustPile.length;
        case 'energy': return this.player.energy || 0;
        case 'turn': return this.turn;
        case 'cards_played': return this.cardsPlayedThisTurn;
        case 'attacks_played': return this.attacksPlayedThisTurn;
        case 'enemies': return this.livingEnemies().length;
        case 'gold': return this.run ? (this.run.gold || 0) : 0;
        default:
          warn('unknown value source "' + src + '"');
          return 0;
      }
    }

    cond(c, ctx) {
      if (c === undefined || c === null) return true;
      if (Array.isArray(c)) {
        for (let i = 0; i < c.length; i++) if (!this.cond(c[i], ctx)) return false;
        return true;
      }
      if (typeof c === 'function') {
        try { return !!c(ctx); } catch (err) { warn('cond function threw', err); return false; }
      }
      const f = CMP[c.cmp];
      if (!f) {
        warn('unknown comparison "' + c.cmp + '"');
        return false;
      }
      return !!f(this.val(c.left, ctx, 0), this.val(c.right, ctx, 0));
    }

    // Contextual default target for effects that normally hit "the other party".
    _hostileDefault(ctx) {
      if (ctx.kind === 'move' || ctx.kind === 'trigger' || ctx.kind === 'onSpawn') return 'target';
      if (ctx.targetKind && CARD_TARGET_MAP[ctx.targetKind]) return CARD_TARGET_MAP[ctx.targetKind];
      return 'self';
    }

    resolveTargets(to, ctx) {
      const src = ctx.source || this.player;
      const fromPlayer = !!src.isPlayer;
      switch (to) {
        case 'self':
          return [src];
        case 'player':
          return [this.player];
        case 'target': {
          if (ctx.target) return this._isLive(ctx.target) ? [ctx.target] : [];
          if (fromPlayer) {
            const pick = DS.rng.pick(this.livingEnemies());
            return pick ? [pick] : [];
          }
          return [this.player];
        }
        case 'all_enemies':
          return fromPlayer ? this.livingEnemies() : [this.player];
        case 'random_enemy': {
          if (!fromPlayer) return [this.player];
          const pick = DS.rng.pick(this.livingEnemies());
          return pick ? [pick] : [];
        }
        default:
          warn('unknown target "' + to + '"');
          return [];
      }
    }

    _mkCtx(o) {
      const card = o.card || null;
      let targetKind = o.targetKind;
      if (targetKind === undefined) targetKind = card && card.data ? card.data.target : 'enemy';
      return {
        combat: this,
        run: this.run,
        source: o.source || this.player,
        target: o.target || null,
        card: card,
        x: o.x || 0,
        stacks: o.stacks || 0,
        kind: o.kind || 'card',
        targetKind: targetKind,
        potion: o.potion || null,
        force: !!o.force,
        owner: o.owner || null
      };
    }

    _ctxOpts(ctx) {
      return {
        source: ctx.source,
        target: ctx.target,
        card: ctx.card,
        x: ctx.x,
        owner: ctx.owner,
        stacks: ctx.stacks,
        kind: ctx.kind,
        targetKind: ctx.targetKind,
        potion: ctx.potion,
        force: ctx.force,
        owner: ctx.owner
      };
    }

    // =========================================================================
    // Effect interpreter
    // =========================================================================

    async runEffects(effects, opts) {
      const list = effects === undefined || effects === null ? [] : (Array.isArray(effects) ? effects : [effects]);
      if (!list.length) return;
      if (this._depth >= MAX_DEPTH) {
        warn('effect depth limit reached; skipping effects');
        return;
      }
      const ctx = this._mkCtx(opts || {});
      this._depth++;
      try {
        for (let i = 0; i < list.length; i++) {
          if (this._ended && !ctx.force) break;
          const eff = list[i];
          if (!eff || typeof eff !== 'object') {
            warn('bad effect entry', eff);
            continue;
          }
          try {
            await this._exec(eff, ctx);
          } catch (err) {
            console.error('[DS.Combat] effect "' + eff.op + '" failed', err);
          }
        }
      } finally {
        this._depth--;
      }
    }

    async _exec(eff, ctx) {
      switch (eff.op) {
        case 'damage': return this._opDamage(eff, ctx);
        case 'lose_hp': return this._opLoseHp(eff, ctx);
        case 'block': return this._opBlock(eff, ctx);
        case 'apply': return this._opApply(eff, ctx);
        case 'remove_status': return this._opRemoveStatus(eff, ctx);
        case 'multiply_status': return this._opMultiplyStatus(eff, ctx);
        case 'heal': return this._opHeal(eff, ctx);
        case 'draw': return this._opDraw(eff, ctx);
        case 'energy': return this._opEnergy(eff, ctx);
        case 'discard': return this._opDiscard(eff, ctx);
        case 'exhaust': return this._opExhaust(eff, ctx);
        case 'add_card': return this._opAddCard(eff, ctx);
        case 'upgrade_hand': return this._opUpgradeHand(eff, ctx);
        case 'gold': return this._opGold(eff, ctx);
        case 'max_hp': return this._opMaxHp(eff, ctx);
        case 'repeat': return this._opRepeat(eff, ctx);
        case 'if': return this._opIf(eff, ctx);
        case 'chance': return this._opChance(eff, ctx);
        case 'summon': return this._opSummon(eff, ctx);
        case 'custom': return this._opCustom(eff, ctx);
        default:
          if (DS.OPS.indexOf(eff.op) >= 0) warn('op "' + eff.op + '" is run-level and has no effect in combat');
          else warn('unknown op "' + eff.op + '"');
          return undefined;
      }
    }

    // ----- damage / HP -----------------------------------------------------

    calcDamage(base, attacker, target, ctx) {
      const flat = !!(ctx && ctx.kind === 'trigger');
      let add = 0;
      let mul = 1;
      if (attacker && !flat) {
        for (const id in attacker.statuses) {
          const def = DS.statuses[id];
          if (!def || !def.mods) continue;
          const s = attacker.statuses[id];
          if (typeof def.mods.attackDealtAdd === 'number') add += def.mods.attackDealtAdd * s;
          if (typeof def.mods.attackDealtMul === 'number') mul *= def.mods.attackDealtMul;
        }
      }
      if (target) {
        for (const id in target.statuses) {
          const def = DS.statuses[id];
          if (!def || !def.mods) continue;
          const s = target.statuses[id];
          if (typeof def.mods.attackTakenAdd === 'number') add += def.mods.attackTakenAdd * s;
          if (typeof def.mods.attackTakenMul === 'number') mul *= def.mods.attackTakenMul;
        }
      }
      return Math.max(0, Math.floor((base + add) * mul));
    }

    _calcBlock(base, unit) {
      let add = 0;
      let mul = 1;
      for (const id in unit.statuses) {
        const def = DS.statuses[id];
        if (!def || !def.mods) continue;
        const s = unit.statuses[id];
        if (typeof def.mods.blockAdd === 'number') add += def.mods.blockAdd * s;
        if (typeof def.mods.blockMul === 'number') mul *= def.mods.blockMul;
      }
      return Math.max(0, Math.floor((base + add) * mul));
    }

    // Raw HP loss after intangible and buffer. Returns the HP actually removed.
    _loseHpCore(t, amount) {
      let amt = Math.max(0, Math.floor(amount));
      if (amt <= 0 || !t || t.hp <= 0) return 0;
      if (hasStatus(t, 'intangible') && amt > 1) amt = 1;
      if (hasStatus(t, 'buffer')) {
        this._takeStack(t, 'buffer', 1);
        return 0;
      }
      amt = Math.min(amt, t.hp);
      if (amt <= 0) return 0;
      t.hp -= amt;
      if (t.isPlayer) this._syncRun();
      else this._stat('damageDealt', amt);
      return amt;
    }

    // Attack-style hit: block first, then HP. Returns {hpLost, blocked, killed}.
    async _hit(t, amount, ctx) {
      if (!this._isLive(t)) return { hpLost: 0, blocked: 0, killed: false };
      const source = ctx.source || null;
      const attackLike = ctx.kind !== 'trigger';
      const hadBlock = t.block;
      let remaining = Math.max(0, amount);
      // Intangible caps incoming damage at 1 before block is applied.
      if (hasStatus(t, 'intangible') && remaining > 1) remaining = 1;
      let blocked = 0;
      if (t.block > 0 && remaining > 0) {
        blocked = Math.min(t.block, remaining);
        t.block -= blocked;
        remaining -= blocked;
      }
      const lost = this._loseHpCore(t, remaining);
      if (lost > 0 || blocked > 0) {
        DS.events.emit('combat:damage', { target: t, amount: lost, blocked: blocked, source: source });
      }
      const died = t.hp <= 0 && !t.dead;
      if (died) {
        await this._onDeath(t, source);
      } else {
        if (attackLike && hadBlock > 0 && t.block === 0 && blocked > 0) {
          await this.fire('onBlockBroken', t, { target: source, fromAttack: true });
        }
        if (lost > 0) {
          await this.fire('onDamaged', t, { target: source, fromAttack: attackLike });
        }
        if (attackLike && this._isLive(t)) {
          await this.fire('onAttacked', t, { target: source });
        }
      }
      if (attackLike && source && this._isLive(source)) {
        await this.fire('onAttack', source, { target: t });
      }
      if (attackLike && !this._ended) await DS.hooks.delay(HIT_DELAY_MS);
      return { hpLost: lost, blocked: blocked, killed: died };
    }

    // HP loss ignoring block (lose_hp op, poison, burn, etc.).
    async _loseHpFull(t, amount, source, fromAttack) {
      if (!this._isLive(t)) return 0;
      const lost = this._loseHpCore(t, amount);
      // Self-inflicted HP loss (poison, burn) is credited to whoever last applied a debuff to the unit.
      let killer = source || null;
      if (killer === t && t.lastDebuffer && t.lastDebuffer !== t) killer = t.lastDebuffer;
      // The damage event reports the raw source, so a poison or burn tick (source === target) reads as
      // self-inflicted in the UI. The debuffer is only credited for the kill itself, below.
      if (lost > 0) DS.events.emit('combat:damage', { target: t, amount: lost, blocked: 0, source: source || null });
      if (t.hp <= 0 && !t.dead) {
        await this._onDeath(t, killer);
      } else if (lost > 0) {
        await this.fire('onDamaged', t, { target: killer, fromAttack: !!fromAttack });
      }
      await this._checkEnd();
      return lost;
    }

    async _opDamage(eff, ctx) {
      const base = this.val(eff.amount, ctx, 0);
      const times = Math.max(0, Math.floor(this.val(eff.times, ctx, 1)));
      const to = eff.to || this._hostileDefault(ctx);
      for (let i = 0; i < times; i++) {
        const targets = this.resolveTargets(to, ctx);
        for (let j = 0; j < targets.length; j++) {
          if (this._ended && !ctx.force) return;
          const t = targets[j];
          if (!this._isLive(t)) continue;
          const dmg = this.calcDamage(base, ctx.source, t, ctx);
          const res = await this._hit(t, dmg, ctx);
          if (res.killed && eff.onKill && this.player.hp > 0) {
            await this.runEffects(eff.onKill, Object.assign(this._ctxOpts(ctx), { target: t, force: true }));
          }
        }
      }
      await this._checkEnd();
    }

    async _opLoseHp(eff, ctx) {
      const amt = this.val(eff.amount, ctx, 0);
      const targets = this.resolveTargets(eff.to || this._hostileDefault(ctx), ctx);
      for (let i = 0; i < targets.length; i++) {
        if (this._ended && !ctx.force) return;
        await this._loseHpFull(targets[i], amt, ctx.source, false);
      }
      await this._checkEnd();
    }

    async heal(t, amount, source) {
      if (!this._isLive(t) || !(amount > 0)) return 0;
      const before = t.hp;
      t.hp = Math.min(t.maxHp, t.hp + Math.floor(amount));
      const gained = t.hp - before;
      if (t.isPlayer) this._syncRun();
      if (gained > 0) {
        DS.events.emit('combat:heal', { target: t, amount: gained });
        this._update();
        await this.fire('onHeal', t, { target: source || null });
      }
      return gained;
    }

    async _opHeal(eff, ctx) {
      const amt = this.val(eff.amount, ctx, 0);
      const targets = this.resolveTargets(eff.to || 'self', ctx);
      for (let i = 0; i < targets.length; i++) await this.heal(targets[i], amt, ctx.source);
    }

    async _onDeath(unit, killer) {
      if (!unit || unit.dead) return;
      unit.dead = true;
      unit.hp = Math.max(0, unit.hp);
      if (unit.isPlayer) {
        this._syncRun();
        this._update();
        await this.fire('onDeath', unit, {});
        return;
      }
      DS.events.emit('combat:enemyDied', { enemy: unit });
      this._update();
      await this.fire('onDeath', unit, { target: killer });
      if (killer && killer !== unit) await this.fire('onKill', killer, { target: unit });
      await this.fire('onEnemyDeath', null, { target: unit });
    }

    // Ends combat if the player died or every enemy is dead. Returns true when the combat is over.
    async _checkEnd() {
      if (this._ended) return true;
      if (!this._started) return false;
      if (this.player.hp <= 0 || this.player.dead) {
        await this._endCombat('lost');
        return true;
      }
      if (this.livingEnemies().length === 0) {
        await this._endCombat('won');
        return true;
      }
      return false;
    }

    async _endCombat(result) {
      if (this._ended) return;
      this._ended = true;
      this.phase = result;
      this._syncRun();
      if (result === 'won') {
        try {
          await this.fire('onCombatEnd', null, { force: true });
        } catch (err) {
          console.error('[DS.Combat] onCombatEnd failed', err);
        }
        this._syncRun();
        // The fight is done: its map room is settled and the run is saved with the won state.
        if (this.run && DS.Run && typeof DS.Run.settleRoom === 'function') DS.Run.settleRoom(this.run);
      }
      this._update();
      DS.events.emit('combat:end', { result: result });
    }

    // ----- block -----------------------------------------------------------

    async gainBlock(t, base, modifiable) {
      if (!t || t.dead) return 0;
      const amt = modifiable ? this._calcBlock(base, t) : Math.max(0, Math.floor(base));
      if (amt <= 0) return 0;
      t.block += amt;
      DS.events.emit('combat:block', { target: t, amount: amt });
      this._update();
      await this.fire('onBlockGained', t, {});
      return amt;
    }

    async _opBlock(eff, ctx) {
      const base = this.val(eff.amount, ctx, 0);
      const targets = this.resolveTargets(eff.to || 'self', ctx);
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        // dexterity / frail only modify block a card or move grants to its own user
        const modifiable = ctx.kind !== 'trigger' && t === ctx.source;
        await this.gainBlock(t, base, modifiable);
      }
    }

    // ----- statuses --------------------------------------------------------

    async applyStatus(target, id, amount, source) {
      const def = DS.statuses[id];
      if (!def) {
        warn('apply: unknown status "' + id + '"');
        return false;
      }
      if (!target || target.dead || !amount) return false;
      const isDebuff = def.type === 'debuff';
      const fromOther = !!source && source !== target;
      if (amount > 0 && isDebuff && fromOther && hasStatus(target, 'artifact')) {
        this._takeStack(target, 'artifact', 1);
        return false;
      }
      if (amount > 0 && isDebuff && fromOther) target.lastDebuffer = source;
      const cur = target.statuses[id] || 0;
      let next;
      if (def.stacks === false) {
        next = amount > 0 ? 1 : 0;
      } else {
        next = cur + amount;
      }
      if (next === 0 || (next < 0 && !NEGATIVE_OK[id] && !def.allowNegative)) {
        if (target.statuses[id] !== undefined) delete target.statuses[id];
      } else {
        target.statuses[id] = next;
      }
      DS.events.emit('combat:status', { target: target, status: id, amount: amount });
      this._update();
      if (amount > 0 && isDebuff && fromOther && source.isPlayer !== target.isPlayer) {
        await this.fire('onApplyDebuff', source, { target: target, status: id });
      }
      return true;
    }

    _targetsFor(eff, ctx) {
      return this.resolveTargets(eff.to || this._hostileDefault(ctx), ctx);
    }

    async _opApply(eff, ctx) {
      const amount = this.val(eff.amount, ctx, 1);
      const targets = this._targetsFor(eff, ctx);
      for (let i = 0; i < targets.length; i++) {
        await this.applyStatus(targets[i], eff.status, amount, ctx.source);
      }
    }

    async _opRemoveStatus(eff, ctx) {
      const targets = this._targetsFor(eff, ctx);
      for (let i = 0; i < targets.length; i++) this._removeStatus(targets[i], eff.status);
    }

    async _opMultiplyStatus(eff, ctx) {
      const factor = this.val(eff.factor, ctx, 1);
      const targets = this._targetsFor(eff, ctx);
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const cur = t.statuses[eff.status];
        if (cur === undefined) continue;
        const next = Math.floor(cur * factor);
        if (next <= 0) delete t.statuses[eff.status];
        else t.statuses[eff.status] = next;
        DS.events.emit('combat:status', { target: t, status: eff.status, amount: next - cur });
      }
      this._update();
    }

    // Decay / expire at turn start or end. Triggers run before this (see callers).
    _decay(unit, when) {
      const ids = Object.keys(unit.statuses);
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const cur = unit.statuses[id];
        if (cur === undefined) continue;
        const def = DS.statuses[id];
        if (!def) continue;
        if (def.expire === when) {
          this._removeStatus(unit, id);
          continue;
        }
        if (def.decay === when) {
          const next = def.stacks === false ? 0 : cur - 1;
          if (next <= 0) delete unit.statuses[id];
          else unit.statuses[id] = next;
          DS.events.emit('combat:status', { target: unit, status: id, amount: -1 });
        }
      }
      this._update();
    }

    // ----- draw / energy / piles -------------------------------------------

    async draw(n) {
      if (hasStatus(this.player, 'no_draw')) return 0;
      let drawn = 0;
      for (let i = 0; i < n; i++) {
        if (this._ended) break;
        const card = await this._drawOne();
        if (!card) break;
        drawn++;
      }
      return drawn;
    }

    async _drawOne() {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) return null;
        this.drawPile.push.apply(this.drawPile, this.discardPile.splice(0, this.discardPile.length));
        DS.rng.shuffle(this.drawPile);
        DS.events.emit('combat:shuffle', {});
        await this.fire('onShuffle', null, {});
      }
      const card = this.drawPile.pop();
      if (this.hand.length >= HAND_LIMIT) {
        this.discardPile.push(card);
        this._update();
        return card;
      }
      this.hand.push(card);
      DS.events.emit('combat:cardDrawn', { card: card });
      this._update();
      await this.fire('onCardDrawn', null, { card: card });
      if (card.data.onDraw && card.data.onDraw.length) {
        await this.runEffects(card.data.onDraw, { source: this.player, card: card, kind: 'card', targetKind: 'none' });
      }
      return card;
    }

    async _opDraw(eff, ctx) {
      await this.draw(Math.max(0, Math.floor(this.val(eff.amount, ctx, 1))));
    }

    _opEnergy(eff, ctx) {
      const amt = this.val(eff.amount, ctx, 0);
      this.player.energy = Math.max(0, (this.player.energy || 0) + amt);
      this._update();
    }

    _placeCard(card, to) {
      if (to === 'draw') {
        this.drawPile.push(card);
      } else if (to === 'discard') {
        this.discardPile.push(card);
      } else if (this.hand.length >= HAND_LIMIT) {
        this.discardPile.push(card);
      } else {
        this.hand.push(card);
      }
    }

    // Lets the player choose from `pool` via the UI hook; pads to `count` when not optional.
    async _chooseCards(pool, count, prompt, optional) {
      let picked = [];
      try {
        const res = await DS.hooks.chooseCards({ cards: pool.slice(), count: count, prompt: prompt, optional: !!optional });
        if (Array.isArray(res)) {
          picked = res.filter(function (c, i, a) { return pool.indexOf(c) >= 0 && a.indexOf(c) === i; });
        }
      } catch (err) {
        console.warn('[DS.Combat] chooseCards hook failed', err);
      }
      picked = picked.slice(0, count);
      if (!optional) {
        for (let i = 0; i < pool.length && picked.length < count; i++) {
          if (picked.indexOf(pool[i]) < 0) picked.push(pool[i]);
        }
      }
      return picked;
    }

    _matchesFilter(card, eff) {
      const type = card.data.type;
      if (eff.type !== undefined && type !== eff.type) return false;
      if (eff.notType !== undefined && type === eff.notType) return false;
      return true;
    }

    async _opDiscard(eff, ctx) {
      const pool = this.hand.slice();
      if (!pool.length) return;
      const want = eff.amount === 'all' ? pool.length : Math.max(0, Math.floor(this.val(eff.amount, ctx, 1)));
      const count = Math.min(want, pool.length);
      if (count <= 0) return;
      let chosen;
      if (count >= pool.length) chosen = pool;
      else if (eff.random) chosen = DS.rng.shuffle(pool.slice()).slice(0, count);
      else chosen = await this._chooseCards(pool, count, 'Choose cards to discard.', false);
      for (let i = 0; i < chosen.length; i++) {
        if (this._ended && !ctx.force) break;
        await this._discardCard(chosen[i], { byEffect: true });
      }
      this._update();
    }

    async _discardCard(card, opts) {
      if (!this._detach(card)) return;
      this.discardPile.push(card);
      if (card.data.onDiscard && card.data.onDiscard.length) {
        await this.runEffects(card.data.onDiscard, { source: this.player, card: card, kind: 'card', targetKind: 'none' });
      }
      if (opts && opts.byEffect) await this.fire('onCardDiscarded', null, { card: card });
      this._update();
    }

    async exhaustCard(card) {
      this._detach(card);
      this.exhaustPile.push(card);
      DS.events.emit('combat:cardExhausted', { card: card });
      this._update();
      if (card.data.onExhaust && card.data.onExhaust.length) {
        await this.runEffects(card.data.onExhaust, { source: this.player, card: card, kind: 'card', targetKind: 'none' });
      }
      await this.fire('onCardExhausted', null, { card: card });
      this._update();
    }

    async _opExhaust(eff, ctx) {
      const from = eff.from || 'hand';
      const pile = from === 'draw' ? this.drawPile : (from === 'discard' ? this.discardPile : this.hand);
      const pool = pile.filter((c) => this._matchesFilter(c, eff));
      if (!pool.length) return;
      const want = eff.amount === 'all' ? pool.length : Math.max(0, Math.floor(this.val(eff.amount, ctx, 1)));
      const count = Math.min(want, pool.length);
      if (count <= 0) return;
      let chosen;
      if (count >= pool.length) chosen = pool.slice();
      else if (eff.random) chosen = DS.rng.shuffle(pool.slice()).slice(0, count);
      else chosen = await this._chooseCards(pool, count, 'Choose cards to exhaust.', false);
      for (let i = 0; i < chosen.length; i++) {
        if (this._ended && !ctx.force) break;
        await this.exhaustCard(chosen[i]);
      }
      this._update();
    }

    // Random card id: class-specific pool (run character by default) plus colorless cards.
    _randomCardId(eff) {
      const base = {};
      if (eff.type !== undefined) base.type = eff.type;
      if (eff.rarity !== undefined) base.rarity = eff.rarity;
      let classes;
      if (eff.class !== undefined) classes = [eff.class];
      else {
        classes = [];
        if (this.run && this.run.character) classes.push(this.run.character);
        classes.push('colorless');
      }
      let pool = [];
      for (let i = 0; i < classes.length; i++) {
        pool = pool.concat(DS.cardPool(Object.assign({ class: classes[i] }, base)));
      }
      if (!pool.length) {
        warn('add_card random: empty pool', classes, base);
        return null;
      }
      return DS.rng.pick(pool).id;
    }

    async _opAddCard(eff, ctx) {
      const n = Math.max(0, Math.floor(this.val(eff.amount, ctx, 1)));
      const to = eff.to || 'hand';
      for (let i = 0; i < n; i++) {
        let id = eff.card;
        if (id === 'random') {
          id = this._randomCardId(eff);
          if (!id) continue;
        }
        const card = this.makeCard({ id: id, upgraded: !!eff.upgraded });
        if (!card) continue;
        this._placeCard(card, to);
      }
      this._update();
    }

    _opUpgradeHand(eff, ctx) {
      const pool = this.hand.filter(function (c) { return !c.upgraded && c.data.upgrade; });
      const want = eff.amount === 'all' ? pool.length : Math.max(0, Math.floor(this.val(eff.amount, ctx, 1)));
      const chosen = want >= pool.length ? pool : DS.rng.shuffle(pool.slice()).slice(0, want);
      for (let i = 0; i < chosen.length; i++) this.upgradeCombatCard(chosen[i]);
      this._update();
    }

    // ----- gold / max hp ---------------------------------------------------

    async _opGold(eff, ctx) {
      const amt = this.val(eff.amount, ctx, 0);
      if (!this.run || !amt) return;
      this.run.gold = Math.max(0, (this.run.gold || 0) + amt);
      if (amt > 0) {
        DS.events.emit('run:gold', { amount: amt });
      }
      DS.events.emit('run:update', {});
      if (amt > 0) await this.fire('onGoldGained', null, {});
      this._update();
    }

    async _opMaxHp(eff, ctx) {
      const amt = Math.floor(this.val(eff.amount, ctx, 0));
      const p = this.player;
      p.maxHp = Math.max(1, p.maxHp + amt);
      if (amt > 0) p.hp = Math.min(p.maxHp, p.hp + amt);
      else p.hp = Math.min(p.hp, p.maxHp);
      if (this.run) this.run.maxHp = p.maxHp;
      this._syncRun();
      DS.events.emit('run:update', {});
      this._update();
      await this._checkEnd();
    }

    // ----- control flow ----------------------------------------------------

    async _opRepeat(eff, ctx) {
      const times = Math.max(0, Math.floor(this.val(eff.times, ctx, 1)));
      for (let i = 0; i < times; i++) {
        if (this._ended && !ctx.force) break;
        await this.runEffects(eff.effects, this._ctxOpts(ctx));
      }
    }

    async _opIf(eff, ctx) {
      const ok = this.cond(eff.cond, ctx);
      await this.runEffects(ok ? eff.then : eff.else, this._ctxOpts(ctx));
    }

    async _opChance(eff, ctx) {
      const p = this.val(eff.p, ctx, 0);
      const ok = DS.rng.next() < p;
      await this.runEffects(ok ? eff.then : eff.else, this._ctxOpts(ctx));
    }

    async spawnEnemy(id) {
      const def = DS.enemies[id];
      if (!def) {
        warn('spawn: unknown enemy "' + id + '"');
        return null;
      }
      if (this.livingEnemies().length >= MAX_ENEMIES) return null;
      let hp;
      if (typeof def.hp === 'number') hp = def.hp;
      else if (Array.isArray(def.hp)) hp = DS.rng.int(def.hp[0], def.hp[1]);
      else hp = 10;
      const e = {
        isPlayer: false,
        uid: DS.uid(),
        id: def.id,
        def: def,
        name: def.name || def.id,
        hp: hp,
        maxHp: hp,
        block: 0,
        statuses: {},
        dead: false,
        intent: null,
        turnNum: 0,
        lastMoves: [],
        seqIndex: 0,
        scale: def.scale || 1,
        icon: def.icon,
        tier: def.tier
      };
      this.enemies.push(e);
      if (def.onSpawn && def.onSpawn.length) {
        await this.runEffects(def.onSpawn, { source: e, target: this.player, kind: 'move', targetKind: 'enemy' });
      }
      if (!e.dead) this._chooseIntent(e);
      this._update();
      return e;
    }

    async _opSummon(eff, ctx) {
      const n = Math.max(0, Math.floor(this.val(eff.amount, ctx, 1)));
      for (let i = 0; i < n; i++) {
        if (this._ended && !ctx.force) break;
        const e = await this.spawnEnemy(eff.enemy);
        if (!e) break;
      }
      this._update();
    }

    async _opCustom(eff, ctx) {
      if (typeof eff.fn !== 'function') {
        warn('custom effect without fn');
        return;
      }
      try {
        await eff.fn({ combat: this, run: this.run, source: ctx.source, target: ctx.target, card: ctx.card, x: ctx.x });
      } catch (err) {
        warn('custom effect threw', err);
      }
      this._update();
    }

    // =========================================================================
    // Triggers
    // =========================================================================

    // Collects every listener (relic, status, enemy definition) for a trigger name.
    // subject: the unit the event is about (owner must match for subject triggers),
    // or null for global triggers (every living unit's listeners apply).
    _listeners(name, subject) {
      const units = subject ? [subject] : [this.player].concat(this.livingEnemies());
      const out = [];
      const relics = this.run && Array.isArray(this.run.relics) ? this.run.relics : [];
      for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (!u) continue;
        if (u.dead && name !== 'onDeath') continue;
        if (u.isPlayer) {
          for (let r = 0; r < relics.length; r++) {
            const entry = relics[r];
            const def = DS.relics[entry && entry.id];
            if (!def || !def.triggers || !def.triggers[name]) continue;
            out.push({ owner: u, kind: 'relic', id: entry.id, triggers: def.triggers, entry: entry });
          }
        } else if (u.def && u.def.triggers && u.def.triggers[name]) {
          out.push({ owner: u, kind: 'enemy', id: u.id, triggers: u.def.triggers });
        }
        const sids = Object.keys(u.statuses);
        for (let s = 0; s < sids.length; s++) {
          const def = DS.statuses[sids[s]];
          if (!def || !def.triggers || !def.triggers[name]) continue;
          out.push({ owner: u, kind: 'status', id: sids[s], triggers: def.triggers });
        }
      }
      return out;
    }

    _listenerActive(L) {
      if (L.kind === 'status') return L.owner.statuses[L.id] !== undefined;
      return true;
    }

    _whenOk(w, owner, info) {
      const card = info.card || null;
      const cardType = info.cardType || cardTypeOf(card);
      if (w.cardType !== undefined && w.cardType !== cardType) return false;
      if (w.turn !== undefined && w.turn !== this.turn) return false;
      const pct = owner.maxHp > 0 ? (owner.hp * 100) / owner.maxHp : 0;
      if (w.hpBelowPct !== undefined && !(pct < w.hpBelowPct)) return false;
      if (w.hpAbovePct !== undefined && !(pct > w.hpAbovePct)) return false;
      if (w.costAtLeast !== undefined) {
        if (!card) return false;
        const c = card.cost === 'X' ? 0 : (typeof card.cost === 'number' ? card.cost : -1);
        if (c < w.costAtLeast) return false;
      }
      if (w.roomType !== undefined && w.roomType !== this._roomType()) return false;
      if (w.fromAttack !== undefined && !!info.fromAttack !== !!w.fromAttack) return false;
      return true;
    }

    async _runListener(L, name, info) {
      const raw = L.triggers[name];
      const cfg = Array.isArray(raw) ? { effects: raw } : (raw && typeof raw === 'object' ? raw : null);
      if (!cfg) return;
      const owner = L.owner;
      if (cfg.when && !this._whenOk(cfg.when, owner, info)) return;

      const key = owner.uid + '|' + L.kind + ':' + L.id + '|' + name;
      if (cfg.oncePerTurn && this.oncePerTurnFired[key] === this.turn) return;
      if (cfg.oncePerCombat && this.oncePerCombatFired[key]) return;
      if (typeof cfg.every === 'number' && cfg.every > 0) {
        const n = (this.counters[key] || 0) + 1;
        this.counters[key] = n;
        if (n % cfg.every !== 0) return;
      }
      if (cfg.oncePerTurn) this.oncePerTurnFired[key] = this.turn;
      if (cfg.oncePerCombat) this.oncePerCombatFired[key] = true;

      let stacks = 0;
      if (L.kind === 'status') stacks = stacksOf(owner, L.id);
      else if (L.kind === 'relic') stacks = (L.entry && typeof L.entry.counter === 'number') ? L.entry.counter : 0;

      let target = info.target || null;
      if (!target) {
        if (owner.isPlayer) {
          const pick = DS.rng.pick(this.livingEnemies());
          target = pick || null;
        } else {
          target = this.player;
        }
      }

      await this.runEffects(cfg.effects, {
        source: owner,
        target: target,
        card: info.card || null,
        x: 0,
        stacks: stacks,
        kind: 'trigger',
        targetKind: 'enemy',
        owner: owner,
        force: !!info.force
      });
    }

    // Fires a trigger. info: {card, cardType, target, fromAttack, force}
    async fire(name, subject, info) {
      info = info || {};
      const list = this._listeners(name, subject || null);
      for (let i = 0; i < list.length; i++) {
        if (this._ended && !info.force) break;
        const L = list[i];
        if (!this._listenerActive(L)) continue;
        try {
          await this._runListener(L, name, info);
        } catch (err) {
          console.error('[DS.Combat] trigger "' + name + '" failed', err);
        }
      }
    }

    // =========================================================================
    // Enemy intents
    // =========================================================================

    _moveHasDamage(move) {
      return !!move && Array.isArray(move.effects) && move.effects.some(function (e) { return e && e.op === 'damage'; });
    }

    _intentNumbers(e, move) {
      if (!Array.isArray(move.effects)) return { damage: null, times: 0 };
      const dmgEff = move.effects.find(function (x) { return x && x.op === 'damage'; });
      if (!dmgEff) return { damage: null, times: 0 };
      const ctx = this._mkCtx({ source: e, target: this.player, kind: 'move', targetKind: 'enemy' });
      const base = this.val(dmgEff.amount, ctx, 0);
      const times = Math.max(0, Math.floor(this.val(dmgEff.times, ctx, 1)));
      let dmg = this.calcDamage(base, e, this.player, ctx);
      if (hasStatus(this.player, 'intangible') && dmg > 1) dmg = 1;
      return { damage: dmg, times: times };
    }

    _refreshIntents() {
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.dead || !e.intent || !e.intent.moveId) continue;
        const move = e.def.moves ? e.def.moves[e.intent.moveId] : null;
        if (!move) continue;
        const n = this._intentNumbers(e, move);
        e.intent.damage = n.damage;
        e.intent.times = n.times;
      }
    }

    _patternPick(e, pattern, ctx) {
      const moves = e.def.moves || {};
      if (pattern.type === 'sequence') {
        const list = Array.isArray(pattern.moves) ? pattern.moves : [];
        if (!list.length) return null;
        let i = e.seqIndex;
        if (i >= list.length) i = pattern.loop ? i % list.length : list.length - 1;
        e.seqIndex += 1;
        return list[i];
      }
      if (pattern.type === 'random') {
        if (ctx.turn === 1 && pattern.first && moves[pattern.first]) return pattern.first;
        let entries = Object.keys(pattern.weights || {})
          .filter(function (id) { return moves[id] && pattern.weights[id] > 0; })
          .map(function (id) { return [id, pattern.weights[id]]; });
        if (typeof pattern.noRepeat === 'number' && pattern.noRepeat > 0 && ctx.lastMoves.length >= pattern.noRepeat) {
          const tail = ctx.lastMoves.slice(-pattern.noRepeat);
          const repeated = tail.every(function (m) { return m === tail[0]; }) ? tail[0] : null;
          if (repeated) {
            const filtered = entries.filter(function (en) { return en[0] !== repeated; });
            if (filtered.length) entries = filtered;
          }
        }
        if (!entries.length) return null;
        const total = entries.reduce(function (s, en) { return s + en[1]; }, 0);
        let r = DS.rng.next() * total;
        for (let i = 0; i < entries.length; i++) {
          r -= entries[i][1];
          if (r < 0) return entries[i][0];
        }
        return entries[entries.length - 1][0];
      }
      return null;
    }

    _chooseIntent(e) {
      const def = e.def;
      e.turnNum += 1;
      const moves = def.moves || {};
      const ctx = { turn: e.turnNum, self: e, combat: this, lastMoves: e.lastMoves.slice(), rng: DS.rng };
      let moveId = null;
      if (typeof def.ai === 'function') {
        try {
          moveId = def.ai(ctx);
        } catch (err) {
          warn('enemy ai for "' + def.id + '" threw', err);
          moveId = null;
        }
      } else if (def.pattern) {
        moveId = this._patternPick(e, def.pattern, ctx);
      }
      if (moveId && !moves[moveId]) {
        warn('enemy "' + def.id + '" chose unknown move "' + moveId + '"');
        moveId = null;
      }
      if (!moveId) {
        const keys = Object.keys(moves);
        moveId = keys.length ? keys[0] : null;
      }
      e.lastMoves.push(moveId);
      if (e.lastMoves.length > 8) e.lastMoves.shift();
      e.intent = this._buildIntent(e, moveId);
    }

    _buildIntent(e, moveId) {
      if (!moveId) return { moveId: null, name: '', type: 'unknown', damage: null, times: 0 };
      const move = e.def.moves[moveId];
      const n = this._intentNumbers(e, move);
      return {
        moveId: moveId,
        name: move.name || moveId,
        type: move.intent || 'unknown',
        damage: n.damage,
        times: n.times
      };
    }

    async _performIntent(e) {
      const it = e.intent;
      if (!it || !it.moveId) return;
      const move = e.def.moves ? e.def.moves[it.moveId] : null;
      if (!move) {
        warn('enemy "' + e.def.id + '" has no move "' + it.moveId + '"');
        return;
      }
      DS.events.emit('combat:enemyMove', { enemy: e, move: move });
      const attacks = this._moveHasDamage(move);
      const doubled = attacks && this._takeStackIf(e, 'double_tap');
      const plays = doubled ? 2 : 1;
      for (let p = 0; p < plays; p++) {
        if (this._ended) break;
        await this.runEffects(move.effects, {
          source: e, target: this.player, kind: 'move', targetKind: 'enemy'
        });
      }
      if (attacks && e.statuses.vigor !== undefined) {
        delete e.statuses.vigor;
        DS.events.emit('combat:status', { target: e, status: 'vigor', amount: 0 });
      }
      this._update();
    }

    // Consumes one stack of a status if present; true if it was present.
    _takeStackIf(unit, id) {
      if (!hasStatus(unit, id)) return false;
      this._takeStack(unit, id, 1);
      return true;
    }

    // =========================================================================
    // Turn flow
    // =========================================================================

    async start() {
      if (this._started) return;
      this._started = true;
      this.busy = true;
      try {
        await this._setup();
      } catch (err) {
        console.error('[DS.Combat] start failed', err);
      } finally {
        this.busy = false;
        this._update();
      }
    }

    async _setup() {
      // draw pile from the run deck
      const deck = this.run && Array.isArray(this.run.deck) ? this.run.deck : [];
      for (let i = 0; i < deck.length; i++) {
        const c = this.makeCard(deck[i]);
        if (c) this.drawPile.push(c);
      }
      DS.rng.shuffle(this.drawPile);

      // innate cards go straight to the opening hand
      const drawCopy = this.drawPile.slice();
      for (let i = 0; i < drawCopy.length; i++) {
        const c = drawCopy[i];
        if (c.data.innate && this.hand.length < HAND_LIMIT) {
          this._detach(c);
          this.hand.push(c);
          this._innateCount += 1;
        }
      }

      if (this.encounter) {
        const ids = Array.isArray(this.encounter.enemies) ? this.encounter.enemies : [];
        for (let i = 0; i < ids.length; i++) {
          if (this.livingEnemies().length >= MAX_ENEMIES) break;
          await this.spawnEnemy(ids[i]);
        }
      }

      DS.events.emit('combat:start', { combat: this });
      this._update();

      if (this.livingEnemies().length === 0) {
        await this._endCombat('won');
        return;
      }

      await this.fire('onCombatStart', null, {});
      if (await this._checkEnd()) return;
      await this._beginPlayerTurn(true);
      this._update();
    }

    async _beginPlayerTurn(first) {
      this.phase = 'player';
      this.turn += 1;
      if (this.run && this.run.stats) this.run.stats.turns = (this.run.stats.turns || 0) + 1;
      const p = this.player;
      if (!hasStatus(p, 'barricade')) p.block = 0;
      this.cardsPlayedThisTurn = 0;
      this.attacksPlayedThisTurn = 0;
      const energy = BASE_ENERGY + this.relicPassive('energy');
      p.maxEnergy = energy;
      p.energy = energy;
      const drawCount = Math.max(0, BASE_DRAW + this.relicPassive('draw') - (first ? this._innateCount : 0));
      this._update();
      DS.events.emit('combat:turnStart', { side: 'player', turn: this.turn });
      await this.draw(drawCount);
      await this.fire('onTurnStart', p, {});
      this._decay(p, 'turn_start');
      this._update();
    }

    async _endOfPlayerHand() {
      const snapshot = this.hand.slice();
      for (let i = 0; i < snapshot.length && !this._ended; i++) {
        const card = snapshot[i];
        if (this.hand.indexOf(card) < 0) continue;
        if (card.data.onEndTurnInHand && card.data.onEndTurnInHand.length) {
          await this.runEffects(card.data.onEndTurnInHand, { source: this.player, card: card, kind: 'card', targetKind: 'none' });
        }
      }
      const ethereal = this.hand.filter(function (c) { return c.data.ethereal; });
      for (let i = 0; i < ethereal.length && !this._ended; i++) {
        if (this.hand.indexOf(ethereal[i]) >= 0) await this.exhaustCard(ethereal[i]);
      }
      const rest = this.hand.slice();
      for (let i = 0; i < rest.length && !this._ended; i++) {
        const card = rest[i];
        if (this.hand.indexOf(card) < 0) continue;
        if (card.data.retain) continue;
        await this._discardCard(card, { byEffect: false });
      }
    }

    async _runEnemyTurn() {
      this.phase = 'enemy';
      DS.events.emit('combat:turnStart', { side: 'enemy', turn: this.turn });
      this._update();
      const order = this.livingEnemies();
      for (let i = 0; i < order.length; i++) {
        if (this._ended) break;
        const e = order[i];
        if (e.dead) continue;
        await DS.hooks.delay(ENEMY_DELAY_MS);
        if (this._ended) break;
        if (e.dead || e.hp <= 0) continue;
        if (!hasStatus(e, 'barricade')) e.block = 0;
        this._update();
        await this.fire('onTurnStart', e, {});
        this._decay(e, 'turn_start');
        if (e.dead || this._ended) continue;
        await this._performIntent(e);
        if (this._ended) break;
        await this.fire('onTurnEnd', e, {});
        this._decay(e, 'turn_end');
        this._update();
      }
      if (this._ended) return;
      const living = this.livingEnemies();
      for (let i = 0; i < living.length; i++) this._chooseIntent(living[i]);
      this._update();
    }

    async endTurn() {
      if (!this._started || this._ended) return { ok: false, reason: 'Combat is over' };
      if (this.busy) return { ok: false, reason: 'Busy' };
      if (this.phase !== 'player') return { ok: false, reason: 'Not your turn' };
      this.busy = true;
      try {
        this.phase = 'enemy';
        this._update();
        await this.fire('onTurnEnd', this.player, {});
        if (!this._ended) await this._endOfPlayerHand();
        if (!this._ended) this._decay(this.player, 'turn_end');
        this._update();
        if (await this._checkEnd()) return { ok: true };
        await this._runEnemyTurn();
        if (await this._checkEnd()) return { ok: true };
        await this._beginPlayerTurn(false);
        await this._checkEnd();
      } catch (err) {
        console.error('[DS.Combat] endTurn failed', err);
      } finally {
        this.busy = false;
        this._update();
      }
      return { ok: true };
    }

    // =========================================================================
    // Playing cards and potions
    // =========================================================================

    _blocker(card) {
      if (this._ended) return 'Combat is over';
      if (!this._started) return 'Combat not started';
      if (this.busy) return 'Busy';
      if (this.phase !== 'player') return 'Not your turn';
      if (!card) return 'No card';
      if (this.hand.indexOf(card) < 0) return 'Not in hand';
      const data = card.data || {};
      if (card.cost === -1) return 'Cannot be played';
      if (hasStatus(this.player, 'entangle') && data.type === 'attack') return 'Entangled: cannot play Attacks';
      if (typeof card.cost === 'number' && card.cost > (this.player.energy || 0)) return 'Not enough energy';
      if (data.playableIf !== undefined) {
        const ctx = this._mkCtx({ source: this.player, card: card, kind: 'card', targetKind: 'none' });
        if (!this.cond(data.playableIf, ctx)) return 'Cannot be played right now';
      }
      return null;
    }

    canPlay(card) {
      const reason = this._blocker(card);
      return reason ? { ok: false, reason: reason } : { ok: true, reason: '' };
    }

    // Stops an unfinished fight without resolving it (the player left the combat screen). Pending
    // awaits see `_ended` and unwind without doing more work. Emits nothing, so no UI reacts.
    abandon() {
      if (this._ended) return;
      this._ended = true;
      this.phase = 'lost';
      this._syncRun();
    }

    async playCard(card, target) {
      if (typeof card === 'string') card = this.hand.find(function (c) { return c.uid === card; }) || null;
      const check = this.canPlay(card);
      if (!check.ok) return check;
      const data = card.data;
      let chosen = null;
      if (data.target === 'enemy') {
        const t = this._resolveUnit(target);
        if (!t || t.isPlayer || !this._isLive(t)) return { ok: false, reason: 'Choose a target' };
        chosen = t;
      }

      this.busy = true;
      try {
        const isX = card.cost === 'X';
        const x = isX ? (this.player.energy || 0) : 0;
        if (isX) this.player.energy = 0;
        else this.player.energy -= card.cost;
        this._detach(card);

        this.cardsPlayedThisTurn += 1;
        const isAttack = data.type === 'attack';
        if (isAttack) this.attacksPlayedThisTurn += 1;
        this._stat('cardsPlayed', 1);
        DS.events.emit('combat:cardPlayed', { card: card, target: chosen });
        this._update();

        const doubled = isAttack && this._takeStackIf(this.player, 'double_tap');
        const plays = doubled ? 2 : 1;
        for (let p = 0; p < plays && !this._ended; p++) {
          if (data.effects && data.effects.length) {
            await this.runEffects(data.effects, {
              source: this.player, target: chosen, card: card, x: x, kind: 'card', targetKind: data.target
            });
          }
        }
        // "whenever you play a card" listeners fire once per card, even when the effect is doubled
        if (!this._ended) {
          await this.fire('onCardPlayed', null, { card: card, target: chosen, cardType: data.type });
        }

        if (isAttack && this.player.statuses.vigor !== undefined) {
          delete this.player.statuses.vigor;
          DS.events.emit('combat:status', { target: this.player, status: 'vigor', amount: 0 });
        }

        if (data.type === 'power') {
          // powers are removed from play once used
        } else if (data.exhaust) {
          await this.exhaustCard(card);
        } else {
          this.discardPile.push(card);
        }
        this._update();
        await this._checkEnd();
      } catch (err) {
        console.error('[DS.Combat] playCard failed', err);
      } finally {
        this.busy = false;
        this._update();
      }
      return { ok: true, reason: '' };
    }

    async usePotion(slot, target) {
      const run = this.run;
      const id = run && Array.isArray(run.potions) ? run.potions[slot] : null;
      if (!id) return { ok: false, reason: 'No potion in that slot' };
      if (!this._started || this._ended) return { ok: false, reason: 'Combat is over' };
      if (this.busy) return { ok: false, reason: 'Busy' };
      if (this.phase !== 'player') return { ok: false, reason: 'Not your turn' };
      const def = DS.potions[id];
      if (!def) {
        warn('usePotion: unknown potion "' + id + '"');
        run.potions[slot] = null;
        this._update();
        return { ok: false, reason: 'Unknown potion' };
      }
      let chosen = null;
      if (def.target === 'enemy') {
        const t = this._resolveUnit(target);
        if (!t || t.isPlayer || !this._isLive(t)) return { ok: false, reason: 'Choose a target' };
        chosen = t;
      }

      this.busy = true;
      try {
        run.potions[slot] = null;
        DS.events.emit('combat:potionUsed', { potion: def, slot: slot });
        await this.fire('onPotionUsed', null, {});
        if (!this._ended) {
          await this.runEffects(def.effects, {
            source: this.player, target: chosen, kind: 'potion', targetKind: def.target || 'none', potion: def
          });
        }
        await this._checkEnd();
      } catch (err) {
        console.error('[DS.Combat] usePotion failed', err);
      } finally {
        this.busy = false;
        this._update();
      }
      return { ok: true, reason: '' };
    }

    // =========================================================================
    // Public accessors
    // =========================================================================

    // Current value of the every-N / once counter for a relic id (combat-scoped).
    counterFor(relicId) {
      let best = 0;
      const prefix = 'player|relic:' + relicId + '|';
      for (const k in this.counters) {
        if (k.indexOf(prefix) === 0 && this.counters[k] > best) best = this.counters[k];
      }
      return best;
    }

  }

  DS.Combat = Combat;
})();
