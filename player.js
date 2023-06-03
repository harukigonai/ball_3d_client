import * as THREE from 'three'

let playerID = 0

export class Player {
    position
    uuid
    username
    team
    ready

    constructor() {
        this.position = new THREE.Vector3()
        this.uuid = playerID++
        this.username = ''
        this.team = ''
        this.ready = false
    }
}
