// Trying to avoid confusing the browserify transform with babel output
/* eslint-disable no-var */
var fs = require('fs')

var content = fs.readFileSync(__dirname + '/about.htm', 'utf8')
/* eslint-enable no-var */

module.exports = function() {
  const scrim = document.createElement('div')
  scrim.className = 'dialog-scrim entering'

  const container = document.createElement('div')
  container.className = 'dialog-container'
  const dialog = document.createElement('div')
  dialog.className = 'dialog about shadow-5 entering'
  dialog.innerHTML = content
  container.appendChild(dialog)

  return { scrim, container, dialog }
}
