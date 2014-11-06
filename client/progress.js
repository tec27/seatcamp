var $ = require('jquery')

module.exports = function(elem) {
  if (!$(elem).hasClass('progress')) {
    throw new Error('Must be used on a progress element')
  }
  return new ProgressSpinner($(elem))
}

class ProgressSpinner {
  constructor(elem) {
    this.elem = elem
    this.fill = elem.find('.fill, .mask.full')
    this.fix = elem.find('.fill.fix')
    this.textElem = elem.find('.text')
    this._value = 0
  }

  show() {
    this.elem.addClass('visible')
    return this
  }

  hide() {
    this.elem.removeClass('visible')
    return this
  }

  setValue(value) {
    this._value = value
    this.textElem.text((value * 100 | 0) + '%')
    this._updateRotation()
    return this
  }

  _updateRotation() {
    var fillRotation = this._value * 180 | 0
      , fixRotation = fillRotation * 2
      , fillCss = `rotate(${fillRotation}deg)`
      , fixCss = `rotate(${fixRotation}deg)`
    this.fill.css({
      '-webkit-transform': fillCss,
      transform: fillCss,
    })
    this.fix.css({
      '-webkit-transform': fixCss,
      transform: fixCss,
    })
  }
}
