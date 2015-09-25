import child from 'child_process'

const possibilities = [
  'ffmpeg',
  'avconv',
]


module.exports = function(cb) {
  let i = 0

  function exec() {
    const cmd = possibilities[i]
    child.exec(cmd + ' -h', { timeout: 1000 }, function(err, stdout, stderr) {
      if (err) {
        return next()
      }

      return cb(null, createRunner(cmd))
    })
  }

  function next() {
    i++
    if (i < possibilities.length) {
      exec()
    } else {
      cb(new Error('No valid ffmpeg-like utility found. Please install or put one on your path.'))
    }
  }

  exec()
}

function createRunner(cmd) {
  return function(args, options, cb) {
    if (typeof options == 'function') {
      cb = options
      options = undefined
    }
    child.exec(cmd + ' ' + args, options, cb)
  }
}
