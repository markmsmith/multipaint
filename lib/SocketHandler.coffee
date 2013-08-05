PaintSession = require('./PaintSession')
User = require('./User')

class SocketHandler

	constructor: (@io) ->
		#TODO store user info in session?
		@users = {}
		@userCount = 0

		@paintSessions = {}

		@io.sockets.on('connection', (socket) =>
			#TODO replace with OAuth userID
			userID = socket.handshake.sessionID
			console.log("User with sessionID #{userID} connected")

			user = @users[userID] ?= new User(userID, "User&nbsp;#{++@userCount}", @randomColor())

			user.addSocketID(socket.id)

			# for concurrent user stats
			socket.json.emit('userCount', { @usersCount })
			# socket.broadcast.emit('userConnected', user)

			socket.on('disconnect', =>
				console.log("User with sessionID #{userID} disconnected")

				user = @users[userID]
				if user?
					lastSocket = user.removeSocketID(socket.id)
					if lastSocket
						delete @users[userID]
						console.log('Last socket closed for user with session #{userID}, removing from users map.')
			)

			socket.on('createPaintSession', ({clientDimensions}, callback) =>
				#TODO handle if they already had a paint session (leave old room etc)

				ps = new PaintSession(user, clientDimensions)
				@paintSessions[ps.id] = ps
				socket.join(ps.id)

				clientLayers = ps.getClientLayers()

				# a new session will only have user's primary layer
				primaryLayerID = clientLayers[0].id
				console.log("created paint session with primaryLayerID #{primaryLayerID}")

				socket.on('move', (data) =>
					# pass the paint session and user rather than trusting the client data
					@handleMove(socket, ps, user, data)
				)

				socket.on('setUserColor', (newColor) =>
					# pass the paint session and user rather than trusting the client data
					@handleSetUserColor(socket, ps, user, newColor)
				)

				ackMessage = {
					paintSessionID: ps.id
					layers: clientLayers
					primaryLayerID
					editors: ps.getClientEditors()
					clientID: userID
				}

				console.log('createPaintSession ack message ', ackMessage)
				callback(ackMessage)
			)

			socket.on('joinPaintSession', ({clientDimensions, paintSessionID}, callback) =>
				ps = @paintSessions[paintSessionID]
				console.log("looking up paintSessionID #{paintSessionID}")
				console.log("got paintsession ", ps)
				unless ps?
					callback(
						error: "No paint session found with id #{paintSessionID}"
					)
					return

				primaryLayerID = ps.addUser(user, clientDimensions)
				console.log("joined paint session with primaryLayerID #{primaryLayerID}")

				ackMessage = {
					paintSessionID: ps.id
					layers: ps.getClientLayers()
					primaryLayerID
					editors: ps.getClientEditors()
					clientID: userID
				}
				callback(ackMessage)
			)
		)

	handleMove: (socket, paintSession, user, {
		canvasPos
		drawing
	}) =>

		# rebuild moveData so we don't pass on arbitrary data from the client
		remoteMoveData = {
			canvasPos
			drawing
		}

		# echo to all clients
		jsonSender = @io.sockets.in(paintSession.id).json
		if !drawing
			# it's ok if some non-drawing moves are lost
			jsonSender = jsonSender.volatile

		jsonSender.emit('remoteMove', remoteMoveData)

	handleSetUserColor: (socket, paintSession, user, newColor) =>
		#TODO
		console.log("User changed color to #{newColor}")


	randomColor: ->
		"#{@random()},#{@random()},#{@random()}"

	# Return a random number between 32 and 160
	random: ->
		Math.floor(Math.random() * 128 + 32)

module.exports = SocketHandler