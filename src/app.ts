import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { createText } from 'three/addons/webxr/Text2D.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { Player } from './player';
import { World } from './world';
import { Actor } from './actor';

export class App {
    static firstUserActionEvents = ['mousedown', 'touchstart', 'mousemove','scroll','keydown','gamepadconnected'];
    static firstUserAction = true;

    private player: Player | undefined;
    private renderer: THREE.WebGLRenderer;
    private instructionText: any;
    private world: World | undefined;
    private GRAVITY: number = 9.8;
    private gui: GUI;

    private keyStates: any = {};
    private clock: any;
    private STEPS_PER_FRAME = 5;
    private stats: Stats = new Stats();
    private scene: THREE.Scene | undefined;

    private audioListenerPromise: Promise<THREE.AudioListener>;
    private container: HTMLDivElement;
    public setAudioListener: any;
    private joystickMoveVector: { x: number; y: number; } | undefined;
    private camera: THREE.PerspectiveCamera | undefined;
    private filterMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial, THREE.Object3DEventMap> | undefined;
    private orbitVontrols: OrbitControls | undefined;
    private gamepad: Gamepad | null | undefined;
    private touchStartX= 0;
    private touchStartY= 0;
    private touchMoveX= 0;
    private touchMoveY= 0;

    constructor() {
        this.clock = new THREE.Clock();
        this.gui = new GUI({ width: 200 });
        this.gui.hide();
        this.initDebugGui();

        this.container = document.createElement('div');
        document.body.appendChild(this.container);

        this.renderer = new THREE.WebGLRenderer({
            antialias: window.devicePixelRatio <= 1,
            powerPreference: "high-performance"
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.container.appendChild(this.renderer.domElement);

        this.container.appendChild( this.stats.dom );

        this.audioListenerPromise = new Promise<THREE.AudioListener>((resolve) => {
            this.setAudioListener = resolve;
        });

        this.init();
    }

    async init() {
       
        await this.initScene();

        App.firstUserActionEvents.forEach((event) => {
            document.addEventListener(event, this.onFirstUserAction.bind(this), { once: true });
        });

        window.addEventListener('resize', this.resize.bind(this));
        document.addEventListener('keydown', (event) => this.keyStates[event.code] = true);
        document.addEventListener('keyup', (event) => this.keyStates[event.code] = false);

        window.addEventListener("touchmove", (e) => this.hanldeTouch(e));
        window.addEventListener("touchstart", (e) => this.hanldeTouch(e));
        window.addEventListener("touchend", (e) => this.hanldeTouch(e));

        window.addEventListener('mousedown', () => this.player?.jump());
        window.addEventListener("gamepadconnected", (e) => {
            this.gamepad = e.gamepad;
            console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
            this.gamepad.index, this.gamepad.id,
            this.gamepad.buttons.length, this.gamepad.axes.length);
        });

        this.renderer.setAnimationLoop(this.update.bind(this));
    }

    hanldeTouch(e: TouchEvent) {
        var touch = e.touches[0] || e.changedTouches[0];
        if(!touch) return;
        const x = touch.pageX;
        const y = touch.pageY;

        if(e.type === "touchstart") {
            this.touchStartX = x;
            this.touchStartY = y;
            this.touchMoveX = 0;
            this.touchMoveY = 0;
        } else if(e.type === "touchend") {
            this.touchMoveX = 0;
            this.touchMoveY = 0;
        } else if(e.type === "touchmove") {
            this.touchMoveX = 3*(x - this.touchStartX)/window.innerWidth;
            this.touchMoveY = 3*(y - this.touchStartY)/window.innerHeight;
        }
    }

    initDebugGui() {
        this.gui.add({ debugPlayer: false }, 'debugPlayer')
            .onChange(function (value) {
                Player.debug = value;
            });
        this.gui.add({ debugActor: false }, 'debugActor')
            .onChange(function (value) {
                Actor.debug = value;
            });
        this.gui.add({ debugWorld: false }, 'debugWorld')
            .onChange((value: boolean) => {
                if (this.world && this.world.helper) {
                    this.world.helper.visible = value;
                }
            });
    }


    /**
     * Executes actions when the user performs their first interaction.
     * Plays audio and adds a light saber to the player's scene.
     */
    onFirstUserAction() {
        if(App.firstUserAction === false) return;
        App.firstUserAction = false;

        App.firstUserActionEvents.forEach((event) => {
            document.removeEventListener(event, this.onFirstUserAction.bind(this));
        });

        //init audio
        const listener = new THREE.AudioListener();
        if (this.setAudioListener) {
            this.setAudioListener(listener);
        }

        window.addEventListener('blur', () => listener.context.suspend());
        window.addEventListener('focus', () => listener.context.resume());

    }

    /***
     * @returns {Promise}
     */
    async initScene() {

        //init world
        this.world = new World(this.audioListenerPromise, this.gui);
        this.world.addEventListener('needHudUpdate', () => this.updateHud());
        this.world.addEventListener('collect', () => {
            this.vibrate(100);
        });
        this.scene = await this.world.loadScene();

        let fov = 70;
        this.camera = new THREE.PerspectiveCamera(
            fov,
            window.innerWidth / window.innerHeight,
        )
        this.camera.rotation.set(1,3.1,0)
        this.scene.add(this.camera);

        let filterGeometry = new THREE.SphereGeometry(0.5, 15, 32); // camera near is 0.1, camera goes inside this sphere
        let filterMaterial = new THREE.MeshBasicMaterial({color: 0xff0000, transparent: true, opacity: 0.35, side: THREE.BackSide});
        let filterMesh = new THREE.Mesh(filterGeometry, filterMaterial);
        filterMesh.visible = false;
        this.camera.add(filterMesh);
        this.filterMesh = filterMesh;

        //init player
        this.player = new Player(this.scene, this.camera, this.GRAVITY);
        this.player.teleport(this.world.playerSpawnPoint);
        this.player.addEventListener('dead', () => {
            this.vibrate(1000);
            this.updateHud();
            if(!this.world || !this.player) return;
            this.player.teleport(this.world.playerSpawnPoint);
            this.world.allLightsOff();
            this.world.stopWorldAudio();

            setTimeout(() => {
                this.restart();
            }, 1000);
        });
        this.player.addEventListener('damaged', () => {
            this.vibrate(100);
            this.blendHit();
            this.updateHud();
        });
        this.scene.add(this.player);
        this.updateHud();

        this.resize();
        //this.orbitVontrols = new OrbitControls( this.camera, this.renderer.domElement );
    }

    restart() {
        if(!this.world || !this.player) return;
        this.player.teleport(this.world.playerSpawnPoint);
        this.player.reset();
        this.world.reset();
        this.updateHud();
    }

    vibrate(ms = 100) {
        if(navigator.vibrate) navigator.vibrate(ms);
        if(this.gamepad && this.gamepad.vibrationActuator) {
            this.gamepad.vibrationActuator.playEffect("dual-rumble", {
                startDelay: 0,
                duration: ms,
                weakMagnitude: 1,
                strongMagnitude: 1
            });
        } 
    }

    blendHit() {
        if(!this.filterMesh) return;
        this.filterMesh.material.color.setHex(0xff0000);
        this.filterMesh.material.opacity = 0.35;
        this.filterMesh.visible = true;
        setTimeout(() => {
            if(!this.filterMesh) return;
            this.filterMesh.visible = false;
        }, 200);
    }

    blendDie() {
        if(!this.filterMesh) return;
        this.filterMesh.material.color.setHex(0xff0000);
        this.filterMesh.material.opacity = 1;
        this.filterMesh.visible = true;
    }

    blendBlack() {
        if(!this.filterMesh) return;
        this.filterMesh.material.color.setHex(0x000000);
        this.filterMesh.material.opacity = 1;
        this.filterMesh.visible = true;
    }

    blendClear() {
        if(!this.filterMesh) return;
        this.filterMesh.visible = false;
    }

    displayWinMessage() {
        if(!this.player || !this.world) return;
        this.blendBlack();
        this.updateInstructionText("You win! Reload to restart.");
        this.world.allLightsOff();
        this.world.stopWorldAudio();
    }

    private resize(): void {
        if(!this.player || !this.camera) return;

        //if mobile, add joystick
        if(window.innerWidth <= 800) {
            this.camera.position.set(0.3, 8.1, -2)
        } else {
            this.camera.position.set(0.2, 5, -2);
        }

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);

    }

    private controls(deltaTime: number): void {
        if(!this.player) return;       
        const speedDelta = deltaTime * (this.player.onFloor ? this.player.speedOnFloor : this.player.speedInAir);

        //keyboard controls
        if (this.keyStates['KeyW']) {
            this.player.velocity.add(this.player.getForwardVector().multiplyScalar(speedDelta));
        }

        if (this.keyStates['KeyS']) {
            this.player.velocity.add(this.player.getForwardVector().multiplyScalar(-speedDelta));
        }

        if (this.keyStates['KeyA']) {
            this.player.velocity.add(this.player.getSideVector().multiplyScalar(-speedDelta));
        }

        if (this.keyStates['KeyD']) {
            this.player.velocity.add(this.player.getSideVector().multiplyScalar(speedDelta));
        }

        if (this.keyStates['Space']) {
            this.player.jump();
        }

        //touch move
        if(this.touchMoveX > 0 || this.touchMoveY > 0) {
            this.player.velocity.add(this.player.getSideVector().multiplyScalar(this.touchMoveX * speedDelta));
            this.player.velocity.add(this.player.getForwardVector().multiplyScalar(-this.touchMoveY * speedDelta));
        }

        //gamepad controls
        if(this.gamepad) {
            this.gamepad = navigator.getGamepads()[this.gamepad.index];
            if(!this.gamepad) return;
            this.player.velocity.add(this.player.getForwardVector().multiplyScalar(-this.gamepad.axes[1] * speedDelta));
            this.player.velocity.add(this.player.getSideVector().multiplyScalar(this.gamepad.axes[0] * speedDelta));
            if(this.gamepad.buttons[0].pressed) {
                this.player.jump();
            }
        }

    }

    private updateHud(){
        if(!this.player) return;

        let hudText = `L ${this.world?.getLevel()} `;
        if(this.player.health === 0) {
            hudText += " ☠ You died. Wait to restart.";
        } else {
            hudText += ` ♥ ${this.player.health.toFixed(0)}`;
        }
        hudText += ` 🥚 ${this.player.score}`;

        this.updateInstructionText(hudText);
    }

    private updateInstructionText(text: string): void {
        if(!this.player || !this.camera) return;

        this.camera.remove(this.instructionText);
        this.instructionText = createText(text, 0.04);
        this.instructionText.position.set(0,0.1,-0.2);
        this.instructionText.scale.set(0.3,0.3,0.3);
        this.camera.add(this.instructionText);
    }

    private teleportPlayerIfOob(): void {
        if(!this.player || !this.world) return;
        if (this.world && this.player.position.y <= -25) {
            this.player.teleport(this.world.playerSpawnPoint);
        }
    }

    public update(): void {
        if(!this.player || !this.scene || !this.world || !this.camera) return;

        const deltaTime = Math.min(0.05, this.clock.getDelta()) / this.STEPS_PER_FRAME;

        for (let i = 0; i < this.STEPS_PER_FRAME; i++) {
            this.controls(deltaTime);

            this.player.update(deltaTime, this.world);
            this.world.update(deltaTime, this.player);

            this.teleportPlayerIfOob();
        }

        this.orbitVontrols?.update();

        this.stats.update();
        this.renderer.render(this.scene, this.camera);
    }
}
