let sha1 = require('sha1')

module.exports = function createIdenticon(id, internal) {
  let hash = sha1(id)
    , container = document.createElement('div')
    , html = []
  container.className = 'identicon'
  // Last 16 characters are the foreground color
  let fgHue = Math.round((parseInt(hash.substr(-10), 16) / 0xffffffffff) * 360)
  let fg = objToHslStr({
    hue: fgHue,
    saturation: inRange(parseInt(hash.substr(-13, 3), 16) / 0xfff, 50, 90),
    lightness: inRange(parseInt(hash.substr(-16, 3), 16) / 0xfff, 30, 60),
  })
  // background is a light gray, opposite of the hue we're using for the foreground
  let bg = objToHslStr({
    hue: (180 + fgHue) % 360,
    saturation: 20,
    lightness: 96,
  })

  let blocks = []
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
      let elemHtml = ['<div class="block"']
      if (blocks[srcX][y]) {
        elemHtml.push(` style="background-color: ${blocks[srcX][y]};"`)
      }
      elemHtml.push('></div>')
      html = html.concat(elemHtml)
    }
  }

  container.innerHTML = html.join('')
  container.style['background-color'] = bg
  return container
}

function inRange(percent, min, max) {
  return Math.round((percent * (max - min))) + min
}

function objToHslStr({ hue, saturation, lightness }) {
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
