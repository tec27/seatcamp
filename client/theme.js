let EventEmitter = require('events').EventEmitter

class ThemeManager extends EventEmitter {
  constructor() {
    super()
    this.theme = null
    this.loadTheme()
    window.addEventListener('storage', evt => {
      if (evt.key = 'theme') {
        this.loadTheme()
      }
    })
  }

  loadTheme() {
    let oldTheme = this.theme
    this.theme = localStorage.getItem('theme') || 'light'
    if (this.theme != oldTheme) {
      this.emit('themeChange', this.theme)
    }
  }

  isDark() {
    return this.theme == 'dark'
  }

  setTheme(theme) {
    if (this.theme != theme) {
      localStorage.setItem('theme', theme)
      // Set so the server can know what layout to send so we don't get a "flash of white"
      // experience
      document.cookie = `theme=${theme}; expires=Fri, 31 Dec 9999 23:59:59 GMT`
      this.theme = theme
      this.emit('themeChange', this.theme)
    }
  }

  getTheme(theme) {
    return this.theme
  }
}

module.exports = new ThemeManager()
