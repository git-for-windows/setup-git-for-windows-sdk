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
    - uses: actions/checkout@v2
    - name: Setup Git for Windows' minimal SDK
      uses: git-for-windows/setup-git-for-windows-sdk@v1
    - name: Build
      shell: bash
      run: make
```

## Available flavors

It supports several flavors:

- `minimal`:

  This is the most useful flavor to build Git for Windows' source code and run its own test suite. Only available for x86_64.

- `makepkg-git`:

  This flavor allows packaging `mingw-w64-git`, the Pacman package. It is only available for x86_64 but can be used to "cross-compile" for i686.

- `build-installers`:

  In addition to building `mingw-w64-git`, this flavor allows bundling Git for Windows' artifacts such as the installer and the Portable Git.

- `full`:

  This is the "full" SDK, [as users would install it](https://gitforwindows.org/#download-sdk), with a pre-selected set of packages pre-installed. Additional packages can be installed via `pacman -S <package>`.

## CPU architecture support

The Git for Windows SDK can be installed targeting `x86_64` (AKA "64-bit") and `i686` (AKA 32-bit).

## Developing _this_ Action

> First, you'll need to have a reasonably modern version of `node` handy, such as Node 12.

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

 PASS  ./index.test.js
  ✓ throws invalid number (3ms)
  ✓ wait 500 ms (504ms)
  ✓ test runs (95ms)

...
```
