_ = require('lodash')

class User
	constructor: (@id, @nick, @color) ->
		@socketIDs = []

	addSocketID: (socketID) ->
		@socketIDs.push(socketID)

	removeSocketID: (socketID) ->
		@socketIDs = _.filter(@socketIDs, (val) -> return val != socketID)
		lastSocket = @socketIDs.length == 0
		return lastSocket

	toJSON: ->
		return {
			@id
			@nick
			@color
		}

module.exports = User