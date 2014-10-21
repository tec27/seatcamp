module.exports = function(io) {
  var active = 0
  io.on('connection', function(socket) {
    active++
    io.emit('active', active)
    socket.on('disconnect', function() {
      active--
      io.emit('active', active)
    })
  })
}
