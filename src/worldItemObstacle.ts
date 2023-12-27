import * as THREE from 'three';

export class WorldItemObstacle extends THREE.Object3D implements WorldItem {

    static model: THREE.LatheGeometry;
    static eggMaterials = [
        new THREE.MeshLambertMaterial({ color: 0x000000 }),
    ];

    static initialize() {
        const points = [];

        for ( let deg = 0; deg <= 180; deg += 6 ) {
            const rad = Math.PI * deg / 180;
            const point = new THREE.Vector2( ( 0.72 + .08 * Math.cos( rad ) ) * Math.sin( rad ), - Math.cos( rad ) ); // the "egg equation"
            points.push( point );
        }

        WorldItemObstacle.model = new THREE.LatheGeometry(points);
    }
    
    isCollectable = false;
    isObstacle = true;

    constructor() {
        super();

        const mesh = new THREE.Mesh(WorldItemObstacle.model, WorldItemObstacle.eggMaterials[Math.floor(Math.random() * WorldItemObstacle.eggMaterials.length)]);
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
WorldItemObstacle.initialize();