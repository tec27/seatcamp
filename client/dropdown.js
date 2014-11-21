var $ = require('jquery')

class Dropdown {
  constructor(elem, actions) {
    this.elem = elem
    this.actions = actions
    if (Object.keys(actions).length != elem.find('.menu button').length) {
      throw new Error('provided actions don\'t match the number of buttons in the dropdown');
    }

    elem.on('click', '.toggle', evt => {
      if (this.open()) {
        evt.stopPropagation()
      }
    })
    elem.on('click', '.menu button', evt => this.onAction($(evt.target).data('action')))
  }

  onAction(action) {
    if (!this.actions[action]) {
      throw new Error('couldn\'t find a handler for action: ' + action)
    }

    this.actions[action]()
  }

  open() {
    if (this.elem.hasClass('active')) {
      return false
    }

    this.elem.addClass('active')
    $('html').one('click', () => this.close())
    return true
  }

  close() {
    this.elem.removeClass('active')
  }
}

module.exports = function(elem, actions) {
  return new Dropdown(elem, actions)
}
