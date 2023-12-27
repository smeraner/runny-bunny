import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { Octree } from 'three/addons/math/Octree.js';
import { WorldItemEgg } from './worldItemEgg';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath( './draco/' );
const geometryLoader = new GLTFLoader();
geometryLoader.setDRACOLoader( dracoLoader );

interface WorldEventMap extends THREE.Object3DEventMap  {
    timerExpired: WorldTimerExpiredEvent;
    timerTick: WorldTimerTickEvent;
}

interface WorldTimerExpiredEvent extends THREE.Event {
    type: 'timerExpired';
}

interface WorldTimerTickEvent extends THREE.Event {
    type: 'timerTick';
}

export class World extends THREE.Object3D<WorldEventMap> {

    static debug = false;
    static soundBufferBreath: Promise<AudioBuffer>;
    static soundBufferIntro: Promise<AudioBuffer>;
    static model: Promise<THREE.Object3D>;
    private levelCylinder: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshLambertMaterial, THREE.Object3DEventMap> | undefined;
    private placeholders2d: THREE.Object3D[][] | undefined;

    static initialize() {
        //load audio     
        const audioLoader = new THREE.AudioLoader();
        // World.soundBufferBreath = audioLoader.loadAsync('./sounds/background_breath.ogg');
        // World.soundBufferIntro = audioLoader.loadAsync('./sounds/intro.ogg');
    }

    timerInterval: NodeJS.Timeout | undefined;
    worldOctree = new Octree();

    gui: GUI;
    enemySpawnPoints: THREE.Vector3[];
    playerSpawnPoint: THREE.Vector3;
    objectLoader: THREE.ObjectLoader;
    scene: THREE.Scene | undefined;
    soundBreath: THREE.Audio | undefined;
    soundAlarm: THREE.Audio | undefined;
    soundIntro: THREE.Audio | undefined;
    map: THREE.Object3D<THREE.Object3DEventMap> | undefined;
    helper: OctreeHelper | undefined;

    animatedObjects: THREE.Object3D[] = [];

    timerSeconds = 180; //seconds

    /**
     * @param {Promise<THREE.AudioListener>} audioListenerPromise
     * @param {GUI} gui
     */
    constructor(audioListenerPromise: Promise<THREE.AudioListener>, gui: GUI) {
        super();

        this.gui = gui;
        this.enemySpawnPoints = [];
        this.playerSpawnPoint = new THREE.Vector3(0,3,-1);

        this.objectLoader = new THREE.ObjectLoader();

        this.initAudio(audioListenerPromise);
    }

    async initAudio(audioListenerPromise: Promise<THREE.AudioListener>) {
        const audioListener = await audioListenerPromise;
        const soundBuffer = await World.soundBufferBreath;
        this.soundBreath = new THREE.Audio(audioListener);
        this.soundBreath.setBuffer(soundBuffer);
        this.soundBreath.setLoop(true);
        this.soundBreath.setVolume(0.3);

        const soundBufferIntro = await World.soundBufferIntro;
        this.soundIntro = new THREE.Audio(audioListener);
        this.soundIntro.setBuffer(soundBufferIntro);
        this.soundIntro.setLoop(false);
        this.soundIntro.setVolume(0.3);
        
        this.playWorldAudio();
    }

    playWorldAudio() {
        if (this.soundBreath) {
            this.soundBreath.play();
        }
        setTimeout(() => {
            if(!this.soundIntro) return;
            this.soundIntro.play();
        }, 1000);
    }

    stopWorldAudio() {
        if (this.soundBreath) {
            this.soundBreath.stop();
        }
    }

    async loadScene(url = './models/scene_ship.json'): Promise<THREE.Scene> {
        this.scene = new THREE.Scene();

        //big world roller geometry
        const map = this.map = new THREE.Object3D();
        const levelGeometry = new THREE.CylinderGeometry(3, 3, 4, 32);
        levelGeometry.rotateZ(Math.PI / 2);

        const dataNoiseTexture = new THREE.DataTexture(new Uint8Array(32 * 32 * 4), 32, 32, THREE.RGBAFormat);
        dataNoiseTexture.wrapS = THREE.RepeatWrapping;
        dataNoiseTexture.wrapT = THREE.RepeatWrapping;
        dataNoiseTexture.repeat.set(5, 2);
        dataNoiseTexture.needsUpdate = true;

        for (let i = 0; i < dataNoiseTexture.image.data.length; i += 4) {
            //random number between 200 and 255
            const x = Math.floor(Math.random() * 55) + 200;
            dataNoiseTexture.image.data[i + 0] = 0;
            dataNoiseTexture.image.data[i + 1] = x;
            dataNoiseTexture.image.data[i + 2] = 0;
            dataNoiseTexture.image.data[i + 3] = x;
        }

        const levelMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, map: dataNoiseTexture });
        const levelCylinder = new THREE.Mesh(levelGeometry, levelMaterial);
        this.levelCylinder = levelCylinder;
        map.add(levelCylinder);

        //guardrails geometry
        const guardrails = new THREE.Object3D();
        guardrails.visible = false;
        const guardrailMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true });
        const guardrailGeometryBack = new THREE.BoxGeometry(4, 3, 0.1);
        const guardrailBack = new THREE.Mesh(guardrailGeometryBack, guardrailMaterial);
        guardrailBack.position.set(0, levelGeometry.parameters.radiusTop, -1.7);
        guardrails.add(guardrailBack);

        const guardrailGeometryFront = new THREE.BoxGeometry(4, 3, 0.1);
        const guardrailFront = new THREE.Mesh(guardrailGeometryFront, guardrailMaterial);
        guardrailFront.position.set(0, levelGeometry.parameters.radiusTop, 1.7);
        guardrails.add(guardrailFront);

        const guardrailGeometryLeft = new THREE.BoxGeometry(0.1, 3, 4);
        const guardrailLeft = new THREE.Mesh(guardrailGeometryLeft, guardrailMaterial);
        guardrailLeft.position.set(levelGeometry.parameters.height/2, levelGeometry.parameters.radiusTop, 0);
        guardrails.add(guardrailLeft);

        const guardrailGeometryRight = new THREE.BoxGeometry(0.1, 3, 4);
        const guardrailRight = new THREE.Mesh(guardrailGeometryRight, guardrailMaterial);
        guardrailRight.position.set(-levelGeometry.parameters.height/2, levelGeometry.parameters.radiusTop, 0);
        guardrails.add(guardrailRight);

        this.map.add(guardrails);
        this.rebuildOctree();
        
        //add wired cylinder around level
        
        const wiredGeometry = new THREE.CylinderGeometry(levelGeometry.parameters.radiusTop + .1, levelGeometry.parameters.radiusBottom + .1, levelGeometry.parameters.height - 1, 18, 3, true);
        wiredGeometry.rotateZ(-Math.PI / 2);
        wiredGeometry.rotateX(4.5); //ensure that player starts in first row

        //add cube on every vertice of wired cylinder
        const placeholders1d = [];
        const positionAttribute = wiredGeometry.getAttribute('position');
        for (let i = 0; i < positionAttribute.count; i++) {
            const vertice = new THREE.Vector3();
            vertice.fromBufferAttribute(positionAttribute, i);
            const placeholder = new THREE.Object3D();
            placeholder.position.copy(vertice);
            this.levelCylinder.add(placeholder);
            placeholders1d.push(placeholder);
        }

        //convert 1d array to 2d array
        const placeholders2d = [];
        const colsPerRow = levelGeometry.parameters.height;
        const rows = placeholders1d.length / colsPerRow;
        for (let i = 0; i < rows; i++) {
            const row = [];
            for (let j = 0; j < colsPerRow; j++) {
                row.push(placeholders1d[i + rows * j]);
            }
            placeholders2d.push(row);
        }
        this.placeholders2d = placeholders2d;

        this.putPartofLevelToMap(0, 19);

        this.scene.add(map);

        // //load geometry
        // const gltf = await geometryLoader.loadAsync('./models/scene_ship.glb');
        
        // //optimize performance
        // gltf.scene.traverse(child => {
        //     const mesh = child as THREE.Mesh;
        //     if (mesh.isMesh) {
        //         const mesh = child as THREE.Mesh;
        //         mesh.castShadow = false;
        //         mesh.receiveShadow = false;
        //     }
        //     const light = child as THREE.Light;
        //     if (light.isLight) {
        //         light.castShadow = false;
        //     }
        // });

        // this.map = gltf.scene;

        //add hemisphere
        this.addHemisphere();

        this.addFog();

        // gltf.scene.traverse(child => {
        //     const mesh = child as THREE.Mesh;

        //     if (child.name.startsWith("Enemy")) {
        //         this.enemySpawnPoints.push(child.position);
        //     } else if (child.name === "Player") {
        //         this.playerSpawnPoint.copy(child.position);
        //     }

        //     //damageable objects
        //     if(mesh.isMesh && child.userData && child.userData.health) {
        //         const damageableChild = child as DamageableObject;
        //         damageableChild.damage = (damage: number) => {
        //             child.userData.health -= damage;
        //             if(child.userData.health <= 0) {
        //                 if (child.parent !== null) {
        //                     child.parent.remove(child);
        //                 }
        //                 this.rebuildOctree();
        //             }
        //         }
        //     }
                
        //     // else if (child.isMesh && child.name === "collision-world.glb") {
        //     //     if (child.material.map) {
        //     //         child.material.map.anisotropy = 4;
        //     //     }
                
        //     // }
        // });

        //this.scene.add(gltf.scene);

        //add clouds
        // const cloud = new Cloud();
        // cloud.position.set(0, 1, 0);
        // this.scene.add(cloud);
        // this.animatedObjects.push(cloud);
       
        const helper = new OctreeHelper(this.worldOctree);
        helper.visible = false;
        this.scene.add(helper);
        this.helper = helper;

        return this.scene;
    }

    level = [
        [0, 0, 0, 0],
        [0, 1, 0, 0],
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 1, 0],
        [0, 1, 0, 0],
        [1, 0, 0, 0],
        [1, 1, 0, 0],
        [1, 1, 1, 0],
        [1, 1, 0, 0],
        [1, 0, 0, 0],
        [1, 1, 0, 0],
        [1, 1, 1, 0],
        [1, 1, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 0],
    ]
    getPartOfLevel(from:number=0, to:number=18) {
        const level = [];
        for (let i = from; i < to; i++) {
            if(!this.level[i]) break;
            level.push(this.level[i]);
        }
        return level;
    }
    putPartofLevelToMap(from:number=0, to:number=18) {
        const level = this.getPartOfLevel(from, to);
        const levelRows = this.placeholders2d?.length;

        for (let i = 0; i < level.length; i++) {
            const levelRow = level[i];
            const placeholdersRow = this.placeholders2d?.[i];
            if(!placeholdersRow) break;

            for (let j = 0; j < levelRow.length; j++) {
                const levelCell = levelRow[j];
                const placeholder = placeholdersRow[j];
                if(!placeholder) break;

                placeholder.children.forEach(child => {
                    placeholder.remove(child);
                });

                switch (levelCell) {
                    case 0:
                        //empty
                        break;
                    case 1:
                        const egg = new WorldItemEgg();
                        placeholder.add(egg);
                        break;
                }

            }
        }
    }

    allLightsOff() {
        if (!this.scene) return;

        this.scene.traverse(child => {
            if ((child as THREE.Light).isLight) {
                child.visible = false;
            }
        });
    }

    allLightsOn() {
        if (!this.scene) return;

        this.scene.traverse(child => {
            if ((child as THREE.Light).isLight) {
                child.visible = true;
            }
        });
    }

    addFog() {
        if (!this.scene) return;

        this.scene.fog = new THREE.Fog(0xffffff, 10, 35);
    }

    async addHemisphere() {
        if (!this.scene) return;

        //check if scene has hemisphere
        let hemisphere = this.scene.getObjectByName("Hemisphere");
        if (hemisphere) return;

        const textureLoader = new THREE.TextureLoader();
        const texture = await textureLoader.loadAsync('./textures/sky.png');
        texture.anisotropy = 4;

        const hemisphereGeometry = new THREE.SphereGeometry(1000, 32, 32);
        const hemisphereMaterial = new THREE.MeshBasicMaterial({
            map: texture, 
            side: THREE.BackSide,
            fog: false
        });

        hemisphere = new THREE.Mesh(hemisphereGeometry, hemisphereMaterial);
        hemisphere.name = "Hemisphere";
        hemisphere.position.set(0, 0, 0);
        this.scene.add(hemisphere);

        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444);
        hemisphereLight.position.set(0, 20, 0);
        hemisphereLight.intensity = 1;
        this.scene.add(hemisphereLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff);
        directionalLight.position.set(0, 20, 10);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);



    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timerSeconds--;
            if (this.timerSeconds <= 0) {
                this.timerSeconds = 0;
                this.stopTimer();
                this.dispatchEvent({type: "timerExpired"} as WorldTimerExpiredEvent);
            } else {
                this.dispatchEvent({type: "timerTick"} as WorldTimerTickEvent);
            }
        }, 1000);
    }

    stopTimer() {
        clearInterval(this.timerInterval);
    }

    update(deltaTime: number, camera: THREE.Camera) {
        if (!this.levelCylinder) return;

        //roate level cylinder
        this.levelCylinder.rotation.x -= deltaTime * 0.3;

        this.animatedObjects.forEach(object => {
        });

    }

    rebuildOctree() {
        if (this.map) {
            this.worldOctree.clear().fromGraphNode(this.map);
        }
    }
}
World.initialize();