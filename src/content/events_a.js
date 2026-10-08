(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // Wandering, shrine, gambler, stranger and curio events usable in any act.
  // Run-level ops only. No fights. Ids are prefixed ea_.

  DS.defineEvent({
    id: 'ea_wishing_well',
    name: 'The Wishing Well',
    act: 'any',
    icon: '🪣',
    text: 'A ring of mossy stones encloses a well so deep its bottom is only a rumor of silver. Coins flash far below as you lean over the lip, and a cold breath carries a whisper that sounds almost like your own voice. It seems to be waiting for an offering.',
    choices: [
      {
        label: '[Toss 30 gold] Lose 30 gold. Gain a random uncommon relic.',
        cond: { minGold: 30 },
        effects: [
          { op: 'gold', amount: -30 },
          { op: 'add_relic', relic: 'random', rarity: 'uncommon' },
        ],
        result: 'The coins vanish without a splash, and something heavy drifts up out of the dark into your hand.',
      },
      {
        label: '[Toss a memory] Lose 8 HP. Remove a card of your choice.',
        cond: { minHp: 12 },
        effects: [
          { op: 'lose_hp', amount: 8 },
          { op: 'remove_card', amount: 1, random: false },
        ],
        result: 'You name a thing you no longer need, and the well quietly takes it from you.',
      },
      {
        label: '[Drink] Heal 12 HP. Gain a Regret curse.',
        effects: [
          { op: 'heal', amount: 12 },
          { op: 'add_card', card: 'curse_regret' },
        ],
        result: 'The water is cold and sweet, and it tastes faintly of old mistakes.',
      },
      {
        label: '[Walk away] Nothing happens.',
        effects: [],
        result: 'The whispering follows you for a few steps, then fades behind the trees.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_dice_hermit',
    name: 'The Dice Hermit',
    act: 'any',
    icon: '🎲',
    text: 'An old hermit sits cross-legged on a rug of faded bone dice, shaking a cup with a sound like tiny teeth. "Everyone is owed something by the dark," he says, grinning around a gap in his teeth. "Ante up, and the dice will decide what you are worth."',
    choices: [
      {
        label: '[Wager 25 gold] Lose 25 gold. 50%: gain 55 gold.',
        cond: { minGold: 25 },
        effects: [
          { op: 'gold', amount: -25 },
          {
            op: 'chance',
            p: 0.5,
            then: [{ op: 'gold', amount: 55 }],
            else: [],
            thenResult: 'The dice tumble and the hermit pays out with a cackle. Your purse is heavier than before.',
            elseResult: 'Snake eyes. The hermit pockets your coins and asks if you want another round.',
          },
        ],
        result: 'The dice roll, and the hermit watches your face more than the table.',
      },
      {
        label: '[Bet 8 HP] Lose 8 HP. 50%: gain 45 gold.',
        cond: { minHp: 12 },
        effects: [
          { op: 'lose_hp', amount: 8 },
          {
            op: 'chance',
            p: 0.5,
            then: [{ op: 'gold', amount: 45 }],
            else: [],
            thenResult: 'Your blood is worth more to him than your coin, and he counts out the gold with respect.',
            elseResult: 'The dice fall against you and your blood was spent for nothing.',
          },
        ],
        result: 'The hermit collects your bet with a bow.',
      },
      {
        label: '[Load the dice] 35%: gain 70 gold. 65%: lose 15 gold.',
        cond: { minGold: 15 },
        effects: [
          {
            op: 'chance',
            p: 0.35,
            then: [{ op: 'gold', amount: 70 }],
            else: [{ op: 'gold', amount: -15 }],
            thenResult: 'The loaded dice finally land in your favor, and the hermit looks genuinely impressed.',
            elseResult: 'He sees the weight in your hand and takes his fee for the insult.',
          },
        ],
        result: 'You palm a weighted die and hope the dark is not watching.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'The hermit returns to shaking his cup, murmuring odds to no one.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_pale_peddler',
    name: 'The Pale Peddler',
    act: 'any',
    icon: '🧳',
    text: 'A peddler with a pack that rattles like a wind chime stops you on the road, her face powdered white and her smile too wide. Her wares lie on a cloth: a folded map, a pair of spectacles, a knife that hums softly to itself. "Everything here is for sale," she says, "even the things you would rather keep."',
    choices: [
      {
        label: '[Pay 35 gold] Lose 35 gold. Remove a card of your choice.',
        cond: { minGold: 35 },
        effects: [
          { op: 'gold', amount: -35 },
          { op: 'remove_card', amount: 1, random: false },
        ],
        result: 'She takes the coins and the card, and you cannot quite remember what it was.',
      },
      {
        label: '[Pay 50 gold] Lose 50 gold. Upgrade a random card.',
        cond: { minGold: 50 },
        effects: [
          { op: 'gold', amount: -50 },
          { op: 'upgrade_card', amount: 1, random: true },
        ],
        result: 'She hums over your deck, and one card comes back sharper and brighter.',
      },
      {
        label: '[Sell a memory] Lose 10 max HP. Gain 80 gold.',
        effects: [
          { op: 'max_hp', amount: -10 },
          { op: 'gold', amount: 80 },
        ],
        result: 'She weighs the memory on her tongue and pays generously for its flavor.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'She shrugs and folds her cloth over the knife, which hums a little louder as you go.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_shrine_of_blood',
    name: 'Shrine of Blood',
    act: 'any',
    icon: '🩸',
    text: 'Dark red liquid trickles down a carved basin, collecting in grooves shaped like open mouths. The air tastes of iron, and every carving faces you with the same patient hunger. A small dish waits at the base, empty and expectant.',
    choices: [
      {
        label: '[Offer 14 HP] Lose 14 HP. Gain a random rare relic.',
        cond: { minHp: 20 },
        effects: [
          { op: 'lose_hp', amount: 14 },
          { op: 'add_relic', relic: 'random', rarity: 'rare' },
        ],
        result: 'The basin drinks deeply and returns a relic warm as a heartbeat.',
      },
      {
        label: '[Offer 5 HP] Lose 5 HP. Upgrade a random card.',
        cond: { minHp: 8 },
        effects: [
          { op: 'lose_hp', amount: 5 },
          { op: 'upgrade_card', amount: 1, random: true },
        ],
        result: 'The shrine accepts a small offering and hums with approval.',
      },
      {
        label: '[Bathe in the basin] Gain a Pain curse. Heal 15 HP.',
        effects: [
          { op: 'add_card', card: 'curse_pain' },
          { op: 'heal', amount: 15 },
        ],
        result: 'The blood is warm and soothing, and a dull ache settles into your bones to stay.',
      },
      {
        label: '[Turn away] Nothing happens.',
        effects: [],
        result: 'Behind you, the carvings sigh in unison as you leave them hungry.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_mirror_of_truth',
    name: 'The Mirror of Truth',
    act: 'any',
    icon: '🪞',
    text: 'A tall mirror leans inside a ruined archway, its frame dripping with tarnished silver. Your reflection moves a half-beat late, and when it smiles, you do not. It seems to be measuring every choice you have ever made.',
    choices: [
      {
        label: '[Gaze] Gain 6 max HP. Gain a Shame curse.',
        effects: [
          { op: 'max_hp', amount: 6 },
          { op: 'add_card', card: 'curse_shame' },
        ],
        result: 'You see yourself plainly, flaws and all, and the glass gives you a little more of you to live with.',
      },
      {
        label: '[Shatter it] Lose 6 HP. Remove a card of your choice.',
        cond: { minHp: 10 },
        effects: [
          { op: 'lose_hp', amount: 6 },
          { op: 'remove_card', amount: 1, random: false },
        ],
        result: 'The glass cracks into a hundred reflections, and in one of them a card is simply gone.',
      },
      {
        label: '[Ask its name] Upgrade a random card.',
        effects: [{ op: 'upgrade_card', amount: 1, random: true }],
        result: 'The mirror answers with your own voice, a little wiser than you remember it.',
      },
      {
        label: '[Look away] Nothing happens.',
        effects: [],
        result: 'You keep your eyes on the floor until the archway is far behind you.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_storyteller',
    name: 'The Night Storyteller',
    act: 'any',
    icon: '🔥',
    text: 'A campfire crackles inside a ring of blackened stones, and a traveler with a voice like warm tar is spinning a tale about a king who sold his shadow. Other wanderers have gathered, and no one seems to notice the fire has burned for hours without fuel. He pauses mid-sentence and looks straight at you.',
    choices: [
      {
        label: '[Listen to the tale] Heal 10 HP. Gain 15 gold.',
        effects: [
          { op: 'heal', amount: 10 },
          { op: 'gold', amount: 15 },
        ],
        result: 'Every word wraps around you like a blanket, and by the final line your wounds have closed.',
      },
      {
        label: '[Tell your own tale] Upgrade a random card. Gain a Regret curse.',
        effects: [
          { op: 'upgrade_card', amount: 1, random: true },
          { op: 'add_card', card: 'curse_regret' },
        ],
        result: 'You tell the truth about a mistake, and the fire flares bright with approval and a little grief.',
      },
      {
        label: '[Ask for the ending] Add a random uncommon card.',
        effects: [{ op: 'add_card', card: 'random', rarity: 'uncommon' }],
        result: 'He tells you how the king ends, and the card that ends the story is now yours.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'You step back into the dark while the story continues without you.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_forked_road',
    name: 'The Forked Road',
    act: 'any',
    icon: '🛤️',
    text: 'The road splits three ways beneath a dead tree whose branches are hung with strips of cloth. The left path is churned with fresh footprints heading in and none heading out. The middle path is smooth and shadowless, and the right path is lit by a sun that is not quite there.',
    choices: [
      {
        label: '[Left, the trampled path] Lose 10 HP. Gain 40 gold.',
        cond: { minHp: 12 },
        effects: [
          { op: 'lose_hp', amount: 10 },
          { op: 'gold', amount: 40 },
        ],
        result: 'The trampled ground ends at an abandoned camp, where someone left a purse behind in a hurry.',
      },
      {
        label: '[Middle, the smooth path] Gain a random potion.',
        effects: [{ op: 'add_potion', potion: 'random' }],
        result: 'The path is quiet and easy, and at its end a traveler presses a bottle into your hand and walks on.',
      },
      {
        label: '[Right, the sunlit path] Heal 14 HP. Gain a Doubt curse.',
        effects: [
          { op: 'heal', amount: 14 },
          { op: 'add_card', card: 'curse_doubt' },
        ],
        result: 'The light is warm and healing, but it casts a shadow on your mind that will not leave.',
      },
      {
        label: '[Go back] Nothing happens.',
        effects: [],
        result: 'The dead tree creaks behind you as though it is disappointed.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_cursed_reliquary',
    name: 'The Cursed Reliquary',
    act: 'any',
    icon: '📦',
    text: 'A black lacquered box sits in the dust, bound by seven rusted chains and humming like a sleeping bee. Its lid bears a single word in old script, the kind that becomes true only when read aloud. Nothing about it looks safe, and nothing about it looks empty.',
    choices: [
      {
        label: '[Open it] Gain a random uncommon relic. Gain a Pain curse.',
        effects: [
          { op: 'add_relic', relic: 'random', rarity: 'uncommon' },
          { op: 'add_card', card: 'curse_pain' },
        ],
        result: 'The lid lifts on a relic that glitters like oil, along with a bruise that will not fade.',
      },
      {
        label: '[Pry out the gold] Gain 60 gold. Gain a Decay curse.',
        effects: [
          { op: 'gold', amount: 60 },
          { op: 'add_card', card: 'curse_decay' },
        ],
        result: 'Coins spill out in a bright cascade, and a sour smell of rot follows them into your satchel.',
      },
      {
        label: '[Break the chains] Lose 6 HP. Upgrade 2 random cards.',
        cond: { minHp: 8 },
        effects: [
          { op: 'lose_hp', amount: 6 },
          { op: 'upgrade_card', amount: 2, random: true },
        ],
        result: 'The chains snap, and a surge of old craftsmanship runs through your deck.',
      },
      {
        label: '[Leave it sealed] Nothing happens.',
        effects: [],
        result: 'The bee-hum stops the moment you step away, which somehow feels worse.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_black_market',
    name: 'The Black Market',
    act: 'any',
    icon: '🕯️',
    text: 'Behind a tapestry in an abandoned hall, three hooded vendors display glowing vials, boxes sealed with black wax, and a card that looks blank until you glance at it sideways. Their prices are chalked in blood-red on the wall. None of them will meet your eyes.',
    choices: [
      {
        label: '[Buy a sealed vial] Lose 30 gold. Gain a random potion.',
        cond: { minGold: 30 },
        effects: [
          { op: 'gold', amount: -30 },
          { op: 'add_potion', potion: 'random' },
        ],
        result: 'The vial fizzes in your hand, and the vendor has already vanished behind the tapestry.',
      },
      {
        label: '[Buy the black box] Lose 60 gold. Gain a random rare relic.',
        cond: { minGold: 60 },
        effects: [
          { op: 'gold', amount: -60 },
          { op: 'add_relic', relic: 'random', rarity: 'rare' },
        ],
        result: 'The wax breaks with a sigh, and inside lies a relic that feels older than the hall.',
      },
      {
        label: '[Buy the blank card] Lose 20 gold. Add a random rare card.',
        cond: { minGold: 20 },
        effects: [
          { op: 'gold', amount: -20 },
          { op: 'add_card', card: 'random', rarity: 'rare' },
        ],
        result: 'When you tilt the card toward the light, it shows you a technique you can actually use.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'Someone behind the tapestry coughs, and the prices on the wall are quietly rewritten.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_masked_duelist',
    name: 'The Masked Duelist',
    act: 'any',
    icon: '🤺',
    text: 'A duelist in a porcelain mask steps out of the fog with his sword already drawn and a silver coin spinning across his knuckles. "No blood needed today," he says, though his blade tells a different story. "Accept my challenge and be paid for the trouble, or yield your purse and walk away unharmed."',
    choices: [
      {
        label: '[Accept the duel] Lose 9 HP. Gain 50 gold.',
        cond: { minHp: 12 },
        effects: [
          { op: 'lose_hp', amount: 9 },
          { op: 'gold', amount: 50 },
        ],
        result: 'Steel rings against steel, and at the last moment he lowers his point and tosses you the purse.',
      },
      {
        label: '[Yield your purse] Lose 20 gold. Upgrade a random card.',
        cond: { minGold: 20 },
        effects: [
          { op: 'gold', amount: -20 },
          { op: 'upgrade_card', amount: 1, random: true },
        ],
        result: 'He bows, takes the coins, and pauses long enough to show you the parry he would have used.',
      },
      {
        label: '[Mock his mask] Gain 25 gold. Gain a Shame curse.',
        effects: [
          { op: 'gold', amount: 25 },
          { op: 'add_card', card: 'curse_shame' },
        ],
        result: 'He laughs behind the porcelain and drops a few coins at your feet, along with a shame that sticks.',
      },
      {
        label: '[Walk past] Nothing happens.',
        effects: [],
        result: 'The coin keeps spinning in the fog long after his footsteps stop.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_gilded_toad',
    name: 'The Gilded Toad',
    act: 'any',
    icon: '🐸',
    text: 'A toad as large as a cart squats on a pillow of gold leaf, its skin glittering like sunrise over a lake. It blinks slowly, and each blink drops a single coin into the dust. "Ask me anything," it croaks in a voice like a rusty hinge, "but I always take a price in something you can spare."',
    choices: [
      {
        label: '[Ask for riches] Lose 6 max HP. Gain 70 gold.',
        effects: [
          { op: 'max_hp', amount: -6 },
          { op: 'gold', amount: 70 },
        ],
        result: 'The toad flicks a coin into your palm, and your reflection in its eyes looks slightly smaller.',
      },
      {
        label: '[Ask for a potion] Lose 8 HP. Gain a random potion.',
        cond: { minHp: 10 },
        effects: [
          { op: 'lose_hp', amount: 8 },
          { op: 'add_potion', potion: 'random' },
        ],
        result: 'It coughs up a sloshing bottle and a wet, satisfied burp.',
      },
      {
        label: '[Ask for a card] Lose 4 HP. Add a random uncommon card.',
        cond: { minHp: 8 },
        effects: [
          { op: 'lose_hp', amount: 4 },
          { op: 'add_card', card: 'random', rarity: 'uncommon' },
        ],
        result: 'It stares at you for a long time, then spits a card that smells faintly of pond water.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'The toad blinks once more, and a single coin drops into the dust behind you.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_hooded_stranger',
    name: 'The Hooded Stranger',
    act: 'any',
    icon: '🧥',
    text: 'A stranger in a hood stitched from old banners stands in the rain, offering a sealed flask in one gloved hand. His other hand stays hidden behind his back. "Something for something," he says, and the rain seems reluctant to touch him.',
    choices: [
      {
        label: '[Take the flask] Gain a random potion. Gain a Parasite curse.',
        effects: [
          { op: 'add_potion', potion: 'random' },
          { op: 'add_card', card: 'curse_parasite' },
        ],
        result: 'The flask is warm, and something small and eager stirs in your pack.',
      },
      {
        label: '[Give him 15 gold] Lose 15 gold. Upgrade a random card.',
        cond: { minGold: 15 },
        effects: [
          { op: 'gold', amount: -15 },
          { op: 'upgrade_card', amount: 1, random: true },
        ],
        result: 'He nods, as though you have passed a test you did not know you were taking.',
      },
      {
        label: '[Share your rations] Heal 10 HP.',
        effects: [{ op: 'heal', amount: 10 }],
        result: 'He accepts the bread with a quiet thanks, and the cold in your fingers begins to ease.',
      },
      {
        label: '[Refuse] Nothing happens.',
        effects: [],
        result: 'He lowers his hand, shrugs, and vanishes into the rain without a sound.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_sunken_library',
    name: 'The Sunken Library',
    act: 'any',
    icon: '📚',
    text: 'Half of this library has slid into a flooded crater, and its shelves still stand in dark water like the ribs of a sunken ship. Loose pages drift past your ankles, all written in the same looping hand. One book lies open on a dry dais, its ink still wet.',
    choices: [
      {
        label: '[Read the first tome] Lose 4 HP. Upgrade a random card.',
        cond: { minHp: 8 },
        effects: [
          { op: 'lose_hp', amount: 4 },
          { op: 'upgrade_card', amount: 1, random: true },
        ],
        result: 'The ink fumes sting your eyes, but the lesson it teaches is clean and precise.',
      },
      {
        label: '[Study the wet-ink book] Add a random rare card. Gain a Doubt curse.',
        effects: [
          { op: 'add_card', card: 'random', rarity: 'rare' },
          { op: 'add_card', card: 'curse_doubt' },
        ],
        result: 'The knowledge is sharp and new, and the doubt it leaves behind is sharper still.',
      },
      {
        label: '[Sell the loose pages] Gain 25 gold.',
        effects: [{ op: 'gold', amount: 25 }],
        result: 'A scholar appears from the mist, buys the pages without asking where they came from, and disappears again.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'You wade back toward the shore while the pages continue writing themselves in the water.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_gravedigger',
    name: 'The Gravedigger',
    act: 'any',
    icon: '⚰️',
    text: 'An old man with a shovel leans on a mound of freshly turned earth, humming a song you almost know. Beside him lies an open grave, and at its bottom gleams a ring tangled in a child\'s ribbon. He tips his cap at you as if he has been expecting you for years.',
    choices: [
      {
        label: '[Dig with him] Lose 5 HP. Gain 25 gold.',
        cond: { minHp: 8 },
        effects: [
          { op: 'lose_hp', amount: 5 },
          { op: 'gold', amount: 25 },
        ],
        result: 'The earth gives up clay and a few coins, and he thanks you as if you had done him a great service.',
      },
      {
        label: '[Take the ring] Gain a random uncommon relic. Gain a Regret curse.',
        effects: [
          { op: 'add_relic', relic: 'random', rarity: 'uncommon' },
          { op: 'add_card', card: 'curse_regret' },
        ],
        result: 'The ring is cold and fits your finger as though it was made for you.',
      },
      {
        label: '[Leave flowers on the mound] Heal 10 HP.',
        effects: [{ op: 'heal', amount: 10 }],
        result: 'The gravedigger smiles and goes back to humming, and the flowers ease something in your chest.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'He keeps digging, and the song follows you down the road.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_weeping_idol',
    name: 'The Weeping Idol',
    act: 'any',
    icon: '🗿',
    text: 'A stone idol with a wide, cracked face stands in a clearing, its eyes streaked with gold where coins have been pressed into them over centuries. The air around it feels heavy, like a held breath. A tin cup of water sits at its feet, and the water is still cold.',
    choices: [
      {
        label: '[Pray] Heal 12 HP.',
        effects: [{ op: 'heal', amount: 12 }],
        result: 'The stone seems to listen, and a little warmth seeps from its surface into your bones.',
      },
      {
        label: '[Pry a coin from its eye] Gain 40 gold. Gain an Injury curse.',
        effects: [
          { op: 'gold', amount: 40 },
          { op: 'add_card', card: 'curse_injury' },
        ],
        result: 'The gold comes away wet, and the idol\'s expression, if anything, softens.',
      },
      {
        label: '[Drink the cold water] Lose 4 HP. Gain 5 max HP.',
        cond: { minHp: 6 },
        effects: [
          { op: 'lose_hp', amount: 4 },
          { op: 'max_hp', amount: 5 },
        ],
        result: 'The water is bitter and bracing, and it leaves you stronger than it found you.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'The idol keeps its streaked gaze on the road long after you have passed.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_wayside_forge',
    name: 'The Wayside Forge',
    act: 'any',
    icon: '🔨',
    text: 'A battered anvil stands under a lean-to roof, its fire banked low and its smith nowhere to be seen. A cloth on the bench holds a dozen blades still warm from the hammer. A note pinned beside them reads: "Bring me your mistakes. I work cheap."',
    choices: [
      {
        label: '[Temper two cards] Lose 8 HP. Upgrade 2 random cards.',
        cond: { minHp: 12 },
        effects: [
          { op: 'lose_hp', amount: 8 },
          { op: 'upgrade_card', amount: 2, random: true },
        ],
        result: 'The heat bites your palms, and two cards in your deck ring like new steel.',
      },
      {
        label: '[Reforge a mistake] Transform a card of your choice.',
        effects: [{ op: 'transform_card', amount: 1, random: false }],
        result: 'You hold up a card you regret, and the forge melts it down into something unfamiliar.',
      },
      {
        label: '[Melt down a curse] Remove a Curse from your deck.',
        cond: { hasCardType: 'curse' },
        effects: [{ op: 'remove_card', amount: 1, random: false, type: 'curse' }],
        result: 'The curse hisses and dissolves in the coals, leaving only a smell of burnt tar.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'The fire settles lower behind you, as if it is waiting for your return.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_dream_pool',
    name: 'The Dream Pool',
    act: 'any',
    icon: '🌙',
    text: 'A black pool reflects a moon that is not in the sky above. Lotus blossoms float on its surface, each holding a faint glow like a memory half remembered. When you kneel to look, the water whispers the name of a place you have never been.',
    choices: [
      {
        label: '[Drink from the pool] Gain 7 max HP. Gain a Doubt curse.',
        effects: [
          { op: 'max_hp', amount: 7 },
          { op: 'add_card', card: 'curse_doubt' },
        ],
        result: 'The water tastes of sleep and waking at once, and you feel larger and smaller in the same breath.',
      },
      {
        label: '[Float a blossom] Heal 15 HP.',
        effects: [{ op: 'heal', amount: 15 }],
        result: 'The blossom opens in your palm, and warmth steals gently up your arm.',
      },
      {
        label: '[Dive in] Lose 10 HP. Add a random rare card.',
        cond: { minHp: 14 },
        effects: [
          { op: 'lose_hp', amount: 10 },
          { op: 'add_card', card: 'random', rarity: 'rare' },
        ],
        result: 'The cold water pulls at you, and when you surface you carry a new idea like a pearl.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'The moon in the pool dims as you step back onto the dry stones.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_coin_spiral',
    name: 'The Coin Spiral',
    act: 'any',
    icon: '🌀',
    text: 'Thousands of old coins are pressed into the cracks of a rock wall, forming a spiral that seems to turn whenever you look away. A single coin rests on a ledge at eye level, face up. A cheerful voice from the crack says, "Flip it, if you dare."',
    choices: [
      {
        label: '[Flip it] Lose 20 gold. 50%: gain 40 gold.',
        cond: { minGold: 20 },
        effects: [
          { op: 'gold', amount: -20 },
          {
            op: 'chance',
            p: 0.5,
            then: [{ op: 'gold', amount: 40 }],
            else: [],
            thenResult: 'The coin lands on the bright side. The spiral clicks and gold tumbles from the cracks.',
            elseResult: 'The coin lands on the dull side. The spiral laughs and keeps its due.',
          },
        ],
        result: 'You flip the coin and hold your breath as it spins.',
      },
      {
        label: '[Flip it twice] 25%: gain 100 gold. Otherwise: lose 20 HP.',
        cond: { minHp: 30 },
        effects: [
          {
            op: 'chance',
            p: 0.25,
            then: [{ op: 'gold', amount: 100 }],
            else: [{ op: 'lose_hp', amount: 20 }],
            thenResult: 'Twice the bright side. The spiral pours out a fortune and goes quiet.',
            elseResult: 'Twice the dull side. Pain blooms through you, and the spiral claims its toll.',
          },
        ],
        result: 'The coin spins between your fingers, dangerously light.',
      },
      {
        label: '[Pry the coins from the wall] Gain 25 gold. Gain a Decay curse.',
        effects: [
          { op: 'gold', amount: 25 },
          { op: 'add_card', card: 'curse_decay' },
        ],
        result: 'The coins come loose with rust on your fingers, and the rust does not wash off.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'Behind you, the spiral is still turning, and the cheerful voice wishes you better luck.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_old_soldier',
    name: 'The Old Soldier',
    act: 'any',
    icon: '🎖️',
    text: 'A veteran sits on a broken cannon wheel, cleaning a rusty sword with the care of a man who has little else left. His tunic bears more medals than buttons, and his rations sit untouched beside him. "There was a time I had a company," he says, not quite to you.',
    choices: [
      {
        label: '[Buy him a meal] Lose 10 gold. Heal 12 HP.',
        cond: { minGold: 10 },
        effects: [
          { op: 'gold', amount: -10 },
          { op: 'heal', amount: 12 },
        ],
        result: 'He eats slowly, and you realize the meal was for both of you.',
      },
      {
        label: '[Ask for his medal] Gain a random common relic.',
        effects: [{ op: 'add_relic', relic: 'random', rarity: 'common' }],
        result: 'He hesitates, then presses a worn medal into your hand. "Wear it for the ones who did not come home."',
      },
      {
        label: '[Learn his drill] Lose 5 HP. Upgrade a random card.',
        cond: { minHp: 8 },
        effects: [
          { op: 'lose_hp', amount: 5 },
          { op: 'upgrade_card', amount: 1, random: true },
        ],
        result: 'His drill is brutal and exact, and the lesson sinks into your muscles until it feels like second nature.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'He returns to the rust on his blade, and the wheel creaks as you walk away.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_toll_keeper',
    name: 'The Toll Keeper',
    act: 'any',
    icon: '🌉',
    text: 'A rope bridge spans a gorge so deep the mist below swallows sound, and a toll keeper sits at the near end with a ledger and a cracked pair of spectacles. "Fare for crossing," he says, "paid in what you have or what you can spare." The bridge creaks as if something on it is breathing.',
    choices: [
      {
        label: '[Pay 25 gold] Lose 25 gold. Heal 8 HP.',
        cond: { minGold: 25 },
        effects: [
          { op: 'gold', amount: -25 },
          { op: 'heal', amount: 8 },
        ],
        result: 'He stamps your ledger and offers a steadying hand as you cross.',
      },
      {
        label: '[Pay in blood] Lose 7 HP. Gain 15 gold.',
        cond: { minHp: 10 },
        effects: [
          { op: 'lose_hp', amount: 7 },
          { op: 'gold', amount: 15 },
        ],
        result: 'He writes a figure down and gives back a small purse from under the ledger.',
      },
      {
        label: '[Leap across] 50%: gain a random potion. Otherwise: lose 12 HP.',
        cond: { minHp: 15 },
        effects: [
          {
            op: 'chance',
            p: 0.5,
            then: [{ op: 'add_potion', potion: 'random' }],
            else: [{ op: 'lose_hp', amount: 12 }],
            thenResult: 'You land hard on the far side, and a bottle lies in the moss beside you, unbroken.',
            elseResult: 'The rope bucks and you crash into the boards. The keeper winces in sympathy.',
          },
        ],
        result: 'You take a running start and trust the rope.',
      },
      {
        label: '[Pay with a card] Remove a card of your choice.',
        effects: [{ op: 'remove_card', amount: 1, random: false }],
        result: 'He takes the card, looks at it in the spectacles, and waves you on.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_fairy_ring',
    name: 'The Fairy Ring',
    act: 'any',
    icon: '🍄',
    text: 'A ring of pale mushrooms glows softly in the undergrowth, each cap a shade of color that does not quite exist. Something under the moss hums a tune in a voice far too large for it. Two caps near the center look freshly picked, and their stems are still wet.',
    choices: [
      {
        label: '[Eat the blue cap] Heal 12 HP.',
        effects: [{ op: 'heal', amount: 12 }],
        result: 'It tastes of cold mint and soft rain, and your bruises seem to forget they were ever there.',
      },
      {
        label: '[Eat the red cap] Lose 8 HP. Gain 10 max HP.',
        cond: { minHp: 10 },
        effects: [
          { op: 'lose_hp', amount: 8 },
          { op: 'max_hp', amount: 10 },
        ],
        result: 'It burns sweetly all the way down, leaving you broader and a little dizzy.',
      },
      {
        label: '[Eat a grey cap] Gain a Parasite curse. Add a random uncommon card.',
        effects: [
          { op: 'add_card', card: 'curse_parasite' },
          { op: 'add_card', card: 'random', rarity: 'uncommon' },
        ],
        result: 'Something grey and clever takes up residence in your thoughts, and it teaches you a trick on the way in.',
      },
      {
        label: '[Leave the ring] Nothing happens.',
        effects: [],
        result: 'The humming stops as you step outside the circle, and the moss goes still.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_scales_of_judgement',
    name: 'The Scales of Judgement',
    act: 'any',
    icon: '⚖️',
    text: 'Two brass pans hang from a chain above a dais, swaying gently though there is no wind to move them. A dark-robed scribe waits behind them with an ink pot, ready to record your verdict. "Everything you carry has a weight," he says. "Place it on the pan, and the scales will decide what is worth keeping."',
    choices: [
      {
        label: '[Place a curse on the pan] Remove a Curse from your deck.',
        cond: { hasCardType: 'curse' },
        effects: [{ op: 'remove_card', amount: 1, random: false, type: 'curse' }],
        result: 'The pan dips under the curse and then rises, as though a stone has been lifted from your chest.',
      },
      {
        label: '[Place your gold on the pan] Lose 40 gold. Upgrade a random card.',
        cond: { minGold: 40 },
        effects: [
          { op: 'gold', amount: -40 },
          { op: 'upgrade_card', amount: 1, random: true },
        ],
        result: 'The coins clink into the brass, and a card in your deck glows with the scribe\'s approval.',
      },
      {
        label: '[Place your years on the pan] Lose 8 max HP. Gain a random rare relic.',
        effects: [
          { op: 'max_hp', amount: -8 },
          { op: 'add_relic', relic: 'random', rarity: 'rare' },
        ],
        result: 'The scribe writes a long number in his ledger and slides a relic across the dais toward you.',
      },
      {
        label: '[Leave the scales] Nothing happens.',
        effects: [],
        result: 'The scribe closes his ledger without a word and the pans come to rest, perfectly level.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_obsidian_altar',
    name: 'The Obsidian Altar',
    act: 'any',
    icon: '🌑',
    text: 'A slab of obsidian rises from the ash like a black tongue, polished to a surface that shows only darkness. Hot ash drifts around its base, and a hollow in its center waits for something to be laid inside. Strange symbols crawl across the stone in lines that seem to shift when you blink.',
    choices: [
      {
        label: '[Offer blood] Lose 6 HP. Upgrade 2 random cards.',
        cond: { minHp: 10 },
        effects: [
          { op: 'lose_hp', amount: 6 },
          { op: 'upgrade_card', amount: 2, random: true },
        ],
        result: 'The altar drinks the warmth from your palm and hands back a sharper edge to your deck.',
      },
      {
        label: '[Offer years] Lose 4 max HP. Add a random rare card.',
        effects: [
          { op: 'max_hp', amount: -4 },
          { op: 'add_card', card: 'random', rarity: 'rare' },
        ],
        result: 'You feel a little older and a good deal more capable.',
      },
      {
        label: '[Offer gold] Lose 30 gold. Heal 20 HP.',
        cond: { minGold: 30 },
        effects: [
          { op: 'gold', amount: -30 },
          { op: 'heal', amount: 20 },
        ],
        result: 'The coins sink into the obsidian without a sound, and the ash around you briefly turns green with life.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'The symbols settle into still lines as you back away from the altar.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_card_sharp',
    name: 'The Card Sharp',
    act: 'any',
    icon: '🃏',
    text: 'A lean man in a gaudy waistcoat shuffles a deck so quickly the faces blur into a single painted smear. "Ante fifteen gold," he says, "and I will deal you a hand worth more than your coin." He smiles, and you cannot tell whether he is cheating for you or against you.',
    choices: [
      {
        label: '[Ante 15 gold] Lose 15 gold. 60%: gain a random uncommon card.',
        cond: { minGold: 15 },
        effects: [
          { op: 'gold', amount: -15 },
          {
            op: 'chance',
            p: 0.6,
            then: [{ op: 'add_card', card: 'random', rarity: 'uncommon' }],
            else: [],
            thenResult: 'He flips over your winning hand with a flourish and slides you a card with a wink.',
            elseResult: 'He sweeps the cards away and takes your coins with a shrug.',
          },
        ],
        result: 'You put your coins on the table and he deals.',
      },
      {
        label: '[High stakes, 30 gold] Lose 30 gold. 40%: gain a random rare card.',
        cond: { minGold: 30 },
        effects: [
          { op: 'gold', amount: -30 },
          {
            op: 'chance',
            p: 0.4,
            then: [{ op: 'add_card', card: 'random', rarity: 'rare' }],
            else: [],
            thenResult: 'The final card is a masterpiece, and he bows as if he has lost on purpose.',
            elseResult: 'The house takes it all, and he is already shuffling for the next table.',
          },
        ],
        result: 'The table goes quiet while the cards are turned over.',
      },
      {
        label: '[Cheat] Lose 5 HP. Gain 20 gold.',
        cond: { minHp: 8 },
        effects: [
          { op: 'lose_hp', amount: 5 },
          { op: 'gold', amount: 20 },
        ],
        result: 'You palm an ace and he pretends not to notice, though his knife does not leave the table.',
      },
      {
        label: '[Walk away] Nothing happens.',
        effects: [],
        result: 'He calls after you that the deck is still waiting for a better player.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_healing_spring',
    name: 'The Healing Spring',
    act: 'any',
    icon: '💧',
    text: 'A spring bubbles up through a crack in a moss-covered boulder, its water so clear the stones beneath look like jewels. Tiny lights drift in the current and scatter whenever your reflection passes over them. Someone has carved a cup into the rock and left it full.',
    choices: [
      {
        label: '[Drink deeply] Heal 14 HP.',
        effects: [{ op: 'heal', amount: 14 }],
        result: 'The water runs cool down your throat and into aches you had forgotten were there.',
      },
      {
        label: '[Bottle the water] Add a random potion.',
        effects: [{ op: 'add_potion', potion: 'random' }],
        result: 'You seal the spring water in a glass vial, and it glows faintly against your palm.',
      },
      {
        label: '[Bathe in the pool] Heal 6 HP. Gain 4 max HP.',
        effects: [
          { op: 'heal', amount: 6 },
          { op: 'max_hp', amount: 4 },
        ],
        result: 'You wade in up to your ribs, and the cold clears your head as well as your wounds.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'The lights drift back together over the spring as you climb the bank.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_sleepwalker',
    name: 'The Sleepwalker',
    act: 'any',
    icon: '😴',
    text: 'A pale man walks through the camp with his eyes closed, murmuring about a door he needs to find. He stops before you and holds out one hand, palm up. "Give me something you no longer need," he says in his sleep, "and I will give you something you will need."',
    choices: [
      {
        label: '[Give him a card] Remove a card of your choice. Heal 15 HP.',
        effects: [
          { op: 'remove_card', amount: 1, random: false },
          { op: 'heal', amount: 15 },
        ],
        result: 'He takes the card gently and sighs with relief, and your wounds ease in the wake of his breath.',
      },
      {
        label: '[Take his dream] Lose 10 HP. Add a random rare card.',
        cond: { minHp: 12 },
        effects: [
          { op: 'lose_hp', amount: 10 },
          { op: 'add_card', card: 'random', rarity: 'rare' },
        ],
        result: 'Someone else\'s dream settles into your memory like a stone dropped into still water.',
      },
      {
        label: '[Wake him] Gain 25 gold. Gain a Clumsy curse.',
        effects: [
          { op: 'gold', amount: 25 },
          { op: 'add_card', card: 'curse_clumsy' },
        ],
        result: 'He blinks, glances at your coins, and sighs. "Well. That was not the door after all."',
      },
      {
        label: '[Let him sleep] Nothing happens.',
        effects: [],
        result: 'He wanders off toward the treeline, still reaching for a door only he can see.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_glowing_cocoon',
    name: 'The Glowing Cocoon',
    act: 'any',
    icon: '🕸️',
    text: 'A silken cocoon as large as a horse hangs between two gnarled trees, pulsing gently with a light like a slow heartbeat. Threads of gold run through its fibers, and strands of web stretch from it into the dark. Something inside shifts, and the silk tightens around its hollow.',
    choices: [
      {
        label: '[Cut it open] Lose 12 HP. Gain a random rare relic.',
        cond: { minHp: 16 },
        effects: [
          { op: 'lose_hp', amount: 12 },
          { op: 'add_relic', relic: 'random', rarity: 'rare' },
        ],
        result: 'The silk parts with a sigh, and a bright new relic rolls out, still warm from its long wait.',
      },
      {
        label: '[Stroke the silk] Heal 10 HP. Gain a Decay curse.',
        effects: [
          { op: 'heal', amount: 10 },
          { op: 'add_card', card: 'curse_decay' },
        ],
        result: 'The silk is soft and warm, and a faint rot clings to your fingers when you pull them away.',
      },
      {
        label: '[Take a strand of gold] Gain 35 gold.',
        effects: [{ op: 'gold', amount: 35 }],
        result: 'The gold thread comes away easily, and the cocoon sways as if it is sighing with relief.',
      },
      {
        label: '[Leave] Nothing happens.',
        effects: [],
        result: 'The cocoon pulses once more as you walk away, slower than before.',
      },
    ],
  });

  DS.defineEvent({
    id: 'ea_crow_oracle',
    name: 'The Crow Oracle',
    act: 'any',
    icon: '🐦',
    text: 'A crow the size of a child perches on a leaning headstone, its feathers gleaming like wet ink. When you approach, it tilts its head and speaks in a voice that sounds like three people talking at once. "I know what lies ahead. Shall I tell you, for a fee?"',
    choices: [
      {
        label: '[Pay 3 HP for a prophecy] Lose 3 HP. Upgrade a random card.',
        cond: { minHp: 6 },
        effects: [
          { op: 'lose_hp', amount: 3 },
          { op: 'upgrade_card', amount: 1, random: true },
        ],
        result: 'It studies the road ahead and taps one card in your deck, which grows brighter in your memory.',
      },
      {
        label: '[Pay 20 gold for a prophecy] Lose 20 gold. Gain a random potion.',
        cond: { minGold: 20 },
        effects: [
          { op: 'gold', amount: -20 },
          { op: 'add_potion', potion: 'random' },
        ],
        result: 'It spits out a small bottle along with a warning you did not ask for.',
      },
      {
        label: '[Ask for riches] Gain 40 gold. Gain a Pain curse.',
        effects: [
          { op: 'gold', amount: 40 },
          { op: 'add_card', card: 'curse_pain' },
        ],
        result: 'The crow laughs and drops a coin shaped like your name. It hurts to pick up.',
      },
      {
        label: '[Shoo it away] Nothing happens.',
        effects: [],
        result: 'The crow flaps off with a cackle, and its prophecy follows you anyway.',
      },
    ],
  });
})();
