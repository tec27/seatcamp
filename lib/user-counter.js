export default function createUserCounter(io) {
  let active = 0
  io.on('connection', function (socket) {
    active++
    io.emit('active', active)
    socket.on('disconnect', function () {
      active--
      io.emit('active', active)
    })
  })
}
