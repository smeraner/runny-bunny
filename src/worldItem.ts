interface WorldItem extends THREE.Object3D {
    collide: (collideWithGlobalVector: THREE.Vector3) => boolean;
    hit: () => void;
    color: THREE.Color;
    update: (deltaTime: number, player?: THREE.Object3D) => void;
    isCollectable: boolean;
    isObstacle: boolean;
}