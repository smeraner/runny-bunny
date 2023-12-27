import * as THREE from 'three';

export class WorldItemEgg extends THREE.Object3D implements WorldItem {

    static model: THREE.LatheGeometry;
    static eggMaterials = [
        new THREE.MeshLambertMaterial({ color: 0xffff00 }),
        new THREE.MeshLambertMaterial({ color: 0xff0000 }),
        new THREE.MeshLambertMaterial({ color: 0x00ff00 }),
        new THREE.MeshLambertMaterial({ color: 0x0000ff }),
        new THREE.MeshLambertMaterial({ color: 0x00ffff }),
    ];

    static initialize() {
        const points = [];

        for ( let deg = 0; deg <= 180; deg += 6 ) {
            const rad = Math.PI * deg / 180;
            const point = new THREE.Vector2( ( 0.72 + .08 * Math.cos( rad ) ) * Math.sin( rad ), - Math.cos( rad ) ); // the "egg equation"
            points.push( point );
        }

        WorldItemEgg.model = new THREE.LatheGeometry(points);
    }
    
    isCollectable = true;
    isObstacle = false;

    constructor() {
        super();

        const mesh = new THREE.Mesh(WorldItemEgg.model, WorldItemEgg.eggMaterials[Math.floor(Math.random() * WorldItemEgg.eggMaterials.length)]);
        mesh.castShadow = true;
        mesh.scale.set(0.3, 0.3, 0.3);
        this.add(mesh);
    }

    collide(collideWithGlobalVector: THREE.Vector3): boolean {
        //get this world position
        const worldPosition = new THREE.Vector3();
        this.getWorldPosition(worldPosition);

        //get distance between this and collideWith
        const distance = worldPosition.distanceTo(collideWithGlobalVector);

        return distance < 0.5;    
    }

}
WorldItemEgg.initialize();