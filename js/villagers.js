// The villagers of Makani Village. They are in the style of classic "village folk": a big head, a long robe and
// arms folded in front - but NOT bald, with NO nose, and with outfits that fit the sky (cloud collars, stars,
// moons, kites, feathers, wind scarves). They can talk: walk up and press E (or tap 💬 on a phone).
//
// To change a villager, edit their entry below: look (skin / robe / trim / accent / hair / hairStyle / extra)
// and what they say (intro = the first conversation, chat = the things they say afterwards).
const VILLAGERS = [
    { id: 'kekoa', name: 'Kekoa', title: 'the Elder', skin: '#e8b98a', robe: '#f4f7ff', trim: '#f2c14e', accent: '#f2c14e', hair: '#f2f2f2', hairStyle: 'elder', extra: 'cloudhat', pattern: 'sun',
      intro: ['Welcome to Makani Village, traveler! I am Kekoa, the eldest of the wind-folk.',
              'Our roads are made of cloud, and our houses are held up by the sky itself. Mind your step near the edges!',
              'Say hello to everyone. The wind carries all the news in the sky, and we hear it first.'],
      chat: ['The wind is gentle today. That is a very good sign.',
             'Far beyond our village there is a great Stairway of Clouds, guarded by two sky guards: Stratus the calm and Cirro the quick. Be ready when you meet them.',
             'You came on Wisp, did you not? That cloud is the kindest soul in the whole sky.'] },
    { id: 'lani', name: 'Lani', title: 'the Cloud Singer', skin: '#f0c6a0', robe: '#8fd0ff', trim: '#ffffff', accent: '#3f8fe8', hair: '#2a1d3a', hairStyle: 'long', extra: 'headband', pattern: 'swirl',
      intro: ['Hi hi! I am Lani! I sing to the clouds, and the clouds sing back!', 'Listen... can you hear the humming? That is our windmills. Makani always hums.'],
      chat: ['I wrote a new song today. It goes la la LAAA. It is still a work in progress.', 'Clouds love high notes. Stars love low ones. Everybody has a favorite!'] },
    { id: 'hoku', name: 'Hoku', title: 'the Stargazer', skin: '#c68a5e', robe: '#27346e', trim: '#b8c4ff', accent: '#ffe27a', hair: '#cfd6ff', hairStyle: 'spiky', extra: 'starpin', pattern: 'stars',
      intro: ['I am Hoku. I watch the stars from up here. They are so close you could almost pick one!', 'Between us, I think the stars watch us back.'],
      chat: ['Past the clouds there is a sun that holds all of time inside it. Old stories say there is a gate to it up here.', 'I counted nine hundred stars last night. Then I fell asleep. I will start again tonight.'] },
    { id: 'iolana', name: 'Iolana', title: 'the Kite Pilot', skin: '#d9a273', robe: '#ff9a5a', trim: '#ffe0b0', accent: '#ff5a7a', hair: '#5a3418', hairStyle: 'bob', extra: 'goggles', pattern: 'sun',
      intro: ['Iolana here, the best kite pilot in the whole sky! Want to hear my record?', 'Four whole minutes without touching the ground. Not that there is any ground up here. Ha!', 'Oh, and if you want to fly my kite, just talk to me again. I have a race!'],
      chat: ['I keep thinking about a kite race around the village. Want to try it?', 'The trick to flying is to stop worrying about falling. The clouds will catch you. Mostly.'] },
    { id: 'malie', name: 'Malie', title: 'the Cloud Gardener', skin: '#f2d0b0', robe: '#cdb8ff', trim: '#ffffff', accent: '#ff8ac0', hair: '#ff9fc4', hairStyle: 'bun', extra: 'flowers', pattern: 'dots',
      intro: ['Oh, hello. I am Malie. I grow flowers out of fluffy cloud-soil.', 'They only bloom when it is very, very quiet. Please do not sneeze.'],
      chat: ['Sky flowers taste like peaches and cold air. I would not recommend eating them, but I do.', 'Watering is easy up here. The rain does it for me, whenever I forget.'] },
    { id: 'aheahe', name: 'Aheahe', title: 'the Feather Messenger', skin: '#b87a52', robe: '#7ae0c8', trim: '#e8fff8', accent: '#1fa890', hair: '#1fa890', hairStyle: 'ponytail', extra: 'feather', pattern: 'swirl',
      intro: ['Message for you! Well, not really. I just like saying that. I am Aheahe!', 'I carry news between all the sky villages on a single feather. I am very fast. Very, VERY fast.'],
      chat: ['Everyone is talking about the great cloud that carried a hero up from below. That is you!', 'The last message I delivered said: "Something is stirring above the Sky Kingdom." Nobody knows what yet.'] },
    { id: 'noelani', name: 'Noelani', title: 'the Mist Weaver', skin: '#f4d6b6', robe: '#ffc9dc', trim: '#fff0f6', accent: '#ffffff', hair: '#e8b84a', hairStyle: 'curly', extra: 'mistscarf', pattern: 'dots',
      intro: ['Shh, listen. I am Noelani. I weave scarves out of morning mist.', 'Feel that? It is the softest thing in the sky. And it only lasts until noon.'],
      chat: ['My scarves melt if you hold them too tightly. That is how you know they are real.', 'If you ever need a hug, find a cloud. If you need a scarf, find me.'] },
    { id: 'mahina', name: 'Mahina', title: 'the Moon Watcher', skin: '#e9c9a8', robe: '#d6dce8', trim: '#8f9ab8', accent: '#e8f0ff', hair: '#101420', hairStyle: 'long', extra: 'moon', pattern: 'moon',
      intro: ['...Oh. A visitor. I am Mahina. I sleep by day and watch the moon by night.', 'Forgive me if I yawn. The moon keeps very late hours.'],
      chat: ['I have felt something odd lately, like the whole sky is holding its breath.', 'The moon never talks back, but she is an excellent listener.'] },
    // The trader. He is NOT one of the eight who live in the round houses: he runs the Cloud Market (its own building) and talking to him opens the shop.
    { id: 'cashato', name: 'Cashato', title: 'the Cloud Trader', shop: 'cashato', skin: '#b9784c', robe: '#ffd76a', trim: '#ff8a3d', accent: '#2fb5a8', hair: '#3a2616', hairStyle: 'bob', extra: 'merchant', pattern: 'coins',
      intro: ['Ho ho! Cashato is the name and trading is the game! I swap coins for the finest gear in the sky.',
              'Cloud Spears, Cloud Arrows... everything here is spun from real cloud. Light as air, sharp as a thunderclap!',
              'And one day I will have something very special for sale: a Cloud Stair Pass. But that is a story for another day. Now, what can I get you?'],
      chat: ['Welcome back, my friend! A coin saved is a cloud earned.', 'Everything in my shop is made by hand. Well... by wind, mostly.', 'About that Cloud Stair Pass... patience, patience. Good things take time to float down!'] }
];

// Parts for one villager (feet on y = 0, about 5 tall). `head` and `scarf` hang from pivots so they can move.
function buildVillagerParts(v) {
    const P = [], add = (p) => { P.push(p); return p; };
    const hair = v.hair, skin = v.skin;
    // feet, robe, trim and sash
    [-1, 1].forEach(s => add({ shape: 'sphere', size: [0.75, 0.42, 1.0], pos: [s * 0.45, 0.21, 0.15], color: '#5a3a24' }));
    add({ shape: 'cylinder', size: [2.1, 3.0, 1.6], taper: 0.6, pos: [0, 1.75, 0], color: v.robe, name: 'robe' });
    add({ shape: 'cylinder', size: [2.14, 0.34, 1.64], pos: [0, 0.34, 0], color: v.trim });
    add({ shape: 'cylinder', size: [1.62, 0.3, 1.26], pos: [0, 2.0, 0], color: v.accent });
    add({ shape: 'sphere', size: [1.55, 0.75, 1.25], pos: [0, 3.15, 0], color: v.robe });
    // arms folded across the chest, with the hands meeting in the middle
    add({ shape: 'capsule', size: [0.58, 2.1, 0.58], pos: [0, 2.6, 0.62], rot: [0, 0, Math.PI / 2], color: v.robe });
    add({ shape: 'capsule', size: [0.6, 2.12, 0.6], pos: [0, 2.46, 0.7], rot: [0, 0, Math.PI / 2], color: v.trim });   // the cuffs
    [-0.38, 0.38].forEach(x => add({ shape: 'sphere', size: [0.42, 0.42, 0.42], pos: [x, 2.52, 1.0], color: skin }));
    // sky-theme pattern on the robe
    if (v.pattern === 'stars') [[-0.55, 1.2], [0.5, 0.9], [-0.2, 0.5], [0.6, 1.6], [-0.6, 1.7]].forEach(([x, y]) => add({ shape: 'sphere', size: [0.2, 0.2, 0.1], pos: [x, y, 0.82 - Math.abs(x) * 0.15], color: '#ffe27a', emissive: '#ffcc33' }));
    if (v.pattern === 'sun') add({ shape: 'sphere', size: [0.75, 0.75, 0.14], pos: [0, 1.25, 0.84], color: '#ffd24a', emissive: '#ffae00' });
    if (v.pattern === 'swirl') [[0.8, 0.0], [1.15, 0.35], [0.6, -0.3]].forEach(([y, x]) => add({ shape: 'torus', size: [0.7, 0.7, 0.1], pos: [x * 0.8, y + 0.2, 0.84], color: '#ffffff' }));
    if (v.pattern === 'dots') [[-0.5, 1.3], [0.55, 1.0], [0, 0.7], [-0.4, 0.5], [0.45, 1.6]].forEach(([x, y]) => add({ shape: 'sphere', size: [0.3, 0.3, 0.1], pos: [x, y, 0.82 - Math.abs(x) * 0.15], color: '#ffffff' }));
    if (v.pattern === 'moon') add({ shape: 'torus', size: [0.9, 0.9, 0.16], pos: [0, 1.4, 0.85], color: '#ffffff', emissive: '#bcd0ff' });
    if (v.pattern === 'coins') [[-0.5, 1.35], [0.5, 1.05], [0, 0.7], [-0.45, 0.5], [0.45, 1.65]].forEach(([x, y]) => add({ shape: 'cylinder', size: [0.42, 0.1, 0.42], pos: [x, y, 0.84 - Math.abs(x) * 0.15], rot: [Math.PI / 2, 0, 0], color: '#ffd24a', emissive: '#ffae00' }));
    // a collar of little clouds round the neck
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add({ shape: 'sphere', size: [0.5, 0.42, 0.5], pos: [Math.sin(a) * 0.72, 3.5, Math.cos(a) * 0.62], color: '#ffffff' }); }
    add({ shape: 'cylinder', size: [0.55, 0.35, 0.55], pos: [0, 3.62, 0], color: skin });
    // the scarf / little cape that flutters in the wind
    add({ shape: 'capsule', size: [0.9, 2.5, 0.24], pos: [0, 2.5, -0.85], rot: [0.1, 0, 0], color: v.accent, name: 'scarf', pivot: [0, 3.5, -0.75] });
    // the head: big and round, a single eyebrow, big eyes, a tiny mouth - and NO nose
    add({ shape: 'sphere', size: [1.55, 1.7, 1.5], pos: [0, 4.35, 0], color: skin, name: 'head', pivot: [0, 3.6, 0] });
    [-1, 1].forEach(s => {
        add({ shape: 'sphere', size: [0.42, 0.36, 0.14], pos: [s * 0.4, 4.4, 0.7], color: '#ffffff', follow: 'head' });
        add({ shape: 'sphere', size: [0.24, 0.3, 0.12], pos: [s * 0.4, 4.38, 0.77], color: v.accent === '#ffffff' ? '#5aa0e8' : v.accent, follow: 'head' });
        add({ shape: 'sphere', size: [0.12, 0.14, 0.1], pos: [s * 0.4, 4.38, 0.83], color: '#1a1a24', follow: 'head' });
        add({ shape: 'sphere', size: [0.38, 0.22, 0.1], pos: [s * 0.72, 4.05, 0.66], color: '#ff9a9a', follow: 'head' });   // rosy cheeks
    });
    add({ shape: 'capsule', size: [0.16, 1.15, 0.16], pos: [0, 4.72, 0.72], rot: [0, 0, Math.PI / 2], color: hair, follow: 'head' });   // the one long eyebrow
    add({ shape: 'capsule', size: [0.13, 0.42, 0.12], pos: [0, 3.93, 0.74], rot: [0, 0, Math.PI / 2], color: '#7a3a3a', follow: 'head' });   // a small mouth
    // hair (everyone has some!)
    const H = (shape, size, pos, rot) => add({ shape, size, pos, rot, color: hair, follow: 'head' });
    H('sphere', [1.68, 1.05, 1.62], [0, 4.95, -0.06]);                                                  // the cap of hair
    if (v.hairStyle === 'bob') { [-1, 1].forEach(s => H('capsule', [0.55, 1.5, 0.6], [s * 0.82, 4.25, -0.1])); }
    if (v.hairStyle === 'long') { [-1, 1].forEach(s => H('capsule', [0.5, 1.6, 0.55], [s * 0.8, 4.1, -0.1])); H('capsule', [1.5, 2.6, 0.55], [0, 3.8, -0.7]); }
    if (v.hairStyle === 'spiky') { [[0, 5.65, 0, 0], [-0.55, 5.5, 0, 0.5], [0.55, 5.5, 0, -0.5], [0, 5.5, -0.5, 0], [0, 5.45, 0.45, 0]].forEach(([x, y, z, r]) => H('cone', [0.5, 1.0, 0.5], [x, y, z], [z > 0 ? 0.5 : z < 0 ? -0.5 : 0, 0, r])); }
    if (v.hairStyle === 'bun') H('sphere', [0.85, 0.85, 0.85], [0, 5.65, -0.25]);
    if (v.hairStyle === 'ponytail') { H('capsule', [0.5, 1.9, 0.5], [0, 4.0, -1.0], [0.45, 0, 0]); }
    if (v.hairStyle === 'curly') { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; H('sphere', [0.6, 0.6, 0.6], [Math.sin(a) * 0.85, 4.95 + (i % 2) * 0.25, Math.cos(a) * 0.8 - 0.1]); } }
    if (v.hairStyle === 'elder') { [-1, 1].forEach(s => H('sphere', [0.55, 0.9, 0.55], [s * 0.8, 4.35, -0.1])); [[0, 3.75, 0.62, 0.6], [-0.38, 3.8, 0.55, 0.45], [0.38, 3.8, 0.55, 0.45], [0, 3.45, 0.5, 0.5]].forEach(([x, y, z, s]) => add({ shape: 'sphere', size: [s, s * 0.9, s * 0.8], pos: [x, y, z], color: '#ffffff', follow: 'head' })); }   // a fluffy cloud beard
    // the extra bit of sky-theme dress
    const X = (p) => add(Object.assign({ follow: 'head' }, p));
    if (v.extra === 'cloudhat') { X({ shape: 'cylinder', size: [1.5, 0.3, 1.5], pos: [0, 5.45, 0], color: v.accent }); X({ shape: 'cone', size: [1.3, 1.7, 1.3], pos: [0, 6.3, 0], color: '#ffffff' }); X({ shape: 'sphere', size: [0.5, 0.5, 0.5], pos: [0, 7.2, 0], color: '#ffffff' }); }
    if (v.extra === 'headband') { X({ shape: 'cylinder', size: [1.74, 0.22, 1.68], pos: [0, 5.0, -0.02], color: v.accent }); X({ shape: 'sphere', size: [0.55, 0.45, 0.4], pos: [0.62, 5.1, 0.6], color: '#ffffff' }); }
    if (v.extra === 'starpin') { X({ shape: 'sphere', size: [0.5, 0.14, 0.14], pos: [-0.7, 5.3, 0.55], color: '#ffe27a', emissive: '#ffcc33' }); X({ shape: 'sphere', size: [0.14, 0.5, 0.14], pos: [-0.7, 5.3, 0.55], color: '#ffe27a', emissive: '#ffcc33' }); }
    if (v.extra === 'goggles') { [-1, 1].forEach(s => X({ shape: 'cylinder', size: [0.62, 0.36, 0.62], pos: [s * 0.42, 5.18, 0.55], rot: [Math.PI / 2 - 0.5, 0, 0], color: '#2a2a3a' })); [-1, 1].forEach(s => X({ shape: 'sphere', size: [0.5, 0.2, 0.5], pos: [s * 0.42, 5.2, 0.7], rot: [Math.PI / 2 - 0.5, 0, 0], color: '#9fe8ff', emissive: '#4ab8e8' })); X({ shape: 'cylinder', size: [1.72, 0.18, 1.66], pos: [0, 5.05, -0.02], color: '#2a2a3a' }); }
    if (v.extra === 'flowers') { [[0.85, 5.1, 0.35, '#ff7ab0'], [0.95, 4.85, 0.1, '#ffd84a'], [0.7, 5.3, 0.1, '#ffffff'], [0.9, 4.7, 0.4, '#a98aff']].forEach(([x, y, z, c]) => X({ shape: 'sphere', size: [0.34, 0.34, 0.2], pos: [x, y, z], color: c })); }
    if (v.extra === 'feather') { X({ shape: 'capsule', size: [0.22, 1.7, 0.14], pos: [0.95, 5.55, -0.05], rot: [0, 0, -0.45], color: '#ffffff' }); X({ shape: 'capsule', size: [0.12, 1.2, 0.1], pos: [1.1, 5.5, -0.05], rot: [0, 0, -0.45], color: v.accent }); }
    if (v.extra === 'mistscarf') { add({ shape: 'sphere', size: [1.5, 0.45, 1.3], pos: [0, 3.3, 0], color: '#ffffff', opacity: 0.8 }); }
    if (v.extra === 'moon') { add({ shape: 'torus', size: [0.55, 0.55, 0.12], pos: [0, 3.0, 0.8], color: '#e8f0ff', emissive: '#aab8ff' }); }
    if (v.extra === 'merchant') {   // a round trader's hat with a gold coin on the front, and a fat coin pouch at the hip
        X({ shape: 'cylinder', size: [1.95, 0.2, 1.9], pos: [0, 5.3, 0], color: v.accent });
        X({ shape: 'sphere', size: [1.4, 1.0, 1.35], pos: [0, 5.85, 0], color: v.accent });
        X({ shape: 'cylinder', size: [0.6, 0.1, 0.6], pos: [0, 5.75, 1.16], rot: [Math.PI / 2, 0, 0], color: '#ffd24a', emissive: '#ffae00' });
        X({ shape: 'sphere', size: [0.3, 0.3, 0.3], pos: [0, 6.45, 0], color: '#ffd24a', emissive: '#ffae00' });
        add({ shape: 'sphere', size: [0.7, 0.8, 0.6], pos: [1.0, 1.5, 0.35], color: '#7a4a2a' });
        add({ shape: 'sphere', size: [0.3, 0.25, 0.3], pos: [1.0, 2.0, 0.35], color: '#ffd24a', emissive: '#ffae00' });
    }
    // big feathered wings that can flap (the bully's); each hangs from a shoulder pivot called wing_l / wing_r
    if (v.wings) [[-1, 'wing_l'], [1, 'wing_r']].forEach(([s, nm]) => {
        add({ shape: 'capsule', size: [0.5, 2.8, 0.16], pos: [s * 1.7, 3.9, -1.1], rot: [0, 0, -s * 0.75], color: '#ffffff', name: nm, pivot: [s * 0.9, 3.1, -0.85] });
        add({ shape: 'capsule', size: [0.42, 2.3, 0.14], pos: [s * 2.1, 3.3, -1.15], rot: [0, 0, -s * 0.95], color: '#e8eefc', follow: nm });
        add({ shape: 'capsule', size: [0.36, 1.8, 0.12], pos: [s * 2.35, 2.7, -1.2], rot: [0, 0, -s * 1.15], color: '#cfd9f2', follow: nm });
    });
    if (v.extra === 'schoolcap') {   // a flat square school cap with a gold tassel (cloud school!)
        X({ shape: 'cylinder', size: [1.3, 0.5, 1.3], pos: [0, 5.25, 0], color: '#2b2f6e' });
        X({ shape: 'box', size: [2.2, 0.16, 2.2], pos: [0, 5.55, 0], color: '#2b2f6e' });
        X({ shape: 'capsule', size: [0.12, 0.8, 0.12], pos: [1.0, 5.2, 0], color: '#ffcf4a', emissive: '#ffae00' });
    }
    return P;
}

function buildVillager3D(v) { return VoxelBuilder.buildCharacter(buildVillagerParts(v)); }
