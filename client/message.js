import { LitElement, html, css } from 'lit-element'
import { repeat } from 'lit-html/directives/repeat'

import createIdenticon from './identicon'
import localeTime from './locale-time'
import theme from './theme'
import { videoToGif } from './gif'

const MESSAGE_LIMIT = 30

class MessageElement extends LitElement {
  static get styles() {
    return css`
      :host {
        display: flex;
        background-color: var(--colorSurface);
        font-size: 20px;
        padding: 0px;
      }

      .video-container {
        width: 200px;
        height: 150px;
        position: relative;
        overflow: hidden;
        flex-shrink: 0;

        margin-bottom: -1px;
      }

      .video-container.first {
        border-top-left-radius: 2px;
      }

      .video-container.last {
        border-bottom-left-radius: 2px;
        margin-bottom: 0;
      }

      .video-container .message-video {
        width: 100%;
        height: 100%;
        display: block;
      }

      .video-container .save,
      .video-container .save:focus {
        position: absolute;
        display: block;
        padding: 4px 8px;
        bottom: 8px;
        left: 8px;
        border: 1px solid rgba(0, 0, 0, 0.54);
        outline: none;
        border-radius: 2px;
        background-color: #f06292;
        opacity: 0;
        visibility: hidden;

        transition: visibility 0.4s, opacity 0.4s, background-color 0.4s;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
      }

      .video-container:hover .save {
        visibility: visible;
        opacity: 0.95;
      }

      .save:hover {
        background-color: #f86a9a;
        cursor: pointer;
      }

      .save:active {
        background-color: #ff71a1;
      }

      .save[disabled] {
        background-color: #e91e63;
      }

      .message-text {
        flex: 1 1;
        margin: 0;
        padding: 8px;

        word-wrap: break-word;
        overflow-wrap: break-word;
        overflow: hidden;
      }

      .message-meta {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: space-between;
        padding: 0 0 4px;
      }

      .message-overflow {
        display: inline-block;
      }

      .message-meta sc-dropdown .toggle {
        /* compensate for the icon being higher and not looking like it occupies the lower space */
        --colorIconPrimary: var(--colorTextSecondary);
        --colorButtonHover: transparent;
        --colorButtonActive: transparent;
      }

      .message-meta sc-dropdown .toggle:hover {
        --colorIconPrimary: var(--colorTextPrimary);
      }

      .message-overflow sc-svg-icon {
        margin-left: 8px;
        margin-top: -8px;
      }

      .identicon {
        width: 38px;
        height: 38px;
        border: var(--colorBorder);
        border-radius: 2px;
        margin: 1px 8px 1px 2px;
        padding: 3px;
      }

      .identicon .block {
        float: left;
        width: 20%;
        height: 20%;
      }

      .message-meta time {
        color: var(colorTextSecondary);
        font-size: 16px;
        padding: 0;
        margin-right: 8px;
      }
    `
  }

  static get properties() {
    return {
      isFirst: { type: Boolean, attribute: 'is-first' },
      isLast: { type: Boolean, attribute: 'is-last' },
      key: { type: String },
      owner: { attribute: false },
      myId: { type: String, attribute: 'my-id' },
      sent: { type: Number },
      text: { type: String },
      userId: { type: String, attribute: 'user-id' },
      video: { attribute: false },
      videoMime: { type: String },
    }
  }

  constructor() {
    super()
    this.isFirst = false
    this.isLast = false
    this.key = ''
    this.owner = null
    this.sent = Date.now()
    this.text = ''
    this.userId = ''
    this.video = null
    this.videoMime = ''
  }

  _isVisible = false
  _playPauseRequest = null
  _srcUrlIsFor = null
  _srcUrl = null

  render() {
    if (this._srcUrl && this._srcUrlIsFor !== this.video) {
      window.URL.revokeObjectURL(this._srcUrl)
      this._srcUrl = null
    }
    if (!this._srcUrl) {
      const blob = new window.Blob([this.video], { type: this.videoMime })
      this._srcUrl = window.URL.createObjectURL(blob)
      this._srcUrlIsFor = this.video
    }

    const sentDate = new Date(this.sent)
    const isMe = this.userId === this.myId

    const videoClass =
      'video-container' + (this.isFirst ? ' first' : '') + (this.isLast ? ' last' : '')

    const dropdownActions = {
      mute: () => this.mute(),
    }

    return html`
        <div class="${videoClass}">
          <video class="message-video" muted loop src="${this._srcUrl}"></video>
          <button class="save shadow-1" title="Save as GIF" @click="${this.saveGif}">
            <sc-svg-icon class="invert" icon="save"></ms-svg-icon>
          </button>
        </div>
        <p class="message-text" .innerHTML="${this.text}"></p>
        <div class="message-meta">
          <sc-dropdown .actions="${dropdownActions}">
            <button slot="toggle" class="toggle message-overflow"
                title="Message options"
                ?disabled="${isMe}">
              <sc-svg-icon ?disabled="${isMe}" icon="moreVert"></ms-svg-icon>
            </button>
            <button data-action="mute">Mute user</button>
          </sc-dropdown>
          <div class="identicon"></div>
          <time datetime="${sentDate.toISOString()}">${localeTime(sentDate)}</time>
        </div>
    `
  }

  updated() {
    // TODO: make these LitElements too
    const newIdenticon = createIdenticon(this.userId)
    const identiconElem = this.shadowRoot.querySelector('.identicon')
    identiconElem.parentElement.replaceChild(newIdenticon, identiconElem)
  }

  disconnectedCallback() {
    if (this._srcUrl) {
      window.URL.revokeObjectURL(this._srcUrl)
      this._srcUrl = null
      this._srcUrlIsFor = null
    }
    if (this._playPauseRequest) {
      cancelAnimationFrame(this._playPauseRequest)
      this._playPauseRequest = null
    }
  }

  saveGif() {
    this._throwIfDisposed()
    this.saveButton.disabled = true
    this.owner.trackSaveGif()

    videoToGif({ videoElem: this.video, numFrames: 10 })
      .then(gifBlob => {
        this.saveButton.disabled = false
        const url = window.URL.createObjectURL(gifBlob)
        const link = document.createElement('a')
        const click = document.createEvent('MouseEvents')

        link.href = url
        link.download = Date.now() + '.gif'
        click.initMouseEvent(
          'click',
          true,
          true,
          window,
          0,
          0,
          0,
          0,
          0,
          false,
          false,
          false,
          false,
          0,
          null,
        )
        link.dispatchEvent(click)
        setTimeout(() => window.URL.revokeObjectURL(url), 100)
      })
      .catch(err => {
        this.saveButton.disabled = false
        // TODO(tec27): need a good way to display this error to users
        console.error('Error creating GIF:')
        console.dir(err)
        return
      })
  }

  mute() {
    this.owner.muteUser(this.userId)
  }

  updateVisibility(visible) {
    this._isVisible = visible

    if (!this._playPauseRequest) {
      this._playPauseRequest = requestAnimationFrame(() => {
        this._playPauseRequest = null
        const video = this.shadowRoot.querySelector('.message-video')
        if (this._isVisible) {
          video.play()
        } else {
          video.pause()
        }
      })
    }
  }
}

customElements.define('sc-message', MessageElement)

export class MessageListElement extends LitElement {
  static get styles() {
    return css`
      :host {
        display: block;

        margin: 56px auto 158px;
        padding: 0;

        border-radius: 2px;
      }

      sc-message {
        border-bottom: 1px solid var(--colorBorder);
      }

      sc-message:first-of-type {
        border-top-left-radius: 2px;
        border-top-right-radius: 2px;
      }

      sc-message:last-of-type {
        border-bottom-left-radius: 2px;
        border-bottom-right-radius: 2px;
        border-bottom: none;
      }
    `
  }

  static get properties() {
    return {
      myId: { type: String, attribute: 'my-id' },
      muteSet: { attribute: false },
      tracker: { attribute: false },
    }
  }

  myId = ''
  muteSet = new Set()
  tracker = null

  _intersectionObserver = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      target.updateVisibility(isIntersecting)
    }
  })
  _messages = []

  _isAutoScrolling = false

  render() {
    return html`
      <div>
        ${repeat(
          this._messages,
          m => m.key,
          (m, index) =>
            html`
              <sc-message
                key="${m.key}"
                .owner="${this}"
                my-id="${this.myId}"
                sent="${m.sent}"
                text="${m.text}"
                user-id="${m.userId}"
                .video="${m.video}"
                videoMime="${m.videoMime}"
                ?is-first="${index === 0}"
                ?is-last="${index === this._messages.length - 1}"
              ></sc-message>
            `,
        )}
      </div>
    `
  }

  updated() {
    for (const message of this.shadowRoot.querySelectorAll('sc-message')) {
      this._intersectionObserver.observe(message)
    }

    if (this._isAutoScrolling && this._messages.length) {
      requestAnimationFrame(() => {
        if (!this._messages.length) {
          return
        }

        const lastMessage = this._messages[this._messages.length - 1]
        this.shadowRoot.querySelector(`sc-message[key="${lastMessage.key}"]`).scrollIntoView()
      })
      this._isAutoScrolling = false
    }
  }

  hasMessages() {
    return this._messages.length > 0
  }

  addMessage(message, autoScrolling = true) {
    if (this.muteSet.has(message.userId)) {
      return false
    }
    if (this._messages.some(m => m.key === message.key)) {
      return false
    }

    this._isAutoScrolling = autoScrolling

    const newCount = this._messages.length + 1
    if (autoScrolling && newCount > MESSAGE_LIMIT) {
      this._messages = this._messages.slice(-MESSAGE_LIMIT)
    }

    this._messages.push(message)
    this.requestUpdate()
    return true
  }

  muteUser(userId) {
    if (userId === this.clientId) {
      // don't mute me, me
      return
    }
    this.muteSet.add(userId)
    this.tracker.onUserMuted()

    this._messages = this._messages.filter(m => m.userId !== userId)
    this.requestUpdate()
  }

  trackSaveGif() {
    this.tracker.onSaveGif()
  }

  _onThemeChange(newTheme) {
    // TODO: fix this for LitElement
    /*
    // Re-render identicons based on the new theme to update any inline styles
    for (const message of this.messages) {
      message.refreshIdenticon()
    }
    */
  }
}

customElements.define('sc-message-list', MessageListElement)
