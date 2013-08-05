uid = require('uid2')
Canvas = require('canvas')
ServerLayer = require('./ServerLayer')

class PaintSession
	constructor: (@owner, ownerDimensions) ->
		@id = uid(24)
		console.log("New paint session, id #{@id}")

		@editors = {}
		@editorCount = 0

		@layers = {}
		@layerCount = 0

		@addUser(@owner, ownerDimensions)

	addLayer: (dimensions, ownerID=null, primary=false, writeProtect=false) ->
		layerID = @layerCount++
		return @layers[layerID] = new ServerLayer(layerID, dimensions, ownerID, primary, writeProtect)

	# returns the primary layer for this user
	addUser: (user, dimensions) ->

		#TODO figure out (re)sizing of server-side canvas from client size

		#TODO user-reconnect logic

		# This is the user's primary layer that lasts as long as they're in the session
		primaryLayer = @addLayer(dimensions, user.id, true)
		#TODO add concept of editorID, where one user can have multiple editors if using multiple browser/devices
		@editors[user.id] = {
			user
			primaryLayer
			color: '#000' #TODO
		}
		@editorCount++

		return primaryLayer.id

	getClientLayers: ->
		return (layer for own id, layer of @layers)

	getClientEditors: ->
		return (editor for own id, editor of @editors)

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
