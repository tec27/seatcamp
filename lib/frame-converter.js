var cuid = require('cuid')
  , fs = require('fs')
  , concat = require('concat-stream')
  , rimraf = require('rimraf')
  , child = require('child_process')

var TMP_DIR = __dirname + '/../tmp/'

var fileExtensions = {
  'image/jpeg': '.jpg',
  'video/webm': '.webm',
  'video/mp4': '.mp4',
}
var videoCodecs = {
  'webm': { type: 'ffmpeg', ext: '.webm', vcodec: '-vcodec libvpx' },
  'x264': { type: 'ffmpeg', ext: '.mp4', vcodec: '-vcodec libx264 -pix_fmt yuv420p' },
  'jpg': {
    // "filmstrip" jpg view
    type: 'other',
    ext: '.jpg',
    command: 'convert -append'
  },
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
    fs.mkdir(folder, err => {
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
    Object.keys(videoCodecs).forEach(codec => {
      let info = videoCodecs[codec]
      outstanding++
      if (info.type == 'ffmpeg') {
        doFfmpeg(ffmpegRunner, folder, imgExtension, info.vcodec, info.ext, (err, data) => {
          if (err) {
            firstErr = firstErr || err
          } else {
            results[codec] = data
          }
          outstanding--
          maybeFinish()
        })
      } else {
        doOtherCommand(folder, imgExtension, info.command, info.ext, (err, data) => {
          if (err) {
            firstErr = firstErr || err
          } else {
            results[codec] = data
          }
          outstanding--
          maybeFinish()
        })
      }
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
    rimraf(folder, err => {
      if (err) {
        console.error('Error deleting folder: ' + folder + '\n' + err)
      }
    })
  }
}

module.exports.forMeatspaceProxy = function(video, ffmpegRunner, cb) {
  // take a video, split it into its requisite frames, and then output to a jpeg
  let id = cuid()
    , folder = TMP_DIR + id
    , inputExtension = fileExtensions[video.type]
  writeTempFiles()

  function writeTempFiles() {
    fs.mkdir(folder, err => {
      if (err) {
        return done(err)
      }

      fs.createWriteStream(`${folder}/vid${inputExtension}`)
        .on('error', done)
        .end(video, split)
    })
  }

  let splitExtension = '.jpg'
  function split() {
    let command = `-i "${folder}/vid${inputExtension}" ` +
        `-filter:v "setpts=0.4*PTS" "${folder}/frame%02d${splitExtension}"`

    ffmpegRunner(command, { timeout: 3000 }, (err, stdout, stderr) => {
      if (err) {
        return done(err)
      }


      let info = videoCodecs.jpg
      doOtherCommand(folder, splitExtension, info.command, info.ext, done)
    })
  }

  function done(err, video) {
    cb(err, video)
    deleteFiles()
  }

  function deleteFiles() {
    rimraf(folder, err => {
      if (err) {
        console.error('Error deleting folder: ' + folder + '\n' + err)
      }
    })
  }
}

function doFfmpeg(ffmpegRunner, folder, imgExtension, vcodecArgs, vidExtension, cb) {
  var command = `-i "${folder}/%d${imgExtension}" -filter:v "setpts=2.5*PTS" ${vcodecArgs} ` +
      `-an "${folder}/vid${vidExtension}"`

  ffmpegRunner(command, { timeout: 3000 }, (err, stdout, stderr) => {
    if (err) {
      return cb(err)
    }

    fs.createReadStream(`${folder}/vid${vidExtension}`)
      .pipe(concat(data => cb(null, data)))
      .on('error', err => cb(err))
  })
}

function doOtherCommand(folder, imgExtension, command, outputExtension, cb) {
  let toRun = `${command} "${folder}/*${imgExtension}" "${folder}/output${outputExtension}"`
  child.exec(toRun, (err, stdout, stderr) => {
    if (err) {
      return cb(err)
    }

    fs.createReadStream(`${folder}/output${outputExtension}`)
      .pipe(concat(data => cb(null, data)))
      .on('error', err => cb(err))
  })
}
