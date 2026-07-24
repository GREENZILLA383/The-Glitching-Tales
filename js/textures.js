const TextureLoader = new THREE.TextureLoader();

const TextureGenerator = {
    loadTexture: function(base64Str, repeat = false) {
        const tex = TextureLoader.load(base64Str);
        if (repeat) {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(50, 50);
        }
        return tex;
    },
    init: function() {
        this.grassTexture = this.loadTexture(ASSETS.texture_grass, true);
        this.dirtTexture = this.loadTexture(ASSETS.texture_dirt, true);
        
        // These can be smaller repeat or just single texture per face depending on geometry size
        this.woodTexture = this.loadTexture(ASSETS.texture_wood, false);
        this.metalTexture = this.loadTexture(ASSETS.texture_metal, false);
        this.brickTexture = this.loadTexture(ASSETS.texture_brick, false);
        this.leafTexture = this.loadTexture(ASSETS.texture_grass, false); // Reuse grass for leaves as a quick win
    }
};
