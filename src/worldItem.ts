interface WorldItem extends THREE.Object3D {
    collide: (collideWithGlobalVector: THREE.Vector3) => boolean;
    update: (deltaTime: number) => void;
    isCollectable: boolean;
    isObstacle: boolean;
}