import fs from 'fs'

export function mkdirp(directoryPath: string): void {
  try {
    const stat = fs.statSync(directoryPath)
    if (stat.isDirectory()) {
      return
    }
    throw new Error(`${directoryPath} exists, but is not a directory`)
  } catch (e) {
    if (!(e instanceof Object) || (e as {code: string}).code !== 'ENOENT') {
      throw e
    }
  }
  fs.mkdirSync(directoryPath, {recursive: true})
}
