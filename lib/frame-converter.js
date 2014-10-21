var cuid = require('cuid')
  , fs = require('fs')
  , concat = require('concat-stream')
  , child = require('child_process')

var TMP_DIR = __dirname + '/../tmp/'

module.exports = function(frames, format, cb) {
  var id = cuid()
  writeTempFiles()

  function writeTempFiles() {
    var count = 0
    for (var i = 0; i < frames.length; i++) {
      fs.createWriteStream(TMP_DIR + id + '-' + i + '.jpg')
        .on('error', done)
        .end(frames[i], fileDone)
    }

    function fileDone() {
      count++
      if (count == frames.length) {
        convert()
      }
    }
  }

  function convert() {
    var command = 'ffmpeg -i "' + TMP_DIR + id +
        '-%d.jpg" -filter:v "setpts=2.25*PTS" -vcodec libvpx -an "' +
        TMP_DIR + id + '.webm"'

    child.exec(command, { timeout: 3000 }, function(err, stdout, stderr) {
      if (err) {
        return done(err)
      }

      fs.createReadStream(TMP_DIR + id + '.webm').pipe(concat(function(data) {
        done(null, data)
      })).on('error', function(err) {
        done(err)
      });
    })
  }

  function done(err, video) {
    cb(err, video)
    deleteFiles()
  }

  function deleteFiles() {
    // TODO(tec27): implement
  }
}
