import { LitElement, html, css } from 'lit'
import sha1 from 'sha1'
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
        contain: layout;
        border: 1px solid var(--colorBorder);
        border-radius: 2px;
        padding: 3px;

        background-color: hsl(
          calc(var(--h) + 180),
          calc(var(--identiconBgSaturation) * 1%),
          calc(var(--identiconBgLightness) * 1%)
        );
        color: hsl(
          var(--h),
          calc(
            1% *
              (
                var(--s) * (var(--identiconFgSaturationHigh) - var(--identiconFgSaturationLow)) +
                  var(--identiconFgSaturationLow)
              )
          ),
          calc(
            1% *
              (
                var(--l) * (var(--identiconFgLightnessHigh) - var(--identiconFgLightnessLow)) +
                  var(--identiconFgLightnessLow)
              )
          )
        );
      }

      .block {
        float: left;
        width: 20%;
        height: 20%;
      }

      .on {
        background-color: currentColor;
      }
    `
  }

  static get properties() {
    return {
      userId: { type: String, attribute: 'user-id' },
    }
  }

  userId = ''

  render() {
    const hash = sha1(this.userId)
    // Last 16 characters are the foreground color
    const fg = {
      hue: Math.round((parseInt(hash.substr(-10), 16) / 0xffffffffff) * 360),
      saturation: parseInt(hash.substr(-13, 3), 16) / 0xfff,
      lightness: parseInt(hash.substr(-16, 3), 16) / 0xfff,
    }

    const blocks = []
    // we only construct 3 columns (not 5) because we mirror the last two columns from the first
    for (let i = 0; i < 3; i++) {
      blocks.push([false, false, false, false, false])
    }
    for (let i = 0, y = 0; i < 15; i++, y++) {
      // start in middle, move outward
      const x = 2 - ((i / 5) | 0)
      const on = !(parseInt(hash.charAt(i), 16) % 2)
      y = y % 5
      blocks[x][y] = on
    }

    const templates = []
    // render out to DOM elements
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        // mirror the last 2 columns from the first 2
        const srcX = x >= 3 ? 4 - x : x
        templates.push(
          blocks[srcX][y]
            ? html` <div class="block on"></div> `
            : html` <div class="block"></div> `,
        )
      }
    }

    const style = `--h: ${fg.hue}; --s: ${fg.saturation}; --l: ${fg.lightness};`
    return html` <div class="identicon" style="${style}">${templates}</div> `
  }
}

customElements.define('sc-identicon', IdenticonElement)
