var prepare = require('prepare-response')
  , autoprefixer = require('autoprefixer-core')()
  , fs = require('fs')

var cache = new Map()
  , isProd = process.env.NODE_ENV == 'production'

module.exports = serveCss
function serveCss(path) {
  var cacheKey = JSON.stringify(path)
  return function(req, res, next) {
    if (isProd && cache.has(cacheKey)) {
      return cache.get(cacheKey).send(req, res)
    }

    fs.readFile(path, { encoding: 'utf8' }, (err, data) => {
      if (err) return next(err)

      var css = autoprefixer.process(data, {
        from: path,
        to: req.path,
        map: (isProd ? false : { inline: true })
      }).css
      var headers = { 'content-type': 'text/css' }
      if (isProd) {
        headers.cache = 'public, max-age=60'
      }

      prepare(css, headers, { gzip: isProd }).nodeify((err, response) => {
        if (err) return next(err)

        if (isProd) {
          cache.set(cacheKey, response)
        }
        response.send(req, res)
      })
    })
  }
}
