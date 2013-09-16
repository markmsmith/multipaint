Canvas = require('canvas')

class ServerLayer
	constructor: (@id, @dimensions, @ownerID=null, @primary=false, @writeProtect=false) ->
		@canvas = new Canvas(@dimensions.width, @dimensions.height)
		@ctx = @canvas.getContext('2d')

		@avatarPositions = {}

	toJSON: ->
		return {
			@id
			@dimensions
			@ownerID
			@primary
			@writeProtect
			imageData: @canvas.toDataURL()
		}

	move: (touchID, canvasPos) ->
		@avatarPositions[touchID] = canvasPos

	draw: (touchID, canvasPos, color) ->
		old = @avatarPositions[touchID] ?
			x: 0
			y: 0

		@ctx.lineWidth = 3
		@ctx.strokeStyle = "rgba(#{color}, 0.8)"
		@ctx.beginPath()
		@ctx.moveTo(old.x, old.y)
		@ctx.lineTo(canvasPos.x, canvasPos.y)
		@ctx.closePath()
		@ctx.stroke()

		@avatarPositions[touchID] = canvasPos



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

module.exports = ServerLayer