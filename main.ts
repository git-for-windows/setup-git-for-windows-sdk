import * as core from '@actions/core'
import {get} from './src/downloader'

async function run(): Promise<void> {
  try {
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
