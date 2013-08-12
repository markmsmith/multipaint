
client = new MultiPaint.Client(holderName, initialPaintSessionID)
$('#sessionInvite').on('click', ->
	inviteUrl = client.getPaintSessionInvite()
	msg = "Share this link with others to have them paint with you:\n\n#{inviteUrl}"
	alert(msg)
)

$('#userNick').keyup( (event) ->
	#listen for enter key
	unless event.keyCode == 13
		return

	newNick = this.value
	newNick = newNick.trim()
	if newNick
		client.setUserNick(newNick)
)

SB.disableBanners = true

# not required since we don't need SB.onPoint()
SB.wantsSDKEvents = false

# don't need touch event, since we can just use normal mouse events
#TODO check if needed multi-touch
SB.wantsTouches = false

SB.onToolChange = (evt) ->
	if evt.tool?
		switch evt.tool
			when 'polyline', 'pen'
				client.setUserColor( evt.color.join(',') )