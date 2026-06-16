# Set up a Git for Windows SDK (or a subset thereof)

Use this Action to initialize an environment to develop Git for Windows.

## Getting Started

```yaml
name: Build stuff in Git for Windows' SDK
on: [push]
jobs:
  build:
    runs-on: windows-latest
    steps:
    - uses: actions/checkout@v3
    - name: Setup Git for Windows' minimal SDK
      uses: git-for-windows/setup-git-for-windows-sdk@v2
    - name: Build
      shell: bash
      run: make
```

## Input parameters

### Available flavors

This Action supports several flavors (read: subsets) of the Git for Windows SDK that can be configured like this:

```yaml
- uses: git-for-windows/setup-git-for-windows-sdk
  with:
    flavor: build-installers
```

The supported flavors are:

- `minimal`:

  This is the most useful flavor to build Git for Windows' source code and run its own test suite. Only available for x86_64.

- `makepkg-git`:

  This flavor allows packaging `mingw-w64-git`, the Pacman package. It is only available for x86_64 but can be used to "cross-compile" for i686.

- `build-installers`:

  In addition to building `mingw-w64-git`, this flavor allows bundling Git for Windows' artifacts such as the installer and the Portable Git.

- `full`:

  This is the "full" SDK, [as users would install it](https://gitforwindows.org/#download-sdk), with a pre-selected set of packages pre-installed. Additional packages can be installed via `pacman -S <package>`.

### CPU architecture support

Git for Windows SDK comes in variants targeting `x86_64` (AKA "64-bit"), `i686` (AKA 32-bit) and  `aarch64` (AKA arm64). The default is `x86_64` and can be overridden like this:

```yaml
- uses: git-for-windows/setup-git-for-windows-sdk
  with:
    flavor: build-installers
    architecture: i686
```

Please note that only the `build-installers` and the `full` flavors are available for `i686`.

In addition, the `ucrt64` value selects the UCRT64 variant of `git-sdk-64`. While the [migration from MINGW64 to UCRT64](https://github.com/git-for-windows/git-sdk-64/pull/117) is in progress, this variant lives on a transitional `ucrt64` branch of `git-sdk-64`; once the migration concludes, that branch will replace `main`, at which point `architecture: x86_64` will itself produce a UCRT64 SDK and `ucrt64` becomes a synonym. Until then, this axis runs under `MSYSTEM=UCRT64` with `/ucrt64/bin` on PATH and uses an output directory and cache key that are distinct from `x86_64` so the two variants do not collide on the same runner.

### Verbosity

By default, this Action prints a line whenever 250 items were extracted (this does not work for the `full` flavor, where this Action is silent by default). It can be overridden by setting the input parameter `verbose`; setting it to a number will show updates whenever that many items were extracted. Setting it to `false` will suppress progress updates. Setting it to `true` will print every extracted file (this also works for the `full` flavor).

### Caching

To accelerate this Action, artifacts are cached once downloaded. This can be turned off by setting the input parameter `cache` to `false`.

In practice, caching the `full` artifacts does not provide much of a speed-up. Instead, it slows it down by spending extra minutes on caching the artifact. Therefore, caching is disabled for the `full` artifacts by default, corresponding to `cache: auto`.

### Clean-up

On self-hosted runners, the SDK files persist after the workflow run is done. To remove these files, set the input parameter `cleanup` to `true`.

## Developing _this_ Action

> First, you'll need to have a reasonably modern version of `node` handy, such as Node 24.

Install the dependencies

```bash
$ npm install
```

Build the Action and package it for distribution

```bash
$ npm run build && npm run package
```

Run the tests :heavy_check_mark:

```bash
$ npm test

 ✓ __tests__/main.test.ts (1)
   ✓ skipping tests requiring network access
 ✓ src/__tests__/git.test.ts (2)
   ✓ git (2)

 Test Files  2 passed (2)
      Tests  3 passed (3)
...
```
