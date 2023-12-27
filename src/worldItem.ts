interface WorldItem extends THREE.Object3D {
    collide: (collideWithGlobalVector: THREE.Vector3) => boolean;
    isCollectable: boolean;
    isObstacle: boolean;
}