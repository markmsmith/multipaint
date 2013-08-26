
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
	, passport = require('passport')
	, GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
  , FacebookStrategy = require('passport-facebook').Strategy
  , ZuulStrategy = require('passport-zuul').Strategy
  , GitHubStrategy = require('passport-github').Strategy;

var app = express();
var sessionStore = new MemoryStore();
var COOKIE_SECRET = '9710e25b-12e7-49df-9818-09f1c61cad52';
var cookieParser = express.cookieParser(COOKIE_SECRET);
var SESSION_COOKIE_KEY = 'multipaint.sid';

var config = {
	port: process.env.PORT || 3000,

  google: {
    clientID: process.env.GOOGLE_CLIENT_ID || '976362027772.apps.googleusercontent.com',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '1nAy7tGYTr0_HkWyh_n7-boQ'
  },

  facebook: {
    clientID: process.env.FACEBOOK_CLIENT_ID || '612441082134408',
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '6c42b6acf683d3d54265de4932667768'
  },

  github: {
    clientID: process.env.GITHUB_CLIENT_ID || '6ca12a1247913e3196f7',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '044bf9086f06ff746c7154de7fdd1406fa16b427'
  },

  windowLive: {

  }
};


passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GoogleStrategy({
    clientID: config.google.clientID,
    clientSecret: config.google.clientSecret,
    callbackURL: "http://127.0.0.1:3000/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, done) {
  	console.log('got google user ', profile);

    //TODO lookup/create user
    // User.findOrCreate({ googleId: profile.id }, function (err, user) {
    //   return done(err, user);
    // });

    done(null, profile)
  }
));

passport.use(new FacebookStrategy({
    clientID: config.facebook.clientID,
    clientSecret: config.facebook.clientSecret,
    callbackURL: "http://localhost:3000/auth/facebook/callback",
    profileFields: ['id', 'displayName', 'name', 'emails', 'photos']
  },
  function(accessToken, refreshToken, profile, done) {
    console.log('got facebook user ', profile);

    //TODO lookup/create user
    // User.findOrCreate({ googleId: profile.id }, function (err, user) {
    //   return done(err, user);
    // });

    done(null, profile)
  }
));

passport.use(new ZuulStrategy());

passport.use(new GitHubStrategy({
    clientID: config.github.clientID,
    clientSecret: config.github.clientSecret,
    callbackURL: "http://127.0.0.1:3000/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    console.log("got github user ", profile)
      done(null, profile);
  }
));

var publicDir = path.join(__dirname, 'public');
var clientLibsDir = path.join(__dirname, 'bower_components');

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
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

app.use('/clientLibs', express.static(clientLibsDir));
app.use(express.static(publicDir));

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

app.get('/auth/google',
  passport.authenticate('google', { scope:'openid profile email' }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
  	console.log('req.user =', req.user)
    // Successful authentication, redirect home.
    res.redirect('/');
  }
);

app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    console.log('req.user =', req.user)
    // Successful authentication, redirect home.
    res.redirect('/');
  }
);

app.post('/auth/rally', passport.authenticate('zuul'),
  function(req, res, next){
    console.log('req.user =', req.user)
    // Successful authentication, redirect home.
    res.redirect('/');
  }
);

app.get('/auth/zuul/callback',
  passport.authenticate('zuul', { failureRedirect: '/login' }),
  function(req, res) {
    console.log('req.user =', req.user)
    // Successful authentication, redirect home.
    res.redirect('/');
  }
);

app.get('/auth/github',
  passport.authenticate('github'));

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    console.log('req.user =', req.user)
    // Successful authentication, redirect home.
    res.redirect('/');
  }
);

app.get('/', routes.index);
app.get('/login.html', routes.login.login);

var httpServer = http.createServer(app);

var io = socketio.listen(httpServer);
io.set('log level', 0);

new SocketSession(io, cookieParser, SESSION_COOKIE_KEY, sessionStore);
new SocketHandler(io);

httpServer.listen(config.port, function(){
	console.log('MultiPaint server listening on port ' + config.port);
});
