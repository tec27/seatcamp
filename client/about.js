var fs = require('fs')

var content = fs.readFileSync(__dirname + '/about.htm', 'utf8')

module.exports = function() {
  let scrim = document.createElement('div')
  scrim.className = 'dialog-scrim entering'

  let container = document.createElement('div')
  container.className = 'dialog-container'
  let dialog = document.createElement('div')
  dialog.className = 'dialog about shadow-5 entering'
  dialog.innerHTML = content
  container.appendChild(dialog)

  return { scrim, container, dialog }
}
