
exports.index = function(req, res){
	params = {
		title: 'MultiPaint',
		holderName: 'canvasHolder',
		paintSession: req.query.paintSession
	};
  res.render('index', params);
};

// include other routes
exports.login = require('./login')