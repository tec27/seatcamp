// TODO(tec27): move to icon font
// Trying to avoid confusing the browserify transform with babel output
/* eslint-disable no-var */
var fs = require('fs')

var cameraFront = fs.readFileSync(__dirname + '/../svg/ic_camera_front_24px.svg', 'utf8')
var cameraRear = fs.readFileSync(__dirname + '/../svg/ic_camera_rear_24px.svg', 'utf8')
var moreVert = fs.readFileSync(__dirname + '/../svg/ic_more_vert_24px.svg', 'utf8')
var save = fs.readFileSync(__dirname + '/../svg/ic_save_24px.svg', 'utf8')
/* eslint-enable no-var */

function genFunc(svgStr) {
  return color => {
    const div = document.createElement('div')
    div.innerHTML = svgStr
    div.className = 'icon icon-' + color
    return div
  }
}

module.exports = {
  cameraFront: genFunc(cameraFront),
  cameraRear: genFunc(cameraRear),
  moreVert: genFunc(moreVert),
  save: genFunc(save),
}
