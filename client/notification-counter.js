export default class NotificationCounter {
  constructor() {
    const link = document.querySelector('link[rel=icon]')
    this.origIcon = link ? link.href : '/favicon.ico'
    this.canvas = document.createElement('canvas')
    this.context = this.canvas.getContext('2d')
  }

  getIcon(cb) {
    if (this.image) {
      cb(this.image)
      return
    }

    const image = new window.Image()
    image.onload = () => {
      this.image = image
      this.canvas.width = image.width
      this.canvas.height = image.height
      cb(this.image)
    }
    image.onerror = err => {
      console.log('Error loading favicon: ' + err)
      cb(null)
    }
    image.src = this.origIcon
  }

  setCount(count) {
    this.getIcon(icon => {
      const fontSize = this._rel16(11)
      const c = this.context

      c.clearRect(0, 0, this.canvas.width, this.canvas.height)
      c.drawImage(icon, 0, 0, this.canvas.width, this.canvas.height)
      c.font = `${fontSize}px monospace`
      c.fillStyle = 'rgb(255, 255, 255)'
      c.textAlign = 'left'
      c.textBaseline = 'top'
      c.strokeStyle = 'rgba(2, 136, 209, 0.95)'
      c.lineWidth = this._rel16(4)
      const startX = this._rel16(2)
      const startY = this._rel16(1)
      const countStr = count < 10 ? ('' + count) : '*'
      c.strokeText(countStr, startX, startY)
      c.fillText(countStr, startX, startY)
      this._setIcon(this.canvas.toDataURL('image/png'))
    })
  }

  clear() {
    this._revert()
  }

  _revert() {
    this._setIcon(this.origIcon)
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

  _rel16(val) {
    return Math.round((val * this.canvas.width) / 16)
  }
}
