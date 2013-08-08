window.MultiPaint ?= {}

class MultiPaint.Client

	# holderID is the id of the element to hold the canvas
	# paintSession is the GUUID of an existing session to join, or empty
	constructor: (@holderID, @paintSessionID) ->
		# whether we're talking to a server before changing the UI
		@standalone = false
		@viewport = $(window)
		@holder = $("##{holderID}")

		holderDimensions = @_getHolderDimensions()
		@holder.attr(holderDimensions)
		# @holder.css('height', holderDimensions.height)

		#TODO maybe switch this from an id to a class and search within holder
		@interactionLayer = $("#interactionLayer")
		@interactionLayer.attr(holderDimensions)

		@socket = io.connect()

		@socket.on('connecting', ->
			console.log('Connecting...')
		)

		@socket.on('connect_failed', ->
			console.log("Failed to connect")
		)

		@socket.on('disconnect', ->
			console.log('Disconnected')
		)

		@socket.on('reconnecting', (nextRetry) ->
			console.log("Reconnecting in #{nextRetry} seconds...")
		)

		@socket.on('reconnect', ->
			console.log("Reconnected")
		)

		@socket.on('error', (e) ->
			console.log('An error occurred connecting to socket: ', e ? 'A unknown error occurred')
		)

		@socket.on('connect', =>
			console.log('Connected')
			connectMessage =
				clientDimensions: holderDimensions

			# check without ? to handle empty string as falsey as well
			if @paintSessionID
				console.log("Joining existing paint session with ID #{@paintSessionID}.")
				connectMessage.paintSessionID = @paintSessionID
				@socket.json.emit('joinPaintSession', connectMessage, @onJoinPaintSession)
			else
				console.log("Creating a new paint session to join.")
				@socket.json.emit('createPaintSession', connectMessage, @onJoinPaintSession)
		)

	onJoinPaintSession: ({
		@paintSessionID
		layers
		primaryLayerID
		editors
		clientID
	}) =>
		holderDimensions = @_getHolderDimensions()
		@layers = {}
		_.each(layers, (layer) =>

			#TODO figure out how to deal with dimensions on client of other people's different sized layers
			# just show as own size for now
			layer.dimensions = holderDimensions

			localLayer = @addLocalLayer(layer)

			# check if it's the user's primary layer
			if layer.id == primaryLayerID
				# selectedLayer is the layer they're currently drawing to
				# the user's primary layer is one they can't delete
				@selectedLayer = @primaryLayer = localLayer
		)

		@users = {}
		@userCount = 0
		_.each(editors, (serverEditor) =>
			#TODO concept of editorID, distinct from userID
			serverUser = serverEditor.user
			localUser = @addLocalUser(serverUser)

			if serverUser.id == clientID
				@clientUser = localUser
		)

		@viewport.resize =>
			@resizeCanvas()

		@socket.on('remoteMove', @handleRemoteMove)
		@socket.on('userJoined', @handleUserJoined)

		# only listen to the interaction layer for mouse move, so don't expand holder with avatar
		@interactionLayer.mousemove _.throttle((event) =>
			position =
				x: event.pageX
				y: event.pageY
			@handleMove(position)
		, 50)

		# need to listen to holder (rather than canvas), since avatar canvas is in the way and
		# is a sibling of the drawing canvas
		@holder.mousedown (event) =>
			@drawing = true

		# listen to the document (rather than holder) for mouse up so that if they drag out
		# of the canvas before releasing, it still stops drawing
		$(document).mouseup (event) =>
			@drawing = false

		# if exit and renter, update position so don't draw line from exit point
		@holder.mouseenter (event) =>
			position =
				x: event.pageX
				y: event.pageY
			@handleMove(position, false)


		# check if this needs to be interaction layer to prevent same avater-expanding problem
		@holder.on 'touchstart': (event) =>
			# since touches can jump without first moving to the new location,
			# need to update position first or we'll draw from the last touch location
			touch = event.originalEvent.touches[0]
			position =
				x: touch.pageX
				y: touch.pageY
			@handleMove(position)

			@drawing = true

		@holder.on 'touchend': (event) =>
			@drawing = false

		@holder.on 'touchmove': _.throttle((event) =>
			event.preventDefault()
			touch = event.originalEvent.touches[0]
			position =
				x: touch.pageX
				y: touch.pageY
			@handleMove(position)
		, 25)

		# we're ready to draw!
		@ready = true

		# @socket.on('users', (userInfo) ->
		# 	console.log("users: ", userInfo)
		# 	@users = userInfo.users
		# 	@clientUser = userInfo.users[userInfo.userID]
		# )

		# dummyUser =
		# 	id: 1
		# 	nick: 'user1'
		# 	color: '255,0,0'
		# @addLocalUser(dummyUser)

	getPaintSessionInvite: =>
		return "#{window.location.origin}?paintSession=#{@paintSessionID}"

	addLocalLayer: (layer) ->
		@layers[layer.id] = new MultiPaint.Layer(@interactionLayer, layer)

	addLocalUser: (user) ->
		localUser =
			id: user.id
			nick: user.nick
			color: user.color
			avatar: @createAvatar(user)
		@users[user.id] = localUser
		@userCount++

		return localUser

	setUserColor: (newColor) ->
		if @standalone
			@clientUser.color = newColor
			@redrawAvatar(@clientUser)
		else
			if @ready
				#TODO update server color properly
				@socket.emit('setUserColor', newColor)
			else
				#TODO pick up after init
				@bufferedColor = newColor

	handleMove: (position, drawing=@drawing) =>
		canvasPos = @windowToCanvasPos(position)
		if @standalone
			@moveLocalUser(@clientUser, @selectedLayer.id, canvasPos, drawing)
		else
			#TODO Add touch id / multi-touch support
			moveData = {
				layerID: @selectedLayer.id
				canvasPos
				drawing
			}
			@socket.json.emit('move', moveData)

	handleRemoteMove: ({userID, layerID, canvasPos, drawing}) =>
		localUser = @users[userID]
		unless localUser?
			console.error('Received moved from unknown user: ', userID)
			return


		@moveLocalUser(localUser, layerID, canvasPos, drawing)

	handleUserJoined: ({user, layer}) =>
		if user.id == client.id
			# ignore notifications about self
			return

		@addLocalLayer(layer)
		@addLocalUser(user)

	_getHolderDimensions: ->
		body = $('body')
		# assume these are all in pixels
		bodyMargin = parseInt($('body').css('margin-bottom'), 10)
		bodyPadding = parseInt($('body').css('padding-bottom'), 10)
		holderTop = @holder.offset().top
		canvasBorder = parseInt($('#sketchArea').css('border-bottom-width'), 10)
		if isNaN(canvasBorder)
			canvasBorder = 1
		width: @holder.width()
		height: @viewport.height() - bodyMargin - bodyPadding - canvasBorder - holderTop

	resizeCanvas: ->
		console.log('resize')
		holderDimensions = @_getHolderDimensions()

		_.each(@layers, (layer) ->
			layer.resize(holderDimensions)
		)

		@holder.attr(holderDimensions)
		@interactionLayer.attr(holderDimensions)


	windowToCanvasPos: (windowPos) ->
		canvasOffset = @selectedLayer.canvas.offset()
		return {
			x: windowPos.x - canvasOffset.left
			y: windowPos.y - canvasOffset.top
		}

	createAvatar: (user, position) ->

		avatar = $("<div class='avatar' id='user-#{user.id}'/>")

		if position?
			avatar.css(position)

		avatar.appendTo(@holder)

		# avatarSVG = $(document.createElementNS('http://www.w3.org/2000/svg', 'circle')).appendTo(avatar)
		# avatarSVG.attr(
		# 	cx: 8
		# 	cy: 8
		# 	r: 6
		# 	stroke: "rgba(#{user.color}, 1.0)"
		# 	fill: "rgba(#{user.color}, 1.0)"
		# )
		avatarCanvas = $('<canvas/>').attr(width: 16, height: 16).appendTo(avatar).get(0)
		ctx = avatarCanvas.getContext('2d')

		ctx.lineWidth = 0.5
		ctx.fillStyle = "rgba(#{user.color}, 0.2)"
		ctx.strokeStyle = "rgba(#{user.color}, 1)"
		ctx.beginPath()
		ctx.arc(8, 8, 6, 0, Math.PI * 2, true)
		ctx.closePath()
		ctx.fill()
		ctx.stroke()

		nick = $("<div class='nick'>#{user.nick}</div>").appendTo(avatar)
		nick.css('color', "rgba(#{user.color}, 1.0)")

		return $(avatar)

	redrawAvatar: (localUser) ->
		oldAvatar = localUser.avatar
		oldPos = oldAvatar.position()
		@holder.find("#user-#{localUser.id}").remove()
		newAvater = @createAvatar(localUser, oldPos)
		localUser.avatar = newAvater

	moveLocalUser: (localUser, layerID, position, drawing) ->
		if drawing
			offset = localUser.avatar.position()

			old =
				x: offset.left + 8
				y: offset.top + 8

			layer = @layers[layerID]
			unless layer?
				console.error("Couldn't find layer with id #{layerID}")
				return

			layer.ctx.lineWidth = 3
			layer.ctx.strokeStyle = "rgba(#{localUser.color}, 0.8)"
			layer.ctx.beginPath()
			layer.ctx.moveTo(old.x, old.y)
			layer.ctx.lineTo(position.x, position.y)
			layer.ctx.closePath()
			layer.ctx.stroke()

		localUser.avatar.css(
			left: "#{position.x - 8}px"
			top:  "#{position.y - 8}px"
		)
