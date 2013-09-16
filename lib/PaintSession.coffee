uid = require('uid2')
Canvas = require('canvas')
ServerLayer = require('./ServerLayer')

class PaintSession
	constructor: (@owner, ownerDimensions) ->
		@id = uid(24)
		console.log("New paint session with ID #{@id}")

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

		return primaryLayer

	getClientLayers: ->
		return (layer for own id, layer of @layers)

	getClientEditors: ->
		return (editor for own id, editor of @editors)

	getLayer: (layerID) ->
		@layers[layerID]

	move: (layerID, touchID, canvasPos) ->
		layer = @getLayer(layerID)
		unless layer
			console.log("Invalid layer with id #{layerID} requested in paint session #{@id}")
			return
		layer.move(touchID, canvasPos)

	draw: (layerID, touchID, canvasPos, color) ->
		layer = @getLayer(layerID)
		unless layer
			console.log("Invalid layer with id #{layerID} requested in paint session #{@id}")
			return

		layer.draw(touchID, canvasPos, color)

module.exports = PaintSession
