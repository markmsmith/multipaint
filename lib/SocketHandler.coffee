PaintSession = require('./PaintSession')
User = require('./User')
uid = require('uid2')

class SocketHandler

	constructor: (@io) ->
		#TODO store user info in session?
		@users = {}
		@userCount = 0

		@paintSessions = {}

		@io.sockets.on('connection', (socket) =>
			#TODO replace with OAuth userID
			# userID = socket.handshake.sessionID
			userID = uid(24)
			@userCount++
			console.log("User with userID #{userID} connected, userCount now #{@userCount}")

			user = @users[userID] ?= new User(userID, "User&nbsp;#{@userCount}", @randomColor())

			user.addSocketID(socket.id)

			# for concurrent user stats
			socket.json.emit('userCount', { @usersCount })
			# socket.broadcast.emit('userConnected', user)

			socket.on('disconnect', =>
				@handleDisconnect(socket, userID)
			)

			socket.on('createPaintSession', (data, callback) =>
				@createPaintSession(socket, user, data, callback)
			)

			socket.on('joinPaintSession', (data, callback) =>
				@joinExistingPaintSession(socket, user, data, callback)
			)
		)

	handleDisconnect: (socket, userID) =>
		user = @users[userID]
		if user?
			lastSocket = user.removeSocketID(socket.id)
			if lastSocket
				delete @users[userID]
				@userCount--
				console.log("User with userID #{userID} disconnected, userCount now #{@userCount}")
				console.log("Last socket closed for user with session #{userID}, removing from users map.")

				#TODO only emit to the paint sessions they're actually in + clean up layers
				#TODO Should nick names be on a per-user or per-editor basis?
				@io.sockets.emit('userLeft', userID)

	createPaintSession: (socket, user, {clientDimensions}, callback, warnings=null) =>
		#TODO handle if they already had a paint session (leave old room etc)

		ps = new PaintSession(user, clientDimensions)
		@paintSessions[ps.id] = ps

		clientLayers = ps.getClientLayers()

		# a new session will only have user's primary layer
		primaryLayerID = clientLayers[0].id

		@setupPaintSessionListeners(socket, ps, user)

		ackMessage = {
			paintSessionID: ps.id
			layers: clientLayers
			primaryLayerID
			editors: ps.getClientEditors()
			clientID: user.id
		}

		if warnings?
			ackMessage.warnings = warnings

		callback(ackMessage)
		socket.join(ps.id)

	joinExistingPaintSession: (socket, user, data, callback) =>
		{clientDimensions, paintSessionID} = data

		console.log("looking up paintSessionID #{paintSessionID}")
		ps = @paintSessions[paintSessionID]

		unless ps?
			warning = "No paint session found with id #{paintSessionID}, creating a new one."
			console.log(warning)
			warnings = [ warning ]
			delete data.paintSessionID
			@createPaintSession(socket, user, data, callback, warnings)
			return

		primaryLayer = ps.addUser(user, clientDimensions)
		@setupPaintSessionListeners(socket, ps, user)

		ackMessage = {
			paintSessionID: ps.id
			layers: ps.getClientLayers()
			primaryLayerID: primaryLayer.id
			editors: ps.getClientEditors()
			clientID: user.id
		}
		callback(ackMessage)

		# tell everyone else about the new user
		joinMessage = {
			user
			layer: primaryLayer
		}
		@io.sockets.in(ps.id).json.emit('userJoined', joinMessage)
		socket.join(ps.id)

	setupPaintSessionListeners: (socket, paintSession, user) ->
		socket.on('move', (data) =>
			# pass the paint session and user rather than trusting the client data
			@handleMove(socket, paintSession, user, data)
		)

		socket.on('setUserNick', (newNick) =>
			@handleSetUserNick(paintSession, user, newNick)
		)

		socket.on('setUserColor', (newColor) =>
			@handleSetUserColor(paintSession, user, newColor)
		)

	handleMove: (socket, paintSession, user, {
		layerID
		touchID
		canvasPos
		drawing
	}) =>

		jsonSender = @io.sockets.in(paintSession.id).json

		if drawing
			paintSession.draw(layerID, touchID, canvasPos, user.color)
		else
			paintSession.move(layerID, touchID, canvasPos)
			# it's ok if some non-drawing moves are lost
			jsonSender = jsonSender.volatile

		# rebuild moveData so we don't pass on arbitrary data from the client
		remoteMoveData = {
			userID: user.id
			layerID
			touchID
			canvasPos
			drawing
		}

		# echo to all clients
		jsonSender.emit('remoteMove', remoteMoveData)

	handleUserAttrChange: (paintSession, user, attrName, newValue, eventName) =>
		# update the server copy
		user[attrName] = newValue

		# broadcast change to clients
		attrChangeMsg =
			userID: user.id
		attrChangeMsg[attrName] = newValue
		#TODO decide if this should be just paint session, or everywhere (in case in multiple session)
		# Maybe track user's paint sessions and just notify those? (once per user vs editor)
		@io.sockets.in(paintSession.id).json.emit(eventName, attrChangeMsg)

	handleSetUserNick: (paintSession, user, newNick) =>
		# check if the name is taken
		conflictFound = false
		prefixes = {}
		nickRegEx = new RegExp("^#{newNick}")
		for own uID, u of @users
			if u.id == user.id
				continue
			existingNick = u.nick
			if nickRegEx.test(existingNick)
				prefixes[existingNick] = true
				conflictFound or= existingNick.length == newNick.length

		# generate an alternative if necessary
		if conflictFound
			newNick = @generateAlternateNewNick(newNick, prefixes, user)

		@handleUserAttrChange(paintSession, user, 'nick', newNick, 'userNickChange')

	generateAlternateNewNick: (newNick, prefixes, user) ->
		suffixCounter = 1
		maxTries = 256
		foundAlt = false

		until suffixCounter == maxTries or foundAlt
			potentialNick = "#{newNick}_#{suffixCounter}"
			if prefixes[potentialNick]
				suffixCounter++
			else
				newNick = potentialNick
				foundAlt = true

		if foundAlt
			newNick
		else
			# give up and use existing name
			user.nick

	handleSetUserColor: (paintSession, user, newColor) =>
		@handleUserAttrChange(paintSession, user, 'color', newColor, 'userColorChange')


	randomColor: ->
		"#{@random()},#{@random()},#{@random()}"

	# Return a random number between 32 and 160
	random: ->
		Math.floor(Math.random() * 128 + 32)

module.exports = SocketHandler