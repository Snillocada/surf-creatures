'use strict';

import * as readline from 'readline';

import { waterfall, forever, AsyncResultCallback, ErrorCallback, eachSeries } from 'async';
import { Client, CountResponse, SearchResponse } from 'elasticsearch';
import * as _ from 'lodash';

import { Bird, Lion, Shark, Mole, Frog, Creature, creatureJSON, fightCreatures } from '../lib/creature';
import { Collector } from '../lib/collector';
import { install } from '../lib/es_install';

// CLIENTS

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const es = new Client({});

// SCOPE PROPERTIES

let creatures: Set<Creature> = new Set();
let me: Collector;
const index = 'creatures';

const creatureClasses: { [key: string]: any }= { Bird, Lion, Shark, Mole, Frog };

// UTILITY FUNCTIONS

const wrap = (cb: AsyncResultCallback<string>) => {
    return (ans: string) => cb(null, ans);
}

function logCreatures(cb: ErrorCallback): void {
    [...creatures].forEach((creature: Creature) => {
        console.log(creature);
    });
    cb(null);
}

function logMe(cb: ErrorCallback): void {
    console.log(me);
    cb(null);
}

function findCreatures(opts: { near?: Boolean, id?: string }, cb: AsyncResultCallback<SearchResponse<any>>) {
    const body: { [ key: string ]: any } = {
        sort : [
            {
                _geo_distance : {
                    position : me.position,
                    order : 'asc',
                    mode : 'min',
                    unit: 'km',
                    distance_type : 'arc',
                    ignore_unmapped: true
                }
            }
        ],
    };
    if (opts?.near) {
        body.query = {
            bool: {
                filter : {
                    geo_distance : {
                        distance : '10000km',
                        position : me.position
                    }
                }
            }
        }
    }
    if (opts?.id) {
        body.query = {
            bool: {
                filter : {
                    term : {
                        id: opts.id
                    }
                }
            }
        }
    }
    es.search({
        size: 5000,
        index,
        body
    }, cb);
}

function logNear(cb: ErrorCallback): void {
    findCreatures({ near: true }, (err: Error | null | undefined, resp: SearchResponse<any> | undefined) => {
        if (err) return cb(err);

        const hits = _.filter(resp?.hits.hits, (dat: any) => {
            return !me.collectionIds.has(dat._source.id);
        });

        console.log(_.map(hits, (dat: any) => {
            return {
                distance: Math.floor(dat.sort),
                id: dat._source.id,
                family: dat._source.family
            }
        }))
        cb(null);
    })
}

function logAllCreatures(cb: ErrorCallback): void {
    findCreatures({ near: false }, (err: Error | null | undefined, resp: SearchResponse<any> | undefined) => {
        if (err) return cb(err);

        console.log(_.map(resp?.hits?.hits, (dat: any) => {
            return {
                distance: Math.floor(dat.sort),
                id: dat._source.id,
                family: dat._source.family,
                caught: me.collectionIds.has(dat._source.id),
            }
        }))
        cb(null);
    })
}

function moveMe(cb: ErrorCallback): void {
    me.move();
    console.log(`Moved to ${me.position}`);
    cb(null);
}

function fightRandom(cb: ErrorCallback): void {
    const creatureOrder = _.shuffle([...me.collectionIds]);

    const opponentClass = _.sample(Object.values(creatureClasses));
    const opponent = new opponentClass();

    console.log('Opponent: ', opponent);
    for (const fightingId of creatureOrder) {
        const fighting: Creature | undefined = _.find([...me.collection], (creature) => creature.id === fightingId);
        if (!fighting || fighting.state === 'FAINTED') continue;

        fightCreatures(fighting, opponent);
        if (opponent.state === 'FAINTED') {
            console.log('Won!');
            break;
        }
    }

    if (opponent.state !== 'FAINTED') {
        console.log('Lost :(')
        console.log('Survived opponent', opponent);
    }

    cb(null);
}

function populateWild (cb: ErrorCallback) {
    for (const creature of Object.values(creatureClasses)) {
        creatures.add(new creature());
        creatures.add(new creature());
    }

    const bulkInsert: Array<Object> = [];
    [...creatures].forEach((creature: Creature) => {
        const data = creature.toJSON();
        bulkInsert.push({
            index: {
                _id: data.id
            }
        });
        bulkInsert.push(data);
    });

    es.bulk({ body: bulkInsert, index, type: index }, (err: Error) => cb(err));
}

function resetWorld(cb: ErrorCallback) {
    me.collection = new Set();
    me.collectionIds = new Set();

    creatures = new Set();

    es.indices.delete({ index }, (err: Error) => {
        if (err) return cb(err);

        install(cb);
    });
}

const functions: {
    [key: string]: (cb: ErrorCallback) => void
} = {
    creatures: logCreatures,
    me: logMe,
    nearme: logNear,
    creaturelocations: logAllCreatures,
    move: moveMe,
    fightrandom: fightRandom,
    populatewild: populateWild,
    resetworld: resetWorld,
};

function catchCreature(answer: string, cb: ErrorCallback): void {
    const [ , id ] = answer.split(' ');

    if (me.collectionIds.has(parseInt(id))) {
        console.log('Already caught');
        return cb(null);
    }

    findCreatures({ id }, (err: Error | null | undefined, resp: SearchResponse<any> | undefined) => {
        if (err) return cb(err);

        const [ creature ] = _.map(resp?.hits?.hits, (dat: any) => {
            return {
                distance: Math.floor(dat.sort),
                source: dat._source,
                creatureClass: creatureClasses[dat._source.family]
            }
        });

        if ((Math.random() * 5000) < creature.distance) {
            console.log('Missed!')
            return cb(null);
        }

        me.collection.add(new creature.creatureClass(creature.source));
        me.collectionIds.add(creature.source.id);
        console.log('Caught!');
        cb(null);
    })
}

// PROCESS

waterfall([
    (cb: AsyncResultCallback<CountResponse>) => {
        console.log('Checking world for creatures');
        es.count({ index }, cb);
    },
    (result: CountResponse, status: number, cb: AsyncResultCallback<string>) => {
        if (!result?.count) {
            rl.question('Hello! You have initialised a new world, do you want it to be populated? (y) >> ', wrap(cb));
            return;
        }

        console.log('Discovering creatures');
        es.search({
            size: 10000,
            index,
            sort: 'id',
            body: {
                query: {
                    match_all: {}
                }
            }
        }, (err: Error, resp: SearchResponse<any>) => {
            if (err) return cb(err);

            const creatureJSONs: Array<creatureJSON> = _.map(resp.hits.hits, '_source');

            for (const data of creatureJSONs) {
                const creatureClass = creatureClasses[data.family];
                creatures.add(new creatureClass(data));
            }
            cb(null, 'n');
        })
    },
    (answer: string | null, cb: ErrorCallback) => {
        if (answer && answer !== 'y') return cb(null);

        populateWild(cb);
    },
    (cb: AsyncResultCallback<string>) => {
        me = new Collector({});

        forever((cb) => {
            rl.question('ask: [creatures, me, nearme, move, creaturelocations, catch <id>, fightrandom, populatewild]\n', (answer) => {
                if (answer.startsWith('catch')) return catchCreature(answer, cb);

                if (!functions[answer]) return cb(null);

                functions[answer](cb);
            });
        }, cb);
    }
], (err: Error | undefined | null) => {
    if (err) console.log(err);
    process.exit();
})
