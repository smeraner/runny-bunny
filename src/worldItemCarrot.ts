import * as THREE from 'three';
import * as Tween from 'three/examples/jsm/libs/tween.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class WorldItemCarrot extends THREE.Object3D implements WorldItem {

    static model: Promise<{ scene: THREE.Object3D<THREE.Object3DEventMap>; animations: any; }>;

    static initialize() {
        //load model
        const gltfLoader = new GLTFLoader();
        WorldItemCarrot.model = gltfLoader.loadAsync('./models/carrot.glb').then(gltf => {
            const mesh = gltf.scene.children[0] as THREE.Mesh;
            mesh.scale.set(0.15, 0.15, 0.15);
            mesh.position.set(0, 0.15, 0);
            return gltf;
        });
    }
    color= new THREE.Color(0, 0, 0);
    tween: Tween.Tween<any> | undefined;
    isCollectable= true;
    isObstacle= false;

    constructor() {
        super();

        WorldItemCarrot.model.then(gltf => {
            const model = gltf.scene.clone();
            this.add(model);
            this.tween = new Tween.Tween(this.position)
                .to({y: 0.25}, 500)
                .yoyo(true)
                .repeat(Infinity)
                .start();
        });
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
    }

    update(deltaTime: number): void {
        if(this.tween) this.tween.update();
    }

}
WorldItemCarrot.initialize();