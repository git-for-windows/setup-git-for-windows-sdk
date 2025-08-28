/* eslint no-console: ["error", { allow: ["log"] }] */
import * as tl from 'azure-pipelines-task-lib/task'
import {ICore} from '../../../src/core'

// Some input names are different between GitHub Actions <---> Azure Pipelines.
const inputMap: {[key: string]: string} = {
  'github-token': 'githubToken' // no '-' allowed in Azure task input names
}

export class AzureCore implements ICore {
  isCacheAvailable(): boolean {
    return false
  }

  async restoreCache(
    _paths: string[],
    _primaryKey: string
  ): Promise<string | undefined> {
    throw new Error('Not supported on Azure Pipelines.')
  }

  async saveCache(_paths: string[], _key: string): Promise<number> {
    throw new Error('Not supported on Azure Pipelines.')
  }

  getInput(name: string): string {
    // If the input name is mapped, use the mapped name, otherwise use it as is.
    const azName = inputMap[name] ?? name
    return tl.getInput(azName, false) ?? ''
  }

  setOutput(name: string, value: string): void {
    // Expose outputs as variables for downstream steps
    tl.setVariable(name, value)
  }

  addPath(inputPath: string): void {
    tl.debug(`Prepending PATH with ${inputPath}`)
    tl.prependPath(inputPath)
  }

  exportVariable(name: string, value: string): void {
    tl.setVariable(name, value)
  }

  info(message: string): void {
    console.log(message)
  }

  warning(message: string): void {
    tl.warning(message)
  }

  error(message: string): void {
    tl.error(message)
  }

  setFailed(message: string): void {
    tl.setResult(tl.TaskResult.Failed, message)
  }

  startGroup(name: string): void {
    console.log(`##[group]${name}`)
  }

  endGroup(): void {
    console.log('##[endgroup]')
  }

  saveState(name: string, value: string): void {
    // Save as job-scoped variable
    tl.setVariable(`state.${name}`, value, false, true)
  }

  getState(name: string): string {
    return tl.getVariable(`state.${name}`) ?? ''
  }
}
