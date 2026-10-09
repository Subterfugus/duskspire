(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // =====================================================================
  // WARDEN expansion (v3). Pure content, no engine changes. Sideways options, not raw power.
  //   THORNS      : payoffs that read your Thorns (Brier Stab, Spine Volley, Thornspear, Thorn Avalanche, Thorn Judgement)
  //   RETALIATION : being hit or losing HP to an attack pays back (Retaliation, Counterbark, Spiny Hide, Barbed Retort)
  //   BLOCK->HARM : Block converted into damage or Thorns at a deliberate rate (Thicket Lunge, Thorn Forge, Bark Crusher,
  //                 Rampart Spike, Bulwark Reckoning)
  //   SIDEWAYS    : Quill Storm (skills hurt everyone), Thorn Tithe (Thorns pay out Block each turn), Sprouting Spines,
  //                 Sacrificial Bark (exhaust for Block)
  // Statuses defined here: Retaliation, Spiny Hide, Quill Storm, Thorn Tithe, Barbed Retort (ids wd_*).
  // =====================================================================

  // =====================================================================
  // Custom statuses (new). Ids are prefixed wd_ and never equal a card id.
  // =====================================================================

  // Engine: onDamaged with fromAttack only fires when HP is actually lost (Block fully absorbing a hit does not count).
  DS.defineStatus({
    id: 'wd_retaliation', name: 'Retaliation', type: 'buff', icon: '🩸', stacks: true, decay: null, expire: null,
    desc: 'Whenever you lose HP from an attack, gain {n} Vigor.',
    triggers: {
      onDamaged: {
        when: { fromAttack: true },
        effects: [{ op: 'apply', status: 'vigor', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  DS.defineStatus({
    id: 'wd_spiny_hide', name: 'Spiny Hide', type: 'buff', icon: '🦔', stacks: true, decay: null, expire: null,
    desc: 'Whenever you are hit by an attack, gain {n} Thorns.',
    triggers: {
      onAttacked: [{ op: 'apply', status: 'thorns', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'wd_quill_storm', name: 'Quill Storm', type: 'buff', icon: '⛈️', stacks: true, decay: null, expire: null,
    desc: 'Whenever you play a Skill, deal {n} damage to ALL enemies.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'damage', amount: { v: 'stacks' }, to: 'all_enemies' }]
      }
    }
  });

  // Non-stacking marker: one tithe, paid every turn start.
  DS.defineStatus({
    id: 'wd_thorn_tithe', name: 'Thorn Tithe', type: 'buff', icon: '🍀', stacks: false, decay: null, expire: null,
    desc: 'At the start of your turn, gain Block equal to half your Thorns, rounded down.',
    triggers: {
      onTurnStart: [{ op: 'block', amount: { v: 'status', status: 'thorns', of: 'self', mul: 0.5 }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'wd_barbed_retort', name: 'Barbed Retort', type: 'buff', icon: '🪝', stacks: true, decay: null, expire: null,
    desc: 'Whenever you lose HP, deal {n} damage to a random enemy.',
    triggers: {
      onDamaged: [{ op: 'damage', amount: { v: 'stacks' }, to: 'random_enemy' }]
    }
  });

  // =====================================================================
  // COMMON (12): 6 attacks, 6 skills
  // =====================================================================

  // ---- common attacks ----
  DS.defineCard({
    id: 'wd_brier_stab', name: 'Brier Stab', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🌹',
    desc: 'Deal 3 damage, plus 2 per Thorns you have.',
    effects: [{ op: 'damage', amount: { v: 'status', status: 'thorns', of: 'self', mul: 2, add: 3 } }],
    upgrade: {
      desc: 'Deal 4 damage, plus 3 per Thorns you have.',
      effects: [{ op: 'damage', amount: { v: 'status', status: 'thorns', of: 'self', mul: 3, add: 4 } }]
    }
  });

  DS.defineCard({
    id: 'wd_spine_volley', name: 'Spine Volley', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'all_enemies', icon: '🦂',
    desc: 'Deal 3 damage, plus 1 per Thorns you have, to ALL enemies.',
    effects: [{ op: 'damage', amount: { v: 'status', status: 'thorns', of: 'self', mul: 1, add: 3 }, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 4 damage, plus 2 per Thorns you have, to ALL enemies.',
      effects: [{ op: 'damage', amount: { v: 'status', status: 'thorns', of: 'self', mul: 2, add: 4 }, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'wd_quill_jab', name: 'Quill Jab', class: 'warden', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', icon: '🪶',
    desc: 'Deal 3 damage. Gain 1 Thorns.',
    effects: [
      { op: 'damage', amount: 3 },
      { op: 'apply', status: 'thorns', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 4 damage. Gain 2 Thorns.',
      effects: [
        { op: 'damage', amount: 4 },
        { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_barkwhip', name: 'Barkwhip', class: 'warden', type: 'attack', rarity: 'common',
    cost: 2, target: 'enemy', icon: '🐍',
    desc: 'Deal 7 damage. Gain 2 Thorns.',
    effects: [
      { op: 'damage', amount: 7 },
      { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 9 damage. Gain 3 Thorns.',
      effects: [
        { op: 'damage', amount: 9 },
        { op: 'apply', status: 'thorns', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_thicket_lunge', name: 'Thicket Lunge', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🦌',
    desc: 'Deal 6 damage, plus a quarter of your Block, rounded down.',
    effects: [{ op: 'damage', amount: { v: 'block', of: 'self', mul: 0.25, add: 6 } }],
    upgrade: {
      desc: 'Deal 8 damage, plus a quarter of your Block, rounded down.',
      effects: [{ op: 'damage', amount: { v: 'block', of: 'self', mul: 0.25, add: 8 } }]
    }
  });

  DS.defineCard({
    id: 'wd_thorn_stomp', name: 'Thorn Stomp', class: 'warden', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🥾',
    desc: 'Deal 4 damage. Gain Block equal to your Thorns.',
    effects: [
      { op: 'damage', amount: 4 },
      { op: 'block', amount: { v: 'status', status: 'thorns', of: 'self' }, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 6 damage. Gain Block equal to your Thorns.',
      effects: [
        { op: 'damage', amount: 6 },
        { op: 'block', amount: { v: 'status', status: 'thorns', of: 'self' }, to: 'self' }
      ]
    }
  });

  // ---- common skills ----
  DS.defineCard({
    id: 'wd_thorn_ward', name: 'Thorn Ward', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🧷',
    desc: 'Gain Block equal to your Thorns, plus 3.',
    effects: [{ op: 'block', amount: { v: 'status', status: 'thorns', of: 'self', add: 3 }, to: 'self' }],
    upgrade: {
      desc: 'Gain Block equal to your Thorns, plus 5.',
      effects: [{ op: 'block', amount: { v: 'status', status: 'thorns', of: 'self', add: 5 }, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_bristle_up', name: 'Bristle Up', class: 'warden', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', icon: '🦔',
    desc: 'Gain 3 Block. Gain 1 Thorns.',
    effects: [
      { op: 'block', amount: 3, to: 'self' },
      { op: 'apply', status: 'thorns', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 4 Block. Gain 2 Thorns.',
      effects: [
        { op: 'block', amount: 4, to: 'self' },
        { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_barbed_snare', name: 'Barbed Snare', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🧶',
    desc: 'Apply 2 Weak. Gain 2 Thorns.',
    effects: [
      { op: 'apply', status: 'weak', amount: 2, to: 'target' },
      { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Apply 3 Weak. Gain 3 Thorns.',
      effects: [
        { op: 'apply', status: 'weak', amount: 3, to: 'target' },
        { op: 'apply', status: 'thorns', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_stinging_reflex', name: 'Stinging Reflex', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', icon: '🦟',
    desc: 'Gain 4 Block. Your next Attack deals 3 more damage.',
    effects: [
      { op: 'block', amount: 4, to: 'self' },
      { op: 'apply', status: 'vigor', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 6 Block. Your next Attack deals 4 more damage.',
      effects: [
        { op: 'block', amount: 6, to: 'self' },
        { op: 'apply', status: 'vigor', amount: 4, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_thorned_cloak', name: 'Thorned Cloak', class: 'warden', type: 'skill', rarity: 'common',
    cost: 2, target: 'self', icon: '🧥',
    desc: 'Gain 8 Block. Gain 2 Thorns.',
    effects: [
      { op: 'block', amount: 8, to: 'self' },
      { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 11 Block. Gain 3 Thorns.',
      effects: [
        { op: 'block', amount: 11, to: 'self' },
        { op: 'apply', status: 'thorns', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_tangle_shield', name: 'Tangle Shield', class: 'warden', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', icon: '🕸️',
    desc: 'Apply 2 Mark. Gain 4 Block.',
    effects: [
      { op: 'apply', status: 'mark', amount: 2, to: 'target' },
      { op: 'block', amount: 4, to: 'self' }
    ],
    upgrade: {
      desc: 'Apply 3 Mark. Gain 6 Block.',
      effects: [
        { op: 'apply', status: 'mark', amount: 3, to: 'target' },
        { op: 'block', amount: 6, to: 'self' }
      ]
    }
  });

  // =====================================================================
  // UNCOMMON (14): 6 attacks, 4 skills, 4 powers
  // =====================================================================

  // ---- uncommon attacks ----
  DS.defineCard({
    id: 'wd_thornspear', name: 'Thornspear', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🔱',
    desc: 'Deal 6 damage, plus 2 per Thorns you have.',
    effects: [{ op: 'damage', amount: { v: 'status', status: 'thorns', of: 'self', mul: 2, add: 6 } }],
    upgrade: {
      desc: 'Deal 7 damage, plus 3 per Thorns you have.',
      effects: [{ op: 'damage', amount: { v: 'status', status: 'thorns', of: 'self', mul: 3, add: 7 } }]
    }
  });

  DS.defineCard({
    id: 'wd_rampart_spike', name: 'Rampart Spike', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', icon: '⛏️',
    desc: 'Deal 9 damage, plus half your Block, rounded down.',
    effects: [{ op: 'damage', amount: { v: 'block', of: 'self', mul: 0.5, add: 9 } }],
    upgrade: {
      desc: 'Deal 12 damage, plus half your Block, rounded down.',
      effects: [{ op: 'damage', amount: { v: 'block', of: 'self', mul: 0.5, add: 12 } }]
    }
  });

  DS.defineCard({
    id: 'wd_briar_squall', name: 'Briar Squall', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'all_enemies', icon: '🌀',
    desc: 'Deal 4 damage to ALL enemies. Gain 2 Thorns.',
    effects: [
      { op: 'damage', amount: 4, to: 'all_enemies' },
      { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 5 damage to ALL enemies. Gain 3 Thorns.',
      effects: [
        { op: 'damage', amount: 5, to: 'all_enemies' },
        { op: 'apply', status: 'thorns', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_spine_recoil', name: 'Spine Recoil', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🦎',
    desc: 'Deal 7 damage. If you have at least 3 Thorns, deal 5 more.',
    effects: [
      { op: 'damage', amount: 7 },
      {
        op: 'if',
        cond: { left: { v: 'status', status: 'thorns', of: 'self' }, cmp: '>=', right: 3 },
        then: [{ op: 'damage', amount: 5 }],
        else: []
      }
    ],
    upgrade: {
      desc: 'Deal 9 damage. If you have at least 3 Thorns, deal 7 more.',
      effects: [
        { op: 'damage', amount: 9 },
        {
          op: 'if',
          cond: { left: { v: 'status', status: 'thorns', of: 'self' }, cmp: '>=', right: 3 },
          then: [{ op: 'damage', amount: 7 }],
          else: []
        }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_counterbark', name: 'Counterbark', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪵',
    desc: 'Deal 5 damage. Gain 1 Retaliation.',
    effects: [
      { op: 'damage', amount: 5 },
      { op: 'apply', status: 'wd_retaliation', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Deal 7 damage. Gain 2 Retaliation.',
      effects: [
        { op: 'damage', amount: 7 },
        { op: 'apply', status: 'wd_retaliation', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_bark_crusher', name: 'Bark Crusher', class: 'warden', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', icon: '🪨',
    desc: 'Deal damage equal to your Block, up to 8.',
    effects: [{
      op: 'if',
      cond: { left: { v: 'block', of: 'self' }, cmp: '>', right: 8 },
      then: [{ op: 'damage', amount: 8 }],
      else: [{ op: 'damage', amount: { v: 'block', of: 'self' } }]
    }],
    upgrade: {
      desc: 'Deal damage equal to your Block, up to 11.',
      effects: [{
        op: 'if',
        cond: { left: { v: 'block', of: 'self' }, cmp: '>', right: 11 },
        then: [{ op: 'damage', amount: 11 }],
        else: [{ op: 'damage', amount: { v: 'block', of: 'self' } }]
      }]
    }
  });

  // ---- uncommon skills ----
  DS.defineCard({
    id: 'wd_thorn_forge', name: 'Thorn Forge', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🧲',
    desc: 'Gain Thorns equal to a quarter of your Block, rounded down.',
    effects: [{ op: 'apply', status: 'thorns', amount: { v: 'block', of: 'self', mul: 0.25 }, to: 'self' }],
    upgrade: {
      desc: 'Gain Thorns equal to half your Block, rounded down.',
      effects: [{ op: 'apply', status: 'thorns', amount: { v: 'block', of: 'self', mul: 0.5 }, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_quilled_retreat', name: 'Quilled Retreat', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🐡',
    desc: 'Gain 4 Block. Draw 1 card. Gain 1 Thorns.',
    effects: [
      { op: 'block', amount: 4, to: 'self' },
      { op: 'draw', amount: 1 },
      { op: 'apply', status: 'thorns', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 6 Block. Draw 1 card. Gain 2 Thorns.',
      effects: [
        { op: 'block', amount: 6, to: 'self' },
        { op: 'draw', amount: 1 },
        { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_briar_rampart', name: 'Briar Rampart', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '🧱', retain: true,
    desc: 'Gain 10 Block. Gain 2 Thorns. Retain.',
    effects: [
      { op: 'block', amount: 10, to: 'self' },
      { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 13 Block. Gain 3 Thorns. Retain.',
      retain: true,
      effects: [
        { op: 'block', amount: 13, to: 'self' },
        { op: 'apply', status: 'thorns', amount: 3, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_sprouting_spines', name: 'Sprouting Spines', class: 'warden', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🌵',
    desc: 'Add a Sprout to your hand. Gain 1 Thorns.',
    effects: [
      { op: 'add_card', card: 'wd_sprout', to: 'hand', amount: 1 },
      { op: 'apply', status: 'thorns', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Add 2 Sprouts to your hand. Gain 2 Thorns.',
      effects: [
        { op: 'add_card', card: 'wd_sprout', to: 'hand', amount: 2 },
        { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
      ]
    }
  });

  // ---- uncommon powers ----
  DS.defineCard({
    id: 'wd_power_retaliation', name: 'Bitter Vigil', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🩸',
    desc: 'Gain 2 Retaliation: whenever you lose HP from an attack, gain 2 Vigor.',
    effects: [{ op: 'apply', status: 'wd_retaliation', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Retaliation: whenever you lose HP from an attack, gain 3 Vigor.',
      effects: [{ op: 'apply', status: 'wd_retaliation', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_power_spiny_hide', name: 'Bristling Hide', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🦔',
    desc: 'Gain 1 Spiny Hide: whenever you are hit by an attack, gain 1 Thorns.',
    effects: [{ op: 'apply', status: 'wd_spiny_hide', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain 2 Spiny Hide: whenever you are hit by an attack, gain 2 Thorns.',
      effects: [{ op: 'apply', status: 'wd_spiny_hide', amount: 2, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_power_quill_storm', name: 'Quill Tempest', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 2, target: 'self', icon: '⛈️',
    desc: 'Gain 2 Quill Storm: whenever you play a Skill, deal 2 damage to ALL enemies.',
    effects: [{ op: 'apply', status: 'wd_quill_storm', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Quill Storm: whenever you play a Skill, deal 3 damage to ALL enemies.',
      effects: [{ op: 'apply', status: 'wd_quill_storm', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_power_thorn_tithe', name: 'Tithe of Thorns', class: 'warden', type: 'power', rarity: 'uncommon',
    cost: 1, target: 'self', icon: '🍀',
    desc: 'Gain Thorn Tithe: at the start of each of your turns, gain Block equal to half your Thorns, rounded down.',
    effects: [{ op: 'apply', status: 'wd_thorn_tithe', amount: 1, to: 'self' }],
    upgrade: {
      desc: 'Gain 2 Thorns and Thorn Tithe: at the start of each of your turns, gain Block equal to half your Thorns, rounded down.',
      effects: [
        { op: 'apply', status: 'thorns', amount: 2, to: 'self' },
        { op: 'apply', status: 'wd_thorn_tithe', amount: 1, to: 'self' }
      ]
    }
  });

  // =====================================================================
  // RARE (8): 3 attacks, 3 skills, 2 powers
  // =====================================================================

  // ---- rare attacks ----
  DS.defineCard({
    id: 'wd_thorn_avalanche', name: 'Thorn Avalanche', class: 'warden', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all_enemies', icon: '☄️',
    desc: 'Deal 6 damage, plus 2 per Thorns you have, to ALL enemies.',
    effects: [{ op: 'damage', amount: { v: 'status', status: 'thorns', of: 'self', mul: 2, add: 6 }, to: 'all_enemies' }],
    upgrade: {
      desc: 'Deal 8 damage, plus 3 per Thorns you have, to ALL enemies.',
      effects: [{ op: 'damage', amount: { v: 'status', status: 'thorns', of: 'self', mul: 3, add: 8 }, to: 'all_enemies' }]
    }
  });

  DS.defineCard({
    id: 'wd_bulwark_reckoning', name: 'Bulwark Reckoning', class: 'warden', type: 'attack', rarity: 'rare',
    cost: 2, target: 'enemy', icon: '⚖️',
    desc: 'Deal damage equal to your Block, plus 4.',
    effects: [{ op: 'damage', amount: { v: 'block', of: 'self', add: 4 } }],
    upgrade: {
      desc: 'Deal damage equal to your Block, plus 6.',
      effects: [{ op: 'damage', amount: { v: 'block', of: 'self', add: 6 } }]
    }
  });

  DS.defineCard({
    id: 'wd_thorn_judgement', name: 'Thorn Judgement', class: 'warden', type: 'attack', rarity: 'rare',
    cost: 3, target: 'enemy', icon: '⚡',
    desc: 'Deal 6 damage, plus 3 per Thorns you have.',
    effects: [{ op: 'damage', amount: { v: 'status', status: 'thorns', of: 'self', mul: 3, add: 6 } }],
    upgrade: {
      desc: 'Deal 8 damage, plus 4 per Thorns you have.',
      effects: [{ op: 'damage', amount: { v: 'status', status: 'thorns', of: 'self', mul: 4, add: 8 } }]
    }
  });

  // ---- rare skills ----
  DS.defineCard({
    id: 'wd_thorn_sanctuary', name: 'Thorn Sanctuary', class: 'warden', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '⛩️',
    desc: 'Gain 8 Block. Gain Thorn Tithe: at the start of each of your turns, gain Block equal to half your Thorns, rounded down.',
    effects: [
      { op: 'block', amount: 8, to: 'self' },
      { op: 'apply', status: 'wd_thorn_tithe', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 11 Block. Gain 2 Thorns. Gain Thorn Tithe: at the start of each of your turns, gain Block equal to half your Thorns, rounded down.',
      effects: [
        { op: 'block', amount: 11, to: 'self' },
        { op: 'apply', status: 'thorns', amount: 2, to: 'self' },
        { op: 'apply', status: 'wd_thorn_tithe', amount: 1, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_living_thornwall', name: 'Living Thornwall', class: 'warden', type: 'skill', rarity: 'rare',
    cost: 2, target: 'self', icon: '🏰', retain: true,
    desc: 'Gain 12 Block. Gain 3 Thorns. Retain.',
    effects: [
      { op: 'block', amount: 12, to: 'self' },
      { op: 'apply', status: 'thorns', amount: 3, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 16 Block. Gain 4 Thorns. Retain.',
      retain: true,
      effects: [
        { op: 'block', amount: 16, to: 'self' },
        { op: 'apply', status: 'thorns', amount: 4, to: 'self' }
      ]
    }
  });

  DS.defineCard({
    id: 'wd_sacrificial_bark', name: 'Sacrificial Bark', class: 'warden', type: 'skill', rarity: 'rare',
    cost: 1, target: 'self', icon: '🌑',
    desc: 'Exhaust 1 card in your hand. Gain 8 Block. Gain 2 Thorns.',
    effects: [
      { op: 'exhaust', amount: 1 },
      { op: 'block', amount: 8, to: 'self' },
      { op: 'apply', status: 'thorns', amount: 2, to: 'self' }
    ],
    upgrade: {
      desc: 'Exhaust 1 card in your hand. Gain 11 Block. Gain 3 Thorns.',
      effects: [
        { op: 'exhaust', amount: 1 },
        { op: 'block', amount: 11, to: 'self' },
        { op: 'apply', status: 'thorns', amount: 3, to: 'self' }
      ]
    }
  });

  // ---- rare powers ----
  DS.defineCard({
    id: 'wd_power_barbed_retort', name: 'Retort Spines', class: 'warden', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '🪝',
    desc: 'Gain 2 Barbed Retort: whenever you lose HP, deal 2 damage to a random enemy.',
    effects: [{ op: 'apply', status: 'wd_barbed_retort', amount: 2, to: 'self' }],
    upgrade: {
      desc: 'Gain 3 Barbed Retort: whenever you lose HP, deal 3 damage to a random enemy.',
      effects: [{ op: 'apply', status: 'wd_barbed_retort', amount: 3, to: 'self' }]
    }
  });

  DS.defineCard({
    id: 'wd_thorned_sovereign', name: 'Thorned Sovereign', class: 'warden', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', icon: '👑',
    desc: 'Gain 1 Spiny Hide and 1 Retaliation.',
    effects: [
      { op: 'apply', status: 'wd_spiny_hide', amount: 1, to: 'self' },
      { op: 'apply', status: 'wd_retaliation', amount: 1, to: 'self' }
    ],
    upgrade: {
      desc: 'Gain 2 Spiny Hide and 2 Retaliation.',
      effects: [
        { op: 'apply', status: 'wd_spiny_hide', amount: 2, to: 'self' },
        { op: 'apply', status: 'wd_retaliation', amount: 2, to: 'self' }
      ]
    }
  });
})();
