var fs = require('fs')

var cameraFront = fs.readFileSync(__dirname + '/../svg/ic_camera_front_24px.svg', 'utf8')
var cameraRear = fs.readFileSync(__dirname + '/../svg/ic_camera_rear_24px.svg', 'utf8')
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
  cameraFront: genFunc(cameraFront),
  cameraRear: genFunc(cameraRear),
  moreVert: genFunc(moreVert),
  save: genFunc(save),
}
