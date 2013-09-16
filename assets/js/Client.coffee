window.MultiPaint ?= {}

class MultiPaint.Client

	MOUSE_TOUCH_ID: -1,

	handleHistoryPopState: (event) ->

		###
		for now just reload the page, later we can tell the client to clean up
		and switch paint sessions
		###
		console.log("historyPopState: event: ", event)
		storedPaintSessionID = event.state?.paintSessionID
		if storedPaintSessionID?
			console.log("historyPopState: Loading paint session ${storedPaintSessionID}")
			window.location = "?paintSession=#{@storedPaintSessionID}&fromPopState=true"
		else
			console.log("historyPopState: No storedPaintSessionID, reloading page.")
			window.location.reload()

	# holderID is the id of the element to hold the canvas
	# paintSession is the GUUID of an existing session to join, or empty
	constructor: (@holderID, @paintSessionID) ->
		# add support for emitting events
		new EventEmitter().apply(this)

		@touchesInProgress = {}

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

		@socket.on 'connecting', ->
			console.log('Connecting...')

		@socket.on 'connect_failed', ->
			console.log("Failed to connect")

		@socket.on 'disconnect', ->
			console.log('Disconnected')

		@socket.on 'reconnecting', (nextRetry) ->
			console.log("Reconnecting in #{nextRetry} seconds...")

		@socket.on 'reconnect', ->
			console.log("Reconnected")

		@socket.on 'error', (e) ->
			console.log('An error occurred connecting to socket: ', e ? 'A unknown error occurred')

		@socket.on 'connect', =>
			console.log('Connected')
			connectMessage =
				clientDimensions: holderDimensions

			# check without ? to handle empty string as falsey as well
			if @paintSessionID
				console.log("Attempting to join existing paint session with ID #{@paintSessionID}.")
				connectMessage.paintSessionID = @paintSessionID
				@socket.json.emit('joinPaintSession', connectMessage, @onJoinPaintSession)
			else
				console.log("Creating a new paint session to join.")
				@socket.json.emit('createPaintSession', connectMessage, @onJoinPaintSession)

	onJoinPaintSession: ({
		@paintSessionID
		layers
		primaryLayerID
		editors
		clientID
	}) =>

		console.log("Joined paint session #{@paintSessionID}")

		stateObj = {
			@paintSessionID
		}

		console.log("historyPopState: replacing state: ", stateObj)
		history.replaceState(stateObj, 'MultiPaint', "?paintSession=#{@paintSessionID}")
		window.onpopstate = @handleHistoryPopState

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
				this.emit('colorChange', @clientUser.color)
		)


		@viewport.resize =>
			@resizeCanvas()

		@socket.on('remoteMove', @handleRemoteMove)
		@socket.on('userJoined', @handleUserJoined)
		@socket.on('userLeft', @handleUserLeft)
		@socket.on('userNickChange', @handeRemoteUserNickChange)
		@socket.on('userColorChange', @handeRemoteUserColorChange)

		# need to listen to holder (rather than canvas), since avatar canvas is in the way and
		# is a sibling of the drawing canvas
		@holder.mousedown (event) =>
			@touchesInProgress[@MOUSE_TOUCH_ID] = true
			@setStatus("mouseDown")

		onMouseMove = (event) =>
			drawing = @touchesInProgress[@MOUSE_TOUCH_ID] ? false

			position =
				x: event.pageX
				y: event.pageY
			@setStatus("mouseMove :\n#{JSON.stringify(position)}")
			@handleMove(@MOUSE_TOUCH_ID, position, drawing)

		# only listen to the interaction layer for mouse move, so don't expand holder with avatar
		# @interactionLayer.mousemove(onMouseMove)
		@interactionLayer.mousemove _.throttle(onMouseMove, 20)

		# listen to the document (rather than holder) for mouse up so that if they drag out
		# of the canvas before releasing, it still stops drawing
		$(document).mouseup (event) =>
			delete @touchesInProgress[@MOUSE_TOUCH_ID]
			position =
				x: event.pageX
				y: event.pageY
			@setStatus("mouseUp :\n#{JSON.stringify(position)}")
			@handleMove(@MOUSE_TOUCH_ID, position, false)

		# if exit and renter, update position so don't draw line from exit point
		@holder.mouseenter (event) =>
			position =
				x: event.pageX
				y: event.pageY
			@handleMove(@MOUSE_TOUCH_ID, position, false)


		# check if this needs to be interaction layer to prevent same avatar-expanding problem
		@holder.on 'touchstart', (event) =>
			touches = event.originalEvent.changedTouches
			@setStatus("touchStart touches:\n#{touches}")
			for touch in touches

				# since touches can jump without first moving to the new location,
				# need to update position first or we'll draw from the last touch location
				position =
					x: touch.pageX
					y: touch.pageY

				@handleMove(touch.identifier, position, false)

		onTouchMove = (event) =>
			event.preventDefault()
			touches = event.originalEvent.changedTouches
			@setStatus("touchMove touches:\n#{touches}")
			for touch in touches
				# touches by definition are always drawing
				drawing = true

				position =
					x: touch.pageX
					y: touch.pageY
				@handleMove(touch.identifier, position, drawing)

		throttledOnTouchMove = _.throttle(onTouchMove, 25)

		@holder.on('touchmove', throttledOnTouchMove)

		@holder.on 'touchend', (event) =>
			touches = event.originalEvent.changedTouches
			@setStatus("touchEnd touches:\n#{touches}")
			for touch in touches
				position =
					x: touch.pageX
					y: touch.pageY
				@handleMove(touch.identifier, position, false)

		# we're ready to draw!
		@ready = true

		# @socket`'users', (userInfo) ->
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

	addLocalLayer: (serverLayer) ->
		@layers[serverLayer.id] = new MultiPaint.Layer(@interactionLayer, serverLayer)

	addLocalUser: (serverUser) ->
		localUser =
			id: serverUser.id
			nick: serverUser.nick
			color: serverUser.color
			avatar: @createAvatar(serverUser)
			secondaryAvatars: {}
		@users[serverUser.id] = localUser
		@userCount++

		return localUser

	removeLocalUser: (userID) ->
		localUser = @users[userID]
		localUser?.avatar.remove()
		delete @users[userID]
		@userCount--

	handleRemoteUserAttrChange: (userID, attrName, newValue) =>
		localUser = @users[userID]
		unless localUser?
			console.error("Couldn't find user with userID #{userID} for #{attrName} change.")
			return

		currentVal = localUser[attrName]
		if newValue != currentVal
			localUser[attrName] = newValue
			@redrawAvatars(localUser)

			# notify client listeners if it was the current user
			if localUser.id == @clientUser.id
				this.emit("#{attrName}Change", newValue)

	setUserNick: (newNick) =>
		@socket.emit('setUserNick', newNick)

	handeRemoteUserNickChange: ({userID, nick}) =>
		@handleRemoteUserAttrChange(userID, 'nick', nick)

	getUserColor: =>
		return @clientUser.color

	setUserColor: (newColor) =>
		if @standalone
			@clientUser.color = newColor
			@redrawAvatars(@clientUser)
		else if @clientUser.color != newColor
			if @ready
				@socket.emit('setUserColor', newColor)
			else
				#TODO pick up after init
				@bufferedColor = newColor

	handeRemoteUserColorChange: ({userID, color}) =>
		@handleRemoteUserAttrChange(userID, 'color', color)

	handleMove: (touchID, position, drawing=false) =>
		canvasPos = @windowToCanvasPos(position)
		moveData = {
			layerID: @selectedLayer.id
			touchID
			canvasPos
			drawing
		}
		@socket.json.emit('move', moveData)

	handleRemoteMove: ({userID, layerID, touchID, canvasPos, drawing}) =>
		localUser = @users[userID]
		unless localUser?
			console.error('Received move from unknown user: ', userID)
			return

		@moveLocalUser(localUser, layerID, touchID, canvasPos, drawing)

	handleUserJoined: ({user, layer}) =>
		if user.id == @clientUser.id
			# ignore notifications about self
			return

		@addLocalLayer(layer)
		@addLocalUser(user)

	handleUserLeft: (userID) =>
		@removeLocalUser(userID)
		#TODO other cleanup

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

	createAvatar: (user, position=null, secondaryTouchID=null) ->
		avatarID = "user-#{user.id}"
		avatarNick = user.nick
		if secondaryTouchID?
			avatarID += "_#{secondaryTouchID}"
			avatarNick += "_#{secondaryTouchID}"

		avatar = $("<div class='avatar' id='#{avatarID}'/>")

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

		nick = $("<div class='nick'>#{avatarNick}</div>")
		nick.css('color', "rgba(#{user.color}, 1.0)")
		nick.appendTo(avatar)

		return $(avatar)

	redrawAvatars: (localUser) ->
		oldAvatar = localUser.avatar
		oldPos = oldAvatar.position()
		@holder.find("#user-#{localUser.id}").remove()
		newAvater = @createAvatar(localUser, oldPos)
		localUser.avatar = newAvater
		#TODO redraw secondary avatars

	moveLocalUser: (localUser, layerID, touchID, position, drawing) ->
		if touchID == @MOUSE_TOUCH_ID
			avatar = localUser.avatar
		else
			# dealing with a secondary touch
			avatar = localUser.secondaryAvatars[touchID]
			unless drawing
				# bail out if we're not drawing, killing the avater if necessary
				if avatar?
					console.log("removing secondary avatar")
					avatar.remove()
					delete localUser.secondaryAvatars[touchID]
				return

			# must be drawing, so make sure we have an avatar
			unless avatar?
				console.log("creating new secondary avatar")
				cssPos =
					left: position.x - 8
					top: position.y - 8
				avatar = @createAvatar(localUser, cssPos, touchID)
				localUser.secondaryAvatars[touchID] = avatar
			else
				console.log('existing avatar')

		if drawing
			offset = avatar.position()

			old =
				x: offset.left + 8
				y: offset.top + 8

			console.log("drawing from old position: ", old)

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

		avatar.css(
			left: "#{position.x - 8}px"
			top:  "#{position.y - 8}px"
		)

	setStatus: (message) ->
		console.log(message)
		statusArea = $('#statusArea')
		statusArea.val("#{message}\n#{statusArea.val()}")
