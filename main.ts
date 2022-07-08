import * as core from '@actions/core'
import {mkdirp} from './src/downloader'
import {restoreCache, saveCache} from '@actions/cache'
import process from 'process'
import {spawnSync} from 'child_process'
import {getViaGit} from './src/git'

async function run(): Promise<void> {
  try {
    if (process.platform !== 'win32') {
      core.warning(
        `Skipping this Action because it only works on Windows, not on ${process.platform}`
      )
      return
    }
    const flavor = core.getInput('flavor')
    const architecture = core.getInput('architecture')
    const verbose = core.getInput('verbose')
    const msysMode = core.getInput('msys') === 'true'

    const {artifactName, download, id} = await getViaGit(flavor, architecture)
    const outputDirectory = core.getInput('path') || `C:/${artifactName}`
    let useCache: boolean
    switch (core.getInput('cache')) {
      case 'true':
        useCache = true
        break
      case 'auto':
        useCache = flavor !== 'full'
        break
      default:
        useCache = false
    }

    let needToDownload = true
    try {
      if (useCache && (await restoreCache([outputDirectory], id))) {
        core.info(`Cached ${id} was successfully restored`)
        needToDownload = false
      }
    } catch (e) {
      core.warning(`Cannot use @actions/cache (${e})`)
      useCache = false
    }

    if (needToDownload) {
      core.info(`Downloading ${artifactName}`)
      await download(
        outputDirectory,
        verbose.match(/^\d+$/) ? parseInt(verbose) : verbose === 'true'
      )

      try {
        if (useCache && !(await saveCache([outputDirectory], id))) {
          core.warning(`Failed to cache ${id}`)
        }
      } catch (e) {
        core.warning(
          `Failed to cache ${id}: ${e instanceof Error ? e.message : e}`
        )
      }
    }

    const mingw = architecture === 'i686' ? 'MINGW32' : 'MINGW64'
    const msystem = msysMode ? 'MSYS' : mingw

    const binPaths = [
      // Set up PATH so that Git for Windows' SDK's `bash.exe`, `prove` and `gcc` are found
      '/usr/bin/core_perl',
      '/usr/bin',
      `/${mingw.toLocaleLowerCase()}/bin`
    ]
    for (const binPath of msysMode ? binPaths.reverse() : binPaths) {
      core.addPath(`${outputDirectory}${binPath}`)
    }

    core.exportVariable('MSYSTEM', msystem)
    if (
      !('LANG' in process.env) &&
      !('LC_ALL' in process.env) &&
      !('LC_CTYPE' in process.env)
    ) {
      core.exportVariable('LC_CTYPE', 'C.UTF-8')
    }

    // ensure that /dev/fd/*, /dev/mqueue and friends exist
    for (const path of ['/dev/mqueue', '/dev/shm']) {
      mkdirp(`${outputDirectory}${path}`)
    }

    const ln = (linkPath: string, target: string): void => {
      const child = spawnSync(
        flavor === 'minimal' ? 'ln.exe' : 'usr\\bin\\ln.exe',
        ['-s', target, linkPath],
        {
          cwd: outputDirectory,
          env: {
            MSYS: 'winsymlinks:sys'
          }
        }
      )
      if (child.error) throw child.error
    }
    for (const [linkPath, target] of Object.entries({
      fd: 'fd',
      stdin: 'fd/0',
      stdout: 'fd/1',
      stderr: 'fd/2'
    })) {
      ln(`/dev/${linkPath}`, `/proc/self/${target}`)
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : `${error}`)
  }
}

run()
