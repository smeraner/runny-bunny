import * as THREE from 'three';
import * as Tween from 'three/examples/jsm/libs/tween.module.js';

export class WorldItemEgg extends THREE.Object3D implements WorldItem {

    static model: THREE.LatheGeometry;
    static eggMaterials = [
        new THREE.MeshLambertMaterial({ color: 0xffff00 }),
        new THREE.MeshLambertMaterial({ color: 0xff0000 }),
        new THREE.MeshLambertMaterial({ color: 0x00ff00 }),
        new THREE.MeshLambertMaterial({ color: 0x0000ff }),
        new THREE.MeshLambertMaterial({ color: 0x00ffff }),
    ];
    tween: Tween.Tween<any> | undefined;    

    static initialize() {
        const points = [];

        for ( let deg = 0; deg <= 180; deg += 6 ) {
            const rad = Math.PI * deg / 180;
            const point = new THREE.Vector2( ( 0.72 + .08 * Math.cos( rad ) ) * Math.sin( rad ), - Math.cos( rad ) ); // the "egg equation"
            points.push( point );
        }

        WorldItemEgg.model = new THREE.LatheGeometry(points);
    }

    color: THREE.Color;    
    isCollectable = true;
    isObstacle = false;

    constructor() {
        super();

        const mesh = new THREE.Mesh(WorldItemEgg.model, WorldItemEgg.eggMaterials[Math.floor(Math.random() * WorldItemEgg.eggMaterials.length)]);
        this.color = mesh.material.color;
        mesh.scale.set(0.2, 0.2, 0.2);
        mesh.position.y = 0.1;
        this.add(mesh);

        this.tween = new Tween.Tween(this.position)
            .to({y: 0.1}, 500)
            .yoyo(true)
            .repeat(Infinity)
            .start();
    }

    collide(collideWithGlobalVector: THREE.Vector3): boolean {
        //get this world position
        const worldPosition = new THREE.Vector3();
        this.getWorldPosition(worldPosition);

        //get distance between this and collideWith
        const distance = worldPosition.distanceTo(collideWithGlobalVector);

        return distance < 0.5;    
    }

    hit(): void {
        if(this.tween) this.tween.stop();

        this.tween = new Tween.Tween(this.scale)
            .to({x: 0.1, y: 0.1, z: 0.1}, 500)
            .start()
            .onComplete(() => this.removeFromParent());
    }
    
    update(deltaTime: number): void {
        if(this.tween) this.tween.update();
    }

}
WorldItemEgg.initialize();