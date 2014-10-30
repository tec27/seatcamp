var traceur = require('traceur')
  , path = require('path')
traceur.require.makeDefault(function(filename) {
  return filename.indexOf(path.join(__dirname, 'node_modules')) < 0
});

require('./server')
