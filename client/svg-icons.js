var fs = require('fs')

var moreVert = fs.readFileSync(__dirname + '/../svg/ic_more_vert_24px.svg', 'utf8')
var save = fs.readFileSync(__dirname + '/../svg/ic_save_24px.svg', 'utf8')

function genFunc(svgStr) {
  return color => {
    let div = document.createElement('div')
    div.innerHTML = svgStr
    div.className = 'icon icon-' + color
    return div
  }
}

module.exports = {
  'moreVert': genFunc(moreVert),
  'save': genFunc(save),
}
