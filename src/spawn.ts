import {spawn as SpawnInternal, SpawnOptions} from 'child_process'

export type SpawnReturnArgs = {
  exitCode: number | null
}

/**
 * Simple wrapper around NodeJS's "child_process.spawn" function.
 * Since we only use the exit code, we only expose that.
 */
export async function spawnAndWaitForExitCode(
  command: string,
  args: readonly string[],
  options: SpawnOptions
): Promise<SpawnReturnArgs> {
  const child = SpawnInternal(command, args, {
    ...options,
    // 'inherit' means that the child process will use the same stdio/stderr as the parent process
    stdio: [undefined, 'inherit', 'inherit']
  })

  return new Promise<SpawnReturnArgs>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', code => {
      resolve({exitCode: code})
    })
  })
}
