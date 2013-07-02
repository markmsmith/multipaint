window.MultiPaint ?= {}

class MultiPaint.Layer
	constructor: (@holderId, @id, @owner=null, @writeProtect=false) ->
		# record the largest value we've drawn in each dimension for smart resizing
		@largest =
			x: 0
			y: 0


