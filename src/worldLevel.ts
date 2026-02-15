import * as THREE from 'three';
import { WorldItemEgg } from './worldItemEgg';
import { WorldItemObstacle } from './worldItemObstacle';
import { WorldItemCarrot } from './worldItemCarrot';

export class WorldLevel {
    levelNumber = 1;
    speed = 1;
    collectables: WorldItem[] = [];
    obstacles: WorldItem[] = [];

    //egg level: 1 is egg, 0 is empty, 2 is obstacle, 3 is carrot
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

    constructor(random: boolean = true) {
        if (random) {
            this.level = [];
            const rows = 20;
            for (let i = 0; i < rows; i++) {
                const row = [];
                for (let j = 0; j < 4; j++) {
                    //40% empty, 40% egg, 20% obstacle
                    const rand = Math.random();
                    if (rand < 0.4) {
                        row.push(0); //empty
                    } else if (rand < 0.8) {
                        row.push(1); //egg
                    } else if (rand < 0.97) {
                        row.push(2); //obstacle
                    } else {
                        row.push(3); //carrot
                    }
                }
                this.level.push(row);
            }
        }
    }

    levelUp() {
        this.levelNumber++;
        this.speed += 0.5;
        this.emptyWorldItems();
    }

    reset() {
        this.levelNumber = 1;
        this.speed = 1;
        this.emptyWorldItems();
    }

    private emptyWorldItems() {
        this.obstacles.forEach(o => o.removeFromParent());
        this.obstacles = [];
        this.collectables.forEach(c => c.removeFromParent());
        this.collectables = [];
    }

    getPartOfLevel(from: number, to: number) {
        const level = [];
        for (let i = from; i < to; i++) {
            if (!this.level[i]) break;
            level.push(this.level[i]);
        }
        return level;
    }

    putPartofLevelToMap(placeholders2d: THREE.Object3D[][], from: number = 0, to: number = 17) {
        if (to - from > placeholders2d.length) throw new Error('Not enough placeholders');
        const level = this.getPartOfLevel(from, to);

        for (let i = 0; i < level.length; i++) {
            const levelRow = level[i];
            const placeholdersRow = placeholders2d[i];
            if (!placeholdersRow) break;

            for (let j = 0; j < levelRow.length; j++) {
                const levelCell = levelRow[j];
                const placeholder = placeholdersRow[j];
                if (!placeholder) break;

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
                    case 3:
                        //carrot
                        const carrot = new WorldItemCarrot();
                        this.collectables.push(carrot);
                        placeholder.add(carrot);
                        break;
                }

            }
        }
    }

    update(deltaTime: number, player?: THREE.Object3D) {
        this.collectables.forEach(c => c.update(deltaTime, player));
        this.obstacles.forEach(o => o.update(deltaTime, player));
    }
}