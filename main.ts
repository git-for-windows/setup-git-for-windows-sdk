import {run} from './src/action'
import {ICore} from './src/core'
import * as core from '@actions/core'
import * as cache from '@actions/cache'

export class ActionsCore implements ICore {
  isCacheAvailable(): boolean {
    return cache.isFeatureAvailable()
  }

  async restoreCache(
    paths: string[],
    primaryKey: string
  ): Promise<string | undefined> {
    return cache.restoreCache(paths, primaryKey)
  }

  async saveCache(paths: string[], key: string): Promise<number> {
    return cache.saveCache(paths, key)
  }

  getInput(name: string): string {
    return core.getInput(name)
  }

  setOutput(name: string, value: string): void {
    core.setOutput(name, value)
  }

  addPath(inputPath: string): void {
    core.addPath(inputPath)
  }

  exportVariable(name: string, value: string): void {
    core.exportVariable(name, value)
  }

  info(message: string): void {
    core.info(message)
  }

  warning(message: string): void {
    core.warning(message)
  }

  error(message: string): void {
    core.error(message)
  }

  setFailed(message: string): void {
    core.setFailed(message)
  }

  startGroup(name: string): void {
    core.startGroup(name)
  }

  endGroup(): void {
    core.endGroup()
  }

  saveState(name: string, value: string): void {
    core.saveState(name, value)
  }

  getState(name: string): string {
    return core.getState(name)
  }
}

run(new ActionsCore())
