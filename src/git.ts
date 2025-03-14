import * as core from '@actions/core'
import {spawnAndWaitForExitCode, SpawnReturnArgs} from './spawn'
import {Octokit} from '@octokit/rest'
import {delimiter} from 'path'
import * as fs from 'fs'

// If present, do prefer the build agent's copy of Git
const externalsGitDir = `${process.env.AGENT_HOMEDIRECTORY}/externals/git`
const gitForWindowsRoot = 'C:/Program Files/Git'
const gitRoot = fs.existsSync(externalsGitDir)
  ? externalsGitDir
  : gitForWindowsRoot

const gitForWindowsBinPaths = ['clangarm64', 'mingw64', 'mingw32', 'usr'].map(
  p => `${gitRoot}/${p}/bin`
)
export const gitForWindowsUsrBinPath =
  gitForWindowsBinPaths[gitForWindowsBinPaths.length - 1]
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
): {repo: string; artifactName: string} {
  const repo = {
    i686: 'git-sdk-32',
    x86_64: 'git-sdk-64',
    aarch64: 'git-sdk-arm64'
  }[architecture]

  if (repo === undefined) {
    throw new Error(`Invalid architecture ${architecture} specified`)
  }

  const artifactName = `${repo}-${flavor}`

  return {repo, artifactName}
}

export async function clone(
  url: string,
  destination: string,
  verbose: number | boolean,
  cloneExtraOptions: string[] = []
): Promise<void> {
  if (verbose) core.info(`Cloning ${url} to ${destination}`)
  const child = await spawnAndWaitForExitCode(
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
      }
    }
  )
  if (child.exitCode !== 0) {
    throw new Error(`git clone: exited with code ${child.exitCode}`)
  }
}

async function updateHEAD(
  bareRepositoryPath: string,
  headSHA: string
): Promise<void> {
  const child = await spawnAndWaitForExitCode(
    gitExePath,
    ['--git-dir', bareRepositoryPath, 'update-ref', 'HEAD', headSHA],
    {
      env: {
        GIT_CONFIG_PARAMETERS
      }
    }
  )
  if (child.exitCode !== 0) {
    throw new Error(`git: exited with code ${child.exitCode}`)
  }
}

export async function getViaGit(
  flavor: string,
  architecture: string,
  githubToken?: string
): Promise<{
  artifactName: string
  id: string
  download: (
    outputDirectory: string,
    verbose?: number | boolean
  ) => Promise<void>
}> {
  const owner = 'git-for-windows'

  const {repo, artifactName} = getArtifactMetadata(flavor, architecture)

  const octokit = githubToken ? new Octokit({auth: githubToken}) : new Octokit()
  let head_sha: string
  if (flavor === 'minimal') {
    const info = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: 938271,
      status: 'success',
      branch: 'main',
      event: 'push',
      per_page: 1
    })
    head_sha = info.data.workflow_runs[0].head_sha
    /*
     * There was a GCC upgrade to v14.1 that broke the build with `DEVELOPER=1`,
     * and `ci-artifacts` was not updated to test-build with `DEVELOPER=1` (this
     * was fixed in https://github.com/git-for-windows/git-sdk-64/pull/83).
     *
     * Work around that by forcing the incorrectly-passing revision back to the
     * last one before that GCC upgrade.
     */
    if (head_sha === '5f6ba092f690c0bbf84c7201be97db59cdaeb891') {
      head_sha = 'e37e3f44c1934f0f263dabbf4ed50a3cfb6eaf71'
    }
  } else {
    const info = await octokit.repos.getBranch({
      owner,
      repo,
      branch: 'main'
    })
    head_sha = info.data.commit.sha
  }
  const id = `${artifactName}-${head_sha}${head_sha === 'e37e3f44c1934f0f263dabbf4ed50a3cfb6eaf71' ? '-2' : ''}`
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

      let child: SpawnReturnArgs
      if (flavor === 'full') {
        core.startGroup(`Checking out ${repo}`)
        child = await spawnAndWaitForExitCode(
          gitExePath,
          [`--git-dir=.tmp`, 'worktree', 'add', outputDirectory, head_sha],
          {
            env: {
              GIT_CONFIG_PARAMETERS
            }
          }
        )
      } else {
        await updateHEAD('.tmp', head_sha)
        core.startGroup('Cloning build-extra')
        await clone(
          `https://github.com/${owner}/build-extra`,
          '.tmp/build-extra',
          verbose
        )
        core.endGroup()

        core.startGroup(`Creating ${flavor} artifact`)
        const traceArg = verbose ? ['-x'] : []
        child = await spawnAndWaitForExitCode(
          `${gitForWindowsUsrBinPath}/bash.exe`,
          [
            ...traceArg,
            '.tmp/build-extra/please.sh',
            'create-sdk-artifact',
            `--architecture=${architecture}`,
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
              PATH: `${gitForWindowsBinPaths.join(delimiter)}${delimiter}${process.env.PATH}`
            }
          }
        )
      }
      core.endGroup()
      if (child.exitCode === 0) {
        fs.rmSync('.tmp', {recursive: true})
      } else {
        throw new Error(`process exited with code ${child.exitCode}`)
      }
    }
  }
}
