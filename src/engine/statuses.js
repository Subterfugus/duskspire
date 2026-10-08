(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // Built-in statuses. Declarative pieces (mods / triggers / decay / expire) are data;
  // the few that need engine-level behaviour (artifact, intangible, buffer, barricade,
  // no_draw, entangle, double_tap, vigor) are implemented in combat.js and only described here.
  //
  // Trigger effects use {to:'self'} for the status owner and 'target' for the contextual party.

  DS.defineStatus({
    id: 'strength', name: 'Strength', type: 'buff', icon: '💪', stacks: true,
    desc: 'Attacks deal {n} more damage.',
    mods: { attackDealtAdd: 1 }
  });

  DS.defineStatus({
    id: 'dexterity', name: 'Dexterity', type: 'buff', icon: '🧤', stacks: true,
    desc: 'Cards that gain Block grant {n} more Block.',
    mods: { blockAdd: 1 }
  });

  DS.defineStatus({
    id: 'weak', name: 'Weak', type: 'debuff', icon: '🥀', stacks: true, decay: 'turn_end',
    desc: 'Deals 25% less attack damage. Loses 1 stack each turn.',
    mods: { attackDealtMul: 0.75 }
  });

  DS.defineStatus({
    id: 'vulnerable', name: 'Vulnerable', type: 'debuff', icon: '🎯', stacks: true, decay: 'turn_end',
    desc: 'Takes 50% more attack damage. Loses 1 stack each turn.',
    mods: { attackTakenMul: 1.5 }
  });

  DS.defineStatus({
    id: 'frail', name: 'Frail', type: 'debuff', icon: '🍂', stacks: true, decay: 'turn_end',
    desc: 'Gains 25% less Block from cards. Loses 1 stack each turn.',
    mods: { blockMul: 0.75 }
  });

  DS.defineStatus({
    id: 'poison', name: 'Poison', type: 'debuff', icon: '☠️', stacks: true, decay: 'turn_start',
    desc: 'Loses {n} HP at the start of its turn, then 1 less.',
    triggers: {
      onTurnStart: [{ op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'burn', name: 'Burn', type: 'debuff', icon: '🔥', stacks: true, decay: 'turn_end',
    desc: 'Loses {n} HP at the end of its turn, then 1 less.',
    triggers: {
      onTurnEnd: [{ op: 'lose_hp', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'regen', name: 'Regeneration', type: 'buff', icon: '🌿', stacks: true, decay: 'turn_end',
    desc: 'Heals {n} HP at the end of its turn, then 1 less.',
    triggers: {
      onTurnEnd: [{ op: 'heal', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'thorns', name: 'Thorns', type: 'buff', icon: '🌵', stacks: true,
    desc: 'Whenever attacked, deals {n} damage to the attacker.',
    triggers: {
      onAttacked: [{ op: 'damage', amount: { v: 'stacks' }, to: 'target' }]
    }
  });

  DS.defineStatus({
    id: 'plated_armor', name: 'Plated Armor', type: 'buff', icon: '🪖', stacks: true,
    desc: 'Gains {n} Block at the end of its turn. Loses 1 stack each time it takes attack damage.',
    triggers: {
      onTurnEnd: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }],
      onDamaged: {
        when: { fromAttack: true },
        effects: [{ op: 'apply', status: 'plated_armor', amount: -1, to: 'self' }]
      }
    }
  });

  DS.defineStatus({
    id: 'metallicize', name: 'Metallicize', type: 'buff', icon: '⚙️', stacks: true,
    desc: 'Gains {n} Block at the end of its turn.',
    triggers: {
      onTurnEnd: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  // Engine: negates the next debuff applied to the owner, then loses 1 stack.
  DS.defineStatus({
    id: 'artifact', name: 'Artifact', type: 'buff', icon: '🗿', stacks: true,
    desc: 'Negates the next debuff. Loses 1 stack each time it does.'
  });

  // Engine: all damage and HP loss is reduced to 1.
  DS.defineStatus({
    id: 'intangible', name: 'Intangible', type: 'buff', icon: '👻', stacks: true, decay: 'turn_end',
    desc: 'All damage and HP loss is reduced to 1. Loses 1 stack each turn.'
  });

  // Engine: block is not removed at the start of the owner\'s turn. Non-stacking.
  DS.defineStatus({
    id: 'barricade', name: 'Barricade', type: 'buff', icon: '🧱', stacks: false,
    desc: 'Block is not removed at the start of your turn.'
  });

  DS.defineStatus({
    id: 'ritual', name: 'Ritual', type: 'buff', icon: '🕯️', stacks: true,
    desc: 'At the end of its turn, gains {n} Strength.',
    triggers: {
      onTurnEnd: [{ op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'energized', name: 'Energized', type: 'buff', icon: '⚡', stacks: true,
    desc: 'Gain {n} Energy next turn.',
    triggers: {
      onTurnStart: [
        { op: 'energy', amount: { v: 'stacks' } },
        { op: 'remove_status', status: 'energized', to: 'self' }
      ]
    }
  });

  DS.defineStatus({
    id: 'draw_next', name: 'Draw Next', type: 'buff', icon: '🃏', stacks: true,
    desc: 'Draw {n} more cards next turn.',
    triggers: {
      onTurnStart: [
        { op: 'draw', amount: { v: 'stacks' } },
        { op: 'remove_status', status: 'draw_next', to: 'self' }
      ]
    }
  });

  DS.defineStatus({
    id: 'next_turn_block', name: 'Next Turn Block', type: 'buff', icon: '🛡️', stacks: true,
    desc: 'Gain {n} Block next turn.',
    triggers: {
      onTurnStart: [
        { op: 'block', amount: { v: 'stacks' }, to: 'self' },
        { op: 'remove_status', status: 'next_turn_block', to: 'self' }
      ]
    }
  });

  DS.defineStatus({
    id: 'strength_down', name: 'Strength Down', type: 'debuff', icon: '📉', stacks: true,
    desc: 'At the end of its turn, loses {n} Strength, then this is removed.',
    triggers: {
      onTurnEnd: [
        { op: 'apply', status: 'strength', amount: { v: 'stacks', mul: -1 }, to: 'self' },
        { op: 'remove_status', status: 'strength_down', to: 'self' }
      ]
    }
  });

  DS.defineStatus({
    id: 'dexterity_down', name: 'Dexterity Down', type: 'debuff', icon: '🪶', stacks: true,
    desc: 'At the end of its turn, loses {n} Dexterity, then this is removed.',
    triggers: {
      onTurnEnd: [
        { op: 'apply', status: 'dexterity', amount: { v: 'stacks', mul: -1 }, to: 'self' },
        { op: 'remove_status', status: 'dexterity_down', to: 'self' }
      ]
    }
  });

  // Engine: cannot draw. Expires at end of turn.
  DS.defineStatus({
    id: 'no_draw', name: 'No Draw', type: 'debuff', icon: '🚫', stacks: false, expire: 'turn_end',
    desc: 'Cannot draw cards. Ends at the end of the turn.'
  });

  // Engine: cannot play Attacks. Expires at end of turn.
  DS.defineStatus({
    id: 'entangle', name: 'Entangled', type: 'debuff', icon: '🕸️', stacks: false, expire: 'turn_end',
    desc: 'Cannot play Attacks. Ends at the end of the turn.'
  });

  // Engine: prevents the next HP loss, then loses 1 stack.
  DS.defineStatus({
    id: 'buffer', name: 'Buffer', type: 'buff', icon: '🧿', stacks: true,
    desc: 'Prevents the next HP loss. Loses 1 stack each time it does.'
  });

  DS.defineStatus({
    id: 'rage', name: 'Rage', type: 'buff', icon: '😡', stacks: true, expire: 'turn_end',
    desc: 'Whenever you play an Attack, gain {n} Block. Ends at the end of the turn.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'attack' },
        effects: [{ op: 'block', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  // Engine: next {n} Attacks are played twice (one stack consumed per Attack).
  DS.defineStatus({
    id: 'double_tap', name: 'Double Tap', type: 'buff', icon: '👯', stacks: true,
    desc: 'Your next {n} Attacks are played twice.'
  });

  // Engine: next Attack deals +{n} damage, then removed. Modelled as attack damage.
  DS.defineStatus({
    id: 'vigor', name: 'Vigor', type: 'buff', icon: '💢', stacks: true,
    desc: 'Your next Attack deals {n} more damage.',
    mods: { attackDealtAdd: 1 }
  });

  DS.defineStatus({
    id: 'lock_on', name: 'Lock-On', type: 'debuff', icon: '🔒', stacks: true, decay: 'turn_end',
    desc: 'Takes 50% more attack damage. Loses 1 stack each turn.',
    mods: { attackTakenMul: 1.5 }
  });

  DS.defineStatus({
    id: 'shackled', name: 'Shackled', type: 'debuff', icon: '⛓️', stacks: true,
    desc: 'At the end of its turn, gains {n} Strength, then this is removed.',
    triggers: {
      onTurnEnd: [
        { op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' },
        { op: 'remove_status', status: 'shackled', to: 'self' }
      ]
    }
  });

  DS.defineStatus({
    id: 'mark', name: 'Mark', type: 'debuff', icon: '🔖', stacks: true,
    desc: 'Marked ({n}). Has no innate effect.'
  });

  DS.defineStatus({
    id: 'curl_up', name: 'Curl Up', type: 'buff', icon: '🐚', stacks: true,
    desc: 'The first time this is attacked, gains {n} Block.',
    triggers: {
      onAttacked: [
        { op: 'block', amount: { v: 'stacks' }, to: 'self' },
        { op: 'remove_status', status: 'curl_up', to: 'self' }
      ]
    }
  });

  DS.defineStatus({
    id: 'enrage', name: 'Enrage', type: 'buff', icon: '😤', stacks: true,
    desc: 'Whenever the player plays a Skill, gains {n} Strength.',
    triggers: {
      onCardPlayed: {
        when: { cardType: 'skill' },
        effects: [{ op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' }]
      }
    }
  });

  DS.defineStatus({
    id: 'angry', name: 'Angry', type: 'buff', icon: '🤬', stacks: true,
    desc: 'Whenever attacked, gains {n} Strength.',
    triggers: {
      onAttacked: [{ op: 'apply', status: 'strength', amount: { v: 'stacks' }, to: 'self' }]
    }
  });

  DS.defineStatus({
    id: 'split_ready', name: 'Ready to Split', type: 'buff', icon: '🦠', stacks: false,
    desc: 'Marker: this unit is ready to split. Has no innate effect.'
  });
})();
