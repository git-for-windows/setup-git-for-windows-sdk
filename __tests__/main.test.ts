/* eslint-disable no-console */
import * as process from 'process'
import * as child_process from 'child_process'
import * as path from 'path'

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
}
