(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  function warn() {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn.apply(console, ['[DS]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // ---------------------------------------------------------------------------
  // Registries
  // ---------------------------------------------------------------------------
  DS.cards = {};
  DS.relics = {};
  DS.potions = {};
  DS.enemies = {};
  DS.encounters = {};
  DS.events_ = {};          // event definitions (DS.events is the event bus)
  DS.statuses = {};
  DS.characters = {};

  function defineInto(table, kind, def) {
    if (!def || typeof def !== 'object' || typeof def.id !== 'string' || !def.id) {
      warn(kind + ': definition is missing an id', def);
      return undefined;
    }
    if (Object.prototype.hasOwnProperty.call(table, def.id)) {
      warn(kind + ': duplicate id "' + def.id + '" ignored');
      return undefined;
    }
    table[def.id] = def;
    return def;
  }

  DS.defineCard = function (def) { return defineInto(DS.cards, 'defineCard', def); };
  DS.defineRelic = function (def) { return defineInto(DS.relics, 'defineRelic', def); };
  DS.definePotion = function (def) { return defineInto(DS.potions, 'definePotion', def); };
  DS.defineEnemy = function (def) { return defineInto(DS.enemies, 'defineEnemy', def); };
  DS.defineEncounter = function (def) { return defineInto(DS.encounters, 'defineEncounter', def); };
  DS.defineEvent = function (def) { return defineInto(DS.events_, 'defineEvent', def); };
  DS.defineStatus = function (def) { return defineInto(DS.statuses, 'defineStatus', def); };
  DS.defineCharacter = function (def) { return defineInto(DS.characters, 'defineCharacter', def); };

  // ---------------------------------------------------------------------------
  // Event bus
  // ---------------------------------------------------------------------------
  const listeners = new Map();

  function reportListenerError(name, err) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[DS.events] listener for "' + name + '" threw', err);
    }
  }

  DS.events = {
    on(name, fn) {
      if (typeof fn !== 'function') return function () {};
      let set = listeners.get(name);
      if (!set) {
        set = [];
        listeners.set(name, set);
      }
      set.push(fn);
      return function unsubscribe() {
        const cur = listeners.get(name);
        if (!cur) return;
        const i = cur.indexOf(fn);
        if (i >= 0) cur.splice(i, 1);
      };
    },
    off(name, fn) {
      const set = listeners.get(name);
      if (!set) return;
      const i = set.indexOf(fn);
      if (i >= 0) set.splice(i, 1);
    },
    emit(name, payload) {
      const set = listeners.get(name);
      if (!set || !set.length) return;
      const copy = set.slice();
      for (let i = 0; i < copy.length; i++) {
        try {
          const r = copy[i](payload);
          if (r && typeof r.then === 'function') {
            r.then(null, function (err) { reportListenerError(name, err); });
          }
        } catch (err) {
          reportListenerError(name, err);
        }
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Hooks (UI overrides these in boot.js; defaults are headless-safe)
  // ---------------------------------------------------------------------------
  DS.hooks = {
    delay: async function (ms) {},
    chooseCards: async function (opts) {
      const o = opts || {};
      const cards = Array.isArray(o.cards) ? o.cards : [];
      return cards.slice(0, typeof o.count === 'number' ? o.count : cards.length);
    },
    chooseDeckCard: async function (opts) {
      const o = opts || {};
      const deck = (DS.run && Array.isArray(DS.run.deck)) ? DS.run.deck : [];
      for (let i = 0; i < deck.length; i++) {
        let ok = true;
        if (typeof o.filter === 'function') {
          try { ok = !!o.filter(deck[i]); } catch (e) { ok = false; }
        }
        if (ok) return deck[i];
      }
      return null;
    }
  };

  // ---------------------------------------------------------------------------
  // RNG (mulberry32), seedable
  // ---------------------------------------------------------------------------
  function makeGen(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFrom(n) {
    if (typeof n === 'number' && isFinite(n)) return (Math.floor(n) >>> 0) || 1;
    // string seed: FNV-1a hash
    const s = String(n == null ? '' : n);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  }

  let gen = makeGen((Math.random() * 0xffffffff) >>> 0);

  DS.rng = {
    seed(n) { gen = makeGen(seedFrom(n)); },
    next() { return gen(); },
    int(min, max) {
      min = Math.ceil(min);
      max = Math.floor(max);
      if (!(max >= min)) return min;
      return min + Math.floor(gen() * (max - min + 1));
    },
    pick(arr) {
      if (!arr || !arr.length) return undefined;
      return arr[Math.floor(gen() * arr.length)];
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(gen() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
      }
      return arr;
    },
    chance(p) { return gen() < p; }
  };

  // ---------------------------------------------------------------------------
  // Ids
  // ---------------------------------------------------------------------------
  let uidCounter = 0;
  DS.uid = function () {
    uidCounter += 1;
    return 'u' + uidCounter.toString(36) + Math.floor(Math.random() * 1679616).toString(36);
  };

  // ---------------------------------------------------------------------------
  // Card data resolution
  // ---------------------------------------------------------------------------
  DS.getCardData = function (inst) {
    const id = inst && inst.id;
    const upgraded = !!(inst && inst.upgraded);
    const def = DS.cards[id];
    if (!def) {
      warn('getCardData: unknown card id "' + id + '"');
      return {
        id: String(id), name: String(id), class: 'colorless', type: 'skill', rarity: 'special',
        cost: 0, target: 'none', icon: '❓', desc: 'Unknown card.', effects: [],
        exhaust: false, ethereal: false, innate: false, retain: false, upgraded: upgraded
      };
    }
    const out = Object.assign({}, def);
    if (upgraded) {
      const up = def.upgrade && typeof def.upgrade === 'object' ? def.upgrade : null;
      if (up) Object.assign(out, up);
      if (!(up && up.name)) out.name = def.name + '+';
    }
    out.id = def.id;
    out.upgraded = upgraded;
    if (!Array.isArray(out.effects)) out.effects = [];
    if (out.cost === undefined) out.cost = 0;
    if (out.target === undefined) out.target = 'none';
    if (out.desc === undefined) out.desc = '';
    return out;
  };

  DS.cardPool = function (filter) {
    const f = filter || {};
    return Object.keys(DS.cards).map(function (k) { return DS.cards[k]; }).filter(function (def) {
      if (f.class !== undefined) {
        if (def.class !== f.class) return false;
      } else if (def.class === 'curse' || def.class === 'status') {
        return false;
      }
      if (f.rarity !== undefined) {
        if (def.rarity !== f.rarity) return false;
      } else if (def.rarity === 'starter' || def.rarity === 'special') {
        return false;
      }
      if (f.type !== undefined && def.type !== f.type) return false;
      return true;
    });
  };

  DS.relicPool = function (filter) {
    const f = filter || {};
    return Object.keys(DS.relics).map(function (k) { return DS.relics[k]; }).filter(function (def) {
      // class-specific relics only for that class (or when no class is requested for class-less relics)
      if (def.class && def.class !== f.class) return false;
      if (f.rarity !== undefined) {
        if (def.rarity !== f.rarity) return false;
      } else if (def.rarity === 'starter') {
        return false;
      }
      return true;
    });
  };

  // ---------------------------------------------------------------------------
  // Vocabularies
  // ---------------------------------------------------------------------------
  DS.OPS = [
    // combat ops
    'damage', 'lose_hp', 'block', 'apply', 'remove_status', 'multiply_status', 'heal', 'draw', 'energy',
    'discard', 'exhaust', 'add_card', 'upgrade_hand', 'gold', 'max_hp', 'repeat', 'if', 'summon', 'custom',
    // run-level ops
    'remove_card', 'upgrade_card', 'transform_card', 'add_relic', 'add_potion', 'chance', 'fight'
  ];

  DS.TRIGGERS = [
    'onCombatStart', 'onCombatEnd', 'onTurnStart', 'onTurnEnd', 'onCardPlayed', 'onAttack', 'onAttacked',
    'onDamaged', 'onBlockGained', 'onBlockBroken', 'onCardDrawn', 'onCardExhausted', 'onCardDiscarded',
    'onShuffle', 'onApplyDebuff', 'onKill', 'onEnemyDeath', 'onDeath', 'onHeal', 'onPotionUsed', 'onGoldGained',
    // relic-only, run level
    'onPickup', 'onRest', 'onRoomEnter', 'onCardAdded', 'onChestOpen', 'onShopEnter'
  ];
})();
