const STARTER_WEAPONS = {
    magick: { name: 'Spark Bolt', playStyle: 'magick', power: 12, skillType: 'magick', durability: null, maxDurability: null },
    melee: { name: 'Basic Slash', playStyle: 'melee', power: 14, skillType: 'melee', durability: null, maxDurability: null },
    range: { name: 'Quick Shot', playStyle: 'range', power: 12, skillType: 'range', durability: null, maxDurability: null }
};

const SKILL_DESCRIPTIONS = {
    magick: 'Spell-focused. Elemental attacks, time manipulation, arcane abilities.',
    melee: 'Close-range combat. Swords, axes, hammers. High strength and defense.',
    range: 'Long-distance combat. Bows, slings, crossbows. Precision and mobility.'
};

class CharacterCreationSystem {
    constructor() {
        this.ui = document.getElementById('character-creation-ui');
        this.nameInput = document.getElementById('cc-name-input');
        this.bodyColorInput = document.getElementById('cc-body-color');
        this.outfitColorInput = document.getElementById('cc-outfit-color');
        this.confirmBtn = document.getElementById('cc-confirm-btn');
        this.selectedSkillType = 'melee';

        this.ui.querySelectorAll('.cc-skill-btn').forEach(btn => {
            btn.addEventListener('click', () => this.selectSkillType(btn.dataset.skill));
        });
        this.selectSkillType('melee');

        this.confirmBtn.addEventListener('click', () => this.confirm());

        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.open());
        }
    }

    selectSkillType(skill) {
        this.selectedSkillType = skill;
        this.ui.querySelectorAll('.cc-skill-btn').forEach(btn => {
            btn.classList.toggle('cc-skill-selected', btn.dataset.skill === skill);
        });
        const desc = document.getElementById('cc-skill-desc');
        if (desc) desc.textContent = SKILL_DESCRIPTIONS[skill];
    }

    open() {
        document.getElementById('main-menu').classList.add('hidden');
        this.ui.classList.remove('hidden');
    }

    confirm() {
        const name = (this.nameInput.value || 'Traveler').trim().slice(0, 20) || 'Traveler';
        const bodyColor = this.bodyColorInput.value || '#e8b98a';
        const outfitColor = this.outfitColorInput.value || '#3b6ea5';
        const skillType = this.selectedSkillType;
        const weapon = { ...STARTER_WEAPONS[skillType] };

        const player = {
            id: 'player', name, isPlayerCharacter: true,
            skillType,
            appearance: { bodyColor, outfitColor },
            level: 1, exp: 0, expToNext: 50,
            maxHp: 100, hp: 100, maxMp: 50, mp: 50, maxStamina: 100, stamina: 100,
            attack: 14, defense: 10, speed: 5,
            hasGlider: false,
            invincibleUntil: 0,
            defaultWeapon: weapon,
            equippedWeapon: weapon,
            build3D: () => VoxelBuilder.buildCharacter(buildPlayerParts({ bodyColor, outfitColor }))
        };

        this.ui.classList.add('hidden');
        window.gameSystem.beginAdventure(player);
    }
}

window.addEventListener('load', () => {
    window.characterCreationSystem = new CharacterCreationSystem();
});
