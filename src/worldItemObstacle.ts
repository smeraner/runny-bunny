import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as Tween from 'three/examples/jsm/libs/tween.module.js';

export class WorldItemObstacle extends THREE.Object3D implements WorldItem {

    static eggModel: THREE.LatheGeometry;
    static eggMaterials = [
        new THREE.MeshPhongMaterial({ color: 0x000000 }),
    ];
    static cowModel: Promise<{ scene: THREE.Object3D<THREE.Object3DEventMap>; animations: any; }>;
    static mushroomModel: Promise<{ scene: THREE.Object3D<THREE.Object3DEventMap>; animations: any; }>;
    static treeModel: Promise<{ scene: THREE.Object3D<THREE.Object3DEventMap>; animations: any; }>;

    static initialize() {
        //construct egg model
        const points = [];
        for ( let deg = 0; deg <= 180; deg += 6 ) {
            const rad = Math.PI * deg / 180;
            const point = new THREE.Vector2( ( 0.72 + .08 * Math.cos( rad ) ) * Math.sin( rad ), - Math.cos( rad ) ); // the "egg equation"
            points.push( point );
        }
        WorldItemObstacle.eggModel = new THREE.LatheGeometry(points);

        //load cow model
        const gltfLoader = new GLTFLoader();
        WorldItemObstacle.cowModel = gltfLoader.loadAsync('./models/cow.glb').then(gltf => {
            const mesh = gltf.scene.children[0] as THREE.Mesh;
            mesh.scale.set(0.002, 0.002, 0.002);
            mesh.position.set(0, -0.1, 0);
            return gltf;
        });
        WorldItemObstacle.mushroomModel = gltfLoader.loadAsync('./models/mushroom.glb').then(gltf => {
            const mesh = gltf.scene.children[0] as THREE.Mesh;
            mesh.scale.set(0.002, 0.002, 0.002);
            mesh.position.set(0, -0.2, 0);
            //replace materials with phong
            mesh.traverse(child => {
                const mesh = child as THREE.Mesh;
                if(mesh.material instanceof THREE.MeshStandardMaterial) {
                    if(mesh.material.name === "Material.003" || mesh.material.name === "Material.002") {
                        mesh.material = new THREE.MeshToonMaterial({ color: 0xffffff });
                    } else {
                        mesh.material = new THREE.MeshToonMaterial({ color: 0xff0000 });
                    }
                    
                }
            });
            return gltf;
        });

        const gLTFLoader = new GLTFLoader();
        WorldItemObstacle.treeModel = gLTFLoader.loadAsync('./models/tree.glb').then(gltf => {
            gltf.scene.scale.set(0.001, 0.001, 0.001);
            gltf.scene.position.y = -0.2;
            return gltf;
        });

    }

    tween: Tween.Tween<any> | undefined;    
    color: THREE.Color = new THREE.Color(0x000000);
    isCollectable = false;
    isObstacle = true;

    constructor() {
        super();

        if(Math.random() < 0.3) {
            const mesh = new THREE.Mesh(WorldItemObstacle.eggModel, WorldItemObstacle.eggMaterials[Math.floor(Math.random() * WorldItemObstacle.eggMaterials.length)]);
            mesh.castShadow = true;
            mesh.scale.set(0.2, 0.2, 0.2);
            this.add(mesh);
        } else if(Math.random() < 0.5) {
            WorldItemObstacle.cowModel.then((gltf: { scene: THREE.Object3D<THREE.Object3DEventMap>; animations: any; }) => {
                const model = gltf.scene.clone();
                model.rotation.y = Math.PI * Math.random();
                this.add(model);
            });
        } else if(Math.random() < 0.7) {
            WorldItemObstacle.treeModel.then((gltf: { scene: THREE.Object3D<THREE.Object3DEventMap>; animations: any; }) => {
                const model = gltf.scene.clone();
                model.rotation.y = Math.PI * Math.random();
                this.add(model);
            });
        } else {
            WorldItemObstacle.mushroomModel.then((gltf: { scene: THREE.Object3D<THREE.Object3DEventMap>; animations: any; }) => {
                const model = gltf.scene.clone();
                model.rotation.y = Math.PI * Math.random();
                this.add(model);
            });
        }
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
        if(this.tween) this.tween.update();
        this.removeFromParent();
    }

    update(deltaTime: number): void {
        if(this.tween) this.tween.update();
    }

}
WorldItemObstacle.initialize();