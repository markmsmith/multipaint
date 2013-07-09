uid = require('uid2')
Canvas = require('canvas')
ServerLayer = require('./ServerLayer')

class PaintSession
	constructor: (@owner) ->
		@id = uid(24)
		console.log("New paint session, id #{@id}")

		@editors = {}
		@editorCount = 0

		@layers = {}
		@layerCount = 0

		@addUser(@owner)

	addLayer: (dimensions, owner=null, writeProtect=false) ->
		layerID = @layerCount++
		return @layers[layerID] = new ServerLayer(layerID, dimensions, owner, writeProtect)

	addUser: (user) ->

		#TODO figure out (re)sizing of server-side canvas from client size
		dimensions =
			width: 200
			height: 200

		#TODO user-reconnect logic

		# This is the user's personal layer that lasts as long as they're in the session
		userLayer = @addLayer(dimensions, user)
		@editors[user.id] = {
			user
			userLayer
		}
		@editorCount++


		# ctx = canvas.getContext('2d')
		# ctx.font = '30px Impact'
		# ctx.rotate(.1)
		# ctx.fillText("Awesome!", 50, 100)

		# te = ctx.measureText('Awesome!')
		# ctx.strokeStyle = 'rgba(0,0,0,0.5)'
		# ctx.beginPath()
		# ctx.lineTo(50, 102)
		# ctx.lineTo(50 + te.width, 102)
		# ctx.stroke()

		# console.log('<img src="' + canvas.toDataURL() + '" />')

module.exports = PaintSession