import * as THREE from 'three'

let playerID = 0

export class Player {
    position
    uuid

    constructor() {
        this.position = new THREE.Vector3()
        this.uuid = playerID++
    }
}
