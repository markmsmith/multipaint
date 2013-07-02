/**
* SMART Board(R) WDK Javascript Library 1.0.0
* http://api.smarttech.com/wdk
*
* Copyright (c) 2012 - 2013, SMART Technologies
* All rights reserved.
* Intellectual property information for SMART Board(R) WDK Javascript
* Library is available at: http://api.smarttech.com/wdk/license
*
* THIS SOFTWARE IS PROVIDED BY SMART TECHNOLOGIES "AS IS" AND ALL
* EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
* IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
* PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL SMART TECHNOLOGIES BE
* LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
* CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
* SUBSTITUTE GOODS OR SERVICES, LOSS OF USE, LOSS OF DATA, PROFITS, OR
* BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
* LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
* NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
* SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/**
* Note for IE9:
*   - You must use standards mode in IE (<!DOCTYPE html>).
*   - IE9 will not fill out pageX and pageY values in simulated events
*     Use:
*       pageX = e.originalEvent.targetTouches[0].clientX + $(window).scrollLeft();
*       pageY = e.originalEvent.targetTouches[0].clientY + $(window).scrollTop();
*/

;(function() {

var debugOn = false;

//var yourLocationOfSmartboardJS = "http://api.smarttech.com/lib/"
var yourLocationOfSmartboardJS = "http://localhost/~msmith/SmartBoard/3rdParty/"

_SB_load_dependencies(window, yourLocationOfSmartboardJS, debugOn);
var $ = window.jQuery.noConflict(true);

(function($) {
    var debug = window._SB_debug;
    var isDefined = window._SB_isDefined;

    var SBScreen = {};
    window.SBScreen = SBScreen;

    var oldX = window.screenX;
    var oldY = window.screenY;
    var titleBarHeight = 0;
    var sideBarOnLeft = 0;
    var calibrationOffsetY = 0;
    var calibrationOffsetX = 0;
    var resized = false;
    var SB_SCREEN_DEBUG_ON = false;

    var interval = setInterval(function(){
      if(oldX != window.screenX || oldY != window.screenY || resized){
            debug("Moved:");
            if(resized) {
                debug("Resized:");
                resized = false;
            }
            updateScreen();
      }

      oldX = window.screenX;
      oldY = window.screenY;
    }, 500);

    window.onresize = function(event) {
        resized = true;
    };

    var _screen = {};

    function windowDebug() {
        var s = _screen;
        debug("(" + s.width + ", " + s.height + ")@[" + s.x + ', ' + s.y + "]");
    }

    function updateScreen() {
        _screen.x = window.screenX;
        _screen.y = window.screenY;
        _screen.width = window.outerWidth;
        _screen.height = window.outerHeight;

        _screen.clientWidth = window.innerWidth;
        _screen.clientHeight = window.innerHeight;
        _screen.clientX = _screen.x + sideBarOnLeft;
        _screen.clientY = _screen.y + titleBarHeight;

        var scrollBarSize = 16;
        if(document.body.scrollHeight > _screen.clientHeight) {
            _screen.clientWidth -= scrollBarSize;
        }

        if(document.body.scrollWidth > _screen.clientWidth) {
            _screen.clientHeight -= scrollBarSize;
        }

        if(SBScreen.onWindowMoved) {
            SBScreen.onWindowMoved();
        }

        if(SB_SCREEN_DEBUG_ON) {
            windowDebug();
        }
    }

    function onCalibrate(event) {
        debug(event);
        titleBarHeight = event.screenY - event.pageY - window.screenY + window.pageYOffset;
        sideBarOnLeft = event.screenX - event.pageX - window.screenX + window.pageXOffset;

        calibrationOffsetX = sideBarOnLeft - _screen.x;
        calibrationOffsetY = titleBarHeight - _screen.y;

        updateScreen();

        debug("The toolbars are: " + titleBarHeight + "px high");
        debug("Sidebar on left is: " + sideBarOnLeft + "px wide");
        windowDebug();
    }

    function convertX(x)
    {
        return parseInt(x);
    }

    function convertY(y)
    {
        return parseInt(y);
    }

    function clientToScreenX(x) {
        return _screen.x + x;
    }

    function clientToScreenY(y) {
        return _screen.y + titleBarHeight + y;
    }

    function fakeSDK(event) {
        var sx = event.screenX;
        var sy = event.screenY;
        debug("Screen:     " + sx + ", " + sy);
        debug("Page:       " + event.pageX + ", " + event.pageY);
        debug("Calibrated: " + convertX(sx) + ", " + convertY(sy));
    }

    SBScreen.getScreen = function() {
        return _screen;
    };

    SBScreen.calibrate = onCalibrate;
    SBScreen.onWindowMoved = null;
    SBScreen.convertX = convertX;
    SBScreen.convertY = convertY;
    SBScreen.clientToScreenX = clientToScreenX;
    SBScreen.clientToScreenY = clientToScreenY;

    $(window).ready(function() {
        windowDebug();
    });
})($);

var __touchIdentifierForPid = {};
var __nextTouchIdentifer = 0;

(function($) {
    window.__SB_PORT = 54740;
    var serverURL = "http://127.0.0.1:" + window.__SB_PORT + "/";

    var debug = window._SB_debug;
    var isDefined = window._SB_isDefined;

    if(isDefined(window.SB)) {
        debug("SB already loaded.  Double include?");
        return;
    }

    /**
     * @namespace
     * @name SB
     * @description
     * The SMART Board Web Development Kit (SBWDK) exposes SMART Board functionality through the window.SB object.
     */
    var SB = {};

    window.SB = SB;
    window.SB.jQuery = $;

    var SB_HOST = "127.0.0.1";
    var SB_PORT = window.__SB_PORT;
    var SB_CALIBRATED = false;
    var SB_CONNECTED = false;
    var SB_NUMBER_OF_BOARDS = 0;
    var SB_HAS_CONNECTED_ONCE = false;
    var SB_WINDOW_HAS_FOCUS = true;
    var SB_ATTEMPTING_TO_CONNECT = false;

    var _dialogs = {};
    _dialogs.webSocketsError = function() {
        $.notification( {
                title: "Sorry, your browser does not support SMART Board enabled web applications",
                content: "We require IE 9+, Safari, Chrome, Firefox",
                error: true,
                timeout: 10000,
                border: false
        });
    };
    _dialogs.stillConnecting = function() {
        $.notification( {
                title: "Attempting to attach to a SMART Board ...",
                content: "We are still trying to detect and connect to a SMART Board.",
                timeout: 5000,
                border: true
        });
    };
    _dialogs.unableToConnect = function() {
        $.notification( {
                title: "Whoops, we couldn't connect to a SMART Board",
                content: "Either we are missing the latest drivers, or there is no SMART Board attached.  Unfortunately you won't be able to take advantage of additional features.  <br/><br/>Get a <a href='http://smarttech.com'>SMART Board</a> now",
                error: true,
                timeout: 15000,
                border: false
        });
    };
    _dialogs.connectionSuccess = function() {
        $.notification( {
                title: "SMART Board Connected",
                content: "Houston we have take off!  You can now take advantage of your SMART Board in this web-application.",
                okay: true,
                timeout: 3000,
                border: false
        });
    };

    var _portsToTry = [54740, 54745, 54750, 54755, 54760];
    var _portsToTryIndex = -1;
    var _numberOfPortsTried = 0;

    var nextPort = function() {
        _portsToTryIndex = ++_portsToTryIndex % _portsToTry.length;
        return _portsToTry[_portsToTryIndex];
    };

    var _SB_connect = function() {
        if(!SB_WINDOW_HAS_FOCUS) return;

        var tryPort = function(p) {
            debug("Trying port..");
            if(SB_CONNECTED) return;
            if(SB_ATTEMPTING_TO_CONNECT) return;

            if(SB.statusChanged) { SB.statusChanged("Looking for service"); }

            SB_ATTEMPTING_TO_CONNECT = true;

            var port = window.__SB_PORT;

            if(!SB_HAS_CONNECTED_ONCE) {
                _numberOfPortsTried++;

                if(_numberOfPortsTried == 5) {
                    _dialogs.stillConnecting();
                }

                if(_numberOfPortsTried > 20) {
                    _dialogs.unableToConnect();
                    if(SB.statusChanged) { SB.statusChanged("Unable to find service"); }
                    return;
                }

                port = nextPort();
            }

            try {
                debug('Connecting to SBWDK on port ' + port);

                var socket;
                var host = 'ws://127.0.0.1:' + port + '/';

                if ( typeof WebSocket !== "undefined" ) {
                    if(isDefined(WebSocket.loadFlashPolicyFile)) {
                        WebSocket.loadFlashPolicyFile("xmlsocket://127.0.0.1:" + port);
                    }
                    socket = new WebSocket(host);
                } else if ( typeof MozWebSocket !== "undefined" ) {
                    socket = new MozWebSocket(host);
                } else {
                    console.log("Unable to connect, websockets not available");
                }

                socket.onopen = function(event) {
                    socket.close();
                    window.__SB_PORT = SB_PORT = port;
                    serverURL = "http://127.0.0.1:" + window.__SB_PORT + "/";
                    _SB_connectUsingPort();
                };

                socket.onclose = function(event) { SB_ATTEMPTING_TO_CONNECT = false; setTimeout(tryPort, 750); };
            } catch(e) {

            }
        };

        tryPort();
    };

    var boardSocket;

    /**
     * Control whether the SMART Board will send touches from the board as
     * mouse events or as SDK events.
     *
     * For example, if you have an existing web application that depends on
     * mouse events and you are not interested in multi-touch, you can set
     * this to true, in which case your application would behave as if the
     * user was using the mouse.
     * @param {boolean}
     */
    SB.useMouseEvents = function() { };

    var _SB_connectUsingPort = function() {
        if(SB.statusChanged) { SB.statusChanged("Connecting"); }
        if(SB_CONNECTED) return;
        SB_CALIBRATED = false;

        var setupTimersAndCallbacks = function() {
           var _SB_OnBlur = function() {
                debug("Window: blur");
                sendData("windowRect", { origin: [0, 0], size: [0, 0] });
                SB_CALIBRATED = false;
                SB_CONNECTED = false;
                boardSocket.close();
                SB_WINDOW_HAS_FOCUS = false;
            };

            var _SB_OnFocus = function() {
                debug("Window: focus");
                updateWindowRect();
                SB_WINDOW_HAS_FOCUS = true;
                _SB_connect();
            };

            (function() {
                var hidden, change, vis = {
                        hidden: "visibilitychange",
                        mozHidden: "mozvisibilitychange",
                        webkitHidden: "webkitvisibilitychange",
                        msHidden: "msvisibilitychange",
                        oHidden: "ovisibilitychange"
                    };
                for (hidden in vis) {
                    if (vis.hasOwnProperty(hidden) && hidden in document) {
                        change = vis[hidden];
                        break;
                    }
                }
                if (change)
                    document.addEventListener(change, onchange);
                else if (/*@cc_on!@*/false)
                    document.onfocusin = document.onfocusout = onchange;
                else
                    window.onfocus = window.onblur = onchange;

                window.onfocus = window.onblur = onchange;

                function onchange (evt) {
                    var body = document.body;
                    evt = evt || window.event;

                    if (evt.type == "focus" || evt.type == "focusin")
                        _SB_OnFocus();
                    else if (evt.type == "blur" || evt.type == "focusout")
                        _SB_OnBlur();
                    else
                        if(this[hidden]) {
                            _SB_OnBlur();
                        } else {
                            _SB_OnFocus();
                        }
                }
            })();

            setInterval(function() {
                if(!SB_CONNECTED) {
                    _SB_connect();
                }
            }, 10000);
        };

        try {
            var host = "ws://" + SB_HOST + ":" + SB_PORT + "/";
            if ( typeof WebSocket !== "undefined" ) {
                boardSocket = new WebSocket(host);
            } else if ( typeof MozWebSocket !== "undefined" ) {
                boardSocket = new MozWebSocket(host);
            } else {
                _dialogs.webSocketsError();
                debug("Unable to connect, websockets not available");
            }
        } catch(e) {
            _dialogs.webSocketsError();
            debug("Could not connect.");
            if(SB.statusChanged) { SB.statusChanged("Unable to connect"); }
        }

        boardSocket.onopen = function() {
            updateWindowRect();
            if(SB.statusChanged) { SB.statusChanged("Connected"); }
            SB_CONNECTED = true;

            if(!SB_HAS_CONNECTED_ONCE) {
                debug("Connected.");
                setupTimersAndCallbacks();
                $.ajax({ url: serverURL + "api/1.0.0/numberOfBoards",
                         dataType: 'json',
                         type: "GET",
                         success: function(data) {
                                    try {
                                        SB_NUMBER_OF_BOARDS = parseInt(JSON.parse(data), 10);
                                        if(SB_NUMBER_OF_BOARDS > 0) {
                                            _dialogs.connectionSuccess();
                                        } else {
                                            _dialogs.unableToConnect();
                                            if(SB.statusChanged) { SB.statusChanged("No boards attached"); }
                                        }
                                    } catch(e) {
                                        _dialogs.unableToConnect();
                                    }
                                },
                         error: function() {
                                    _dialogs.unableToConnect();
                                },
                         timeout: 500,
                         async: true
                });
             } else if(SB_NUMBER_OF_BOARDS > 0) {
                var packet = {};
                packet["type"] = "toolChange";
                $.ajax({ url: serverURL + "api/1.0.0/currentTool",
                         dataType: 'json',
                         success: function(result) {
                            packet["data"] = result;
                         },
                         timeout: 150,
                         async: false
                });
                _SB_dispatch(packet);
                debug("Reconnected.");
            }

            SB_HAS_CONNECTED_ONCE = true;
            SB_ATTEMPTING_TO_CONNECT = false;
        };

        boardSocket.onclose = function() {
            SB_CALIBRATED = false;
            SB_CONNECTED = false;
            debug("Disconnected.");
            if(SB.statusChanged) { SB.statusChanged("Disconnected"); }
        };

        boardSocket.onmessage = function(msg) {
            debug("Received: " + msg.data);
            processData(msg.data, sendData);
        };

        var sendData = function(type, data) {
            var packet = {};
            packet.type = type;
            packet.data = data;
            if(boardSocket.readyState == 1) {
                boardSocket.send(JSON.stringify(packet));
            }
        };

        SB.useMouseEvents = function(useMouse) {
            if(useMouse) {
                sendData("mouseMode", { mouseMode: true});
            } else {
                sendData("mouseMode", { mouseMode: false});
            }
        };

        updateWindowRect = function() {
            if(!SB_CALIBRATED) {
                var x = window.screenX;
                var y = window.screenY;
                var width = window.outerWidth;
                var height = window.outerHeight;

                sendData("windowRect", { origin: [x, y], size: [width, height] });
                SB.useMouseEvents(true);
                return;
            }

            var s = SBScreen.getScreen();
            sendData("windowRect", { origin: [s.clientX, s.clientY], size: [s.clientWidth, s.clientHeight] });
        };

        SBScreen.onWindowMoved = updateWindowRect;
    };

    var processData = function(data, sendData)  {
        try {
            var packet = JSON.parse(data);
            if(!packet.type) throw "No type defined";
            if(!packet.data) throw "No data defined";
            switch(packet.type) {
                case "toolChange":
                case "points":
				case "onProximityStateChange":
                    _SB_dispatch(packet);
                    break;
                case "status":
                    sendData("statusReply", {});
                    break;
            }
        } catch(e) {
            debug(packet);
            throw e;
        }
    };

    var _SB_notifyTool = function(evt) {
        if(isDefined(_SB_trackingFirstTouch) && _SB_trackingFirstTouch === true) {
            return;
        }

        var icon = "";
        var color = "#000000";
        var toolName = "A";

        switch(evt.tool) {
            case "pen":
                toolName = "Pen";
                icon = "&";
                color = "rgb(" + evt.color[0] + "," + evt.color[1] + "," + evt.color[2] + ")";
            break;
            case "eraser":
                toolName = "Eraser";
                icon = "n";
            break;
            case "finger":
                toolName = "No";
                icon = "#";
            break;
        }

        $.notification( {
                title: toolName + " Tool",
                content: "Selected",
                icon: icon,
                color: color,
                timeout: 2000,
                border: false
        });
    };

    _SB_dispatch = function(packet) {
        debug("Dispatching: " + JSON.stringify(packet));
        function anEventForXY(eventName, x, y, pid, toolData) {
            var e = document.createEvent('MouseEvent');
            e.initMouseEvent("mousedown", true, true,
                window, 1,
                SBScreen.clientToScreenX(x), SBScreen.clientToScreenY(y),
                x, y,
                false, false, false, false, 0, null);
            e._pointerID = pid;
            e.toolData = toolData;
            return e;
        }

        var handledPids = [];
        if(packet["type"] == "points") {
            if( packet["data"].length > 0) {
                var x = SBScreen.convertX(packet["data"][0].x);
                var y = SBScreen.convertY(packet["data"][0].y);

                if(SB.wantsSDKEvents && SB.onSinglePoint) {
                    debug("SB.onSinglePoint(" + x + ", " + y + ")");
                    SB.onSinglePoint(x, y);
                }

                if(SB.wantsSDKEvents && SB.onPoint) {
                    var numPoints = packet["data"].length;
                    for(var i = 0; i < numPoints; i++) {
                        var x = packet["data"][i].x;
                        var y = packet["data"][i].y;

                        var pid = packet["data"][i]._pointerID;
                        var toolData = packet["data"][i].toolData;

                        SB.onPoint(x, y, pid, toolData);
                    }
                }

                if (SB.wantsTouches) {
                    var numPoints = packet["data"].length;
                    for(var i = 0; i < numPoints; i++) {
                        debug(JSON.stringify(packet.data[i]));

                        var x = packet["data"][i].x;
                        var y = packet["data"][i].y;

                        var pid = packet["data"][i]._pointerID;
                        var toolData = packet["data"][i].toolData;

						if (!isDefined(toolData.tool)) {
							switch (toolData._rawData.name) {
								case "no_tool":
									toolData.tool = "finger";
									break;
								case "polyline":
									toolData.tool = "pen";
									break;
								case "eraser_tool":
									toolData.tool = "eraser";
									break;
								default:
									toolData.tool = "finger"
							}
						}

                        var eventType = "mousemove";
                        dispatchFunction = smartDispatch.dispatchTouchMove;

                        if(packet.data[i].contactState == "down") {
                            eventType = "mousedown";
                            dispatchFunction = smartDispatch.dispatchTouchStart;
                            __touchIdentifierForPid[pid] = __nextTouchIdentifer++;
                        }
                        if(packet.data[i].contactState == "up") {
                            eventType = "mouseup";
                            dispatchFunction = smartDispatch.dispatchTouchEnd;
                        }

                        handledPids.push(pid + "");
                        var domEvt = anEventForXY(eventType, x, y, pid, toolData);
                        dispatchFunction(domEvt);
                    }
                }

            } else {
                throw "Shouldn't be empty";
            }

        }

        if(packet["type"] == "toolChange") {
            var evt = packet["data"];

			if (!isDefined(evt.tool)) {
				switch (evt._rawData.name) {
					case "no_tool":
					evt.tool = "finger";
					break;
					case "polyline":
					evt.tool = "pen";
					break;
					case "eraser_tool":
					evt.tool = "eraser";
					break;
					default:
					evt.tool = "finger"
				}
			}

            if(SB.onToolChange) {
                try {
                    SB.onToolChange(evt);
                } catch (e) {
                    throw "Error in user tool change function: " + e;
                }
            }

            _SB_notifyTool(evt);
        }

		if(packet["type"] == "onProximityStateChange") {
            var evt = packet["data"];

            if(SB.onProximityStateChange) {
                try {
                    SB.onProximityStateChange(evt);
                } catch (e) {
                    throw "Error in proximity state change function: " + e;
                }
            }

        }

    };

    SB.init = function() {
        debug("smartboard.js init");
        smartDispatch.init();

        if(window.Prototype) {
            delete Array.prototype.toJSON;
        }

        debug("Connecting...");
        var features = "";

        (function() {
            var featureList = "";
            var addFeature = function(str) { featureList += "<li>" + str + "</li>"; };

            if(SB.wantsSDKEvents) addFeature("SDK events");
            if(SB.wantsTouches) addFeature("Touch events");
            if(SB.onToolChange) addFeature("Tool changes");
            if(SB.onProximityStateChange) addFeature("Proximity Change");

            if(featureList.length > 0) {
                features = "<br/><br/>This application takes advantage of:<ul>" + featureList + "</ul>";
            }
        })();

        $.notification( {
                title: "This web application is SMART Board enabled",
                content: "With a SMART Board, you can access additional features in this application." + features,
                timeout: 4000,
                border: true
        });

        _SB_connect();

        debug("Waiting for first mouse...");

        if(SB.wantsSDKEvents || SB.wantsTouches) {
            if(SB.wantsTouches) {
                var makeOverlay = function() {
                    var scrollBarAllowance = { horizontalBar : 0, verticalBar : 0 };
                    var $body = $('body');
                    if($body.height() > $(window).height()) { scrollBarAllowance.verticalBar = 16; }
                    if($body.width() > $(window).width()) { scrollBarAllowance.horizontalBar = 16; }
                    var bodyHeight = Math.max($(window).height(), $body.height());
                    SB.overlay = $('<div id="_smartboard-event-overlay"></div>').css({
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: $body.width() - scrollBarAllowance.verticalBar,
                        height: bodyHeight - scrollBarAllowance.horizontalBar
                    });
                    SB.overlay.css('background-color', 'rgba(0, 0, 255, 0.0)');
                    SB.overlay.css('z-index', '999990');
                    $('#_smartboard-event-overlay').remove();
                    $body.append(SB.overlay);

                    SB.overlay.disable = function() { SB.overlay.remove(); };
                    SB.overlay.enable = function() {
                        makeOverlay();
                        document.getElementById("_smartboard-event-overlay").addEventListener('mousedown', _SB_trackFirstMouseDown, true);
                        document.getElementById("_smartboard-event-overlay").addEventListener('mousemove', _SB_trackFirstMouseMove, true);
                        document.getElementById("_smartboard-event-overlay").addEventListener('mouseup', _SB_trackFirstMouseUp, true);

                        document.getElementById("_smartboard-event-overlay").addEventListener('mousedown', _SB_mouseDown, true);
                        document.getElementById("_smartboard-event-overlay").addEventListener('mousemove', _SB_mouseMove, true);
                        document.getElementById("_smartboard-event-overlay").addEventListener('mouseup', _SB_mouseUp, true);
                    };
                };

                makeOverlay();
                SB.overlay.enable();
            }

        }

        if(!SB.disableInkFields) {
            SBInput.attachToDocument();
        }
    };

    SB.calibrate = function(evt) {
        SB_CALIBRATED = true;
        SBScreen.calibrate(evt);
    };

    /**
     * Perform handwriting recognition on a set of points.
     * The set of points is an array containing strokes, where each stroke is also an array of arrays with 2 entries.
     * Points are expected to be in a co-ordinate system where top left is 0, 0 and Y increases downwards.
     * @param {array} points an array representing points on which to perform HWR
     * @param {function} callback a function which takes one parameter as arguments which will be called when HWR is complete.  The argument is a string containing the best match resulting words from the points.
     *
     * @example
     * //var sample = [ [ [x1, y1], [x2, y2], [x3, y3] ], [ [sx1, sy1] , [sx2, sy2] ] ];
     * //             ^ first stroke          ^           ^second stroke
     * //                                     L point is an array of two elements x, y
     *
     * var points = [[[0, -10], [5, -10]], [[2, -10], [2, 5]], [[6, 3], [10, 3], [10, 5], [6, 5], [6, 3]]];
     * SB.getTextForPoints(points, function(str) { alert(str); });   // will alert "To"
     */
    SB.getTextForPoints = function(points, callback) {
		$.ajax({ url: serverURL + "api/1.0.0/hwr",
				 dataType: 'json',
				 data: { "ink" : points },
				 success: function(data) {
							var text = data[0];
							callback(text);
						  },
				 error: function() {
							callback("...");
						},
				 timeout: 1000,
				 type: "POST",
				 async: true
		});
    };

    /**
    * Default value: false
    *
    * When set to true, the SBWDK will call {@link SB.onPoint} if it is defined.
    * @type boolean
    */
    SB.wantsSDKEvents = false;

    /**
    * @function
    * @fieldOf SB
    * @name onPoint
    * @type function
    * @desc If {@link SB.wantsSDKEvents} is set to true, this user defined function on SB (SB.onPoint) will be called.
    * @param {float} x in page co-ordinates
    * @param {float} y in page co-ordinates
    * @param {integer} contactId A contact ID for this particular touch, and is guaranteed to be the same for a touch down, move, and up session.
    * @param {object} toolData A tool data structure
    * @example
    * // To receive points from the SMART Board directly:
    * SB.wantsSDKEvents = true;
    * SB.onPoint = function(x, y, contactId, toolData) { console.log(x, y, contactId, toolData); };
    */

    /**
    * Default value: false
    *
    * When set to true, the SBWDK will send W3C compatible touch events to DOM elements
    * http://www.w3.org/TR/2011/WD-touch-events-20110505/
    * @type boolean
    */
    SB.wantsTouches = false;

    /**
    * Default value: false
    *
    * When set to true, the SBWDK will no longer visualize touch points (grey circles)
    * @type boolean
    */
    SB.disableTouchPointers = false;

    /**
    * Default value: false
    *
    * When set to true, the touch points will contain debug data.
    * {@link SB.disableTouchPointers} has to be false.
    * @type boolean
    */
    SB.debugTouches = false;

    /**
    * Default value: false
    *
    * When set to true, SBWDK will no longer display banners when connecting to the SMART Board
    * @type boolean
    */
    SB.disableBanners = false;

    /**
    * Default value: false
    *
    * When set to true, SBWDK will no longer automatically turn controls created by INPUT and
    * TEXTAREA tags to be ink aware.
    * @type boolean
    */
    SB.disableInkFields = false;

    /**
    * Called when the user or other SMART software changes the tool.
    * @example
    * // Sample tool change event, also the same format in touch event
    * var evt = {
    *     "color": [ 0, 0, 255 ],  // Color in [R,G,B] format
    *     "colorAsHTML": "#0000ff",  // Color in HTML format as a string
    *     "width": 3,  // Radius of pen in pixels
    *     "opacity": 1,  // Opacity of the pen (alpha value, 0 transparent, 1 opaque)
    *     "tool": "pen",  // Can be "pen", "eraser", or "finger"
    *     "_rawData": {   // Ignore,  Raw SBSDK data.  Not guaranteed to be available in future
    *         "_rawXML": "<board id=\"10\">...",  // Raw data tool change XML
    *         "boardNumber": 10,  // Board ID
    *         "name": "polyline",
    *         "toolAttributes": {
    *             "fill": "none",
    *             "stroke-width": "3",
    *             "stroke": "#0000ff",
    *             "opacity": "1.0",
    *             "strokeAsRGB": [ 0, 0, 255 ]
    *         }
    *     }
    * }
    * @type function
    */
    SB.onToolChange = null;

    /**
    * Called when the user has moved in front of the SMART Board on supported boards.
    * @type function
    */
	SB.onProximityStateChange = null;


    /**
    * @function
    * @desc
    * Called at certain stages while the SBWDK is loading.
    * Valid statuses are:
    *
    * - *"Connecting"*
    *   - When the SBWDK is attempting to connect to the SMART Board
    * - *"Disconnected"*
    *   - When the SBWDK has disconnected from the SMART Board
    *
    * @param {string} status
    * @type function
    */
    SB.statusChanged = null;

    /**
    * @fieldOf SB
    * @name numberOfBoards
    * @desc
    * Returns the number of boards attached
    * @type integer
    */
    if(isDefined(SB.__defineGetter__)) {
        SB.__defineGetter__("numberOfBoards", function(){
            return SB_NUMBER_OF_BOARDS;
        });
    }

    var _SB_trackingFirstTouch = false;
    var _SB_firstTarget = null;
    var _SB_firstTargetCursorCSS = "auto";

    var _SB_lastToolForPacketForEvent = { "tool" : "finger" };
    var _SB_packetForEvent = function(evt) {
        var packet = {};
        packet.type = "points";
        packet.data = [[]];
        packet.data[0].x = evt.clientX;
        packet.data[0].y = evt.clientY;
        packet.data[0]._pointerID = 0;
        switch(evt.type) {
            case "mousedown":
                packet.data[0].contactState = "down";
                if(SB_CONNECTED) {
                    $.ajax({ url: serverURL + "api/1.0.0/currentTool",
                             dataType: 'json',
                             success: function(result) {
                                _SB_lastToolForPacketForEvent = result;
                             },
                             timeout: 150,
                             async: false
                    });
                }
                break;
            case "mousemove": packet.data[0].contactState = "move"; break;
            case "mouseup": packet.data[0].contactState = "up"; break;
        }

        if(isDefined(evt.toolData)) {
            packet.data[0].toolData = evt.toolData;
        } else {
            // Get the tool and fill it in the fake event
            if(SB_CONNECTED) {
                packet.data[0].toolData = _SB_lastToolForPacketForEvent;
            } else {
                // Default to finger
                packet.data[0].toolData = { "tool" : "finger" };
            }
        }

        return packet;
    };

    var _SB_finishedTrackingFirstMouse = false;

    var _SB_trackFirstMouseDown = function(evt) {
        if(_SB_trackingFirstTouch || evt.synthetic) { return; }
        if(!SB_CALIBRATED && (SB.wantsSDKEvents || SB.wantsTouches) || !SB_CONNECTED) {

            SB.overlay.disable();

            _SB_trackingFirstTouch = true;
            _SB_dispatch(_SB_packetForEvent(evt));
            _SB_firstTarget = $(document.elementFromPoint(evt.clientX, evt.clientY));

            _SB_firstTargetCursorCSS = $(_SB_firstTarget).css('cursor');
            $(_SB_firstTarget).css('cursor', 'none');
            if(SB_CONNECTED) {
                evt.stopPropagation();
                evt.preventDefault();
            }

            SB.overlay.enable();
        }
        evt.stopPropagation();
        evt.preventDefault();
    };

    var _SB_trackFirstMouseMove = function(evt) {
        if(!_SB_trackingFirstTouch || evt.synthetic) { return; }
        if(isDefined(evt.which) && evt.which == 0) {
            evt.type = "mouseup";
            _SB_trackFirstMouseUp(evt);
            var fakeUpEvent = _SB_packetForEvent(evt);
            fakeUpEvent.data[0].contactState = "up";
            _SB_dispatch(fakeUpEvent);
            return;
        }
        _SB_dispatch(_SB_packetForEvent(evt));
        if(SB_CONNECTED) {
            evt.stopPropagation();
            evt.preventDefault();
        }
        evt.stopPropagation();
        evt.preventDefault();
    };

    var _SB_trackFirstMouseUp = function(evt) {
        if(!_SB_trackingFirstTouch || evt.synthetic) { return; }

        SB.calibrate(evt);

        _SB_dispatch(_SB_packetForEvent(evt));

        _SB_trackingFirstTouch = false;

        $(_SB_firstTarget).css('cursor', _SB_firstTargetCursorCSS);

        _SB_finishedTrackingFirstMouse = true;

        if(SB_CONNECTED) {
            evt.stopPropagation();
            evt.preventDefault();
        }
        evt.stopPropagation();
        evt.preventDefault();

        SB.overlay.enable();
    };


    var _SB_trackingMouse = false;
    var _SB_mouseDown = function(evt) {
        if(!(SB_CONNECTED && SB_CALIBRATED && _SB_finishedTrackingFirstMouse)) return;
        if(evt.synthetic) return;

        _SB_trackingMouse = true;
        SB.overlay.disable();

        _SB_dispatch(_SB_packetForEvent(evt));

        evt.stopPropagation();
        evt.preventDefault();
    };

    var _SB_mouseMove = function(evt) {
        if(!_SB_trackingMouse) return;
        if(evt.synthetic) return;

        if(isDefined(evt.which) && evt.which == 0) {
            evt.type = "mouseup";
            _SB_mouseUp(evt);
            var fakeUpEvent = _SB_packetForEvent(evt);
            fakeUpEvent.data[0].contactState = "up";
            _SB_dispatch(fakeUpEvent);
            return;
        }

        _SB_dispatch(_SB_packetForEvent(evt));

        evt.stopPropagation();
        evt.preventDefault();
    };

    var _SB_mouseUp = function(evt) {
        if(!_SB_trackingMouse) return;
        if(evt.synthetic) return;

        _SB_dispatch(_SB_packetForEvent(evt));

        SB.overlay.enable();

        evt.stopPropagation();
        evt.preventDefault();

        _SB_trackingMouse = false;
    };

    $(document).ready(function() {
        setTimeout(SB.init, 250);
    });
})($);

function _SB_load_dependencies(GLOBAL, smartboardJSUrl, debugOn) {

/*! jQuery v1.7.1 jquery.com | jquery.org/license */
(function(a,b){function cy(a){return f.isWindow(a)?a:a.nodeType===9?a.defaultView||a.parentWindow:!1}function cv(a){if(!ck[a]){var b=c.body,d=f("<"+a+">").appendTo(b),e=d.css("display");d.remove();if(e==="none"||e===""){cl||(cl=c.createElement("iframe"),cl.frameBorder=cl.width=cl.height=0),b.appendChild(cl);if(!cm||!cl.createElement)cm=(cl.contentWindow||cl.contentDocument).document,cm.write((c.compatMode==="CSS1Compat"?"<!doctype html>":"")+"<html><body>"),cm.close();d=cm.createElement(a),cm.body.appendChild(d),e=f.css(d,"display"),b.removeChild(cl)}ck[a]=e}return ck[a]}function cu(a,b){var c={};f.each(cq.concat.apply([],cq.slice(0,b)),function(){c[this]=a});return c}function ct(){cr=b}function cs(){setTimeout(ct,0);return cr=f.now()}function cj(){try{return new a.ActiveXObject("Microsoft.XMLHTTP")}catch(b){}}function ci(){try{return new a.XMLHttpRequest}catch(b){}}function cc(a,c){a.dataFilter&&(c=a.dataFilter(c,a.dataType));var d=a.dataTypes,e={},g,h,i=d.length,j,k=d[0],l,m,n,o,p;for(g=1;g<i;g++){if(g===1)for(h in a.converters)typeof h=="string"&&(e[h.toLowerCase()]=a.converters[h]);l=k,k=d[g];if(k==="*")k=l;else if(l!=="*"&&l!==k){m=l+" "+k,n=e[m]||e["* "+k];if(!n){p=b;for(o in e){j=o.split(" ");if(j[0]===l||j[0]==="*"){p=e[j[1]+" "+k];if(p){o=e[o],o===!0?n=p:p===!0&&(n=o);break}}}}!n&&!p&&f.error("No conversion from "+m.replace(" "," to ")),n!==!0&&(c=n?n(c):p(o(c)))}}return c}function cb(a,c,d){var e=a.contents,f=a.dataTypes,g=a.responseFields,h,i,j,k;for(i in g)i in d&&(c[g[i]]=d[i]);while(f[0]==="*")f.shift(),h===b&&(h=a.mimeType||c.getResponseHeader("content-type"));if(h)for(i in e)if(e[i]&&e[i].test(h)){f.unshift(i);break}if(f[0]in d)j=f[0];else{for(i in d){if(!f[0]||a.converters[i+" "+f[0]]){j=i;break}k||(k=i)}j=j||k}if(j){j!==f[0]&&f.unshift(j);return d[j]}}function ca(a,b,c,d){if(f.isArray(b))f.each(b,function(b,e){c||bE.test(a)?d(a,e):ca(a+"["+(typeof e=="object"||f.isArray(e)?b:"")+"]",e,c,d)});else if(!c&&b!=null&&typeof b=="object")for(var e in b)ca(a+"["+e+"]",b[e],c,d);else d(a,b)}function b_(a,c){var d,e,g=f.ajaxSettings.flatOptions||{};for(d in c)c[d]!==b&&((g[d]?a:e||(e={}))[d]=c[d]);e&&f.extend(!0,a,e)}function b$(a,c,d,e,f,g){f=f||c.dataTypes[0],g=g||{},g[f]=!0;var h=a[f],i=0,j=h?h.length:0,k=a===bT,l;for(;i<j&&(k||!l);i++)l=h[i](c,d,e),typeof l=="string"&&(!k||g[l]?l=b:(c.dataTypes.unshift(l),l=b$(a,c,d,e,l,g)));(k||!l)&&!g["*"]&&(l=b$(a,c,d,e,"*",g));return l}function bZ(a){return function(b,c){typeof b!="string"&&(c=b,b="*");if(f.isFunction(c)){var d=b.toLowerCase().split(bP),e=0,g=d.length,h,i,j;for(;e<g;e++)h=d[e],j=/^\+/.test(h),j&&(h=h.substr(1)||"*"),i=a[h]=a[h]||[],i[j?"unshift":"push"](c)}}}function bC(a,b,c){var d=b==="width"?a.offsetWidth:a.offsetHeight,e=b==="width"?bx:by,g=0,h=e.length;if(d>0){if(c!=="border")for(;g<h;g++)c||(d-=parseFloat(f.css(a,"padding"+e[g]))||0),c==="margin"?d+=parseFloat(f.css(a,c+e[g]))||0:d-=parseFloat(f.css(a,"border"+e[g]+"Width"))||0;return d+"px"}d=bz(a,b,b);if(d<0||d==null)d=a.style[b]||0;d=parseFloat(d)||0;if(c)for(;g<h;g++)d+=parseFloat(f.css(a,"padding"+e[g]))||0,c!=="padding"&&(d+=parseFloat(f.css(a,"border"+e[g]+"Width"))||0),c==="margin"&&(d+=parseFloat(f.css(a,c+e[g]))||0);return d+"px"}function bp(a,b){b.src?f.ajax({url:b.src,async:!1,dataType:"script"}):f.globalEval((b.text||b.textContent||b.innerHTML||"").replace(bf,"/*$0*/")),b.parentNode&&b.parentNode.removeChild(b)}function bo(a){var b=c.createElement("div");bh.appendChild(b),b.innerHTML=a.outerHTML;return b.firstChild}function bn(a){var b=(a.nodeName||"").toLowerCase();b==="input"?bm(a):b!=="script"&&typeof a.getElementsByTagName!="undefined"&&f.grep(a.getElementsByTagName("input"),bm)}function bm(a){if(a.type==="checkbox"||a.type==="radio")a.defaultChecked=a.checked}function bl(a){return typeof a.getElementsByTagName!="undefined"?a.getElementsByTagName("*"):typeof a.querySelectorAll!="undefined"?a.querySelectorAll("*"):[]}function bk(a,b){var c;if(b.nodeType===1){b.clearAttributes&&b.clearAttributes(),b.mergeAttributes&&b.mergeAttributes(a),c=b.nodeName.toLowerCase();if(c==="object")b.outerHTML=a.outerHTML;else if(c!=="input"||a.type!=="checkbox"&&a.type!=="radio"){if(c==="option")b.selected=a.defaultSelected;else if(c==="input"||c==="textarea")b.defaultValue=a.defaultValue}else a.checked&&(b.defaultChecked=b.checked=a.checked),b.value!==a.value&&(b.value=a.value);b.removeAttribute(f.expando)}}function bj(a,b){if(b.nodeType===1&&!!f.hasData(a)){var c,d,e,g=f._data(a),h=f._data(b,g),i=g.events;if(i){delete h.handle,h.events={};for(c in i)for(d=0,e=i[c].length;d<e;d++)f.event.add(b,c+(i[c][d].namespace?".":"")+i[c][d].namespace,i[c][d],i[c][d].data)}h.data&&(h.data=f.extend({},h.data))}}function bi(a,b){return f.nodeName(a,"table")?a.getElementsByTagName("tbody")[0]||a.appendChild(a.ownerDocument.createElement("tbody")):a}function U(a){var b=V.split("|"),c=a.createDocumentFragment();if(c.createElement)while(b.length)c.createElement(b.pop());return c}function T(a,b,c){b=b||0;if(f.isFunction(b))return f.grep(a,function(a,d){var e=!!b.call(a,d,a);return e===c});if(b.nodeType)return f.grep(a,function(a,d){return a===b===c});if(typeof b=="string"){var d=f.grep(a,function(a){return a.nodeType===1});if(O.test(b))return f.filter(b,d,!c);b=f.filter(b,d)}return f.grep(a,function(a,d){return f.inArray(a,b)>=0===c})}function S(a){return!a||!a.parentNode||a.parentNode.nodeType===11}function K(){return!0}function J(){return!1}function n(a,b,c){var d=b+"defer",e=b+"queue",g=b+"mark",h=f._data(a,d);h&&(c==="queue"||!f._data(a,e))&&(c==="mark"||!f._data(a,g))&&setTimeout(function(){!f._data(a,e)&&!f._data(a,g)&&(f.removeData(a,d,!0),h.fire())},0)}function m(a){for(var b in a){if(b==="data"&&f.isEmptyObject(a[b]))continue;if(b!=="toJSON")return!1}return!0}function l(a,c,d){if(d===b&&a.nodeType===1){var e="data-"+c.replace(k,"-$1").toLowerCase();d=a.getAttribute(e);if(typeof d=="string"){try{d=d==="true"?!0:d==="false"?!1:d==="null"?null:f.isNumeric(d)?parseFloat(d):j.test(d)?f.parseJSON(d):d}catch(g){}f.data(a,c,d)}else d=b}return d}function h(a){var b=g[a]={},c,d;a=a.split(/\s+/);for(c=0,d=a.length;c<d;c++)b[a[c]]=!0;return b}var c=a.document,d=a.navigator,e=a.location,f=function(){function J(){if(!e.isReady){try{c.documentElement.doScroll("left")}catch(a){setTimeout(J,1);return}e.ready()}}var e=function(a,b){return new e.fn.init(a,b,h)},f=a.jQuery,g=a.$,h,i=/^(?:[^#<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/,j=/\S/,k=/^\s+/,l=/\s+$/,m=/^<(\w+)\s*\/?>(?:<\/\1>)?$/,n=/^[\],:{}\s]*$/,o=/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,p=/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,q=/(?:^|:|,)(?:\s*\[)+/g,r=/(webkit)[ \/]([\w.]+)/,s=/(opera)(?:.*version)?[ \/]([\w.]+)/,t=/(msie) ([\w.]+)/,u=/(mozilla)(?:.*? rv:([\w.]+))?/,v=/-([a-z]|[0-9])/ig,w=/^-ms-/,x=function(a,b){return(b+"").toUpperCase()},y=d.userAgent,z,A,B,C=Object.prototype.toString,D=Object.prototype.hasOwnProperty,E=Array.prototype.push,F=Array.prototype.slice,G=String.prototype.trim,H=Array.prototype.indexOf,I={};e.fn=e.prototype={constructor:e,init:function(a,d,f){var g,h,j,k;if(!a)return this;if(a.nodeType){this.context=this[0]=a,this.length=1;return this}if(a==="body"&&!d&&c.body){this.context=c,this[0]=c.body,this.selector=a,this.length=1;return this}if(typeof a=="string"){a.charAt(0)!=="<"||a.charAt(a.length-1)!==">"||a.length<3?g=i.exec(a):g=[null,a,null];if(g&&(g[1]||!d)){if(g[1]){d=d instanceof e?d[0]:d,k=d?d.ownerDocument||d:c,j=m.exec(a),j?e.isPlainObject(d)?(a=[c.createElement(j[1])],e.fn.attr.call(a,d,!0)):a=[k.createElement(j[1])]:(j=e.buildFragment([g[1]],[k]),a=(j.cacheable?e.clone(j.fragment):j.fragment).childNodes);return e.merge(this,a)}h=c.getElementById(g[2]);if(h&&h.parentNode){if(h.id!==g[2])return f.find(a);this.length=1,this[0]=h}this.context=c,this.selector=a;return this}return!d||d.jquery?(d||f).find(a):this.constructor(d).find(a)}if(e.isFunction(a))return f.ready(a);a.selector!==b&&(this.selector=a.selector,this.context=a.context);return e.makeArray(a,this)},selector:"",jquery:"1.7.1",length:0,size:function(){return this.length},toArray:function(){return F.call(this,0)},get:function(a){return a==null?this.toArray():a<0?this[this.length+a]:this[a]},pushStack:function(a,b,c){var d=this.constructor();e.isArray(a)?E.apply(d,a):e.merge(d,a),d.prevObject=this,d.context=this.context,b==="find"?d.selector=this.selector+(this.selector?" ":"")+c:b&&(d.selector=this.selector+"."+b+"("+c+")");return d},each:function(a,b){return e.each(this,a,b)},ready:function(a){e.bindReady(),A.add(a);return this},eq:function(a){a=+a;return a===-1?this.slice(a):this.slice(a,a+1)},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},slice:function(){return this.pushStack(F.apply(this,arguments),"slice",F.call(arguments).join(","))},map:function(a){return this.pushStack(e.map(this,function(b,c){return a.call(b,c,b)}))},end:function(){return this.prevObject||this.constructor(null)},push:E,sort:[].sort,splice:[].splice},e.fn.init.prototype=e.fn,e.extend=e.fn.extend=function(){var a,c,d,f,g,h,i=arguments[0]||{},j=1,k=arguments.length,l=!1;typeof i=="boolean"&&(l=i,i=arguments[1]||{},j=2),typeof i!="object"&&!e.isFunction(i)&&(i={}),k===j&&(i=this,--j);for(;j<k;j++)if((a=arguments[j])!=null)for(c in a){d=i[c],f=a[c];if(i===f)continue;l&&f&&(e.isPlainObject(f)||(g=e.isArray(f)))?(g?(g=!1,h=d&&e.isArray(d)?d:[]):h=d&&e.isPlainObject(d)?d:{},i[c]=e.extend(l,h,f)):f!==b&&(i[c]=f)}return i},e.extend({noConflict:function(b){a.$===e&&(a.$=g),b&&a.jQuery===e&&(a.jQuery=f);return e},isReady:!1,readyWait:1,holdReady:function(a){a?e.readyWait++:e.ready(!0)},ready:function(a){if(a===!0&&!--e.readyWait||a!==!0&&!e.isReady){if(!c.body)return setTimeout(e.ready,1);e.isReady=!0;if(a!==!0&&--e.readyWait>0)return;A.fireWith(c,[e]),e.fn.trigger&&e(c).trigger("ready").off("ready")}},bindReady:function(){if(!A){A=e.Callbacks("once memory");if(c.readyState==="complete")return setTimeout(e.ready,1);if(c.addEventListener)c.addEventListener("DOMContentLoaded",B,!1),a.addEventListener("load",e.ready,!1);else if(c.attachEvent){c.attachEvent("onreadystatechange",B),a.attachEvent("onload",e.ready);var b=!1;try{b=a.frameElement==null}catch(d){}c.documentElement.doScroll&&b&&J()}}},isFunction:function(a){return e.type(a)==="function"},isArray:Array.isArray||function(a){return e.type(a)==="array"},isWindow:function(a){return a&&typeof a=="object"&&"setInterval"in a},isNumeric:function(a){return!isNaN(parseFloat(a))&&isFinite(a)},type:function(a){return a==null?String(a):I[C.call(a)]||"object"},isPlainObject:function(a){if(!a||e.type(a)!=="object"||a.nodeType||e.isWindow(a))return!1;try{if(a.constructor&&!D.call(a,"constructor")&&!D.call(a.constructor.prototype,"isPrototypeOf"))return!1}catch(c){return!1}var d;for(d in a);return d===b||D.call(a,d)},isEmptyObject:function(a){for(var b in a)return!1;return!0},error:function(a){throw new Error(a)},parseJSON:function(b){if(typeof b!="string"||!b)return null;b=e.trim(b);if(a.JSON&&a.JSON.parse)return a.JSON.parse(b);if(n.test(b.replace(o,"@").replace(p,"]").replace(q,"")))return(new Function("return "+b))();e.error("Invalid JSON: "+b)},parseXML:function(c){var d,f;try{a.DOMParser?(f=new DOMParser,d=f.parseFromString(c,"text/xml")):(d=new ActiveXObject("Microsoft.XMLDOM"),d.async="false",d.loadXML(c))}catch(g){d=b}(!d||!d.documentElement||d.getElementsByTagName("parsererror").length)&&e.error("Invalid XML: "+c);return d},noop:function(){},globalEval:function(b){b&&j.test(b)&&(a.execScript||function(b){a.eval.call(a,b)})(b)},camelCase:function(a){return a.replace(w,"ms-").replace(v,x)},nodeName:function(a,b){return a.nodeName&&a.nodeName.toUpperCase()===b.toUpperCase()},each:function(a,c,d){var f,g=0,h=a.length,i=h===b||e.isFunction(a);if(d){if(i){for(f in a)if(c.apply(a[f],d)===!1)break}else for(;g<h;)if(c.apply(a[g++],d)===!1)break}else if(i){for(f in a)if(c.call(a[f],f,a[f])===!1)break}else for(;g<h;)if(c.call(a[g],g,a[g++])===!1)break;return a},trim:G?function(a){return a==null?"":G.call(a)}:function(a){return a==null?"":(a+"").replace(k,"").replace(l,"")},makeArray:function(a,b){var c=b||[];if(a!=null){var d=e.type(a);a.length==null||d==="string"||d==="function"||d==="regexp"||e.isWindow(a)?E.call(c,a):e.merge(c,a)}return c},inArray:function(a,b,c){var d;if(b){if(H)return H.call(b,a,c);d=b.length,c=c?c<0?Math.max(0,d+c):c:0;for(;c<d;c++)if(c in b&&b[c]===a)return c}return-1},merge:function(a,c){var d=a.length,e=0;if(typeof c.length=="number")for(var f=c.length;e<f;e++)a[d++]=c[e];else while(c[e]!==b)a[d++]=c[e++];a.length=d;return a},grep:function(a,b,c){var d=[],e;c=!!c;for(var f=0,g=a.length;f<g;f++)e=!!b(a[f],f),c!==e&&d.push(a[f]);return d},map:function(a,c,d){var f,g,h=[],i=0,j=a.length,k=a instanceof e||j!==b&&typeof j=="number"&&(j>0&&a[0]&&a[j-1]||j===0||e.isArray(a));if(k)for(;i<j;i++)f=c(a[i],i,d),f!=null&&(h[h.length]=f);else for(g in a)f=c(a[g],g,d),f!=null&&(h[h.length]=f);return h.concat.apply([],h)},guid:1,proxy:function(a,c){if(typeof c=="string"){var d=a[c];c=a,a=d}if(!e.isFunction(a))return b;var f=F.call(arguments,2),g=function(){return a.apply(c,f.concat(F.call(arguments)))};g.guid=a.guid=a.guid||g.guid||e.guid++;return g},access:function(a,c,d,f,g,h){var i=a.length;if(typeof c=="object"){for(var j in c)e.access(a,j,c[j],f,g,d);return a}if(d!==b){f=!h&&f&&e.isFunction(d);for(var k=0;k<i;k++)g(a[k],c,f?d.call(a[k],k,g(a[k],c)):d,h);return a}return i?g(a[0],c):b},now:function(){return(new Date).getTime()},uaMatch:function(a){a=a.toLowerCase();var b=r.exec(a)||s.exec(a)||t.exec(a)||a.indexOf("compatible")<0&&u.exec(a)||[];return{browser:b[1]||"",version:b[2]||"0"}},sub:function(){function a(b,c){return new a.fn.init(b,c)}e.extend(!0,a,this),a.superclass=this,a.fn=a.prototype=this(),a.fn.constructor=a,a.sub=this.sub,a.fn.init=function(d,f){f&&f instanceof e&&!(f instanceof a)&&(f=a(f));return e.fn.init.call(this,d,f,b)},a.fn.init.prototype=a.fn;var b=a(c);return a},browser:{}}),e.each("Boolean Number String Function Array Date RegExp Object".split(" "),function(a,b){I["[object "+b+"]"]=b.toLowerCase()}),z=e.uaMatch(y),z.browser&&(e.browser[z.browser]=!0,e.browser.version=z.version),e.browser.webkit&&(e.browser.safari=!0),j.test(" ")&&(k=/^[\s\xA0]+/,l=/[\s\xA0]+$/),h=e(c),c.addEventListener?B=function(){c.removeEventListener("DOMContentLoaded",B,!1),e.ready()}:c.attachEvent&&(B=function(){c.readyState==="complete"&&(c.detachEvent("onreadystatechange",B),e.ready())});return e}(),g={};f.Callbacks=function(a){a=a?g[a]||h(a):{};var c=[],d=[],e,i,j,k,l,m=function(b){var d,e,g,h,i;for(d=0,e=b.length;d<e;d++)g=b[d],h=f.type(g),h==="array"?m(g):h==="function"&&(!a.unique||!o.has(g))&&c.push(g)},n=function(b,f){f=f||[],e=!a.memory||[b,f],i=!0,l=j||0,j=0,k=c.length;for(;c&&l<k;l++)if(c[l].apply(b,f)===!1&&a.stopOnFalse){e=!0;break}i=!1,c&&(a.once?e===!0?o.disable():c=[]:d&&d.length&&(e=d.shift(),o.fireWith(e[0],e[1])))},o={add:function(){if(c){var a=c.length;m(arguments),i?k=c.length:e&&e!==!0&&(j=a,n(e[0],e[1]))}return this},remove:function(){if(c){var b=arguments,d=0,e=b.length;for(;d<e;d++)for(var f=0;f<c.length;f++)if(b[d]===c[f]){i&&f<=k&&(k--,f<=l&&l--),c.splice(f--,1);if(a.unique)break}}return this},has:function(a){if(c){var b=0,d=c.length;for(;b<d;b++)if(a===c[b])return!0}return!1},empty:function(){c=[];return this},disable:function(){c=d=e=b;return this},disabled:function(){return!c},lock:function(){d=b,(!e||e===!0)&&o.disable();return this},locked:function(){return!d},fireWith:function(b,c){d&&(i?a.once||d.push([b,c]):(!a.once||!e)&&n(b,c));return this},fire:function(){o.fireWith(this,arguments);return this},fired:function(){return!!e}};return o};var i=[].slice;f.extend({Deferred:function(a){var b=f.Callbacks("once memory"),c=f.Callbacks("once memory"),d=f.Callbacks("memory"),e="pending",g={resolve:b,reject:c,notify:d},h={done:b.add,fail:c.add,progress:d.add,state:function(){return e},isResolved:b.fired,isRejected:c.fired,then:function(a,b,c){i.done(a).fail(b).progress(c);return this},always:function(){i.done.apply(i,arguments).fail.apply(i,arguments);return this},pipe:function(a,b,c){return f.Deferred(function(d){f.each({done:[a,"resolve"],fail:[b,"reject"],progress:[c,"notify"]},function(a,b){var c=b[0],e=b[1],g;f.isFunction(c)?i[a](function(){g=c.apply(this,arguments),g&&f.isFunction(g.promise)?g.promise().then(d.resolve,d.reject,d.notify):d[e+"With"](this===i?d:this,[g])}):i[a](d[e])})}).promise()},promise:function(a){if(a==null)a=h;else for(var b in h)a[b]=h[b];return a}},i=h.promise({}),j;for(j in g)i[j]=g[j].fire,i[j+"With"]=g[j].fireWith;i.done(function(){e="resolved"},c.disable,d.lock).fail(function(){e="rejected"},b.disable,d.lock),a&&a.call(i,i);return i},when:function(a){function m(a){return function(b){e[a]=arguments.length>1?i.call(arguments,0):b,j.notifyWith(k,e)}}function l(a){return function(c){b[a]=arguments.length>1?i.call(arguments,0):c,--g||j.resolveWith(j,b)}}var b=i.call(arguments,0),c=0,d=b.length,e=Array(d),g=d,h=d,j=d<=1&&a&&f.isFunction(a.promise)?a:f.Deferred(),k=j.promise();if(d>1){for(;c<d;c++)b[c]&&b[c].promise&&f.isFunction(b[c].promise)?b[c].promise().then(l(c),j.reject,m(c)):--g;g||j.resolveWith(j,b)}else j!==a&&j.resolveWith(j,d?[a]:[]);return k}}),f.support=function(){var b,d,e,g,h,i,j,k,l,m,n,o,p,q=c.createElement("div"),r=c.documentElement;q.setAttribute("className","t"),q.innerHTML="   <link/><table></table><a href='/a' style='top:1px;float:left;opacity:.55;'>a</a><input type='checkbox'/>",d=q.getElementsByTagName("*"),e=q.getElementsByTagName("a")[0];if(!d||!d.length||!e)return{};g=c.createElement("select"),h=g.appendChild(c.createElement("option")),i=q.getElementsByTagName("input")[0],b={leadingWhitespace:q.firstChild.nodeType===3,tbody:!q.getElementsByTagName("tbody").length,htmlSerialize:!!q.getElementsByTagName("link").length,style:/top/.test(e.getAttribute("style")),hrefNormalized:e.getAttribute("href")==="/a",opacity:/^0.55/.test(e.style.opacity),cssFloat:!!e.style.cssFloat,checkOn:i.value==="on",optSelected:h.selected,getSetAttribute:q.className!=="t",enctype:!!c.createElement("form").enctype,html5Clone:c.createElement("nav").cloneNode(!0).outerHTML!=="<:nav></:nav>",submitBubbles:!0,changeBubbles:!0,focusinBubbles:!1,deleteExpando:!0,noCloneEvent:!0,inlineBlockNeedsLayout:!1,shrinkWrapBlocks:!1,reliableMarginRight:!0},i.checked=!0,b.noCloneChecked=i.cloneNode(!0).checked,g.disabled=!0,b.optDisabled=!h.disabled;try{delete q.test}catch(s){b.deleteExpando=!1}!q.addEventListener&&q.attachEvent&&q.fireEvent&&(q.attachEvent("onclick",function(){b.noCloneEvent=!1}),q.cloneNode(!0).fireEvent("onclick")),i=c.createElement("input"),i.value="t",i.setAttribute("type","radio"),b.radioValue=i.value==="t",i.setAttribute("checked","checked"),q.appendChild(i),k=c.createDocumentFragment(),k.appendChild(q.lastChild),b.checkClone=k.cloneNode(!0).cloneNode(!0).lastChild.checked,b.appendChecked=i.checked,k.removeChild(i),k.appendChild(q),q.innerHTML="",a.getComputedStyle&&(j=c.createElement("div"),j.style.width="0",j.style.marginRight="0",q.style.width="2px",q.appendChild(j),b.reliableMarginRight=(parseInt((a.getComputedStyle(j,null)||{marginRight:0}).marginRight,10)||0)===0);if(q.attachEvent)for(o in{submit:1,change:1,focusin:1})n="on"+o,p=n in q,p||(q.setAttribute(n,"return;"),p=typeof q[n]=="function"),b[o+"Bubbles"]=p;k.removeChild(q),k=g=h=j=q=i=null,f(function(){var a,d,e,g,h,i,j,k,m,n,o,r=c.getElementsByTagName("body")[0];!r||(j=1,k="position:absolute;top:0;left:0;width:1px;height:1px;margin:0;",m="visibility:hidden;border:0;",n="style='"+k+"border:5px solid #000;padding:0;'",o="<div "+n+"><div></div></div>"+"<table "+n+" cellpadding='0' cellspacing='0'>"+"<tr><td></td></tr></table>",a=c.createElement("div"),a.style.cssText=m+"width:0;height:0;position:static;top:0;margin-top:"+j+"px",r.insertBefore(a,r.firstChild),q=c.createElement("div"),a.appendChild(q),q.innerHTML="<table><tr><td style='padding:0;border:0;display:none'></td><td>t</td></tr></table>",l=q.getElementsByTagName("td"),p=l[0].offsetHeight===0,l[0].style.display="",l[1].style.display="none",b.reliableHiddenOffsets=p&&l[0].offsetHeight===0,q.innerHTML="",q.style.width=q.style.paddingLeft="1px",f.boxModel=b.boxModel=q.offsetWidth===2,typeof q.style.zoom!="undefined"&&(q.style.display="inline",q.style.zoom=1,b.inlineBlockNeedsLayout=q.offsetWidth===2,q.style.display="",q.innerHTML="<div style='width:4px;'></div>",b.shrinkWrapBlocks=q.offsetWidth!==2),q.style.cssText=k+m,q.innerHTML=o,d=q.firstChild,e=d.firstChild,h=d.nextSibling.firstChild.firstChild,i={doesNotAddBorder:e.offsetTop!==5,doesAddBorderForTableAndCells:h.offsetTop===5},e.style.position="fixed",e.style.top="20px",i.fixedPosition=e.offsetTop===20||e.offsetTop===15,e.style.position=e.style.top="",d.style.overflow="hidden",d.style.position="relative",i.subtractsBorderForOverflowNotVisible=e.offsetTop===-5,i.doesNotIncludeMarginInBodyOffset=r.offsetTop!==j,r.removeChild(a),q=a=null,f.extend(b,i))});return b}();var j=/^(?:\{.*\}|\[.*\])$/,k=/([A-Z])/g;f.extend({cache:{},uuid:0,expando:"jQuery"+(f.fn.jquery+Math.random()).replace(/\D/g,""),noData:{embed:!0,object:"clsid:D27CDB6E-AE6D-11cf-96B8-444553540000",applet:!0},hasData:function(a){a=a.nodeType?f.cache[a[f.expando]]:a[f.expando];return!!a&&!m(a)},data:function(a,c,d,e){if(!!f.acceptData(a)){var g,h,i,j=f.expando,k=typeof c=="string",l=a.nodeType,m=l?f.cache:a,n=l?a[j]:a[j]&&j,o=c==="events";if((!n||!m[n]||!o&&!e&&!m[n].data)&&k&&d===b)return;n||(l?a[j]=n=++f.uuid:n=j),m[n]||(m[n]={},l||(m[n].toJSON=f.noop));if(typeof c=="object"||typeof c=="function")e?m[n]=f.extend(m[n],c):m[n].data=f.extend(m[n].data,c);g=h=m[n],e||(h.data||(h.data={}),h=h.data),d!==b&&(h[f.camelCase(c)]=d);if(o&&!h[c])return g.events;k?(i=h[c],i==null&&(i=h[f.camelCase(c)])):i=h;return i}},removeData:function(a,b,c){if(!!f.acceptData(a)){var d,e,g,h=f.expando,i=a.nodeType,j=i?f.cache:a,k=i?a[h]:h;if(!j[k])return;if(b){d=c?j[k]:j[k].data;if(d){f.isArray(b)||(b in d?b=[b]:(b=f.camelCase(b),b in d?b=[b]:b=b.split(" ")));for(e=0,g=b.length;e<g;e++)delete d[b[e]];if(!(c?m:f.isEmptyObject)(d))return}}if(!c){delete j[k].data;if(!m(j[k]))return}f.support.deleteExpando||!j.setInterval?delete j[k]:j[k]=null,i&&(f.support.deleteExpando?delete a[h]:a.removeAttribute?a.removeAttribute(h):a[h]=null)}},_data:function(a,b,c){return f.data(a,b,c,!0)},acceptData:function(a){if(a.nodeName){var b=f.noData[a.nodeName.toLowerCase()];if(b)return b!==!0&&a.getAttribute("classid")===b}return!0}}),f.fn.extend({data:function(a,c){var d,e,g,h=null;if(typeof a=="undefined"){if(this.length){h=f.data(this[0]);if(this[0].nodeType===1&&!f._data(this[0],"parsedAttrs")){e=this[0].attributes;for(var i=0,j=e.length;i<j;i++)g=e[i].name,g.indexOf("data-")===0&&(g=f.camelCase(g.substring(5)),l(this[0],g,h[g]));f._data(this[0],"parsedAttrs",!0)}}return h}if(typeof a=="object")return this.each(function(){f.data(this,a)});d=a.split("."),d[1]=d[1]?"."+d[1]:"";if(c===b){h=this.triggerHandler("getData"+d[1]+"!",[d[0]]),h===b&&this.length&&(h=f.data(this[0],a),h=l(this[0],a,h));return h===b&&d[1]?this.data(d[0]):h}return this.each(function(){var b=f(this),e=[d[0],c];b.triggerHandler("setData"+d[1]+"!",e),f.data(this,a,c),b.triggerHandler("changeData"+d[1]+"!",e)})},removeData:function(a){return this.each(function(){f.removeData(this,a)})}}),f.extend({_mark:function(a,b){a&&(b=(b||"fx")+"mark",f._data(a,b,(f._data(a,b)||0)+1))},_unmark:function(a,b,c){a!==!0&&(c=b,b=a,a=!1);if(b){c=c||"fx";var d=c+"mark",e=a?0:(f._data(b,d)||1)-1;e?f._data(b,d,e):(f.removeData(b,d,!0),n(b,c,"mark"))}},queue:function(a,b,c){var d;if(a){b=(b||"fx")+"queue",d=f._data(a,b),c&&(!d||f.isArray(c)?d=f._data(a,b,f.makeArray(c)):d.push(c));return d||[]}},dequeue:function(a,b){b=b||"fx";var c=f.queue(a,b),d=c.shift(),e={};d==="inprogress"&&(d=c.shift()),d&&(b==="fx"&&c.unshift("inprogress"),f._data(a,b+".run",e),d.call(a,function(){f.dequeue(a,b)},e)),c.length||(f.removeData(a,b+"queue "+b+".run",!0),n(a,b,"queue"))}}),f.fn.extend({queue:function(a,c){typeof a!="string"&&(c=a,a="fx");if(c===b)return f.queue(this[0],a);return this.each(function(){var b=f.queue(this,a,c);a==="fx"&&b[0]!=="inprogress"&&f.dequeue(this,a)})},dequeue:function(a){return this.each(function(){f.dequeue(this,a)})},delay:function(a,b){a=f.fx?f.fx.speeds[a]||a:a,b=b||"fx";return this.queue(b,function(b,c){var d=setTimeout(b,a);c.stop=function(){clearTimeout(d)}})},clearQueue:function(a){return this.queue(a||"fx",[])},promise:function(a,c){function m(){--h||d.resolveWith(e,[e])}typeof a!="string"&&(c=a,a=b),a=a||"fx";var d=f.Deferred(),e=this,g=e.length,h=1,i=a+"defer",j=a+"queue",k=a+"mark",l;while(g--)if(l=f.data(e[g],i,b,!0)||(f.data(e[g],j,b,!0)||f.data(e[g],k,b,!0))&&f.data(e[g],i,f.Callbacks("once memory"),!0))h++,l.add(m);m();return d.promise()}});var o=/[\n\t\r]/g,p=/\s+/,q=/\r/g,r=/^(?:button|input)$/i,s=/^(?:button|input|object|select|textarea)$/i,t=/^a(?:rea)?$/i,u=/^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i,v=f.support.getSetAttribute,w,x,y;f.fn.extend({attr:function(a,b){return f.access(this,a,b,!0,f.attr)},removeAttr:function(a){return this.each(function(){f.removeAttr(this,a)})},prop:function(a,b){return f.access(this,a,b,!0,f.prop)},removeProp:function(a){a=f.propFix[a]||a;return this.each(function(){try{this[a]=b,delete this[a]}catch(c){}})},addClass:function(a){var b,c,d,e,g,h,i;if(f.isFunction(a))return this.each(function(b){f(this).addClass(a.call(this,b,this.className))});if(a&&typeof a=="string"){b=a.split(p);for(c=0,d=this.length;c<d;c++){e=this[c];if(e.nodeType===1)if(!e.className&&b.length===1)e.className=a;else{g=" "+e.className+" ";for(h=0,i=b.length;h<i;h++)~g.indexOf(" "+b[h]+" ")||(g+=b[h]+" ");e.className=f.trim(g)}}}return this},removeClass:function(a){var c,d,e,g,h,i,j;if(f.isFunction(a))return this.each(function(b){f(this).removeClass(a.call(this,b,this.className))});if(a&&typeof a=="string"||a===b){c=(a||"").split(p);for(d=0,e=this.length;d<e;d++){g=this[d];if(g.nodeType===1&&g.className)if(a){h=(" "+g.className+" ").replace(o," ");for(i=0,j=c.length;i<j;i++)h=h.replace(" "+c[i]+" "," ");g.className=f.trim(h)}else g.className=""}}return this},toggleClass:function(a,b){var c=typeof a,d=typeof b=="boolean";if(f.isFunction(a))return this.each(function(c){f(this).toggleClass(a.call(this,c,this.className,b),b)});return this.each(function(){if(c==="string"){var e,g=0,h=f(this),i=b,j=a.split(p);while(e=j[g++])i=d?i:!h.hasClass(e),h[i?"addClass":"removeClass"](e)}else if(c==="undefined"||c==="boolean")this.className&&f._data(this,"__className__",this.className),this.className=this.className||a===!1?"":f._data(this,"__className__")||""})},hasClass:function(a){var b=" "+a+" ",c=0,d=this.length;for(;c<d;c++)if(this[c].nodeType===1&&(" "+this[c].className+" ").replace(o," ").indexOf(b)>-1)return!0;return!1},val:function(a){var c,d,e,g=this[0];{if(!!arguments.length){e=f.isFunction(a);return this.each(function(d){var g=f(this),h;if(this.nodeType===1){e?h=a.call(this,d,g.val()):h=a,h==null?h="":typeof h=="number"?h+="":f.isArray(h)&&(h=f.map(h,function(a){return a==null?"":a+""})),c=f.valHooks[this.nodeName.toLowerCase()]||f.valHooks[this.type];if(!c||!("set"in c)||c.set(this,h,"value")===b)this.value=h}})}if(g){c=f.valHooks[g.nodeName.toLowerCase()]||f.valHooks[g.type];if(c&&"get"in c&&(d=c.get(g,"value"))!==b)return d;d=g.value;return typeof d=="string"?d.replace(q,""):d==null?"":d}}}}),f.extend({valHooks:{option:{get:function(a){var b=a.attributes.value;return!b||b.specified?a.value:a.text}},select:{get:function(a){var b,c,d,e,g=a.selectedIndex,h=[],i=a.options,j=a.type==="select-one";if(g<0)return null;c=j?g:0,d=j?g+1:i.length;for(;c<d;c++){e=i[c];if(e.selected&&(f.support.optDisabled?!e.disabled:e.getAttribute("disabled")===null)&&(!e.parentNode.disabled||!f.nodeName(e.parentNode,"optgroup"))){b=f(e).val();if(j)return b;h.push(b)}}if(j&&!h.length&&i.length)return f(i[g]).val();return h},set:function(a,b){var c=f.makeArray(b);f(a).find("option").each(function(){this.selected=f.inArray(f(this).val(),c)>=0}),c.length||(a.selectedIndex=-1);return c}}},attrFn:{val:!0,css:!0,html:!0,text:!0,data:!0,width:!0,height:!0,offset:!0},attr:function(a,c,d,e){var g,h,i,j=a.nodeType;if(!!a&&j!==3&&j!==8&&j!==2){if(e&&c in f.attrFn)return f(a)[c](d);if(typeof a.getAttribute=="undefined")return f.prop(a,c,d);i=j!==1||!f.isXMLDoc(a),i&&(c=c.toLowerCase(),h=f.attrHooks[c]||(u.test(c)?x:w));if(d!==b){if(d===null){f.removeAttr(a,c);return}if(h&&"set"in h&&i&&(g=h.set(a,d,c))!==b)return g;a.setAttribute(c,""+d);return d}if(h&&"get"in h&&i&&(g=h.get(a,c))!==null)return g;g=a.getAttribute(c);return g===null?b:g}},removeAttr:function(a,b){var c,d,e,g,h=0;if(b&&a.nodeType===1){d=b.toLowerCase().split(p),g=d.length;for(;h<g;h++)e=d[h],e&&(c=f.propFix[e]||e,f.attr(a,e,""),a.removeAttribute(v?e:c),u.test(e)&&c in a&&(a[c]=!1))}},attrHooks:{type:{set:function(a,b){if(r.test(a.nodeName)&&a.parentNode)f.error("type property can't be changed");else if(!f.support.radioValue&&b==="radio"&&f.nodeName(a,"input")){var c=a.value;a.setAttribute("type",b),c&&(a.value=c);return b}}},value:{get:function(a,b){if(w&&f.nodeName(a,"button"))return w.get(a,b);return b in a?a.value:null},set:function(a,b,c){if(w&&f.nodeName(a,"button"))return w.set(a,b,c);a.value=b}}},propFix:{tabindex:"tabIndex",readonly:"readOnly","for":"htmlFor","class":"className",maxlength:"maxLength",cellspacing:"cellSpacing",cellpadding:"cellPadding",rowspan:"rowSpan",colspan:"colSpan",usemap:"useMap",frameborder:"frameBorder",contenteditable:"contentEditable"},prop:function(a,c,d){var e,g,h,i=a.nodeType;if(!!a&&i!==3&&i!==8&&i!==2){h=i!==1||!f.isXMLDoc(a),h&&(c=f.propFix[c]||c,g=f.propHooks[c]);return d!==b?g&&"set"in g&&(e=g.set(a,d,c))!==b?e:a[c]=d:g&&"get"in g&&(e=g.get(a,c))!==null?e:a[c]}},propHooks:{tabIndex:{get:function(a){var c=a.getAttributeNode("tabindex");return c&&c.specified?parseInt(c.value,10):s.test(a.nodeName)||t.test(a.nodeName)&&a.href?0:b}}}}),f.attrHooks.tabindex=f.propHooks.tabIndex,x={get:function(a,c){var d,e=f.prop(a,c);return e===!0||typeof e!="boolean"&&(d=a.getAttributeNode(c))&&d.nodeValue!==!1?c.toLowerCase():b},set:function(a,b,c){var d;b===!1?f.removeAttr(a,c):(d=f.propFix[c]||c,d in a&&(a[d]=!0),a.setAttribute(c,c.toLowerCase()));return c}},v||(y={name:!0,id:!0},w=f.valHooks.button={get:function(a,c){var d;d=a.getAttributeNode(c);return d&&(y[c]?d.nodeValue!=="":d.specified)?d.nodeValue:b},set:function(a,b,d){var e=a.getAttributeNode(d);e||(e=c.createAttribute(d),a.setAttributeNode(e));return e.nodeValue=b+""}},f.attrHooks.tabindex.set=w.set,f.each(["width","height"],function(a,b){f.attrHooks[b]=f.extend(f.attrHooks[b],{set:function(a,c){if(c===""){a.setAttribute(b,"auto");return c}}})}),f.attrHooks.contenteditable={get:w.get,set:function(a,b,c){b===""&&(b="false"),w.set(a,b,c)}}),f.support.hrefNormalized||f.each(["href","src","width","height"],function(a,c){f.attrHooks[c]=f.extend(f.attrHooks[c],{get:function(a){var d=a.getAttribute(c,2);return d===null?b:d}})}),f.support.style||(f.attrHooks.style={get:function(a){return a.style.cssText.toLowerCase()||b},set:function(a,b){return a.style.cssText=""+b}}),f.support.optSelected||(f.propHooks.selected=f.extend(f.propHooks.selected,{get:function(a){var b=a.parentNode;b&&(b.selectedIndex,b.parentNode&&b.parentNode.selectedIndex);return null}})),f.support.enctype||(f.propFix.enctype="encoding"),f.support.checkOn||f.each(["radio","checkbox"],function(){f.valHooks[this]={get:function(a){return a.getAttribute("value")===null?"on":a.value}}}),f.each(["radio","checkbox"],function(){f.valHooks[this]=f.extend(f.valHooks[this],{set:function(a,b){if(f.isArray(b))return a.checked=f.inArray(f(a).val(),b)>=0}})});var z=/^(?:textarea|input|select)$/i,A=/^([^\.]*)?(?:\.(.+))?$/,B=/\bhover(\.\S+)?\b/,C=/^key/,D=/^(?:mouse|contextmenu)|click/,E=/^(?:focusinfocus|focusoutblur)$/,F=/^(\w*)(?:#([\w\-]+))?(?:\.([\w\-]+))?$/,G=function(a){var b=F.exec(a);b&&(b[1]=(b[1]||"").toLowerCase(),b[3]=b[3]&&new RegExp("(?:^|\\s)"+b[3]+"(?:\\s|$)"));return b},H=function(a,b){var c=a.attributes||{};return(!b[1]||a.nodeName.toLowerCase()===b[1])&&(!b[2]||(c.id||{}).value===b[2])&&(!b[3]||b[3].test((c["class"]||{}).value))},I=function(a){return f.event.special.hover?a:a.replace(B,"mouseenter$1 mouseleave$1")};
f.event={add:function(a,c,d,e,g){var h,i,j,k,l,m,n,o,p,q,r,s;if(!(a.nodeType===3||a.nodeType===8||!c||!d||!(h=f._data(a)))){d.handler&&(p=d,d=p.handler),d.guid||(d.guid=f.guid++),j=h.events,j||(h.events=j={}),i=h.handle,i||(h.handle=i=function(a){return typeof f!="undefined"&&(!a||f.event.triggered!==a.type)?f.event.dispatch.apply(i.elem,arguments):b},i.elem=a),c=f.trim(I(c)).split(" ");for(k=0;k<c.length;k++){l=A.exec(c[k])||[],m=l[1],n=(l[2]||"").split(".").sort(),s=f.event.special[m]||{},m=(g?s.delegateType:s.bindType)||m,s=f.event.special[m]||{},o=f.extend({type:m,origType:l[1],data:e,handler:d,guid:d.guid,selector:g,quick:G(g),namespace:n.join(".")},p),r=j[m];if(!r){r=j[m]=[],r.delegateCount=0;if(!s.setup||s.setup.call(a,e,n,i)===!1)a.addEventListener?a.addEventListener(m,i,!1):a.attachEvent&&a.attachEvent("on"+m,i)}s.add&&(s.add.call(a,o),o.handler.guid||(o.handler.guid=d.guid)),g?r.splice(r.delegateCount++,0,o):r.push(o),f.event.global[m]=!0}a=null}},global:{},remove:function(a,b,c,d,e){var g=f.hasData(a)&&f._data(a),h,i,j,k,l,m,n,o,p,q,r,s;if(!!g&&!!(o=g.events)){b=f.trim(I(b||"")).split(" ");for(h=0;h<b.length;h++){i=A.exec(b[h])||[],j=k=i[1],l=i[2];if(!j){for(j in o)f.event.remove(a,j+b[h],c,d,!0);continue}p=f.event.special[j]||{},j=(d?p.delegateType:p.bindType)||j,r=o[j]||[],m=r.length,l=l?new RegExp("(^|\\.)"+l.split(".").sort().join("\\.(?:.*\\.)?")+"(\\.|$)"):null;for(n=0;n<r.length;n++)s=r[n],(e||k===s.origType)&&(!c||c.guid===s.guid)&&(!l||l.test(s.namespace))&&(!d||d===s.selector||d==="**"&&s.selector)&&(r.splice(n--,1),s.selector&&r.delegateCount--,p.remove&&p.remove.call(a,s));r.length===0&&m!==r.length&&((!p.teardown||p.teardown.call(a,l)===!1)&&f.removeEvent(a,j,g.handle),delete o[j])}f.isEmptyObject(o)&&(q=g.handle,q&&(q.elem=null),f.removeData(a,["events","handle"],!0))}},customEvent:{getData:!0,setData:!0,changeData:!0},trigger:function(c,d,e,g){if(!e||e.nodeType!==3&&e.nodeType!==8){var h=c.type||c,i=[],j,k,l,m,n,o,p,q,r,s;if(E.test(h+f.event.triggered))return;h.indexOf("!")>=0&&(h=h.slice(0,-1),k=!0),h.indexOf(".")>=0&&(i=h.split("."),h=i.shift(),i.sort());if((!e||f.event.customEvent[h])&&!f.event.global[h])return;c=typeof c=="object"?c[f.expando]?c:new f.Event(h,c):new f.Event(h),c.type=h,c.isTrigger=!0,c.exclusive=k,c.namespace=i.join("."),c.namespace_re=c.namespace?new RegExp("(^|\\.)"+i.join("\\.(?:.*\\.)?")+"(\\.|$)"):null,o=h.indexOf(":")<0?"on"+h:"";if(!e){j=f.cache;for(l in j)j[l].events&&j[l].events[h]&&f.event.trigger(c,d,j[l].handle.elem,!0);return}c.result=b,c.target||(c.target=e),d=d!=null?f.makeArray(d):[],d.unshift(c),p=f.event.special[h]||{};if(p.trigger&&p.trigger.apply(e,d)===!1)return;r=[[e,p.bindType||h]];if(!g&&!p.noBubble&&!f.isWindow(e)){s=p.delegateType||h,m=E.test(s+h)?e:e.parentNode,n=null;for(;m;m=m.parentNode)r.push([m,s]),n=m;n&&n===e.ownerDocument&&r.push([n.defaultView||n.parentWindow||a,s])}for(l=0;l<r.length&&!c.isPropagationStopped();l++)m=r[l][0],c.type=r[l][1],q=(f._data(m,"events")||{})[c.type]&&f._data(m,"handle"),q&&q.apply(m,d),q=o&&m[o],q&&f.acceptData(m)&&q.apply(m,d)===!1&&c.preventDefault();c.type=h,!g&&!c.isDefaultPrevented()&&(!p._default||p._default.apply(e.ownerDocument,d)===!1)&&(h!=="click"||!f.nodeName(e,"a"))&&f.acceptData(e)&&o&&e[h]&&(h!=="focus"&&h!=="blur"||c.target.offsetWidth!==0)&&!f.isWindow(e)&&(n=e[o],n&&(e[o]=null),f.event.triggered=h,e[h](),f.event.triggered=b,n&&(e[o]=n));return c.result}},dispatch:function(c){c=f.event.fix(c||a.event);var d=(f._data(this,"events")||{})[c.type]||[],e=d.delegateCount,g=[].slice.call(arguments,0),h=!c.exclusive&&!c.namespace,i=[],j,k,l,m,n,o,p,q,r,s,t;g[0]=c,c.delegateTarget=this;if(e&&!c.target.disabled&&(!c.button||c.type!=="click")){m=f(this),m.context=this.ownerDocument||this;for(l=c.target;l!=this;l=l.parentNode||this){o={},q=[],m[0]=l;for(j=0;j<e;j++)r=d[j],s=r.selector,o[s]===b&&(o[s]=r.quick?H(l,r.quick):m.is(s)),o[s]&&q.push(r);q.length&&i.push({elem:l,matches:q})}}d.length>e&&i.push({elem:this,matches:d.slice(e)});for(j=0;j<i.length&&!c.isPropagationStopped();j++){p=i[j],c.currentTarget=p.elem;for(k=0;k<p.matches.length&&!c.isImmediatePropagationStopped();k++){r=p.matches[k];if(h||!c.namespace&&!r.namespace||c.namespace_re&&c.namespace_re.test(r.namespace))c.data=r.data,c.handleObj=r,n=((f.event.special[r.origType]||{}).handle||r.handler).apply(p.elem,g),n!==b&&(c.result=n,n===!1&&(c.preventDefault(),c.stopPropagation()))}}return c.result},props:"attrChange attrName relatedNode srcElement altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(a,b){a.which==null&&(a.which=b.charCode!=null?b.charCode:b.keyCode);return a}},mouseHooks:{props:"button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(a,d){var e,f,g,h=d.button,i=d.fromElement;a.pageX==null&&d.clientX!=null&&(e=a.target.ownerDocument||c,f=e.documentElement,g=e.body,a.pageX=d.clientX+(f&&f.scrollLeft||g&&g.scrollLeft||0)-(f&&f.clientLeft||g&&g.clientLeft||0),a.pageY=d.clientY+(f&&f.scrollTop||g&&g.scrollTop||0)-(f&&f.clientTop||g&&g.clientTop||0)),!a.relatedTarget&&i&&(a.relatedTarget=i===a.target?d.toElement:i),!a.which&&h!==b&&(a.which=h&1?1:h&2?3:h&4?2:0);return a}},fix:function(a){if(a[f.expando])return a;var d,e,g=a,h=f.event.fixHooks[a.type]||{},i=h.props?this.props.concat(h.props):this.props;a=f.Event(g);for(d=i.length;d;)e=i[--d],a[e]=g[e];a.target||(a.target=g.srcElement||c),a.target.nodeType===3&&(a.target=a.target.parentNode),a.metaKey===b&&(a.metaKey=a.ctrlKey);return h.filter?h.filter(a,g):a},special:{ready:{setup:f.bindReady},load:{noBubble:!0},focus:{delegateType:"focusin"},blur:{delegateType:"focusout"},beforeunload:{setup:function(a,b,c){f.isWindow(this)&&(this.onbeforeunload=c)},teardown:function(a,b){this.onbeforeunload===b&&(this.onbeforeunload=null)}}},simulate:function(a,b,c,d){var e=f.extend(new f.Event,c,{type:a,isSimulated:!0,originalEvent:{}});d?f.event.trigger(e,null,b):f.event.dispatch.call(b,e),e.isDefaultPrevented()&&c.preventDefault()}},f.event.handle=f.event.dispatch,f.removeEvent=c.removeEventListener?function(a,b,c){a.removeEventListener&&a.removeEventListener(b,c,!1)}:function(a,b,c){a.detachEvent&&a.detachEvent("on"+b,c)},f.Event=function(a,b){if(!(this instanceof f.Event))return new f.Event(a,b);a&&a.type?(this.originalEvent=a,this.type=a.type,this.isDefaultPrevented=a.defaultPrevented||a.returnValue===!1||a.getPreventDefault&&a.getPreventDefault()?K:J):this.type=a,b&&f.extend(this,b),this.timeStamp=a&&a.timeStamp||f.now(),this[f.expando]=!0},f.Event.prototype={preventDefault:function(){this.isDefaultPrevented=K;var a=this.originalEvent;!a||(a.preventDefault?a.preventDefault():a.returnValue=!1)},stopPropagation:function(){this.isPropagationStopped=K;var a=this.originalEvent;!a||(a.stopPropagation&&a.stopPropagation(),a.cancelBubble=!0)},stopImmediatePropagation:function(){this.isImmediatePropagationStopped=K,this.stopPropagation()},isDefaultPrevented:J,isPropagationStopped:J,isImmediatePropagationStopped:J},f.each({mouseenter:"mouseover",mouseleave:"mouseout"},function(a,b){f.event.special[a]={delegateType:b,bindType:b,handle:function(a){var c=this,d=a.relatedTarget,e=a.handleObj,g=e.selector,h;if(!d||d!==c&&!f.contains(c,d))a.type=e.origType,h=e.handler.apply(this,arguments),a.type=b;return h}}}),f.support.submitBubbles||(f.event.special.submit={setup:function(){if(f.nodeName(this,"form"))return!1;f.event.add(this,"click._submit keypress._submit",function(a){var c=a.target,d=f.nodeName(c,"input")||f.nodeName(c,"button")?c.form:b;d&&!d._submit_attached&&(f.event.add(d,"submit._submit",function(a){this.parentNode&&!a.isTrigger&&f.event.simulate("submit",this.parentNode,a,!0)}),d._submit_attached=!0)})},teardown:function(){if(f.nodeName(this,"form"))return!1;f.event.remove(this,"._submit")}}),f.support.changeBubbles||(f.event.special.change={setup:function(){if(z.test(this.nodeName)){if(this.type==="checkbox"||this.type==="radio")f.event.add(this,"propertychange._change",function(a){a.originalEvent.propertyName==="checked"&&(this._just_changed=!0)}),f.event.add(this,"click._change",function(a){this._just_changed&&!a.isTrigger&&(this._just_changed=!1,f.event.simulate("change",this,a,!0))});return!1}f.event.add(this,"beforeactivate._change",function(a){var b=a.target;z.test(b.nodeName)&&!b._change_attached&&(f.event.add(b,"change._change",function(a){this.parentNode&&!a.isSimulated&&!a.isTrigger&&f.event.simulate("change",this.parentNode,a,!0)}),b._change_attached=!0)})},handle:function(a){var b=a.target;if(this!==b||a.isSimulated||a.isTrigger||b.type!=="radio"&&b.type!=="checkbox")return a.handleObj.handler.apply(this,arguments)},teardown:function(){f.event.remove(this,"._change");return z.test(this.nodeName)}}),f.support.focusinBubbles||f.each({focus:"focusin",blur:"focusout"},function(a,b){var d=0,e=function(a){f.event.simulate(b,a.target,f.event.fix(a),!0)};f.event.special[b]={setup:function(){d++===0&&c.addEventListener(a,e,!0)},teardown:function(){--d===0&&c.removeEventListener(a,e,!0)}}}),f.fn.extend({on:function(a,c,d,e,g){var h,i;if(typeof a=="object"){typeof c!="string"&&(d=c,c=b);for(i in a)this.on(i,c,d,a[i],g);return this}d==null&&e==null?(e=c,d=c=b):e==null&&(typeof c=="string"?(e=d,d=b):(e=d,d=c,c=b));if(e===!1)e=J;else if(!e)return this;g===1&&(h=e,e=function(a){f().off(a);return h.apply(this,arguments)},e.guid=h.guid||(h.guid=f.guid++));return this.each(function(){f.event.add(this,a,e,d,c)})},one:function(a,b,c,d){return this.on.call(this,a,b,c,d,1)},off:function(a,c,d){if(a&&a.preventDefault&&a.handleObj){var e=a.handleObj;f(a.delegateTarget).off(e.namespace?e.type+"."+e.namespace:e.type,e.selector,e.handler);return this}if(typeof a=="object"){for(var g in a)this.off(g,c,a[g]);return this}if(c===!1||typeof c=="function")d=c,c=b;d===!1&&(d=J);return this.each(function(){f.event.remove(this,a,d,c)})},bind:function(a,b,c){return this.on(a,null,b,c)},unbind:function(a,b){return this.off(a,null,b)},live:function(a,b,c){f(this.context).on(a,this.selector,b,c);return this},die:function(a,b){f(this.context).off(a,this.selector||"**",b);return this},delegate:function(a,b,c,d){return this.on(b,a,c,d)},undelegate:function(a,b,c){return arguments.length==1?this.off(a,"**"):this.off(b,a,c)},trigger:function(a,b){return this.each(function(){f.event.trigger(a,b,this)})},triggerHandler:function(a,b){if(this[0])return f.event.trigger(a,b,this[0],!0)},toggle:function(a){var b=arguments,c=a.guid||f.guid++,d=0,e=function(c){var e=(f._data(this,"lastToggle"+a.guid)||0)%d;f._data(this,"lastToggle"+a.guid,e+1),c.preventDefault();return b[e].apply(this,arguments)||!1};e.guid=c;while(d<b.length)b[d++].guid=c;return this.click(e)},hover:function(a,b){return this.mouseenter(a).mouseleave(b||a)}}),f.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(a,b){f.fn[b]=function(a,c){c==null&&(c=a,a=null);return arguments.length>0?this.on(b,null,a,c):this.trigger(b)},f.attrFn&&(f.attrFn[b]=!0),C.test(b)&&(f.event.fixHooks[b]=f.event.keyHooks),D.test(b)&&(f.event.fixHooks[b]=f.event.mouseHooks)}),function(){function x(a,b,c,e,f,g){for(var h=0,i=e.length;h<i;h++){var j=e[h];if(j){var k=!1;j=j[a];while(j){if(j[d]===c){k=e[j.sizset];break}if(j.nodeType===1){g||(j[d]=c,j.sizset=h);if(typeof b!="string"){if(j===b){k=!0;break}}else if(m.filter(b,[j]).length>0){k=j;break}}j=j[a]}e[h]=k}}}function w(a,b,c,e,f,g){for(var h=0,i=e.length;h<i;h++){var j=e[h];if(j){var k=!1;j=j[a];while(j){if(j[d]===c){k=e[j.sizset];break}j.nodeType===1&&!g&&(j[d]=c,j.sizset=h);if(j.nodeName.toLowerCase()===b){k=j;break}j=j[a]}e[h]=k}}}var a=/((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^\[\]]*\]|['"][^'"]*['"]|[^\[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g,d="sizcache"+(Math.random()+"").replace(".",""),e=0,g=Object.prototype.toString,h=!1,i=!0,j=/\\/g,k=/\r\n/g,l=/\W/;[0,0].sort(function(){i=!1;return 0});var m=function(b,d,e,f){e=e||[],d=d||c;var h=d;if(d.nodeType!==1&&d.nodeType!==9)return[];if(!b||typeof b!="string")return e;var i,j,k,l,n,q,r,t,u=!0,v=m.isXML(d),w=[],x=b;do{a.exec(""),i=a.exec(x);if(i){x=i[3],w.push(i[1]);if(i[2]){l=i[3];break}}}while(i);if(w.length>1&&p.exec(b))if(w.length===2&&o.relative[w[0]])j=y(w[0]+w[1],d,f);else{j=o.relative[w[0]]?[d]:m(w.shift(),d);while(w.length)b=w.shift(),o.relative[b]&&(b+=w.shift()),j=y(b,j,f)}else{!f&&w.length>1&&d.nodeType===9&&!v&&o.match.ID.test(w[0])&&!o.match.ID.test(w[w.length-1])&&(n=m.find(w.shift(),d,v),d=n.expr?m.filter(n.expr,n.set)[0]:n.set[0]);if(d){n=f?{expr:w.pop(),set:s(f)}:m.find(w.pop(),w.length===1&&(w[0]==="~"||w[0]==="+")&&d.parentNode?d.parentNode:d,v),j=n.expr?m.filter(n.expr,n.set):n.set,w.length>0?k=s(j):u=!1;while(w.length)q=w.pop(),r=q,o.relative[q]?r=w.pop():q="",r==null&&(r=d),o.relative[q](k,r,v)}else k=w=[]}k||(k=j),k||m.error(q||b);if(g.call(k)==="[object Array]")if(!u)e.push.apply(e,k);else if(d&&d.nodeType===1)for(t=0;k[t]!=null;t++)k[t]&&(k[t]===!0||k[t].nodeType===1&&m.contains(d,k[t]))&&e.push(j[t]);else for(t=0;k[t]!=null;t++)k[t]&&k[t].nodeType===1&&e.push(j[t]);else s(k,e);l&&(m(l,h,e,f),m.uniqueSort(e));return e};m.uniqueSort=function(a){if(u){h=i,a.sort(u);if(h)for(var b=1;b<a.length;b++)a[b]===a[b-1]&&a.splice(b--,1)}return a},m.matches=function(a,b){return m(a,null,null,b)},m.matchesSelector=function(a,b){return m(b,null,null,[a]).length>0},m.find=function(a,b,c){var d,e,f,g,h,i;if(!a)return[];for(e=0,f=o.order.length;e<f;e++){h=o.order[e];if(g=o.leftMatch[h].exec(a)){i=g[1],g.splice(1,1);if(i.substr(i.length-1)!=="\\"){g[1]=(g[1]||"").replace(j,""),d=o.find[h](g,b,c);if(d!=null){a=a.replace(o.match[h],"");break}}}}d||(d=typeof b.getElementsByTagName!="undefined"?b.getElementsByTagName("*"):[]);return{set:d,expr:a}},m.filter=function(a,c,d,e){var f,g,h,i,j,k,l,n,p,q=a,r=[],s=c,t=c&&c[0]&&m.isXML(c[0]);while(a&&c.length){for(h in o.filter)if((f=o.leftMatch[h].exec(a))!=null&&f[2]){k=o.filter[h],l=f[1],g=!1,f.splice(1,1);if(l.substr(l.length-1)==="\\")continue;s===r&&(r=[]);if(o.preFilter[h]){f=o.preFilter[h](f,s,d,r,e,t);if(!f)g=i=!0;else if(f===!0)continue}if(f)for(n=0;(j=s[n])!=null;n++)j&&(i=k(j,f,n,s),p=e^i,d&&i!=null?p?g=!0:s[n]=!1:p&&(r.push(j),g=!0));if(i!==b){d||(s=r),a=a.replace(o.match[h],"");if(!g)return[];break}}if(a===q)if(g==null)m.error(a);else break;q=a}return s},m.error=function(a){throw new Error("Syntax error, unrecognized expression: "+a)};var n=m.getText=function(a){var b,c,d=a.nodeType,e="";if(d){if(d===1||d===9){if(typeof a.textContent=="string")return a.textContent;if(typeof a.innerText=="string")return a.innerText.replace(k,"");for(a=a.firstChild;a;a=a.nextSibling)e+=n(a)}else if(d===3||d===4)return a.nodeValue}else for(b=0;c=a[b];b++)c.nodeType!==8&&(e+=n(c));return e},o=m.selectors={order:["ID","NAME","TAG"],match:{ID:/#((?:[\w\u00c0-\uFFFF\-]|\\.)+)/,CLASS:/\.((?:[\w\u00c0-\uFFFF\-]|\\.)+)/,NAME:/\[name=['"]*((?:[\w\u00c0-\uFFFF\-]|\\.)+)['"]*\]/,ATTR:/\[\s*((?:[\w\u00c0-\uFFFF\-]|\\.)+)\s*(?:(\S?=)\s*(?:(['"])(.*?)\3|(#?(?:[\w\u00c0-\uFFFF\-]|\\.)*)|)|)\s*\]/,TAG:/^((?:[\w\u00c0-\uFFFF\*\-]|\\.)+)/,CHILD:/:(only|nth|last|first)-child(?:\(\s*(even|odd|(?:[+\-]?\d+|(?:[+\-]?\d*)?n\s*(?:[+\-]\s*\d+)?))\s*\))?/,POS:/:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^\-]|$)/,PSEUDO:/:((?:[\w\u00c0-\uFFFF\-]|\\.)+)(?:\((['"]?)((?:\([^\)]+\)|[^\(\)]*)+)\2\))?/},leftMatch:{},attrMap:{"class":"className","for":"htmlFor"},attrHandle:{href:function(a){return a.getAttribute("href")},type:function(a){return a.getAttribute("type")}},relative:{"+":function(a,b){var c=typeof b=="string",d=c&&!l.test(b),e=c&&!d;d&&(b=b.toLowerCase());for(var f=0,g=a.length,h;f<g;f++)if(h=a[f]){while((h=h.previousSibling)&&h.nodeType!==1);a[f]=e||h&&h.nodeName.toLowerCase()===b?h||!1:h===b}e&&m.filter(b,a,!0)},">":function(a,b){var c,d=typeof b=="string",e=0,f=a.length;if(d&&!l.test(b)){b=b.toLowerCase();for(;e<f;e++){c=a[e];if(c){var g=c.parentNode;a[e]=g.nodeName.toLowerCase()===b?g:!1}}}else{for(;e<f;e++)c=a[e],c&&(a[e]=d?c.parentNode:c.parentNode===b);d&&m.filter(b,a,!0)}},"":function(a,b,c){var d,f=e++,g=x;typeof b=="string"&&!l.test(b)&&(b=b.toLowerCase(),d=b,g=w),g("parentNode",b,f,a,d,c)},"~":function(a,b,c){var d,f=e++,g=x;typeof b=="string"&&!l.test(b)&&(b=b.toLowerCase(),d=b,g=w),g("previousSibling",b,f,a,d,c)}},find:{ID:function(a,b,c){if(typeof b.getElementById!="undefined"&&!c){var d=b.getElementById(a[1]);return d&&d.parentNode?[d]:[]}},NAME:function(a,b){if(typeof b.getElementsByName!="undefined"){var c=[],d=b.getElementsByName(a[1]);for(var e=0,f=d.length;e<f;e++)d[e].getAttribute("name")===a[1]&&c.push(d[e]);return c.length===0?null:c}},TAG:function(a,b){if(typeof b.getElementsByTagName!="undefined")return b.getElementsByTagName(a[1])}},preFilter:{CLASS:function(a,b,c,d,e,f){a=" "+a[1].replace(j,"")+" ";if(f)return a;for(var g=0,h;(h=b[g])!=null;g++)h&&(e^(h.className&&(" "+h.className+" ").replace(/[\t\n\r]/g," ").indexOf(a)>=0)?c||d.push(h):c&&(b[g]=!1));return!1},ID:function(a){return a[1].replace(j,"")},TAG:function(a,b){return a[1].replace(j,"").toLowerCase()},CHILD:function(a){if(a[1]==="nth"){a[2]||m.error(a[0]),a[2]=a[2].replace(/^\+|\s*/g,"");var b=/(-?)(\d*)(?:n([+\-]?\d*))?/.exec(a[2]==="even"&&"2n"||a[2]==="odd"&&"2n+1"||!/\D/.test(a[2])&&"0n+"+a[2]||a[2]);a[2]=b[1]+(b[2]||1)-0,a[3]=b[3]-0}else a[2]&&m.error(a[0]);a[0]=e++;return a},ATTR:function(a,b,c,d,e,f){var g=a[1]=a[1].replace(j,"");!f&&o.attrMap[g]&&(a[1]=o.attrMap[g]),a[4]=(a[4]||a[5]||"").replace(j,""),a[2]==="~="&&(a[4]=" "+a[4]+" ");return a},PSEUDO:function(b,c,d,e,f){if(b[1]==="not")if((a.exec(b[3])||"").length>1||/^\w/.test(b[3]))b[3]=m(b[3],null,null,c);else{var g=m.filter(b[3],c,d,!0^f);d||e.push.apply(e,g);return!1}else if(o.match.POS.test(b[0])||o.match.CHILD.test(b[0]))return!0;return b},POS:function(a){a.unshift(!0);return a}},filters:{enabled:function(a){return a.disabled===!1&&a.type!=="hidden"},disabled:function(a){return a.disabled===!0},checked:function(a){return a.checked===!0},selected:function(a){a.parentNode&&a.parentNode.selectedIndex;return a.selected===!0},parent:function(a){return!!a.firstChild},empty:function(a){return!a.firstChild},has:function(a,b,c){return!!m(c[3],a).length},header:function(a){return/h\d/i.test(a.nodeName)},text:function(a){var b=a.getAttribute("type"),c=a.type;return a.nodeName.toLowerCase()==="input"&&"text"===c&&(b===c||b===null)},radio:function(a){return a.nodeName.toLowerCase()==="input"&&"radio"===a.type},checkbox:function(a){return a.nodeName.toLowerCase()==="input"&&"checkbox"===a.type},file:function(a){return a.nodeName.toLowerCase()==="input"&&"file"===a.type},password:function(a){return a.nodeName.toLowerCase()==="input"&&"password"===a.type},submit:function(a){var b=a.nodeName.toLowerCase();return(b==="input"||b==="button")&&"submit"===a.type},image:function(a){return a.nodeName.toLowerCase()==="input"&&"image"===a.type},reset:function(a){var b=a.nodeName.toLowerCase();return(b==="input"||b==="button")&&"reset"===a.type},button:function(a){var b=a.nodeName.toLowerCase();return b==="input"&&"button"===a.type||b==="button"},input:function(a){return/input|select|textarea|button/i.test(a.nodeName)},focus:function(a){return a===a.ownerDocument.activeElement}},setFilters:{first:function(a,b){return b===0},last:function(a,b,c,d){return b===d.length-1},even:function(a,b){return b%2===0},odd:function(a,b){return b%2===1},lt:function(a,b,c){return b<c[3]-0},gt:function(a,b,c){return b>c[3]-0},nth:function(a,b,c){return c[3]-0===b},eq:function(a,b,c){return c[3]-0===b}},filter:{PSEUDO:function(a,b,c,d){var e=b[1],f=o.filters[e];if(f)return f(a,c,b,d);if(e==="contains")return(a.textContent||a.innerText||n([a])||"").indexOf(b[3])>=0;if(e==="not"){var g=b[3];for(var h=0,i=g.length;h<i;h++)if(g[h]===a)return!1;return!0}m.error(e)},CHILD:function(a,b){var c,e,f,g,h,i,j,k=b[1],l=a;switch(k){case"only":case"first":while(l=l.previousSibling)if(l.nodeType===1)return!1;if(k==="first")return!0;l=a;case"last":while(l=l.nextSibling)if(l.nodeType===1)return!1;return!0;case"nth":c=b[2],e=b[3];if(c===1&&e===0)return!0;f=b[0],g=a.parentNode;if(g&&(g[d]!==f||!a.nodeIndex)){i=0;for(l=g.firstChild;l;l=l.nextSibling)l.nodeType===1&&(l.nodeIndex=++i);g[d]=f}j=a.nodeIndex-e;return c===0?j===0:j%c===0&&j/c>=0}},ID:function(a,b){return a.nodeType===1&&a.getAttribute("id")===b},TAG:function(a,b){return b==="*"&&a.nodeType===1||!!a.nodeName&&a.nodeName.toLowerCase()===b},CLASS:function(a,b){return(" "+(a.className||a.getAttribute("class"))+" ").indexOf(b)>-1},ATTR:function(a,b){var c=b[1],d=m.attr?m.attr(a,c):o.attrHandle[c]?o.attrHandle[c](a):a[c]!=null?a[c]:a.getAttribute(c),e=d+"",f=b[2],g=b[4];return d==null?f==="!=":!f&&m.attr?d!=null:f==="="?e===g:f==="*="?e.indexOf(g)>=0:f==="~="?(" "+e+" ").indexOf(g)>=0:g?f==="!="?e!==g:f==="^="?e.indexOf(g)===0:f==="$="?e.substr(e.length-g.length)===g:f==="|="?e===g||e.substr(0,g.length+1)===g+"-":!1:e&&d!==!1},POS:function(a,b,c,d){var e=b[2],f=o.setFilters[e];if(f)return f(a,c,b,d)}}},p=o.match.POS,q=function(a,b){return"\\"+(b-0+1)};for(var r in o.match)o.match[r]=new RegExp(o.match[r].source+/(?![^\[]*\])(?![^\(]*\))/.source),o.leftMatch[r]=new RegExp(/(^(?:.|\r|\n)*?)/.source+o.match[r].source.replace(/\\(\d+)/g,q));var s=function(a,b){a=Array.prototype.slice.call(a,0);if(b){b.push.apply(b,a);return b}return a};try{Array.prototype.slice.call(c.documentElement.childNodes,0)[0].nodeType}catch(t){s=function(a,b){var c=0,d=b||[];if(g.call(a)==="[object Array]")Array.prototype.push.apply(d,a);else if(typeof a.length=="number")for(var e=a.length;c<e;c++)d.push(a[c]);else for(;a[c];c++)d.push(a[c]);return d}}var u,v;c.documentElement.compareDocumentPosition?u=function(a,b){if(a===b){h=!0;return 0}if(!a.compareDocumentPosition||!b.compareDocumentPosition)return a.compareDocumentPosition?-1:1;return a.compareDocumentPosition(b)&4?-1:1}:(u=function(a,b){if(a===b){h=!0;return 0}if(a.sourceIndex&&b.sourceIndex)return a.sourceIndex-b.sourceIndex;var c,d,e=[],f=[],g=a.parentNode,i=b.parentNode,j=g;if(g===i)return v(a,b);if(!g)return-1;if(!i)return 1;while(j)e.unshift(j),j=j.parentNode;j=i;while(j)f.unshift(j),j=j.parentNode;c=e.length,d=f.length;for(var k=0;k<c&&k<d;k++)if(e[k]!==f[k])return v(e[k],f[k]);return k===c?v(a,f[k],-1):v(e[k],b,1)},v=function(a,b,c){if(a===b)return c;var d=a.nextSibling;while(d){if(d===b)return-1;d=d.nextSibling}return 1}),function(){var a=c.createElement("div"),d="script"+(new Date).getTime(),e=c.documentElement;a.innerHTML="<a name='"+d+"'/>",e.insertBefore(a,e.firstChild),c.getElementById(d)&&(o.find.ID=function(a,c,d){if(typeof c.getElementById!="undefined"&&!d){var e=c.getElementById(a[1]);return e?e.id===a[1]||typeof e.getAttributeNode!="undefined"&&e.getAttributeNode("id").nodeValue===a[1]?[e]:b:[]}},o.filter.ID=function(a,b){var c=typeof a.getAttributeNode!="undefined"&&a.getAttributeNode("id");return a.nodeType===1&&c&&c.nodeValue===b}),e.removeChild(a),e=a=null}(),function(){var a=c.createElement("div");a.appendChild(c.createComment("")),a.getElementsByTagName("*").length>0&&(o.find.TAG=function(a,b){var c=b.getElementsByTagName(a[1]);if(a[1]==="*"){var d=[];for(var e=0;c[e];e++)c[e].nodeType===1&&d.push(c[e]);c=d}return c}),a.innerHTML="<a href='#'></a>",a.firstChild&&typeof a.firstChild.getAttribute!="undefined"&&a.firstChild.getAttribute("href")!=="#"&&(o.attrHandle.href=function(a){return a.getAttribute("href",2)}),a=null}(),c.querySelectorAll&&function(){var a=m,b=c.createElement("div"),d="__sizzle__";b.innerHTML="<p class='TEST'></p>";if(!b.querySelectorAll||b.querySelectorAll(".TEST").length!==0){m=function(b,e,f,g){e=e||c;if(!g&&!m.isXML(e)){var h=/^(\w+$)|^\.([\w\-]+$)|^#([\w\-]+$)/.exec(b);if(h&&(e.nodeType===1||e.nodeType===9)){if(h[1])return s(e.getElementsByTagName(b),f);if(h[2]&&o.find.CLASS&&e.getElementsByClassName)return s(e.getElementsByClassName(h[2]),f)}if(e.nodeType===9){if(b==="body"&&e.body)return s([e.body],f);if(h&&h[3]){var i=e.getElementById(h[3]);if(!i||!i.parentNode)return s([],f);if(i.id===h[3])return s([i],f)}try{return s(e.querySelectorAll(b),f)}catch(j){}}else if(e.nodeType===1&&e.nodeName.toLowerCase()!=="object"){var k=e,l=e.getAttribute("id"),n=l||d,p=e.parentNode,q=/^\s*[+~]/.test(b);l?n=n.replace(/'/g,"\\$&"):e.setAttribute("id",n),q&&p&&(e=e.parentNode);try{if(!q||p)return s(e.querySelectorAll("[id='"+n+"'] "+b),f)}catch(r){}finally{l||k.removeAttribute("id")}}}return a(b,e,f,g)};for(var e in a)m[e]=a[e];b=null}}(),function(){var a=c.documentElement,b=a.matchesSelector||a.mozMatchesSelector||a.webkitMatchesSelector||a.msMatchesSelector;if(b){var d=!b.call(c.createElement("div"),"div"),e=!1;try{b.call(c.documentElement,"[test!='']:sizzle")}catch(f){e=!0}m.matchesSelector=function(a,c){c=c.replace(/\=\s*([^'"\]]*)\s*\]/g,"='$1']");if(!m.isXML(a))try{if(e||!o.match.PSEUDO.test(c)&&!/!=/.test(c)){var f=b.call(a,c);if(f||!d||a.document&&a.document.nodeType!==11)return f}}catch(g){}return m(c,null,null,[a]).length>0}}}(),function(){var a=c.createElement("div");a.innerHTML="<div class='test e'></div><div class='test'></div>";if(!!a.getElementsByClassName&&a.getElementsByClassName("e").length!==0){a.lastChild.className="e";if(a.getElementsByClassName("e").length===1)return;o.order.splice(1,0,"CLASS"),o.find.CLASS=function(a,b,c){if(typeof b.getElementsByClassName!="undefined"&&!c)return b.getElementsByClassName(a[1])},a=null}}(),c.documentElement.contains?m.contains=function(a,b){return a!==b&&(a.contains?a.contains(b):!0)}:c.documentElement.compareDocumentPosition?m.contains=function(a,b){return!!(a.compareDocumentPosition(b)&16)}:m.contains=function(){return!1},m.isXML=function(a){var b=(a?a.ownerDocument||a:0).documentElement;return b?b.nodeName!=="HTML":!1};var y=function(a,b,c){var d,e=[],f="",g=b.nodeType?[b]:b;while(d=o.match.PSEUDO.exec(a))f+=d[0],a=a.replace(o.match.PSEUDO,"");a=o.relative[a]?a+"*":a;for(var h=0,i=g.length;h<i;h++)m(a,g[h],e,c);return m.filter(f,e)};m.attr=f.attr,m.selectors.attrMap={},f.find=m,f.expr=m.selectors,f.expr[":"]=f.expr.filters,f.unique=m.uniqueSort,f.text=m.getText,f.isXMLDoc=m.isXML,f.contains=m.contains}();var L=/Until$/,M=/^(?:parents|prevUntil|prevAll)/,N=/,/,O=/^.[^:#\[\.,]*$/,P=Array.prototype.slice,Q=f.expr.match.POS,R={children:!0,contents:!0,next:!0,prev:!0};f.fn.extend({find:function(a){var b=this,c,d;if(typeof a!="string")return f(a).filter(function(){for(c=0,d=b.length;c<d;c++)if(f.contains(b[c],this))return!0});var e=this.pushStack("","find",a),g,h,i;for(c=0,d=this.length;c<d;c++){g=e.length,f.find(a,this[c],e);if(c>0)for(h=g;h<e.length;h++)for(i=0;i<g;i++)if(e[i]===e[h]){e.splice(h--,1);break}}return e},has:function(a){var b=f(a);return this.filter(function(){for(var a=0,c=b.length;a<c;a++)if(f.contains(this,b[a]))return!0})},not:function(a){return this.pushStack(T(this,a,!1),"not",a)},filter:function(a){return this.pushStack(T(this,a,!0),"filter",a)},is:function(a){return!!a&&(typeof a=="string"?Q.test(a)?f(a,this.context).index(this[0])>=0:f.filter(a,this).length>0:this.filter(a).length>0)},closest:function(a,b){var c=[],d,e,g=this[0];if(f.isArray(a)){var h=1;while(g&&g.ownerDocument&&g!==b){for(d=0;d<a.length;d++)f(g).is(a[d])&&c.push({selector:a[d],elem:g,level:h});g=g.parentNode,h++}return c}var i=Q.test(a)||typeof a!="string"?f(a,b||this.context):0;for(d=0,e=this.length;d<e;d++){g=this[d];while(g){if(i?i.index(g)>-1:f.find.matchesSelector(g,a)){c.push(g);break}g=g.parentNode;if(!g||!g.ownerDocument||g===b||g.nodeType===11)break}}c=c.length>1?f.unique(c):c;return this.pushStack(c,"closest",a)},index:function(a){if(!a)return this[0]&&this[0].parentNode?this.prevAll().length:-1;if(typeof a=="string")return f.inArray(this[0],f(a));return f.inArray(a.jquery?a[0]:a,this)},add:function(a,b){var c=typeof a=="string"?f(a,b):f.makeArray(a&&a.nodeType?[a]:a),d=f.merge(this.get(),c);return this.pushStack(S(c[0])||S(d[0])?d:f.unique(d))},andSelf:function(){return this.add(this.prevObject)}}),f.each({parent:function(a){var b=a.parentNode;return b&&b.nodeType!==11?b:null},parents:function(a){return f.dir(a,"parentNode")},parentsUntil:function(a,b,c){return f.dir(a,"parentNode",c)},next:function(a){return f.nth(a,2,"nextSibling")},prev:function(a){return f.nth(a,2,"previousSibling")},nextAll:function(a){return f.dir(a,"nextSibling")},prevAll:function(a){return f.dir(a,"previousSibling")},nextUntil:function(a,b,c){return f.dir(a,"nextSibling",c)},prevUntil:function(a,b,c){return f.dir(a,"previousSibling",c)},siblings:function(a){return f.sibling(a.parentNode.firstChild,a)},children:function(a){return f.sibling(a.firstChild)},contents:function(a){return f.nodeName(a,"iframe")?a.contentDocument||a.contentWindow.document:f.makeArray(a.childNodes)}},function(a,b){f.fn[a]=function(c,d){var e=f.map(this,b,c);L.test(a)||(d=c),d&&typeof d=="string"&&(e=f.filter(d,e)),e=this.length>1&&!R[a]?f.unique(e):e,(this.length>1||N.test(d))&&M.test(a)&&(e=e.reverse());return this.pushStack(e,a,P.call(arguments).join(","))}}),f.extend({filter:function(a,b,c){c&&(a=":not("+a+")");return b.length===1?f.find.matchesSelector(b[0],a)?[b[0]]:[]:f.find.matches(a,b)},dir:function(a,c,d){var e=[],g=a[c];while(g&&g.nodeType!==9&&(d===b||g.nodeType!==1||!f(g).is(d)))g.nodeType===1&&e.push(g),g=g[c];return e},nth:function(a,b,c,d){b=b||1;var e=0;for(;a;a=a[c])if(a.nodeType===1&&++e===b)break;return a},sibling:function(a,b){var c=[];for(;a;a=a.nextSibling)a.nodeType===1&&a!==b&&c.push(a);return c}});var V="abbr|article|aside|audio|canvas|datalist|details|figcaption|figure|footer|header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",W=/ jQuery\d+="(?:\d+|null)"/g,X=/^\s+/,Y=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,Z=/<([\w:]+)/,$=/<tbody/i,_=/<|&#?\w+;/,ba=/<(?:script|style)/i,bb=/<(?:script|object|embed|option|style)/i,bc=new RegExp("<(?:"+V+")","i"),bd=/checked\s*(?:[^=]|=\s*.checked.)/i,be=/\/(java|ecma)script/i,bf=/^\s*<!(?:\[CDATA\[|\-\-)/,bg={option:[1,"<select multiple='multiple'>","</select>"],legend:[1,"<fieldset>","</fieldset>"],thead:[1,"<table>","</table>"],tr:[2,"<table><tbody>","</tbody></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],col:[2,"<table><tbody></tbody><colgroup>","</colgroup></table>"],area:[1,"<map>","</map>"],_default:[0,"",""]},bh=U(c);bg.optgroup=bg.option,bg.tbody=bg.tfoot=bg.colgroup=bg.caption=bg.thead,bg.th=bg.td,f.support.htmlSerialize||(bg._default=[1,"div<div>","</div>"]),f.fn.extend({text:function(a){if(f.isFunction(a))return this.each(function(b){var c=f(this);c.text(a.call(this,b,c.text()))});if(typeof a!="object"&&a!==b)return this.empty().append((this[0]&&this[0].ownerDocument||c).createTextNode(a));return f.text(this)},wrapAll:function(a){if(f.isFunction(a))return this.each(function(b){f(this).wrapAll(a.call(this,b))});if(this[0]){var b=f(a,this[0].ownerDocument).eq(0).clone(!0);this[0].parentNode&&b.insertBefore(this[0]),b.map(function(){var a=this;while(a.firstChild&&a.firstChild.nodeType===1)a=a.firstChild;return a}).append(this)}return this},wrapInner:function(a){if(f.isFunction(a))return this.each(function(b){f(this).wrapInner(a.call(this,b))});return this.each(function(){var b=f(this),c=b.contents();c.length?c.wrapAll(a):b.append(a)})},wrap:function(a){var b=f.isFunction(a);return this.each(function(c){f(this).wrapAll(b?a.call(this,c):a)})},unwrap:function(){return this.parent().each(function(){f.nodeName(this,"body")||f(this).replaceWith(this.childNodes)}).end()},append:function(){return this.domManip(arguments,!0,function(a){this.nodeType===1&&this.appendChild(a)})},prepend:function(){return this.domManip(arguments,!0,function(a){this.nodeType===1&&this.insertBefore(a,this.firstChild)})},before:function(){if(this[0]&&this[0].parentNode)return this.domManip(arguments,!1,function(a){this.parentNode.insertBefore(a,this)});if(arguments.length){var a=f.clean(arguments);a.push.apply(a,this.toArray());return this.pushStack(a,"before",arguments)}},after:function(){if(this[0]&&this[0].parentNode)return this.domManip(arguments,!1,function(a){this.parentNode.insertBefore(a,this.nextSibling)});if(arguments.length){var a=this.pushStack(this,"after",arguments);a.push.apply(a,f.clean(arguments));return a}},remove:function(a,b){for(var c=0,d;(d=this[c])!=null;c++)if(!a||f.filter(a,[d]).length)!b&&d.nodeType===1&&(f.cleanData(d.getElementsByTagName("*")),f.cleanData([d])),d.parentNode&&d.parentNode.removeChild(d);return this},empty:function()
{for(var a=0,b;(b=this[a])!=null;a++){b.nodeType===1&&f.cleanData(b.getElementsByTagName("*"));while(b.firstChild)b.removeChild(b.firstChild)}return this},clone:function(a,b){a=a==null?!1:a,b=b==null?a:b;return this.map(function(){return f.clone(this,a,b)})},html:function(a){if(a===b)return this[0]&&this[0].nodeType===1?this[0].innerHTML.replace(W,""):null;if(typeof a=="string"&&!ba.test(a)&&(f.support.leadingWhitespace||!X.test(a))&&!bg[(Z.exec(a)||["",""])[1].toLowerCase()]){a=a.replace(Y,"<$1></$2>");try{for(var c=0,d=this.length;c<d;c++)this[c].nodeType===1&&(f.cleanData(this[c].getElementsByTagName("*")),this[c].innerHTML=a)}catch(e){this.empty().append(a)}}else f.isFunction(a)?this.each(function(b){var c=f(this);c.html(a.call(this,b,c.html()))}):this.empty().append(a);return this},replaceWith:function(a){if(this[0]&&this[0].parentNode){if(f.isFunction(a))return this.each(function(b){var c=f(this),d=c.html();c.replaceWith(a.call(this,b,d))});typeof a!="string"&&(a=f(a).detach());return this.each(function(){var b=this.nextSibling,c=this.parentNode;f(this).remove(),b?f(b).before(a):f(c).append(a)})}return this.length?this.pushStack(f(f.isFunction(a)?a():a),"replaceWith",a):this},detach:function(a){return this.remove(a,!0)},domManip:function(a,c,d){var e,g,h,i,j=a[0],k=[];if(!f.support.checkClone&&arguments.length===3&&typeof j=="string"&&bd.test(j))return this.each(function(){f(this).domManip(a,c,d,!0)});if(f.isFunction(j))return this.each(function(e){var g=f(this);a[0]=j.call(this,e,c?g.html():b),g.domManip(a,c,d)});if(this[0]){i=j&&j.parentNode,f.support.parentNode&&i&&i.nodeType===11&&i.childNodes.length===this.length?e={fragment:i}:e=f.buildFragment(a,this,k),h=e.fragment,h.childNodes.length===1?g=h=h.firstChild:g=h.firstChild;if(g){c=c&&f.nodeName(g,"tr");for(var l=0,m=this.length,n=m-1;l<m;l++)d.call(c?bi(this[l],g):this[l],e.cacheable||m>1&&l<n?f.clone(h,!0,!0):h)}k.length&&f.each(k,bp)}return this}}),f.buildFragment=function(a,b,d){var e,g,h,i,j=a[0];b&&b[0]&&(i=b[0].ownerDocument||b[0]),i.createDocumentFragment||(i=c),a.length===1&&typeof j=="string"&&j.length<512&&i===c&&j.charAt(0)==="<"&&!bb.test(j)&&(f.support.checkClone||!bd.test(j))&&(f.support.html5Clone||!bc.test(j))&&(g=!0,h=f.fragments[j],h&&h!==1&&(e=h)),e||(e=i.createDocumentFragment(),f.clean(a,i,e,d)),g&&(f.fragments[j]=h?e:1);return{fragment:e,cacheable:g}},f.fragments={},f.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(a,b){f.fn[a]=function(c){var d=[],e=f(c),g=this.length===1&&this[0].parentNode;if(g&&g.nodeType===11&&g.childNodes.length===1&&e.length===1){e[b](this[0]);return this}for(var h=0,i=e.length;h<i;h++){var j=(h>0?this.clone(!0):this).get();f(e[h])[b](j),d=d.concat(j)}return this.pushStack(d,a,e.selector)}}),f.extend({clone:function(a,b,c){var d,e,g,h=f.support.html5Clone||!bc.test("<"+a.nodeName)?a.cloneNode(!0):bo(a);if((!f.support.noCloneEvent||!f.support.noCloneChecked)&&(a.nodeType===1||a.nodeType===11)&&!f.isXMLDoc(a)){bk(a,h),d=bl(a),e=bl(h);for(g=0;d[g];++g)e[g]&&bk(d[g],e[g])}if(b){bj(a,h);if(c){d=bl(a),e=bl(h);for(g=0;d[g];++g)bj(d[g],e[g])}}d=e=null;return h},clean:function(a,b,d,e){var g;b=b||c,typeof b.createElement=="undefined"&&(b=b.ownerDocument||b[0]&&b[0].ownerDocument||c);var h=[],i;for(var j=0,k;(k=a[j])!=null;j++){typeof k=="number"&&(k+="");if(!k)continue;if(typeof k=="string")if(!_.test(k))k=b.createTextNode(k);else{k=k.replace(Y,"<$1></$2>");var l=(Z.exec(k)||["",""])[1].toLowerCase(),m=bg[l]||bg._default,n=m[0],o=b.createElement("div");b===c?bh.appendChild(o):U(b).appendChild(o),o.innerHTML=m[1]+k+m[2];while(n--)o=o.lastChild;if(!f.support.tbody){var p=$.test(k),q=l==="table"&&!p?o.firstChild&&o.firstChild.childNodes:m[1]==="<table>"&&!p?o.childNodes:[];for(i=q.length-1;i>=0;--i)f.nodeName(q[i],"tbody")&&!q[i].childNodes.length&&q[i].parentNode.removeChild(q[i])}!f.support.leadingWhitespace&&X.test(k)&&o.insertBefore(b.createTextNode(X.exec(k)[0]),o.firstChild),k=o.childNodes}var r;if(!f.support.appendChecked)if(k[0]&&typeof (r=k.length)=="number")for(i=0;i<r;i++)bn(k[i]);else bn(k);k.nodeType?h.push(k):h=f.merge(h,k)}if(d){g=function(a){return!a.type||be.test(a.type)};for(j=0;h[j];j++)if(e&&f.nodeName(h[j],"script")&&(!h[j].type||h[j].type.toLowerCase()==="text/javascript"))e.push(h[j].parentNode?h[j].parentNode.removeChild(h[j]):h[j]);else{if(h[j].nodeType===1){var s=f.grep(h[j].getElementsByTagName("script"),g);h.splice.apply(h,[j+1,0].concat(s))}d.appendChild(h[j])}}return h},cleanData:function(a){var b,c,d=f.cache,e=f.event.special,g=f.support.deleteExpando;for(var h=0,i;(i=a[h])!=null;h++){if(i.nodeName&&f.noData[i.nodeName.toLowerCase()])continue;c=i[f.expando];if(c){b=d[c];if(b&&b.events){for(var j in b.events)e[j]?f.event.remove(i,j):f.removeEvent(i,j,b.handle);b.handle&&(b.handle.elem=null)}g?delete i[f.expando]:i.removeAttribute&&i.removeAttribute(f.expando),delete d[c]}}}});var bq=/alpha\([^)]*\)/i,br=/opacity=([^)]*)/,bs=/([A-Z]|^ms)/g,bt=/^-?\d+(?:px)?$/i,bu=/^-?\d/,bv=/^([\-+])=([\-+.\de]+)/,bw={position:"absolute",visibility:"hidden",display:"block"},bx=["Left","Right"],by=["Top","Bottom"],bz,bA,bB;f.fn.css=function(a,c){if(arguments.length===2&&c===b)return this;return f.access(this,a,c,!0,function(a,c,d){return d!==b?f.style(a,c,d):f.css(a,c)})},f.extend({cssHooks:{opacity:{get:function(a,b){if(b){var c=bz(a,"opacity","opacity");return c===""?"1":c}return a.style.opacity}}},cssNumber:{fillOpacity:!0,fontWeight:!0,lineHeight:!0,opacity:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":f.support.cssFloat?"cssFloat":"styleFloat"},style:function(a,c,d,e){if(!!a&&a.nodeType!==3&&a.nodeType!==8&&!!a.style){var g,h,i=f.camelCase(c),j=a.style,k=f.cssHooks[i];c=f.cssProps[i]||i;if(d===b){if(k&&"get"in k&&(g=k.get(a,!1,e))!==b)return g;return j[c]}h=typeof d,h==="string"&&(g=bv.exec(d))&&(d=+(g[1]+1)*+g[2]+parseFloat(f.css(a,c)),h="number");if(d==null||h==="number"&&isNaN(d))return;h==="number"&&!f.cssNumber[i]&&(d+="px");if(!k||!("set"in k)||(d=k.set(a,d))!==b)try{j[c]=d}catch(l){}}},css:function(a,c,d){var e,g;c=f.camelCase(c),g=f.cssHooks[c],c=f.cssProps[c]||c,c==="cssFloat"&&(c="float");if(g&&"get"in g&&(e=g.get(a,!0,d))!==b)return e;if(bz)return bz(a,c)},swap:function(a,b,c){var d={};for(var e in b)d[e]=a.style[e],a.style[e]=b[e];c.call(a);for(e in b)a.style[e]=d[e]}}),f.curCSS=f.css,f.each(["height","width"],function(a,b){f.cssHooks[b]={get:function(a,c,d){var e;if(c){if(a.offsetWidth!==0)return bC(a,b,d);f.swap(a,bw,function(){e=bC(a,b,d)});return e}},set:function(a,b){if(!bt.test(b))return b;b=parseFloat(b);if(b>=0)return b+"px"}}}),f.support.opacity||(f.cssHooks.opacity={get:function(a,b){return br.test((b&&a.currentStyle?a.currentStyle.filter:a.style.filter)||"")?parseFloat(RegExp.$1)/100+"":b?"1":""},set:function(a,b){var c=a.style,d=a.currentStyle,e=f.isNumeric(b)?"alpha(opacity="+b*100+")":"",g=d&&d.filter||c.filter||"";c.zoom=1;if(b>=1&&f.trim(g.replace(bq,""))===""){c.removeAttribute("filter");if(d&&!d.filter)return}c.filter=bq.test(g)?g.replace(bq,e):g+" "+e}}),f(function(){f.support.reliableMarginRight||(f.cssHooks.marginRight={get:function(a,b){var c;f.swap(a,{display:"inline-block"},function(){b?c=bz(a,"margin-right","marginRight"):c=a.style.marginRight});return c}})}),c.defaultView&&c.defaultView.getComputedStyle&&(bA=function(a,b){var c,d,e;b=b.replace(bs,"-$1").toLowerCase(),(d=a.ownerDocument.defaultView)&&(e=d.getComputedStyle(a,null))&&(c=e.getPropertyValue(b),c===""&&!f.contains(a.ownerDocument.documentElement,a)&&(c=f.style(a,b)));return c}),c.documentElement.currentStyle&&(bB=function(a,b){var c,d,e,f=a.currentStyle&&a.currentStyle[b],g=a.style;f===null&&g&&(e=g[b])&&(f=e),!bt.test(f)&&bu.test(f)&&(c=g.left,d=a.runtimeStyle&&a.runtimeStyle.left,d&&(a.runtimeStyle.left=a.currentStyle.left),g.left=b==="fontSize"?"1em":f||0,f=g.pixelLeft+"px",g.left=c,d&&(a.runtimeStyle.left=d));return f===""?"auto":f}),bz=bA||bB,f.expr&&f.expr.filters&&(f.expr.filters.hidden=function(a){var b=a.offsetWidth,c=a.offsetHeight;return b===0&&c===0||!f.support.reliableHiddenOffsets&&(a.style&&a.style.display||f.css(a,"display"))==="none"},f.expr.filters.visible=function(a){return!f.expr.filters.hidden(a)});var bD=/%20/g,bE=/\[\]$/,bF=/\r?\n/g,bG=/#.*$/,bH=/^(.*?):[ \t]*([^\r\n]*)\r?$/mg,bI=/^(?:color|date|datetime|datetime-local|email|hidden|month|number|password|range|search|tel|text|time|url|week)$/i,bJ=/^(?:about|app|app\-storage|.+\-extension|file|res|widget):$/,bK=/^(?:GET|HEAD)$/,bL=/^\/\//,bM=/\?/,bN=/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,bO=/^(?:select|textarea)/i,bP=/\s+/,bQ=/([?&])_=[^&]*/,bR=/^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/,bS=f.fn.load,bT={},bU={},bV,bW,bX=["*/"]+["*"];try{bV=e.href}catch(bY){bV=c.createElement("a"),bV.href="",bV=bV.href}bW=bR.exec(bV.toLowerCase())||[],f.fn.extend({load:function(a,c,d){if(typeof a!="string"&&bS)return bS.apply(this,arguments);if(!this.length)return this;var e=a.indexOf(" ");if(e>=0){var g=a.slice(e,a.length);a=a.slice(0,e)}var h="GET";c&&(f.isFunction(c)?(d=c,c=b):typeof c=="object"&&(c=f.param(c,f.ajaxSettings.traditional),h="POST"));var i=this;f.ajax({url:a,type:h,dataType:"html",data:c,complete:function(a,b,c){c=a.responseText,a.isResolved()&&(a.done(function(a){c=a}),i.html(g?f("<div>").append(c.replace(bN,"")).find(g):c)),d&&i.each(d,[c,b,a])}});return this},serialize:function(){return f.param(this.serializeArray())},serializeArray:function(){return this.map(function(){return this.elements?f.makeArray(this.elements):this}).filter(function(){return this.name&&!this.disabled&&(this.checked||bO.test(this.nodeName)||bI.test(this.type))}).map(function(a,b){var c=f(this).val();return c==null?null:f.isArray(c)?f.map(c,function(a,c){return{name:b.name,value:a.replace(bF,"\r\n")}}):{name:b.name,value:c.replace(bF,"\r\n")}}).get()}}),f.each("ajaxStart ajaxStop ajaxComplete ajaxError ajaxSuccess ajaxSend".split(" "),function(a,b){f.fn[b]=function(a){return this.on(b,a)}}),f.each(["get","post"],function(a,c){f[c]=function(a,d,e,g){f.isFunction(d)&&(g=g||e,e=d,d=b);return f.ajax({type:c,url:a,data:d,success:e,dataType:g})}}),f.extend({getScript:function(a,c){return f.get(a,b,c,"script")},getJSON:function(a,b,c){return f.get(a,b,c,"json")},ajaxSetup:function(a,b){b?b_(a,f.ajaxSettings):(b=a,a=f.ajaxSettings),b_(a,b);return a},ajaxSettings:{url:bV,isLocal:bJ.test(bW[1]),global:!0,type:"GET",contentType:"application/x-www-form-urlencoded",processData:!0,async:!0,accepts:{xml:"application/xml, text/xml",html:"text/html",text:"text/plain",json:"application/json, text/javascript","*":bX},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText"},converters:{"* text":a.String,"text html":!0,"text json":f.parseJSON,"text xml":f.parseXML},flatOptions:{context:!0,url:!0}},ajaxPrefilter:bZ(bT),ajaxTransport:bZ(bU),ajax:function(a,c){function w(a,c,l,m){if(s!==2){s=2,q&&clearTimeout(q),p=b,n=m||"",v.readyState=a>0?4:0;var o,r,u,w=c,x=l?cb(d,v,l):b,y,z;if(a>=200&&a<300||a===304){if(d.ifModified){if(y=v.getResponseHeader("Last-Modified"))f.lastModified[k]=y;if(z=v.getResponseHeader("Etag"))f.etag[k]=z}if(a===304)w="notmodified",o=!0;else try{r=cc(d,x),w="success",o=!0}catch(A){w="parsererror",u=A}}else{u=w;if(!w||a)w="error",a<0&&(a=0)}v.status=a,v.statusText=""+(c||w),o?h.resolveWith(e,[r,w,v]):h.rejectWith(e,[v,w,u]),v.statusCode(j),j=b,t&&g.trigger("ajax"+(o?"Success":"Error"),[v,d,o?r:u]),i.fireWith(e,[v,w]),t&&(g.trigger("ajaxComplete",[v,d]),--f.active||f.event.trigger("ajaxStop"))}}typeof a=="object"&&(c=a,a=b),c=c||{};var d=f.ajaxSetup({},c),e=d.context||d,g=e!==d&&(e.nodeType||e instanceof f)?f(e):f.event,h=f.Deferred(),i=f.Callbacks("once memory"),j=d.statusCode||{},k,l={},m={},n,o,p,q,r,s=0,t,u,v={readyState:0,setRequestHeader:function(a,b){if(!s){var c=a.toLowerCase();a=m[c]=m[c]||a,l[a]=b}return this},getAllResponseHeaders:function(){return s===2?n:null},getResponseHeader:function(a){var c;if(s===2){if(!o){o={};while(c=bH.exec(n))o[c[1].toLowerCase()]=c[2]}c=o[a.toLowerCase()]}return c===b?null:c},overrideMimeType:function(a){s||(d.mimeType=a);return this},abort:function(a){a=a||"abort",p&&p.abort(a),w(0,a);return this}};h.promise(v),v.success=v.done,v.error=v.fail,v.complete=i.add,v.statusCode=function(a){if(a){var b;if(s<2)for(b in a)j[b]=[j[b],a[b]];else b=a[v.status],v.then(b,b)}return this},d.url=((a||d.url)+"").replace(bG,"").replace(bL,bW[1]+"//"),d.dataTypes=f.trim(d.dataType||"*").toLowerCase().split(bP),d.crossDomain==null&&(r=bR.exec(d.url.toLowerCase()),d.crossDomain=!(!r||r[1]==bW[1]&&r[2]==bW[2]&&(r[3]||(r[1]==="http:"?80:443))==(bW[3]||(bW[1]==="http:"?80:443)))),d.data&&d.processData&&typeof d.data!="string"&&(d.data=f.param(d.data,d.traditional)),b$(bT,d,c,v);if(s===2)return!1;t=d.global,d.type=d.type.toUpperCase(),d.hasContent=!bK.test(d.type),t&&f.active++===0&&f.event.trigger("ajaxStart");if(!d.hasContent){d.data&&(d.url+=(bM.test(d.url)?"&":"?")+d.data,delete d.data),k=d.url;if(d.cache===!1){var x=f.now(),y=d.url.replace(bQ,"$1_="+x);d.url=y+(y===d.url?(bM.test(d.url)?"&":"?")+"_="+x:"")}}(d.data&&d.hasContent&&d.contentType!==!1||c.contentType)&&v.setRequestHeader("Content-Type",d.contentType),d.ifModified&&(k=k||d.url,f.lastModified[k]&&v.setRequestHeader("If-Modified-Since",f.lastModified[k]),f.etag[k]&&v.setRequestHeader("If-None-Match",f.etag[k])),v.setRequestHeader("Accept",d.dataTypes[0]&&d.accepts[d.dataTypes[0]]?d.accepts[d.dataTypes[0]]+(d.dataTypes[0]!=="*"?", "+bX+"; q=0.01":""):d.accepts["*"]);for(u in d.headers)v.setRequestHeader(u,d.headers[u]);if(d.beforeSend&&(d.beforeSend.call(e,v,d)===!1||s===2)){v.abort();return!1}for(u in{success:1,error:1,complete:1})v[u](d[u]);p=b$(bU,d,c,v);if(!p)w(-1,"No Transport");else{v.readyState=1,t&&g.trigger("ajaxSend",[v,d]),d.async&&d.timeout>0&&(q=setTimeout(function(){v.abort("timeout")},d.timeout));try{s=1,p.send(l,w)}catch(z){if(s<2)w(-1,z);else throw z}}return v},param:function(a,c){var d=[],e=function(a,b){b=f.isFunction(b)?b():b,d[d.length]=encodeURIComponent(a)+"="+encodeURIComponent(b)};c===b&&(c=f.ajaxSettings.traditional);if(f.isArray(a)||a.jquery&&!f.isPlainObject(a))f.each(a,function(){e(this.name,this.value)});else for(var g in a)ca(g,a[g],c,e);return d.join("&").replace(bD,"+")}}),f.extend({active:0,lastModified:{},etag:{}});var cd=f.now(),ce=/(\=)\?(&|$)|\?\?/i;f.ajaxSetup({jsonp:"callback",jsonpCallback:function(){return f.expando+"_"+cd++}}),f.ajaxPrefilter("json jsonp",function(b,c,d){var e=b.contentType==="application/x-www-form-urlencoded"&&typeof b.data=="string";if(b.dataTypes[0]==="jsonp"||b.jsonp!==!1&&(ce.test(b.url)||e&&ce.test(b.data))){var g,h=b.jsonpCallback=f.isFunction(b.jsonpCallback)?b.jsonpCallback():b.jsonpCallback,i=a[h],j=b.url,k=b.data,l="$1"+h+"$2";b.jsonp!==!1&&(j=j.replace(ce,l),b.url===j&&(e&&(k=k.replace(ce,l)),b.data===k&&(j+=(/\?/.test(j)?"&":"?")+b.jsonp+"="+h))),b.url=j,b.data=k,a[h]=function(a){g=[a]},d.always(function(){a[h]=i,g&&f.isFunction(i)&&a[h](g[0])}),b.converters["script json"]=function(){g||f.error(h+" was not called");return g[0]},b.dataTypes[0]="json";return"script"}}),f.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/javascript|ecmascript/},converters:{"text script":function(a){f.globalEval(a);return a}}}),f.ajaxPrefilter("script",function(a){a.cache===b&&(a.cache=!1),a.crossDomain&&(a.type="GET",a.global=!1)}),f.ajaxTransport("script",function(a){if(a.crossDomain){var d,e=c.head||c.getElementsByTagName("head")[0]||c.documentElement;return{send:function(f,g){d=c.createElement("script"),d.async="async",a.scriptCharset&&(d.charset=a.scriptCharset),d.src=a.url,d.onload=d.onreadystatechange=function(a,c){if(c||!d.readyState||/loaded|complete/.test(d.readyState))d.onload=d.onreadystatechange=null,e&&d.parentNode&&e.removeChild(d),d=b,c||g(200,"success")},e.insertBefore(d,e.firstChild)},abort:function(){d&&d.onload(0,1)}}}});var cf=a.ActiveXObject?function(){for(var a in ch)ch[a](0,1)}:!1,cg=0,ch;f.ajaxSettings.xhr=a.ActiveXObject?function(){return!this.isLocal&&ci()||cj()}:ci,function(a){f.extend(f.support,{ajax:!!a,cors:!!a&&"withCredentials"in a})}(f.ajaxSettings.xhr()),f.support.ajax&&f.ajaxTransport(function(c){if(!c.crossDomain||f.support.cors){var d;return{send:function(e,g){var h=c.xhr(),i,j;c.username?h.open(c.type,c.url,c.async,c.username,c.password):h.open(c.type,c.url,c.async);if(c.xhrFields)for(j in c.xhrFields)h[j]=c.xhrFields[j];c.mimeType&&h.overrideMimeType&&h.overrideMimeType(c.mimeType),!c.crossDomain&&!e["X-Requested-With"]&&(e["X-Requested-With"]="XMLHttpRequest");try{for(j in e)h.setRequestHeader(j,e[j])}catch(k){}h.send(c.hasContent&&c.data||null),d=function(a,e){var j,k,l,m,n;try{if(d&&(e||h.readyState===4)){d=b,i&&(h.onreadystatechange=f.noop,cf&&delete ch[i]);if(e)h.readyState!==4&&h.abort();else{j=h.status,l=h.getAllResponseHeaders(),m={},n=h.responseXML,n&&n.documentElement&&(m.xml=n),m.text=h.responseText;try{k=h.statusText}catch(o){k=""}!j&&c.isLocal&&!c.crossDomain?j=m.text?200:404:j===1223&&(j=204)}}}catch(p){e||g(-1,p)}m&&g(j,k,m,l)},!c.async||h.readyState===4?d():(i=++cg,cf&&(ch||(ch={},f(a).unload(cf)),ch[i]=d),h.onreadystatechange=d)},abort:function(){d&&d(0,1)}}}});var ck={},cl,cm,cn=/^(?:toggle|show|hide)$/,co=/^([+\-]=)?([\d+.\-]+)([a-z%]*)$/i,cp,cq=[["height","marginTop","marginBottom","paddingTop","paddingBottom"],["width","marginLeft","marginRight","paddingLeft","paddingRight"],["opacity"]],cr;f.fn.extend({show:function(a,b,c){var d,e;if(a||a===0)return this.animate(cu("show",3),a,b,c);for(var g=0,h=this.length;g<h;g++)d=this[g],d.style&&(e=d.style.display,!f._data(d,"olddisplay")&&e==="none"&&(e=d.style.display=""),e===""&&f.css(d,"display")==="none"&&f._data(d,"olddisplay",cv(d.nodeName)));for(g=0;g<h;g++){d=this[g];if(d.style){e=d.style.display;if(e===""||e==="none")d.style.display=f._data(d,"olddisplay")||""}}return this},hide:function(a,b,c){if(a||a===0)return this.animate(cu("hide",3),a,b,c);var d,e,g=0,h=this.length;for(;g<h;g++)d=this[g],d.style&&(e=f.css(d,"display"),e!=="none"&&!f._data(d,"olddisplay")&&f._data(d,"olddisplay",e));for(g=0;g<h;g++)this[g].style&&(this[g].style.display="none");return this},_toggle:f.fn.toggle,toggle:function(a,b,c){var d=typeof a=="boolean";f.isFunction(a)&&f.isFunction(b)?this._toggle.apply(this,arguments):a==null||d?this.each(function(){var b=d?a:f(this).is(":hidden");f(this)[b?"show":"hide"]()}):this.animate(cu("toggle",3),a,b,c);return this},fadeTo:function(a,b,c,d){return this.filter(":hidden").css("opacity",0).show().end().animate({opacity:b},a,c,d)},animate:function(a,b,c,d){function g(){e.queue===!1&&f._mark(this);var b=f.extend({},e),c=this.nodeType===1,d=c&&f(this).is(":hidden"),g,h,i,j,k,l,m,n,o;b.animatedProperties={};for(i in a){g=f.camelCase(i),i!==g&&(a[g]=a[i],delete a[i]),h=a[g],f.isArray(h)?(b.animatedProperties[g]=h[1],h=a[g]=h[0]):b.animatedProperties[g]=b.specialEasing&&b.specialEasing[g]||b.easing||"swing";if(h==="hide"&&d||h==="show"&&!d)return b.complete.call(this);c&&(g==="height"||g==="width")&&(b.overflow=[this.style.overflow,this.style.overflowX,this.style.overflowY],f.css(this,"display")==="inline"&&f.css(this,"float")==="none"&&(!f.support.inlineBlockNeedsLayout||cv(this.nodeName)==="inline"?this.style.display="inline-block":this.style.zoom=1))}b.overflow!=null&&(this.style.overflow="hidden");for(i in a)j=new f.fx(this,b,i),h=a[i],cn.test(h)?(o=f._data(this,"toggle"+i)||(h==="toggle"?d?"show":"hide":0),o?(f._data(this,"toggle"+i,o==="show"?"hide":"show"),j[o]()):j[h]()):(k=co.exec(h),l=j.cur(),k?(m=parseFloat(k[2]),n=k[3]||(f.cssNumber[i]?"":"px"),n!=="px"&&(f.style(this,i,(m||1)+n),l=(m||1)/j.cur()*l,f.style(this,i,l+n)),k[1]&&(m=(k[1]==="-="?-1:1)*m+l),j.custom(l,m,n)):j.custom(l,h,""));return!0}var e=f.speed(b,c,d);if(f.isEmptyObject(a))return this.each(e.complete,[!1]);a=f.extend({},a);return e.queue===!1?this.each(g):this.queue(e.queue,g)},stop:function(a,c,d){typeof a!="string"&&(d=c,c=a,a=b),c&&a!==!1&&this.queue(a||"fx",[]);return this.each(function(){function h(a,b,c){var e=b[c];f.removeData(a,c,!0),e.stop(d)}var b,c=!1,e=f.timers,g=f._data(this);d||f._unmark(!0,this);if(a==null)for(b in g)g[b]&&g[b].stop&&b.indexOf(".run")===b.length-4&&h(this,g,b);else g[b=a+".run"]&&g[b].stop&&h(this,g,b);for(b=e.length;b--;)e[b].elem===this&&(a==null||e[b].queue===a)&&(d?e[b](!0):e[b].saveState(),c=!0,e.splice(b,1));(!d||!c)&&f.dequeue(this,a)})}}),f.each({slideDown:cu("show",1),slideUp:cu("hide",1),slideToggle:cu("toggle",1),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(a,b){f.fn[a]=function(a,c,d){return this.animate(b,a,c,d)}}),f.extend({speed:function(a,b,c){var d=a&&typeof a=="object"?f.extend({},a):{complete:c||!c&&b||f.isFunction(a)&&a,duration:a,easing:c&&b||b&&!f.isFunction(b)&&b};d.duration=f.fx.off?0:typeof d.duration=="number"?d.duration:d.duration in f.fx.speeds?f.fx.speeds[d.duration]:f.fx.speeds._default;if(d.queue==null||d.queue===!0)d.queue="fx";d.old=d.complete,d.complete=function(a){f.isFunction(d.old)&&d.old.call(this),d.queue?f.dequeue(this,d.queue):a!==!1&&f._unmark(this)};return d},easing:{linear:function(a,b,c,d){return c+d*a},swing:function(a,b,c,d){return(-Math.cos(a*Math.PI)/2+.5)*d+c}},timers:[],fx:function(a,b,c){this.options=b,this.elem=a,this.prop=c,b.orig=b.orig||{}}}),f.fx.prototype={update:function(){this.options.step&&this.options.step.call(this.elem,this.now,this),(f.fx.step[this.prop]||f.fx.step._default)(this)},cur:function(){if(this.elem[this.prop]!=null&&(!this.elem.style||this.elem.style[this.prop]==null))return this.elem[this.prop];var a,b=f.css(this.elem,this.prop);return isNaN(a=parseFloat(b))?!b||b==="auto"?0:b:a},custom:function(a,c,d){function h(a){return e.step(a)}var e=this,g=f.fx;this.startTime=cr||cs(),this.end=c,this.now=this.start=a,this.pos=this.state=0,this.unit=d||this.unit||(f.cssNumber[this.prop]?"":"px"),h.queue=this.options.queue,h.elem=this.elem,h.saveState=function(){e.options.hide&&f._data(e.elem,"fxshow"+e.prop)===b&&f._data(e.elem,"fxshow"+e.prop,e.start)},h()&&f.timers.push(h)&&!cp&&(cp=setInterval(g.tick,g.interval))},show:function(){var a=f._data(this.elem,"fxshow"+this.prop);this.options.orig[this.prop]=a||f.style(this.elem,this.prop),this.options.show=!0,a!==b?this.custom(this.cur(),a):this.custom(this.prop==="width"||this.prop==="height"?1:0,this.cur()),f(this.elem).show()},hide:function(){this.options.orig[this.prop]=f._data(this.elem,"fxshow"+this.prop)||f.style(this.elem,this.prop),this.options.hide=!0,this.custom(this.cur(),0)},step:function(a){var b,c,d,e=cr||cs(),g=!0,h=this.elem,i=this.options;if(a||e>=i.duration+this.startTime){this.now=this.end,this.pos=this.state=1,this.update(),i.animatedProperties[this.prop]=!0;for(b in i.animatedProperties)i.animatedProperties[b]!==!0&&(g=!1);if(g){i.overflow!=null&&!f.support.shrinkWrapBlocks&&f.each(["","X","Y"],function(a,b){h.style["overflow"+b]=i.overflow[a]}),i.hide&&f(h).hide();if(i.hide||i.show)for(b in i.animatedProperties)f.style(h,b,i.orig[b]),f.removeData(h,"fxshow"+b,!0),f.removeData(h,"toggle"+b,!0);d=i.complete,d&&(i.complete=!1,d.call(h))}return!1}i.duration==Infinity?this.now=e:(c=e-this.startTime,this.state=c/i.duration,this.pos=f.easing[i.animatedProperties[this.prop]](this.state,c,0,1,i.duration),this.now=this.start+(this.end-this.start)*this.pos),this.update();return!0}},f.extend(f.fx,{tick:function(){var a,b=f.timers,c=0;for(;c<b.length;c++)a=b[c],!a()&&b[c]===a&&b.splice(c--,1);b.length||f.fx.stop()},interval:13,stop:function(){clearInterval(cp),cp=null},speeds:{slow:600,fast:200,_default:400},step:{opacity:function(a){f.style(a.elem,"opacity",a.now)},_default:function(a){a.elem.style&&a.elem.style[a.prop]!=null?a.elem.style[a.prop]=a.now+a.unit:a.elem[a.prop]=a.now}}}),f.each(["width","height"],function(a,b){f.fx.step[b]=function(a){f.style(a.elem,b,Math.max(0,a.now)+a.unit)}}),f.expr&&f.expr.filters&&(f.expr.filters.animated=function(a){return f.grep(f.timers,function(b){return a===b.elem}).length});var cw=/^t(?:able|d|h)$/i,cx=/^(?:body|html)$/i;"getBoundingClientRect"in c.documentElement?f.fn.offset=function(a){var b=this[0],c;if(a)return this.each(function(b){f.offset.setOffset(this,a,b)});if(!b||!b.ownerDocument)return null;if(b===b.ownerDocument.body)return f.offset.bodyOffset(b);try{c=b.getBoundingClientRect()}catch(d){}var e=b.ownerDocument,g=e.documentElement;if(!c||!f.contains(g,b))return c?{top:c.top,left:c.left}:{top:0,left:0};var h=e.body,i=cy(e),j=g.clientTop||h.clientTop||0,k=g.clientLeft||h.clientLeft||0,l=i.pageYOffset||f.support.boxModel&&g.scrollTop||h.scrollTop,m=i.pageXOffset||f.support.boxModel&&g.scrollLeft||h.scrollLeft,n=c.top+l-j,o=c.left+m-k;return{top:n,left:o}}:f.fn.offset=function(a){var b=this[0];if(a)return this.each(function(b){f.offset.setOffset(this,a,b)});if(!b||!b.ownerDocument)return null;if(b===b.ownerDocument.body)return f.offset.bodyOffset(b);var c,d=b.offsetParent,e=b,g=b.ownerDocument,h=g.documentElement,i=g.body,j=g.defaultView,k=j?j.getComputedStyle(b,null):b.currentStyle,l=b.offsetTop,m=b.offsetLeft;while((b=b.parentNode)&&b!==i&&b!==h){if(f.support.fixedPosition&&k.position==="fixed")break;c=j?j.getComputedStyle(b,null):b.currentStyle,l-=b.scrollTop,m-=b.scrollLeft,b===d&&(l+=b.offsetTop,m+=b.offsetLeft,f.support.doesNotAddBorder&&(!f.support.doesAddBorderForTableAndCells||!cw.test(b.nodeName))&&(l+=parseFloat(c.borderTopWidth)||0,m+=parseFloat(c.borderLeftWidth)||0),e=d,d=b.offsetParent),f.support.subtractsBorderForOverflowNotVisible&&c.overflow!=="visible"&&(l+=parseFloat(c.borderTopWidth)||0,m+=parseFloat(c.borderLeftWidth)||0),k=c}if(k.position==="relative"||k.position==="static")l+=i.offsetTop,m+=i.offsetLeft;f.support.fixedPosition&&k.position==="fixed"&&(l+=Math.max(h.scrollTop,i.scrollTop),m+=Math.max(h.scrollLeft,i.scrollLeft));return{top:l,left:m}},f.offset={bodyOffset:function(a){var b=a.offsetTop,c=a.offsetLeft;f.support.doesNotIncludeMarginInBodyOffset&&(b+=parseFloat(f.css(a,"marginTop"))||0,c+=parseFloat(f.css(a,"marginLeft"))||0);return{top:b,left:c}},setOffset:function(a,b,c){var d=f.css(a,"position");d==="static"&&(a.style.position="relative");var e=f(a),g=e.offset(),h=f.css(a,"top"),i=f.css(a,"left"),j=(d==="absolute"||d==="fixed")&&f.inArray("auto",[h,i])>-1,k={},l={},m,n;j?(l=e.position(),m=l.top,n=l.left):(m=parseFloat(h)||0,n=parseFloat(i)||0),f.isFunction(b)&&(b=b.call(a,c,g)),b.top!=null&&(k.top=b.top-g.top+m),b.left!=null&&(k.left=b.left-g.left+n),"using"in b?b.using.call(a,k):e.css(k)}},f.fn.extend({position:function(){if(!this[0])return null;var a=this[0],b=this.offsetParent(),c=this.offset(),d=cx.test(b[0].nodeName)?{top:0,left:0}:b.offset();c.top-=parseFloat(f.css(a,"marginTop"))||0,c.left-=parseFloat(f.css(a,"marginLeft"))||0,d.top+=parseFloat(f.css(b[0],"borderTopWidth"))||0,d.left+=parseFloat(f.css(b[0],"borderLeftWidth"))||0;return{top:c.top-d.top,left:c.left-d.left}},offsetParent:function(){return this.map(function(){var a=this.offsetParent||c.body;while(a&&!cx.test(a.nodeName)&&f.css(a,"position")==="static")a=a.offsetParent;return a})}}),f.each(["Left","Top"],function(a,c){var d="scroll"+c;f.fn[d]=function(c){var e,g;if(c===b){e=this[0];if(!e)return null;g=cy(e);return g?"pageXOffset"in g?g[a?"pageYOffset":"pageXOffset"]:f.support.boxModel&&g.document.documentElement[d]||g.document.body[d]:e[d]}return this.each(function(){g=cy(this),g?g.scrollTo(a?f(g).scrollLeft():c,a?c:f(g).scrollTop()):this[d]=c})}}),f.each(["Height","Width"],function(a,c){var d=c.toLowerCase();f.fn["inner"+c]=function(){var a=this[0];return a?a.style?parseFloat(f.css(a,d,"padding")):this[d]():null},f.fn["outer"+c]=function(a){var b=this[0];return b?b.style?parseFloat(f.css(b,d,a?"margin":"border")):this[d]():null},f.fn[d]=function(a){var e=this[0];if(!e)return a==null?null:this;if(f.isFunction(a))return this.each(function(b){var c=f(this);c[d](a.call(this,b,c[d]()))});if(f.isWindow(e)){var g=e.document.documentElement["client"+c],h=e.document.body;return e.document.compatMode==="CSS1Compat"&&g||h&&h["client"+c]||g}if(e.nodeType===9)return Math.max(e.documentElement["client"+c],e.body["scroll"+c],e.documentElement["scroll"+c],e.body["offset"+c],e.documentElement["offset"+c]);if(a===b){var i=f.css(e,d),j=parseFloat(i);return f.isNumeric(j)?j:i}return this.css(d,typeof a=="string"?a:a+"px")}}),a.jQuery=a.$=f,typeof define=="function"&&define.amd&&define.amd.jQuery&&define("jquery",[],function(){return f})})(GLOBAL);

GLOBAL._SB_debugMessages = [];
var isDefined = GLOBAL._SB_isDefined = function(v) { return (!(typeof(v) == "undefined")); };
var turnDebugOn = GLOBAL._SB_debugToConsole = false;
var debug = GLOBAL._SB_debug = function(str) { _SB_debugMessages.push(str); if(_SB_debugMessages.length > 30) { _SB_debugMessages.splice(0, 1); }; if(GLOBAL._SB_debugToConsole) { console.log(str); } };
if(isDefined(debugOn) && debugOn == true) { GLOBAL._SB_debugToConsole = true; };

if(!isDefined(window.console)) {
	window.console = {};
	window.console.log = function() {};
}

WEB_SOCKET_SWF_LOCATION = smartboardJSUrl + "lib/WebSocketMain.swf";

if(navigator.userAgent.indexOf('MSIE') > 0) {
    var swfobject=function(){var D="undefined",r="object",S="Shockwave Flash",W="ShockwaveFlash.ShockwaveFlash",q="application/x-shockwave-flash",R="SWFObjectExprInst",x="onreadystatechange",O=window,j=document,t=navigator,T=false,U=[h],o=[],N=[],I=[],l,Q,E,B,J=false,a=false,n,G,m=true,M=function(){var aa=typeof j.getElementById!=D&&typeof j.getElementsByTagName!=D&&typeof j.createElement!=D,ah=t.userAgent.toLowerCase(),Y=t.platform.toLowerCase(),ae=Y?/win/.test(Y):/win/.test(ah),ac=Y?/mac/.test(Y):/mac/.test(ah),af=/webkit/.test(ah)?parseFloat(ah.replace(/^.*webkit\/(\d+(\.\d+)?).*$/,"$1")):false,X=!+"\v1",ag=[0,0,0],ab=null;if(typeof t.plugins!=D&&typeof t.plugins[S]==r){ab=t.plugins[S].description;if(ab&&!(typeof t.mimeTypes!=D&&t.mimeTypes[q]&&!t.mimeTypes[q].enabledPlugin)){T=true;X=false;ab=ab.replace(/^.*\s+(\S+\s+\S+$)/,"$1");ag[0]=parseInt(ab.replace(/^(.*)\..*$/,"$1"),10);ag[1]=parseInt(ab.replace(/^.*\.(.*)\s.*$/,"$1"),10);ag[2]=/[a-zA-Z]/.test(ab)?parseInt(ab.replace(/^.*[a-zA-Z]+(.*)$/,"$1"),10):0}}else{if(typeof O.ActiveXObject!=D){try{var ad=new ActiveXObject(W);if(ad){ab=ad.GetVariable("$version");if(ab){X=true;ab=ab.split(" ")[1].split(",");ag=[parseInt(ab[0],10),parseInt(ab[1],10),parseInt(ab[2],10)]}}}catch(Z){}}}return{w3:aa,pv:ag,wk:af,ie:X,win:ae,mac:ac}}(),k=function(){if(!M.w3){return}if((typeof j.readyState!=D&&j.readyState=="complete")||(typeof j.readyState==D&&(j.getElementsByTagName("body")[0]||j.body))){f()}if(!J){if(typeof j.addEventListener!=D){j.addEventListener("DOMContentLoaded",f,false)}if(M.ie&&M.win){j.attachEvent(x,function(){if(j.readyState=="complete"){j.detachEvent(x,arguments.callee);f()}});if(O==top){(function(){if(J){return}try{j.documentElement.doScroll("left")}catch(X){setTimeout(arguments.callee,0);return}f()})()}}if(M.wk){(function(){if(J){return}if(!/loaded|complete/.test(j.readyState)){setTimeout(arguments.callee,0);return}f()})()}s(f)}}();function f(){if(J){return}try{var Z=j.getElementsByTagName("body")[0].appendChild(C("span"));Z.parentNode.removeChild(Z)}catch(aa){return}J=true;var X=U.length;for(var Y=0;Y<X;Y++){U[Y]()}}function K(X){if(J){X()}else{U[U.length]=X}}function s(Y){if(typeof O.addEventListener!=D){O.addEventListener("load",Y,false)}else{if(typeof j.addEventListener!=D){j.addEventListener("load",Y,false)}else{if(typeof O.attachEvent!=D){i(O,"onload",Y)}else{if(typeof O.onload=="function"){var X=O.onload;O.onload=function(){X();Y()}}else{O.onload=Y}}}}}function h(){if(T){V()}else{H()}}function V(){var X=j.getElementsByTagName("body")[0];var aa=C(r);aa.setAttribute("type",q);var Z=X.appendChild(aa);if(Z){var Y=0;(function(){if(typeof Z.GetVariable!=D){var ab=Z.GetVariable("$version");if(ab){ab=ab.split(" ")[1].split(",");M.pv=[parseInt(ab[0],10),parseInt(ab[1],10),parseInt(ab[2],10)]}}else{if(Y<10){Y++;setTimeout(arguments.callee,10);return}}X.removeChild(aa);Z=null;H()})()}else{H()}}function H(){var ag=o.length;if(ag>0){for(var af=0;af<ag;af++){var Y=o[af].id;var ab=o[af].callbackFn;var aa={success:false,id:Y};if(M.pv[0]>0){var ae=c(Y);if(ae){if(F(o[af].swfVersion)&&!(M.wk&&M.wk<312)){w(Y,true);if(ab){aa.success=true;aa.ref=z(Y);ab(aa)}}else{if(o[af].expressInstall&&A()){var ai={};ai.data=o[af].expressInstall;ai.width=ae.getAttribute("width")||"0";ai.height=ae.getAttribute("height")||"0";if(ae.getAttribute("class")){ai.styleclass=ae.getAttribute("class")}if(ae.getAttribute("align")){ai.align=ae.getAttribute("align")}var ah={};var X=ae.getElementsByTagName("param");var ac=X.length;for(var ad=0;ad<ac;ad++){if(X[ad].getAttribute("name").toLowerCase()!="movie"){ah[X[ad].getAttribute("name")]=X[ad].getAttribute("value")}}P(ai,ah,Y,ab)}else{p(ae);if(ab){ab(aa)}}}}}else{w(Y,true);if(ab){var Z=z(Y);if(Z&&typeof Z.SetVariable!=D){aa.success=true;aa.ref=Z}ab(aa)}}}}}function z(aa){var X=null;var Y=c(aa);if(Y&&Y.nodeName=="OBJECT"){if(typeof Y.SetVariable!=D){X=Y}else{var Z=Y.getElementsByTagName(r)[0];if(Z){X=Z}}}return X}function A(){return !a&&F("6.0.65")&&(M.win||M.mac)&&!(M.wk&&M.wk<312)}function P(aa,ab,X,Z){a=true;E=Z||null;B={success:false,id:X};var ae=c(X);if(ae){if(ae.nodeName=="OBJECT"){l=g(ae);Q=null}else{l=ae;Q=X}aa.id=R;if(typeof aa.width==D||(!/%$/.test(aa.width)&&parseInt(aa.width,10)<310)){aa.width="310"}if(typeof aa.height==D||(!/%$/.test(aa.height)&&parseInt(aa.height,10)<137)){aa.height="137"}j.title=j.title.slice(0,47)+" - Flash Player Installation";var ad=M.ie&&M.win?"ActiveX":"PlugIn",ac="MMredirectURL="+O.location.toString().replace(/&/g,"%26")+"&MMplayerType="+ad+"&MMdoctitle="+j.title;if(typeof ab.flashvars!=D){ab.flashvars+="&"+ac}else{ab.flashvars=ac}if(M.ie&&M.win&&ae.readyState!=4){var Y=C("div");X+="SWFObjectNew";Y.setAttribute("id",X);ae.parentNode.insertBefore(Y,ae);ae.style.display="none";(function(){if(ae.readyState==4){ae.parentNode.removeChild(ae)}else{setTimeout(arguments.callee,10)}})()}u(aa,ab,X)}}function p(Y){if(M.ie&&M.win&&Y.readyState!=4){var X=C("div");Y.parentNode.insertBefore(X,Y);X.parentNode.replaceChild(g(Y),X);Y.style.display="none";(function(){if(Y.readyState==4){Y.parentNode.removeChild(Y)}else{setTimeout(arguments.callee,10)}})()}else{Y.parentNode.replaceChild(g(Y),Y)}}function g(ab){var aa=C("div");if(M.win&&M.ie){aa.innerHTML=ab.innerHTML}else{var Y=ab.getElementsByTagName(r)[0];if(Y){var ad=Y.childNodes;if(ad){var X=ad.length;for(var Z=0;Z<X;Z++){if(!(ad[Z].nodeType==1&&ad[Z].nodeName=="PARAM")&&!(ad[Z].nodeType==8)){aa.appendChild(ad[Z].cloneNode(true))}}}}}return aa}function u(ai,ag,Y){var X,aa=c(Y);if(M.wk&&M.wk<312){return X}if(aa){if(typeof ai.id==D){ai.id=Y}if(M.ie&&M.win){var ah="";for(var ae in ai){if(ai[ae]!=Object.prototype[ae]){if(ae.toLowerCase()=="data"){ag.movie=ai[ae]}else{if(ae.toLowerCase()=="styleclass"){ah+=' class="'+ai[ae]+'"'}else{if(ae.toLowerCase()!="classid"){ah+=" "+ae+'="'+ai[ae]+'"'}}}}}var af="";for(var ad in ag){if(ag[ad]!=Object.prototype[ad]){af+='<param name="'+ad+'" value="'+ag[ad]+'" />'}}aa.outerHTML='<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"'+ah+">"+af+"</object>";N[N.length]=ai.id;X=c(ai.id)}else{var Z=C(r);Z.setAttribute("type",q);for(var ac in ai){if(ai[ac]!=Object.prototype[ac]){if(ac.toLowerCase()=="styleclass"){Z.setAttribute("class",ai[ac])}else{if(ac.toLowerCase()!="classid"){Z.setAttribute(ac,ai[ac])}}}}for(var ab in ag){if(ag[ab]!=Object.prototype[ab]&&ab.toLowerCase()!="movie"){e(Z,ab,ag[ab])}}aa.parentNode.replaceChild(Z,aa);X=Z}}return X}function e(Z,X,Y){var aa=C("param");aa.setAttribute("name",X);aa.setAttribute("value",Y);Z.appendChild(aa)}function y(Y){var X=c(Y);if(X&&X.nodeName=="OBJECT"){if(M.ie&&M.win){X.style.display="none";(function(){if(X.readyState==4){b(Y)}else{setTimeout(arguments.callee,10)}})()}else{X.parentNode.removeChild(X)}}}function b(Z){var Y=c(Z);if(Y){for(var X in Y){if(typeof Y[X]=="function"){Y[X]=null}}Y.parentNode.removeChild(Y)}}function c(Z){var X=null;try{X=j.getElementById(Z)}catch(Y){}return X}function C(X){return j.createElement(X)}function i(Z,X,Y){Z.attachEvent(X,Y);I[I.length]=[Z,X,Y]}function F(Z){var Y=M.pv,X=Z.split(".");X[0]=parseInt(X[0],10);X[1]=parseInt(X[1],10)||0;X[2]=parseInt(X[2],10)||0;return(Y[0]>X[0]||(Y[0]==X[0]&&Y[1]>X[1])||(Y[0]==X[0]&&Y[1]==X[1]&&Y[2]>=X[2]))?true:false}function v(ac,Y,ad,ab){if(M.ie&&M.mac){return}var aa=j.getElementsByTagName("head")[0];if(!aa){return}var X=(ad&&typeof ad=="string")?ad:"screen";if(ab){n=null;G=null}if(!n||G!=X){var Z=C("style");Z.setAttribute("type","text/css");Z.setAttribute("media",X);n=aa.appendChild(Z);if(M.ie&&M.win&&typeof j.styleSheets!=D&&j.styleSheets.length>0){n=j.styleSheets[j.styleSheets.length-1]}G=X}if(M.ie&&M.win){if(n&&typeof n.addRule==r){n.addRule(ac,Y)}}else{if(n&&typeof j.createTextNode!=D){n.appendChild(j.createTextNode(ac+" {"+Y+"}"))}}}function w(Z,X){if(!m){return}var Y=X?"visible":"hidden";if(J&&c(Z)){c(Z).style.visibility=Y}else{v("#"+Z,"visibility:"+Y)}}function L(Y){var Z=/[\\\"<>\.;]/;var X=Z.exec(Y)!=null;return X&&typeof encodeURIComponent!=D?encodeURIComponent(Y):Y}var d=function(){if(M.ie&&M.win){window.attachEvent("onunload",function(){var ac=I.length;for(var ab=0;ab<ac;ab++){I[ab][0].detachEvent(I[ab][1],I[ab][2])}var Z=N.length;for(var aa=0;aa<Z;aa++){y(N[aa])}for(var Y in M){M[Y]=null}M=null;for(var X in swfobject){swfobject[X]=null}swfobject=null})}}();return{registerObject:function(ab,X,aa,Z){if(M.w3&&ab&&X){var Y={};Y.id=ab;Y.swfVersion=X;Y.expressInstall=aa;Y.callbackFn=Z;o[o.length]=Y;w(ab,false)}else{if(Z){Z({success:false,id:ab})}}},getObjectById:function(X){if(M.w3){return z(X)}},embedSWF:function(ab,ah,ae,ag,Y,aa,Z,ad,af,ac){var X={success:false,id:ah};if(M.w3&&!(M.wk&&M.wk<312)&&ab&&ah&&ae&&ag&&Y){w(ah,false);K(function(){ae+="";ag+="";var aj={};if(af&&typeof af===r){for(var al in af){aj[al]=af[al]}}aj.data=ab;aj.width=ae;aj.height=ag;var am={};if(ad&&typeof ad===r){for(var ak in ad){am[ak]=ad[ak]}}if(Z&&typeof Z===r){for(var ai in Z){if(typeof am.flashvars!=D){am.flashvars+="&"+ai+"="+Z[ai]}else{am.flashvars=ai+"="+Z[ai]}}}if(F(Y)){var an=u(aj,am,ah);if(aj.id==ah){w(ah,true)}X.success=true;X.ref=an}else{if(aa&&A()){aj.data=aa;P(aj,am,ah,ac);return}else{w(ah,true)}}if(ac){ac(X)}})}else{if(ac){ac(X)}}},switchOffAutoHideShow:function(){m=false},ua:M,getFlashPlayerVersion:function(){return{major:M.pv[0],minor:M.pv[1],release:M.pv[2]}},hasFlashPlayerVersion:F,createSWF:function(Z,Y,X){if(M.w3){return u(Z,Y,X)}else{return undefined}},showExpressInstall:function(Z,aa,X,Y){if(M.w3&&A()){P(Z,aa,X,Y)}},removeSWF:function(X){if(M.w3){y(X)}},createCSS:function(aa,Z,Y,X){if(M.w3){v(aa,Z,Y,X)}},addDomLoadEvent:K,addLoadEvent:s,getQueryParamValue:function(aa){var Z=j.location.search||j.location.hash;if(Z){if(/\?/.test(Z)){Z=Z.split("?")[1]}if(aa==null){return L(Z)}var Y=Z.split("&");for(var X=0;X<Y.length;X++){if(Y[X].substring(0,Y[X].indexOf("="))==aa){return L(Y[X].substring((Y[X].indexOf("=")+1)))}}}return""},expressInstallCallback:function(){if(a){var X=c(R);if(X&&l){X.parentNode.replaceChild(l,X);if(Q){w(Q,true);if(M.ie&&M.win){l.style.display="block"}}if(E){E(B)}}a=false}}}}();
    GLOBAL.swfobject = swfobject;
}

(function() {

  if (window.WEB_SOCKET_FORCE_FLASH) {
    // Keeps going.
  } else if (window.WebSocket) {
    return;
  } else if (window.MozWebSocket) {
    window.WebSocket = MozWebSocket;
    return;
  }

  var logger;
  if (window.WEB_SOCKET_LOGGER) {
    logger = WEB_SOCKET_LOGGER;
  } else if (window.console && window.console.log && window.console.error) {
    logger = window.console;
  } else {
    logger = {log: function(){ }, error: function(){ }};
  }

  if (swfobject.getFlashPlayerVersion().major < 10) {
    logger.error("Flash Player >= 10.0.0 is required.");
    return;
  }
  if (location.protocol == "file:") {
    logger.error(
      "WARNING: web-socket-js doesn't work in file:///... URL " +
      "unless you set Flash Security Settings properly. " +
      "Open the page via Web server i.e. http://...");
  }

  window.WebSocket = function(url, protocols, proxyHost, proxyPort, headers) {
    var self = this;
    self.__id = WebSocket.__nextId++;
    WebSocket.__instances[self.__id] = self;
    self.readyState = WebSocket.CONNECTING;
    self.bufferedAmount = 0;
    self.__events = {};
    if (!protocols) {
      protocols = [];
    } else if (typeof protocols == "string") {
      protocols = [protocols];
    }
    self.__createTask = setTimeout(function() {
      WebSocket.__addTask(function() {
        self.__createTask = null;
        WebSocket.__flash.create(
            self.__id, url, protocols, proxyHost || null, proxyPort || 0, headers || null);
      });
    }, 0);
  };

  WebSocket.prototype.send = function(data) {
    if (this.readyState == WebSocket.CONNECTING) {
      throw "INVALID_STATE_ERR: Web Socket connection has not been established";
    }
    var result = WebSocket.__flash.send(this.__id, encodeURIComponent(data));
    if (result < 0) {
      return true;
    } else {
      this.bufferedAmount += result;
      return false;
    }
  };

  WebSocket.prototype.close = function() {
    if (this.__createTask) {
      clearTimeout(this.__createTask);
      this.__createTask = null;
      this.readyState = WebSocket.CLOSED;
      return;
    }
    if (this.readyState == WebSocket.CLOSED || this.readyState == WebSocket.CLOSING) {
      return;
    }
    this.readyState = WebSocket.CLOSING;
    WebSocket.__flash.close(this.__id);
  };

  WebSocket.prototype.addEventListener = function(type, listener, useCapture) {
    if (!(type in this.__events)) {
      this.__events[type] = [];
    }
    this.__events[type].push(listener);
  };

  WebSocket.prototype.removeEventListener = function(type, listener, useCapture) {
    if (!(type in this.__events)) return;
    var events = this.__events[type];
    for (var i = events.length - 1; i >= 0; --i) {
      if (events[i] === listener) {
        events.splice(i, 1);
        break;
      }
    }
  };

  WebSocket.prototype.dispatchEvent = function(event) {
    var events = this.__events[event.type] || [];
    for (var i = 0; i < events.length; ++i) {
      events[i](event);
    }
    var handler = this["on" + event.type];
    if (handler) handler.apply(this, [event]);
  };

  WebSocket.prototype.__handleEvent = function(flashEvent) {

    if ("readyState" in flashEvent) {
      this.readyState = flashEvent.readyState;
    }
    if ("protocol" in flashEvent) {
      this.protocol = flashEvent.protocol;
    }

    var jsEvent;
    if (flashEvent.type == "open" || flashEvent.type == "error") {
      jsEvent = this.__createSimpleEvent(flashEvent.type);
    } else if (flashEvent.type == "close") {
      jsEvent = this.__createSimpleEvent("close");
      jsEvent.wasClean = flashEvent.wasClean ? true : false;
      jsEvent.code = flashEvent.code;
      jsEvent.reason = flashEvent.reason;
    } else if (flashEvent.type == "message") {
      var data = decodeURIComponent(flashEvent.message);
      jsEvent = this.__createMessageEvent("message", data);
    } else {
      throw "unknown event type: " + flashEvent.type;
    }

    this.dispatchEvent(jsEvent);

  };

  WebSocket.prototype.__createSimpleEvent = function(type) {
    if (document.createEvent && window.Event) {
      var event = document.createEvent("Event");
      event.initEvent(type, false, false);
      return event;
    } else {
      return {type: type, bubbles: false, cancelable: false};
    }
  };

  WebSocket.prototype.__createMessageEvent = function(type, data) {
    if (document.createEvent && window.MessageEvent && !window.opera) {
      var event = document.createEvent("MessageEvent");
      event.initMessageEvent("message", false, false, data, null, null, window, null);
      return event;
    } else {
      return {type: type, data: data, bubbles: false, cancelable: false};
    }
  };

  WebSocket.CONNECTING = 0;
  WebSocket.OPEN = 1;
  WebSocket.CLOSING = 2;
  WebSocket.CLOSED = 3;

  WebSocket.__isFlashImplementation = true;
  WebSocket.__initialized = false;
  WebSocket.__flash = null;
  WebSocket.__instances = {};
  WebSocket.__tasks = [];
  WebSocket.__nextId = 0;

  WebSocket.loadFlashPolicyFile = function(url){
    WebSocket.__addTask(function() {
      WebSocket.__flash.loadManualPolicyFile(url);
    });
  };

  WebSocket.__initialize = function() {

    if (WebSocket.__initialized) return;
    WebSocket.__initialized = true;

    if (WebSocket.__swfLocation) {
      window.WEB_SOCKET_SWF_LOCATION = WebSocket.__swfLocation;
    }
    if (!window.WEB_SOCKET_SWF_LOCATION) {
      logger.error("[WebSocket] set WEB_SOCKET_SWF_LOCATION to location of WebSocketMain.swf");
      return;
    }
    if (!window.WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR &&
        !WEB_SOCKET_SWF_LOCATION.match(/(^|\/)WebSocketMainInsecure\.swf(\?.*)?$/) &&
        WEB_SOCKET_SWF_LOCATION.match(/^\w+:\/\/([^\/]+)/)) {
      var swfHost = RegExp.$1;
      if (location.host != swfHost) {
        logger.error(
            "[WebSocket] You must host HTML and WebSocketMain.swf in the same host " +
            "('" + location.host + "' != '" + swfHost + "'). " +
            "See also 'How to host HTML file and SWF file in different domains' section " +
            "in README.md. If you use WebSocketMainInsecure.swf, you can suppress this message " +
            "by WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = true;");
      }
    }
    var container = document.createElement("div");
    container.id = "webSocketContainer";
    container.style.position = "absolute";
    if (WebSocket.__isFlashLite()) {
      container.style.left = "0px";
      container.style.top = "0px";
    } else {
      container.style.left = "-100px";
      container.style.top = "-100px";
    }
    var holder = document.createElement("div");
    holder.id = "webSocketFlash";
    container.appendChild(holder);
    document.body.appendChild(container);
    swfobject.embedSWF(
      WEB_SOCKET_SWF_LOCATION,
      "webSocketFlash",
      "1" /* width */,
      "1" /* height */,
      "10.0.0" /* SWF version */,
      null,
      null,
      {hasPriority: true, swliveconnect : true, allowScriptAccess: "always"},
      null,
      function(e) {
        if (!e.success) {
          logger.error("[WebSocket] swfobject.embedSWF failed");
        }
      }
    );

  };

  WebSocket.__onFlashInitialized = function() {
    setTimeout(function() {
      WebSocket.__flash = document.getElementById("webSocketFlash");
      WebSocket.__flash.setCallerUrl(location.href);
      WebSocket.__flash.setDebug(!!window.WEB_SOCKET_DEBUG);
      for (var i = 0; i < WebSocket.__tasks.length; ++i) {
        WebSocket.__tasks[i]();
      }
      WebSocket.__tasks = [];
    }, 0);
  };

  WebSocket.__onFlashEvent = function() {
    setTimeout(function() {
      try {
        var events = WebSocket.__flash.receiveEvents();
        for (var i = 0; i < events.length; ++i) {
          WebSocket.__instances[events[i].webSocketId].__handleEvent(events[i]);
        }
      } catch (e) {
        logger.error(e);
      }
    }, 0);
    return true;
  };

  WebSocket.__log = function(message) {
    logger.log(decodeURIComponent(message));
  };

  WebSocket.__error = function(message) {
    logger.error(decodeURIComponent(message));
  };

  WebSocket.__addTask = function(task) {
    if (WebSocket.__flash) {
      task();
    } else {
      WebSocket.__tasks.push(task);
    }
  };

  WebSocket.__isFlashLite = function() {
    if (!window.navigator || !window.navigator.mimeTypes) {
      return false;
    }
    var mimeType = window.navigator.mimeTypes["application/x-shockwave-flash"];
    if (!mimeType || !mimeType.enabledPlugin || !mimeType.enabledPlugin.filename) {
      return false;
    }
    return mimeType.enabledPlugin.filename.match(/flashlite/i) ? true : false;
  };

  if (!window.WEB_SOCKET_DISABLE_AUTO_INITIALIZATION) {
    swfobject.addDomLoadEvent(function() {
      WebSocket.__initialize();
    });
  }

})();

WEB_SOCKET_DEBUG = false;
WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = true;

if(window.XDomainRequest){var httpRegEx=/^https?:\/\//i;var getOrPostRegEx=/^get|post$/i;var sameSchemeRegEx=new RegExp("^"+location.protocol,"i");var xmlRegEx=/\/xml/i;jQuery.ajaxTransport("text html xml json",function(a,b,c){if(a.crossDomain&&a.async&&getOrPostRegEx.test(a.type)&&httpRegEx.test(b.url)&&sameSchemeRegEx.test(b.url)){var d=null;var e=(b.dataType||"").toLowerCase();return{send:function(c,f){d=new XDomainRequest;if(/^\d+$/.test(b.timeout)){d.timeout=b.timeout}d.ontimeout=function(){f(500,"timeout")};d.onload=function(){var a="Content-Length: "+d.responseText.length+"\r\nContent-Type: "+d.contentType;var b={code:200,message:"success"};var c={text:d.responseText};try{if(e==="json"){try{c.json=JSON.parse(d.responseText)}catch(g){b.code=500;b.message="parseerror"}}else if(e==="xml"||e!=="text"&&xmlRegEx.test(d.contentType)){var h=new ActiveXObject("Microsoft.XMLDOM");h.async=false;try{h.loadXML(d.responseText)}catch(g){h=undefined}if(!h||!h.documentElement||h.getElementsByTagName("parsererror").length){b.code=500;b.message="parseerror";throw"Invalid XML: "+d.responseText}c.xml=h}}catch(i){throw i}finally{f(b.code,b.message,c,a)}};d.onerror=function(){f(500,"error",{text:d.responseText})};d.open(a.type,a.url);if(a.type=="POST"){d.send(JSON.stringify(b.data))}else{d.send()}},abort:function(){if(d){d.abort()}}}}})}

(function(GLOBAL, $) {
    var debug = window._SB_debug;
    var isDefined = window._SB_isDefined;

    "use strict";

    var mouseIsDown = false;
    var pointersDown = {};

    function Finger() {
        this.node = document.createElement('span');
		$(this.node).addClass('_smartboard-touch-point');

        document.body.appendChild(this.node);

        if(SB.disableTouchPointers) {
            this.node.style.display = 'none';
        }
    }

    Finger.prototype = {
        node: null,

        x: NaN,
        y: NaN,

        target: null,

        retarget: function() {
            this.target = null;
        },

        place: function() {
            document.body.appendChild(this.node);
        },

        hide: function() {
            this.node.style.display = 'none';
        },

        remove: function() {
            document.body.removeChild(this.node);
        },

        show: function() {
            if(SB.disableTouchPointers) {
                return;
            }
            this.node.style.display = '';
        },

        move: function(x, y, e) {
            if (isNaN(x) || isNaN(y)) {
                this.hide();
                this.target = null;
            } else {
                this.show();

                this.node.style.left = x + 'px';
                this.node.style.top = y + 'px';


                if(SB.debugTouches) {
                    this.node.style.background = "rgba(128, 128, 128, 0.5)";
                    this.node.innerHTML = "F";
                    if(isDefined(e.toolData)) {
                        var c = e.toolData.color;
                        if(isDefined(c)) {
                            var colorStr = "rgba(" + c[0] + ", " + c[1] + ", " + c[2] + ", 0.5)";
                            this.node.style.background = colorStr;
                            this.node.innerHTML = "P";
                        } else {
                            if(e.toolData.tool == "eraser") {
                                this.node.style.background = "rgba(128, 128, 128, 0.1)";
                                this.node.innerHTML = "E";
                            }
                        }
                    }

                    this.node.innerHTML = this.node.innerHTML + ": " + x + ", " + y + ", " + e.angle;
                }

                this.x = x;
                this.y = y;

                if (this.target === null) {
                    SB.overlay.disable();
                    this.hide();
                        this.target = document.elementFromPoint(x, y);
                    this.show();
                    SB.overlay.enable();
                }
            }
        }
    };

    var fingers = {};

    function createMouseEvent(eventName, originalEvent, finger) {
        var e = document.createEvent('MouseEvent');

        e.initMouseEvent(eventName, true, true,
            originalEvent.view, originalEvent.detail,
            finger.x || originalEvent.screenX, finger.y || originalEvent.screenY,
            finger.x || originalEvent.clientX, finger.y || originalEvent.clientY,
            originalEvent.ctrlKey, originalEvent.shiftKey,
            originalEvent.altKey, originalEvent.metaKey,
            originalEvent.button, finger.target || originalEvent.relatedTarget
        );

        e.synthetic = true;
        e._finger = finger;

        return e;
    }

    var startDistance = NaN;
    var startAngle = NaN;

    function fireTouchEvents(eventName, originalEvent) {
        var events = [];
        var gestures = [];

        var alreadyHandledIds = [];
        var indexOfPidInEvents = {};

        var fingersEach = function(finger, pid) {
            if (!finger.target) {
                console.error("No target is error condition");
                return;
            }
            debug("At least one target got through");

            var onEventName = 'on' + eventName;

            if (onEventName in finger.target) {
                debug('Converting `' + onEventName + '` property to event listener.', finger.target);
                finger.target.addEventListener(eventName, finger.target[onEventName], false);
                delete finger.target[onEventName];
            }

            if (finger.target.hasAttribute(onEventName)) {
                debug('Converting `' + onEventName + '` attribute to event listener.', finger.target);
                var handler = new GLOBAL.Function('event', finger.target.getAttribute(onEventName));
                finger.target.addEventListener(eventName, handler, false);
                finger.target.removeAttribute(onEventName);
            }

            var touch = createMouseEvent(eventName, originalEvent, finger);

            touch._pointerID = pid;
            touch.toolData = finger.toolData;

            var identifier = __touchIdentifierForPid[pid];
            if(!isDefined(identifier)) {
                identifier = -1;
            }

            touch.identifier = identifier;

            if(alreadyHandledIds.indexOf(touch._pointerID) === -1) {
                alreadyHandledIds.push(touch._pointerID);
                events.push(touch);
                indexOfPidInEvents[touch._pointerID] = events.length - 1;
            } else {
                events[indexOfPidInEvents[touch._pointerID]] = touch;
            }
        };

        for (var i in fingers) {
            fingersEach(fingers[i], i);
        }

        if (events.length > 1) {
            var x = events[0].pageX - events[1].pageX;
            var y = events[0].pageY - events[1].pageY;

            var distance = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
            var angle = Math.atan2(x, y) * (180 / Math.PI);

            var gestureName = 'gesturechange';

            if (eventName === 'touchstart') {
                gestureName = 'gesturestart';
                startDistance = distance;
                startAngle = angle;
            }

            if (eventName === 'touchend') gestureName = 'gestureend';

            events.forEach(function(event) {
                var gesture = createMouseEvent(gestureName, event, event._finger);
                gestures.push(gesture);
            });

            events.concat(gestures).forEach(function(event) {
                event.scale = distance / startDistance;
                event.rotation = startAngle - angle;
            });
        }

        try {
            events.forEach(function(touch) {
                touch.touches = events.filter(function(e) {
                    return ~e.type.indexOf('touch') && e.type !== 'touchend';
                });

                touch.changedTouches = [];

                if(~touch.type.indexOf('touchstart')) {
                    touch.changedTouches = events.filter(function(e) {
                        return ~e.type.indexOf('touchstart') && e._finger.target === touch._finger.target;
                    });
                }

                if(~touch.type.indexOf('touchmove')) {
                    touch.changedTouches = events.filter(function(e) {
                        return ~e.type.indexOf('touchmove') && e._finger.target === touch._finger.target;
                    });
                }

                if(~touch.type.indexOf('touchend')) {
                    touch.changedTouches = events.filter(function(e) {
                        return ~e.type.indexOf('touchend') && e._finger.target === touch._finger.target;
                    });
                }

                touch.targetTouches = touch.changedTouches.filter(function(e) {
                    return ~e.type.indexOf('touch') && e.type !== 'touchend';
                });
            });
        } catch (e) {
            debug("forEach stack overflow: " + e);
        }

        events.concat(gestures).forEach(function(event, i) {
            var identifier = __touchIdentifierForPid[event._pointerID];
            if(!isDefined(identifier)) {
                identifier = -1;
            }

            event.identifier = identifier;
            event._finger.target.dispatchEvent(event);
        });
    }

    function dispatchTouchStart(e) {
        if (e.synthetic) return;
        if (!isDefined(e._pointerID)) {
            console.error("e with no pid");
            return;
        }

        moveFingers(e);

        e.preventDefault();
        e.stopPropagation();

        fireTouchEvents('touchstart', e);
    }

    var centerX = NaN;
    var centerY = NaN;

    function moveFingers(e) {
        if(!isDefined(fingers[e._pointerID])) {
            var f = new Finger();
            f.toolData = e.toolData;
            fingers[e._pointerID] = f;
        }
        fingers[e._pointerID].move(e.clientX, e.clientY, e);

        centerX = NaN;
        centerY = NaN;
    }

    function dispatchTouchMove(e) {
        if (e.synthetic) return;
        if (!isDefined(e._pointerID)) {
            console.error("e with no _pointerID");
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        moveFingers(e);

        if (isDefined(fingers[e._pointerID])) {
            fireTouchEvents('touchmove', e);
        }
    }

    function dispatchTouchEnd(e) {
        if (e.synthetic) return;
        if (!isDefined(e._pointerID)) {
            console.error("e with no _pointerID");
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        fireTouchEvents('touchend', e);

        for(var i in fingers) {
            var finger = fingers[i];
            finger.hide();

            debug(finger.target);

            if (finger.target && !isDefined(window.SB.disableEventDispatch)) {
                finger.target.dispatchEvent(createMouseEvent('mouseover', e, finger));
                finger.target.dispatchEvent(createMouseEvent('mousemove', e, finger));
                finger.target.dispatchEvent(createMouseEvent('mousedown', e, finger));

                finger.target.dispatchEvent(createMouseEvent('mouseup', e, finger));
                finger.target.dispatchEvent(createMouseEvent('click', e, finger));
            }

            fingers[i].remove();
            delete fingers[i];
        }
    }

    var defaultCSS = ([
		'<style type="text/css" id="_smartboard-js-style">',
        '._smartboard-js,',
        '._smartboard-js a {',
        '}',
        '._smartboard-touch-point {',
            'background: rgba(128, 128, 128, 0.5);',
            'border: 2px solid rgb(128, 128, 128);',
            'border-radius: 50%;',
            'display: none;',
            'height: 24px;',
            'margin: -13px 0 0 -13px;',
            'position: fixed;',
            'width: 24px;',
            'font-size: 8px;',
            'font-family: arial;',
            'z-index: 999989',
        '}',
        '._smartboard-js ._smartboard-touch-point {',
            'display: block;',
        '}',
        '.smartboard-no-touch {',
            'position: relative;',
            'z-index: 999999;',
        '}',
		'</style>'
    ]).join('\n');

	$(defaultCSS).appendTo('head');

    function start() {
        $(document.documentElement).addClass('_smartboard-js');
    }

    function stop() {
        $(document.documentElement).removeClass('_smartboard-js');
    }

    var smartDispatch = {
        start: start,
        stop: stop
    };

    smartDispatch.init = function() { };

    if (typeof GLOBAL.define === 'function') {
        GLOBAL.define(smartDispatch);
    } else if (typeof GLOBAL.exports !== 'undefined') {
        GLOBAL.exports = smartDispatch;
    } else {
        GLOBAL.smartDispatch = smartDispatch;
    }

    window.smartDispatch = smartDispatch;

    smartDispatch.dispatchTouchStart = dispatchTouchStart;
    smartDispatch.dispatchTouchMove = dispatchTouchMove;
    smartDispatch.dispatchTouchEnd = dispatchTouchEnd;
    smartDispatch.fireTouchEvents = fireTouchEvents;

    start();

}(this, jQuery));

};

(function ($) {
    var debug = window._SB_debug;
    var isDefined = window._SB_isDefined;
    var defaultCSS = ([
				'<style type="text/css" id="_owlCSSStyle">',
                '#_SB_notifications {',
                    'top: 20px;',
                    'left: 50%;',
                    'width: 400px;',
                    'margin-left: -200px;',
                    'background: #fff;',
                    'background: -webkit-linear-gradient(#fff, #dbdbdb);',
                    'background: -moz-linear-gradient(#fff, #dbdbdb);',
                    'border-radius: 6px;',
                    '-webkit-box-shadow: white 0px -1px 0px inset, rgba(0,0,0,0.5) 0px 4px 30px;',
                    '-moz-box-shadow: white 0px -1px 0px inset, rgba(0,0,0,0.5) 0px 4px 30px;',
                    'box-shadow: white 0px -1px 0px inset, rgba(0,0,0,0.5) 0px 4px 30px;',
                    'overflow: hidden;',
                    'position: absolute;',
                    'z-index: 999999;',
                    'max-height: 529px;',
                    'overflow-y: hidden;',
                    'color: #000000;',
                    'text-shadow: white 0px 1px 0px;',
                    'font: normal 12px HelveticaNeue, Helvetica, Arial, sans-serif;',
                    'font-family: HelveticaNeue, Helvetica, Arial, sans-serif;',
                    '-webkit-text-stroke: 1px transparent;',
                    'text-align: left;',
                '}',
                '._SB_notifications {',
                    'z-index: 999998;',
                    'position: relative;',
                '}',
                '._SB_notifications h2 {',
                    'font: normal 12px HelveticaNeue, Helvetica, Arial, sans-serif;',
                    'line-height: normal;',
                    'display: block;',
                    'font-weight: bold;',
                    'position: static;',
                    'letter-spacing: 0px;',
                    'text-transform: none;',
                    'color: #000000;',
                    'padding: 0px;',
                    'margin: 0px;',
                    'vertical-align: baseline;',
                '}',
                '._SB_notifications ul {',
                    'font: normal 12px HelveticaNeue, Helvetica, Arial, sans-serif;',
                    'list-style: disc outside none;',
                    'margin: 1em;',
                    'margin-left: 40px;',
                    'padding: 0;',
                '}',
                '._SB_notifications li {',
                    'font: normal 12px HelveticaNeue, Helvetica, Arial, sans-serif;',
                    'list-style: disc outside none;',
                    'padding: 0;',
                '}',
                '._SB_notifications li::before {',
                    'content: "";',
                '}',
                '._SB_notifications._SB_more {',
                    'border-bottom: 1px solid #c1c1c1;',
                    '-webkit-box-shadow: white 0px 1px 0px;',
                    '-moz-box-shadow: white 0px 1px 0px;',
                    'box-shadow: white 0px 1px 0px;',
                    'text-align: left',
                '}',
                '._SB_notifications._SB_error {',
                    'background: #FA565D;',
                    'background: -webkit-linear-gradient(#FA565D, #D1363D);',
                    'background: -moz-linear-gradient(#FA565D, #D1363D);',
                    '-moz-border-radius: 5px;',
                    '-webkit-border-radius: 5px;',
                    'border-radius: 5px;',
                    'text-align: left',
                '}',
                '._SB_notifications._SB_error * {',
                    'color: white!important;',
                    'text-shadow: rgba(0,0,0,0.4) 0px 1px 1px!important;',
                '}',
                '._SB_notifications._SB_error ._SB_left:after {',
                    'background: rgba(255,255,255,0.5)!important;',
                    'box-shadow: rgba(0,0,0,0.4) 0px 1px 1px!important;',
                '}',
                '._SB_notifications.green {',
                    'background: #A8DBA8;',
                    'background-image: -webkit-linear-gradient(rgba(0, 0, 0, 0.0), rgba(0, 0, 0, 0.2));',
                    '-moz-border-radius: 5px;',
                    '-webkit-border-radius: 5px;',
                    'border-radius: 5px;',
                '}',
                '._SB_notifications.green * {',
                    'color: white!important;',
                    'text-shadow: rgba(0,0,0,0.4) 0px 1px 1px!important;',
                '}',
                '._SB_notifications.green ._SB_left:after {',
                    'background: rgba(255,255,255,0.5)!important;',
                    'box-shadow: rgba(0,0,0,0.4) 0px 1px 1px!important;',
                '}',
                '._SB_notifications.click {',
                    'cursor: pointer;',
                '}',
                '._SB_notifications .hide, .modal .hide {',
                    'position: absolute;',
                    'display: block;',
                    'right: 5px;',
                    'top: 7px;',
                    'cursor: pointer;',
                    'color: white;',
                    'font-weight: bold;',
                    'width: 12px;',
                    'height: 12px;',
                    'background: url(data:image/png;base64,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) no-repeat;',
                    'opacity: 0.7;',
                    'display: none;',
                    'text-indent: -999px;',
                    'overflow: hidden;',
                '}',
                '.modal .hide:before {',
                    'position: relative;',
                    'top: 3px;',
                '}',
                '._SB_notifications .hide:before, .modal .hide:before {',
                    'content: "x";',
                '}',
                '._SB_notifications .hide:hover {',
                    'opacity: 1;',
                '}',
                '._SB_notifications ._SB_right, ._SB_notifications ._SB_left {',
                    'width: 350px;',
                    'height: 100%;',
                    'float: left;',
                    'position: relative;',
                '}',
                '._SB_notifications .time {',
                    'font-size: 9px;',
                    'position: relative;',
                '}',
                '._SB_notifications ._SB_right .time {',
                    'margin-left: 10px;',
                    'margin-top: -8px;',
                    'margin-bottom: 10px;',
                    'opacity: 0.4;',
                '}',
                '._SB_notifications ._SB_left {',
                    'height: 100%;',
                    'width: 30px;',
                    'padding: 10px;',
                    'position: absolute;',
                    'padding-top: 0px;',
                    'padding-bottom: 0px;',
                    'overflow: hidden;',
                '}',
                '._SB_notifications ._SB_right {',
                    'margin-left: 50px;',
                '}',
                '._SB_notifications ._SB_right ._SB_inner {',
                    'font: normal 12px HelveticaNeue, Helvetica, Arial, sans-serif;',
                    'padding: 10px;',
                '}',
                '._SB_notifications ._SB_left:after {',
                    'content: "";',
                    'background: #c1c1c1;',
                    '-moz-box-shadow: white 1px 0px 0px;',
                    '-webkit-box-shadow: white 1px 0px 0px;',
                    'box-shadow: white 1px 0px 0px;',
                    'width: 1px;',
                    'height: 100%;',
                    'position: absolute;',
                    'top: 0px;',
                    'right: 0px;',
                '}',
                '._SB_notifications .img {',
                    'width: 30px;',
                    'background-size: auto 100%;',
                    'background-position: center;',
                    'height: 30px;',
                    '-moz-border-radius: 6px;',
                    '-webkit-border-radius: 6px;',
                    'border-radius: 6px;',
                    '-webkit-box-shadow: rgba(255,255,255,0.9) 0px -1px 0px inset, rgba(0,0,0,0.2) 0px 1px 2px;',
                    '-moz-box-shadow: rgba(255,255,255,0.9) 0px -1px 0px inset, rgba(0,0,0,0.2) 0px 1px 2px;',
                    'box-shadow: rgba(255,255,255,0.9) 0px -1px 0px inset, rgba(0,0,0,0.2) 0px 1px 2px;',
                    'border: 1px solid rgba(0,0,0,0.55);',
                    'position: absolute;',
                    'top: 50%;',
                    'margin-top: -15px;',
                '}',
                '._SB_notifications .img.border {',
                    'box-shadow: none;',
                    'border: none;',
                '}',
                '._SB_notifications .img.fill {',
                    'top: 0px;',
                    'margin: 0px;',
                    'border: none;',
                    'left: 0px;',
                    'width: 100%;',
                    'height: 100%;',
                    '-moz-border-radius: 0px;',
                    '-webkit-border-radius: 0px;',
                    'border-radius: 0px;',
                    '-webkit-box-shadow: rgba(0,0,0,0.2) 0px 1px 0px inset, black -1px 0px 16px inset;',
                    '-moz-box-shadow: rgba(0,0,0,0.2) 0px 1px 0px inset, black -1px 0px 16px inset;',
                    'box-shadow: rgba(0,0,0,0.2) 0px 1px 0px inset, black -1px 0px 16px inset;',
                    'background-color: #333;',
                '}',
                '._SB_notifications:first-child .img.fill {',
                    '-moz-border-radius-topleft: 5px;',
                    '-webkit-border-top-left-radius: 5px;',
                    'border-top-left-radius: 5px;',
                '}',
                '._SB_notifications:last-child .img.fill {',
                    '-moz-border-radius-bottomleft: 5px;',
                    '-webkit-border-bottom-left-radius: 5px;',
                    'border-bottom-left-radius: 5px;',
                '}',
                '._SB_notifications ._SB_left > ._SB_icon {',
                    'position: absolute;',
                    'top: 7px;',
                    'left: 0px;',
                    'height: 100%;',
                    'width: 100%;',
                    'text-align: center;',
                    'line-height: 50px;',
                    'font: normal 40px/28px "EntypoRegular";',
                    'text-shadow: white 0px 1px 0px;',
                '}',
                '._SB_notifications._SB_big ._SB_left > ._SB_icon {',
                    'font-size: 60px;',
                    'line-height: 38px;',
                '}',
                '._SB_notifications:after {',
                    'content: "."; ',
                    'visibility: hidden; ',
                    'display: block; ',
                    'clear: both; ',
                    'height: 0; ',
                    'font-size: 0;',
                '}',
                '._SB_notifications h2 {',
                    'font-size: 14px;',
                    'margin: 0px;',
                '}',
                '',
                '._SB_animated {',
                    '-webkit-animation: 1s ease;',
                       '-moz-animation: 1s ease;',
                        '-ms-animation: 1s ease;',
                         '-o-animation: 1s ease;',
                            'animation: 1s ease;',
                    '-webkit-animation-fill-mode: both;',
                       '-moz-animation-fill-mode: both;',
                        '-ms-animation-fill-mode: both;',
                         '-o-animation-fill-mode: both;',
                            'animation-fill-mode: both;',
                '}',
                '._SB_animated._SB_fast {',
                    '-webkit-animation-duration: 0.4s;',
                        '-moz-animation-duration: 0.4s;',
                        '-ms-animation-duration: 0.4s;',
                        '-o-animation-duration: 0.4s;',
                        'animation-duration: 0.4s;',
                '}',
                '',
                '@-webkit-keyframes fadeInLeftMiddle {',
                    '0% {',
                        'opacity: 0.5;',
                        '-webkit-transform: translateX(-400px);',
                    '}',
                    '',
                    '100% {',
                        'opacity: 1;',
                        '-webkit-transform: translateX(0);',
                    '}',
                '}',
                '@-moz-keyframes fadeInLeftMiddle {',
                    '0% {',
                        'opacity: 0.5;',
                        '-moz-transform: translateX(-400px);',
                    '}',
                    '',
                    '100% {',
                        'opacity: 1;',
                        '-moz-transform: translateX(0);',
                    '}',
                '}',
                '@-ms-keyframes fadeInLeftMiddle {',
                    '0% {',
                        'opacity: 0.5;',
                        '-ms-transform: translateX(-400px);',
                    '}',
                    '',
                    '100% {',
                        'opacity: 1;',
                        '-ms-transform: translateX(0);',
                    '}',
                '}',
                '@-o-keyframes fadeInLeftMiddle {',
                    '0% {',
                        'opacity: 0.5;',
                        '-o-transform: translateX(-400px);',
                    '}',
                    '',
                    '100% {',
                        'opacity: 1;',
                        '-o-transform: translateX(0);',
                    '}',
                '}',
                '@keyframes fadeInLeftMiddle {',
                    '0% {',
                        'opacity: 0.5;',
                        'transform: translateX(-400px);',
                    '}',
                    '',
                    '100% {',
                        'opacity: 1;',
                        'transform: translateX(0);',
                    '}',
                '}',
                '',
                '.fadeInLeftMiddle {',
                    '-webkit-animation-name: fadeInLeftMiddle;',
                    '-moz-animation-name: fadeInLeftMiddle;',
                    '-ms-animation-name: fadeInLeftMiddle;',
                    '-o-animation-name: fadeInLeftMiddle;',
                    'animation-name: fadeInLeftMiddle;',
                '}',
                '@-webkit-keyframes flipInX {',
                    '0% {',
                        '-webkit-transform: perspective(400px) rotateX(90deg);',
                        'opacity: 0;',
                    '}',
                    '',
                    '40% {',
                        '-webkit-transform: perspective(400px) rotateX(-10deg);',
                    '}',
                    '',
                    '70% {',
                        '-webkit-transform: perspective(400px) rotateX(10deg);',
                    '}',
                    '',
                    '100% {',
                        '-webkit-transform: perspective(400px) rotateX(0deg);',
                        'opacity: 1;',
                    '}',
                '}',
                '@-moz-keyframes flipInX {',
                    '0% {',
                        '-moz-transform: perspective(400px) rotateX(90deg);',
                        'opacity: 0;',
                    '}',
                    '',
                    '40% {',
                        '-moz-transform: perspective(400px) rotateX(-10deg);',
                    '}',
                    '',
                    '70% {',
                        '-moz-transform: perspective(400px) rotateX(10deg);',
                    '}',
                    '',
                    '100% {',
                        '-moz-transform: perspective(400px) rotateX(0deg);',
                        'opacity: 1;',
                    '}',
                '}',
                '@-ms-keyframes flipInX {',
                    '0% {',
                        '-ms-transform: perspective(400px) rotateX(90deg);',
                        'opacity: 0;',
                    '}',
                    '',
                    '40% {',
                        '-ms-transform: perspective(400px) rotateX(-10deg);',
                    '}',
                    '',
                    '70% {',
                        '-ms-transform: perspective(400px) rotateX(10deg);',
                    '}',
                    '',
                    '100% {',
                        '-ms-transform: perspective(400px) rotateX(0deg);',
                        'opacity: 1;',
                    '}',
                '}',
                '@-o-keyframes flipInX {',
                    '0% {',
                        '-o-transform: perspective(400px) rotateX(90deg);',
                        'opacity: 0;',
                    '}',
                    '',
                    '40% {',
                        '-o-transform: perspective(400px) rotateX(-10deg);',
                    '}',
                    '',
                    '70% {',
                        '-o-transform: perspective(400px) rotateX(10deg);',
                    '}',
                    '',
                    '100% {',
                        '-o-transform: perspective(400px) rotateX(0deg);',
                        'opacity: 1;',
                    '}',
                '}',
                '@keyframes flipInX {',
                    '0% {',
                        'transform: perspective(400px) rotateX(90deg);',
                        'opacity: 0;',
                    '}',
                    '',
                    '40% {',
                        'transform: perspective(400px) rotateX(-10deg);',
                    '}',
                    '',
                    '70% {',
                        'transform: perspective(400px) rotateX(10deg);',
                    '}',
                    '',
                    '100% {',
                        'transform: perspective(400px) rotateX(0deg);',
                        'opacity: 1;',
                    '}',
                '}',
                '',
                '.flipInX {',
                    '-webkit-backface-visibility: visible !important;',
                    '-webkit-animation-name: flipInX;',
                    '-moz-backface-visibility: visible !important;',
                    '-moz-animation-name: flipInX;',
                    '-ms-backface-visibility: visible !important;',
                    '-ms-animation-name: flipInX;',
                    '-o-backface-visibility: visible !important;',
                    '-o-animation-name: flipInX;',
                    'backface-visibility: visible !important;',
                    'animation-name: flipInX;',
                '}',
                '@font-face {',
                    'font-family: "EntypoRegular";',
                    'src: url(data:application/x-font-woff;charset=utf-8;base64,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) format("woff"),',
                    'url("entypo-webfont-webfont.ttf") format("truetype");',
                    'font-weight: normal;',
                    'font-style: normal;',
                '',
                '}',
				'</style>'
        ]).join('\n');

	$(defaultCSS).appendTo('head');

    $.notification = function (settings) {
       	var con, notification, hide, image, right, left, inner;

        settings = $.extend({
        	title: undefined,
        	content: undefined,
        	timeout: 0,
        	img: undefined,
        	border: true,
        	fill: false,
        	showTime: false,
        	click: undefined,
        	icon: undefined,
        	color: undefined,
        	error: false,
            okay: false
        }, settings);

        if(isDefined(SB) && SB.disableBanners) {
            return;
        }

        con = $("#_SB_notifications");
        if (!con.length) {
            con = $("<div>", { id: "_SB_notifications" }).appendTo( $("body") );
        }

		notification = $("<div>");
        notification.addClass("_SB_notifications _SB_animated fadeInLeftMiddle _SB_fast");

        if(settings.error === true) {
        	notification.addClass("_SB_error");
        }

        if(settings.okay === true) {
        	notification.addClass("green");
        }

        if( $("#_SB_notifications ._SB_notifications").length > 0 ) {
        	notification.addClass("_SB_more");
        } else {
        	con.addClass("_SB_animated flipInX").delay(1000).queue(function(){
        	    con.removeClass("_SB_animated flipInX");
        			con.clearQueue();
        	});
        }

        hide = $("<div>", {
			click: function () {


				if($(this).parent().is(':last-child')) {
				    $(this).parent().remove();
				    $('#_SB_notifications ._SB_notifications:last-child').removeClass("_SB_more");
				} else {
					$(this).parent().remove();
				}
			}
		});

		hide.addClass("hide");

		left = $("<div class='_SB_left'>");
		right = $("<div class='_SB_right'>");

		if(settings.title !== undefined) {
			var htmlTitle = "<h2>" + settings.title + "</h2>";
			notification.addClass("_SB_big");
		} else {
			var htmlTitle = "";
		}

		if(settings.content !== undefined) {
			var htmlContent = settings.content;
		} else {
			var htmlContent = "";
		}

		inner = $("<div>", { html: htmlTitle + htmlContent });
		inner.addClass("_SB_inner");

		inner.appendTo(right);

		if (settings.img !== undefined) {
			image = $("<div>", {
				style: "background-image: url('"+settings.img+"')"
			});

			image.addClass("img");
			image.appendTo(left);

			if(settings.border === false) {
				image.addClass("border");
			}

			if(settings.fill == true) {
				image.addClass("fill");
			}

		} else {
			if (settings.icon !== undefined) {
				var iconType = settings.icon;
			} else {
                var iconType = 'o';
				if(settings.error === true) { var iconType = 'c'; }
				if(settings.okay === true) { var iconType = 'W'; }
			}
			icon = $('<div class="_SB_icon">').html(iconType);

			if (settings.color !== undefined) {
				icon.css("color", settings.color);
			}

			icon.appendTo(left);
		}

        left.appendTo(notification);
        right.appendTo(notification);

        hide.appendTo(notification);

        function timeSince(time){
        	var time_formats = [
        	  [2, "One second", "1 second from now"],
        	  [60, "seconds", 1],
        	  [120, "One minute", "1 minute from now"],
        	  [3600, "minutes", 60],
        	  [7200, "One hour", "1 hour from now"],
        	  [86400, "hours", 3600],
        	  [172800, "One day", "tomorrow"],
        	  [604800, "days", 86400],
        	  [1209600, "One week", "next week"],
        	  [2419200, "weeks", 604800],
        	  [4838400, "One month", "next month"],
        	  [29030400, "months", 2419200],
        	  [58060800, "One year", "next year"],
        	  [2903040000, "years", 29030400],
        	  [5806080000, "One century", "next century"],
        	  [58060800000, "centuries", 2903040000]
        	];

        	var seconds = (new Date() - time) / 1000;
        	var token = "ago", list_choice = 1;
        	if (seconds < 0) {
        		seconds = Math.abs(seconds);
        		token = "from now";
        		list_choice = 1;
        	}
        	var i = 0, format;

        	while (format = time_formats[i++]) if (seconds < format[0]) {
        		if (typeof format[2] == "string")
        			return format[list_choice];
        	    else
        			return Math.floor(seconds / format[2]) + " " + format[1];
        	}
        	return time;
        }

        if(settings.showTime !== false) {
        	var timestamp = Number(new Date());

        	timeHTML = $("<div>", { html: "<strong>" + timeSince(timestamp) + "</strong> ago" });
        	timeHTML.addClass("time").attr("title", timestamp);
        	timeHTML.appendTo(right);

        	setInterval(
	        	function() {
	        		$(".time").each(function () {
	        			var timing = $(this).attr("title");
	        			$(this).html("<strong>" + timeSince(timing) + "</strong> ago");
	        		});
	        	}, 4000);

        }

        notification.hover(
        	function () {
            	hide.show();
        	},
        	function () {
        		hide.hide();
        	}
        );

        notification.prependTo(con);
		notification.show();

        if (settings.timeout) {
            setTimeout(function () {
            	var prev = notification.prev();
            	if(prev.hasClass("_SB_more")) {
            		if(prev.is(":first-child") || notification.is(":last-child")) {
            			prev.removeClass("_SB_more");
            		}
            	}
	        	notification.remove();
            }, settings.timeout);
        }

        if (settings.click !== undefined) {
        	notification.addClass("click");
            notification.bind("click", function (event) {
            	var target = $(event.target);
                if(!target.is(".hide") ) {
                    settings.click.call(this);
                }
            });
        }
        return this;
    };
})($);


(function($) {
    var debug = window._SB_debug;
    var isDefined = window._SB_isDefined;
    var SBInput = {};
    window.SBInput = SBInput;

    var defaultCSS = ([ '<style type="text/css" id="_smartboard-ink-panel-style">',
						'._smartboard-ink-panel {',
                        '    background-color: rgba(0, 0, 0, 0.0);',
                        '    z-index: 999988; ',
                        '    cursor: none;',
                        '}',
                        '._smartboard-ink-panel canvas {',
                        '    background-color: rgba(0,0,0,0.1);',
                        '	 border-radius: 15px;',
                        '    position: relative;',
                        '    top: 1px #0A0 solid; ',
                        '}',
						'</style>'
    ]).join('\n');

	$(defaultCSS).appendTo('head');

    var _currentIcon = null;
    var _currentPanel = null;
    var _currentElement = null;
    var _currentRawElement = null;
    var _currentSketchObject = null;
    var _currentElementBorderProperties = "";

    var _addIcon = function(el) {
        var elem = $(el);
        var offset = elem.offset();
        var height = Math.min(elem.outerHeight() + 2, 32);

        _currentElement = elem;
        _currentRawElement = el;
    };

    var _showPanel = function(el) {
        var elem = $(el);
        var offset = elem.offset();
        var borders = 20;
        var width = 0;
        var height = 0;
        var top = 0;
        var left = 0;

        width = Math.max(width, elem.width() + borders);
        height = Math.max(height, elem.height() + borders);
        top = offset.top - (borders / 2.0);
        left = offset.left - (borders / 2.0);

        if(_currentPanel) {
            _currentSketchObject.upInk(null, 0);
            _currentPanel.remove();
            _currentPanel = null;
        }
        _currentPanel = $('<div class="_smartboard-ink-panel"></div>')
                            .css("position", "absolute")
                            .css("width", width + "px")
                            .offset({ top: top, left: left })
                            .appendTo($(document.body));
        var _sketch = $('<canvas width="' + width + '" height="' + height + '"></canvas>');
        _sketch.sketch( { SBInputElement: el } );
        _currentSketchObject = _sketch.sketch();
        _sketch.appendTo(_currentPanel);
        _sketch.trigger("touchstart");
    };

    SBInput.attach = function(el) {
        if(el && el == _currentRawElement) {
            debug("already attached");
            return;
        }
        _addIcon(el);
       debug("attached");
    };

    SBInput.detach = function(el) {
       _currentElement = null;
       _currentRawElement = null;
    };

    SBInput.removePanel = function() {
       if(_currentPanel) {
           _currentPanel.fadeOut("fast", function() { $(this).remove(); });
       }
       _currentElement = null;
       _currentRawElement = null;
    };

    window.SBInput._alreadyLoaded = false;
    SBInput.attachToDocument = function() {
       if(window.SBInput._alreadyLoaded) { debug("input again?"); return; }
       window.SBInput._alreadyLoaded = true;
       $.each($("input[type=text], input[type=search], textarea"), function(k, v) {
            $(v).bind('touchstart', function(evt) {
                if(isDefined(evt.originalEvent) && isDefined(evt.originalEvent.toolData)) {
                    if(evt.originalEvent.toolData["tool"] == "pen") {
                        _currentRawElement = this;
                        _currentElement = $(this);
                        _showPanel(this);
                        evt.originalEvent._finger.retarget();
                        window.SBInput._currentElementBorderProperties = _currentElementBorderProperties = $(this)[0].style.border;
                        $(this).css("border", "1px #F00 solid");
                    }

                    if(evt.originalEvent.toolData["tool"] == "eraser") {
                       var el = $(this);
                       if(isDefined(el) && el && isDefined(el.val)) {
                           el.val("");
                       }
                    }

                    if(evt.originalEvent.toolData["tool"] == "finger") {
                        this.focus();
                        this.select();
                    }
                } else {
                    return;
                }
            });
       });
       $.each($("button"), function(k, v) {
            $(v).bind('touchend', function() {
                try {
                    this.form.submit();
                } catch (e) {
                }
            });
       });
    };
})($);

(function($) {
  var __slice = Array.prototype.slice;
  var debug = window._SB_debug;
  var isDefined = window._SB_isDefined;
  var Sketch;
  $.fn.sketch = function() {
    var args, key, sketch;
    key = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    if (this.length > 1) {
      $.error('Sketch.js can only be called on one element at a time.');
    }
    sketch = this.data('sketch');
    if (typeof key === 'string' && sketch) {
      if (sketch[key]) {
        if (typeof sketch[key] === 'function') {
          return sketch[key].apply(sketch, args);
        } else if (args.length === 0) {
          return sketch[key];
        } else if (args.length === 1) {
          return sketch[key] = args[0];
        }
      } else {
        return $.error('Sketch.js did not recognize the given command.');
      }
    } else if (sketch) {
      return sketch;
    } else {
      this.data('sketch', new Sketch(this.get(0), key));
      return this;
    }
  };
  Sketch = (function($) {
    function Sketch(el, opts) {
      this.el = el;
      this.canvas = $(el);
      this.context = el.getContext('2d');
      this.options = $.extend({
        toolLinks: true,
        defaultTool: 'marker',
        defaultColor: '#00caee',
        defaultSize: 2,
        forSBInput: false,
        SBInputElement: null
      }, opts);
      this.painting = false;
      this.color = this.options.defaultColor;
      this.size = this.options.defaultSize;
      this.tool = this.options.defaultTool;
      this.actions = [];
      this.action = [];
      this.canvas.bind('click mousedown mouseup mousemove mouseleave mouseout touchstart touchmove touchend touchcancel', this.onEvent);

      this.invalidTimer = -1;
      this.alreadyInvalid = false;
      this.writingInProgress = false;
      var writing = [[]];
      this.forSBInput = this.options.forSBInput;
      this.SBInputElement = this.options.SBInputElement;

      Sketch.prototype.inking = function (x, y) {
            if(!this.writingInProgress) {
                this.writingInProgress = true;
            }

            writing[writing.length - 1].push([parseInt(x, 10), parseInt(y, 10)]);

            clearTimeout(window.SBInput.currentWaitingTimer);

      };


      Sketch.prototype.upInk = function (evt, secondsToWait) {
          clearTimeout(window.SBInput.currentWaitingTimer);

          if(!this.writingInProgress) {
              debug("got an up while not inking");
              return;
          }

          writing.push([]);

          var s = this;
          if(secondsToWait === 0) {
              s.finishedInking();
              s.writingInProgress = false;
              s.painting = false;
          } else {
              window.SBInput.currentWaitingTimer = setTimeout(function() { s.finishedInking(); }, secondsToWait * 1000);
          }
      };

        function getInputSelection(el) {
            if(!isDefined(el)) { return; }
            if(el === null) { return; }

            var start = 0, end = 0, normalizedValue, range,
                textInputRange, len, endRange;

            if (typeof el.selectionStart == "number" && typeof el.selectionEnd == "number") {
                start = el.selectionStart;
                end = el.selectionEnd;
            } else {
                range = document.selection.createRange();

                if (range && range.parentElement() == el) {
                    len = el.value.length;
                    normalizedValue = el.value.replace(/\r\n/g, "\n");

                    textInputRange = el.createTextRange();
                    textInputRange.moveToBookmark(range.getBookmark());

                    endRange = el.createTextRange();
                    endRange.collapse(false);

                    if (textInputRange.compareEndPoints("StartToEnd", endRange) > -1) {
                        start = end = len;
                    } else {
                        start = -textInputRange.moveStart("character", -len);
                        start += normalizedValue.slice(0, start).split("\n").length - 1;

                        if (textInputRange.compareEndPoints("EndToEnd", endRange) > -1) {
                            end = len;
                        } else {
                            end = -textInputRange.moveEnd("character", -len);
                            end += normalizedValue.slice(0, end).split("\n").length - 1;
                        }
                    }
                }
            }

            return {
                start: start,
                end: end
            };
        }

        function replaceSelectedText(el, text) {
            if(!isDefined(el)) { return; }
            if(el === null) { return; }

            var sel = getInputSelection(el), val = el.value;
            el.value = val.slice(0, sel.start) + text + val.slice(sel.end);
        }


      Sketch.prototype.finishedInking = function (evt) {
          clearTimeout(window.SBInput.currentWaitingTimer);
          window.SBInput.currentWaitingTimer = this.invalidTimer;

          var thisElem = this.SBInputElement;
		  SB.getTextForPoints(writing, function(text) {
                debug("HWR set text: " + text);
                if(isDefined(thisElem)) {
                   $(thisElem).css("border", window.SBInput._currentElementBorderProperties);
                   replaceSelectedText(thisElem, text + " ");
                }
          });

          SBInput.removePanel();

          writing = [[]];
          this.writingInProgress = false;
      };

      if (this.options.toolLinks) {
        $('body').delegate("a[href=\"#" + (this.canvas.attr('id')) + "\"]", 'click', function(e) {
          var $canvas, $this, key, sketch, _i, _len, _ref;
          $this = $(this);
          $canvas = $($this.attr('href'));
          sketch = $canvas.data('sketch');
          _ref = ['color', 'size', 'tool'];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            key = _ref[_i];
            if ($this.attr("data-" + key)) {
              sketch.set(key, $(this).attr("data-" + key));
            }
          }
          if ($(this).attr('data-download')) {
            sketch.download($(this).attr('data-download'));
          }
          return false;
        });
      }
    }
    Sketch.prototype.download = function(format) {
      var mime;
      format || (format = "png");
      if (format === "jpg") {
        format = "jpeg";
      }
      mime = "image/" + format;
      return window.open(this.el.toDataURL(mime));
    };
    Sketch.prototype.set = function(key, value) {
      this[key] = value;
      return this.canvas.trigger("sketch.change" + key, value);
    };
    Sketch.prototype.startPainting = function() {
      if(this.painting) return;
      this.painting = true;
      return this.action = {
        tool: this.tool,
        color: this.color,
        size: parseFloat(this.size),
        events: []
      };
    };
    Sketch.prototype.stopPainting = function() {
      if (this.action) {
        this.actions.push(this.action);
      }
      if(this.painting) {
        this.upInk(null, 3);
      }
      this.painting = false;
      this.action = null;
      return this.redraw();
    };
    Sketch.prototype.onEvent = function(e) {
      if(e.originalEvent && isDefined(e.originalEvent.targetTouches) && e.type != "touchend" ) {
        e.pageX = e.originalEvent.targetTouches[0].pageX;
        e.pageY = e.originalEvent.targetTouches[0].pageY;
        if($.browser.msie) {
            e.pageX = e.originalEvent.targetTouches[0].clientX + $(window).scrollLeft();
            e.pageY = e.originalEvent.targetTouches[0].clientY + $(window).scrollTop();
        }
      }

      if(isDefined(e.originalEvent) && isDefined(e.originalEvent.toolData)) {
        if(e.originalEvent.toolData["tool"] === "finger") {
            if(e.type == "touchstart") {
                $(this).sketch().upInk(e, 0);
                SBInput.removePanel();
                this.painting = false;
                e.preventDefault();
                return false;
            }
            if(e.type == "touchmove") {
                return false;
            }
        }
      }

      var currentTool = $.sketch.tools[$(this).data('sketch').tool];
      if(isDefined(currentTool) && isDefined(currentTool.onEvent)) {
        currentTool.onEvent.call($(this).data('sketch'), e);
      }
      e.preventDefault();
      return false;
    };
    Sketch.prototype.redraw = function() {
      var sketch;
      this.el.width = this.canvas.width();
      this.context = this.el.getContext('2d');
      sketch = this;
      $.each(this.actions, function() {
        if (this.tool) {
          return $.sketch.tools[this.tool].draw.call(sketch, this);
        }
      });
      if (this.painting && this.action) {
        return $.sketch.tools[this.action.tool].draw.call(sketch, this.action);
      }
    };
    return Sketch;
  })($);
  $.sketch = {
    tools: {}
  };
  $.sketch.tools.marker = {
    onEvent: function(e) {
      switch (e.type) {
        case 'touchstart':
          this.startPainting();
          break;
        case 'touchend':
          this.stopPainting();
      }
      if (this.painting) {
        var x = e.pageX - this.canvas.offset().left;
        var y = e.pageY - this.canvas.offset().top;
        this.action.events.push({
          x: x,
          y: y,
          event: e.type
        });
        if(!isNaN(x) && !isNaN(y)) {
            this.inking(x, y);
        }
        if(!isNaN(x) && !isNaN(y) && isDefined(this.SBInputElement) && this.SBInputElement !== null) {
            var characterHeight = 0.75 * this.el.height;
            if((x + characterHeight) > this.el.width) {
                this.el.width = (x + characterHeight);
            }
            if((y + 20) > this.el.height) {
                this.el.height = (y + 20);
            }
        }
        var returnObj = this.redraw();
        return returnObj;
      }
    },
    draw: function(action) {
      var event, previous, _i, _len, _ref;
      this.context.lineJoin = "round";
      this.context.lineCap = "round";
      this.context.beginPath();
      this.context.moveTo(action.events[0].x, action.events[0].y);
      _ref = action.events;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        event = _ref[_i];
        this.context.lineTo(event.x, event.y);
        previous = event;
      }
      this.context.strokeStyle = action.color;
      this.context.lineWidth = action.size;
      return this.context.stroke();
    }
  };
  return $.sketch.tools.eraser = {
    onEvent: function(e) {
      return $.sketch.tools.marker.onEvent.call(this, e);
    },
    draw: function(action) {
      var oldcomposite;
      oldcomposite = this.context.globalCompositeOperation;
      this.context.globalCompositeOperation = "copy";
      action.color = "rgba(0,0,0,0)";
      $.sketch.tools.marker.draw.call(this, action);
      return this.context.globalCompositeOperation = oldcomposite;
    }
  };
})($);


})();

