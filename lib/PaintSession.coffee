uid = require('uid2')
Canvas = require('canvas')


class PaintSession
	constructor: () ->
		@id = uid(24);
		console.log("New paint session, id #{@id}")

		@layers = {}

	addUser: (user) ->
		@layers[user.id] = canvas = new Canvas(200,200)

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