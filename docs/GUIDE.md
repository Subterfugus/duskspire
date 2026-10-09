# Duskspire player guide

This guide describes the game as it is built in this repository. The numbers come from the content files and the
engine code as they were when this guide was written. The content is still growing, so a few counts may change.

## Contents

1. Starting a run
2. How a run works
3. The map and its rooms
4. Rewards, shops, rest sites and events
5. Ascension
6. Trials
7. Score, history and the compendium
8. How combat works
9. Built-in statuses
10. The characters
11. Keyboard and settings

## 1. Starting a run

Choose New Run on the menu, then pick a champion on the character screen. Three things can be set before the run
starts:

- Ascension, from 0 up to your current unlock (see section 5).
- A seed. Leave it empty for a random run. The same champion, seed and ascension always give the same map and the
  same rewards, so a seed lets you replay a route.
- Trials, optional modifiers (see section 6).

Every run starts with eleven cards, the character's starter relic, the character's starting HP, and 99 gold.

## 2. How a run works

A run has three acts. Each act is a branching map that ends in a boss. Beat the boss of act 1 and you move on to
act 2. Beat the boss of act 3 and you win. The run also ends if your HP reaches zero. Your score is kept either way.

Between fights you keep your deck, relics, potions, gold and HP. HP does not refill on its own, so rest sites and
healing rewards matter.

Runs save automatically. Choosing Continue on the menu returns you to the exact room you left:

- If you leave in the middle of a fight and continue, that fight starts again from the beginning, with the same
  enemies and the same opening hand. Leaving a fight does not let you reroll it.
- If you leave in the middle of an event choice, the same event is offered again.

## 3. The map and its rooms

Each act has a map of rooms laid out in rows, numbered 0 to 14 from the first row you see. You can move only to rooms
linked from your current room. Row 0 is always fights. Row 8 is always a treasure room. Row 14, the last row before the
boss, is always a rest site.

Each act uses one of three layouts (standard, dense or sparse), chosen from the run's seed.

Apart from those fixed rows, rooms are chosen at random with these weights:

| Room | Weight | Notes |
|---|---|---|
| Fight | 45 | An ordinary enemy group. The first three normal fights of each act use easier groups. |
| Event | 22 | A story with choices. About 15 percent of event rooms turn out to be an ambush fight instead. |
| Shop | 9 | Cards, relics, potions, and card removal. |
| Elite | 12 | From row 5 onward. A harder fight with better rewards. |
| Rest site | 12 | From row 5 onward, except row 13, which sits just above the fixed rest row. |

Every act is guaranteed at least one shop and at least two elite rooms.

| Room type | What it is |
|---|---|
| Fight | Ordinary combat. Gold, a card choice, and sometimes a potion. |
| Elite | Harder combat. Gold, a card choice, a relic, and sometimes a potion. |
| Rest site | Heal or upgrade a card (section 4). |
| Shop | Buy cards, relics or potions, or pay to remove a card. |
| Event | A story with two to four choices. |
| Treasure | A chest with gold and a relic, and sometimes a bonus. |
| Boss | The act's guardian. Afterwards you pick one boss relic. |

## 4. Rewards, shops, rest sites and events

When you win a fight you reach a reward screen. Each reward line can be claimed once:

- Gold.
- A potion, if one was rolled.
- A relic, if one was rolled.
- One card from three choices, or none if you skip.

Rewards by fight type:

- Ordinary fight: 10 to 20 gold, three card choices, and a 40 percent chance of a potion.
- Elite fight: 25 to 35 gold, three card choices, a relic, and a 40 percent chance of a potion.
- Boss fight: 95 to 105 gold, three rare cards, and a 40 percent chance of a potion. The boss also gives you a boss relic
  choice (below).
- Treasure chest: 15 to 25 gold and a relic. The chest also has a bonus: a potion (35 percent chance, if you have a free
  potion slot), or 8 to 14 gold (25 percent chance). Otherwise there is no bonus.

Card choices come from your character's class. About one time in ten, one of the three choices is a colorless card
instead.

Boss relic choice: you see three relics and take one. Boss-rarity relics are offered first, then rare, uncommon and
common relics that your character can use. You never see a relic you already own.

Shops sell five cards from your class and two colorless cards, three relics (one of them can be a shop-only relic),
and three potions. Typical prices before ascension modifiers:

| Item | Price |
|---|---|
| Common card | 45 to 55 gold |
| Uncommon card | 68 to 82 gold |
| Rare card | 135 to 165 gold |
| Relic | about 150, 250 or 300 gold, depending on rarity |
| Potion | 50, 75 or 100 gold, depending on rarity |
| Card removal | 75 gold, plus 25 for each card you have already removed |

Ascension level 7 (Inflation) raises shop prices by 10 percent.

Rest sites offer one of two things, not both:

- Rest: heal 30 percent of your max HP. From ascension level 3 this drops to 25 percent.
- Smith: upgrade one card of your choice.

Upgraded cards show a `+` and have stronger effects.

Events are short stories. Each one offers two to four choices. A choice can cost HP or gold for something better, or
can start a fight. Some choices need a minimum amount of gold or HP, or a relic or card type you own. Some events
appear in every act, and some only in particular acts. An event does not come up again until the others in its pool
have been seen.

Potion slots: you start with three. Some relics add more. Ascension level 10 removes one.

## 5. Ascension

Ascension levels are harder modifiers. Level n applies every level from 1 to n, so level 4 has the effects of levels
1, 2, 3 and 4 together.

| Level | Name | Effect |
|---|---|---|
| 1 | Hardened Elites | Elite enemies have 15 percent more max HP. |
| 2 | Bloodthirst | Enemies deal 10 percent more damage. |
| 3 | Frugal Hearth | Resting heals 25 percent of max HP instead of 30 percent. |
| 4 | Cursed Start | You begin the run with a random curse in your deck. |
| 5 | Guardian's Wrath | Bosses have 20 percent more max HP. |
| 6 | Lean Purse | Fight rewards and treasure give 15 percent less gold. |
| 7 | Inflation | Shop prices are 10 percent higher. |
| 8 | Thick Hides | All enemies have 10 percent more max HP. |
| 9 | Weary Road | Each new act begins at 90 percent of max HP instead of full HP. |
| 10 | Final Ordeal | Enemies deal 10 percent more damage again, and you have one fewer potion slot. |

Ascension is unlocked per character. You start at level 0. Winning a run at a level unlocks the next level for that
character, up to level 10.

## 6. Trials

Trials are optional modifiers, switched on at the character screen. Each one is either a handicap (it makes the run
harder and raises the score) or a boon (it makes the run easier and lowers the score). The final score is multiplied
by 1 plus the sum of the chosen trials' percentages, with a floor of one quarter.

The trials currently in the game:

| Trial | Score | Effect |
|---|---|---|
| Sluggish Blood | +50% | You have 2 Energy each turn instead of 3. |
| Heavy Pack | +35% | Draw 4 cards each turn instead of 5. |
| Dark Drumbeat | +35% | At the start of every third turn, all enemies gain 1 Strength. |
| Warpaint Totem | +40% | At the start of each combat, all enemies gain 1 Enrage. Whenever you play a Skill, each enemy gains Strength equal to its Enrage. |
| Brittle Bones | +20% | Immediately lose 10 max HP. |
| Restless Dead | +20% | At the start of each combat, shuffle a Clumsy into your draw pile. |
| Ember Tithe | +20% | At the start of each combat, lose 4 HP. |
| Scorched Bedroll | +20% | After you rest, lose 8 HP. |
| Grave Dowry | +25% | Immediately add 2 Decay curses to your deck. |
| Hobbled Ankle | +25% | At the start of each combat, become Entangled until the end of your first turn. |
| Bloodletting Charm | +25% | At the start of each of your turns, lose 1 HP. |
| Splinter Ward | +25% | Whenever an attack damages you, lose 2 HP. |
| Toll Road | +15% | Each time you enter a room, lose 2 gold. |
| Cracked Satchel | +15% | You have 2 potion slots instead of 3. |
| Dim Lantern | +15% | At the start of each combat, gain 2 Weak. |
| Frayed Gauntlet | +15% | At the start of each combat, gain 2 Frail. |
| Purse of Plenty | -20% | Immediately gain 75 gold. |
| Ironbark Shield | -20% | At the start of each combat, gain 6 Block. |
| Iron Constitution | -25% | Immediately gain 12 max HP and heal 12 HP. |
| Quickened Hands | -25% | On the first turn of each combat, draw 2 extra cards. |
| Bright Spark | -35% | At the start of each combat, gain 2 Strength. |
| Keen Eye | -40% | Draw 6 cards each turn instead of 5. |
| Warrior's Ring | -50% | You have 4 Energy each turn instead of 3. |
| Potion Satchel | -15% | You have 4 potion slots instead of 3. |

Trials are never offered as rewards. They only exist as run modifiers.

## 7. Score, history and the compendium

A run's score is built from how far you got and what you did. It counts the floor you reached, the acts you cleared,
the elites and bosses you defeated, and your gold. A win adds a bonus that is larger when you win in fewer turns. The
total is then multiplied by 1 plus a quarter for each ascension level. Trials change the multiplier as described in
section 6.

The History screen lists your recent runs, with the character, ascension, score and what ended the run. It also shows
lifetime totals and achievements. There are 35 achievements.

The Compendium lists cards, relics, potions, enemies and statuses, with a search box. Entries you have not met yet are
dimmed. The How to Play screen explains the basic rules and the keywords.

## 8. How combat works

Combat is played in turns, and you act first. Each turn:

- You have 3 energy, plus any energy from relics. Each card shows its cost in the orb at its corner.
- You draw 5 cards, plus any extra from relics. Your hand holds at most 10 cards. A card drawn while your hand is full
  goes straight to your discard pile.
- You play cards by clicking them, dragging them onto a target, or pressing their number key.
- When you are done, end your turn.

Enemies then act in order. Each enemy shows its next move as an icon above it. Hover over the icon to see the exact
damage per hit, with the enemy's Strength, your Weak and Vulnerable, and other modifiers already counted. Your Block is
applied afterwards, when the hit lands. Enemies can summon more enemies, up to five on the field
at once.

When your turn starts, your Block is removed, unless a status such as Barricade keeps it. Block you gained on turn one
from effects at the start of combat is kept.

At the end of your turn, cards left in your hand are discarded, except those with Retain, which stay in your hand.
Ethereal cards left in your hand are exhausted instead. When the draw pile runs out, your discard pile is shuffled back
into it.

Damage works in a fixed order. Attack damage is first increased by your Strength, then changed by statuses such as Weak
and Vulnerable on the attacker and the target. Block absorbs that damage next, and any damage left over comes off HP.
Damage never goes below zero.

Card words:

| Word | Meaning |
|---|---|
| Exhaust | The card leaves the battle after it is played, until the fight ends. |
| Ethereal | If it is still in your hand at the end of the turn, it is exhausted. |
| Innate | It starts every fight in your opening hand. |
| Retain | It stays in your hand at the end of the turn. |
| Unplayable | It cannot be played. |
| X cost | It spends all your energy, and its effect scales with the energy spent. |

Potions are single-use. You can use them only in a fight, by clicking them in the top bar. Outside a fight you can
discard one instead.

Relics are passive. Hover over one to read it. Some relics work at the start of every combat, some after each fight,
and some when you do something specific.

Winning a fight takes you to its reward screen. Losing ends the run.

## 9. Built-in statuses

These are the statuses the engine defines for every character. Each class also adds its own statuses, and the hover
text on a card explains those. "Stacks" below means the number shown on the status icon.

| Status | Type | Effect |
|---|---|---|
| Strength | Buff | Each stack adds 1 damage to attacks. Can go negative. |
| Dexterity | Buff | Each stack adds 1 Block to cards that grant Block. Can go negative. |
| Weak | Debuff | Deals 25 percent less attack damage. Loses 1 stack each turn. |
| Vulnerable | Debuff | Takes 50 percent more attack damage. Loses 1 stack each turn. |
| Frail | Debuff | Gains 25 percent less Block from cards. Loses 1 stack each turn. |
| Poison | Debuff | Loses HP equal to its stacks at the start of its owner's turn, then 1 stack less. |
| Burn | Debuff | Loses HP equal to its stacks at the end of its owner's turn, then 1 stack less. |
| Regeneration | Buff | Heals HP equal to its stacks at the end of its turn, then 1 stack less. |
| Thorns | Buff | Whenever it is attacked, deals damage equal to its stacks to the attacker. |
| Plated Armor | Buff | Gains Block equal to its stacks at the end of its turn. Loses 1 stack each time it takes attack damage. |
| Metallicize | Buff | Gains Block equal to its stacks at the end of its turn. |
| Artifact | Buff | Negates the next debuff applied to its owner. Loses 1 stack each time. |
| Intangible | Buff | All damage and HP loss is reduced to 1. Loses 1 stack each turn. |
| Barricade | Buff | Block is not removed at the start of the owner's turn. Does not stack. |
| Ritual | Buff | Gains Strength equal to its stacks at the end of its turn. |
| Energized | Buff | Gives its stacks in Energy next turn, then is removed. |
| Draw Next | Buff | Draws its stacks in extra cards next turn, then is removed. |
| Next Turn Block | Buff | Gains its stacks in Block next turn, then is removed. |
| Strength Down | Debuff | At the end of its turn, loses Strength equal to its stacks, then is removed. |
| Dexterity Down | Debuff | At the end of its turn, loses Dexterity equal to its stacks, then is removed. |
| No Draw | Debuff | Cannot draw cards. Ends at the end of the turn. |
| Entangled | Debuff | Cannot play Attacks. Ends at the end of the turn. |
| Buffer | Buff | Prevents the next HP loss. Loses 1 stack each time. |
| Rage | Buff | Whenever you play an Attack, gain Block equal to its stacks. Ends at the end of the turn. |
| Double Tap | Buff | Each stack makes one of your next Attacks play twice. |
| Vigor | Buff | Your next Attack deals extra damage equal to its stacks. Then all Vigor is used up. |
| Lock-On | Debuff | Takes 50 percent more attack damage. Loses 1 stack each turn. |
| Shackled | Debuff | At the end of its turn, gains Strength equal to its stacks, then is removed. |
| Mark | Debuff | A counter with no effect of its own. Some cards read it and spend it. |
| Curl Up | Buff | The first time it is attacked, gains Block equal to its stacks. Then is removed. |
| Enrage | Buff | Whenever the player plays a Skill, gains Strength equal to its stacks. |
| Angry | Buff | Whenever it is attacked, gains Strength equal to its stacks. |
| Ready to Split | Buff | A marker with no effect of its own. |

## 10. The characters

Each character starts with eleven cards (five Strikes, four Defends, and two signature cards), a starter relic, and
their starting HP. Card rewards and shops draw from the character's class and from the shared colorless pool. Each
class has several archetypes, which are styles of deck its cards support. The tips below are starting points, not rules.

### Ulfar, the Bloodaxe (Berserker)

- Starting HP: 80. Starter relic: Bloodsoaked Bandage (heal 6 HP after each won fight).
- Signature cards: Bloodied Axe, Blood Scrape.
- Archetypes:
  - Bloodprice: spend HP for power. Blood Hunger gives Strength whenever you lose HP.
  - Scorched: Exhaust cards and Ember tokens, which pay off through powers such as Kindle Soul.
  - Whirlwind: multi-hit attacks and Strength.
  - Warpath: Vulnerable, heavy single hits, and stances.
  - Warcry (expansion): skills that set up your next Attack with Vigor or Double Tap, and Wounds as fuel.
- Tips:
  1. HP is a resource here. Bloodied Axe costs 1 HP for 7 damage, and the starter relic heals 6 after each won fight.
  2. Strength makes every attack hit harder. Whetstone gives 1 Strength for 1 energy, and Blood Hunger (uncommon) adds
     1 Strength each time you lose HP.
  3. Blood Scrape costs no energy, and it draws a card for 1 HP. Use it early to find your key cards.

### Mirell, the Glasswright (Arcanist)

- Starting HP: 75. Starter relic: Cinder Lamp (1 extra energy on the first turn of each combat).
- Signature cards: Kindling Bolt (4 damage and 2 Burn), Focus Rune (gain 2 Arcane Charge).
- Archetypes:
  - Arcane Charge: skills and attacks store charge, and finishers spend it.
  - Cinderfall: Burn on enemies, with all-enemy fire.
  - Frostglass: Chill, Weak and Block.
  - Mana Engine: X-cost spells, energy gain, and card generation.
  - Lightning (expansion): random-enemy multi-hits, Lock-On, and Static Spark tokens.
- Tips:
  1. Store charge with Focus Rune, then spend it. Arcane Finale deals 8 damage plus 5 for each charge you hold, and
     spends them all.
  2. Burn sets up Scorch Bolt, which deals 5 more damage to a target that has Burn. Kindling Bolt puts Burn on the
     target.
  3. Cinder Lamp gives an extra energy on turn one. Spend it on Focus Rune plus a big card.

### Warden (Warden)

- Starting HP: 80. Starter relic: Ironbark Charm (4 Block at the start of each combat).
- Signature cards: Root Guard (4 Block and 1 Growth), Thorn Lash (5 damage and 1 Mark).
- Archetypes:
  - Bulwark: lots of Block, and cards that turn Block into damage, such as Ironbark Slam.
  - Thorns: Thorns, Thorn Aura and Plated Bark, plus Mark and Lock-On hunting.
  - Growth: each Growth stack adds 1 damage to every attack. Seed of Growth adds more each turn.
  - Sanctuary: healing and Regeneration, Max HP, and retained cards.
  - Expansion: Bulwark Bash, Riposte, Taunt, Momentum, and Sapwell.
- Tips:
  1. Block is damage. Ironbark Slam deals damage equal to your Block, and Bark Bash adds half your Block to a 4 damage
     attack.
  2. Growth does not wear off. It has no decay, so it lasts until the end of the fight. Root Guard and Growing Strike
     add it, and every attack after that hits harder.
  3. Thorns hurt whatever attacks you. Mossy Wall gives 5 Block and 1 Thorns in one card.

### Kaze, the Wandering Tempest (Tempest)

- Starting HP: 78. Starter relic: Wind Bell (2 Momentum at the start of each turn).
- Signature cards: Gust Lash (2 Momentum and 5 damage), Still Breath (3 Block, and Stillness).
- Archetypes:
  - Momentum: every card you play builds Momentum, and finishers spend it.
  - Stances: Gale and Stillness, which cannot be active at the same time. Gale raises your damage and the damage you
    take. Stillness gives Block at the end of each turn.
  - Static: enemies collect Static, which Lightning Conduit and Discharge can detonate.
  - Storm: Stored Storm is banked by retained and exhaust cards, and spent by Storm Release.
- Tips:
  1. Each Momentum adds 1 damage to your attacks. Releasing Gust spends it for 3 damage per Momentum. Momentum ends at the
     end of your turn, so spend it while you have it.
  2. Choose Gale or Stillness for the fight. Gale gives 30 percent more attack damage and 25 percent more damage taken,
     and each hit that lands gives Momentum. Stillness gives Block at the end of every turn.
  3. Wind Bell gives 2 Momentum at the start of each turn. It also refunds 1 energy from the first card you play each turn
     that costs 2 or more.

### Hesper Vane, the Forbidden Reader (Occultist)

- Starting HP: 66, the lowest of the six. Starter relic: Wax-Sealed Candle (2 Block whenever you exhaust a card).
- Signature cards: Hex Needle (5 damage and 1 Hex), Forbidden Index (draw 2, and add a Wound to your discard pile).
- Archetypes:
  - Hex: enemies with Hex take more damage from each attack, and lose HP when they attack. Hex spreads and doubles.
  - Sacrifice: Curses and Statuses are fuel. You exhaust them for value.
  - Lifedrain: healing from kills and from losing HP, and max HP that grows when enemies die.
  - Ritual: powers and retained cards that grow every turn.
- Tips:
  1. Hex is a multiplier. Hex Needle starts it, Wailing Chorus spreads it to every enemy, and Hex Scourge doubles it.
  2. Forbidden Index adds a Wound, so plan for it. Ashen Maw deals 12 damage and exhausts every Status card in your hand,
     and Alchemist of Wounds gives energy whenever you exhaust a Status card.
  3. With only 66 HP, heal when you can. Leech Touch heals 3, and Sanguine Rite heals 2 every time you lose HP.

### Shade, the Silent Knife (Shade)

- Starting HP: 76. Starter relic: Shadowcloak (draw 2 extra cards at the start of each combat).
- Signature cards: Venom Dart (3 Poison), Sidestep (5 Block and draw 1).
- Archetypes:
  - Poison: stacks of Poison, catalysts that multiply it, and damage that scales with poison.
  - Shiv: free, exhausting Shiv and Vial tokens, many cheap attacks, and X-cost storms.
  - Cycle: discard synergy, draw, and exhaust engines.
  - Evasion: Weak, Dexterity, Block, and setup for the next turn.
  - Ambush (expansion): Mark as a combo counter, and large payoffs on turns one and two.
- Tips:
  1. Stack Poison early. Venom Dart applies 3, and Fester doubles an enemy's Poison. Poison deals its stacks at the start of
     the enemy's turn, then drops by one.
  2. Shivs cost 0 and exhaust. Shiv Pouch (1 energy) adds two of them to your hand, a quick way to add cheap damage.
  3. Shadowcloak draws two extra cards on turn one. Keep cheap cards in your deck so you can play through that hand.

### Ottilie Brass, the Artificer (Artificer)

- Starting HP: 76. Starter relic: Spare Gears (gain 1 Sentry Turret at the start of each combat, and 1 Block whenever you
  exhaust a card).
- Signature cards: Wrench Jab (5 damage and 2 Block), Sentry Kit (gain 3 Sentry Turret).
- Archetypes:
  - Constructs: Sentry Turret, Bulwark Plating, Ember Vent, Repair Drone and Lattice Drone live on you and act every turn.
  - Overclock: extra Energy or cards now, paid for with Strain. Strain costs HP at the end of your turn, then all of it fades.
  - Scrap: exhaust cards for payoffs. Salvage Plate, Scrapyard and Recycler react to exhausts.
  - Crossovers: Salvage Turret, Gearbox and Assembly Line.
- Tips:
  1. Sentry Turrets act on their own. Sentry Kit with Spare Gears gives you turrets that deal damage to a random enemy at
     the start of every turn.
  2. Strain is a bill paid at the end of the turn. Overclock Jolt costs nothing and gives Energy now, but adds Strain, so
     plan the HP you will lose.
  3. Exhausting is Block. Spare Gears gives 1 Block per exhaust, and Plating Patch exhausts itself for 7 Block.

### Beastcaller and Revenant

Two more characters are planned for version 3: the Beastcaller and the Revenant. At the time of writing their card
files are still placeholders, so they cannot be played yet. When they are finished they will appear on the character
screen with their own sections in this guide.

## 11. Keyboard and settings

Combat keys:

| Key | Action |
|---|---|
| 1 to 9, 0 | Play the card in that hand position (0 is the tenth card). |
| E or Space | End your turn. |
| Arrow keys | Move the target while you are choosing one. |
| Enter or Space | Confirm the target. |
| Esc | Cancel a card you are targeting or dragging. |
| L | Show or hide the combat log. |

Elsewhere, Esc closes the top dialog. In the Electron app, F11 toggles fullscreen.

Settings:

- Game speed: 1, 2 or 3. It scales the pauses between enemy actions and animations.
- Volume, mute, and music on or off.
- Confirm before ending a turn, when you still have playable cards and energy.
- Screen shake.
- Show the combat log.
- Fullscreen, where the browser allows it.

Saves and settings are stored in the browser or Electron profile on the machine you play on. They are not shared
between machines.
