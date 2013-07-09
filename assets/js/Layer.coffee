window.MultiPaint ?= {}

class MultiPaint.Layer
	constructor: (@holder, @dimensions, @id, @owner=null, @writeProtect=false) ->
		# record the largest value we've drawn in each dimension for smart resizing
		@largest =
			x: 0
			y: 0

		@canvas = $('<canvas class="sketchArea"/>').attr(dimensions).appendTo(@holder)

		@ctx = @canvas.get(0).getContext('2d')
		@canvasEl = @ctx.canvas

	resize: (newDimensions) ->
		# changing the canvas dimensions clears it in some browser, so redraw the data
		currentData = @canvasEl.toDataURL()
		currentImage = new Image()
		currentImage.src = currentData

		@canvas.attr(newDimensions)

		@ctx.clearRect(0, 0, @canvasEl.width, @canvasEl.height)
		@ctx.drawImage(currentImage, 0, 0)
