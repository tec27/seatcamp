export default class NotificationCounter {
  constructor() {
    const link = document.querySelector('link[rel=icon]')
    this.origIcon = link ? link.href : '/favicon.ico'
    this.origTitle = document.title || 'meatspace'
    this.image = null
  }

  getIcon(cb) {
    if (this.image) {
      cb(this.image)
      return
    }

    const image = new window.Image()
    image.onload = () => {
      this.image = image
      cb(this.image)
    }
    image.onerror = err => {
      console.log('Error loading favicon: ' + err)
      cb(null)
    }
    image.src = this.origIcon
  }

  setCount(count) {
    // NOTE: we throw away the canvas and create a new one every time because Chrome seems to like
    // to not draw to canvases when the tab is backgrounded (and thus would leave the previously
    // drawn contents intact, leading to incorrect counts a lot of the time). New canvases always
    // seem to draw correctly
    const canvas = document.createElement('canvas')
    this.getIcon(icon => {
      canvas.width = icon.width
      canvas.height = icon.height
      const fontSize = this._rel16(11, canvas)
      const c = canvas.getContext('2d')

      c.drawImage(icon, 0, 0, canvas.width, canvas.height)
      c.font = `${fontSize}px monospace`
      c.fillStyle = 'rgb(255, 255, 255)'
      c.textAlign = 'left'
      c.textBaseline = 'top'
      c.strokeStyle = 'rgba(2, 136, 209, 0.95)'
      c.lineWidth = this._rel16(4, canvas)
      const startX = this._rel16(2, canvas)
      const startY = this._rel16(1, canvas)
      const countStr = count < 10 ? '' + count : '*'
      c.strokeText(countStr, startX, startY)
      c.fillText(countStr, startX, startY)

      this._setIcon(canvas.toDataURL('image/png'))
      document.title = `(${countStr}) ${this.origTitle}`
    })
  }

  clear() {
    this._revert()
  }

  _revert() {
    this._setIcon(this.origIcon)
    document.title = this.origTitle
  }

  _setIcon(iconHref) {
    let link = document.querySelector('link[rel=icon]')
    while (link) {
      if (link.href === iconHref) {
        return
      } else {
        link.parentNode.removeChild(link)
      }
      link = document.querySelector('link[rel=icon]')
    }

    link = document.createElement('link')
    link.type = 'image/x-icon'
    link.rel = 'icon'
    link.href = iconHref
    document.getElementsByTagName('head')[0].appendChild(link)
  }

  _rel16(val, canvas) {
    return Math.round((val * canvas.width) / 16)
  }
}
