(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // Act-specific set-piece events (ids prefixed eb_).
  const EVENTS_B = [
    // ============ ACT 1: ASHEN CATACOMBS ============
    {
      id: 'eb_bone_altar', name: 'The Bone Altar', act: [1], icon: '🦴',
      text: "Beneath a collapsed chapel, a heap of femurs has been stacked into a crude altar. Fresh red paint rings its base, and the air hums with whispered counting. A small brass bell waits at its summit, and the counting pauses, as if for you.",
      choices: [
        {
          label: '[Ring the bell] Lose 8 HP. Gain a random uncommon relic.',
          cond: { minHp: 10 },
          effects: [{ op: 'lose_hp', amount: 8 }, { op: 'add_relic', relic: 'random', rarity: 'uncommon' }],
          result: 'The bell tolls once, and the bones beneath it rattle in approval. Something settles into your chest.'
        },
        {
          label: '[Offer coin] Lose 25 gold. Heal 12 HP.',
          cond: { minGold: 25 },
          effects: [{ op: 'gold', amount: -25 }, { op: 'heal', amount: 12 }],
          result: 'Coins slide down between the femurs and vanish. A warmth seeps back into your bones.'
        },
        {
          label: '[Leave] Nothing happens.',
          effects: [],
          result: 'The counting resumes behind you, a little louder.'
        }
      ]
    },
    {
      id: 'eb_rat_king', name: 'The Rat King', act: [1], icon: '🐀',
      text: "A rat the size of a hound sits on a throne woven from tails, and a hundred glittering eyes turn toward you at once. It chitters, and somehow you understand: a tithe, or a tooth. Its courtiers begin to edge closer through the rubble.",
      choices: [
        {
          label: '[Pay the tithe] Lose 20 gold.',
          cond: { minGold: 20 },
          effects: [{ op: 'gold', amount: -20 }],
          result: 'The Rat King counts each coin with a long pink claw and waves you onward, bored.'
        },
        {
          label: '[Offer a tooth] Lose 12 HP. Gain a random common card.',
          cond: { minHp: 15 },
          effects: [{ op: 'lose_hp', amount: 12 }, { op: 'add_card', card: 'random', rarity: 'common' }],
          result: 'He takes one of your teeth with great ceremony and nudges a forgotten card across the stone with his tail.'
        },
        {
          label: '[Flee through the drains] Gain Injury, a curse.',
          effects: [{ op: 'add_card', card: 'curse_injury' }],
          result: 'You scramble down a drain with teeth in your leg. The wound will not close cleanly.'
        }
      ]
    },
    {
      id: 'eb_cult_confession', name: 'The Confessor', act: [1], icon: '🕯️',
      text: "In a side alcove, a robed cultist kneels before a cracked mirror, murmuring confessions. He turns and offers you the same gentle smile he gives the glass. \"Tell me one thing you would rather forget, and the dark will take it.\"",
      choices: [
        {
          label: '[Confess] Remove a card of your choice. Gain Regret, a curse.',
          effects: [{ op: 'remove_card', amount: 1 }, { op: 'add_card', card: 'curse_regret' }],
          result: 'You speak a memory aloud, and the mirror swallows it whole. A cold weight of regret settles in its place.'
        },
        {
          label: '[Pray with him] Heal 12 HP.',
          effects: [{ op: 'heal', amount: 12 }],
          result: 'He presses a cool hand to your brow, and the fever in your wounds quiets.'
        },
        {
          label: '[Rob the alcove] Gain 30 gold. Gain Shame, a curse.',
          effects: [{ op: 'gold', amount: 30 }, { op: 'add_card', card: 'curse_shame' }],
          result: 'The purse is heavier than it looks, and the mirror shows you your own face, ashamed.'
        }
      ]
    },
    {
      id: 'eb_fungal_garden', name: 'The Glowing Garden', act: [1], icon: '🍄',
      text: "The passage opens into a garden of luminous caps that pulse like slow heartbeats. Spores drift through the air, tasting of copper and honey, and settle on your tongue. At the center, one cluster has grown into a perfect, shimmering orb.",
      choices: [
        {
          label: '[Eat a cap] Heal 10 HP. Gain Parasite, a curse.',
          effects: [{ op: 'heal', amount: 10 }, { op: 'add_card', card: 'curse_parasite' }],
          result: 'It is sweet, then sweet and warm, then something that moves beneath your skin.'
        },
        {
          label: '[Gather spores] Gain a random potion.',
          effects: [{ op: 'add_potion', potion: 'random' }],
          result: 'You seal the spores in a flask, and they fizz softly against the glass.'
        },
        {
          label: '[Cradle the orb] Lose 6 HP. Upgrade a card of your choice.',
          cond: { minHp: 10 },
          effects: [{ op: 'lose_hp', amount: 6 }, { op: 'upgrade_card', amount: 1, random: false }],
          result: 'The orb stings your palms and sinks into your hands, and a technique comes sharper for it.'
        }
      ]
    },
    {
      id: 'eb_gilded_reliquary', name: 'The Gilded Reliquary', act: [1], icon: '🏺',
      text: "A reliquary of gilded bronze holds the finger bones of a saint nobody remembers. Rats swarm its base, clean and unhurried, as if they serve it. The lid stands open, and the bones glint with something that is not quite light.",
      choices: [
        {
          label: '[Take a relic-bone] Lose 5 max HP. Gain a random uncommon relic.',
          effects: [{ op: 'max_hp', amount: -5 }, { op: 'add_relic', relic: 'random', rarity: 'uncommon' }],
          result: 'The bone is cold and light. Your skull feels a little thinner, but the relic hums against your palm.'
        },
        {
          label: '[Kneel before it] Heal 15 HP. Gain Doubt, a curse.',
          effects: [{ op: 'heal', amount: 15 }, { op: 'add_card', card: 'curse_doubt' }],
          result: 'The rats fall silent as warmth floods back into you, and a question you cannot answer takes root.'
        },
        {
          label: '[Pocket a finger] Gain 40 gold. Gain Pain, a curse.',
          effects: [{ op: 'gold', amount: 40 }, { op: 'add_card', card: 'curse_pain' }],
          result: 'The bone crumbles into gold dust that clings to you, and the ache follows.'
        }
      ]
    },
    {
      id: 'eb_bone_dice', name: "The Ossuary Dice", act: [1], icon: '🎲',
      text: "A table of yellowed skeletons sits around a bowl of dice carved from knuckle bones. Their jaws clack open in greeting, and one of them slides a single die toward you with a finger that is only bone. \"Roll,\" it rattles, \"and see whether the house is generous.\"",
      choices: [
        {
          label: '[Roll the bones] 50%: gain 40 gold, or lose 15 HP.',
          cond: { minHp: 16 },
          effects: [{
            op: 'chance', p: 0.5,
            then: [{ op: 'gold', amount: 40 }],
            else: [{ op: 'lose_hp', amount: 15 }],
            thenResult: 'The die lands on six, and coins spill out of the skulls onto the table.',
            elseResult: 'The die lands on one, and the table bites back, tearing a gash across your hand.'
          }],
          result: 'The dice have spoken.'
        },
        {
          label: '[Stake 30 gold] 50%: win 60 gold back, or lose the stake.',
          cond: { minGold: 30 },
          effects: [
            { op: 'gold', amount: -30 },
            {
              op: 'chance', p: 0.5,
              then: [{ op: 'gold', amount: 60 }],
              else: [],
              thenResult: 'The skeletons applaud with a sound like snapping twigs, and pay you double.',
              elseResult: 'The skeletons laugh and gather your stake into a pile of their own.'
            }
          ],
          result: 'The bones clatter across the table.'
        },
        {
          label: '[Walk away] Nothing happens.',
          effects: [],
          result: 'The dice keep rolling without you.'
        }
      ]
    },
    {
      id: 'eb_ash_scribe', name: 'The Ash Scribe', act: [1], icon: '✍️',
      text: "A scribe sits dead at a desk of charred oak, quill still pinched between two fingers. His ledger lies open, its pages inked in a hand that changes every few lines, as if many people had written in it. The last entry is your name.",
      choices: [
        {
          label: '[Read the ledger] Gain a random uncommon card. Gain Doubt, a curse.',
          effects: [{ op: 'add_card', card: 'random', rarity: 'uncommon' }, { op: 'add_card', card: 'curse_doubt' }],
          result: 'Between the lines you find a technique worth keeping, and a question you cannot unask.'
        },
        {
          label: '[Erase the entry] Remove a card of your choice.',
          effects: [{ op: 'remove_card', amount: 1 }],
          result: 'The ink runs under your thumb, and a card in your deck goes with it.'
        },
        {
          label: '[Copy the spells] Lose 10 HP. Upgrade a card of your choice.',
          cond: { minHp: 14 },
          effects: [{ op: 'lose_hp', amount: 10 }, { op: 'upgrade_card', amount: 1, random: false }],
          result: 'Your hand cramps and bleeds, but every practiced stroke sharpens what you already know.'
        }
      ]
    },
    {
      id: 'eb_bone_peddler', name: 'The Bone Peddler', act: [1], icon: '🧴',
      text: "A hunched peddler sets out bottles of murky liquid on a cart pulled by a skeletal mule. \"Potions for the living,\" he wheezes, \"and for the not-quite-living, which is a discount.\" His eyes travel over your coin pouch, then your sleeve.",
      choices: [
        {
          label: '[Buy a flask] Lose 30 gold. Gain a random potion.',
          cond: { minGold: 30 },
          effects: [{ op: 'gold', amount: -30 }, { op: 'add_potion', potion: 'random' }],
          result: 'The flask is warm and faintly sticky, and it sloshes with a purpose of its own.'
        },
        {
          label: '[Trade a memory] Remove a card of your choice. Heal 8 HP.',
          effects: [{ op: 'remove_card', amount: 1 }, { op: 'heal', amount: 8 }],
          result: 'He takes the card with a grin and gives you a sip of something sweet that stops the bleeding.'
        },
        {
          label: '[Haggle] Gain 15 gold. Lose 4 max HP.',
          effects: [{ op: 'gold', amount: 15 }, { op: 'max_hp', amount: -4 }],
          result: 'He spits on his scale and counts out coins, grumbling that the mule will go hungry.'
        }
      ]
    },

    // ============ ACT 2: THE DROWNED CITY ============
    {
      id: 'eb_sunken_bazaar', name: 'The Sunken Bazaar', act: [2], icon: '🐟',
      text: "The old market floor lies under three fathoms of green water, its stalls still standing like drowned stage sets. Silver fish swim through open crates, and a vendor with a lantern for a head calls prices through the murk. Everything you could want is for sale, if you can pay.",
      choices: [
        {
          label: '[Buy a sealed relic] Lose 40 gold. Gain a random uncommon relic.',
          cond: { minGold: 40 },
          effects: [{ op: 'gold', amount: -40 }, { op: 'add_relic', relic: 'random', rarity: 'uncommon' }],
          result: 'The sealed box opens with a sigh of bubbles, revealing something that ticks softly.'
        },
        {
          label: '[Pick the pockets] Gain 35 gold. Gain Shame, a curse.',
          effects: [{ op: 'gold', amount: 35 }, { op: 'add_card', card: 'curse_shame' }],
          result: 'The vendor is too busy calling prices to notice the purse, but the fish do.'
        },
        {
          label: '[Walk on] Nothing happens.',
          effects: [],
          result: 'The lantern-headed vendor calls a final price after you, and it sounds like a warning.'
        }
      ]
    },
    {
      id: 'eb_siren_chorus', name: 'The Siren Chorus', act: [2], icon: '🧜',
      text: "Sirens sing from the balconies of a flooded opera house, their voices low and warm enough to fold you into sleep. The melody is familiar, like someone calling your name from home. Water laps at the stairs and rises with each verse.",
      choices: [
        {
          label: '[Follow the song] Gain a random rare card. Gain Doubt, a curse.',
          effects: [{ op: 'add_card', card: 'random', rarity: 'rare' }, { op: 'add_card', card: 'curse_doubt' }],
          result: 'The chorus fades into a single line, and a rare card surfaces from the tide. Whether you can trust your own name is less certain.'
        },
        {
          label: '[Plug your ears] Heal 8 HP.',
          effects: [{ op: 'heal', amount: 8 }],
          result: 'The wax keeps the song out, and your cuts close while the water slowly falls.'
        },
        {
          label: '[Sing back] Lose 12 HP. Upgrade a card of your choice.',
          cond: { minHp: 14 },
          effects: [{ op: 'lose_hp', amount: 12 }, { op: 'upgrade_card', amount: 1, random: false }],
          result: 'Your voice cracks against theirs and breaks something open, and your technique rings truer for it.'
        }
      ]
    },
    {
      id: 'eb_clockwork_spire', name: 'The Clockwork Spire', act: [2], icon: '🕰️',
      text: "A tower of brass clockwork rises out of the flood, its gears turning in water that should have stopped them long ago. Every face on the dial shows a different hour. A lever at the base is labeled, in careful script, DO NOT WIND.",
      choices: [
        {
          label: '[Wind the mainspring] Gain 6 max HP. Gain Clumsy, a curse.',
          effects: [{ op: 'max_hp', amount: 6 }, { op: 'add_card', card: 'curse_clumsy' }],
          result: 'The spring coils tight, and your heart keeps time with it, stronger and a little off-beat.'
        },
        {
          label: '[Pull a gear free] Lose 10 HP. Gain a random uncommon relic.',
          cond: { minHp: 12 },
          effects: [{ op: 'lose_hp', amount: 10 }, { op: 'add_relic', relic: 'random', rarity: 'uncommon' }],
          result: 'The gear bites your palm, then ticks happily in your hand.'
        },
        {
          label: '[Reset the hands] Transform a card of your choice.',
          effects: [{ op: 'transform_card', amount: 1, random: false }],
          result: 'The hands spin backward, and the card you offered is no longer the one you knew.'
        },
        {
          label: '[Leave it be] Nothing happens.',
          effects: [],
          result: 'Somewhere above you, a bell strikes an hour that has not yet arrived.'
        }
      ]
    },
    {
      id: 'eb_plague_doctor', name: 'The Plague Doctor', act: [2], icon: '🩺',
      text: "A plague doctor in a beaked mask waits at a drowned chapel door, holding a jar of pale salve. \"The rot follows the water,\" he says through the mask. \"I can take it from you, for a price, or you can keep it and see how long your skin holds.\" His gloves drip.",
      choices: [
        {
          label: '[Accept the salve] Heal 25 HP. Gain Decay, a curse.',
          effects: [{ op: 'heal', amount: 25 }, { op: 'add_card', card: 'curse_decay' }],
          result: 'The salve cools your wounds and the rot retreats, but it leaves a little something behind.'
        },
        {
          label: '[Pay 30 gold] Remove a card of your choice.',
          cond: { minGold: 30 },
          effects: [{ op: 'gold', amount: -30 }, { op: 'remove_card', amount: 1 }],
          result: 'He takes the coins, tilts his mask toward your deck, and pulls one card out of it like a splinter.'
        },
        {
          label: '[Sell your curse] Remove a Curse from your deck. Gain 20 gold.',
          cond: { hasCardType: 'curse' },
          effects: [{ op: 'remove_card', amount: 1, type: 'curse' }, { op: 'gold', amount: 20 }],
          result: 'He lifts the rotten card in tongs, inspects it with delight, and pays you for it as if it were valuable.'
        },
        {
          label: '[Refuse] Lose 5 max HP.',
          effects: [{ op: 'max_hp', amount: -5 }],
          result: 'You turn away, and the rot sinks into your bones. You will not be quite as sturdy from now on.'
        }
      ]
    },
    {
      id: 'eb_flooded_athenaeum', name: 'The Flooded Athenaeum', act: [2], icon: '📚',
      text: "Books drift in soggy heaps across the reading room of a sunken library, their pages swollen into strange shapes. Ink runs in slow rivers across the tables. One folio is still dry and sealed in wax, and something inside it is murmuring.",
      choices: [
        {
          label: '[Read the sealed folio] Gain a random rare card. Gain Pain, a curse.',
          effects: [{ op: 'add_card', card: 'random', rarity: 'rare' }, { op: 'add_card', card: 'curse_pain' }],
          result: 'Words unspool from the page and knot themselves into your technique, and a headache follows.'
        },
        {
          label: '[Pocket the ink] Gain a random potion.',
          effects: [{ op: 'add_potion', potion: 'random' }],
          result: 'The ink is cold and faintly glowing, and it fizzes when you cap it.'
        },
        {
          label: '[Sell the atlas] Gain 45 gold.',
          effects: [{ op: 'gold', amount: 45 }],
          result: 'A collector in a rowboat buys the waterlogged atlas without asking where it came from.'
        }
      ]
    },
    {
      id: 'eb_ferryman', name: 'The Ferryman', act: [2], icon: '🚣',
      text: "A ferryman poles a crooked gondola through the flooded avenues, his lantern hung on a hook shaped like a skeletal hand. He asks no questions and names one price for the crossing. The water beneath the boat is very dark, and it is looking up at you.",
      choices: [
        {
          label: '[Pay the fare] Lose 20 gold. Heal 15 HP.',
          cond: { minGold: 20 },
          effects: [{ op: 'gold', amount: -20 }, { op: 'heal', amount: 15 }],
          result: 'The ferryman rows in silence, and the wounds stop aching by the time you reach the far stairs.'
        },
        {
          label: '[Swim instead] Lose 15 HP. Gain 25 gold.',
          cond: { minHp: 20 },
          effects: [{ op: 'lose_hp', amount: 15 }, { op: 'gold', amount: 25 }],
          result: 'The current drags you under for a long moment, but a purse of coins from a wreck rolls ashore beside you.'
        },
        {
          label: '[Stay on the boat] Nothing happens.',
          effects: [],
          result: 'You ride the whole route in silence, and the ferryman nods as if you passed some test.'
        }
      ]
    },
    {
      id: 'eb_quarantine_gate', name: 'The Quarantine Gate', act: [2], icon: '🚧',
      text: "An iron checkpoint blocks the bridge, and masked guards stamp every traveler with a black seal. A sign reads NO ONE PASSES WHO IS SICK. The guard eyes your wounds with polite suspicion and reaches for his ledger.",
      choices: [
        {
          label: '[Bribe the guard] Lose 30 gold. Gain a random potion.',
          cond: { minGold: 30 },
          effects: [{ op: 'gold', amount: -30 }, { op: 'add_potion', potion: 'random' }],
          result: 'The guard swings the gate open and presses a stoppered vial into your hand, promising it is medicine.'
        },
        {
          label: '[Crawl through the sewers] Lose 10 HP. Gain a random uncommon card.',
          cond: { minHp: 14 },
          effects: [{ op: 'lose_hp', amount: 10 }, { op: 'add_card', card: 'random', rarity: 'uncommon' }],
          result: 'The sewers are sour and cold, but the passage brings you past the gate and into a storeroom with a card on the shelf.'
        },
        {
          label: '[Wait for the shift change] Heal 6 HP.',
          effects: [{ op: 'heal', amount: 6 }],
          result: 'You sit under a dripping awning until the bell rings and the gate lifts for the next shift.'
        }
      ]
    },
    {
      id: 'eb_broken_automaton', name: 'The Broken Automaton', act: [2], icon: '🤖',
      text: "A brass automaton lies on its side in a flooded workshop, one arm still twitching and its chest opened to show a pulsing clockwork heart. Its eye lenses flicker to life as you approach. Its voice, like a sad phonograph, asks you to please finish the task.",
      choices: [
        {
          label: '[Reprogram it] Transform a card of your choice.',
          effects: [{ op: 'transform_card', amount: 1, random: false }],
          result: 'The automaton clicks through a long list of instructions, and your card is quietly rewritten to match.'
        },
        {
          label: '[Pry out its gears] Lose 10 HP. Gain 35 gold.',
          cond: { minHp: 12 },
          effects: [{ op: 'lose_hp', amount: 10 }, { op: 'gold', amount: 35 }],
          result: 'Its arm snaps at your knuckles, but the gears are worth a fair sum of coin.'
        },
        {
          label: '[Let it rest] Heal 5 HP.',
          effects: [{ op: 'heal', amount: 5 }],
          result: 'The automaton lets out a long hiss of steam and goes still. Your cuts close a little.'
        }
      ]
    },
    {
      id: 'eb_undercurrent', name: 'The Undercurrent', act: [2], icon: '🌊',
      text: "A slow whirlpool turns at the center of the drowned square, dragging the bright shards of a broken crown round and round. Faces drift up through its depths, smiling and patient. The water here is warm, and it offers you a choice of what to lose.",
      choices: [
        {
          label: '[Toss in gold] Lose 50 gold. Gain a random rare relic.',
          cond: { minGold: 50 },
          effects: [{ op: 'gold', amount: -50 }, { op: 'add_relic', relic: 'random', rarity: 'rare' }],
          result: 'The whirlpool drinks the coins and spits out a relic, dripping and smelling of salt.'
        },
        {
          label: '[Dive in] Lose 18 HP. Gain a random uncommon card.',
          cond: { minHp: 22 },
          effects: [{ op: 'lose_hp', amount: 18 }, { op: 'add_card', card: 'random', rarity: 'uncommon' }],
          result: 'The current pulls you under and returns you, gasping, with a card clenched in your fist.'
        },
        {
          label: '[Float with the current] Gain a random potion. Lose 4 max HP.',
          effects: [{ op: 'add_potion', potion: 'random' }, { op: 'max_hp', amount: -4 }],
          result: 'You drift in a slow loop until a sealed vial bobs against your hand, and your reflection in the water looks thinner.'
        }
      ]
    },

    // ============ ACT 3: THE DUSKSPIRE SUMMIT ============
    {
      id: 'eb_void_rift', name: 'The Void Seam', act: [3], icon: '🌀',
      text: "A seam of nothing hangs in the air above the summit path, its edges crackling with violet light. Through it you glimpse rows of unfinished towers under a sky of unfinished stars. The rift breathes, and the wind leans toward it.",
      choices: [
        {
          label: '[Reach through] Lose 12 HP. Gain a random rare card.',
          cond: { minHp: 16 },
          effects: [{ op: 'lose_hp', amount: 12 }, { op: 'add_card', card: 'random', rarity: 'rare' }],
          result: 'Your hand comes back cold, holding something that was never meant to exist in this world.'
        },
        {
          label: '[Feed it a card] Remove a card of your choice. Gain 10 max HP.',
          effects: [{ op: 'remove_card', amount: 1 }, { op: 'max_hp', amount: 10 }],
          result: 'The rift takes the card without a sound and grows a little more solid in return. Your own body feels steadier.'
        },
        {
          label: '[Step back] Nothing happens.',
          effects: [],
          result: 'The seam closes slowly, like a mouth tasting the air.'
        }
      ]
    },
    {
      id: 'eb_fallen_seraph', name: 'The Fallen Seraph', act: [3], icon: '👼',
      text: "A seraph lies broken in a field of white ash, one wing folded beneath her and the other torn to the bone. Her halo has cracked, and light pours from the fracture in slow, sorrowful beats. She lifts one hand toward you and whispers that she can still give one thing.",
      choices: [
        {
          label: '[Take a feather] Lose 10 max HP. Gain a random uncommon relic.',
          effects: [{ op: 'max_hp', amount: -10 }, { op: 'add_relic', relic: 'random', rarity: 'uncommon' }],
          result: 'The feather is warm and weightless, and it lodges in your chest, where it sings.'
        },
        {
          label: '[Drink her light] Heal 25 HP. Gain Shame, a curse.',
          effects: [{ op: 'heal', amount: 25 }, { op: 'add_card', card: 'curse_shame' }],
          result: 'The light pours into your wounds like honey, and then you feel the shame of having taken it.'
        },
        {
          label: '[Break her halo] Gain 60 gold. Gain Regret, a curse.',
          effects: [{ op: 'gold', amount: 60 }, { op: 'add_card', card: 'curse_regret' }],
          result: 'The halo shatters into bright coins that scorch your palms, and you will remember her face.'
        }
      ]
    },
    {
      id: 'eb_storm_wall', name: 'The Storm Wall', act: [3], icon: '⛈️',
      text: "A wall of storm stands across the summit stair, black clouds stitched through with lightning that strikes the stone in neat, deliberate lines. The thunder counts down from ten. Between the bolts there are gaps that might be crossed, if you are fast or foolish.",
      choices: [
        {
          label: '[Ride the gale] 50%: gain a random rare card, or lose 10 HP.',
          cond: { minHp: 12 },
          effects: [{
            op: 'chance', p: 0.5,
            then: [{ op: 'add_card', card: 'random', rarity: 'rare' }],
            else: [{ op: 'lose_hp', amount: 10 }],
            thenResult: 'You skim the gap between bolts, and a card drops out of the cloud into your hand.',
            elseResult: 'A bolt clips your shoulder, and the thunder laughs at you.'
          }],
          result: 'The storm has made its choice.'
        },
        {
          label: '[Shelter in a niche] Heal 10 HP.',
          effects: [{ op: 'heal', amount: 10 }],
          result: 'You crouch beneath a carved angel wing and wait while your heart slows.'
        },
        {
          label: '[Charge through] Lose 20 HP. Upgrade two cards of your choice.',
          cond: { minHp: 25 },
          effects: [{ op: 'lose_hp', amount: 20 }, { op: 'upgrade_card', amount: 2, random: false }],
          result: 'The lightning finds you and tries to take you back, but every blow sharpens what you carry.'
        }
      ]
    },
    {
      id: 'eb_time_eddy', name: 'The Time Eddy', act: [3], icon: '⌛',
      text: "The air around a shattered sundial bends like heat over stone, and the shadows fall in the wrong direction. You catch a glimpse of your own footprints running backward up the stair. A voice from the eddy asks whether you would rather hurry or stop.",
      choices: [
        {
          label: '[Rewind the moment] Heal 15 HP. Gain Decay, a curse.',
          effects: [{ op: 'heal', amount: 15 }, { op: 'add_card', card: 'curse_decay' }],
          result: 'The wounds unmake themselves, and something in the marrow ages slightly the wrong way.'
        },
        {
          label: '[Hasten] Lose 8 HP. Upgrade two cards of your choice.',
          cond: { minHp: 10 },
          effects: [{ op: 'lose_hp', amount: 8 }, { op: 'upgrade_card', amount: 2, random: false }],
          result: 'Time skips ahead, and your practice arrives in a single breath.'
        },
        {
          label: '[Step out] Nothing happens.',
          effects: [],
          result: 'The shadows fall back into their own shape, and the sundial stops humming.'
        }
      ]
    },
    {
      id: 'eb_chronicler_ghost', name: 'The Chronicler', act: [3], icon: '👻',
      text: "A translucent scholar sits at a lectern that is not there, writing a history that is still happening. Each page turns to show a battle you have not yet fought. He looks up, pleased, and holds out a quill.",
      choices: [
        {
          label: '[Sign in blood] Gain a random potion and 30 gold. Lose 6 max HP.',
          effects: [{ op: 'add_potion', potion: 'random' }, { op: 'gold', amount: 30 }, { op: 'max_hp', amount: -6 }],
          result: 'The quill drinks a little of you, and a flask and a purse appear on the lectern.'
        },
        {
          label: '[Read ahead] Upgrade a card of your choice. Gain Doubt, a curse.',
          effects: [{ op: 'upgrade_card', amount: 1, random: false }, { op: 'add_card', card: 'curse_doubt' }],
          result: 'The page shows a battle you will win if you train, and its ending leaves a small question inside you.'
        },
        {
          label: '[Decline the quill] Nothing happens.',
          effects: [],
          result: 'The ghost sighs and writes your refusal in the margin, in a neat and cold hand.'
        }
      ]
    },
    {
      id: 'eb_angel_sepulcher', name: 'The Angel Sepulcher', act: [3], icon: '🪦',
      text: "Deep beneath the summit, a tomb of white marble holds a warrior angel lying with a sword across her chest. Golden dust drifts from her armor. The blade is still bright, and when you touch the hilt the chamber begins to tremble.",
      choices: [
        {
          label: '[Take the sword] Lose 15 HP. Gain a random uncommon relic.',
          cond: { minHp: 20 },
          effects: [{ op: 'lose_hp', amount: 15 }, { op: 'add_relic', relic: 'random', rarity: 'uncommon' }],
          result: 'The blade comes free with a clean ring, and the tomb stops shaking as if relieved.'
        },
        {
          label: '[Take the gold] Gain 70 gold. Gain Pain, a curse.',
          effects: [{ op: 'gold', amount: 70 }, { op: 'add_card', card: 'curse_pain' }],
          result: 'Coins pour from the angel cracked gauntlets, and the ache takes root in you as the chamber sighs.'
        },
        {
          label: '[Pay respects] Heal 10 HP.',
          effects: [{ op: 'heal', amount: 10 }],
          result: 'You fold her hands over the sword again, and a little light returns to her face.'
        }
      ]
    },
    {
      id: 'eb_summit_forge', name: 'The Summit Forge', act: [3], icon: '🔥',
      text: "A forge of black iron glows on the summit terrace, fed by a light that comes from nowhere you can see. The smith is a tall, faceless figure in a leather apron. \"Bring me what you wish to change,\" she says. \"Everything has a cost, and I am only the hammer.\"",
      choices: [
        {
          label: '[Temper a card] Lose 6 HP. Upgrade a card of your choice.',
          cond: { minHp: 10 },
          effects: [{ op: 'lose_hp', amount: 6 }, { op: 'upgrade_card', amount: 1, random: false }],
          result: 'The metal sings as it cools, and the card you chose holds a sharper edge.'
        },
        {
          label: '[Reforge a card] Transform a card of your choice.',
          effects: [{ op: 'transform_card', amount: 1, random: false }],
          result: 'The smith folds the card into her fire and hammers it into something new.'
        },
        {
          label: '[Quench your wounds] Lose 40 gold. Heal 20 HP.',
          cond: { minGold: 40 },
          effects: [{ op: 'gold', amount: -40 }, { op: 'heal', amount: 20 }],
          result: 'Your bruises steam away in the cooling water, and the smith turns her back on the coins.'
        }
      ]
    },
    {
      id: 'eb_rift_merchant', name: 'The Rift Merchant', act: [3], icon: '🛒',
      text: "A merchant stands between two broken pillars, wrapped in a suit of fitted mirrors that show nothing but night. His wares float in the air around him: pale cards, bottled storms, ticking hourglasses. \"Everything here is priced in something you cannot spare,\" he says kindly.",
      choices: [
        {
          label: '[Buy a rare card] Lose 60 gold. Gain a random rare card.',
          cond: { minGold: 60 },
          effects: [{ op: 'gold', amount: -60 }, { op: 'add_card', card: 'random', rarity: 'rare' }],
          result: 'The card unfolds in your hand, unmarked and faintly humming.'
        },
        {
          label: '[Trade a card] Remove a card of your choice. Gain 40 gold.',
          effects: [{ op: 'remove_card', amount: 1 }, { op: 'gold', amount: 40 }],
          result: 'He weighs the card in his mirrored palm, then pays you its worth in silver.'
        },
        {
          label: '[Trade blood] Lose 15 HP. Gain a random potion.',
          cond: { minHp: 20 },
          effects: [{ op: 'lose_hp', amount: 15 }, { op: 'add_potion', potion: 'random' }],
          result: 'He catches the blood in a crystal vial and hands you a flask of something cold and clear.'
        }
      ]
    },
    {
      id: 'eb_echoing_throne', name: 'The Echoing Throne', act: [3], icon: '👑',
      text: "At the highest point of the summit stands an empty throne, carved from a single block of onyx. Its arms are worn smooth by a thousand hands, and the air tastes of ozone and old prayer. A crown rests on the seat, but there is no one to wear it.",
      choices: [
        {
          label: '[Sit] Gain 12 max HP. Gain Pain, a curse.',
          effects: [{ op: 'max_hp', amount: 12 }, { op: 'add_card', card: 'curse_pain' }],
          result: 'The throne accepts you, and your body grows broader while an ache spreads through every joint.'
        },
        {
          label: '[Take the crown] Lose 10 HP. Gain 80 gold.',
          cond: { minHp: 12 },
          effects: [{ op: 'lose_hp', amount: 10 }, { op: 'gold', amount: 80 }],
          result: 'The crown is heavy with gold, and the throne rumbles as you lift it.'
        },
        {
          label: '[Kneel] Heal 15 HP. Upgrade a card of your choice.',
          effects: [{ op: 'heal', amount: 15 }, { op: 'upgrade_card', amount: 1, random: false }],
          result: 'The throne warmth enters you and teaches you a little more about what you already carry.'
        }
      ]
    }
  ];

  EVENTS_B.forEach((def) => DS.defineEvent(def));
})();
