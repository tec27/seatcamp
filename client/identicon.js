import { LitElement, html, css } from 'lit-element'
import sha1 from 'sha1'
import theme from './theme'
import { RESET } from './styles'

class IdenticonElement extends LitElement {
  static get styles() {
    return css`
      /* Stop prettier from doing dumb things with this */
      ${RESET} /* */

      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      .identicon {
        width: 100%;
        height: 100%;
        border: 1px solid var(--colorBorder);
        border-radius: 2px;
        padding: 3px;
      }

      .identicon .block {
        float: left;
        width: 20%;
        height: 20%;
      }
    `
  }

  static get properties() {
    return {
      userId: { type: String, attribute: 'user-id' },
    }
  }

  userId = ''

  _onThemeChange = () => this.onThemeChange()

  render() {
    const hash = sha1(this.userId)
    // Last 16 characters are the foreground color
    const fgHue = Math.round((parseInt(hash.substr(-10), 16) / 0xffffffffff) * 360)
    const saturationLow = theme.isDark() ? 35 : 50
    const saturationHigh = theme.isDark() ? 75 : 90
    const lightnessLow = theme.isDark() ? 50 : 30
    const lightnessHigh = theme.isDark() ? 75 : 60
    const fg = objToHslStr({
      hue: fgHue,
      saturation: inRange(parseInt(hash.substr(-13, 3), 16) / 0xfff, saturationLow, saturationHigh),
      lightness: inRange(parseInt(hash.substr(-16, 3), 16) / 0xfff, lightnessLow, lightnessHigh),
    })
    // background is a light (or dark if dark theme) grey, opposite of the hue we're using for the
    // foreground color
    const bg = objToHslStr({
      hue: (180 + fgHue) % 360,
      saturation: theme.isDark() ? 8 : 20,
      lightness: theme.isDark() ? 27 : 96,
    })

    const blocks = []
    // we only construct 3 columns (not 5) because we mirror the last two columns from the first
    for (let i = 0; i < 3; i++) {
      blocks.push([false, false, false, false, false])
    }
    for (let i = 0, y = 0; i < 15; i++, y++) {
      // start in middle, move outward
      const x = 2 - ((i / 5) | 0)
      const color = parseInt(hash.charAt(i), 16) % 2 ? false : fg
      y = y % 5
      blocks[x][y] = color
    }

    const templates = []
    // render out to DOM elements
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        // mirror the last 2 columns from the first 2
        const srcX = x >= 3 ? 4 - x : x
        const style = blocks[srcX][y] ? `background-color: ${blocks[srcX][y]};` : ''
        templates.push(
          html`
            <div class="block" style="${style}"></div>
          `,
        )
      }
    }

    const style = `background-color: ${bg};`
    return html`
      <div class="identicon" style="${style}">${templates}</div>
    `
  }

  connectedCallback() {
    super.connectedCallback()
    theme.on('themeChange', this._onThemeChange)
  }

  disconnectedCallback() {
    theme.removeListener('themeChange', this._onThemeChange)
    super.disconnectedCallback()
  }

  onThemeChange() {
    this.requestUpdate()
  }
}

customElements.define('sc-identicon', IdenticonElement)

function inRange(percent, min, max) {
  return Math.round(percent * (max - min)) + min
}

function objToHslStr({ hue, saturation, lightness }) {
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
