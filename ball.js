import * as THREE from 'three'

let ballID = 0

export class Ball {
    position
    vel
    uuid

    constructor(params) {
        this.position = params.position
        this.vel = params.vel
        this.uuid = ballID++
    }
}
