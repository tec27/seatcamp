module.exports = function(elem) {
  if (!elem.classList.contains('progress')) {
    throw new Error('Must be used on a progress element')
  }
  return new ProgressSpinner(elem)
}

class ProgressSpinner {
  constructor(elem) {
    this.elem = elem
    this.fill = Array.from(elem.querySelectorAll('.fill, .mask.full'))
    this.fix = elem.querySelector('.fill.fix')
    this.textElem = elem.querySelector('.text')
    this._value = 0
  }

  show() {
    this.elem.classList.add('visible')
    return this
  }

  hide() {
    this.elem.classList.remove('visible')
    return this
  }

  setValue(value) {
    this._value = value
    this.textElem.innerHTML = ((value * 100 | 0) + '%')
    this._updateRotation()
    return this
  }

  _updateRotation() {
    var fillRotation = this._value * 180 | 0
      , fixRotation = fillRotation * 2
      , fillCss = `rotate(${fillRotation}deg)`
      , fixCss = `rotate(${fixRotation}deg)`
    for (let f of this.fill) {
      f.style['-webkit-transform'] = fillCss
      f.style.transform = fillCss
    }

    this.fix.style['-webkit-transform'] = fixCss
    this.fix.style.transform = fixCss
  }
}
