import { createServer } from 'http'
import { Player } from './player.js'
import { Server } from 'socket.io'
import { Ball } from './ball.js'
import * as THREE from 'three'

const court_width = 30
const court_length = 60
const player_height = 2
const ball_radius = 0.5

let playerMap = new Map()
let gameInSession = false
let numPlayersAliveRed = 0
let numPlayersAliveBlue = 0
let ballMap = new Map()
const numBalls = 1

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

        if (gameInSession) {
            if (player.live) {
                if (player.team == 'red') numPlayersAliveRed--
                else if (player.team == 'blue') numPlayersAliveBlue--
            }

            if (numPlayersAliveRed == 0 || numPlayersAliveBlue == 0) {
                endGame()
            }
        }
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

                    gameInSession = true
                    numPlayersAliveRed = 0
                    numPlayersAliveBlue = 0
                    playerMap.forEach((player, _) => {
                        if (player.team == 'red') numPlayersAliveRed++
                        else if (player.team == 'blue') numPlayersAliveBlue++
                    })
                }
            }
        }
    })

    socket.on('ready-to-start-game', (data) => {
        if (!gameInSession) return

        if (player.username == '') {
            socket.emit('return-to-enter-name', {})
            console.log('Emitting return-to-enter-name')
            return
        } else if (player.team == '') {
            socket.emit('return-to-select-team', {})
            console.log('Emitting return-to-select-team')
            return
        }

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
        if (!gameInSession) return

        const packet = JSON.parse(data)

        player.position = packet.position
        if (player.live && !packet.live) {
            if (player.team == 'red') numPlayersAliveRed--
            else if (player.team == 'blue') numPlayersAliveBlue--
        }
        player.live = packet.live

        socket.to('game').emit(
            'updatePlayer',
            JSON.stringify({
                uuid: player.uuid,
                position: player.position,
                vel: player.vel,
                live: player.live,
            })
        )

        if (numPlayersAliveRed == 0 || numPlayersAliveBlue == 0) {
            endGame()
        }
    })

    // receive a message from the client
    socket.on('updateBall', (data) => {
        if (!gameInSession) return

        const packet = JSON.parse(data)

        const uuid = packet.uuid
        const ball = ballMap.get(uuid)
        ball.position = packet.position
        ball.quaternion = packet.quaternion
        ball.vel = packet.vel
        ball.live = packet.live

        socket.to('game').emit('updateBall', data)
    })
})

const endGame = () => {
    if (numPlayersAliveRed == 0 || numPlayersAliveBlue == 0) {
        gameInSession = false

        playerMap.forEach((player, _) => {
            player.username = ''
            player.team = ''
            player.ready = false
            player.live = true
        })

        let result = 'Draw'
        if (numPlayersAliveRed > 0) result = 'Red Wins'
        else if (numPlayersAliveBlue > 0) result = 'Blue Wins'

        io.sockets.in('game').emit(
            'game-over',
            JSON.stringify({
                result: result,
            })
        )
    }
}

httpServer.listen(process.env.PORT || 5000, () => {
    const port = httpServer.address().port
    console.log('Server is listening on port %s.', port)
})

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
    computeInitBallOrientations()

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
    computeInitPlayerOrientations()

    const clientPlayerMap = {}

    playerMap.forEach((player, uuid) => {
        clientPlayerMap[uuid] = {
            playable: uuid == playerUuid,
            uuid: player.uuid,
            position: player.position,
            vel: player.vel,
            team: player.team,
            facing: player.facing,
            name: player.username,
        }
    })

    return clientPlayerMap
}

const computeInitPlayerOrientations = () => {
    let numRedTeam = 0
    let numBlueTeam = 0

    playerMap.forEach((player, _) => {
        if (player.team == 'red') numRedTeam++
        else if (player.team == 'blue') numBlueTeam++
    })

    const redTeamSpacing = court_width / (numRedTeam + 1)
    const blueTeamSpacing = court_width / (numBlueTeam + 1)

    let i = 1
    let j = 1

    playerMap.forEach((player, _) => {
        if (player.team == 'red') {
            player.position.x = -court_width / 2 + redTeamSpacing * i++
            player.position.y = player_height / 2
            player.position.z = -court_length / 2 + player_height + 15

            player.facing.x = 0
            player.facing.y = 0
            player.facing.z = 1
        } else if (player.team == 'blue') {
            player.position.x = -court_width / 2 + blueTeamSpacing * j++
            player.position.y = player_height / 2
            player.position.z = court_length / 2 - player_height - 15

            player.facing.x = 0
            player.facing.y = 0
            player.facing.z = -1
        }
    })
}

const computeInitBallOrientations = () => {
    if (ballMap.size == numBalls) {
        const ballSpacing = court_width / (numBalls + 1)
        let i = 0
        ballMap.forEach((ball, _) => {
            ball.position = new THREE.Vector3(
                -court_width / 2 + ballSpacing * (i + 1),
                ball_radius,
                0
            )
            ball.vel = new THREE.Vector3(0, 0, 0)
            i++
        })
    } else {
        const ballSpacing = court_width / (numBalls + 1)
        for (let i = 0; i < numBalls; i++) {
            const ball = new Ball({
                position: new THREE.Vector3(
                    -court_width / 2 + ballSpacing * (i + 1),
                    ball_radius,
                    0
                ),
                vel: new THREE.Vector3(0, 0, 0),
            })
            ballMap.set(ball.uuid, ball)
        }
    }
}
