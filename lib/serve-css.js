import prepare from 'prepare-response'
import postcss from 'postcss'
import createAutoprefixer from 'autoprefixer'
import fs from 'fs'

const autoprefixer = createAutoprefixer()
const cache = new Map()
const isProd = process.env.NODE_ENV === 'production'

export default function serveCss(path) {
  const cacheKey = JSON.stringify(path)
  return function(req, res, next) {
    if (isProd && cache.has(cacheKey)) {
      cache.get(cacheKey).send(req, res)
      return
    }

    fs.readFile(path, { encoding: 'utf8' }, (err, data) => {
      if (err) {
        next(err)
        return
      }

      const css = postcss(autoprefixer).process(data, {
        from: path,
        to: req.path,
        map: isProd ? false : { inline: true },
      }).css
      const headers = { 'content-type': 'text/css' }
      if (isProd) {
        headers['cache-control'] = '14 days'
      }

      prepare(css, headers, { gzip: isProd }).nodeify((err, response) => {
        if (err) {
          next(err)
          return
        }

        if (isProd) {
          cache.set(cacheKey, response)
        }
        response.send(req, res)
      })
    })
  }
}
