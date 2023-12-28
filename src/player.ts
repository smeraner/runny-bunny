import * as THREE from 'three';
import { World } from './world';
import { Capsule } from 'three/addons/math/Capsule.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Actor, ActorDamageEvent, ActorDeadEvent } from './actor';

export class Player extends Actor implements DamageableObject {
    static debug = false;
    static model: Promise<any>;

    mixer: THREE.AnimationMixer | undefined;
    model: THREE.Object3D<THREE.Object3DEventMap> | undefined;
    gravity = 0;
    speedOnFloor = 15;
    speedInAir = 5;
    jumpHeight = 4;
    onFloor = false;

    colliderHeight = .3;
    collider = new Capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, this.colliderHeight, 0), 0.3);

    velocity = new THREE.Vector3();
    direction = new THREE.Vector3();
    scene: THREE.Scene;
    colliderMesh: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap>;
    health: number = 3;
    damageMultiplyer: number = 10;
    camera: THREE.Camera;
    runAction: THREE.AnimationAction | undefined;
    actions: THREE.AnimationAction[] | undefined;
    score: number = 0;

    static initialize() {
        //load model     
        const gltfLoader = new GLTFLoader();
        Player.model = gltfLoader.loadAsync('./models/bunny.glb').then(gltf => {
            gltf.scene.scale.set(0.2, 0.2, 0.2);
            gltf.scene.position.y = -0.3;
            gltf.scene.traverse(child => {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
            });
            return gltf;
        });
    }

    /**
     * @param {THREE.Scene} scene
     * @param {Promise<THREE.AudioListener>} audioListenerPromise
     * @param {number} gravity
     */
    constructor(scene: THREE.Scene, camera: THREE.Camera, gravity: number) {
        super(gravity,scene);

        this.scene = scene;
        this.camera = camera;
        this.gravity = gravity;

        this.rotation.order = 'YXZ';

        Player.model.then(gltf => {
            this.model = gltf.scene;
            if(!this.model) throw new Error("Model not loaded");
            this.add(this.model);
            this.mixer = new THREE.AnimationMixer(this.model);
            this.runAction = this.mixer.clipAction((gltf as any).animations[0]);
            this.actions = [this.runAction];
            this.runAction.play();
        });

        //collider
        const capsuleGeometry = new THREE.CapsuleGeometry(this.collider.radius, this.collider.end.y - this.collider.start.y);
        const capsuleMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
        const colliderMesh = new THREE.Mesh(capsuleGeometry, capsuleMaterial);
        colliderMesh.userData.obj = this;
        colliderMesh.position.copy(this.collider.start);
        this.colliderMesh = colliderMesh;
        this.scene.add(colliderMesh);
        this.colliderMesh.visible = Player.debug;
    }

    reset() {
        this.health = 3;
        this.score = 0;
    }

    jump(): void {
        if (this.onFloor) {
            this.velocity.y = this.jumpHeight;
        }
    }

    /**
     * Process inbound damage
     * @param {number} amount
     */
    damage(amount: number) {
        if(this.health === 0) return;
        
        this.health -= amount * this.damageMultiplyer;
        this.dispatchEvent({type: "damaged", health: this.health} as ActorDamageEvent);
        if (this.health <= 0) {
            this.health = 0;
            this.dispatchEvent({type: "dead"} as ActorDeadEvent);
            //this.blendDie();
        } else {
            //this.blendHit();
        }
    }

    /**
     * 
     * @param {World} world 
     */
    collitions(world: World): void {
        const result = world.worldOctree.capsuleIntersect(this.collider);

        this.onFloor = false;

        if (result) {
            this.onFloor = result.normal.y > 0;

            if (!this.onFloor) {
                this.velocity.addScaledVector(result.normal, - result.normal.dot(this.velocity));
            }
            this.collider.translate(result.normal.multiplyScalar(result.depth));
            this.colliderMesh.position.copy(this.collider.start);
        }
    }

    /***
     * @param {number} deltaTime
     */
    update(deltaTime: number, world: World): void {

        let damping = Math.exp(- 4 * deltaTime) - 1;
        if (!this.onFloor) {
            this.velocity.y -= this.gravity * deltaTime;
            damping *= 0.1; // small air resistance
        }
        this.velocity.addScaledVector(this.velocity, damping);

        const deltaPosition = this.velocity.clone().multiplyScalar(deltaTime);
        this.collider.translate(deltaPosition);

        this.collitions(world);

        this.position.copy(this.collider.end);
        this.position.y -= this.collider.radius;

        this.colliderMesh.visible = Player.debug;
        if(this.mixer) this.mixer.update(deltaTime);
    }

    teleport(position: THREE.Vector3): void {
        this.position.copy(position);
        this.collider.start.copy(position);
        this.collider.end.copy(position);
        this.collider.end.y += this.colliderHeight;
        this.colliderMesh.position.copy(this.collider.start);

        this.velocity.set(0, 0, 0);
        this.onFloor = true;

    }

    getForwardVector(): THREE.Vector3 {
        this.camera.getWorldDirection(this.direction);
        this.direction.y = 0;
        this.direction.normalize();

        return this.direction;

    }

    getSideVector(): THREE.Vector3 {

        this.camera.getWorldDirection(this.direction);
        this.direction.y = 0;
        this.direction.normalize();
        this.direction.cross(this.camera.up);

        return this.direction;

    }
}
Player.initialize();