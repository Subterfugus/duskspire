(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});
  const UI = (DS.ui = DS.ui || {});
  if (!('current' in UI)) UI.current = null;

  const HAS_DOM = typeof document !== 'undefined';

  // ------------------------------------------------------------------ helpers
  function audio(name) {
    try {
      if (DS.audio && typeof DS.audio.play === 'function') DS.audio.play(name);
    } catch (e) {
      /* audio is optional */
    }
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function joinClass(c) {
    if (Array.isArray(c)) return c.filter(Boolean).join(' ');
    return c ? String(c) : '';
  }

  function capitalize(s) {
    s = String(s || '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function overlayEl() {
    return HAS_DOM ? document.getElementById('overlay') : null;
  }

  function appEl() {
    return HAS_DOM ? document.getElementById('app') : null;
  }

  let inited = false;
  // Installs document-level listeners (keyword glossary tooltips, button sounds,
  // Escape to close modals). Lazy so that loading this file never touches the DOM.
  function ensureInit() {
    if (inited || !HAS_DOM) return;
    inited = true;
    document.addEventListener('mouseover', onKeywordOver, true);
    document.addEventListener('mouseout', onKeywordOut, true);
    document.addEventListener('click', onGlobalClick, true);
    document.addEventListener('keydown', onGlobalKey, false);
  }

  function appendChildren(parent, c) {
    if (c === undefined || c === null || c === false || c === true) return;
    if (Array.isArray(c)) {
      for (const x of c) appendChildren(parent, x);
      return;
    }
    if (typeof c === 'object' && c.nodeType) {
      parent.appendChild(c);
      return;
    }
    parent.appendChild(document.createTextNode(String(c)));
  }

  // ------------------------------------------------------------------ DOM builder
  // el(tag, {class, text, html, onclick, style, dataset, ...}, children)
  function el(tag, attrs, children) {
    if (!HAS_DOM) return null;
    ensureInit();
    const node = document.createElement(tag);
    if (attrs) {
      for (const key of Object.keys(attrs)) {
        const v = attrs[key];
        if (v === undefined || v === null || v === false) continue;
        if (key === 'class' || key === 'className') {
          node.className = joinClass(v);
        } else if (key === 'text') {
          node.textContent = String(v);
        } else if (key === 'html') {
          node.innerHTML = String(v);
        } else if (key === 'style') {
          if (typeof v === 'string') {
            node.style.cssText = v;
          } else {
            for (const sk of Object.keys(v)) {
              if (sk.indexOf('--') === 0) node.style.setProperty(sk, String(v[sk]));
              else node.style[sk] = v[sk];
            }
          }
        } else if (key === 'dataset') {
          for (const dk of Object.keys(v)) node.dataset[dk] = String(v[dk]);
        } else if (key.indexOf('on') === 0 && typeof v === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), v);
        } else if (key === 'disabled' || key === 'checked' || key === 'value' || key === 'hidden' || key === 'selected') {
          node[key] = v;
        } else {
          node.setAttribute(key, v === true ? '' : String(v));
        }
      }
    }
    if (children !== undefined) appendChildren(node, children);
    return node;
  }

  // ------------------------------------------------------------------ keywords and glossary
  const STATIC_KEYWORDS = [
    ['Block', 'Absorbs damage. Damage removes Block before it removes HP. Block is lost at the start of your turn unless you have Barricade.'],
    ['Energy', 'Spent to play cards. Refills at the start of each of your turns.'],
    ['Draw', 'Move cards from your draw pile into your hand.'],
    ['Discard', 'Move cards from your hand to your discard pile.'],
    ['Exhaust', 'Removed from the battle after it is played, for the rest of this combat.'],
    ['Ethereal', 'If this card is still in your hand at the end of your turn, it is Exhausted.'],
    ['Innate', 'Always starts the battle in your opening hand.'],
    ['Retain', 'Stays in your hand at the end of your turn instead of being discarded.'],
    ['Unplayable', 'This card cannot be played.'],
    ['Shuffle', 'Your discard pile is shuffled back into your draw pile.'],
    ['Heal', 'Restore HP, up to your maximum.'],
    ['Max HP', 'Your maximum hit points.'],
    ['Gold', 'The currency spent in shops and gained from battles and events.'],
    // fallbacks for built-in statuses; DS.statuses entries with the same name replace these
    ['Strength', 'Each stack adds 1 damage to your attacks.'],
    ['Dexterity', 'Each stack adds 1 Block to cards that grant Block.'],
    ['Weak', 'Deals 25% less attack damage. Decreases each turn.'],
    ['Vulnerable', 'Takes 50% more attack damage. Decreases each turn.'],
    ['Frail', 'Gains 25% less Block from cards. Decreases each turn.'],
    ['Poison', 'At the start of its turn, loses HP equal to its Poison, then Poison drops by 1.'],
    ['Intangible', 'All damage and HP loss is reduced to 1.'],
    ['Barricade', 'Block is not removed at the start of your turn.'],
    ['Artifact', 'Negates the next debuff applied to you.'],
    ['Thorns', 'Deals damage back to any unit that attacks you.']
  ];

  let kwTable = null;
  let kwSig = -1;

  // Builds (and caches) the keyword lookup: static keywords plus every DS.statuses name.
  function keywordTable() {
    const statuses = DS.statuses || {};
    const ids = Object.keys(statuses);
    if (kwTable && kwSig === ids.length) return kwTable;
    const map = {};
    for (const pair of STATIC_KEYWORDS) map[pair[0].toLowerCase()] = { name: pair[0], desc: pair[1] };
    for (const id of ids) {
      const s = statuses[id];
      if (!s || !s.name) continue;
      map[String(s.name).toLowerCase()] = {
        name: String(s.name),
        desc: String(s.desc || '').split('{n}').join('X')
      };
    }
    const names = Object.keys(map)
      .map((k) => map[k].name)
      .sort((a, b) => b.length - a.length);
    const re = new RegExp('\\b(' + names.map(escapeRe).join('|') + ')\\b|(\\d+)', 'gi');
    kwTable = { map, re };
    kwSig = ids.length;
    return kwTable;
  }

  // Turns card/status text into safe HTML: keywords wrapped in .ds-kw, numbers in .ds-num, newlines to <br>.
  function describe(text) {
    if (text === undefined || text === null) return '';
    const s = String(text);
    const table = keywordTable();
    const re = table.re;
    re.lastIndex = 0;
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(s)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      out += esc(s.slice(last, m.index));
      if (m[1] !== undefined) {
        out += '<span class="ds-kw" data-kw="' + esc(m[1].toLowerCase()) + '">' + esc(m[1]) + '</span>';
      } else {
        out += '<b class="ds-num">' + esc(m[2]) + '</b>';
      }
      last = m.index + m[0].length;
    }
    out += esc(s.slice(last));
    return out.replace(/\n/g, '<br>');
  }

  function tipTitle(name) {
    return '<div class="ds-tip-title">' + esc(name) + '</div>';
  }

  // ------------------------------------------------------------------ tooltip
  let tipEl = null;

  function getTip() {
    const ov = overlayEl();
    if (!ov) return null;
    if (!tipEl) tipEl = el('div', { class: 'ds-tooltip', hidden: true });
    if (!ov.contains(tipEl)) ov.appendChild(tipEl);
    return tipEl;
  }

  function positionTip(t, x, y) {
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;
    const gap = 16;
    t.style.left = '0px';
    t.style.top = '0px';
    const w = t.offsetWidth;
    const h = t.offsetHeight;
    let left = x + gap;
    let top = y + gap;
    if (left + w > vw - 8) left = x - w - gap;
    if (top + h > vh - 8) top = y - h - gap;
    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, Math.min(top, vh - h - 8));
    t.style.left = left + 'px';
    t.style.top = top + 'px';
  }

  function showTip(html, x, y) {
    const t = getTip();
    if (!t) return;
    t.innerHTML = html;
    t.hidden = false;
    positionTip(t, x, y);
  }

  function hideTip() {
    if (tipEl) tipEl.hidden = true;
  }

  function resolveTip(target) {
    try {
      const v = target.__dsTip;
      const c = typeof v === 'function' ? v() : v;
      return c ? String(c) : '';
    } catch (e) {
      console.error('[DS.ui] tooltip content failed:', e);
      return '';
    }
  }

  // tooltip(el, htmlOrFn): follows the mouse, stays on screen, rendered in #overlay.
  function tooltip(target, htmlOrFn) {
    if (!target || !HAS_DOM) return;
    ensureInit();
    target.__dsTip = htmlOrFn;
    if (target.__dsTipBound) return;
    target.__dsTipBound = true;
    target.addEventListener('mouseenter', (ev) => {
      const c = resolveTip(target);
      if (c) showTip(c, ev.clientX, ev.clientY);
    });
    target.addEventListener('mousemove', (ev) => {
      if (tipEl && !tipEl.hidden) positionTip(tipEl, ev.clientX, ev.clientY);
    });
    target.addEventListener('mouseleave', hideTip);
  }

  function closestKw(node) {
    if (!node || typeof node.closest !== 'function') return null;
    return node.closest('.ds-kw');
  }

  function onKeywordOver(ev) {
    const kw = closestKw(ev.target);
    if (!kw) return;
    const entry = keywordTable().map[kw.getAttribute('data-kw') || ''];
    if (!entry) return;
    showTip(tipTitle(entry.name) + '<div class="ds-tip-body">' + esc(entry.desc) + '</div>', ev.clientX, ev.clientY);
  }

  function onKeywordOut(ev) {
    const kw = closestKw(ev.target);
    if (!kw) return;
    if (ev.relatedTarget && kw.contains(ev.relatedTarget)) return;
    hideTip();
  }

  function onGlobalClick(ev) {
    const t = ev.target;
    if (t && typeof t.closest === 'function' && t.closest('.ds-btn')) audio('click');
  }

  // ------------------------------------------------------------------ cards
  const TYPE_LABEL = { attack: 'Attack', skill: 'Skill', power: 'Power', curse: 'Curse', status: 'Status' };
  const TYPE_ORDER = { attack: 0, skill: 1, power: 2, status: 3, curse: 4 };
  const RARITY_ORDER = { starter: 0, common: 1, uncommon: 2, rare: 3, special: 4 };

  function classColor(cls) {
    const ch = cls && DS.characters ? DS.characters[cls] : null;
    return ch && ch.color ? String(ch.color) : null;
  }

  // Cost text for the orb: null = show nothing (cost -1), 'X' shows X, numbers as-is.
  function costText(cost) {
    if (cost === -1 || cost === undefined || cost === null) return null;
    return String(cost);
  }

  // renderCard(cardData, {cost, small, onclick, disabled, selected, draw})
  //   cardData: resolved card data (DS.getCardData result or combat card .data)
  function renderCard(data, opts) {
    if (!HAS_DOM) return null;
    opts = opts || {};
    data = data || {};
    const type = data.type || 'skill';
    const rarity = data.rarity || 'common';
    const base = data.cost;
    const shown = opts.cost !== undefined ? opts.cost : base;

    const classes = ['ds-card', 'ds-card-' + type, 'ds-rarity-' + rarity];
    if (data.class) classes.push('ds-card-class-' + data.class);
    if (opts.small) classes.push('ds-card-small');
    if (data.upgraded) classes.push('ds-card-upgraded');
    if (opts.disabled) classes.push('ds-card-disabled');
    if (opts.selected) classes.push('ds-card-selected');
    if (opts.onclick && !opts.disabled) classes.push('ds-card-clickable');
    if (opts.draw) classes.push('ds-draw');

    const style = {};
    const col = classColor(data.class);
    if (col) style['--class-color'] = col;

    const card = el('div', {
      class: classes,
      style: style,
      dataset: data.id ? { cardId: String(data.id) } : undefined,
      onclick: !opts.disabled && typeof opts.onclick === 'function' ? opts.onclick : undefined
    });

    const ct = costText(shown);
    const costClasses = ['ds-card-cost'];
    if (ct === null) {
      costClasses.push('ds-card-cost-none');
    } else if (typeof shown === 'number' && typeof base === 'number') {
      if (shown < base) costClasses.push('ds-card-cost-reduced');
      else if (shown > base) costClasses.push('ds-card-cost-up');
    }

    const costEl = el('div', { class: costClasses, text: ct === null ? '' : ct });
    const artEl = el('div', { class: 'ds-card-art', text: data.icon || '❓' });
    const nameEl = el('div', { class: 'ds-card-name', text: data.name || data.id || '' });
    const typeEl = el('div', { class: 'ds-card-type', text: TYPE_LABEL[type] || capitalize(type) });
    const descEl = el('div', { class: 'ds-card-desc', html: describe(data.desc || '') });
    appendChildren(card, [costEl, artEl, nameEl, typeEl, descEl]);
    return card;
  }

  // ------------------------------------------------------------------ status chips
  // statusChips(unit): icon + stack count per status with a tooltip (name + desc with {n} replaced).
  function statusChips(unit) {
    const wrap = el('div', { class: 'ds-statuses' });
    if (!HAS_DOM) return wrap;
    const statuses = (unit && unit.statuses) || {};
    const defs = DS.statuses || {};
    for (const id of Object.keys(statuses)) {
      const n = statuses[id];
      if (!n) continue;
      const def = defs[id] || { name: id, icon: '•', desc: '', type: 'buff' };
      const numeric = typeof n === 'number';
      const showNum = numeric && def.stacks !== false;
      const debuff = def.type === 'debuff' || (numeric && n < 0);
      const chip = el('div', {
        class: ['ds-status-chip', debuff ? 'ds-status-debuff' : 'ds-status-buff', 'ds-status-id-' + id]
      });
      appendChildren(chip, el('span', { class: 'ds-status-icon', text: def.icon || '•' }));
      if (showNum) appendChildren(chip, el('span', { class: 'ds-status-stacks', text: String(n) }));
      const text = String(def.desc || '').split('{n}').join(numeric ? String(n) : '');
      tooltip(chip, tipTitle(def.name || id) + (text ? '<div class="ds-tip-body">' + describe(text) + '</div>' : ''));
      appendChildren(wrap, chip);
    }
    return wrap;
  }

  // ------------------------------------------------------------------ screens and router
  const screens = {};
  let navToken = 0;

  function registerScreen(name, def) {
    if (!name || !def) return;
    screens[name] = def;
  }

  // go(name, params): exit the current screen, clear #app, enter the new one inside a fresh root.
  async function go(name, params) {
    if (!HAS_DOM) return;
    ensureInit();
    const token = ++navToken;
    closeAllModals();
    hideTip();
    const prevName = UI.current;
    const prev = prevName ? screens[prevName] : null;
    if (prev && typeof prev.exit === 'function') {
      try {
        await prev.exit();
      } catch (e) {
        console.error('[DS.ui] exit of screen "' + prevName + '" failed:', e);
      }
      if (token !== navToken) return;
    }
    const root = appEl();
    if (!root) return;
    root.innerHTML = '';
    const def = screens[name];
    if (!def || typeof def.enter !== 'function') {
      console.warn('[DS.ui] unknown screen: ' + name);
      UI.current = null;
      return;
    }
    UI.current = name;
    const screen = el('div', { class: ['ds-screen', 'ds-screen-' + name, 'ds-fade-in'] });
    root.appendChild(screen);
    try {
      await def.enter(params || {}, screen);
    } catch (e) {
      console.error('[DS.ui] screen "' + name + '" failed:', e);
      appendChildren(screen, el('div', { class: 'ds-panel ds-error', text: 'Error: ' + (e && e.message ? e.message : String(e)) }));
    }
  }

  // ------------------------------------------------------------------ modals
  const modalStack = [];

  function closeEntry(entry) {
    if (!entry || entry.closed) return;
    entry.closed = true;
    const i = modalStack.indexOf(entry);
    if (i >= 0) modalStack.splice(i, 1);
    if (entry.backdrop.parentNode) entry.backdrop.parentNode.removeChild(entry.backdrop);
    if (typeof entry.onClose === 'function') {
      try {
        entry.onClose();
      } catch (e) {
        console.error('[DS.ui] modal onClose failed:', e);
      }
    }
  }

  function closeAllModals() {
    while (modalStack.length) closeEntry(modalStack[modalStack.length - 1]);
  }

  function onGlobalKey(ev) {
    if (ev.key !== 'Escape' || !modalStack.length) return;
    const top = modalStack[modalStack.length - 1];
    if (top.dismissable) closeEntry(top);
  }

  // Shared modal builder. Buttons close the modal after their onclick unless it returns false.
  function openOverlayModal(opts) {
    opts = opts || {};
    ensureInit();
    const ov = overlayEl();
    if (!ov) {
      return { el: null, body: null, buttonEls: [], setSubtitle() {}, close() {} };
    }
    hideTip();
    const dismissable = opts.dismissable !== false;
    const backdrop = el('div', { class: 'ds-modal-backdrop' });
    const modal = el('div', { class: ['ds-modal', opts.wide ? 'ds-modal-wide' : '', opts.className || ''] });
    const entry = { backdrop, dismissable, onClose: opts.onClose, closed: false };
    const buttonEls = [];
    const subEl = el('div', { class: 'ds-modal-sub', text: opts.subtitle || '' });
    const body = el('div', { class: 'ds-modal-body' });
    if (typeof opts.content === 'string') body.innerHTML = opts.content;
    else appendChildren(body, opts.content);

    const parts = [];
    if (opts.title) parts.push(el('div', { class: 'ds-modal-title', text: opts.title }));
    parts.push(subEl, body);

    if (opts.buttons && opts.buttons.length) {
      const footer = el('div', { class: 'ds-modal-buttons' });
      for (const b of opts.buttons) {
        const be = el('button', {
          class: ['ds-btn', b.primary ? 'ds-btn-primary' : '', b.danger ? 'ds-btn-danger' : ''],
          text: b.label || 'OK',
          disabled: !!b.disabled,
          onclick: (ev) => {
            const r = typeof b.onclick === 'function' ? b.onclick(ev) : undefined;
            if (r !== false) closeEntry(entry);
          }
        });
        buttonEls.push(be);
        appendChildren(footer, be);
      }
      parts.push(footer);
    }

    appendChildren(modal, parts);
    appendChildren(backdrop, modal);
    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop && entry.dismissable) closeEntry(entry);
    });
    appendChildren(ov, backdrop);
    modalStack.push(entry);

    const handle = {
      el: modal,
      body,
      buttonEls,
      setSubtitle(t) {
        subEl.textContent = t === undefined || t === null ? '' : String(t);
      },
      close() {
        closeEntry(entry);
      }
    };
    entry.handle = handle;
    return handle;
  }

  // modal({title, content, buttons: [{label, onclick, primary, danger, disabled}], dismissable, wide, onClose}) -> {close()}
  function modal(opts) {
    return openOverlayModal(opts);
  }

  // cardPicker({cards: [{data, ref}], count, prompt, optional}) -> Promise<ref[]>
  // Click to select up to `count` cards (exactly `count` unless optional, or fewer if fewer are available).
  function cardPicker(opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const cards = Array.isArray(opts.cards) ? opts.cards : [];
      const want = opts.count === undefined || opts.count === null ? 1 : Math.max(0, Math.floor(Number(opts.count) || 0));
      const max = Math.min(want, cards.length);
      const optional = !!opts.optional;
      if (max === 0 || !overlayEl()) {
        resolve([]);
        return;
      }

      const picked = new Set();
      let done = false;
      let handle = null;
      const settle = (refs) => {
        if (done) return;
        done = true;
        resolve(refs);
      };
      const fallback = () => (optional ? [] : cards.slice(0, max).map((c) => c.ref));
      const canConfirm = () => optional || picked.size === max;

      const small = cards.length > 10;
      const tiles = [];
      const grid = el('div', { class: ['ds-grid', 'ds-picker-grid', small ? 'ds-grid-small' : ''] });

      const sync = () => {
        tiles.forEach((t, i) => t.classList.toggle('ds-card-selected', picked.has(i)));
        if (!handle) return;
        handle.setSubtitle('Selected ' + picked.size + ' of ' + max + (optional ? ' (optional)' : ''));
        const btn = handle.buttonEls[0];
        if (btn) {
          btn.disabled = !canConfirm();
          btn.textContent = optional && picked.size === 0 ? 'Skip' : 'Confirm';
        }
      };

      const toggle = (i) => {
        if (done) return;
        if (picked.has(i)) {
          picked.delete(i);
          audio('select');
        } else {
          if (picked.size >= max) {
            if (max === 1) {
              picked.clear();
            } else {
              const t = tiles[i];
              if (t) {
                t.classList.remove('ds-shake');
                void t.offsetWidth;
                t.classList.add('ds-shake');
              }
              return;
            }
          }
          picked.add(i);
          audio('select');
        }
        sync();
      };

      cards.forEach((c, i) => {
        const t = renderCard(c && c.data ? c.data : {}, { small, onclick: () => toggle(i) });
        tiles.push(t);
        appendChildren(grid, t);
      });

      handle = openOverlayModal({
        title: opts.prompt || 'Choose cards',
        content: grid,
        wide: true,
        className: 'ds-picker',
        dismissable: optional,
        buttons: [
          {
            label: 'Confirm',
            primary: true,
            disabled: !optional,
            onclick: () => {
              if (!canConfirm()) return false;
              const refs = Array.from(picked)
                .sort((a, b) => a - b)
                .map((i) => cards[i].ref);
              settle(refs);
              return undefined;
            }
          }
        ],
        onClose: () => settle(fallback())
      });
      sync();
    });
  }

  function resolveCardData(inst) {
    if (!inst) return null;
    if (inst.data) return inst.data;
    try {
      if (typeof DS.getCardData === 'function') return DS.getCardData(inst);
      return (DS.cards && DS.cards[inst.id]) || null;
    } catch (e) {
      return null;
    }
  }

  function costSortKey(c) {
    return typeof c === 'number' && c >= 0 ? c : 99;
  }

  function byCardOrder(a, b) {
    const ta = TYPE_ORDER[a.data.type] !== undefined ? TYPE_ORDER[a.data.type] : 9;
    const tb = TYPE_ORDER[b.data.type] !== undefined ? TYPE_ORDER[b.data.type] : 9;
    if (ta !== tb) return ta - tb;
    const ca = costSortKey(a.data.cost);
    const cb = costSortKey(b.data.cost);
    if (ca !== cb) return ca - cb;
    return String(a.data.name || '').localeCompare(String(b.data.name || ''));
  }

  // showDeck(title, instances): modal grid of cards, duplicates grouped with a count badge.
  function showDeck(title, instances) {
    const groups = new Map();
    let total = 0;
    for (const inst of instances || []) {
      const data = resolveCardData(inst);
      if (!data) continue;
      total++;
      const key = (data.id || '?') + (data.upgraded ? '+' : '');
      const g = groups.get(key);
      if (g) g.count++;
      else groups.set(key, { data, count: 1 });
    }
    const list = Array.from(groups.values()).sort(byCardOrder);
    let content;
    if (list.length) {
      const grid = el('div', { class: ['ds-grid', 'ds-grid-small'] });
      for (const g of list) {
        const c = renderCard(g.data, { small: true });
        if (g.count > 1) appendChildren(c, el('div', { class: 'ds-card-count', text: '×' + g.count }));
        appendChildren(grid, c);
      }
      content = grid;
    } else {
      content = el('div', { class: 'ds-empty', text: 'No cards.' });
    }
    return openOverlayModal({
      title: (title || 'Deck') + ' (' + total + ')',
      content,
      wide: true,
      dismissable: true,
      buttons: [{ label: 'Close', primary: true }]
    });
  }

  // ------------------------------------------------------------------ toasts
  let toastStack = null;

  function toast(text) {
    if (!HAS_DOM) return;
    const ov = overlayEl();
    if (!ov) return;
    if (!toastStack || !ov.contains(toastStack)) {
      toastStack = el('div', { class: 'ds-toast-stack' });
      appendChildren(ov, toastStack);
    }
    while (toastStack.children.length >= 4) toastStack.removeChild(toastStack.firstElementChild);
    const t = el('div', { class: 'ds-toast', text: String(text) });
    appendChildren(toastStack, t);
    setTimeout(() => {
      t.classList.add('ds-toast-out');
      setTimeout(() => {
        if (t.parentNode) t.parentNode.removeChild(t);
      }, 350);
    }, 2200);
  }

  // ------------------------------------------------------------------ export
  UI.el = el;
  UI.registerScreen = registerScreen;
  UI.go = go;
  UI.renderCard = renderCard;
  UI.tooltip = tooltip;
  UI.describe = describe;
  UI.statusChips = statusChips;
  UI.modal = modal;
  UI.cardPicker = cardPicker;
  UI.showDeck = showDeck;
  UI.toast = toast;
  UI.hideTooltip = hideTip;
  UI.closeModals = closeAllModals;
  UI.escape = esc;
})();
