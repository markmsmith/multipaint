
exports.index = function(req, res){
  res.render('index', { title: 'MultiPaint', holderName: 'canvasHolder', paintSession: req.query.paintSession });
};