function genFunc(name) {
  return color => {
    const div = document.createElement('div')
    div.innerHTML = name
    div.className = 'material-icons icon icon-' + color
    return div
  }
}

module.exports = {
  cameraFront: genFunc('camera_front'),
  cameraRear: genFunc('camera_rear'),
  moreVert: genFunc('more_vert'),
  save: genFunc('save'),
}
