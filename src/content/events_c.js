(function () {
  'use strict';
  const DS = (globalThis.DS = globalThis.DS || {});

  // Second event set (ids prefixed ec_): 12 act-any events, 6 each for acts 1, 2 and 3.
  // Recurring characters: Mortimer Gallowe (debt collector), Ysolde Thorn (rival climber),
  // Pell (talking skull). Fight choices either name a real encounter of that act or use
  // 'random_normal' / 'random_elite'; the reward sits in the label and in the effects placed before the fight op.

  const EVENTS_C = [
    // ======================================================================= ACT ANY

    {
      id: 'ec_debt_collector', name: 'The Debt Collector', act: 'any', icon: '📒',
      text: 'A man in a grey coat rises from the bench beside the stair, as though he has been waiting since before you were born. He opens a ledger bound in something that was once skin. "Mortimer Gallowe," he says, tapping a page with a finger like a pale hook. "You owe the Lantern Company forty gold, plus interest, plus the interest on the interest. I am not cruel. I am only punctual."',
      choices: [
        {
          label: '[Pay 40 gold] Lose 40 gold. The debt is settled.',
          cond: { minGold: 40 },
          effects: [{ op: 'gold', amount: -40 }],
          result: 'Gallowe counts each coin twice, writes a neat line in the ledger and tips his hat. "Until next time, friend."'
        },
        {
          label: '[Pay in blood] Lose 12 HP. The debt is settled.',
          cond: { minHp: 16 },
          effects: [{ op: 'lose_hp', amount: 12 }],
          result: 'He draws a single drop from your palm with a silver pen and calls the account closed.'
        },
        {
          label: '[Sign the ledger] Gain 70 gold. Add Regret, a curse, to your deck.',
          effects: [{ op: 'gold', amount: 70 }, { op: 'add_card', card: 'curse_regret' }],
          result: 'The ink is cold and smells of cellar damp. He pays the sum he promised, and something behind your ribs sighs.'
        },
        {
          label: '[Refuse] Gain 15 gold. Fight a random normal enemy, his hired bruisers.',
          effects: [{ op: 'gold', amount: 15 }, { op: 'fight', encounter: 'random_normal' }],
          result: 'He closes the ledger with a soft clap. "Then the collection is yours to lose."'
        }
      ]
    },

    {
      id: 'ec_rival_climber', name: 'The Rival Climber', act: 'any', icon: '🧗',
      text: 'Someone is already halfway up the spiral stair when you reach the landing. She turns, wind-burned and grinning, a coil of rope over one shoulder and a hunting knife at her hip. "Ysolde Thorn," she says. "Skip the pleasantries, climber. Only the summit gets remembered, and I plan to be the one." She is pretending not to look at your pack.',
      choices: [
        {
          label: '[Share the route] Heal 8 HP. Add a random common card to your deck.',
          effects: [{ op: 'heal', amount: 8 }, { op: 'add_card', card: 'random', rarity: 'common' }],
          result: 'She sketches a shortcut on the wall with a burnt stick. "Do not thank me. I will be rich when you are dead."'
        },
        {
          label: '[Race her] 50%: gain a random uncommon relic. Otherwise lose 10 HP.',
          cond: { minHp: 15 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'add_relic', relic: 'random', rarity: 'uncommon' }],
              else: [{ op: 'lose_hp', amount: 10 }],
              thenResult: 'Ysolde curses in three languages and hands you the relic she was saving for herself.',
              elseResult: 'She reaches the next landing first and kicks loose gravel over your head.'
            }
          ],
          result: 'The race is short, brutal and not quite fair.'
        },
        {
          label: '[Ambush her escort] Gain 30 gold. Fight a random elite enemy.',
          effects: [{ op: 'gold', amount: 30 }, { op: 'fight', encounter: 'random_elite' }],
          result: 'Two hired bodyguards step out from behind the bend, and they do not look like they were paid to talk.'
        },
        {
          label: '[Let her pass] Nothing happens.',
          effects: [],
          result: 'She passes, grinning, and chalks a fresh arrow on the wall pointing up the stair.'
        }
      ]
    },

    {
      id: 'ec_talking_skull', name: 'The Talking Skull', act: 'any', icon: '💀',
      text: 'A human skull sits in a niche in the wall, its jaw propped open by a shard of mirror. As you pass, it says: "Oh good, a customer. My name is Pell, and I am the only honest thing you will meet in this tower. Everyone else is selling something." Its eye sockets glitter with a faint blue light.',
      choices: [
        {
          label: '[Pay Pell\'s toll] Lose 20 gold. Add a random potion to your belt.',
          cond: { minGold: 20 },
          effects: [{ op: 'gold', amount: -20 }, { op: 'add_potion', potion: 'random' }],
          result: 'Pell rattles with delight. "The good kind of coin. Here, take something that fizzes."'
        },
        {
          label: '[Trust the skull] 50%: add a random rare card to your deck. Otherwise add Doubt, a curse.',
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'add_card', card: 'random', rarity: 'rare' }],
              else: [{ op: 'add_card', card: 'curse_doubt' }],
              thenResult: 'Pell grins with every tooth it has left and slides a card out of the wall.',
              elseResult: 'Pell laughs until the crack in its skull seems to widen, and Doubt settles into your deck.'
            }
          ],
          result: 'The skull tilts, considering you with its glowing eyes.'
        },
        {
          label: '[Silence it] Gain 10 gold. Fight a random normal enemy, drawn by the shriek.',
          effects: [{ op: 'gold', amount: 10 }, { op: 'fight', encounter: 'random_normal' }],
          result: 'Its jaw clacks shut mid-word, and then the shrieking starts from every niche in the corridor.'
        },
        {
          label: '[Walk on] Nothing happens.',
          effects: [],
          result: '"Coward," it says warmly. "I shall remember you fondly."'
        }
      ]
    },

    {
      id: 'ec_penitent_scribe', name: 'The Penitent Scribe', act: 'any', icon: '🖋️',
      text: 'At a trestle lined with blank parchment, a scribe in a robe of ash-grey wool scrapes ink off his fingers with a pumice stone. "I erase what the dark writes on people," he says quietly. "Sins, mostly. Wounds that will not close. I can take one back from you, if you can bear to lose what it has cost you."',
      choices: [
        {
          label: '[Erase a curse] Remove a Curse from your deck (you choose).',
          cond: { hasCardType: 'curse' },
          effects: [{ op: 'remove_card', amount: 1, type: 'curse' }],
          result: 'You hand him the card. The ink dissolves into the page and leaves a clean, pale rectangle behind.'
        },
        {
          label: '[Confess] Lose 8 HP. Remove 1 card from your deck (you choose).',
          cond: { minHp: 12 },
          effects: [{ op: 'lose_hp', amount: 8 }, { op: 'remove_card', amount: 1 }],
          result: 'He listens with his eyes closed, then asks which memory you intend to carry.'
        },
        {
          label: '[Copy the script] 60%: upgrade a random card. Otherwise lose 5 HP.',
          cond: { minHp: 8 },
          effects: [
            {
              op: 'chance',
              p: 0.6,
              then: [{ op: 'upgrade_card', amount: 1, random: true }],
              else: [{ op: 'lose_hp', amount: 5 }],
              thenResult: 'His quill moves faster than you can follow, and the page you carry feels stronger.',
              elseResult: 'The nib slips and cuts your thumb. He apologises in a whisper.'
            }
          ],
          result: 'He guides your hand over the parchment and watches the ink settle.'
        },
        {
          label: '[Walk on] Nothing happens.',
          effects: [],
          result: 'He returns to his scraping. The pumice makes a sound like teeth.'
        }
      ]
    },

    {
      id: 'ec_bonfire_regrets', name: 'The Bonfire of Regrets', act: 'any', icon: '🔥',
      text: 'A bonfire crackles inside a ring of blackened stones. Nothing about it is warm; the flames lean toward you, hungry. Someone has scratched names into the stones: names of cards, of wounds, of promises. A rusted sign reads FEED THE FIRE, WARM YOUR HANDS, OR PASS.',
      choices: [
        {
          label: '[Feed the fire] Remove 1 card from your deck (you choose). Heal 6 HP.',
          effects: [{ op: 'remove_card', amount: 1 }, { op: 'heal', amount: 6 }],
          result: 'The flames take the card with a satisfied roar and leave a warm feeling in your chest.'
        },
        {
          label: '[Warm your hands] 50%: upgrade a random card. Otherwise lose 6 HP.',
          cond: { minHp: 10 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'upgrade_card', amount: 1, random: true }],
              else: [{ op: 'lose_hp', amount: 6 }],
              thenResult: 'The heat sinks into the grain of a card, and its ink brightens.',
              elseResult: 'The fire spits at you and your palms blister.'
            }
          ],
          result: 'The fire leans toward you, as if it is listening.'
        },
        {
          label: '[Gather an ember] Lose 4 HP. Gain 15 gold.',
          cond: { minHp: 8 },
          effects: [{ op: 'lose_hp', amount: 4 }, { op: 'gold', amount: 15 }],
          result: 'The ember is hot as a freshly struck coin, and it leaves gold-coloured soot on your fingers.'
        },
        {
          label: '[Pass] Nothing happens.',
          effects: [],
          result: 'The flames sink behind you, disappointed.'
        }
      ]
    },

    {
      id: 'ec_gallows_pawnbroker', name: 'The Gallows Pawnbroker', act: 'any', icon: '⚖️',
      text: 'A pawnbroker has hung a small scale from a gibbet beam, and the pans sway in the draught. "I take things," she says, "and I pay you their value. Nothing more honest in the dark." Her tags are written in four different hands, and every one of them has your name on it, though you have never met her.',
      choices: [
        {
          label: '[Pawn a card] Remove 1 card from your deck (you choose). Gain 40 gold.',
          effects: [{ op: 'remove_card', amount: 1 }, { op: 'gold', amount: 40 }],
          result: 'She weighs the card in her palm and counts out coins that still smell of someone else\'s hands.'
        },
        {
          label: '[Sell your health] Lose 10 HP. Gain 30 gold.',
          cond: { minHp: 15 },
          effects: [{ op: 'lose_hp', amount: 10 }, { op: 'gold', amount: 30 }],
          result: 'She draws a small glass of your blood, holds it to the light and nods.'
        },
        {
          label: '[Buy a relic] Lose 60 gold. Gain a random common relic.',
          cond: { minGold: 60 },
          effects: [{ op: 'gold', amount: -60 }, { op: 'add_relic', relic: 'random', rarity: 'common' }],
          result: 'The relic hangs from her scale on a chain, and it hums when you lift it.'
        },
        {
          label: '[Leave] Nothing happens.',
          effects: [],
          result: 'Her scales tip gently, as if they have weighed you already and found the price fair.'
        }
      ]
    },

    {
      id: 'ec_weeping_coin', name: 'The Weeping Coin', act: 'any', icon: '🪙',
      text: 'A silver coin rests in the centre of a dry fountain, and it is weeping. Each drop rolls to the edge of its face and falls away into nothing. When you lift it, the coin is warm, and a small voice inside it asks: "Heads, you keep what you hold. Tails, you pay what you owe. Which do you want, traveller?"',
      choices: [
        {
          label: '[Flip it] 50%: gain 40 gold. Otherwise lose 10 HP.',
          cond: { minHp: 12 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'gold', amount: 40 }],
              else: [{ op: 'lose_hp', amount: 10 }],
              thenResult: 'The coin lands heads and the fountain gurgles in approval.',
              elseResult: 'Tails. The coin laughs, and the fountain takes its due in blood.'
            }
          ],
          result: 'It spins in the air far longer than a coin should.'
        },
        {
          label: '[Stake your purse] 40%: double your gold. Otherwise lose all your gold.',
          cond: { minGold: 20 },
          effects: [
            {
              op: 'chance',
              p: 0.4,
              then: [{ op: 'gold', amount: { v: 'gold' } }],
              else: [{ op: 'gold', amount: { v: 'gold', mul: -1 } }],
              thenResult: 'The coin sings, and your purse swells with matching silver.',
              elseResult: 'The coin sinks into the dry fountain and takes every coin you own with it.'
            }
          ],
          result: 'The weeping stops for one long heartbeat while the coin decides.'
        },
        {
          label: '[Pocket it] Gain 20 gold. Add Doubt, a curse, to your deck.',
          effects: [{ op: 'gold', amount: 20 }, { op: 'add_card', card: 'curse_doubt' }],
          result: 'It is warm in your pocket and whispers questions all the way to the next room.'
        },
        {
          label: '[Leave it] Nothing happens.',
          effects: [],
          result: 'The coin falls silent, its last tear rolling off the edge of its face.'
        }
      ]
    },

    {
      id: 'ec_collapsed_stair', name: 'The Collapsed Stair', act: 'any', icon: '🪨',
      text: 'The stair ends in a wall of tumbled stone. Through a gap the size of a fist you can see a glow below and hear voices arguing. A narrow route leads through a crack beside the rubble, but the stones above it are shifting, and you suspect they will not hold for long.',
      choices: [
        {
          label: '[Crawl through the crack] Lose 6 HP. Gain 20 gold.',
          cond: { minHp: 10 },
          effects: [{ op: 'lose_hp', amount: 6 }, { op: 'gold', amount: 20 }],
          result: 'You squeeze through on your belly, scraping your ribs raw, and find a dead man\'s purse on the far side.'
        },
        {
          label: '[Dig through] Gain 10 gold. Fight a random normal enemy in the rubble.',
          effects: [{ op: 'gold', amount: 10 }, { op: 'fight', encounter: 'random_normal' }],
          result: 'The rubble coughs, stands up and comes at you with a shovel.'
        },
        {
          label: '[Wait for the rubble to settle] 50%: add a random common card to your deck. Otherwise lose 4 HP.',
          cond: { minHp: 6 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'add_card', card: 'random', rarity: 'common' }],
              else: [{ op: 'lose_hp', amount: 4 }],
              thenResult: 'When the dust clears, a card lies in a crevice, untouched by the ages.',
              elseResult: 'A stone drops from the ceiling and bounces off your shoulder.'
            }
          ],
          result: 'You wait, one breath at a time, and the dust drifts down around you.'
        },
        {
          label: '[Turn back] Nothing happens.',
          effects: [],
          result: 'The voices below go quiet, as though they heard you decide.'
        }
      ]
    },

    {
      id: 'ec_hung_tailor', name: 'The Hung Tailor', act: 'any', icon: '🧵',
      text: 'A tailor hangs from a rafter by his bootlaces, stitching a long grey coat as he swings. "Every adventurer needs a second skin," he says around a mouthful of thread. "I will sew one in for you. Mind the seams. Some of them are wounds."',
      choices: [
        {
          label: '[Accept the coat] Gain 6 max HP. Add Shame, a curse, to your deck.',
          effects: [{ op: 'max_hp', amount: 6 }, { op: 'add_card', card: 'curse_shame' }],
          result: 'The coat fits perfectly, and the seams close over something you would rather not see.'
        },
        {
          label: '[Ask for a patch] Heal 10 HP. Add Wound, a status card, to your deck.',
          effects: [{ op: 'heal', amount: 10 }, { op: 'add_card', card: 'status_wound' }],
          result: 'He sews the patch with a needle still wet from someone else\'s blood.'
        },
        {
          label: '[Pay for a lining] Lose 40 gold. Upgrade a random card.',
          cond: { minGold: 40 },
          effects: [{ op: 'gold', amount: -40 }, { op: 'upgrade_card', amount: 1, random: true }],
          result: 'Silk lines the coat, and one of your cards grows a little stronger beneath it.'
        },
        {
          label: '[Decline] Nothing happens.',
          effects: [],
          result: 'He shrugs, turns on his rafter and begins sewing a coat for someone else.'
        }
      ]
    },

    {
      id: 'ec_glass_chest', name: 'The Glass Chest', act: 'any', icon: '💎',
      text: 'A chest of cloudy glass sits on a plinth, cradling something that glows like a trapped star. Its lid is fused shut and its surface is crazed with fine cracks. A brass plaque beneath it reads: BREAK ME OR BREAK YOURSELF.',
      choices: [
        {
          label: '[Smash it open] 30%: gain a random rare relic. Otherwise lose 15 HP.',
          cond: { minHp: 20 },
          effects: [
            {
              op: 'chance',
              p: 0.3,
              then: [{ op: 'add_relic', relic: 'random', rarity: 'rare' }],
              else: [{ op: 'lose_hp', amount: 15 }],
              thenResult: 'The glass bursts into a rain of light, and a relic falls warm into your palm.',
              elseResult: 'The shards bite deep, and the light inside goes out with a sigh.'
            }
          ],
          result: 'You raise your arm and bring it down on the glass.'
        },
        {
          label: '[Pry it gently] Gain 20 gold.',
          effects: [{ op: 'gold', amount: 20 }],
          result: 'The lid lifts with a sigh, and a purse of coins slides out of the hollow beneath.'
        },
        {
          label: '[Warm it in your hands] Heal 8 HP.',
          effects: [{ op: 'heal', amount: 8 }],
          result: 'The glow sinks into your fingers and eases the ache in your joints.'
        },
        {
          label: '[Leave it] Nothing happens.',
          effects: [],
          result: 'The plaque is still there, and so is the glow, waiting for someone braver.'
        }
      ]
    },

    {
      id: 'ec_dead_company_banner', name: 'The Banner of the Dead Company', act: 'any', icon: '🚩',
      text: 'A tattered banner is nailed above a row of empty helmets. Its company names have been scratched out one by one, except the last, which is blank and waiting. A voice like sand on stone says: "Enlist, and the dead will march beside you. Refuse, and they will march without you."',
      choices: [
        {
          label: '[Enlist] Add a random uncommon card to your deck. Lose 8 HP.',
          cond: { minHp: 12 },
          effects: [{ op: 'add_card', card: 'random', rarity: 'uncommon' }, { op: 'lose_hp', amount: 8 }],
          result: 'A helmet at your feet clicks shut over nothing and fits you as if it was made for you.'
        },
        {
          label: '[Enlist as captain] Add a random uncommon card to your deck. Fight a random elite enemy.',
          effects: [{ op: 'add_card', card: 'random', rarity: 'uncommon' }, { op: 'fight', encounter: 'random_elite' }],
          result: 'The dead company rises behind you, and their rival captain is waiting at the end of the hall.'
        },
        {
          label: '[Take a helmet] Gain 15 gold. Add Injury, a curse, to your deck.',
          effects: [{ op: 'gold', amount: 15 }, { op: 'add_card', card: 'curse_injury' }],
          result: 'The helmet still has a dented skull beneath it, and the skull grins in the dark.'
        },
        {
          label: '[Refuse] Nothing happens.',
          effects: [],
          result: 'The banner sighs in the draught and settles, one name still unscratched.'
        }
      ]
    },

    {
      id: 'ec_masked_mourners', name: 'The Masked Mourners', act: 'any', icon: '🎭',
      text: 'Mourners in grey masks sing a dirge around a coffin that is still knocking from the inside. They do not stop when you approach. One of them holds out a mask, and another holds out a funeral wreath with a space in it, the exact size of your head.',
      choices: [
        {
          label: '[Join the procession] Lose 10 HP. Gain a random potion.',
          cond: { minHp: 14 },
          effects: [{ op: 'lose_hp', amount: 10 }, { op: 'add_potion', potion: 'random' }],
          result: 'A mask is pressed into your hand, and a small flask is tucked into your sleeve as you walk.'
        },
        {
          label: '[Lift the lid] 50%: gain 60 gold. Otherwise fight a random normal enemy, a corpse thief.',
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'gold', amount: 60 }],
              else: [{ op: 'fight', encounter: 'random_normal' }],
              thenResult: 'The coffin is full of coins instead of a corpse, and the mourners sing a little louder.',
              elseResult: 'The coffin is full of thieves. They wake and climb out with knives drawn.'
            }
          ],
          result: 'You lift the lid and peer inside.'
        },
        {
          label: '[Mourn quietly] Heal 12 HP.',
          effects: [{ op: 'heal', amount: 12 }],
          result: 'You weep without knowing why, and the weeping leaves you lighter than before.'
        },
        {
          label: '[Walk on] Nothing happens.',
          effects: [],
          result: 'The dirge follows you down the stair, one note behind.'
        }
      ]
    },

    // ======================================================================= ACT 1: ASHEN CATACOMBS

    {
      id: 'ec_a1_grave_lantern', name: 'The Grave Lantern', act: [1], icon: '🏮',
      text: 'In a niche of a collapsed tomb, a lantern burns with blue fire on a bed of bones. A set of footprints circles it in the dust, going round and round, as if someone has been walking there for a very long time. The flame leans toward your hand.',
      choices: [
        {
          label: '[Take the lantern] Gain a random common relic. Fight the Grave Robbers.',
          effects: [
            { op: 'add_relic', relic: 'random', rarity: 'common' },
            { op: 'fight', encounter: 'a1_enc_grave_robbers' }
          ],
          result: 'The lantern goes out in your hand, and the robbers climb up out of the dust with shovels.'
        },
        {
          label: '[Snuff the flame] Lose 6 HP. Gain 25 gold.',
          cond: { minHp: 10 },
          effects: [{ op: 'lose_hp', amount: 6 }, { op: 'gold', amount: 25 }],
          result: 'The blue fire hisses into smoke, and a purse of old coins drops from the niche.'
        },
        {
          label: '[Trace the footprints] 50%: add a random uncommon card to your deck. Otherwise lose 10 HP.',
          cond: { minHp: 14 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'add_card', card: 'random', rarity: 'uncommon' }],
              else: [{ op: 'lose_hp', amount: 10 }],
              thenResult: 'The footprints end at a stone, and under it lies a card nobody has claimed in centuries.',
              elseResult: 'The footprints lead in a circle, and you realise, too late, that you were walking them too.'
            }
          ],
          result: 'You follow the tracks around the niche, one step at a time.'
        },
        {
          label: '[Walk on] Nothing happens.',
          effects: [],
          result: 'The lantern watches you go, its flame leaning after you.'
        }
      ]
    },

    {
      id: 'ec_a1_ossuary_contract', name: 'The Warlord\'s Contract', act: [1], icon: '🪦',
      text: 'A warlord of fused bone sits at a table of skulls, sharpening a blade on a whetstone of ground teeth. A contract lies before him, written on leather that was once a man\'s back. "Sign," he rumbles, "and the road will be a battle worth remembering. Refuse, and I will remember you as the one who did not sign."',
      choices: [
        {
          label: '[Sign] Gain 40 gold. Add Pain, a curse, to your deck. Fight the Ossuary Warlord.',
          effects: [
            { op: 'gold', amount: 40 },
            { op: 'add_card', card: 'curse_pain' },
            { op: 'fight', encounter: 'a1_enc_ossuary_warlord' }
          ],
          result: 'The ink is bone dust and blood. He grins through a jaw of teeth and rises to his full height.'
        },
        {
          label: '[Refuse] Gain 10 gold. Fight the Ossuary Warlord anyway.',
          effects: [{ op: 'gold', amount: 10 }, { op: 'fight', encounter: 'a1_enc_ossuary_warlord' }],
          result: 'He tosses the contract into the brazier without looking at it. "Then bleed for your refusal."'
        },
        {
          label: '[Bargain] 50%: remove 1 card of your choice from your deck. Otherwise upgrade a random card.',
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'remove_card', amount: 1 }],
              else: [{ op: 'upgrade_card', amount: 1, random: true }],
              thenResult: 'He shrugs and lets you cut away a weight of your own choosing.',
              elseResult: 'He laughs, runs his blade along one of your cards and hands it back sharper.'
            }
          ],
          result: 'The warlord listens to your terms with the patience of a grave.'
        },
        {
          label: '[Leave] Nothing happens.',
          effects: [],
          result: 'He returns to the whetstone. Somewhere in the crypt, a long bone drum begins to beat.'
        }
      ]
    },

    {
      id: 'ec_a1_cult_confessor', name: 'The Cult Confessor', act: [1], icon: '⛪',
      text: 'A cultist in a hooded robe kneels inside a booth of cracked stone, murmuring prayers through a grate. "Confess," the grate whispers, "and the chanters will forget you exist. Hold your tongue, and they will make you sing with them."',
      choices: [
        {
          label: '[Confess] Lose 10 HP. Remove 1 card from your deck (you choose).',
          cond: { minHp: 15 },
          effects: [{ op: 'lose_hp', amount: 10 }, { op: 'remove_card', amount: 1 }],
          result: 'You say all the things you did not want to say, and something rusted falls from your hands.'
        },
        {
          label: '[Pay absolution] Lose 30 gold. Remove a random card from your deck.',
          cond: { minGold: 30 },
          effects: [{ op: 'gold', amount: -30 }, { op: 'remove_card', amount: 1, random: true }],
          result: 'The grate clicks open just wide enough for the coins, and a card you barely remember dissolves into the dark.'
        },
        {
          label: '[Sing along] Gain 15 gold. Fight the Cult Chanter.',
          effects: [{ op: 'gold', amount: 15 }, { op: 'fight', encounter: 'a1_enc_cult_chanter' }],
          result: 'The chanting rises to a shriek, and a robed figure leaps out of the booth.'
        },
        {
          label: '[Leave] Nothing happens.',
          effects: [],
          result: 'The prayers follow you up the stair, politely, and a little too close.'
        }
      ]
    },

    {
      id: 'ec_a1_mushroom_feast', name: 'The Glowing Caps', act: [1], icon: '🍄',
      text: 'A ring of mushrooms glows softly on the floor, pulsing at a rhythm too slow for any heart. Something has nibbled half of each cap, leaving bite-shaped hollows that weep a thin, sweet fluid. Beneath them, a knot of shroomlings stirs and watches you the way fungus watches rain.',
      choices: [
        {
          label: '[Eat a cap] 50%: heal 15 HP. Otherwise lose 8 HP.',
          cond: { minHp: 10 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'heal', amount: 15 }],
              else: [{ op: 'lose_hp', amount: 8 }],
              thenResult: 'The cap melts on your tongue, and warmth creeps through your limbs.',
              elseResult: 'The cap is bitter, and your stomach turns over violently.'
            }
          ],
          result: 'You pick the least bitten cap and hold it to your lips.'
        },
        {
          label: '[Harvest the caps] Gain 20 gold. Fight the Mushroom Grove.',
          effects: [{ op: 'gold', amount: 20 }, { op: 'fight', encounter: 'a1_enc_mushroom_grove' }],
          result: 'The caps burst in clouds of spores, and the grove turns to face you.'
        },
        {
          label: '[Take a spore pouch] Add a random potion to your belt.',
          effects: [{ op: 'add_potion', potion: 'random' }],
          result: 'The pouch is full of living dust that sparkles when you shake it.'
        },
        {
          label: '[Step around] Nothing happens.',
          effects: [],
          result: 'The shroomlings pulse in unison as you pass, then fall still.'
        }
      ]
    },

    {
      id: 'ec_a1_mural_eyes', name: 'The Mural of Eyes', act: [1], icon: '👁️',
      text: 'Every eye on the mural is open, and each one is painted in the exact shade of your own. A brush rests against the wall beneath it, dripping pale paint. In the corner someone has written in a hurry: IT IS NOT FINISHED. FINISH IT, AND IT WILL FINISH YOU.',
      choices: [
        {
          label: '[Paint over an eye] Transform 1 card of your choice into a random card of your class.',
          effects: [{ op: 'transform_card', amount: 1 }],
          result: 'You cover one eye in grey, and a card in your deck becomes someone else\'s.'
        },
        {
          label: '[Scrape the mural] 50%: upgrade a random card. Otherwise lose 6 HP.',
          cond: { minHp: 10 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'upgrade_card', amount: 1, random: true }],
              else: [{ op: 'lose_hp', amount: 6 }],
              thenResult: 'The plaster flakes away, and a card beneath it is clearer than before.',
              elseResult: 'A painted eye blinks, and a shard of plaster cuts your cheek.'
            }
          ],
          result: 'You scrape at the wall with your fingernails.'
        },
        {
          label: '[Add your own eye] Lose 5 HP. Gain a random common relic.',
          cond: { minHp: 10 },
          effects: [{ op: 'lose_hp', amount: 5 }, { op: 'add_relic', relic: 'random', rarity: 'common' }],
          result: 'You paint your eye and feel it open somewhere behind your own.'
        },
        {
          label: '[Look away] Nothing happens.',
          effects: [],
          result: 'The eyes do not follow you. You are almost certain of it.'
        }
      ]
    },

    {
      id: 'ec_a1_hound_kennel', name: 'The Bone Kennel', act: [1], icon: '🐕',
      text: 'A kennel built from ribs stands at the end of the crypt. The hounds inside have lost their fur and most of their eyes, but they tilt their skulls toward your scent with eager interest. Their keeper\'s collar hangs on a hook: iron, studded with silver coins.',
      choices: [
        {
          label: '[Take the collar] Gain 30 gold. Fight the Bone Hound Pack.',
          effects: [{ op: 'gold', amount: 30 }, { op: 'fight', encounter: 'a1_enc_hound_pack' }],
          result: 'The hounds lunge the moment the collar leaves its hook.'
        },
        {
          label: '[Feed them a coin] Lose 15 gold. Heal 8 HP.',
          cond: { minGold: 15 },
          effects: [{ op: 'gold', amount: -15 }, { op: 'heal', amount: 8 }],
          result: 'The hounds snap up the coin and lick your fingers clean, almost tenderly.'
        },
        {
          label: '[Whistle softly] 50%: add a random common card to your deck. Otherwise fight a random normal enemy.',
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'add_card', card: 'random', rarity: 'common' }],
              else: [{ op: 'fight', encounter: 'random_normal' }],
              thenResult: 'One hound limps to your side and settles at your heel, a loyal and terrible thing.',
              elseResult: 'The whistle carries, and the wrong hounds answer it.'
            }
          ],
          result: 'You put two fingers to your lips and blow.'
        },
        {
          label: '[Leave] Nothing happens.',
          effects: [],
          result: 'The hounds turn back to their kennel, bored, and begin to dig.'
        }
      ]
    },

    // ======================================================================= ACT 2: DROWNED CITY

    {
      id: 'ec_a2_drowned_bell', name: 'The Drowned Bell', act: [2], icon: '🔔',
      text: 'A bell hangs from a chapel rafter, half-submerged in black water that laps at its lip. Each time the flood rises, the bell rings a single dull note, and something in the drowned pews answers with a wail. When you reach for the rope, the water goes very still and waits.',
      choices: [
        {
          label: '[Ring it] Lose 8 HP. Gain a random uncommon relic.',
          cond: { minHp: 12 },
          effects: [{ op: 'lose_hp', amount: 8 }, { op: 'add_relic', relic: 'random', rarity: 'uncommon' }],
          result: 'The note rolls out over the flood, and something beneath the water gives up its treasure to hear it again.'
        },
        {
          label: '[Cut the rope] Gain 20 gold. Fight the Wailing Chapel.',
          effects: [{ op: 'gold', amount: 20 }, { op: 'fight', encounter: 'a2_enc_wailing_chapel' }],
          result: 'The bell drops into the flood with a sound like a dying throat, and the chapel rises to meet you.'
        },
        {
          label: '[Pray with the drowned] Heal 10 HP. Add Doubt, a curse, to your deck.',
          effects: [{ op: 'heal', amount: 10 }, { op: 'add_card', card: 'curse_doubt' }],
          result: 'You kneel in the cold water, and the drowned hold your hands and ask only that you remember them.'
        },
        {
          label: '[Leave] Nothing happens.',
          effects: [],
          result: 'Behind you the bell rings once more, softly, as if to say it will wait.'
        }
      ]
    },

    {
      id: 'ec_a2_siren_bargain', name: 'The Siren\'s Bargain', act: [2], icon: '🧜',
      text: 'A voice rises from the flooded arcade, sweeter than any voice has a right to be. Three pale women drift in the shallows with their hair fanned across the surface like sails. "Come closer, drowned one," they sing. "We will tell you what you lost. We will even tell you what it was worth."',
      choices: [
        {
          label: '[Listen closely] Heal 12 HP. Fight the Siren Choir.',
          effects: [{ op: 'heal', amount: 12 }, { op: 'fight', encounter: 'a2_enc_elite_siren_choir' }],
          result: 'Their song is a cure and a warning at once, and you are still listening when they turn on you.'
        },
        {
          label: '[Hum along] 60%: gain 50 gold. Otherwise lose 12 HP.',
          cond: { minHp: 14 },
          effects: [
            {
              op: 'chance',
              p: 0.6,
              then: [{ op: 'gold', amount: 50 }],
              else: [{ op: 'lose_hp', amount: 12 }],
              thenResult: 'The sirens scatter a fistful of drowned coin across the shallows, and you scoop it up.',
              elseResult: 'The note you hum is wrong. The sirens sigh and take a little of your blood in apology.'
            }
          ],
          result: 'You open your mouth and let the tune find its own way out.'
        },
        {
          label: '[Stop your ears] Remove 1 card from your deck (you choose).',
          effects: [{ op: 'remove_card', amount: 1 }],
          result: 'You jam wax into your ears and feel one memory slip quietly out of your head.'
        },
        {
          label: '[Walk on] Nothing happens.',
          effects: [],
          result: 'The song follows you into the arcade and fades slowly, like a tide going out.'
        }
      ]
    },

    {
      id: 'ec_a2_gallowe_ledger', name: 'Gallowe Returns', act: [2], icon: '📒',
      text: 'Mortimer Gallowe waits at the flooded tram stop, his grey coat dry above the waterline. "The Lantern Company has moved offices," he says, "and so have I. Your balance has grown. Water damage, you understand. Interest on the flood." Behind him, a crew of pale pickpockets wades toward you, their hands already busy.',
      choices: [
        {
          label: '[Pay what you owe] Lose 50 gold. Gallowe leaves you alone.',
          cond: { minGold: 50 },
          effects: [{ op: 'gold', amount: -50 }],
          result: 'He writes SETTLED in a hand so neat it looks like a threat.'
        },
        {
          label: '[Pay in memory] Remove 1 card from your deck (you choose). Gallowe leaves you alone.',
          effects: [{ op: 'remove_card', amount: 1 }],
          result: 'He tucks the card into his ledger between two dead pages and nods.'
        },
        {
          label: '[Refuse and fight] Gain 25 gold from the wreck. Fight the Pickpocket Crew.',
          effects: [{ op: 'gold', amount: 25 }, { op: 'fight', encounter: 'a2_enc_pickpocket_crew' }],
          result: 'Gallowe closes the ledger. "Then I shall collect from the crew instead."'
        },
        {
          label: '[Duck under the waterline] 50%: slip away unharmed. Otherwise lose 8 HP.',
          cond: { minHp: 10 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [],
              else: [{ op: 'lose_hp', amount: 8 }],
              thenResult: 'You slip beneath the flood and surface a street away, dripping and free.',
              elseResult: 'A pickpocket grabs your arm and bites before you wrench free.'
            }
          ],
          result: 'You fill your lungs and go under.'
        }
      ]
    },

    {
      id: 'ec_a2_rival_bridge', name: 'The Rival at the Bridge', act: [2], icon: '🌉',
      text: 'A drowned bridge arches above the flood, and Ysolde Thorn stands halfway across it, fishing a coil of rope out of the current. "The captain of the gutters wants a toll for this crossing," she says. "I told him you would pay it for me. Do not make me a liar."',
      choices: [
        {
          label: '[Pay her toll] Lose 20 gold. Heal 8 HP.',
          cond: { minGold: 20 },
          effects: [{ op: 'gold', amount: -20 }, { op: 'heal', amount: 8 }],
          result: 'She catches the coin mid-air with a grin and tosses you a bandage. "We are even, climber."'
        },
        {
          label: '[Let her cross first] 50%: gain a random uncommon relic. Otherwise lose 10 HP.',
          cond: { minHp: 14 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'add_relic', relic: 'random', rarity: 'uncommon' }],
              else: [{ op: 'lose_hp', amount: 10 }],
              thenResult: 'At the far end she pauses and leaves something clinking on the rail for you.',
              elseResult: 'She shoves past you into the current, and you go down the rails together.'
            }
          ],
          result: 'You wait while she crosses, watching the water.'
        },
        {
          label: '[Challenge the captain] Gain 15 gold. Fight the Gutter Captain.',
          effects: [{ op: 'gold', amount: 15 }, { op: 'fight', encounter: 'a2_enc_elite_gutter_captain' }],
          result: 'Ysolde whistles from the bridge as the captain steps out of the spray.'
        },
        {
          label: '[Turn back] Nothing happens.',
          effects: [],
          result: 'Ysolde calls after you that the bridge will still be here when you come crawling back.'
        }
      ]
    },

    {
      id: 'ec_a2_flooded_archive', name: 'The Flooded Archive', act: [2], icon: '📚',
      text: 'Books float in the stacks like drowned birds, their pages spread wide to drink. A librarian sits at a desk inside a diving bell, writing each title on a slate and rubbing it out again. "Knowledge only sinks," she says, "unless you choose what to carry."',
      choices: [
        {
          label: '[Read a book] 50%: upgrade a random card. Otherwise add Doubt, a curse, to your deck.',
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'upgrade_card', amount: 1, random: true }],
              else: [{ op: 'add_card', card: 'curse_doubt' }],
              thenResult: 'The page you read rewrites a card in your head, and the card is sharper for it.',
              elseResult: 'The book is written in your own handwriting, and its last page is blank and doubtful.'
            }
          ],
          result: 'You open a volume at random and begin to read.'
        },
        {
          label: '[Burn a cursed tome] Remove a Curse from your deck (you choose).',
          cond: { hasCardType: 'curse' },
          effects: [{ op: 'remove_card', amount: 1, type: 'curse' }],
          result: 'The tome burns with green flame, and the curse inside it curls up and goes out.'
        },
        {
          label: '[Salvage the index] Upgrade 1 card of your choice.',
          effects: [{ op: 'upgrade_card', amount: 1 }],
          result: 'She hands you a waterlogged index, and you choose the card that deserves it most.'
        },
        {
          label: '[Leave] Nothing happens.',
          effects: [],
          result: 'She writes your title on the slate, looks at it for a while, and rubs it out.'
        }
      ]
    },

    {
      id: 'ec_a2_hoard_chest', name: 'The Hoarding Chest', act: [2], icon: '🧰',
      text: 'A chest sits in a drift of wet coins, its brass hinges polished bright. Each time the water rises, the lid creaks open a crack and shows a gleam of rings. Each time it falls, the lid bites shut with a click. Beside it, a child\'s handprint is pressed into the mud, too small to be yours.',
      choices: [
        {
          label: '[Reach in] 50%: gain 60 gold. Otherwise lose 12 HP.',
          cond: { minHp: 14 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'gold', amount: 60 }],
              else: [{ op: 'lose_hp', amount: 12 }],
              thenResult: 'Your hand comes out full of gold, and the chest sulks shut.',
              elseResult: 'The lid bites down on your wrist and lets go only when you stop screaming.'
            }
          ],
          result: 'You slide your hand between the lid and the rim.'
        },
        {
          label: '[Pry the lid] Gain 20 gold. Fight the Hoard Mimic.',
          effects: [{ op: 'gold', amount: 20 }, { op: 'fight', encounter: 'a2_enc_elite_hoard_mimic' }],
          result: 'The lid swings wide, and a mouth full of coins opens with it.'
        },
        {
          label: '[Leave a coin] Lose 10 gold. Add a random common card to your deck.',
          cond: { minGold: 10 },
          effects: [{ op: 'gold', amount: -10 }, { op: 'add_card', card: 'random', rarity: 'common' }],
          result: 'The chest swallows the coin with a contented click and gives you a card in its place.'
        },
        {
          label: '[Walk on] Nothing happens.',
          effects: [],
          result: 'Behind you the lid creaks open a crack and then thinks better of it.'
        }
      ]
    },

    // ======================================================================= ACT 3: THE SUMMIT

    {
      id: 'ec_a3_glass_stair', name: 'The Mirror Stair', act: [3], icon: '🪞',
      text: 'The stair here is made of glass so clear it seems to be made of air, and every step shows a reflection of a different you. One climbs too fast. One sits down and weeps. One holds a knife. You climb past them with your heart in your throat, and the one on the highest step reaches out for your hand.',
      choices: [
        {
          label: '[Take its hand] 50%: gain 8 max HP. Otherwise lose 8 HP.',
          cond: { minHp: 12 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'max_hp', amount: 8 }],
              else: [{ op: 'lose_hp', amount: 8 }],
              thenResult: 'Warmth floods through you as the reflection smiles and fades, and your body is larger for it.',
              elseResult: 'It is not a friend. Its grip leaves your palm bleeding and cold.'
            }
          ],
          result: 'You reach out, and the glass is warm as skin.'
        },
        {
          label: '[Smash the glass] Lose 6 HP. Gain 40 gold.',
          cond: { minHp: 10 },
          effects: [{ op: 'lose_hp', amount: 6 }, { op: 'gold', amount: 40 }],
          result: 'The glass shatters into a hundred reflections that all scream, and a purse falls from the broken step.'
        },
        {
          label: '[Climb past] Heal 6 HP.',
          effects: [{ op: 'heal', amount: 6 }],
          result: 'You climb past the reflections with your eyes lowered and rest for a breath on the highest step.'
        },
        {
          label: '[Look away] Nothing happens.',
          effects: [],
          result: 'You climb on, counting the steps aloud so you will not have to see them.'
        }
      ]
    },

    {
      id: 'ec_a3_skull_summit', name: 'Pell at the Summit', act: [3], icon: '💀',
      text: 'Pell is still here, propped in its niche above a drift of broken mirrors. "You came back," it says, delighted. "Nobody comes back. Everyone who climbs this high thinks they are the exception, which is why they are all in my collection now." It clacks its jaw. "What will you give me for the final secret?"',
      choices: [
        {
          label: '[Pay 60 gold] Lose 60 gold. Gain a random uncommon relic.',
          cond: { minGold: 60 },
          effects: [{ op: 'gold', amount: -60 }, { op: 'add_relic', relic: 'random', rarity: 'uncommon' }],
          result: 'Pell gobbles the coins with a noise like a drain, and a relic tumbles out of its open jaw.'
        },
        {
          label: '[Give it a curse] Remove a Curse from your deck (you choose).',
          cond: { hasCardType: 'curse' },
          effects: [{ op: 'remove_card', amount: 1, type: 'curse' }],
          result: 'Pell takes the curse in its teeth, chews once and spits out a bright, clean splinter.'
        },
        {
          label: '[Trust the skull] 50%: gain 10 max HP. Otherwise add Shame, a curse, to your deck.',
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'max_hp', amount: 10 }],
              else: [{ op: 'add_card', card: 'curse_shame' }],
              thenResult: 'Pell cackles and pours cold blue light into your bones, and you feel larger for it.',
              elseResult: 'Pell lies cheerfully. The shame settles into your deck while Pell laughs until it rattles.'
            }
          ],
          result: 'The skull leans close enough that you can smell old incense.'
        },
        {
          label: '[Dare it] Gain 30 gold. Fight the Glass and Ritual.',
          effects: [{ op: 'gold', amount: 30 }, { op: 'fight', encounter: 'a3_enc_glass_ritual' }],
          result: 'Pell snaps its jaw shut, delighted, and the mirrors begin to chant.'
        }
      ]
    },

    {
      id: 'ec_a3_rival_summit', name: 'The Last Stair', act: [3], icon: '🏁',
      text: 'Ysolde Thorn sits on the final step, rope knotted to a stanchion, boots off and bleeding from a cut on her cheek. "Do not say it," she says when she sees you. "I know. I got here first. Now the summit is one step away and we both want the same view." Beyond her, the paladins of the summit gate polish their shields.',
      choices: [
        {
          label: '[Help her up] Heal 12 HP. Add a random common card to your deck.',
          effects: [{ op: 'heal', amount: 12 }, { op: 'add_card', card: 'random', rarity: 'common' }],
          result: 'She takes your hand without looking at it. "Do not thank me. I will still beat you to the top."'
        },
        {
          label: '[Race to the gate] 50%: gain a random uncommon relic. Otherwise lose 12 HP.',
          cond: { minHp: 16 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'add_relic', relic: 'random', rarity: 'uncommon' }],
              else: [{ op: 'lose_hp', amount: 12 }],
              thenResult: 'She throws her rope down to you, and a relic is tied to its end.',
              elseResult: 'She is faster on the last stair, and her elbow finds your ribs.'
            }
          ],
          result: 'You both sprint for the gate, and the paladins lower their shields to watch.'
        },
        {
          label: '[Cut her rope] Gain 50 gold. Fight the Paladin Escort.',
          effects: [{ op: 'gold', amount: 50 }, { op: 'fight', encounter: 'a3_enc_paladin_escort' }],
          result: 'The rope falls away, Ysolde swears, and the paladins come down the stair at a run.'
        },
        {
          label: '[Leave her be] Nothing happens.',
          effects: [],
          result: 'She waves you past without looking up. "Go on. The view is better when it is earned."'
        }
      ]
    },

    {
      id: 'ec_a3_void_whisper', name: 'The Void Whisper', act: [3], icon: '🌌',
      text: 'At the top of the spiral stair the air thins into a silence so complete you can hear your own blood. A shape hangs in the nothing like a banner of black silk, and it speaks in a hundred voices, each one of them yours. "Offer," it says, "and I will tell you how the tower ends. Refuse, and I will show you."',
      choices: [
        {
          label: '[Offer blood] Lose 15 HP. Add a random rare card to your deck.',
          cond: { minHp: 20 },
          effects: [{ op: 'lose_hp', amount: 15 }, { op: 'add_card', card: 'random', rarity: 'rare' }],
          result: 'The shape drinks the blood in one long breath and presses a rare card into your deck.'
        },
        {
          label: '[Offer gold] Lose 70 gold. Gain a random uncommon relic.',
          cond: { minGold: 70 },
          effects: [{ op: 'gold', amount: -70 }, { op: 'add_relic', relic: 'random', rarity: 'uncommon' }],
          result: 'The coins vanish into the black silk, and something cold and useful is dropped in their place.'
        },
        {
          label: '[Demand the ending] Gain 5 max HP. Fight the Void Herald.',
          effects: [{ op: 'max_hp', amount: 5 }, { op: 'fight', encounter: 'a3_enc_void_herald' }],
          result: 'The voices merge into one and begin to laugh, and the nothing hardens into a crown above you.'
        },
        {
          label: '[Look away] Nothing happens.',
          effects: [],
          result: 'The silence lingers after you have stopped listening, the way a bell hums after it has been struck.'
        }
      ]
    },

    {
      id: 'ec_a3_storm_offering', name: 'The Storm Shrine', act: [3], icon: '⛈️',
      text: 'A shrine of copper and lightning stands on a platform above the clouds. Its bowl holds a storm no bigger than an egg, which whirls and spits sparks at your fingers. A plaque reads: THE STORM TAKES A PRICE FROM THE BOLD. THE TITAN IS GENEROUS TO THE BRAVE.',
      choices: [
        {
          label: '[Catch a spark] 50%: add a random uncommon card to your deck. Otherwise lose 10 HP.',
          cond: { minHp: 14 },
          effects: [
            {
              op: 'chance',
              p: 0.5,
              then: [{ op: 'add_card', card: 'random', rarity: 'uncommon' }],
              else: [{ op: 'lose_hp', amount: 10 }],
              thenResult: 'The spark hardens in your palm into a card of crackling light.',
              elseResult: 'The spark goes through your palm like a needle and leaves you ringing.'
            }
          ],
          result: 'You hold out a finger, and a spark dances onto it.'
        },
        {
          label: '[Feed the bowl] Lose 25 gold. Add a random potion to your belt.',
          cond: { minGold: 25 },
          effects: [{ op: 'gold', amount: -25 }, { op: 'add_potion', potion: 'random' }],
          result: 'The storm swallows the coins and spits out something that fizzes inside a flask.'
        },
        {
          label: '[Break the bowl] Gain 35 gold. Fight the Living Storm.',
          effects: [{ op: 'gold', amount: 35 }, { op: 'fight', encounter: 'a3_enc_storm_titan' }],
          result: 'The bowl splits, and the storm roars out of it, taking the shape of a giant.'
        },
        {
          label: '[Walk on] Nothing happens.',
          effects: [],
          result: 'The storm settles to a hum behind you, as if it is listening for your return.'
        }
      ]
    },

    {
      id: 'ec_a3_last_ledger', name: 'The Last Ledger', act: [3], icon: '📒',
      text: 'Mortimer Gallowe waits at the last landing with his ledger open to a page almost full. "Final accounts," he says. "The summit is not cheap. I was paid in advance, you understand, and the payment was you. The Colossus is my collateral. Shall we settle the balance here, or go to the gilded gate and discuss it there?"',
      choices: [
        {
          label: '[Settle in gold] Lose 100 gold. Gain a random rare relic.',
          cond: { minGold: 100 },
          effects: [{ op: 'gold', amount: -100 }, { op: 'add_relic', relic: 'random', rarity: 'rare' }],
          result: 'He strikes the page through with a silver pen and hands you a relic that is still warm from his coat.'
        },
        {
          label: '[Settle in blood] Lose 20 HP. Remove 1 card from your deck (you choose).',
          cond: { minHp: 25 },
          effects: [{ op: 'lose_hp', amount: 20 }, { op: 'remove_card', amount: 1 }],
          result: 'The debt is paid in the only currency the summit recognises, and he crosses your name out.'
        },
        {
          label: '[Slip past him] 40%: gain 30 gold. Otherwise add Doubt, a curse, to your deck.',
          effects: [
            {
              op: 'chance',
              p: 0.4,
              then: [{ op: 'gold', amount: 30 }],
              else: [{ op: 'add_card', card: 'curse_doubt' }],
              thenResult: 'He does not look up from the ledger, but he writes something very small in the margin.',
              elseResult: 'Your foot catches the ledger chain. Gallowe writes your name in red.'
            }
          ],
          result: 'You edge along the wall, hoping he is busy with his figures.'
        },
        {
          label: '[Refuse at the gate] Gain 20 gold. Fight the Gilded Colossus.',
          effects: [{ op: 'gold', amount: 20 }, { op: 'fight', encounter: 'a3_enc_gilded_colossus' }],
          result: 'He closes the ledger with a snap. "Then the Colossus will collect for me."'
        }
      ]
    }
  ];

  for (const ev of EVENTS_C) DS.defineEvent(ev);

})();
