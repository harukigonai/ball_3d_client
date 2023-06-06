import * as THREE from 'three'

let ballID = 0

export class Ball {
    position
    vel
    uuid
    live

    constructor(params) {
        this.position = params.position
        this.vel = params.vel
        this.uuid = ballID++
        this.live = false
    }
}
