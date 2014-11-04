var $ = require('jquery')
  , crypto = require('crypto')
  , xtermColors = require('xterm-colors')

// generates a 4x4 grid that represents a particular ID
module.exports = createColorId

function createColorId(id) {
  var md5 = crypto.createHash('md5').update(id).digest('hex')
    , container = $('<div class="color-id" />')

  for (var i = 0; i < md5.length; i += 2) {
    var byte = parseInt(md5.substr(i, 2), 16)
    container.append(createPart(xtermColors[byte]))
  }

  return container
}

function createPart(color) {
  return $('<div class="color-id-part" style="background-color: #' + color + '" />')
}
