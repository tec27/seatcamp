var $ = require('jquery')
  , crypto = require('crypto')

module.exports = function createIdenticon(id) {
  var hash = crypto.createHash('md5').update(id).digest('hex')
    , container = $('<div class="identicon" />')
  // Last 12 characters are the foreground color
  var fg = objToHslStr({
    hue: Math.round((parseInt(hash.substr(-10), 16) / 0xffffffffff) * 360),
    saturation: inRange(parseInt(hash.substr(-11, 1), 16) / 0xf, 50, 85),
    lightness: inRange(parseInt(hash.substr(-12, 1), 16) / 0xf, 30, 60),
  })
  // background is a light gray
  var bg = objToHslStr({
    hue: 0,
    saturation: 0,
    lightness: 96,
  })

  var blocks = []
  // we only construct 3 columns (not 5) because we mirror the last two columns from the first
  for (let i = 0; i < 3; i++) {
    blocks.push([ false, false, false, false, false ])
  }
  for (let i = 0, y = 0; i < 15; i++, y++) {
    // start in middle, move outward
    let x = 2 - ((i / 5) | 0)
    let color = parseInt(hash.charAt(i), 16) % 2 ? false : fg
    y = y % 5
    blocks[x][y] = color
  }

  // render out to DOM elements
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      // mirror the last 2 columns from the first 2
      let srcX = x >= 3 ? 4 - x : x
      let elem = $('<div class="block" />')
      if (blocks[srcX][y]) {
        elem.css('background-color', blocks[srcX][y])
      }
      container.append(elem)
    }
  }

  container.css('background-color', bg)
  return container
}

function inRange(percent, min, max) {
  return Math.round((percent * (max - min))) + min
}

function objToHslStr({ hue, saturation, lightness }) {
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
