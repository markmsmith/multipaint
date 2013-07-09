Canvas = require('canvas')

class ServerLayer
	constructor: (@id, @dimensions, @owner=null, @writeProtect=false) ->
		@canvas = new Canvas(@dimensions.width, @dimensions.height)
		@ctx = @canvas.getContext('2d')

module.exports = ServerLayer