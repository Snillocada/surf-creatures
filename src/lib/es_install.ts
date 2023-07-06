'use strict';

import * as fs from 'fs';
import * as path from 'path';

import { ErrorCallback } from 'async';

import { Client } from 'elasticsearch';

export function install (cb: ErrorCallback) {
    const es = new Client({});

    fs.readFile(path.resolve(__dirname, '../../elasticsearch/mapping.json'), 'utf-8', (err, data) => {
        if (err) return cb(err);

        const mapping = {
            mappings: {
                creatures: JSON.parse(data)
            }
        }
        es.indices.create({
            body: mapping,
            index: 'creatures'
        }, (err: Error) => cb(err));
    });
}
