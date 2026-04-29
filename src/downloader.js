import fs from 'fs'

/**
 * @param {string} directoryPath
 * @returns {void}
 */
export function mkdirp(directoryPath) {
  try {
    const stat = fs.statSync(directoryPath)
    if (stat.isDirectory()) {
      return
    }
    throw new Error(`${directoryPath} exists, but is not a directory`)
  } catch (e) {
    if (!(e instanceof Object) || /** @type {{code: string}} */ (e).code !== 'ENOENT') {
      throw e
    }
  }
  fs.mkdirSync(directoryPath, {recursive: true})
}
