
client = new MultiPaint.Client(holderName, initialPaintSessionID)
$('#sessionInvite').on('click', (e) ->
	e.stopPropagation()
	inviteUrl = client.getPaintSessionInvite()
	$('#shareLink').attr('href', inviteUrl).text(inviteUrl)

	qrOptions =
		width: 128
		height: 128
		text: inviteUrl
	$('#shareQR').qrcode(qrOptions)

	$('#myModal').modal()
	return false
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

client.on('colorChange', (newColor) ->
	colorPicker.minicolors('value', rgbToHex(newColor))
)

SB.disableBanners = true

# not required since we don't need SB.onPoint()
SB.wantsSDKEvents = false

SB.wantsTouches = true

# required for smartboard-1.1.0+
SB.initializeSMARTBoard()

SB.useMouseEvents(false)

SB.onToolChange = (evt) ->
	if evt.tool?
		switch evt.tool
			when 'polyline', 'pen'
				newColor = evt.color
				if newColor?
					newColor = newColor.join(',')
					currentColor = client.getUserColor()
					if newColor != currentColor
						client.setUserColor(newColor)

# SB.wantsSDKEvents = true
# SB.onPoint = (x, y, packet) ->
# 			if packet?
			#showTouch(packet);