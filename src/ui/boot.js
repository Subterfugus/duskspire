(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // ---------------------------------------------------------------------------
  // Error reporting: log, tell the player, and fall back to the main menu.
  // A re-entrancy guard stops a failing menu transition from looping.
  // ---------------------------------------------------------------------------
  let recovering = false;

  function describeError(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    return err.stack || err.message || String(err);
  }

  function recover(kind, err) {
    try {
      console.error('[Duskspire] ' + kind + ':', err);
    } catch (e) {
      // console may be unavailable; nothing else to do
    }
    if (recovering) return;
    recovering = true;
    try {
      if (DS.ui && typeof DS.ui.toast === 'function') {
        const msg = err && err.message ? err.message : String(err || 'Something went wrong');
        DS.ui.toast('Something went wrong: ' + msg.slice(0, 160));
      }
    } catch (e) {
      // toast is cosmetic; ignore failures
    }
    try {
      if (DS.ui && typeof DS.ui.go === 'function') DS.ui.go('menu');
    } catch (e) {
      console.error('[Duskspire] could not return to the menu:', describeError(e));
    } finally {
      // Release the guard once the current event has finished, so later errors are handled too.
      setTimeout(function () { recovering = false; }, 0);
    }
  }

  window.addEventListener('error', function (event) {
    recover('uncaught error', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', function (event) {
    recover('unhandled rejection', event.reason);
  });

  // ---------------------------------------------------------------------------
  // Hook wiring. The engine defaults are headless; these replace them with UI versions.
  // ---------------------------------------------------------------------------
  // Game speed from settings (1, 2 or 3). Anything unreadable counts as 1x.
  function gameSpeed() {
    try {
      const v = DS.settings && typeof DS.settings.get === 'function' ? Number(DS.settings.get('speed', 1)) : 1;
      return isFinite(v) && v >= 1 ? Math.min(v, 3) : 1;
    } catch (e) {
      return 1;
    }
  }

  function wireHooks() {
    // Pauses shrink with game speed: a 2x game waits half as long.
    DS.hooks.delay = function (ms) {
      const wait = Math.max(0, Number(ms) || 0) / gameSpeed();
      return new Promise(function (resolve) { setTimeout(resolve, wait); });
    };

    // Combat cards carry .data; fall back to resolving the instance so the picker never shows a blank card.
    DS.hooks.chooseCards = async function (opts) {
      const cards = (opts && opts.cards) || [];
      if (cards.length === 0) return [];
      const want = opts && typeof opts.count === 'number' ? Math.floor(opts.count) : 1;
      const count = Math.max(0, Math.min(want, cards.length));
      if (count === 0) return [];
      const picked = await DS.ui.cardPicker({
        cards: cards.map(function (card) {
          const data = card.data || (typeof DS.getCardData === 'function' ? DS.getCardData(card) : null);
          return { data: data || {}, ref: card };
        }),
        count: count,
        prompt: opts && opts.prompt,
        optional: !!(opts && opts.optional),
      });
      return Array.isArray(picked) ? picked : [];
    };

    DS.hooks.chooseDeckCard = async function (opts) {
      const run = DS.run;
      if (!run || !Array.isArray(run.deck)) return null;
      const filter = opts && typeof opts.filter === 'function' ? opts.filter : null;
      const insts = run.deck.filter(function (inst) { return !filter || filter(inst); });
      if (insts.length === 0) return null;
      const picked = await DS.ui.cardPicker({
        cards: insts.map(function (inst) { return { data: DS.getCardData(inst), ref: inst }; }),
        count: 1,
        prompt: (opts && opts.prompt) || 'Choose a card',
        optional: true,
      });
      return (Array.isArray(picked) && picked[0]) || null;
    };
  }

  // ---------------------------------------------------------------------------
  // Audio settings: applied on boot and whenever a setting changes.
  // ---------------------------------------------------------------------------
  function applyAudioSetting(key, value) {
    const a = DS.audio;
    if (!a) return;
    try {
      if (key === 'muted' && typeof a.setMuted === 'function') {
        a.setMuted(!!value);
      } else if (key === 'volume' && typeof a.setVolume === 'function') {
        const v = Number(value);
        if (isFinite(v)) a.setVolume(v);
      } else if (key === 'music' && typeof a.setMusic === 'function') {
        if (!!value !== (a.music !== false)) a.setMusic(!!value);
      }
    } catch (err) {
      console.error('[Duskspire] audio setting "' + key + '" failed:', err);
    }
  }

  function applyPersistedSettings() {
    if (!DS.audio || !DS.settings || typeof DS.settings.get !== 'function') return;
    applyAudioSetting('volume', DS.settings.get('volume', DS.audio.volume));
    applyAudioSetting('muted', DS.settings.get('muted', !!DS.audio.muted));
    applyAudioSetting('music', DS.settings.get('music', DS.audio.music !== false));
  }

  // ---------------------------------------------------------------------------
  // Event wiring: achievement toasts, live settings, and fullscreen kept in step with the setting.
  // ---------------------------------------------------------------------------
  function achievementName(id) {
    const list = DS.Meta && Array.isArray(DS.Meta.ACHIEVEMENTS) ? DS.Meta.ACHIEVEMENTS : [];
    for (const a of list) {
      if (a && a.id === id) return a.name || id;
    }
    return id;
  }

  function wireEvents() {
    if (!DS.events || typeof DS.events.on !== 'function') return;
    DS.events.on('meta:achievement', function (p) {
      const id = p && p.id;
      if (!id) return;
      if (DS.ui && typeof DS.ui.toast === 'function') DS.ui.toast('Achievement unlocked: ' + achievementName(id));
    });
    DS.events.on('settings:update', function (p) {
      if (p && p.key) applyAudioSetting(p.key, p.value);
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('fullscreenchange', function () {
        try {
          if (!document.fullscreenElement && DS.settings && DS.settings.get('fullscreen', false)) {
            DS.settings.set('fullscreen', false);
          }
        } catch (e) {
          // settings are optional here
        }
      });
    }
  }

  function start() {
    try {
      wireHooks();
      wireEvents();
      applyPersistedSettings();
      DS.ui.go('menu');
    } catch (err) {
      recover('startup failed', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
