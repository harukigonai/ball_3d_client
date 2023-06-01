import { createServer } from 'http'
import { Player } from './player.js'
import { Server } from 'socket.io'
import { Ball } from './ball.js'
import * as THREE from 'three'

const socketToPlayer = new Map()

const ballMap = new Map()
let ball = new Ball({
    position: new THREE.Vector3(2, 3, -2),
    vel: new THREE.Vector3(0, 0, 0),
})
ballMap.set(ball.uuid, ball)

ball = new Ball({
    position: new THREE.Vector3(-2, 3, -2),
    vel: new THREE.Vector3(0, 0, 0),
})
ballMap.set(ball.uuid, ball)

const httpServer = createServer()

const io = new Server(httpServer, {
    cors: {
        origin: '*',
    },
})

io.on('connection', (socket) => {
    const player = new Player()
    socketToPlayer[socket] = player

    socket.join('game')

    socket.send(
        JSON.stringify({
            type: 'initBallMap',
            content: constructClientBallMap(),
        })
    )

    // receive a message from the client
    socket.on('message', (data) => {
        const packet = JSON.parse(data)
        // console.log(packet)

        switch (packet.type) {
            case 'updatePlayer':
                player.position = packet.content.position
                // console.log(player.position)

                socket.to('game').emit(
                    'message',
                    JSON.stringify({
                        playerID: player.uuid,
                        position: player.position,
                    })
                )
                break
            case 'updateBall':
                const uuid = packet.content.uuid
                const ball = ballMap.get(uuid)
                ball.position = packet.content.position

                socket.to('game').emit(
                    'message',
                    JSON.stringify({
                        playerID: ball.uuid,
                        position: ball.position,
                    })
                )
                break
        }
    })
})

httpServer.listen(3000)

const constructClientBallMap = () => {
    const clientBallMap = {}

    ballMap.forEach((ball, uuid) => {
        clientBallMap[uuid] = {
            uuid: ball.uuid,
            position: ball.position,
            vel: ball.vel,
        }
    })

    return clientBallMap
}
