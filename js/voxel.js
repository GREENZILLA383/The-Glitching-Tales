class VoxelBuilder {
    // Helper to create a blocky character from a set of parts
    // parts = [{ size: [w,h,d], pos: [x,y,z], color: '#hex' }]
    static buildCharacter(parts) {
        const group = new THREE.Group();
        const materialMap = {}; // Cache materials

        parts.forEach(part => {
            if (!materialMap[part.color]) {
                materialMap[part.color] = new THREE.MeshStandardMaterial({ 
                    color: part.color,
                    roughness: 0.7,
                    metalness: 0.1
                });
            }
            
            const geom = new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]);
            const mesh = new THREE.Mesh(geom, materialMap[part.color]);
            mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Add named parts if needed for animation
            if (part.name) {
                mesh.name = part.name;
            }
            
            group.add(mesh);
        });

        // Add a floating animation mixer for idle
        group.userData = {
            baseY: group.position.y,
            timeOffset: Math.random() * 10
        };

        return group;
    }
}
