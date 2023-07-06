'use strict';

export type position = [ number, number ];

export function generatePosition(): position {
    const lon = Math.floor((Math.random() - 0.5) * 180);
    const lat = Math.floor((Math.random() - 0.5) * 180);
    return [ lon, lat ];
}
