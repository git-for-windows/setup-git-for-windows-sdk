import * as fs from 'fs'
import * as git from '../git'
import * as spawn from '../spawn'
import {ICore} from '../core'

const core: ICore = {
  isCacheAvailable: () => false,
  restoreCache: async () => undefined,
  saveCache: async () => 0,
  getInput: () => '',
  setOutput: () => {},
  addPath: () => {},
  exportVariable: () => {},
  info: () => {},
  warning: () => {},
  error: () => {},
  setFailed: () => {},
  startGroup: () => {},
  endGroup: () => {},
  saveState: () => {},
  getState: () => ''
}

// We want to mock only the rmSync method on the fs module, and leave everything
// else untouched.
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  rmSync: jest.fn()
}))

describe('git', () => {
  // We don't want to _actually_ spawn external commands, so we mock the function
  let spawnSpy: jest.SpyInstance
  // Capture the startGroup calls
  let coreSpy: jest.SpyInstance
  // The script calls fs.rmSync, so let's mock it and verify it was called
  let rmSyncSpy: jest.SpyInstance

  beforeEach(() => {
    coreSpy = jest.spyOn(core, 'startGroup')
    spawnSpy = jest.spyOn(spawn, 'spawnAndWaitForExitCode').mockResolvedValue({
      // 0 is the exit code for success
      exitCode: 0
    })
    // We don't want to _actually_ clone the repo, so we mock the function
    jest.spyOn(git, 'clone').mockResolvedValue()
    rmSyncSpy = fs.rmSync as jest.Mocked<typeof fs>['rmSync']
  })

  test('getViaGit build-installers x86_64', async () => {
    const flavor = 'build-installers'
    const architecture = 'x86_64'
    const outputDirectory = 'outputDirectory'
    const {artifactName, download} = await git.getViaGit(
      core,
      flavor,
      architecture
    )

    expect(artifactName).toEqual('git-sdk-64-build-installers')

    await download(outputDirectory, true)

    expect(coreSpy).toHaveBeenCalledWith(`Creating ${flavor} artifact`)
    expect(spawnSpy).toHaveBeenCalledWith(
      expect.stringContaining('/bash.exe'),
      expect.arrayContaining([
        '.tmp/build-extra/please.sh',
        'create-sdk-artifact',
        `--architecture=${architecture}`,
        `--out=${outputDirectory}`
      ]),
      expect.objectContaining({
        env: expect.objectContaining({
          // We want to ensure that the correct /bin folders are in the PATH,
          // so that please.sh can find git.exe
          // https://github.com/git-for-windows/setup-git-for-windows-sdk/issues/951
          PATH:
            expect.stringContaining('/clangarm64/bin') &&
            expect.stringContaining('/mingw64/bin')
        })
      })
    )
    expect(rmSyncSpy).toHaveBeenCalledWith('.tmp', {recursive: true})
  })

  test('getViaGit full x86_64', async () => {
    const flavor = 'full'
    const architecture = 'x86_64'
    const outputDirectory = 'outputDirectory'
    const {artifactName, download} = await git.getViaGit(
      core,
      flavor,
      architecture
    )

    expect(artifactName).toEqual('git-sdk-64-full')

    await download(outputDirectory, true)

    expect(coreSpy).toHaveBeenCalledWith(`Checking out git-sdk-64`)
    expect(spawnSpy).toHaveBeenCalledWith(
      expect.stringContaining('/git.exe'),
      expect.arrayContaining([
        '--git-dir=.tmp',
        'worktree',
        'add',
        outputDirectory
      ]),
      expect.any(Object)
    )
    expect(rmSyncSpy).toHaveBeenCalledWith('.tmp', {recursive: true})
  })
})
