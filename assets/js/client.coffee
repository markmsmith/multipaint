window.MultiPaint ?= {}

class MultiPaint.Client

	# holderID is the id of the element to hold the canvas
	# standalone is whether we connect to a server to broadcast events etc
	constructor: (@holderID, standalone) ->
		@holder = $("##{holderID}")
		@standalone = standalone

		@users = {}
		@userCount = 0

		@layers = {}

		@socket = io.connect()
		@socket.on('error', (e) ->
			console.log('An error occurred connecting to socket: ', e ? 'A unknown error occurred')
		)

		@socket.on('disconnect', (e) ->
			console.log('Got a disconnect')
		)


		@viewport = $(window)
		holderDimensions = @_getHolderDimensions()
		@holder.attr(holderDimensions)
		@holder.css('height', holderDimensions.height)

		layerID = '1234'
		owner = 'ABC'
		@selectedLayer = new MultiPaint.Layer(@holder, holderDimensions, layerID, owner)
		@layers[layerID] = @selectedLayer

		@viewport.resize =>
			@resizeCanvas()

		# only listen to the canvas for mouse move, so don't expand holder with avatar
		#TODO enforce a 'user canvas' for mouse listening
		@selectedLayer.canvas.mousemove _.throttle((event) =>
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

		@holder.mouseenter (event) =>
			# if exit and renter, update position so don't draw line from exit point
			position =
				x: event.pageX
				y: event.pageY
			canvasPos = @windowToCanvasPos(position)
			if @standalone

				@moveUser(@user, canvasPos, false)
			else
				@socket.json.emit('move', canvasPos, false)

		@holder.on 'touchstart': (event) =>
			# since touches can jump without moving to new location, need to update position first
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


		@socket.on('users', (userInfo) ->
			console.log("users: ", userInfo)
			@users = userInfo.users
			@user = userInfo.users[userInfo.userID]
		)

		dummyUser =
			id: 1
			nick: 'user1'
			color: '255,0,0'
		@addUser(dummyUser)

	setUserColor: (newColor) ->
		@user.color = newColor
		@redrawAvatar()

	handleMove: (position, drawing=@drawing) ->
		canvasPos = @windowToCanvasPos(position)
		if @standalone
			@moveUser(@user, canvasPos, drawing)
		else
			@socket.json.emit 'move', canvasPos, drawing

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

	addUser: (user) ->
		newUser =
			id: user.id
			nick: user.nick
			color: user.color
			avatar: @createAvatar(user)
		@users[user.id] = newUser
		@userCount++

		if @standalone or user.id == @socket.id
			@user = newUser

		# @updateStatus()


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

	redrawAvatar: ->
		oldAvatar = @user.avatar
		oldPos = oldAvatar.position()
		@holder.find("#user-#{@user.id}").remove()
		newAvater = @createAvatar(@user, oldPos)
		@user.avatar = newAvater

	moveUser: (user, position, drawing) ->

		if drawing
			offset = user.avatar.position()

			old =
				x: offset.left + 8
				y: offset.top + 8

			@selectedLayer.ctx.lineWidth = 3
			@selectedLayer.ctx.strokeStyle = "rgba(#{user.color}, 0.8)"
			@selectedLayer.ctx.beginPath()
			@selectedLayer.ctx.moveTo(old.x, old.y)
			@selectedLayer.ctx.lineTo(position.x, position.y)
			@selectedLayer.ctx.closePath()
			@selectedLayer.ctx.stroke()

		user.avatar.css(
			left: "#{position.x - 8}px"
			top:  "#{position.y - 8}px"
		)
