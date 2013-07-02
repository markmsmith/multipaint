PaintSession = require('./PaintSession')

class SocketHandler

	constructor: (@io) ->
		#TODO store user info in session?
		@users = {}
		@userCount = 0

		io.sockets.on('connection', (socket) =>
			userID = socket.handshake.sessionID
			console.log("User with sessionID #{userID} connected")

			user = @users[userID] ?=
				id: userID
				nick: "User&nbsp;#{++@userCount}"
				color: @randomColor()
				socketIDs: []

			user.socketIDs.push(socket.id)

			socket.json.emit('users', { @users, userID })
			socket.broadcast.emit('userConnected', user)

			ps = new PaintSession()
			ps.addUser(user)

			socket.on('move', (data) =>
				console.log(data)
			)
		)

		io.sockets.on('disconnect', (socket) =>
			userID = socket.handshake.sessionID
			console.log("User with sessionID #{userID} disconnected")

			user = @users[userID]
			if user?
				user.socketIDs = _.filter(user.socketIDs, (val) -> return val != socket.id)
				if user.socketIDs.length == 0
					delete @users[userID]
					console.log('Last socket closed for user with session #{userID}, removing from users map.')
		)

	randomColor: ->
		"#{@random()},#{@random()},#{@random()}"

	# Return a random number between 32 and 160
	random: ->
		Math.floor(Math.random() * 128 + 32)

module.exports = SocketHandler