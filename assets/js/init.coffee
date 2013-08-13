
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

colorPicker = $('#colorPicker')
hideSwatch = _.debounce( ->
	colorPicker.minicolors('hide')
, 1200)

minColorsConfig =
	changeDelay: 500
	change: (hex, opacity) ->
		{r,g,b} = colorPicker.minicolors('rgbObject')
		client.setUserColor("#{r},#{g},#{b}")
		hideSwatch()

colorPicker.minicolors(minColorsConfig)

rgbToHex = (rgbStr) ->
	[r, g, b] = rgbStr.split(',')
	hex = [
		parseInt(r, 10).toString(16)
		parseInt(g, 10).toString(16)
		parseInt(b, 10).toString(16)
	]
	for val, index in hex
	  if val.length == 1
	    hex[index] = '0' + val
	return '#' + hex.join('')

client.on('colorChange', (newColor)->
	colorPicker.minicolors('value', rgbToHex(newColor))
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