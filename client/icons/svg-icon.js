import { LitElement, html, css } from 'lit-element'

import cameraFront from './camera-front'
import cameraRear from './camera-rear'
import moreVert from './more-vert'
import save from './save'
import send from './send'
import videocamOff from './videocam-off'

const ICONS = {
  cameraFront,
  cameraRear,
  moreVert,
  save,
  send,
  videocamOff,
}

class SvgIcon extends LitElement {
  static get properties() {
    return {
      disabled: { type: Boolean },
      icon: { type: String },
      invert: { type: Boolean },
      size: { type: Number },
    }
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      .icon {
        width: 24px;
        height: 24px;
        color: var(--colorIconPrimary);
      }

      .invert {
        color: var(--colorIconInvert);
      }

      .disabled {
        color: var(--colorIconDisabled);
      }

      .invert.disabled {
        color: var(--colorIconInvertDisabled);
      }

      svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
      }
    `
  }

  disabled = false
  invert = false
  icon = null
  size = 24

  render() {
    const className = 'icon' + (this.disabled ? ' disabled' : '') + (this.invert ? ' invert' : '')
    let style = ''
    if (this.size !== 24) {
      style = `width: ${this.size}px; height: ${this.size}px;`
    }

    return html`
      <div class="${className}" aria-hidden="true" style="${style}">
        ${ICONS[this.icon]}
      </div>
    `
  }
}

customElements.define('sc-svg-icon', SvgIcon)
