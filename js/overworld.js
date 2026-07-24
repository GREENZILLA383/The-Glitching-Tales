class Overworld {
    constructor() {
        this.canvas = document.getElementById('overworld-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.tileSize = 40;
        
        this.player = {
            x: 5,
            y: 5,
            sprite: SVGS.glitch,
            image: null
        };

        // Cache for SVG images
        this.imageMap = {};
        this.preloadSVGs();

        // Background image
        this.bgImage = new Image();
        this.bgImage.src = 'assets/mario_world_bg_1783460841676.jpg';

        // Map layout (0 = empty, 1 = invisible collision, 2 = enemy, 3 = portal boss)
        this.map = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,3,1],
            [1,0,1,1,0,0,1,0,0,1,1,1,1,1,0,0,0,0,0,1],
            [1,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,2,0,0,1],
            [1,0,0,1,0,0,2,0,0,0,0,0,0,1,0,0,0,0,0,1],
            [1,0,0,1,1,1,1,0,0,1,1,1,1,1,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,2,0,0,0,1,1,1,0,0,0,0,0,0,0,2,0,0,1],
            [1,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,1,0,1,0,0,0,1,1,1,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ];

        this.currentWorldTheme = 'mario';
        this.bindInput();
    }

    preloadSVGs() {
        const createImg = (svgString, key) => {
            const img = new Image();
            const blob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
            const url = URL.createObjectURL(blob);
            img.src = url;
            this.imageMap[key] = img;
        };

        createImg(SVGS.glitch, 'player');
        createImg(SVGS.goomba, 'enemy');
        createImg(SVGS.boss_bowser, 'boss');
    }

    start() {
        this.gameLoop();
    }

    bindInput() {
        document.addEventListener('keydown', (e) => {
            if (window.gameSystem && window.gameSystem.state !== 'overworld') return;

            let newX = this.player.x;
            let newY = this.player.y;

            if (e.key === 'ArrowUp' || e.key === 'w') newY--;
            if (e.key === 'ArrowDown' || e.key === 's') newY++;
            if (e.key === 'ArrowLeft' || e.key === 'a') newX--;
            if (e.key === 'ArrowRight' || e.key === 'd') newX++;

            // Collision check
            if (newX >= 0 && newX < this.map[0].length && newY >= 0 && newY < this.map.length) {
                const tile = this.map[newY][newX];
                if (tile !== 1) { // 1 is solid wall
                    this.player.x = newX;
                    this.player.y = newY;
                    this.checkTileInteraction(tile, newX, newY);
                }
            }
        });
    }

    checkTileInteraction(tile, x, y) {
        if (tile === 2) {
            // Encounter
            this.map[y][x] = 0; // Remove enemy from map
            if (window.gameSystem) {
                window.gameSystem.triggerEncounter(false);
            }
        } else if (tile === 3) {
            // Boss Encounter
            this.map[y][x] = 0; 
            if (window.gameSystem) {
                window.gameSystem.triggerEncounter(true);
            }
        }
    }

    setWorld(themeName) {
        this.currentWorldTheme = themeName;
        this.player.x = 5;
        this.player.y = 5;
        
        // Repopulate encounters
        this.map[3][16] = 2;
        this.map[9][2] = 2;
        this.map[1][18] = 3; // Boss at the portal
    }

    draw() {
        // Draw Pre-rendered Background
        if (this.bgImage.complete) {
            this.ctx.drawImage(this.bgImage, 0, 0, this.width, this.height);
        } else {
            this.ctx.fillStyle = '#1e293b';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        // Draw Map Objects
        for (let y = 0; y < this.map.length; y++) {
            for (let x = 0; x < this.map[y].length; x++) {
                const tile = this.map[y][x];
                
                if (tile === 2 && this.imageMap['enemy']) {
                    this.ctx.drawImage(this.imageMap['enemy'], x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
                } else if (tile === 3 && this.imageMap['boss']) {
                    this.ctx.drawImage(this.imageMap['boss'], x * this.tileSize, y * this.tileSize, this.tileSize * 1.5, this.tileSize * 1.5);
                }
            }
        }

        // Draw Player
        if (this.imageMap['player']) {
            this.ctx.drawImage(this.imageMap['player'], this.player.x * this.tileSize, this.player.y * this.tileSize, this.tileSize, this.tileSize);
        }
    }

    gameLoop() {
        if (window.gameSystem && window.gameSystem.state === 'overworld') {
            this.draw();
        }
        requestAnimationFrame(() => this.gameLoop());
    }
}

const overworld = new Overworld();
