import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { Octree } from 'three/addons/math/Octree.js';
import { Player } from './player';
import { WorldLevel } from './worldLevel';
import { WorldItemEgg } from './worldItemEgg';
import { WorldItemCarrot } from './worldItemCarrot';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('./draco/');
const geometryLoader = new GLTFLoader();
geometryLoader.setDRACOLoader(dracoLoader);

interface WorldEventMap extends THREE.Object3DEventMap {
    needHudUpdate: WorldNeedHudUpdateEvent;
    collect: WorldCollectEvent;
    levelUp: WorldLevelUpEvent;
}

export interface WorldNeedHudUpdateEvent extends THREE.Event {
    type: 'needHudUpdate';
}

export interface WorldCollectEvent extends THREE.Event {
    type: 'collect';
    item: WorldItem;
}

export interface WorldLevelUpEvent extends THREE.Event {
    type: 'levelUp';
}

type Weather = 'rain' | 'snow' | 'none';

export class World extends THREE.Object3D<WorldEventMap> {

    static debug = false;
    static soundBufferBirds: Promise<AudioBuffer>;
    static soundBufferCollect: Promise<AudioBuffer>;
    static soundBufferIntro: Promise<AudioBuffer>;
    static model: Promise<THREE.Object3D>;
    private levelCylinder: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshLambertMaterial, THREE.Object3DEventMap> | undefined;
    private placeholders2d: THREE.Object3D[][] | undefined;
    private level: WorldLevel = new WorldLevel();
    static treeModel: Promise<THREE.Object3D>;
    
    private weather: Weather = 'none';
    private weatherParticles: THREE.Points<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.PointsMaterial> | undefined;
    private weatherParticlesGeo: THREE.BufferGeometry<THREE.NormalBufferAttributes> | undefined;
    private weatherParticlesAreaSize= [50,50,50];
    private weatherParticlesSpeed = 10;

    static initialize() {
        //load audio     
        const audioLoader = new THREE.AudioLoader();
        World.soundBufferBirds = audioLoader.loadAsync('./sounds/birds.ogg');
        World.soundBufferCollect = audioLoader.loadAsync('./sounds/plop.ogg');

        //load model
        const gLTFLoader = new GLTFLoader();
        World.treeModel = gLTFLoader.loadAsync('./models/tree.glb').then(gltf => {
            gltf.scene.scale.set(0.002, 0.002, 0.002);
            return gltf.scene;
        });
        // World.soundBufferIntro = audioLoader.loadAsync('./sounds/intro.ogg');
    }

    worldOctree = new Octree();

    gui: GUI;
    enemySpawnPoints: THREE.Vector3[];
    playerSpawnPoint: THREE.Vector3;
    objectLoader: THREE.ObjectLoader;
    scene: THREE.Scene | undefined;
    soundBirds: THREE.Audio | undefined;
    soundCollect: THREE.Audio | undefined;
    soundIntro: THREE.Audio | undefined;
    map: THREE.Object3D<THREE.Object3DEventMap> | undefined;
    helper: OctreeHelper | undefined;
    animatedObjects: THREE.Object3D[] = [];

    /**
     * @param {Promise<THREE.AudioListener>} audioListenerPromise
     * @param {GUI} gui
     */
    constructor(audioListenerPromise: Promise<THREE.AudioListener>, gui: GUI) {
        super();

        this.gui = gui;
        this.enemySpawnPoints = [];
        this.playerSpawnPoint = new THREE.Vector3(0, 3, -1);

        this.objectLoader = new THREE.ObjectLoader();

        this.gui.add({ time: 0 }, 'time', 0, 24, 1).onFinishChange((time: number) => {
            this.addHemisphere(time);
        });

        this.initAudio(audioListenerPromise);
    }

    async initAudio(audioListenerPromise: Promise<THREE.AudioListener>) {
        const audioListener = await audioListenerPromise;
        const soundBufferBirds = await World.soundBufferBirds;
        this.soundBirds = new THREE.Audio(audioListener);
        this.soundBirds.setBuffer(soundBufferBirds);
        this.soundBirds.setLoop(true);
        this.soundBirds.setVolume(0.3);

        const soundBufferCollect = await World.soundBufferCollect;
        this.soundCollect = new THREE.Audio(audioListener);
        this.soundCollect.setBuffer(soundBufferCollect);
        this.soundCollect.setLoop(false);
        this.soundCollect.setVolume(1);

        const soundBufferIntro = await World.soundBufferIntro;
        this.soundIntro = new THREE.Audio(audioListener);
        this.soundIntro.setBuffer(soundBufferIntro);
        this.soundIntro.setLoop(false);
        this.soundIntro.setVolume(0.3);

        this.playWorldAudio();
    }

    playWorldAudio() {
        if (this.soundBirds && !this.soundBirds.isPlaying) {
            this.soundBirds.play();
        }
        setTimeout(() => {
            if (!this.soundIntro || this.soundIntro.isPlaying) return;
            this.soundIntro.play();
        }, 1000);
    }

    stopWorldAudio() {
        if (this.soundBirds) {
            this.soundBirds.stop();
        }
    }

    async loadScene(url = './models/scene_ship.json'): Promise<THREE.Scene> {
        this.scene = new THREE.Scene();

        const weather = Math.random();
        let isSnow = false;
        if(weather < 0.2) {
            this.weather = 'rain';
        } else if(weather < 0.4) {
            this.weather = 'snow';
            isSnow = true;
        } else {
            this.weather = 'none';
        }

        //big world roller geometry
        const map = this.map = new THREE.Object3D();
        const dataNoiseTexture = new THREE.DataTexture(new Uint8Array(32 * 32 * 4), 32, 32, THREE.RGBAFormat);
        dataNoiseTexture.wrapS = THREE.RepeatWrapping;
        dataNoiseTexture.wrapT = THREE.RepeatWrapping;
        dataNoiseTexture.repeat.set(5, 2);
        dataNoiseTexture.needsUpdate = true;

        for (let i = 0; i < dataNoiseTexture.image.data.length; i += 4) {
            //random number between 200 and 255
            const x = Math.floor(Math.random() * 55) + 200;
            dataNoiseTexture.image.data[i + 0] = isSnow? x:0;
            dataNoiseTexture.image.data[i + 1] = x;
            dataNoiseTexture.image.data[i + 2] = isSnow? x:0;
            dataNoiseTexture.image.data[i + 3] = x;
        }
        const levelMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, map: dataNoiseTexture });

        const levelGeometry = new THREE.CylinderGeometry(3, 3, 4, 32);
        levelGeometry.rotateZ(Math.PI / 2);
        const levelCylinder = new THREE.Mesh(levelGeometry, levelMaterial);
        this.levelCylinder = levelCylinder;

        const levelLeftGeometry = new THREE.CylinderGeometry(3, 3.5, 1, 32);
        levelLeftGeometry.rotateZ(Math.PI / 2);
        levelLeftGeometry.translate(2.5, 0, 0);
        const levelLeftCylinder = new THREE.Mesh(levelLeftGeometry, levelMaterial);
        this.levelCylinder.add(levelLeftCylinder);

        const levelRightGeometry = new THREE.CylinderGeometry(3.5, 3, 1, 32);
        levelRightGeometry.rotateZ(Math.PI / 2);
        levelRightGeometry.translate(-2.5, 0, 0);
        const levelRightCylinder = new THREE.Mesh(levelRightGeometry, levelMaterial);
        this.levelCylinder.add(levelRightCylinder);

        const tree = await World.treeModel;
        tree.scale.multiplyScalar(0.5);
        tree.position.set(2, 3.2, 0);
        levelCylinder.add(tree);

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
        guardrailLeft.position.set(levelGeometry.parameters.height / 2, levelGeometry.parameters.radiusTop, 0);
        guardrails.add(guardrailLeft);

        const guardrailGeometryRight = new THREE.BoxGeometry(0.1, 3, 4);
        const guardrailRight = new THREE.Mesh(guardrailGeometryRight, guardrailMaterial);
        guardrailRight.position.set(-levelGeometry.parameters.height / 2, levelGeometry.parameters.radiusTop, 0);
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
        const rotation = (2 * Math.PI) / rows;
        for (let i = 0; i < rows; i++) {
            const row = [];
            for (let j = 0; j < colsPerRow; j++) {
                const cell = placeholders1d[i + rows * j];
                cell.rotateX(rotation * i);
                row.push(cell);
            }
            placeholders2d.push(row);
        }
        this.placeholders2d = placeholders2d;

        this.level.putPartofLevelToMap(placeholders2d, 0, 18);

        this.scene.add(map);

        this.addWeather();

        this.addHemisphere();

        //this.addFog();

        const helper = new OctreeHelper(this.worldOctree);
        helper.visible = false;
        this.scene.add(helper);
        this.helper = helper;

        return this.scene;
    }

    reset() {
        this.stopWorldAudio();
        this.playWorldAudio();
        this.allLightsOn();
        this.level.reset();
        if (this.placeholders2d) this.level.putPartofLevelToMap(this.placeholders2d, 0, 18);
    }

    getLevel() {
        return this.level.levelNumber;
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

    async addHemisphere(time?: number) {
        if (!this.scene) return;

        //check if scene has hemisphere
        let hemisphere = this.scene.getObjectByName("Hemisphere");
        if (hemisphere) hemisphere.removeFromParent();

        hemisphere = new THREE.Group();
        hemisphere.name = "Hemisphere";

        // Sky
        const skyDataTexture = new THREE.DataTexture(new Uint8Array(512 * 512 * 4), 512, 512, THREE.RGBAFormat);
        skyDataTexture.needsUpdate = true;

        //gradient for sky according to day time morning, noon, evening, night
        if (!time) time = new Date().getHours();
        const fromGradient = new THREE.Color();
        const toGradient = new THREE.Color();
        const isNight = time >= 22 || time < 6;
        if (time >= 6 && time < 12) {
            fromGradient.set('#014a84');
            toGradient.set('#0561a0');
        } else if (time >= 12 && time < 18) {
            fromGradient.set('#b8fbff');
            toGradient.set('#0561a0');
        } else if (time >= 18 && time < 22) {
            fromGradient.set('#437ab6');
            toGradient.set('#000000');
        } else {
            fromGradient.set('#014a84');
            toGradient.set('#000000');
        }
        const skyGradient = new THREE.Color();
        for (let i = 0; i < skyDataTexture.image.data.length; i += 4) {
            const x = i / skyDataTexture.image.data.length;
            skyGradient.lerpColors(fromGradient, toGradient, x);
            skyDataTexture.image.data[i + 0] = skyGradient.r * 255;
            skyDataTexture.image.data[i + 1] = skyGradient.g * 255;
            skyDataTexture.image.data[i + 2] = skyGradient.b * 255;
            skyDataTexture.image.data[i + 3] = 255;
            if (isNight && Math.random() < 0.01) {
                skyDataTexture.image.data[i + 0] = 255;
                skyDataTexture.image.data[i + 1] = 255;
                skyDataTexture.image.data[i + 2] = 255;
                skyDataTexture.image.data[i + 3] = 255;
            }
        }
        this.scene.background = skyDataTexture;

        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444);
        hemisphereLight.position.set(0, 10, 0);
        hemisphereLight.intensity = 1;
        hemisphere.add(hemisphereLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff)//toGradient);
        directionalLight.position.set(0, 20, -10);
        directionalLight.castShadow = true;
        hemisphere.add(directionalLight);

        this.scene.add(hemisphere);
    }

    addWeather() {
        if (!this.scene) return;

        const weatherParticlesAreaSize = this.weatherParticlesAreaSize;

        let particleCount=0;
        let particleColor,particleSize;

        if(this.weather === 'rain') {
            particleCount = 2500;
            particleColor = 0x0000aa;
            particleSize = 0.2;
            this.weatherParticlesSpeed = 10;
        } else if(this.weather === 'snow') {
            particleCount = 2500;
            particleColor = 0xffffff;
            particleSize = 0.3;
            this.weatherParticlesSpeed = 5;
        } else {
            return;
        }

        const positions = [];
        const sizes = [];
        let rainDrop;
        this.weatherParticlesGeo = new THREE.BufferGeometry();
        for (let i = 0; i < particleCount; i++) {
            rainDrop = new THREE.Vector3(
                Math.random() * weatherParticlesAreaSize[0] - weatherParticlesAreaSize[0] / 2,
                Math.random() * weatherParticlesAreaSize[1] - weatherParticlesAreaSize[1] / 2,
                Math.random() * weatherParticlesAreaSize[2] - weatherParticlesAreaSize[2] / 2
            );
            positions.push(Math.random() * weatherParticlesAreaSize[0] - weatherParticlesAreaSize[0] / 2);
            positions.push(Math.random() * weatherParticlesAreaSize[1] - weatherParticlesAreaSize[1] / 2);
            positions.push(Math.random() * weatherParticlesAreaSize[2] - weatherParticlesAreaSize[2] / 2);
            sizes.push(30);
        }
        this.weatherParticlesGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
        this.weatherParticlesGeo.setAttribute("size", new THREE.BufferAttribute(new Float32Array(sizes), 1));

        const rainMaterial = new THREE.PointsMaterial({
            color: particleColor,
            size: particleSize,
            transparent: true
        });
        this.weatherParticles = new THREE.Points(this.weatherParticlesGeo, rainMaterial);

        this.scene.add(this.weatherParticles);
    }

    updateWheather(deltaTime: number) {
        if (this.weatherParticles && this.weatherParticlesGeo) {
            this.weatherParticlesGeo.attributes.size.array.forEach((r, i) => {
                r += deltaTime * this.weatherParticlesSpeed;
            });

            this.weatherParticles.position.y -= deltaTime * this.weatherParticlesSpeed;
            if (this.weatherParticles.position.y < -this.weatherParticlesAreaSize[1]/3) {
                this.weatherParticles.position.y = this.weatherParticlesAreaSize[1]/2;
            }
        }
    }

    update(deltaTime: number, player: Player) {
        if (!this.levelCylinder) return;

        //roate level cylinder
        this.levelCylinder.rotation.x -= deltaTime * 0.3 * this.level.speed;
        this.level.update(deltaTime);

        // this.animatedObjects.forEach(object => {
        // });

        //check if player is near placeholder
        this.checkPlayerCollision(player);

        this.updateWheather(deltaTime);

    }

    private checkPlayerCollision(player: Player) {
        const playerGlobalPosition = new THREE.Vector3();
        player.getWorldPosition(playerGlobalPosition);

        this.placeholders2d?.forEach(row => {
            row.forEach(placeholder => {
                const worldItem = placeholder.children[0] as WorldItem;
                if (!worldItem) return;

                if (worldItem.collide(playerGlobalPosition)) {
                    //player is near placeholder
                    placeholder.remove(worldItem);
                    if (worldItem.isCollectable) {
                        if (worldItem instanceof WorldItemEgg) {
                            player.score++;
                        } else if (worldItem instanceof WorldItemCarrot) {
                            player.health++;
                        }

                        this.level.collectables = this.level.collectables.filter(item => item.uuid !== worldItem.uuid);
                        if (this.level.collectables.length === 0) {
                            this.dispatchEvent({ type: 'levelUp' } as WorldLevelUpEvent);
                            this.level.levelUp();
                            if (this.placeholders2d) this.level.putPartofLevelToMap(this.placeholders2d);
                        }
                        this.dispatchEvent({ type: 'collect', item: worldItem } as WorldCollectEvent);
                        this.dispatchEvent({ type: 'needHudUpdate' } as WorldNeedHudUpdateEvent);
                        if (this.soundCollect && !this.soundCollect.isPlaying) this.soundCollect.play();
                        player.setBucketEggColor(worldItem.color);
                    } else if (worldItem.isObstacle) {
                        player.damage(1);
                        this.level.obstacles = this.level.obstacles.filter(item => item.uuid !== worldItem.uuid);
                        this.dispatchEvent({ type: 'needHudUpdate' } as WorldNeedHudUpdateEvent);
                    }
                }
            });
        });
    }

    rebuildOctree() {
        if (this.map) {
            this.worldOctree.clear().fromGraphNode(this.map);
        }
    }
}
World.initialize();