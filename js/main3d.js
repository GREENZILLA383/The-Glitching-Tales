class GameSystem3D {
    constructor() {
        this.state = 'menu'; // menu, overworld, gauntlet, dialogue, shop, settings, paused, gameover
        this.isCutscene = false;
        this.party = []; // filled in by beginAdventure() once character creation confirms
        this.coins = 0;

        this.mainMenu = document.getElementById('main-menu');
        this.dialogueBox = document.getElementById('dialogue-box');

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('menu-settings-btn').addEventListener('click', () => {
            if (window.settingsSystem) window.settingsSystem.openSettings();
        });

        const diffBtn = document.getElementById('difficulty-btn');
        const diffLevels = ['EASY', 'NORMAL', 'HARD'];
        const diffMultipliers = { 'EASY': 0.5, 'NORMAL': 0.75, 'HARD': 1.0 };
        this.difficultyStr = 'HARD';
        this.difficultyMultiplier = 1.0;

        this.setDifficulty = (level) => {
            this.difficultyStr = level;
            this.difficultyMultiplier = diffMultipliers[level];
            diffBtn.innerText = `🔥 DIFFICULTY: ${level}`;
            const color = { HARD: '#ff4757', NORMAL: '#ffa502', EASY: '#2ed573' }[level];
            diffBtn.style.color = color; diffBtn.style.borderColor = color;
        };
        diffBtn.addEventListener('click', () => {
            this.setDifficulty(diffLevels[(diffLevels.indexOf(this.difficultyStr) + 1) % diffLevels.length]);
        });

        // Continue a saved game (the button only shows when a save exists).
        const contBtn = document.getElementById('continue-btn');
        if (contBtn && window.SaveGame) {
            const save = SaveGame.read();
            if (save) {
                contBtn.classList.remove('hidden');
                const info = document.getElementById('continue-info');
                if (info) info.textContent = SaveGame.describe(save);
            }
            contBtn.addEventListener('click', () => this.continueAdventure());
        }
    }

    beginAdventure(playerChar, save = null) {
        this.party = [playerChar];
        this.mainMenu.classList.add('hidden');
        this.state = 'overworld';
        overworld3d.start(this.party);
        if (save) SaveGame.applyWorld(save);
        this.updateHUD();
        if (save) {
            setTimeout(() => this.showToast('Welcome back! Your game was loaded.'), 400);
        } else {
            setTimeout(() => {
                this.showDialogue('System', `${playerChar.name} washes up on the shore of the Emerald Coast, with no memory of how they got there.`);
            }, 300);
        }
    }

    // Rebuild the player from the save file and drop them back into the world.
    continueAdventure() {
        const d = SaveGame.read();
        if (!d) return;
        this.setDifficulty(d.difficulty || 'HARD');
        this.coins = d.coins || 0;
        const pd = d.player;
        const defaultWeapon = { ...STARTER_WEAPONS[pd.skillType] };
        const player = Object.assign({}, pd, {
            id: 'player', isPlayerCharacter: true, invincibleUntil: 0,
            defaultWeapon,
            equippedWeapon: pd.weaponIsDefault ? defaultWeapon : { ...pd.equippedWeapon },
            build3D: () => VoxelBuilder.buildCharacter(buildPlayerParts(pd.appearance))
        });
        player.hp = player.maxHp; player.mp = player.maxMp; player.stamina = player.maxStamina; // you rested while away
        this.beginAdventure(player, d);
    }

    collectCoin() {
        this.coins += 5;
        Sound.play('coin');
        this.showDialogue('System', 'Found 5 Coins!');
        this.updateHUD();
    }

    // Befriend the Flow Song creature: its music is yours now (toggle it in the pause menu).
    collectFlowSong() {
        this.flowSongUnlocked = true;
        Sound.play('song');
        Sound.unlockFlow(true);
        this.showDialogue('Flow Song', '♪ ~ La la laaa ~ ♪  (The little music-note floats happily beside you. You can now listen to its song while you adventure! Turn it on or off from the Pause menu.)');
        SaveGame.autosave();
    }

    // A brief, non-blocking on-screen message (does not pause the game like dialogue does).
    showToast(text) {
        const el = document.getElementById('game-toast');
        if (!el) return;
        el.textContent = text;
        el.classList.add('visible');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => el.classList.remove('visible'), 2200);
    }

    triggerStoryNPC(storyId) {
        if (storyId === 'barnico') {
            const player = this.party[0];
            if (!player.hasGlider) {
                player.hasGlider = true;
                this.showDialogue('Elder Barnico', "So. You're the one the tides dragged in. Good, we could use someone like you. Take this before you go - it'll help you get down from high places without breaking your neck.");
            } else if (this.party.length < 2) {
                this.showDialogue('Elder Barnico', "There's a crab out past the temple ruins who calls himself a king. Croton. Octa's going with you - don't argue.");
            } else {
                this.showDialogue('Elder Barnico', "Go on, then. The tide won't wait for you.");
            }
        } else if (storyId === 'octa_join') {
            this.showDialogue('Octa', "Me! Me! I'm coming too!");
            const octa = JSON.parse(JSON.stringify(CHARACTERS.octa));
            octa.build3D = CHARACTERS.octa.build3D;
            this.party.push(octa);
            overworld3d.spawnCompanion(octa);
        }
    }

    // Stepping through the Sea Gate: a boat is waiting. Sail out, and a wave shaped like a hand slams down on you.
    triggerBoatVoyage() {
        this.isCutscene = true;
        document.body.classList.add('cutscene-active');
        this.dialogueQueue = [];
        overworld3d.beginVoyageScene();
        this.afterDialogue = () => overworld3d.startSailing();
        this.showDialogue('System', "Past the temple, the land simply ends. A small wooden boat bobs at the end of an old dock, as if it has been waiting for you. You climb aboard" +
            (this.party.length > 1 ? ', and Octa hops in beside you.' : '.'));
    }

    // The wave has just hit: black screen. Say what happened, then wake up in the reef.
    onVoyageSlam() {
        this.dialogueQueue = [];
        this.afterDialogue = () => {
            overworld3d.finishVoyage();
            this.afterDialogue = () => { /* (nothing more: the next click ends the cutscene) */ };
            this.dialogueQueue = [{ speaker: 'System', text: 'Far ahead, past the glittering coral, something huge and old is waiting. Cross the reef to find it. (Watch out for electric eels and fire fish!)' }];
            setTimeout(() => this.showDialogue('System', 'You wake on the seabed, soaked and aching. All around you, a coral reef glows in colors you have never seen. There is no way back up.'), 900);
        };
        this.showDialogue('System', 'A wave rises ahead of you - and for one unnerving moment, it looks exactly like a closing hand. It slams down. The ocean swallows you whole, and you sink a long, long way...');
    }

    // The far end of the reef: Oblongtalo's plaza.
    triggerOblongtaloEncounter() {
        this.isCutscene = true;
        this.pendingGauntletStart = true;
        document.body.classList.add('cutscene-active');
        this.dialogueQueue = [];
        overworld3d.startCinematicFlyin(() => {
            this.showDialogue('System', 'The reef opens into a drowned royal plaza. Glowing runes pulse in the floor, and a throne sits empty at the far end... for now.');
        });
    }

    onCrotonDefeated() {
        this.isCutscene = true;
        document.body.classList.add('cutscene-active');
        // (a "Level up!" box may still be open from the winning blow: closing it must not end the cutscene or eat these lines)
        this.cutsceneHold = true;
        const lines = [
            { speaker: 'Croton', text: "Worthy. Huh. It's been a while." },
            { speaker: 'Croton', text: "Whatever's waiting for you next is out there. Ruined Ocean's not kind to visitors. Try not to drown." }
        ];
        overworld3d.startCinematicFlyin(() => {
            this.cutsceneHold = false;
            if (this.state === 'dialogue') this.dialogueQueue.push(...lines);          // wait for the open box to be closed
            else { this.dialogueQueue = lines.slice(1); this.showDialogue(lines[0].speaker, lines[0].text); }
        });
    }

    onOblongtaloSurvived() {
        this.isCutscene = true;
        this.pendingChapterEnd = true;
        document.body.classList.add('cutscene-active');
        this.showDialogue('Oblongtalo', 'You are worthy.');
    }

    onPlayerDefeated() {
        if (this.state === 'gameover') return;
        this.state = 'gameover';
        this.showDialogue('System', 'You have fallen... the adventure resets.');
        setTimeout(() => location.reload(), 2500);
    }

    showChapterThreeComingSoon() {
        document.getElementById('chapter-end-ui').classList.remove('hidden');
    }

    updateHUD() {
        const player = this.party[0];
        if (!player) return;
        const setBar = (fillId, val, max) => {
            const el = document.getElementById(fillId);
            if (el) el.style.width = `${Math.max(0, Math.min(100, (val / max) * 100))}%`;
        };
        setBar('hud-hp-fill', player.hp, player.maxHp);
        setBar('hud-mp-fill', player.mp, player.maxMp);
        setBar('hud-stamina-fill', player.stamina, player.maxStamina);

        const weaponEl = document.getElementById('hud-weapon-name');
        if (weaponEl) {
            const w = player.equippedWeapon;
            const durText = (w.durability === null || w.durability === undefined) ? '∞' : `${w.durability}/${w.maxDurability}`;
            weaponEl.innerText = `${w.name} (${durText})`;
        }
        const coinEl = document.getElementById('hud-coins');
        if (coinEl) coinEl.innerText = this.coins;
        const levelEl = document.getElementById('hud-level');
        if (levelEl) levelEl.innerText = `Lv.${player.level}`;
    }

    showDialogue(speaker, text) {
        if (!this.dialogueQueue) this.dialogueQueue = [];

        if (this.state === 'dialogue') {
            this.dialogueQueue.push({ speaker, text });
            return;
        }

        const prevState = this.state;
        this.state = 'dialogue';

        this.dialogueBox.classList.remove('hidden');
        this.dialogueBox.querySelector('.speaker-name').innerText = speaker;

        const textContainer = this.dialogueBox.querySelector('.dialogue-text');
        textContainer.textContent = '';
        let i = 0;
        const voiced = !!(window.Voices && Voices.speak(speaker, text));     // the character TALKS out loud

        const typeWriter = setInterval(() => {
            textContainer.textContent = text.substring(0, i + 1);
            if (!voiced) Sound.blip(speaker, i);
            i++;
            if (i >= text.length) {
                clearInterval(typeWriter);
                const closeHandler = () => {
                    if (window.Voices) Voices.stop();                 // (clicking on cuts the voice off)
                    this.dialogueBox.classList.add('hidden');
                    this.state = prevState;
                    document.removeEventListener('click', closeHandler);

                    if (this.dialogueQueue && this.dialogueQueue.length > 0) {
                        const nextMsg = this.dialogueQueue.shift();
                        setTimeout(() => this.showDialogue(nextMsg.speaker, nextMsg.text), 100);
                    } else if (this.afterTalk) {                 // a conversation that ends with a question (like Iolana's race)
                        const next = this.afterTalk; this.afterTalk = null; next();
                    } else if (this.isCutscene) {
                        this.endCutscene();
                    }
                };
                setTimeout(() => document.addEventListener('click', closeHandler), 500);
            }
        }, voiced ? 52 : 30);
    }

    endCutscene() {
        if (this.cutsceneHold) return;     // (a scene is still on its way - e.g. a camera fly-in)
        // A cutscene can run several scenes in a row: if one is queued, run it and stay in the cutscene.
        if (this.afterDialogue) {
            const next = this.afterDialogue;
            this.afterDialogue = null;
            next();
            if (this.dialogueQueue && this.dialogueQueue.length) return;   // (it queued more text)
            if (this.cutsceneHold) return;                                  // (the next scene starts after a fade)
            if (this.isCutscene && (overworld3d.voyage || overworld3d.skyRide)) return;   // (still sailing / flying)
            if (this.afterDialogue) return;
        }
        this.isCutscene = false;
        document.body.classList.remove('cutscene-active');

        if (this.pendingGauntletStart) {
            this.pendingGauntletStart = false;
            window.combatSystem.startOblongtaloGauntlet();
        } else if (this.pendingChapterEnd) {
            this.pendingChapterEnd = false;
            this.startDunesArrival();
        }
    }

    // Oblongtalo's light carries the player out of the water and onto the sand of Chapter 3.
    startDunesArrival() {
        this.isCutscene = true;
        document.body.classList.add('cutscene-active');
        if (overworld3d.controls && overworld3d.controls.isLocked) overworld3d.controls.unlock();
        Sound.play('levelup');
        overworld3d.setFade(1, 1.4, '#dff4ff');            // the water glows brighter and brighter...
        setTimeout(() => {
            overworld3d.arriveInDesert();
            overworld3d.setFade(0, 2.4, '#fff3d6');         // ...and fades into hot, golden light
            this.showDialogue('System', "The water around you begins to glow, pulling you upward and outward all at once. When the light fades, the ocean is gone. In its place: endless, shifting dunes, and a sun that hums like it's counting something. This is the Dunes of Force.");
        }, 1700);
    }

    // The quicksand in Cacto Village has swallowed the player: they fall all the way down into the Gravity Core.
    onFallIntoCore() {
        this.isCutscene = true;
        document.body.classList.add('cutscene-active');
        if (overworld3d.controls && overworld3d.controls.isLocked) overworld3d.controls.unlock();
        Sound.play('suck');
        overworld3d.setFade(1, 1.2, '#000000');
        setTimeout(() => {
            GravityCore.begin();                                  // builds the little planet and puts everyone on it
            overworld3d.setFade(0, 1.8, '#000000');
            this.dialogueQueue = [
                { speaker: GravityCore.BOSS_NAME.split(',')[0], text: 'Another one... another one who wants to tear the core apart.' },
                { speaker: GravityCore.BOSS_NAME.split(',')[0], text: 'I am Graton, protector of the Gravity Core. I will not let you destroy it, even if I have to crush you into dust!' }
            ];
            this.showDialogue('System', 'The sand swallows you whole. You fall through darkness for what feels like forever... then the world flips over, and you land on the surface of a small, glowing world with gravity all of its own. This is the Gravity Core.');
        }, 1400);
    }

    // Graton falls: the core calms down and the way up to the Sky Kingdom opens.
    onCoreBossDefeated() {
        const player = this.party[0];
        this.coins += 150; player.exp += 400;
        while (player.exp >= player.expToNext) { player.exp -= player.expToNext; player.level += 1; player.expToNext = Math.round(player.expToNext * 1.3); player.maxHp += 10; player.hp = player.maxHp; }
        this.updateHUD();
        const bar = document.getElementById('boss-health-container'); if (bar) bar.classList.add('hidden');
        this.isCutscene = true;
        document.body.classList.add('cutscene-active');
        if (overworld3d.controls && overworld3d.controls.isLocked) overworld3d.controls.unlock();
        this.dialogueQueue = [
            { speaker: 'Graton', text: '...The core is calm. You were never here to break it, were you?' },
            { speaker: 'Graton', text: 'Forgive me. I have guarded it for so long that I forgot how to tell a friend from a threat. Go on. A path of light is opening above you.' },
            { speaker: 'System', text: 'The black hole folds quietly into itself. A column of light rises from the surface of the core, and it leads up, and up, toward the sky.' }
        ];
        this.afterDialogue = () => this.startSkyRide();
        this.showDialogue('System', 'Graton\u2019s rocks tumble apart, and the little black hole flickers and goes quiet.');
    }

    // Chapter 4: the column of light carries the party up, and a giant friendly cloud catches them in the sky.
    startSkyRide() {
        this.isCutscene = true;
        this.cutsceneHold = true;   // keep the cutscene going while the screen fades to white (the ride begins after that)
        document.body.classList.add('cutscene-active');
        Sound.play('levelup');
        overworld3d.setFade(1, 1.4, '#ffffff');
        setTimeout(() => {
            this.cutsceneHold = false;
            GravityCore.leave();
            overworld3d.beginSkyRide();
            overworld3d.setFade(0, 2.2, '#ffffff');
            this.dialogueQueue = [
                { speaker: 'Wisp', text: 'Easy, little one! I have you. Hold on tight to my fluff!' },
                { speaker: 'Wisp', text: 'I am Wisp. When the Gravity Core went calm, the whole sky felt it. The Sky Kingdom has been waiting for someone like you.' },
                { speaker: 'Wisp', text: 'Hang on. We are going up, up, and over the clouds!' }
            ];
            this.afterDialogue = () => overworld3d.startSkyFlight();
            this.showDialogue('System', 'The light lifts you higher and higher, past the stars, past the clouds... then a huge, puffy shape sweeps underneath you, and you land on something soft, cool and bouncy. A giant cloud has caught you in the sky, and it has a big smiling face!');
        }, 1500);
    }

    // The cloud has drifted all the way to the cloud city and landed.
    onSkyRideEnd() {
        overworld3d.setFade(1, 1.0, '#ffffff');
        setTimeout(() => {
            overworld3d.finishSkyRide();
            overworld3d.setFade(0, 2.0, '#ffffff');
            this.dialogueQueue = [
                { speaker: 'Wisp', text: 'This is as far as I can carry you. The city is yours to explore!' },
                { speaker: 'Wisp', text: 'But be careful. Something up here has been stirring ever since the core went quiet.' }
            ];
            this.showDialogue('System', 'Wisp drifts down onto the landing pad and settles with a happy little puff. Before you, white towers with bright roofs rise out of the mist. This is the Sky Kingdom.');
        }, 1200);
    }

    // Talking to a villager of Makani: the first time you get their whole introduction, after that a different chat line each time.
    talkToVillager(ent) {
        const v = ent.v, ow = overworld3d, first = !ow.metVillagers.has(v.id);
        ow.metVillagers.add(v.id);
        if (v.id === 'iolana' && !first) { this.offerKiteRace(ent); return; }
        if (window.SideQuests && SideQuests.talkVillager(ent, first)) return;      // Kekoa / Malie: a side quest starts, or finishes   // after the first hello, she offers her kite race
        const lines = first ? v.intro.slice() : [v.chat[(ent.chatIdx = ((ent.chatIdx === undefined ? -1 : ent.chatIdx) + 1)) % v.chat.length]];
        const who = v.name + ', ' + v.title;
        if (v.shop) this.afterTalk = () => window.shopSystem.openShop(v.shop);      // (the trader: the shop opens when the chat is over)
        this.dialogueQueue = lines.slice(1).map(text => ({ speaker: who, text }));
        this.showDialogue(who, lines[0]);
        if (first && window.SaveGame) setTimeout(() => SaveGame.autosave(), 500);
    }

    // Iolana invites you to her kite ring race (talk to her again after the first hello).
    offerKiteRace(ent) {
        const ow = overworld3d, who = ent.v.name + ', ' + ent.v.title, best = ow.kiteBest, medals = ['', 'Bronze', 'Silver', 'Gold'];
        const steer = window.IS_MOBILE ? 'Use the left thumb stick: left and right to steer, up to climb, down to dive.' : 'Steer with A and D. W climbs and S dives.';
        const lines = best == null
            ? ['My kite race! Twelve glowing rings in one big loop around Makani. Fly through them all before the wind gets bored of you.', steer + ' Ready to fly?']
            : ['Back for more? Your best is ' + best.toFixed(1) + ' seconds (' + (medals[ow.kiteMedal] || 'Bronze') + '). Gold needs ' + KiteRace.GOLD + ' seconds or less. Ready to fly?'];
        this.dialogueQueue = lines.slice(1).map(text => ({ speaker: who, text }));
        this.afterTalk = () => this.showChoice('Race Iolana’s kite course?', 'Yes, let’s fly!', 'Maybe later', () => KiteRace.begin(ent), () => this.showToast('Iolana: "The wind will wait for you!"'));
        this.showDialogue(who, lines[0]);
    }

    // A little yes / no question on the screen. onYes / onNo run after the player picks.
    showChoice(text, yesLabel, noLabel, onYes, onNo) {
        const box = document.getElementById('choice-box'), yes = document.getElementById('choice-yes'), no = document.getElementById('choice-no');
        document.getElementById('choice-text').textContent = text;
        yes.textContent = yesLabel; no.textContent = noLabel;
        if (overworld3d.controls && overworld3d.controls.isLocked) overworld3d.controls.unlock();
        this.state = 'choice';
        box.classList.remove('hidden');
        const done = (fn) => {
            box.classList.add('hidden');
            document.removeEventListener('keydown', onKey);
            yes.onclick = no.onclick = null;
            this.state = 'overworld';
            if (fn) fn();
        };
        const onKey = (e) => { const k = e.key.toLowerCase(); if (k === 'enter' || k === 'y') done(onYes); else if (k === 'escape' || k === 'n') done(onNo); };
        yes.onclick = () => done(onYes); no.onclick = () => done(onNo);
        document.addEventListener('keydown', onKey);
    }

    // The "chapter over" screen (the text changes per chapter).
    showChapterEnd(num, title, text) {
        const ui = document.getElementById('chapter-end-ui');
        const h2 = ui.querySelector('h2'), h1 = ui.querySelector('h1'), p = ui.querySelector('p');
        if (h2) h2.textContent = 'Chapter ' + num; if (h1) h1.textContent = title; if (p) p.textContent = text;
        ui.classList.remove('hidden');
    }
}

class ShopSystem {
    constructor(gameSystem) {
        this.game = gameSystem;
        this.shopUI = document.getElementById('shop-ui');
        this.shopTitle = document.getElementById('shop-title');
        this.coinCount = document.getElementById('coin-count');
        this.shopkeeperDialogue = document.getElementById('shopkeeper-dialogue');
        this.shopItemsGrid = document.getElementById('shop-items-grid');
        this.closeBtn = document.getElementById('close-shop-btn');

        this.closeBtn.addEventListener('click', () => this.closeShop());

        this.shops = { octo: {}, cashato: {} };
        this.shops.octo = {
            title: 'SHOP', greeting: '"Wandering the coasts, buying and selling. Have a look around!"',
            items: [
            { id: 'spell_time', name: 'Time Spell', desc: 'A Magick bolt that slows on hit (twice as long if you are Magick).', price: 60, category: 'Spell',
              weaponData: { name: 'Time Spell', playStyle: 'magick', power: 8, skillType: 'magick', durability: null, maxDurability: null, mpCost: 10 } },
            { id: 'spell_spark', name: 'Greater Spark', desc: 'A stronger Magick bolt.', price: 120, category: 'Spell',
              weaponData: { name: 'Greater Spark', playStyle: 'magick', power: 22, skillType: 'magick', durability: null, maxDurability: null, mpCost: 12 } },
            { id: 'weapon_cutlass', name: 'Coral Cutlass', desc: 'A sturdy melee blade. Wears out with use.', price: 80, category: 'Weapon',
              weaponData: { name: 'Coral Cutlass', playStyle: 'melee', power: 20, skillType: 'melee', durability: 40, maxDurability: 40 } },
            { id: 'weapon_bow', name: 'Driftwood Bow', desc: 'A reliable hunting bow. Wears out with use.', price: 80, category: 'Weapon',
              weaponData: { name: 'Driftwood Bow', playStyle: 'range', power: 18, skillType: 'range', durability: 40, maxDurability: 40 } },
            { id: 'charm_vigor', name: 'Vigor Charm', desc: '+15 Max HP.', price: 70, category: 'Charm', stat: 'maxHp', val: 15 },
            { id: 'charm_focus', name: 'Focus Charm', desc: '+15 Max MP.', price: 70, category: 'Charm', stat: 'maxMp', val: 15 },
            { id: 'charm_wind', name: 'Wind Charm', desc: '+15 Max Stamina.', price: 70, category: 'Charm', stat: 'maxStamina', val: 15 }
            ]
        };
        // Cashato's Cloud Market (Makani Village). Edit the items here: price = coins, weaponData = the stats you get.
        this.shops.cashato = {
            title: "CASHATO'S CLOUD MARKET", greeting: '"Welcome, welcome! Everything here is spun from real cloud. Coins on the counter, please!"',
            items: [
            { id: 'weapon_cloud_spear', name: 'Cloud Spear', desc: 'A long spear spun from cloud. Light, quick and sharp. Wears out with use.', price: 150, category: 'Weapon',
              weaponData: { name: 'Cloud Spear', playStyle: 'melee', power: 32, skillType: 'melee', durability: 60, maxDurability: 60 } },
            { id: 'weapon_cloud_arrow', name: 'Cloud Arrow', desc: 'Arrows of hardened cloud that glide straight to their target. Wears out with use.', price: 150, category: 'Weapon',
              weaponData: { name: 'Cloud Arrow', playStyle: 'range', power: 30, skillType: 'range', durability: 60, maxDurability: 60, projColor: 0xcfe9ff } },
            { id: 'pass_cloud_stair', name: 'Cloud Stair Pass', desc: 'The ALMIGHTY Cloud Stair Pass! The only way past the Sky Guards, up the Stairs of Foam to the Sun of Time. (You only need one.)', price: 250, category: 'Pass', passItem: true }
            ]
        };
        this.inventory = this.shops.octo.items;     // (the list of what the open shop sells)
    }

    // id: 'octo' (the coast shopkeeper) or 'cashato' (the Cloud Market)
    openShop(id = 'octo') {
        const shop = this.shops[id] || this.shops.octo;
        this.inventory = shop.items;
        this.shopkeeperDialogue.innerText = shop.greeting;
        if (window.Voices) Voices.speak(id === 'cashato' ? 'Cashato' : 'Shopkeeper', shop.greeting);
        this.shopTitle.innerText = shop.title;
        this.updateCoinDisplay();
        this.renderItems();
        this.shopUI.classList.remove('hidden');
        if (overworld3d && overworld3d.controls) overworld3d.controls.unlock();
        this.game.state = 'shop';
    }

    closeShop() {
        if (window.Voices) Voices.stop();
        this.shopUI.classList.add('hidden');
        if (overworld3d && overworld3d.controls) overworld3d.controls.lock();
        this.game.state = (window.GravityCore && GravityCore.active) ? 'core' : 'overworld';
        SaveGame.autosave(); // remember what you bought
    }

    updateCoinDisplay() {
        this.coinCount.innerText = this.game.coins || 0;
    }

    renderItems() {
        this.shopItemsGrid.innerHTML = '';
        const player = this.game.party[0];
        this.inventory.forEach(item => {
            const el = document.createElement('div');
            el.className = 'shop-item';
            const finalPrice = Math.max(1, Math.floor(item.price));
            const owned = !!(item.passItem && player.hasCloudPass);
            const canAfford = !item.locked && !owned && (this.game.coins || 0) >= finalPrice;
            const matched = item.weaponData && item.weaponData.skillType === player.skillType;
            el.innerHTML = `
                <div class="item-name">${item.name} ${matched ? '⭐' : ''}</div>
                <div class="item-desc">[${item.category}] ${item.desc}</div>
                <div class="item-price">${item.locked ? '💰 ???' : '💰 ' + finalPrice}</div>
                <button class="buy-btn" ${canAfford ? '' : 'disabled'}>${item.locked ? 'Not yet' : owned ? 'Owned' : 'Buy'}</button>
            `;
            el.querySelector('.buy-btn').addEventListener('click', () => this.buyItem(item));
            this.shopItemsGrid.appendChild(el);
        });
    }

    buyItem(item) {
        if (item.locked) return;
        const finalPrice = Math.max(1, Math.floor(item.price));
        if ((this.game.coins || 0) < finalPrice) return;
        this.game.coins -= finalPrice;
        Sound.play('buy');
        const player = this.game.party[0];

        if (item.passItem) {
            player.hasCloudPass = true;
            this.game.showDialogue('System', 'You bought the Cloud Stair Pass! It shimmers in your hands. Take it to the Stairs of Foam, far north of Makani Village, and show it to the Sky Guards.');
        } else if (item.weaponData) {
            player.equippedWeapon = { ...item.weaponData };
            this.game.showDialogue('System', `Equipped ${item.name}!`);
        } else if (item.stat) {
            player[item.stat] += item.val;
            if (item.stat === 'maxHp') player.hp += item.val;
            if (item.stat === 'maxMp') player.mp += item.val;
            if (item.stat === 'maxStamina') player.stamina += item.val;
            this.game.showDialogue('System', `Bought ${item.name}!`);
        }

        this.updateCoinDisplay();
        this.game.updateHUD();
        this.renderItems();
    }
}

class SettingsSystem {
    constructor(gameSystem) {
        this.game = gameSystem;
        this.settingsUI = document.getElementById('settings-ui');
        this.pauseUI = document.getElementById('pause-ui');

        this.volSlider = document.getElementById('volume-slider');
        this.invincToggle = document.getElementById('invincible-toggle');
        this.mirrorToggle = document.getElementById('mirror-toggle');
        this.colorPicker = document.getElementById('theme-color-picker');

        this.pauseVolSlider = document.getElementById('pause-volume-slider');
        this.pauseInvincToggle = document.getElementById('pause-invincible-toggle');
        this.pauseMirrorToggle = document.getElementById('pause-mirror-toggle');
        this.pauseColorPicker = document.getElementById('pause-theme-color-picker');

        this.godMode = false;
        this.mirrorMode = false;
        this.volume = 50;
        this.themeColor = '#fbbf24';

        this.bindEvents();
        try { const v = localStorage.getItem('glitching-tales-volume'); if (v !== null) this.setVolume(v); else Sound.setVolume(this.volume); } catch (e) { Sound.setVolume(this.volume); }
    }

    bindEvents() {
        document.getElementById('close-settings-btn').addEventListener('click', () => this.closeSettings());
        document.getElementById('resume-btn').addEventListener('click', () => this.closePauseMenu());
        document.getElementById('resume-main-btn').addEventListener('click', () => this.closePauseMenu());

        this.volSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.invincToggle.addEventListener('change', (e) => this.setGodMode(e.target.checked));
        this.mirrorToggle.addEventListener('change', (e) => this.setMirrorMode(e.target.checked));
        this.colorPicker.addEventListener('input', (e) => this.setThemeColor(e.target.value));

        this.pauseVolSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.pauseInvincToggle.addEventListener('change', (e) => this.setGodMode(e.target.checked));
        this.pauseMirrorToggle.addEventListener('change', (e) => this.setMirrorMode(e.target.checked));
        this.pauseColorPicker.addEventListener('input', (e) => this.setThemeColor(e.target.value));

        // Save / Flow Song / quit buttons in the pause menu
        const saveBtn = document.getElementById('pause-save-btn');
        const flowBtn = document.getElementById('pause-flow-btn');
        const quitBtn = document.getElementById('pause-quit-btn');
        saveBtn.addEventListener('click', () => {
            const ok = SaveGame.save(true);
            saveBtn.textContent = ok ? '✅ Game saved!' : "⚠️ Can't save right now";
            setTimeout(() => { saveBtn.textContent = '💾 Save Game'; }, 1800);
        });
        flowBtn.addEventListener('click', () => {
            Sound.setFlow(!Sound.flowOn);
            this.refreshPauseButtons();
        });
        quitBtn.addEventListener('click', () => {
            if (SaveGame.save(true) || !SaveGame.canSave()) location.reload();
        });

        document.getElementById('moveset-guide-btn').addEventListener('click', () => this.openMovesetGuide());
        document.getElementById('close-moveset-btn').addEventListener('click', () => {
            document.getElementById('moveset-modal').classList.add('hidden');
        });
    }

    openMovesetGuide() {
        const modal = document.getElementById('moveset-modal');
        const content = document.getElementById('moveset-content');
        let html = '';
        this.game.party.forEach(hero => {
            html += `<h3 style="color:var(--primary-color); margin-top:15px; border-bottom:1px solid #555;">${hero.name}</h3>`;
            if (hero.equippedWeapon) {
                const w = hero.equippedWeapon;
                html += `<p style="font-size:0.9em; color:#ccc;">Equipped: <strong>${w.name}</strong> (${w.playStyle}) - Power ${w.power}${w.skillType ? `, matches ${w.skillType}` : ''}</p>`;
            }
            if (hero.abilities) {
                html += `<ul style="list-style-type:none; padding-left:10px;">`;
                hero.abilities.forEach(ab => {
                    html += `<li style="margin-bottom:8px;"><strong>${ab.name}</strong> - ${ab.description || ''}</li>`;
                });
                html += `</ul>`;
            }
        });
        content.innerHTML = html;
        modal.classList.remove('hidden');
    }

    setVolume(val) {
        this.volume = val;
        this.volSlider.value = val;
        this.pauseVolSlider.value = val;
        Sound.setVolume(Number(val));
        try { localStorage.setItem('glitching-tales-volume', String(val)); } catch (e) {}
    }

    // Show the Flow Song button only once you've found it, and keep its label up to date.
    refreshPauseButtons() {
        const flowBtn = document.getElementById('pause-flow-btn');
        if (!flowBtn) return;
        flowBtn.classList.toggle('hidden', !this.game.flowSongUnlocked);
        flowBtn.textContent = Sound.flowOn ? '🎵 Flow Song: ON' : '🎵 Flow Song: OFF';
    }

    setGodMode(val) {
        this.godMode = val;
        this.invincToggle.checked = val;
        this.pauseInvincToggle.checked = val;
        this.game.godMode = val;
    }

    setMirrorMode(val) {
        this.mirrorMode = val;
        this.mirrorToggle.checked = val;
        this.pauseMirrorToggle.checked = val;
        document.body.classList.toggle('mirror-mode', val);
    }

    setThemeColor(val) {
        this.themeColor = val;
        this.colorPicker.value = val;
        this.pauseColorPicker.value = val;
        document.documentElement.style.setProperty('--primary-color', val);
    }

    openSettings() {
        this.settingsUI.classList.remove('hidden');
        if (overworld3d && overworld3d.controls) overworld3d.controls.unlock();
        this.game.state = 'settings';
    }

    closeSettings() {
        this.settingsUI.classList.add('hidden');
        if (overworld3d && overworld3d.controls) overworld3d.controls.lock();
        this.game.state = (window.GravityCore && GravityCore.active) ? 'core' : 'overworld';
    }

    openPauseMenu() {
        if (window.KiteRace && KiteRace.active) { KiteRace.end('quit'); return; }   // (the Pause button cancels the kite race)
        this.refreshPauseButtons();
        this.pauseUI.classList.remove('hidden');
        if (overworld3d && overworld3d.controls) overworld3d.controls.unlock();
        this.game.state = 'paused';
    }

    closePauseMenu() {
        this.pauseUI.classList.add('hidden');
        if (overworld3d && overworld3d.controls) overworld3d.controls.lock();
        this.game.state = (window.GravityCore && GravityCore.active) ? 'core' : 'overworld';
    }
}

window.onload = () => {
    window.gameSystem = new GameSystem3D();
    window.shopSystem = new ShopSystem(window.gameSystem);
    window.settingsSystem = new SettingsSystem(window.gameSystem);

    document.getElementById('chapter-end-menu-btn').addEventListener('click', () => location.reload());

    const controlsUI = document.getElementById('ui-layer');
    if (controlsUI) {
        const pauseBtn = document.createElement('button');
        pauseBtn.innerText = '⏸️ Pause';
        pauseBtn.style.position = 'absolute';
        pauseBtn.style.top = '20px';
        pauseBtn.style.right = '20px';
        pauseBtn.style.padding = '10px 20px';
        pauseBtn.style.background = 'rgba(0,0,0,0.7)';
        pauseBtn.style.color = 'white';
        pauseBtn.style.border = '2px solid var(--primary-color)';
        pauseBtn.style.borderRadius = '8px';
        pauseBtn.style.fontWeight = 'bold';
        pauseBtn.style.cursor = 'pointer';
        pauseBtn.style.pointerEvents = 'auto';
        pauseBtn.addEventListener('click', () => {
            window.settingsSystem.openPauseMenu();
        });
        controlsUI.appendChild(pauseBtn);
    }
};
