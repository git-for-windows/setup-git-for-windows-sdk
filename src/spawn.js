import {spawn as SpawnInternal} from 'child_process'

/**
 * @typedef {{ exitCode: number | null }} SpawnReturnArgs
 */

/**
 * Simple wrapper around NodeJS's "child_process.spawn" function.
 * Since we only use the exit code, we only expose that.
 *
 * @param {string} command
 * @param {readonly string[]} args
 * @param {import('child_process').SpawnOptions} options
 * @returns {Promise<SpawnReturnArgs>}
 */
export async function spawnAndWaitForExitCode(command, args, options) {
  const child = SpawnInternal(command, args, {
    ...options,
    // 'inherit' means that the child process will use the same stdio/stderr as the parent process
    stdio: [undefined, 'inherit', 'inherit']
  })

  return new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', code => {
      resolve({exitCode: code})
    })
  })
}
