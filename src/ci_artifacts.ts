import * as core from '@actions/core'
import {Octokit} from '@octokit/rest'
import {getArtifactMetadata} from './git'
import {spawn} from 'child_process'
import * as fs from 'fs'

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

  const ciArtifactsResponse = await octokit.repos.getReleaseByTag({
    owner,
    repo,
    tag: 'ci-artifacts'
  })

  if (ciArtifactsResponse.status !== 200) {
    throw new Error(
      `Failed to get ci-artifacts release from the ${owner}/${repo} repo: ${ciArtifactsResponse.status}`
    )
  }

  core.info(`Found ci-artifacts release: ${ciArtifactsResponse.data.html_url}`)
  const tarGzArtifact = ciArtifactsResponse.data.assets.find(asset =>
    asset.name.endsWith('.tar.gz')
  )

  if (!tarGzArtifact) {
    throw new Error(
      `Failed to find a .tar.gz artifact in the ci-artifacts release of the ${owner}/${repo} repo`
    )
  }

  const url = tarGzArtifact.browser_download_url
  core.info(`Found ${tarGzArtifact.name} at ${url}`)

  return {
    artifactName,
    id: `ci-artifacts-${tarGzArtifact.updated_at}`,
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
