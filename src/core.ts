/**
 * Interface abstracting the core functionality needed for GitHub Actions and Azure Pipelines.
 * This allows us to avoid module shimming and provide clean implementations for different platforms.
 */
export interface ICore {
  /**
   * Checks if caching is available.
   */
  isCacheAvailable(): boolean

  /**
   * Restores cache from keys
   *
   * @param paths a list of file paths to restore from the cache
   * @param primaryKey an explicit key for restoring the cache. Lookup is done with prefix matching.
   * @returns string returns the key for the cache hit, otherwise returns undefined
   */
  restoreCache(paths: string[], primaryKey: string): Promise<string | undefined>

  /**
   * Saves a list of files with the specified key
   *
   * @param paths a list of file paths to be cached
   * @param key an explicit key for restoring the cache
   * @returns number returns cacheId if the cache was saved successfully and throws an error if save fails
   */
  saveCache(paths: string[], key: string): Promise<number>

  /**
   * Gets an input from the action/task configuration.
   * @param name The name of the input
   * @returns The input value or empty string if not found
   */
  getInput(name: string): string

  /**
   * Sets an output for the action/task.
   * @param name The name of the output
   * @param value The output value
   */
  setOutput(name: string, value: string): void

  /**
   * Adds a path to the PATH environment variable.
   * @param inputPath The path to add
   */
  addPath(inputPath: string): void

  /**
   * Exports a variable to the environment.
   * @param name The variable name
   * @param value The variable value
   */
  exportVariable(name: string, value: string): void

  /**
   * Logs an informational message.
   * @param message The message to log
   */
  info(message: string): void

  /**
   * Logs a warning message.
   * @param message The warning message
   */
  warning(message: string): void

  /**
   * Logs an error message.
   * @param message The error message
   */
  error(message: string): void

  /**
   * Sets the action/task as failed with the given message.
   * @param message The failure message
   */
  setFailed(message: string): void

  /**
   * Starts a group for log output organization.
   * @param name The group name
   */
  startGroup(name: string): void

  /**
   * Ends the current log group.
   */
  endGroup(): void

  /**
   * Saves state for post-job execution.
   * @param name The state name
   * @param value The state value
   */
  saveState(name: string, value: string): void

  /**
   * Gets previously saved state.
   * @param name The state name
   * @returns The state value or empty string if not found
   */
  getState(name: string): string
}
