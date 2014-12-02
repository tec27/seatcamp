var cuid = require('cuid')
  , fs = require('fs')
  , concat = require('concat-stream')
  , rimraf = require('rimraf')

var TMP_DIR = __dirname + '/../tmp/'

var fileExtensions = {
  'image/jpeg': '.jpg'
}
var videoCodecs = {
  'webm': { ext: '.webm', vcodec: '-vcodec libvpx' },
  'x264': { ext: '.mp4', vcodec: '-vcodec libx264 -pix_fmt yuv420p' }
}

module.exports = function(frames, format, ffmpegRunner, cb) {
  if (!fileExtensions[format]) {
    return cb(new Error('Invalid input format'))
  }

  var id = cuid()
    , folder = TMP_DIR + id
    , imgExtension = fileExtensions[format]
  writeTempFiles()

  function writeTempFiles() {
    fs.mkdir(folder, function(err) {
      if (err) {
        return done(err)
      }

      var count = 0
      for (var i = 0; i < frames.length; i++) {
        fs.createWriteStream(folder + '/' + i + imgExtension)
          .on('error', done)
          .end(frames[i], fileDone)
      }

      function fileDone() {
        count++
        if (count == frames.length) {
          convert()
        }
      }
    })
  }

  function convert() {
    var results = {}
      , outstanding = 0
      , firstErr
    Object.keys(videoCodecs).forEach(function(codec) {
      outstanding++
      doFfmpeg(ffmpegRunner, folder, imgExtension, videoCodecs[codec].vcodec,
               videoCodecs[codec].ext, function(err, data) {
        if (err) {
          firstErr = firstErr || err
        } else {
          results[codec] = data
        }
        outstanding--
        maybeFinish()
      })
    })

    function maybeFinish() {
      if (outstanding) return

      if (firstErr) {
        done(firstErr)
      } else {
        done(null, results)
      }
    }
  }

  function done(err, video) {
    cb(err, video)
    deleteFiles()
  }

  function deleteFiles() {
    rimraf(folder, function(err) {
      if (err) {
        console.error('Error deleting folder: ' + folder + '\n' + err)
      }
    })
  }
}

function doFfmpeg(ffmpegRunner, folder, imgExtension, vcodecArgs, vidExtension, cb) {
  var command = '-i "' + folder + '/%d' + imgExtension + '" ' +
      '-filter:v "setpts=2.5*PTS" ' + vcodecArgs + ' -an "' + folder + '/vid' + vidExtension + '"'

  ffmpegRunner(command, { timeout: 3000 }, function(err, stdout, stderr) {
    if (err) {
      return cb(err)
    }

    fs.createReadStream(folder + '/vid' + vidExtension).pipe(concat(function(data) {
      cb(null, data)
    })).on('error', function(err) {
      cb(err)
    })
  })
}
