import * as core from '@actions/core'
import {ChildProcess, spawn} from 'child_process'
import {Octokit} from '@octokit/rest'
import {delimiter} from 'path'
import * as fs from 'fs'

// If present, do prefer the build agent's copy of Git
const externalsGitDir = `${process.env.AGENT_HOMEDIRECTORY}/externals/git`
const gitForWindowsRoot = 'C:/Program Files/Git'
const gitRoot = fs.existsSync(externalsGitDir)
  ? externalsGitDir
  : gitForWindowsRoot

export const gitForWindowsUsrBinPath = `${gitRoot}/usr/bin`
const gitExePath = `${gitRoot}/cmd/git.exe`

/*
 * It looks a bit ridiculous to use 56 workers on a build agent that has only
 * a two-core CPU, yet manual testing revealed that 64 workers would be _even
 * better_. But at 92 workers, resources are starved so much that the checkout
 * is not only much faster, but also fails.
 *
 * Let's stick with 56, which should avoid running out of resources, but still
 * is much faster than, say, using only 2 workers.
 */
const GIT_CONFIG_PARAMETERS = `'checkout.workers=56'`

export function getArtifactMetadata(
  flavor: string,
  architecture: string
): {bitness: string; repo: string; artifactName: string} {
  const bitness = architecture === 'i686' ? '32' : '64'
  const repo = `git-sdk-${bitness}`
  const artifactName = `${repo}-${flavor}`

  return {bitness, repo, artifactName}
}

async function clone(
  url: string,
  destination: string,
  verbose: number | boolean,
  cloneExtraOptions: string[] = []
): Promise<void> {
  if (verbose) core.info(`Cloning ${url} to ${destination}`)
  const child = spawn(
    gitExePath,
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
      env: {
        GIT_CONFIG_PARAMETERS
      },
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
  const owner = 'git-for-windows'

  const {bitness, repo, artifactName} = getArtifactMetadata(
    flavor,
    architecture
  )

  const octokit = new Octokit()
  let head_sha: string
  if (flavor === 'minimal') {
    const info = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: 938271,
      status: 'success',
      per_page: 1
    })
    head_sha = info.data.workflow_runs[0].head_sha
  } else {
    const info = await octokit.repos.getBranch({
      owner,
      repo,
      branch: 'main'
    })
    head_sha = info.data.commit.sha
  }
  const id = `${artifactName}-${head_sha}`
  core.info(`Got commit ${head_sha} for ${repo}`)

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
          gitExePath,
          [`--git-dir=.tmp`, 'worktree', 'add', outputDirectory, head_sha],
          {
            env: {
              GIT_CONFIG_PARAMETERS
            },
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
              GIT_CONFIG_PARAMETERS,
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
            fs.rm('.tmp', {recursive: true}, () => resolve())
          } else {
            reject(new Error(`process exited with code ${code}`))
          }
        })
      })
    }
  }
}
