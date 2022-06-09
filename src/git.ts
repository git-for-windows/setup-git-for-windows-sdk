import * as core from '@actions/core'
import {ChildProcess, spawn} from 'child_process'
import {Octokit} from '@octokit/rest'
import {delimiter} from 'path'

const gitForWindowsUsrBinPath = 'C:/Program Files/Git/usr/bin'

async function clone(
  url: string,
  destination: string,
  verbose: number | boolean,
  cloneExtraOptions: string[] = []
): Promise<void> {
  if (verbose) core.notice(`Cloning ${url} to ${destination}`)
  const child = spawn(
    'git.exe',
    [
      'clone',
      '--depth=1',
      '--single-branch',
      '--branch=main',
      ...cloneExtraOptions,
      url,
      destination
    ],
    {
      stdio: [undefined, 'inherit', 'inherit']
    }
  )
  return new Promise<void>((resolve, reject) => {
    child.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`tar: exited with code ${code}`))
      }
    })
  })
}

export async function getViaGit(
  flavor: string,
  architecture: string
): Promise<{
  artifactName: string
  id: string
  download: (
    outputDirectory: string,
    verbose?: number | boolean
  ) => Promise<void>
}> {
  const bitness = architecture === 'i686' ? '32' : '64'
  const owner = 'git-for-windows'
  const repo = `git-sdk-${bitness}`
  const artifactName = `${repo}-${flavor}`

  const octokit = new Octokit()
  const info = await octokit.repos.getBranch({
    owner,
    repo,
    branch: 'main'
  })
  const id = info.data.commit.sha
  core.notice(`Got ID ${id} for ${repo}`)

  return {
    artifactName,
    id,
    download: async (
      outputDirectory: string,
      verbose: number | boolean = false
    ): Promise<void> => {
      core.startGroup(`Cloning ${repo}`)
      const partialCloneArg = flavor === 'full' ? [] : ['--filter=blob:none']
      await clone(`https://github.com/${owner}/${repo}`, `.tmp`, verbose, [
        '--bare',
        ...partialCloneArg
      ])
      core.endGroup()

      let child: ChildProcess
      if (flavor === 'full') {
        core.startGroup(`Checking out ${repo}`)
        child = spawn(
          'git.exe',
          [`--git-dir=.tmp`, 'worktree', 'add', outputDirectory, id],
          {
            stdio: [undefined, 'inherit', 'inherit']
          }
        )
      } else {
        core.startGroup('Cloning build-extra')
        await clone(
          `https://github.com/${owner}/build-extra`,
          '.tmp/build-extra',
          verbose
        )
        core.endGroup()

        core.startGroup(`Creating ${flavor} artifact`)
        const traceArg = verbose ? ['-x'] : []
        child = spawn(
          `${gitForWindowsUsrBinPath}/bash.exe`,
          [
            ...traceArg,
            '.tmp/build-extra/please.sh',
            'create-sdk-artifact',
            `--bitness=${bitness}`,
            `--out=${outputDirectory}`,
            '--sdk=.tmp',
            flavor
          ],
          {
            env: {
              COMSPEC:
                process.env.COMSPEC ||
                `${process.env.WINDIR}\\system32\\cmd.exe`,
              LC_CTYPE: 'C.UTF-8',
              CHERE_INVOKING: '1',
              MSYSTEM: 'MINGW64',
              PATH: `${gitForWindowsUsrBinPath}${delimiter}${process.env.PATH}`
            },
            stdio: [undefined, 'inherit', 'inherit']
          }
        )
      }
      return new Promise<void>((resolve, reject) => {
        child.on('close', code => {
          core.endGroup()
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`process exited with code ${code}`))
          }
        })
      })
    }
  }
}
