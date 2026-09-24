// Builds a character from simple smooth primitives (spheres, capsules, cones...) so
// models read as rounded, cartoony figures instead of stacked cubes.
// parts = [{ shape?: 'sphere'|'capsule'|'cylinder'|'cone'|'torus'|'box', size: [w,h,d], pos: [x,y,z],
//            rot?: [x,y,z], color: '#hex', opacity?: 0-1, emissive?: '#hex', taper?: 0-1, name?: string }]
// `size` is the part's bounding box; `taper` (cylinders only) scales the top radius.
class VoxelBuilder {
    static geometryFor(part) {
        const [w, h, d] = part.size;
        switch (part.shape) {
            case 'sphere': {
                const g = new THREE.SphereGeometry(0.5, 20, 14);
                g.scale(w, h, d);
                return g;
            }
            case 'capsule': {
                // Lathe a pill profile so the rounded ends stay round even when the part is long.
                const r = 0.5 * Math.min(w, d);
                const straight = Math.max(0, h - 2 * r);
                const pts = [];
                const steps = 8;
                for (let i = 0; i <= steps; i++) {
                    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
                    pts.push(new THREE.Vector2(Math.cos(a) * r, -straight / 2 + Math.sin(a) * r));
                }
                for (let i = 0; i <= steps; i++) {
                    const a = (i / steps) * (Math.PI / 2);
                    pts.push(new THREE.Vector2(Math.cos(a) * r, straight / 2 + Math.sin(a) * r));
                }
                const g = new THREE.LatheGeometry(pts, 16);
                g.scale(w / (2 * r), 1, d / (2 * r));
                return g;
            }
            case 'cylinder': {
                const taper = part.taper !== undefined ? part.taper : 1;
                const g = new THREE.CylinderGeometry(0.5 * taper, 0.5, 1, 18);
                g.scale(w, h, d);
                return g;
            }
            case 'cone': {
                const g = new THREE.ConeGeometry(0.5, 1, 18);
                g.scale(w, h, d);
                return g;
            }
            case 'torus': {
                // Ring standing upright in the XY plane; `size` is its outer width/height/thickness.
                const g = new THREE.TorusGeometry(0.5 - d / 2, d / 2, 8, 20);
                g.scale(w, h, 1);
                return g;
            }
            default:
                return new THREE.BoxGeometry(w, h, d);
        }
    }

    static buildCharacter(parts) {
        const group = new THREE.Group();
        const materialMap = {}; // Cache materials, keyed by color+opacity+emissive

        parts.forEach(part => {
            const opacity = part.opacity !== undefined ? part.opacity : 1;
            const matKey = part.color + '|' + opacity + '|' + (part.emissive || '');
            if (!materialMap[matKey]) {
                materialMap[matKey] = new THREE.MeshStandardMaterial({
                    color: part.color,
                    roughness: 0.55,
                    metalness: 0.05,
                    emissive: part.emissive || 0x000000,
                    emissiveIntensity: part.emissive ? 0.8 : 0,
                    transparent: opacity < 1,
                    opacity: opacity
                });
            }

            const mesh = new THREE.Mesh(VoxelBuilder.geometryFor(part), materialMap[matKey]);
            mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
            if (part.rot) mesh.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
            mesh.castShadow = opacity >= 1;
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
