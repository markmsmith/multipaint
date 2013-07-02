class SocketSession
	constructor: (io, cookieParser, sessionCookieKey, sessionStore) ->
		io.set('authorization', (data, callback) ->

			unless data.headers?.cookie
				console.log('No cookie')
				return callback(null, false)

			cookieParser(data, {}, (err) ->
				data.sessionID = data.signedCookies[sessionCookieKey]

				sessionStore.get(data.sessionID, (err, session) ->
					if err
						console.log('Error in session store')
						return callback("Error in session store: #{err}", false)
					else if !session
						console.log('Session #{sessionID} not found')
						return callback(null, false)

					console.log("Found session #{data.sessionID}: ", session)
					data.session = session;

					return callback(null, true)
				)
			)
		)

module.exports = SocketSession