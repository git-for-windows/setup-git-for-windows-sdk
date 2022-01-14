/* eslint-disable no-console */
import * as child_process from 'child_process'
import * as path from 'path'
import * as process from 'process'
import {statSync} from 'fs'

async function runAction(
  options?: child_process.SpawnOptionsWithoutStdio
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const nodeExePath = process.execPath
    const scriptPath = path.join(__dirname, '..', 'lib', 'main.js')

    const child = child_process
      .spawn(nodeExePath, [scriptPath], options)
      .on('error', reject)
      .on('close', resolve)

    child.stderr.on('data', data => console.log(`${data}`))
    child.stdout.on('data', data => console.log(`${data}`))
  })
}

if (process.env.RUN_NETWORK_TESTS !== 'true') {
  test('skipping tests requiring network access', async () => {
    console.log(
      `If you want to run tests that access the network, set:\nexport RUN_NETWORK_TESTS=true`
    )
  })
} else {
  // shows how the runner will run a javascript action with env / stdout protocol
  test('cannot download 32-bit minimal SDK', async () => {
    expect(
      await runAction({
        env: {
          INPUT_FLAVOR: 'minimal',
          INPUT_ARCHITECTURE: 'i686'
        }
      })
    ).toEqual(1)
  })

  jest.setTimeout(5 * 60 * 1000) // this can easily take a minute or five

  test('extract the 64-bit minimal SDK', async () => {
    const outputDirectory = `${__dirname}/../git-sdk-64-minimal`
    expect(
      await runAction({
        env: {
          INPUT_FLAVOR: 'minimal',
          INPUT_ARCHITECTURE: 'x86_64',
          INPUT_PATH: outputDirectory,
          INPUT_VERBOSE: '250',
          INPUT_CACHE: 'true'
        }
      })
    ).toEqual(0)
    expect(
      statSync.bind(null, `${outputDirectory}/mingw64/bin/gcc.exe`)
    ).not.toThrow()

    const hello = child_process.spawnSync(
      'usr\\bin\\bash.exe',
      ['-lc', 'cat <(echo hello)'],
      {
        cwd: outputDirectory
      }
    )
    expect(hello.stderr.toString()).toBe('')
    expect(hello.stdout.toString()).toBe('hello\n')
  })
}
