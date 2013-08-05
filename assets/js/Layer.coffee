window.MultiPaint ?= {}

class MultiPaint.Layer
	constructor: (@holder, {@id, @dimensions, @ownerID, @primary, @writeProtect, @imageData}) ->

		#TODO record the largest value we've drawn in each dimension for smart resizing
		@largest =
			x: 0
			y: 0

		@canvas = $('<canvas class="sketchArea"/>').attr(@dimensions).appendTo(@holder)
		@ctx = @canvas.get(0).getContext('2d')
		@canvasEl = @ctx.canvas

		if @imageData
			image = @_imageFromDataUrl(@imageData)
			@ctx.drawImage(image, 0, 0)

	_imageFromDataUrl: (dataUrl) ->
		image = new Image()
		image.src = dataUrl
		return image

	resize: (newDimensions) ->
		# changing the canvas dimensions clears it in some browser, so redraw the data
		currentData = @canvasEl.toDataURL()
		image = @_imageFromDataUrl(currentData)

		@canvas.attr(newDimensions)

		@ctx.clearRect(0, 0, @canvasEl.width, @canvasEl.height)
		@ctx.drawImage(image, 0, 0)
