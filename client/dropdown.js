import { LitElement, html, css } from 'lit-element'
import { SHADOW_2 } from './styles'

class DropdownElement extends LitElement {
  static get styles() {
    return css`
      * {
        box-sizing: border-box;
      }

      :host {
        width: 48px;
        height: 48px;
        display: block;
        margin: 0;
        overflow: visible;
        position: relative;
      }

      .toggle ::slotted(*) {
        padding: 12px;
        background-color: rgba(0, 0, 0, 0);
        border: none;
        outline: none;
      }

      .menu {
        position: absolute;
        right: 0px;
        top: 0px;
        opacity: 0;
        visibility: hidden;
        contain: content;
        z-index: 100;

        border-radius: 2px;
        min-width: 168px;
        outline: none;
        margin-top: 8px;
        margin-right: 8px;
        overflow: hidden;

        background-color: var(--colorPopoverSurface);

        ${SHADOW_2};

        transform: scale(0);
        transform-origin: 100% 0%;

        transition: visibility 0.2s, opacity 0.2s, transform 0.3s;
        transition-timing-function: visibility linear, opacity linear,
          transform cubic-bezier(0.4, 0, 0.2, 1);
      }

      .active .menu {
        opacity: 1;
        visibility: visible;
        transform: scale(1);
      }

      ::slotted(button) {
        width: 100%;
        height: 48px;
        outline: none;
        border: none;
        background-color: transparent;
        color: var(--colorTextPrimary);
        font-size: 16px;
        padding-left: 16px;
        padding-right: 16px;
        text-align: left;
      }

      ::slotted(button:hover) {
        background-color: var(--colorButtonHover);
        cursor: pointer;
      }

      ::slotted(button:active),
      .active .toggle ::slotted(button) {
        background-color: var(--colorButtonActive);
      }

      ::slotted(button:disabled) {
        background-color: transparent;
        cursor: default;
      }

      .menu ::slotted(button:first-child) {
        border-top-left-radius: 2px;
        border-top-right-radius: 2px;
      }

      .menu ::slotted(button:last-child) {
        border-bottom-left-radius: 2px;
        border-bottom-right-radius: 2px;
      }
    `
  }

  static get properties() {
    return {
      actions: { attribute: false },
    }
  }

  static _opened = null

  actions = {}
  _documentListenerAttached = false
  _onDocumentClicked = () => this.onClose()

  render() {
    const isOpen = DropdownElement._opened === this
    const className = isOpen ? 'active' : ''

    return html`
      <div class="${className}" @click="${this.onClick}">
        <div class="toggle"><slot name="toggle"></slot></div>
        <div class="menu" @click="${this.onMenuClick}">
          <slot></slot>
        </div>
      </div>
    `
  }

  onClick(event) {
    let t = event.target
    while (t) {
      if (t.classList.contains('toggle') && !t.hasAttribute('disabled')) break
      if (t === event.currentTarget) return
      t = t.parentElement
    }
    if (!t) {
      return
    }

    if (this.open()) {
      event.stopPropagation()
    }
  }

  onMenuClick(event) {
    if (event.target.tagName !== 'BUTTON') return
    this.onAction(event.target.dataset.action)
  }

  onAction(action) {
    if (!this.actions[action]) {
      throw new Error("couldn't find a handler for action: " + action)
    }

    this.actions[action]()
  }

  onClose() {
    if (DropdownElement._opened === this) {
      DropdownElement._opened = null
      this.requestUpdate()
    }
  }

  open() {
    if (DropdownElement._opened) {
      const isThis = DropdownElement._opened === this
      DropdownElement._opened.onClose()
      if (isThis) {
        this.requestUpdate()
        return false
      }
    }

    document.addEventListener('click', this.closeListener)
    DropdownElement._opened = this
    this.requestUpdate()
    return true
  }

  updated() {
    if (DropdownElement._opened === this && !this._documentListenerAttached) {
      document.addEventListener('click', this._onDocumentClicked)
      this._documentListenerAttached = true
    } else if (DropdownElement._opened !== this && this._documentListenerAttached) {
      document.removeEventListener('click', this._onDocumentClicked)
      this._documentListenerAttached = false
    }
  }

  disconnectedCallback() {
    if (this._documentListenerAttached) {
      document.removeEventListener('click', this._onDocumentClicked)
      this._documentListenerAttached = false
    }
    super.disconnectedCallback()
  }
}

customElements.define('sc-dropdown', DropdownElement)
