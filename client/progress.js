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
    const fillRotation = this._value * 180 | 0
    const fixRotation = fillRotation * 2
    const fillCss = `rotate(${fillRotation}deg)`
    const fixCss = `rotate(${fixRotation}deg)`
    for (const f of this.fill) {
      f.style['-webkit-transform'] = fillCss
      f.style.transform = fillCss
    }

    this.fix.style['-webkit-transform'] = fixCss
    this.fix.style.transform = fixCss
  }
}

export default function createSpinner(elem) {
  if (!elem.classList.contains('progress')) {
    throw new Error('Must be used on a progress element')
  }
  return new ProgressSpinner(elem)
}
