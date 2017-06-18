import { exec } from 'child_process'
import thenify from 'thenify'

const execAsync = thenify(exec, { multiArgs: [ 'stdout', 'stderr' ] })

const possibilities = [
  'ffmpeg',
  'avconv',
]

export default async function() {
  for (const cmd of possibilities) {
    try {
      await execAsync(cmd + ' -h', { timeout: 1000 })
      return createRunner(cmd)
    } catch (err) {
      // ignore and try the next command
    }
  }

  throw new Error('No valid ffmpeg-like utility found. Please install or put one on your path.')
}

function createRunner(cmd) {
  return function(args, options) {
    return execAsync(cmd + ' ' + args, options)
  }
}
