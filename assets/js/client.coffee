window.MultiPaint ?= {}

class MultiPaint.Client

	# holderID is the id of the element to hold the canvas
	# standalone is whether we connect to a server to broadcast events etc
	# https is whether the server is https or not
	constructor: (holderID, standalone, https) ->
		@holderID = holderID
		@holder = $("##{holderID}")
		@standalone = standalone
		@https = https

		@users = {}
		@userCount = 0

		# unless @standalone
		protocol = document.location.protocol
		host = document.location.hostname
		@socket = io.connect()
		@socket.on('error', (e) ->
			console.log('An error occurred connecting socket.io: ', e ? 'A unknown error occurred')
		)

		@socket.on('disconnect', (e) ->
			console.log('Got a disconnect')
		)


		@viewport = $(window)
		holderDimensions = @_getHolderDimensions()
		@canvas = $('<canvas id="sketchArea"/>').attr( holderDimensions ).appendTo(@holder)
		@holder.attr(holderDimensions)
		@holder.css('height', holderDimensions.height)
		@ctx = @canvas.get(0).getContext('2d')
		@canvasEl = @ctx.canvas

		@viewport.resize =>
			@resizeCanvas()

		# only listen to the canvas for mouse move, so don't expand holder with avatar
		@canvas.mousemove _.throttle((event) =>
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
				@socket.json.emit 'move', canvasPos, false

		@holder.on 'touchstart': (event) =>
			# since touches can jump without moving to new location, need to update position first
			touch = event.originalEvent.touches[0];
			position =
				x: touch.pageX
				y: touch.pageY
			@handleMove(position)

			@drawing = true

		@holder.on 'touchend': (event) =>
			@drawing = false

		@holder.on 'touchmove': _.throttle((event) =>
			event.preventDefault();
			touch = event.originalEvent.touches[0];
			position =
				x: touch.pageX
				y: touch.pageY
			@handleMove(position)
		, 25)


		@socket.on('users', (users)->
			console.log("users: ", users)
			@users = users
			@user = users[-1]
		)

		dummyUser =
			id: 1
			nick: 'user1'
			color: '255,0,0'
		@addUser(dummyUser)

	setUserColor: (newColor) ->
		@user.color = newColor
		# @user.avatar.find('.nick').css('color', "rgba(#{newColor}, 1.0)")
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
		# changing the canvas dimensions clears it in some browser, so redraw the data
		currentData = @canvasEl.toDataURL()
		currentImage = new Image()
		currentImage.src = currentData

		holderDimensions = @_getHolderDimensions()
		@canvas.attr(holderDimensions)
		@holder.attr(holderDimensions)

		@ctx.clearRect(0, 0, @canvasEl.width, @canvasEl.height)
		@ctx.drawImage(currentImage, 0, 0)

	addUser: (user) ->
		newUser =
			id:     user.id
			nick: user.nick
			color:  user.color
			avatar: @createAvatar(user)
		@users[user.id] = newUser
		@userCount++

		if @standalone or user.id == @socket.id
			@user = newUser

		# @updateStatus()


	windowToCanvasPos: (windowPos) ->
		canvasOffset = @canvas.offset()
		return {
			x: windowPos.x - canvasOffset.left
			y: windowPos.y - canvasOffset.top
		}

	createAvatar: (user, position) ->

		avatar = $("<div class='avatar' id='user-#{user.id}'/>")

		if position?
			avatar.css(position)

		avatar.appendTo(@holder)

		# avatarSVG = $(document.createElementNS('http://www.w3.org/2000/svg', 'circle')).appendTo(avatar);
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

	redrawAvatar: () ->
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

			@ctx.lineWidth = 3
			@ctx.strokeStyle = "rgba(#{user.color}, 0.8)"
			@ctx.beginPath()
			@ctx.moveTo(old.x, old.y)
			@ctx.lineTo(position.x, position.y)
			@ctx.closePath()
			@ctx.stroke()

		user.avatar.css(
			left: "#{position.x - 8}px"
			top:  "#{position.y - 8}px"
		)
