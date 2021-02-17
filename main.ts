import * as core from '@actions/core'
import process from 'process'
import {get} from './src/downloader'

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

    const {artifactName, download} = await get(flavor, architecture)
    const outputDirectory = core.getInput('path') || `C:/${artifactName}`

    core.info(`Downloading ${artifactName}`)
    await download(outputDirectory, true)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
