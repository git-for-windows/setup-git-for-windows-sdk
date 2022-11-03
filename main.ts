import * as core from '@actions/core'
import {mkdirp} from './src/downloader'
import {restoreCache, saveCache} from '@actions/cache'
import process from 'process'
import {spawn, spawnSync} from 'child_process'
import {
  getArtifactMetadata,
  getViaGit,
  gitForWindowsUsrBinPath
} from './src/git'
import * as fs from 'fs'

const flavor = core.getInput('flavor')
const architecture = core.getInput('architecture')

async function installArm64Dependencies(
  outputDirectory: string
): Promise<void> {
  if (flavor === 'minimal') {
    throw new Error(`ARM64 not yet supported with flavor '${flavor}`)
  }

  mkdirp(`${outputDirectory}/clangarm64`)
  fs.appendFileSync(
    `${outputDirectory}/etc/pacman.conf`,
    `
    [clangarm64]
    Server = https://mirror.msys2.org/mingw/clangarm64/`
  )

  const packages = [
    'base-devel',
    'mingw-w64-clang-aarch64-openssl',
    'mingw-w64-clang-aarch64-zlib',
    'mingw-w64-clang-aarch64-curl',
    'mingw-w64-clang-aarch64-expat',
    'mingw-w64-clang-aarch64-libiconv',
    'mingw-w64-clang-aarch64-pcre2',
    'mingw-w64-clang-aarch64-libssp'
  ]
  if (flavor === 'full' || flavor === 'makepkg-git') {
    packages.push(
      'mingw-w64-clang-aarch64-toolchain',
      'mingw-w64-clang-aarch64-asciidoc'
    )
  }

  const child = spawn('pacman.exe', ['-Sy', '--noconfirm', ...packages])

  child.stdout.setEncoding('utf-8')
  child.stderr.setEncoding('utf-8')

  child.stdout.on('data', data => {
    core.info(data)
  })

  child.stderr.on('data', data => {
    core.error(data)
  })

  return new Promise((resolve, reject) => {
    child.on('error', error => reject(error))
    child.on('close', status =>
      status === 0
        ? resolve()
        : reject(new Error(`Process exited with status code ${status}`))
    )
  })
}

async function run(): Promise<void> {
  try {
    if (process.platform !== 'win32') {
      core.warning(
        `Skipping this Action because it only works on Windows, not on ${process.platform}`
      )
      return
    }

    const architectureToDownload =
      architecture === 'aarch64' ? 'x86_64' : architecture
    const verbose = core.getInput('verbose')
    const msysMode = core.getInput('msys') === 'true'

    const {artifactName, download, id} = await getViaGit(
      flavor,
      architectureToDownload
    )
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

    const mingw = {
      i686: 'MINGW32',
      x86_64: 'MINGW64',
      aarch64: 'CLANGARM64'
    }[architecture]

    if (mingw === undefined) {
      core.setFailed(`Invalid architecture ${architecture} specified`)
      return
    }

    const msystem = msysMode ? 'MSYS' : mingw

    const binPaths = [
      // Set up PATH so that Git for Windows' SDK's `bash.exe`, `prove` and `gcc` are found
      '/usr/bin/core_perl',
      '/usr/bin',
      `/${mingw.toLocaleLowerCase()}/bin`
    ]

    if (architecture === 'aarch64') {
      // Some binaries aren't available yet in the /clangarm64/bin folder, but Windows 11 ARM64
      // has support for x64 emulation, so let's add /mingw64/bin as a fallback.
      binPaths.splice(binPaths.length - 1, 0, '/mingw64/bin')
    }

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

    if (msystem === 'CLANGARM64') {
      // ARM64 dependencies aren't included yet in the Git for Windows SDK. Ask Pacman to install them.
      core.startGroup(`Installing CLANGARM64 dependencies`)
      await installArm64Dependencies(outputDirectory)
      core.endGroup()
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : `${error}`)
  }
}

function cleanup(): void {
  if (core.getInput('cleanup') !== 'true') {
    core.info(
      `Won't clean up SDK files as the 'cleanup' input was not provided or doesn't equal 'true'.`
    )
    return
  }

  const outputDirectory =
    core.getInput('path') ||
    `C:/${getArtifactMetadata(flavor, architecture).artifactName}`

  /**
   * Shelling out to `rm -rf` is more than twice as fast as Node's `fs.rmSync` method.
   * Let's use it if it's available, and otherwise fall back to `fs.rmSync`.
   */
  const cleanupMethod = fs.existsSync(`${gitForWindowsUsrBinPath}/bash.exe`)
    ? 'rm -rf'
    : 'node'

  core.info(
    `Cleaning up ${outputDirectory} using the "${cleanupMethod}" method...`
  )

  if (cleanupMethod === 'rm -rf') {
    const child = spawnSync(
      `${gitForWindowsUsrBinPath}/bash.exe`,
      ['-c', `rm -rf "${outputDirectory}"`],
      {
        encoding: 'utf-8',
        env: {PATH: '/usr/bin'}
      }
    )

    if (child.error) throw child.error
    if (child.stderr) core.error(child.stderr)
  } else {
    fs.rmSync(outputDirectory, {recursive: true, force: true})
  }

  core.info(`Finished cleaning up ${outputDirectory}.`)
}

/**
 * Indicates whether the POST action is running
 */
export const isPost = !!core.getState('isPost')

if (!isPost) {
  run()
  /*
   * Publish a variable so that when the POST action runs, it can determine it should run the cleanup logic.
   * This is necessary since we don't have a separate entry point.
   * Inspired by https://github.com/actions/checkout/blob/v3.1.0/src/state-helper.ts#L56-L60
   */
  core.saveState('isPost', 'true')
} else {
  // If the POST action is running, we cleanup our artifacts
  cleanup()
}
