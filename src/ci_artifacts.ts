import * as core from '@actions/core'
import {Octokit} from '@octokit/rest'
import {getArtifactMetadata} from './git'
import {spawn} from 'child_process'
import * as fs from 'fs'

async function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve, _reject) => {
    setTimeout(resolve, milliseconds)
  })
}

export async function getViaCIArtifacts(
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

  const {repo, artifactName} = getArtifactMetadata('minimal', architecture)

  const octokit = githubToken ? new Octokit({auth: githubToken}) : new Octokit()

  const {
    name,
    updated_at: updatedAt,
    browser_download_url: url
  } = await (async () => {
    let error: Error | undefined
    for (const seconds of [0, 5, 10, 15, 20, 40]) {
      if (seconds) await sleep(seconds)

      const ciArtifactsResponse = await octokit.repos.getReleaseByTag({
        owner,
        repo,
        tag: 'ci-artifacts'
      })

      if (ciArtifactsResponse.status !== 200) {
        error = new Error(
          `Failed to get ci-artifacts release from the ${owner}/${repo} repo: ${ciArtifactsResponse.status}`
        )
        continue
      }

      core.info(
        `Found ci-artifacts release: ${ciArtifactsResponse.data.html_url}`
      )
      const tarGzArtifact = ciArtifactsResponse.data.assets.find(asset =>
        asset.name.endsWith('.tar.gz')
      )

      if (!tarGzArtifact) {
        error = new Error(
          `Failed to find a .tar.gz artifact in the ci-artifacts release of the ${owner}/${repo} repo`
        )
        continue
      }

      return tarGzArtifact
    }
    throw error
  })()
  core.info(`Found ${name} at ${url}`)

  return {
    artifactName,
    id: `ci-artifacts-${updatedAt}`,
    download: async (
      outputDirectory: string,
      verbose: number | boolean = false
    ): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        const curl = spawn(
          `${process.env.SYSTEMROOT}/system32/curl.exe`,
          [
            ...(githubToken
              ? ['-H', `Authorization: Bearer ${githubToken}`]
              : []),
            '-H',
            'Accept: application/octet-stream',
            `-${verbose === true ? '' : 's'}fL`,
            url
          ],
          {
            stdio: ['ignore', 'pipe', process.stderr]
          }
        )
        curl.on('error', error => reject(error))

        fs.mkdirSync(outputDirectory, {recursive: true})

        const tar = spawn(
          `${process.env.SYSTEMROOT}/system32/tar.exe`,
          ['-C', outputDirectory, `-x${verbose === true ? 'v' : ''}f`, '-'],
          {stdio: ['pipe', process.stdout, process.stderr]}
        )
        tar.on('error', error => reject(error))
        tar.on('close', code => {
          if (code === 0) resolve()
          else reject(new Error(`tar exited with code ${code}`))
        })

        curl.stdout.pipe(tar.stdin)
      })
    }
  }
}
