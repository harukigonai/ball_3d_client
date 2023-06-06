import * as THREE from 'three'

let playerID = 0

export class Player {
    position
    facing
    uuid
    username
    team
    ready
    live

    constructor() {
        this.position = new THREE.Vector3()
        this.facing = new THREE.Vector3()
        this.uuid = playerID++
        this.username = ''
        this.team = ''
        this.ready = false
        this.live = true
    }
}
