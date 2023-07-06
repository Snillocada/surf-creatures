'use strict';

import { position, generatePosition } from './positions';

import * as _ from 'lodash';

export type creatureType = 'FLYER' | 'SWIMMER' | 'RUNNER' | 'DIGGER' | 'AMPHIBIAN';

export type creatureState = 'HEALTHY' | 'FAINTED';

const SUPER_MULTIPLIER = 2;

const CREATE_SUPER_TYPES: {
    [key: string]: Array<creatureType>
} = {
    'FLYER': [ 'SWIMMER' ],
    'SWIMMER': [ 'DIGGER' ],
    'RUNNER': [ 'FLYER' ],
    'DIGGER': [ 'RUNNER' ],
    'AMPHIBIAN': [ 'FLYER', 'SWIMMER', 'RUNNER', 'DIGGER' ]
}

function generateTypeMatchup (type: creatureType) : (this: Creature, otherType: creatureType) => Boolean {
    return (otherType: creatureType) => {
        const superTypes = CREATE_SUPER_TYPES[type];
        if (!superTypes) return false;
        return superTypes.includes(otherType);
    };
}

function generateDamage () : (this: Creature, other: Creature) => void {
    return function (this: Creature, other: Creature) {
        const superDamage: Boolean = this.superTypeMatchup(other.type);
        const damage = this.CP * (superDamage ? SUPER_MULTIPLIER : 1);

        if (damage >= other.HP) {
            other.HP = 0;
            other.state = 'FAINTED';
        } else other.HP -= damage;
    }
}

export type creatureJSON = {
    id: number;
    type: creatureType;
    maxHP: number;
    HP: number;
    CP: number;
    position: Array<number>;
    state: creatureState;
    family: string;
}

export type Creature = {
    type: creatureType;
    maxHP: number;
    HP: number;
    CP: number;
    position: position;
    state: creatureState;
    id: number;
    family: string;

    superTypeMatchup: (this: Creature, otherType: creatureType) => Boolean;
    damage: (this: Creature, other: Creature) => void;
    toJSON: () => creatureJSON;
}

function generateOffset(multiplier: number): number {
    const initial = Math.floor(10 * (Math.random() - 0.5));

    return Math.floor(multiplier * initial);
}

class CreatureClass {
    maxHP: number;
    HP: number;
    CP: number;
    type: creatureType;
    position: position;
    id: number;
    family: string;
    superTypeMatchup: (this: Creature, otherType: creatureType) => Boolean;
    damage: (this: Creature, other: Creature) => void;

    state: creatureState = 'HEALTHY';
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            maxHP: this.maxHP,
            HP: this.HP,
            CP: this.CP,
            position: [ ...this.position ],
            state: this.state,
            family: this.family,
        };
    }
}

let index: number = 1;

function constructCreature(this: Creature, creatureClass: any, opts: {
    position?: position,
    maxHP?: number,
    HP?: number,
    CP?: number,
    id?: number,
}): void {
    this.superTypeMatchup = generateTypeMatchup(this.type).bind(this);
    this.damage = generateDamage().bind(this);

    this.maxHP = opts.maxHP || creatureClass.baseTypeHP + generateOffset(10);
    this.HP = opts.HP || this.maxHP;

    this.CP = opts.CP || (creatureClass.baseTypeHP + generateOffset(1));

    this.position = opts.position || generatePosition();

    if (opts.id && opts.id >= index) index = opts.id + 1;
    this.id = opts.id || index++;
    this.family = creatureClass.name;
}

export class Bird extends CreatureClass implements Creature {
    static baseTypeHP = 50;
    static baseTypeCP = 10;

    type: creatureType = 'FLYER';

    constructor(opts: {
        position?: position,
        maxHP?: number,
        HP?: number,
        CP?: number,
        id?: number,
    } = {}) {
        super();
        constructCreature.call(this, Bird, opts);
    }
}


export class Shark extends CreatureClass implements Creature {
    static baseTypeHP = 150;
    static baseTypeCP = 30;

    type: creatureType = 'SWIMMER';

    constructor(opts: {
        position?: position,
        maxHP?: number,
        HP?: number,
        CP?: number,
        id?: number,
    } = {}) {
        super();
        constructCreature.call(this, Shark, opts);
    }
}

export class Lion extends CreatureClass implements Creature {
    static baseTypeHP = 100;
    static baseTypeCP = 40;

    type: creatureType = 'RUNNER';

    constructor(opts: {
        position?: position,
        maxHP?: number,
        HP?: number,
        CP?: number,
        id?: number,
    } = {}) {
        super();
        constructCreature.call(this, Lion, opts);
    }
}

export class Mole extends CreatureClass implements Creature {
    static baseTypeHP = 100;
    static baseTypeCP = 5;

    type: creatureType = 'DIGGER';

    constructor(opts: {
        position?: position,
        maxHP?: number,
        HP?: number,
        CP?: number,
        id?: number,
    } = {}) {
        super();
        constructCreature.call(this, Mole, opts);
    }
}

export class Frog extends CreatureClass implements Creature {
    static baseTypeHP = 20;
    static baseTypeCP = 40;

    type: creatureType = 'AMPHIBIAN';

    constructor(opts: {
        position?: position,
        maxHP?: number,
        HP?: number,
        CP?: number,
        id?: number,
    } = {}) {
        super();
        constructCreature.call(this, Frog, opts);
    }
}

export function fightCreatures(left: Creature, right: Creature): Creature {
    while (left.state === 'HEALTHY' && right.state === 'HEALTHY') {
        const fightOrder = _.shuffle([ left, right ]);

        fightOrder[0].damage(fightOrder[1]);
        if (fightOrder[1].state === 'HEALTHY')
            fightOrder[1].damage(fightOrder[0]);
    }

    const fainted = left.state === 'HEALTHY' ? right : left;
    console.log('Fainted: ', fainted);

    return left.state === 'HEALTHY' ? left : right;
}
