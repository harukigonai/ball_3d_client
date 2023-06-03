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

const playerMap = new Map()

const httpServer = createServer()

const io = new Server(httpServer, {
    cors: {
        origin: '*',
    },
})

io.on('connection', (socket) => {
    const player = new Player()
    playerMap.set(player.uuid, player)

    socket.join('game')
    console.log(`Player ${player.uuid} connected.`)

    socket.on('disconnect', () => {
        console.log(`Player ${player.uuid} disconnected.`)
        playerMap.delete(player.uuid)
    })

    socket.on('enter-name', (data) => {
        const packet = JSON.parse(data)
        const username = packet.username

        if (username == '')
            console.log(`Player ${player.uuid} set invalid username.`)
        else {
            console.log(`Player ${player.uuid} set username to ${username}`)
            player.username = username

            broadcastTeamSelectionInfo(socket)
        }
    })

    socket.on('select-team', (data) => {
        const packet = JSON.parse(data)
        const team = packet.team

        if (player.username == '') {
            console.log(
                `Player ${player.uuid} selected team before setting username.`
            )
        } else if (team != 'red' && team != 'blue')
            console.log(`Player ${player.uuid} selected invalid team.`)
        else {
            console.log(`Player ${player.uuid} set team to ${team}.`)
            player.team = team
            player.ready = false

            broadcastTeamSelectionInfo(socket)
        }
    })

    socket.on('request-team-selection-info', (data) =>
        broadcastTeamSelectionInfo(socket)
    )

    socket.on('confirm-ready', (data) => {
        const packet = JSON.parse(data)
        const ready = packet.ready

        console.log(ready)

        if (player.username == '' || player.team == '') {
            console.log(
                `Player ${player.uuid} confirmed ready before entering username or selecting team.`
            )
        } else if (ready != false && ready != true)
            console.log(`Player ${player.uuid} selected invalid ready state.`)
        else {
            console.log(`Player ${player.uuid} set ready state to ${ready}`)
            player.ready = ready

            broadcastTeamSelectionInfo(socket)

            if (player.ready) {
                // Are all players ready?
                let allReady = true

                // Potential race condition if someone sends not ready around here?
                playerMap.forEach(
                    (player, _) => (allReady = allReady && player.ready)
                )

                if (allReady) {
                    // Start the game
                    console.log('Sending start-game')
                    io.sockets.in('game').emit('start-game', JSON.stringify({}))
                }
            }
        }
    })

    socket.on('ready-to-start-game', (data) => {
        socket.emit(
            'init',
            JSON.stringify({
                ballMap: constructClientBallMap(),
                playerMap: constructClientPlayerMap(player.uuid),
            })
        )
    })

    // receive a message from the client
    socket.on('updatePlayer', (data) => {
        const packet = JSON.parse(data)
        console.log('updatePlayer', packet)

        player.position = packet.position

        socket.to('game').emit(
            'updatePlayer',
            JSON.stringify({
                uuid: player.uuid,
                position: player.position,
            })
        )
    })

    // receive a message from the client
    socket.on('updateBall', (data) => {
        const packet = JSON.parse(data)
        // console.log(packet)

        const uuid = packet.uuid
        const ball = ballMap.get(uuid)
        ball.position = packet.position
        ball.vel = packet.vel

        socket.to('game').emit('updateBall', data)
    })
})

httpServer.listen(4000)

const broadcastTeamSelectionInfo = (socket) => {
    const redTeam = []
    const blueTeam = []
    const unselectedTeam = []

    playerMap.forEach((player, _) => {
        const playerInfo = {
            username: player.username,
            ready: player.ready,
        }
        if (player.team == 'red') redTeam.push(playerInfo)
        else if (player.team == 'blue') blueTeam.push(playerInfo)
        else unselectedTeam.push(playerInfo)
    })

    console.log('Emitting team-selection-info')
    io.sockets.in('game').emit(
        'team-selection-info',
        JSON.stringify({
            redTeam: redTeam,
            blueTeam: blueTeam,
            unselectedTeam: unselectedTeam,
        })
    )
}

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

const constructClientPlayerMap = (playerUuid) => {
    const clientPlayerMap = {}

    playerMap.forEach((player, uuid) => {
        clientPlayerMap[uuid] = {
            playable: uuid == playerUuid,
            uuid: player.uuid,
            position: player.position,
            vel: player.vel,
        }
    })

    return clientPlayerMap
}
