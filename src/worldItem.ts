interface WorldItem extends THREE.Object3D {
    collide: (collideWithGlobalVector: THREE.Vector3) => boolean;
    color: THREE.Color;
    update: (deltaTime: number) => void;
    isCollectable: boolean;
    isObstacle: boolean;
}