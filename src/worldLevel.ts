import * as THREE from 'three';
import { WorldItemEgg } from './worldItemEgg';
import { WorldItemObstacle } from './worldItemObstacle';

export class WorldLevel {
    levelNumber = 1;
    speed = 1;
    collectables: WorldItem[] = [];
    obstacles: WorldItem[] = [];

    //egg level: 1 is egg, 0 is empty, 2 is obstacle
    level = [
        [0, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 2, 0, 2],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 2],
        [0, 1, 1, 2],
        [0, 1, 0, 0],
        [1, 0, 0, 0],
        [1, 1, 0, 0],
        [1, 1, 1, 0],
        [1, 1, 0, 0],
        [1, 0, 0, 10],
        [1, 1, 0, 0],
        [1, 1, 1, 0],
        [1, 1, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 0],
    ];

    levelUp() {
        this.levelNumber++;
        this.speed += 0.5;
    }

    reset() {
        this.levelNumber = 1;
        this.speed = 1;
    }

    getPartOfLevel(from: number = 0, to: number = 18) {
        const level = [];
        for (let i = from; i < to; i++) {
            if (!this.level[i]) break;
            level.push(this.level[i]);
        }
        return level;
    }

    putPartofLevelToMap(placeholders2d: THREE.Object3D[][], from:number=0, to:number=18) {
        const level = this.getPartOfLevel(from, to);

        for (let i = 0; i < level.length; i++) {
            const levelRow = level[i];
            const placeholdersRow = placeholders2d[i];
            if(!placeholdersRow) break;

            for (let j = 0; j < levelRow.length; j++) {
                const levelCell = levelRow[j];
                const placeholder = placeholdersRow[j];
                if(!placeholder) break;

                placeholder.children.forEach((child: THREE.Object3D) => {
                    placeholder.remove(child);
                });

                switch (levelCell) {
                    case 0:
                        //empty
                        break;
                    case 1:
                        const egg = new WorldItemEgg();
                        this.collectables.push(egg);
                        placeholder.add(egg);
                        break;
                    case 2:
                        const obstacle = new WorldItemObstacle();
                        this.obstacles.push(obstacle);
                        placeholder.add(obstacle);
                        break;
                }

            }
        }
    }

    update(deltaTime: number) {
        this.collectables.forEach(c => c.update(deltaTime));
        this.obstacles.forEach(o => o.update(deltaTime));

    }
}