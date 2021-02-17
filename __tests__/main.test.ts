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

// shows how the runner will run a javascript action with env / stdout protocol
test('test this Action locally', async () => {
  expect(await runAction()).toEqual(0)
})
