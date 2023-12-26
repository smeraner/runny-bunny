/// <reference path="./world.ts" />
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Actor } from './actor';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { Player } from './player';
import { World } from './world';


/**
 * Trooper is a NPC enemy that will guard the world
 * and attack the player if he gets too close.
 */
export class Trooper extends Actor {
    
    static debug = false;
    static model: Promise<any>;
    static soundBufferDead: Promise<AudioBuffer>;
    static soundBufferLaser: Promise<AudioBuffer>;
    static modes = {
        idle: 0,
        walk: 1,
        run: 2,
        suspicious: 3,
        fight: 4
    };
    idleAction: any;
    walkAction: any;
    runAction: any;
    TPoseAction: any;
    actions: any[] = [];
    soundDead: THREE.PositionalAudio | undefined;
    soundLaser: THREE.PositionalAudio | undefined;
    audioListenerPromise: Promise<THREE.AudioListener>;

    static initialize() {
        //load audio     
        const audioLoader = new THREE.AudioLoader();
        Trooper.soundBufferDead = audioLoader.loadAsync('./sounds/trooper_dead.ogg');
        Trooper.soundBufferLaser = audioLoader.loadAsync('./sounds/laser.ogg');

        //load model     
        const gltfLoader = new GLTFLoader();
        Trooper.model = gltfLoader.loadAsync('./models/trooper.glb').then(gltf => {
            gltf.scene.rotation.y = Math.PI;
            gltf.scene.traverse(child => {
                const mesh = child as THREE.Mesh;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
            });
            return gltf;
        });
    }

    damageMultiplyer = 0.25;
    colliderHeight = 1.2;
    mixer: THREE.AnimationMixer | undefined;
    model: THREE.Object3D<THREE.Object3DEventMap> | undefined;
    mode = Trooper.modes.idle;

    /**
     * 
     * @param {number} gravity 
     * @param {THREE.Scene} scene 
     * @param {Promise<THREE.AudioListener>} audioListenerPromise
     */
    constructor(gravity: number, scene: THREE.Scene, audioListenerPromise: Promise<THREE.AudioListener>) {
        super(gravity, scene);

        this.collider = new Capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, this.colliderHeight, 0), this.colliderRadius);
        this.colliderMesh.geometry = new THREE.CapsuleGeometry(this.collider.radius, this.collider.end.y - this.collider.start.y);

        this.audioListenerPromise = audioListenerPromise;
        this.initAudio(audioListenerPromise);

        Trooper.model.then((gltf: { scene: THREE.Object3D<THREE.Object3DEventMap>; animations: any; }) => {
            this.model = SkeletonUtils.clone( gltf.scene );
            this.add(this.model);

            const animations = gltf.animations;
            this.mixer = new THREE.AnimationMixer(this.model);

            this.idleAction = this.mixer.clipAction(animations[0]);
            this.walkAction = this.mixer.clipAction(animations[3]);
            this.runAction = this.mixer.clipAction(animations[1]);
            this.TPoseAction = this.mixer.clipAction(animations[2]);

            this.actions = [this.idleAction, this.walkAction, this.runAction];

            this.setAnimationWeight(this.idleAction, 1);
            this.setAnimationWeight(this.walkAction, 0);
            this.setAnimationWeight(this.runAction, 0);
            this.setAnimationWeight(this.TPoseAction, 0);

            this.actions.forEach((action: { play: () => void; }) => {
                action.play();
            });

        });
    }

    private async initAudio(audioListenerPromise: Promise<THREE.AudioListener>) {
        const audioListener = await audioListenerPromise;
        const bufferDead = await Trooper.soundBufferDead;
        const soundDead = new THREE.PositionalAudio(audioListener);
        soundDead.setBuffer(bufferDead);
        soundDead.setVolume(0.5);
        this.add(soundDead);
        this.soundDead = soundDead;

        const bufferLaser = await Trooper.soundBufferLaser;
        const soundLaser = new THREE.PositionalAudio(audioListener);
        soundLaser.setBuffer(bufferLaser);
        soundLaser.setVolume(0.5);
        this.add(soundLaser);
        this.soundLaser = soundLaser;
    }

    private setAnimationWeight(action: { enabled: boolean; setEffectiveTimeScale: (arg0: number) => void; setEffectiveWeight: (arg0: any) => void; }, weight: number) {
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(weight);
    }

    die() {
        super.die();
        if (this.soundDead) this.soundDead.play();
        if(this.mixer) this.mixer.stopAllAction();
        this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        this.mode = Trooper.modes.idle;
        this.rotation.x = -Math.PI/2;
        this.setAnimationWeight(this.TPoseAction, 1);
    }


    /**
     * 
     * @param {number} deltaTime
     * @param {World} world
     * @param {THREE.Object3D} player 
     */
    update(deltaTime: number, world: World, player: Player) {
        super.update(deltaTime, world, player);

        if(!this.isDead()) {

            //update mode
            const distance = this.position.distanceTo(player.position);
            if(distance < 15) {
                this.mode = Trooper.modes.fight;
            } else if(distance < 25) {
                this.mode = Trooper.modes.suspicious;
            } else {
                this.mode = Trooper.modes.idle;
            }

            //update animation
            switch(this.mode) {
                case Trooper.modes.idle:
                    break;
                case Trooper.modes.suspicious:
                    this.lookAt(player.position);
                    break;
                case Trooper.modes.fight:
                    this.lookAt(player.position);
                    break;
            }
            if(this.mixer) this.mixer.update(deltaTime);
        }

    }

    dispose() {
        super.dispose();
        if(this.mixer && this.model) {
            this.mixer.stopAllAction();
            this.mixer.uncacheRoot(this.model);
        }
    }

}
Trooper.initialize();
