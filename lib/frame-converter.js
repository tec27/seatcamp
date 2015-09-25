import cuid from 'cuid'
import fs from 'fs'
import concat from 'concat-stream'
import rimraf from 'rimraf'
import child from 'child_process'

const TMP_DIR = __dirname + '/../tmp/'

const fileExtensions = {
  'image/jpeg': '.jpg',
  'video/webm': '.webm',
  'video/mp4': '.mp4',
}
const videoCodecs = {
  jpg: {
    // "filmstrip" jpg view
    ext: '.jpg',
    command: 'convert -append'
  },
}

function convertFrame(frames, format, ffmpegRunner, cb) {
  if (!fileExtensions[format]) {
    return cb(new Error('Invalid input format'))
  }

  const id = cuid()
  const folder = TMP_DIR + id
  const imgExtension = fileExtensions[format]
  writeTempFiles()

  function writeTempFiles() {
    fs.mkdir(folder, err => {
      if (err) {
        return done(err)
      }

      let count = 0
      for (let i = 0; i < frames.length; i++) {
        fs.createWriteStream(folder + '/' + i + imgExtension)
          .on('error', done)
          .end(frames[i], fileDone)
      }

      function fileDone() {
        count++
        if (count === frames.length) {
          convert()
        }
      }
    })
  }

  function convert() {
    const results = {}
    let outstanding = 0
    let firstErr
    Object.keys(videoCodecs).forEach(codec => {
      const info = videoCodecs[codec]
      outstanding++
      doOtherCommand(folder, imgExtension, info.command, info.ext, (err, data) => {
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

  function done(err, results) {
    cb(err, results)
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

convertFrame.forMeatspaceProxy = function(video, ffmpegRunner, cb) {
  // take a video, split it into its requisite frames, and then output to a jpeg
  const id = cuid()
  const folder = TMP_DIR + id
  const inputExtension = fileExtensions[video.type]
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

  const splitExtension = '.jpg'
  function split() {
    const command = `-i "${folder}/vid${inputExtension}" ` +
        `-filter:v "setpts=0.4*PTS" -qscale:v 1 "${folder}/frame%02d${splitExtension}"`

    ffmpegRunner(command, { timeout: 3000 }, (err, stdout, stderr) => {
      if (err) {
        return done(err)
      }


      const info = videoCodecs.jpg
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

function doOtherCommand(folder, imgExtension, command, outputExtension, cb) {
  const toRun = `${command} "${folder}/*${imgExtension}" "${folder}/output${outputExtension}"`
  child.exec(toRun, (err, stdout, stderr) => {
    if (err) {
      return cb(err)
    }

    fs.createReadStream(`${folder}/output${outputExtension}`)
      .pipe(concat(data => cb(null, data)))
      .on('error', err => cb(err))
  })
}

export default convertFrame
