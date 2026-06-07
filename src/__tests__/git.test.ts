import {describe, test, expect, beforeEach, vi} from 'vitest'

vi.mock('fs', async () => ({
  ...(await vi.importActual('fs')),
  rmSync: vi.fn()
}))

vi.mock('@actions/core', async () => ({
  ...(await vi.importActual('@actions/core'))
}))

vi.mock('../spawn.js', async () => ({
  ...(await vi.importActual('../spawn.js'))
}))

vi.mock('../git.js', async () => ({
  ...(await vi.importActual('../git.js'))
}))

const fs = await import('fs')
const git = await import('../git.js')
const spawn = await import('../spawn.js')
const core = await import('@actions/core')

describe('git', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('getViaGit build-installers x86_64', async () => {
    const flavor = 'build-installers'
    const architecture = 'x86_64'
    const outputDirectory = 'outputDirectory'

    const coreSpy = vi.spyOn(core, 'startGroup')
    const spawnSpy = vi
      .spyOn(spawn, 'spawnAndWaitForExitCode')
      .mockResolvedValue({
        exitCode: 0
      })
    vi.spyOn(git, 'clone').mockResolvedValue()

    const {artifactName, download} = await git.getViaGit(flavor, architecture)

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
          PATH:
            expect.stringContaining('/clangarm64/bin') &&
            expect.stringContaining('/mingw64/bin')
        })
      })
    )
    expect(fs.rmSync).toHaveBeenCalledWith('.tmp', {recursive: true})
  })

  test('getViaGit full x86_64', async () => {
    const flavor = 'full'
    const architecture = 'x86_64'
    const outputDirectory = 'outputDirectory'

    const coreSpy = vi.spyOn(core, 'startGroup')
    const spawnSpy = vi
      .spyOn(spawn, 'spawnAndWaitForExitCode')
      .mockResolvedValue({
        exitCode: 0
      })
    vi.spyOn(git, 'clone').mockResolvedValue()

    const {artifactName, download} = await git.getViaGit(flavor, architecture)

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
    expect(fs.rmSync).toHaveBeenCalledWith('.tmp', {recursive: true})
  })

  test('getViaGit full ucrt64', async () => {
    const flavor = 'full'
    const architecture = 'ucrt64'
    const outputDirectory = 'outputDirectory'

    const spawnSpy = vi
      .spyOn(spawn, 'spawnAndWaitForExitCode')
      .mockResolvedValue({
        exitCode: 0
      })

    const {artifactName, download} = await git.getViaGit(flavor, architecture)

    // The `ucrt64` axis shares the `git-sdk-64` repository with
    // `x86_64`, so the artifact name has to differ to keep caches and
    // on-disk directories distinct.
    expect(artifactName).toEqual('git-sdk-ucrt64-full')

    await download(outputDirectory, true)

    // The clone must target the `ucrt64` branch of `git-sdk-64`, not
    // `main`, otherwise the wrong toolchain would be materialised.
    expect(spawnSpy).toHaveBeenCalledWith(
      expect.stringContaining('/git.exe'),
      expect.arrayContaining([
        'clone',
        '--branch=ucrt64',
        'https://github.com/git-for-windows/git-sdk-64'
      ]),
      expect.any(Object)
    )
  })
})
