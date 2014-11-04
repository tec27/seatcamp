var $ = require('jquery')
  , crypto = require('crypto')
  , xtermColors = require('xterm-colors')

// generates a 3x3 grid that represents a particular ID
module.exports = createColorId

function createColorId(id) {
  var md5 = crypto.createHash('md5').update(id).digest('hex')
    , container = $('<div class="color-id" />')
    , colors = []
    , midSum = 0
    , i

  // Every second byte gets summed together to determine the color of the middle block
  // Otherwise, the byte directly determines the color of a block
  for (i = 0; i < md5.length; i += 2) {
    var byte = parseInt(md5.substr(i, 2), 16)
    if (i % 4 === 0) {
      colors.push(xtermColors[byte])
    } else {
      midSum += byte
    }
  }

  for (i = 0; i < 4; i++) {
    container.append(createPart(colors[i]))
  }
  container.append(createPart('000000')) // This will be covered by the middle block
  for (i = 4; i < 8; i++) {
    container.append(createPart(colors[i]))
  }
  container.append(createPart(xtermColors[midSum % 256]).addClass('middle'))

  return container
}

function createPart(color) {
  return $('<div class="block" style="background-color: #' + color + '" />')
}
