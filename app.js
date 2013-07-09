
var express = require('express')
	, routes = require('./routes')
	, http = require('http')
	, path = require('path')
	, socketio = require('socket.io')
	, assets = require('connect-assets')
	, MemoryStore = express.session.MemoryStore
	, coffeeScript = require('coffee-script')
	, SocketSession = require('./lib/SocketSession')
	, SocketHandler = require('./lib/SocketHandler')
	, lodash = require('lodash');

var app = express();
var sessionStore = new MemoryStore();
var COOKIE_SECRET = '9710e25b-12e7-49df-9818-09f1c61cad52';
var cookieParser = express.cookieParser(COOKIE_SECRET);
var SESSION_COOKIE_KEY = 'multipaint.sid';

var config = {
	port: process.env.PORT || 3000,
	publicDirName: 'public'
};

var publicDir = path.join(__dirname, config.publicDirName);
//TODO figure out how to do production serving
app.use( assets() );

// all environments
app.set('port', config.port);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(cookieParser);
app.use(express.session({
	key: SESSION_COOKIE_KEY,
	store: sessionStore
}));
app.use(app.router);
app.use(express.static(publicDir));

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

app.get('/', routes.index);

var httpServer = http.createServer(app);

var io = socketio.listen(httpServer);
io.set('log level', 0);

new SocketSession(io, cookieParser, SESSION_COOKIE_KEY, sessionStore);
new SocketHandler(io);

httpServer.listen(config.port, function(){
	console.log('MultiPaint server listening on port ' + config.port);
});
