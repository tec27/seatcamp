class Dropdown {
  constructor(elem, actions) {
    this.elem = elem
    this.actions = actions
    if (Object.keys(actions).length != elem.querySelectorAll('.menu button').length) {
      throw new Error('provided actions don\'t match the number of buttons in the dropdown');
    }

    this.closeListener = () => this.close()
    elem.addEventListener('click', evt => {
      // Handle clicks for the toggle
      let t = evt.target
      while (true) {
        if (t.classList.contains('toggle')) break
        if (t == evt.currentTarget) return
        t = t.parentElement
      }

      if (this.open()) {
        evt.stopPropagation()
      }
    })
    elem.addEventListener('click', evt => {
      // Handle clicks for all `.menu button` elements
      if (evt.target.tagName != 'BUTTON') return
      let p = evt.target.parentElement
      while (true) {
        if (p.classList.contains('menu')) break
        if (p == evt.currentTarget) return
        p = p.parentElement
      }

      this.onAction(evt.target.dataset.action)
    })
  }

  onAction(action) {
    if (!this.actions[action]) {
      throw new Error('couldn\'t find a handler for action: ' + action)
    }

    this.actions[action]()
  }

  open() {
    if (Dropdown._opened) {
      Dropdown._opened.close()
    }

    if (this.elem.classList.contains('active')) {
      return false
    }

    this.elem.classList.add('active')
    document.addEventListener('click', this.closeListener)
    Dropdown._opened = this
    return true
  }

  close() {
    document.removeEventListener('click', this.closeListener)
    this.elem.classList.remove('active')
    if (Dropdown._opened == this) {
      Dropdown._opened = null
    }
  }
}

Dropdown._opened = null

module.exports = function(elem, actions) {
  return new Dropdown(elem, actions)
}
