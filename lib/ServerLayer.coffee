Canvas = require('canvas')

class ServerLayer
	constructor: (@id, @dimensions, @ownerID=null, @primary=false, @writeProtect=false) ->
		@canvas = new Canvas(@dimensions.width, @dimensions.height)
		@ctx = @canvas.getContext('2d')

	toJSON: ->
		return {
			@id
			@dimensions
			@ownerID
			@primary
			@writeProtect
			imageData: @canvas.toDataURL()
		}

module.exports = ServerLayer