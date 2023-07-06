'use strict';

import { Creature } from './creature';
import { position, generatePosition } from './positions';

let index: number = 1;

export class Collector {
    collection: Set<Creature>;
    collectionIds: Set<number>;
    position: position;
    id: number;
    constructor(opts: { position?: position }) {
        this.collection = new Set();
        this.collectionIds = new Set();
        this.position = opts.position || generatePosition();

        this.id = index++;
    }
    move(): Collector {
        this.position = generatePosition();
        return this;
    }
}
