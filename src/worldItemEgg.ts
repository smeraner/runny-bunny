import * as THREE from 'three';
import * as Tween from 'three/examples/jsm/libs/tween.module.js';

// Easter egg pattern types
type PatternType = 'stripes' | 'zigzag' | 'dots' | 'mixed';

// Color palette for Easter eggs (base + accent colors)
interface EggStyle {
    baseColor: string;
    accentColor1: string;
    accentColor2: string;
    pattern: PatternType;
}

export class WorldItemEgg extends THREE.Object3D implements WorldItem {

    static model: THREE.LatheGeometry;
    static eggMaterials: THREE.MeshToonMaterial[] = [];

    // Easter egg styles
    static eggStyles: EggStyle[] = [
        { baseColor: '#FFD700', accentColor1: '#FF6347', accentColor2: '#FFFFFF', pattern: 'stripes' },  // Gold with red stripes
        { baseColor: '#00CED1', accentColor1: '#FFD700', accentColor2: '#FFFFFF', pattern: 'zigzag' },   // Turquoise with gold zigzag
        { baseColor: '#FF69B4', accentColor1: '#9370DB', accentColor2: '#FFFFFF', pattern: 'dots' },     // Pink with purple dots
        { baseColor: '#98FB98', accentColor1: '#FF69B4', accentColor2: '#FFD700', pattern: 'mixed' },    // Green with pink/gold mix
        { baseColor: '#9370DB', accentColor1: '#00CED1', accentColor2: '#FFD700', pattern: 'stripes' },  // Purple with teal stripes
        { baseColor: '#FF6347', accentColor1: '#FFD700', accentColor2: '#FFFFFF', pattern: 'zigzag' },   // Tomato with gold zigzag
        { baseColor: '#87CEEB', accentColor1: '#FF69B4', accentColor2: '#FFFFFF', pattern: 'dots' },     // Sky blue with pink dots
        { baseColor: '#FFA500', accentColor1: '#8B4513', accentColor2: '#FFFFFF', pattern: 'stripes' },  // Orange with brown stripes
    ];

    tween: Tween.Tween<any> | undefined;
    mesh: THREE.Mesh | undefined;

    // Create a procedural Easter egg texture
    static createEggTexture(style: EggStyle): THREE.CanvasTexture {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 256;
        const ctx = canvas.getContext('2d')!;

        // Base color
        ctx.fillStyle = style.baseColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw pattern based on type
        switch (style.pattern) {
            case 'stripes':
                WorldItemEgg.drawStripes(ctx, canvas, style);
                break;
            case 'zigzag':
                WorldItemEgg.drawZigzag(ctx, canvas, style);
                break;
            case 'dots':
                WorldItemEgg.drawDots(ctx, canvas, style);
                break;
            case 'mixed':
                WorldItemEgg.drawStripes(ctx, canvas, style);
                WorldItemEgg.drawDots(ctx, canvas, style);
                break;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        return texture;
    }

    static drawStripes(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, style: EggStyle) {
        const stripeHeight = 20;
        const gap = 30;
        ctx.strokeStyle = style.accentColor1;
        ctx.lineWidth = stripeHeight;

        for (let y = stripeHeight; y < canvas.height; y += stripeHeight + gap) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Second color stripes (thinner)
        ctx.strokeStyle = style.accentColor2;
        ctx.lineWidth = 4;
        for (let y = stripeHeight + gap / 2; y < canvas.height; y += stripeHeight + gap) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    static drawZigzag(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, style: EggStyle) {
        ctx.strokeStyle = style.accentColor1;
        ctx.lineWidth = 8;

        const amplitude = 15;
        const frequency = 20;
        const yPositions = [60, 130, 200];

        yPositions.forEach(baseY => {
            ctx.beginPath();
            for (let x = 0; x <= canvas.width; x += 5) {
                const y = baseY + (Math.floor(x / frequency) % 2 === 0 ? amplitude : -amplitude);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        });

        // Add small decorative dots between zigzags
        ctx.fillStyle = style.accentColor2;
        for (let y = 30; y < canvas.height; y += 70) {
            for (let x = 20; x < canvas.width; x += 40) {
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    static drawDots(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, style: EggStyle) {
        const dotRadius = 8;
        const spacingX = 30;
        const spacingY = 35;

        let row = 0;
        for (let y = 25; y < canvas.height - 10; y += spacingY) {
            const offset = (row % 2) * (spacingX / 2);
            for (let x = 15 + offset; x < canvas.width - 10; x += spacingX) {
                ctx.fillStyle = (row + Math.floor(x / spacingX)) % 2 === 0 ? style.accentColor1 : style.accentColor2;
                ctx.beginPath();
                ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                ctx.fill();
            }
            row++;
        }
    }

    static initialize() {
        const points = [];

        for (let deg = 0; deg <= 180; deg += 6) {
            const rad = Math.PI * deg / 180;
            const point = new THREE.Vector2((0.72 + .08 * Math.cos(rad)) * Math.sin(rad), - Math.cos(rad)); // the "egg equation"
            points.push(point);
        }

        WorldItemEgg.model = new THREE.LatheGeometry(points, 32); // Higher resolution

        // Pre-create materials with textures
        WorldItemEgg.eggStyles.forEach(style => {
            const texture = WorldItemEgg.createEggTexture(style);
            const material = new THREE.MeshToonMaterial({
                map: texture,
                // roughness/metalness are not needed for Toon
            });
            WorldItemEgg.eggMaterials.push(material);
        });
    }

    color: THREE.Color;
    isCollectable = true;
    isObstacle = false;
    randomOffset: number;
    baseY = 0.1;

    constructor() {
        super();

        const materialIndex = Math.floor(Math.random() * WorldItemEgg.eggMaterials.length);
        const material = WorldItemEgg.eggMaterials[materialIndex];

        // Random offset for animation
        this.randomOffset = Math.random() * 100;

        const mesh = new THREE.Mesh(WorldItemEgg.model, material);

        // Get the base color from the style for the bucket
        const style = WorldItemEgg.eggStyles[materialIndex];
        this.color = new THREE.Color(style.baseColor);

        mesh.scale.set(0.2, 0.2, 0.2);
        mesh.position.y = this.baseY;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Add a simple fake shadow
        const shadowGeo = new THREE.CircleGeometry(0.15, 16);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = -0.05;
        this.add(shadow);

        this.add(mesh);
        this.mesh = mesh;
    }

    collide(collideWithGlobalVector: THREE.Vector3): boolean {
        const worldPosition = new THREE.Vector3();
        this.getWorldPosition(worldPosition);
        const distance = worldPosition.distanceTo(collideWithGlobalVector);
        return distance < 0.5;
    }

    hit(): void {
        if (this.tween) this.tween.stop();

        this.tween = new Tween.Tween(this.scale)
            .to({ x: 0.01, y: 0.01, z: 0.01 }, 300)
            .easing(Tween.Easing.Back.In)
            .start()
            .onComplete(() => this.removeFromParent());
    }

    update(deltaTime: number, player?: THREE.Object3D): void {
        if (this.tween) {
            this.tween.update();
        } else if (this.mesh) {
            const time = performance.now() / 1000;
            const jump = Math.sin(time * 5.0 + this.randomOffset);
            const normalizedJump = jump * 0.5 + 0.5;
            this.mesh.position.y = this.baseY + normalizedJump * 0.2;
        }
    }

}
WorldItemEgg.initialize();