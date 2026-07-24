const Assets = {
    images: {},
    loaded: 0,
    total: 7,
    
    init(onLoadComplete) {
        const imageList = {
            bg: "assets/bg_stage_1783991541873.jpg",
            player: "assets/player_cup_1783991494516.jpg",
            mario: "assets/boss_mario_1783991500974.jpg",
            gw: "assets/boss_gw_1783991508169.jpg",
            steve: "assets/boss_steve_1783991515148.jpg",
            dk: "assets/boss_dk_1783991527826.jpg",
            kirby: "assets/boss_kirby_1783991534824.jpg"
        };
        
        for (let key in imageList) {
            const img = new Image();
            img.src = imageList[key];
            img.onload = () => {
                this.loaded++;
                if (this.loaded === this.total) {
                    onLoadComplete();
                }
            };
            this.images[key] = img;
        }
    }
};
