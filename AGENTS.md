# AGENTS.md

This file provides guidance for AI agents and developers working with the
`git-for-windows/setup-git-for-windows-sdk` repository.

## Repository purpose

This repository contains a GitHub Action that sets up a Git for Windows
SDK (or a subset thereof) on a Windows runner, so that workflows can
build Git for Windows, package its installer, or run its test suite
without first having to install the full SDK by hand. The Action is
published as `git-for-windows/setup-git-for-windows-sdk` and is consumed
by [git-for-windows/git](https://github.com/git-for-windows/git),
[git-for-windows/build-extra](https://github.com/git-for-windows/build-extra),
[git-for-windows/MINGW-packages](https://github.com/git-for-windows/MINGW-packages),
[git-for-windows/MSYS2-packages](https://github.com/git-for-windows/MSYS2-packages),
and assorted other Git for Windows component repositories. Changes here
ripple across that entire ecosystem, so backwards compatibility matters.

The Action is written in TypeScript, bundled with `@vercel/ncc` into a
single `dist/index.js`, and invoked as a Node 24 action declared by
`action.yml`. There is no composite-action layer; everything happens in
`main.ts` and `src/`.

## Repository structure

- `action.yml` -- Action manifest. Declares inputs (`flavor`,
  `architecture`, `msys`, `path`, `cleanup`, `verbose`, `cache`,
  `github-token`), branding, and points `runs.main` / `runs.post` at
  `dist/index.js` under `node24`.
- `main.ts` -- Entry point. Selects between the CI-artifact fast path
  and the git-clone path, sets up `PATH`, `MSYSTEM`, and `LC_CTYPE`,
  creates `/dev/{fd,stdin,stdout,stderr}` symlinks, and handles the
  POST-action cleanup when the `cleanup` input is `true`.
- `src/git.ts` -- The git-clone path. Maps `(flavor, architecture)`
  to `(repo, artifactName)` in `getArtifactMetadata`, then either does
  a bare clone plus `git worktree add` (for `flavor: full`) or a bare
  clone plus `please.sh create-sdk-artifact` (for the other flavors,
  using `build-extra`'s `please.sh`).
- `src/ci_artifacts.ts` -- The fast path. Pulls the
  `git-sdk-<arch>-<flavor>.tar.{gz,zst}` asset from the
  `ci-artifacts` release in the matching `git-sdk-*` repo and pipes
  it through `tar.exe`. Only the `minimal` flavor (always) and
  `build-installers` (when the runner has Windows 11 24H2's
  Zstandard-capable `tar.exe`) take this path.
- `src/downloader.ts`, `src/spawn.ts` -- small utilities used by the
  two paths above.
- `src/__tests__/git.test.ts`, `__tests__/main.test.ts` -- Vitest
  tests. `main.test.ts` is gated on `RUN_NETWORK_TESTS=true` because
  it really downloads an SDK.
- `dist/index.js`, `dist/index.js.map` -- the `ncc`-bundled artifact
  that is actually executed at runtime. Always regenerated alongside
  source changes, but in a dedicated follow-up commit (see commit
  conventions below).

## Build, test, package

The full validation chain is `npm run all`, which runs in order:
`build` -> `format` -> `lint` -> `typecheck` -> `package` -> `test`.
For incremental work, the individual scripts in `package.json` are:

- `npm ci` -- install dependencies (lockfile-strict).
- `npm run build` -- `tsc`, compiling `.ts` into `lib/`.
- `npm run lint` -- `eslint **/*.ts`.
- `npm run typecheck` -- `tsc --noEmit -p tsconfig.eslint.json`.
- `npm run format` / `npm run format-check` -- Prettier.
- `npm run test` -- Vitest. Set `RUN_NETWORK_TESTS=true` to also
  exercise `__tests__/main.test.ts`, which downloads a real SDK.
- `npm run package` -- `@vercel/ncc` bundles `lib/main.js` into
  `dist/index.js` (with source map).

The `build-test` workflow (`.github/workflows/test.yml`) runs the same
chain on every PR and explicitly verifies that `dist/index.js` is up to
date by checking that `git diff -aw HEAD -- ':(exclude)dist/index.js.map'`
is empty after `npm run package`. Any push that changes `main.ts` or
`src/` must therefore also include the regenerated `dist/index.js` (in
its own follow-up commit, per the commit conventions below) before CI
sees the tip, or CI fails.

For Dependabot PRs, the `npm-run-package` workflow
(`.github/workflows/npm-run-package.yml`) does the regeneration
automatically and pushes a `npm run build && npm run package` commit
back onto the dependabot branch.

## Release model

The repository uses floating release-train tags (`v0`, `v1`, `v2`,
...) plus immutable point tags (`v2.0.0`, `v2.1.0`, ...). The
`release-tag` workflow (`.github/workflows/release-tag.yml`) is
triggered by pushing a `v*` point tag from `main`. It verifies the
tag's GPG signature against `dscho`'s published keys, creates a
GitHub Release, and fast-forwards the matching `v<N>` branch to the
tagged commit. Consumers usually pin to a major-version branch:

```yaml
- uses: git-for-windows/setup-git-for-windows-sdk@v2
```

## Input model: flavors and architectures

The Action supports four flavors of the SDK:

- `minimal` -- the smallest useful set for building and testing Git
  for Windows itself. `x86_64` only.
- `makepkg-git` -- adds enough to package `mingw-w64-git`. `x86_64`
  only (can cross-package `i686`).
- `build-installers` -- adds the tooling to assemble installers,
  Portable Git, MinGit, and friends.
- `full` -- the complete SDK as a user would install it. The only
  flavor that exists for every architecture.

The `architecture` input drives both the underlying `git-sdk-*` repo
and the `MSYSTEM` / bin-path layout inside the SDK:

| `architecture` | repo            | MSYSTEM      | mingw bin path    | notes                                                                                  |
| -------------- | --------------- | ------------ | ----------------- | -------------------------------------------------------------------------------------- |
| `i686`         | `git-sdk-32`    | `MINGW32`    | `/mingw32/bin`    | only `build-installers` and `full`                                                     |
| `x86_64`       | `git-sdk-64`    | `MINGW64`    | `/mingw64/bin`    | the default; fast path available for `minimal`                                         |
| `aarch64`      | `git-sdk-arm64` | `CLANGARM64` | `/clangarm64/bin` | only `full` for now                                                                    |
| `ucrt64`       | `git-sdk-64`    | `UCRT64`     | `/ucrt64/bin`     | UCRT64 migration; cloned from the `ucrt64` branch of `git-sdk-64`; only `full` for now |

The `ucrt64` axis is part of the larger UCRT64 migration tracked in
https://github.com/git-for-windows/git-sdk-64/pull/117 and its
follow-up comment
https://github.com/git-for-windows/git-sdk-64/pull/117#issuecomment-4642726384.
It shares the `git-sdk-64` repository with `x86_64` but is materialised
from a different long-lived branch, so caches and on-disk directories
must stay distinct (the artifact name is `git-sdk-ucrt64-<flavor>`
rather than `git-sdk-64-<flavor>`). The `ci-artifacts` release of
`git-sdk-64` contains no UCRT64 asset, so the CI-artifacts fast path
is forcibly skipped for this axis; every flavor takes the
`getViaGit` path. `build-extra`'s `please.sh create-sdk-artifact` does
not yet understand `--architecture=ucrt64` either, so right now only
`flavor: full` (which goes straight through `git worktree add`)
produces a working SDK. The non-`full` flavors will start working once
`build-extra` and the `ci-artifacts` pipeline catch up.

## Relationship to other Git for Windows repositories

- [git-for-windows/git-sdk-64](https://github.com/git-for-windows/git-sdk-64),
  [git-sdk-32](https://github.com/git-for-windows/git-sdk-32),
  [git-sdk-arm64](https://github.com/git-for-windows/git-sdk-arm64) --
  the bare-repo SDKs themselves. Their `main` branch (and, for
  `git-sdk-64`, the `ucrt64` branch) is what `getViaGit` clones;
  their `ci-artifacts` release is what `getViaCIArtifacts` downloads
  (no UCRT64 asset there today).
- [git-for-windows/build-extra](https://github.com/git-for-windows/build-extra)
  -- provides `please.sh create-sdk-artifact`, used by `getViaGit` to
  carve subset flavors (`minimal`, `makepkg-git`, `build-installers`)
  out of a full SDK clone.
- [git-for-windows/git](https://github.com/git-for-windows/git),
  [git-for-windows/git-for-windows-automation](https://github.com/git-for-windows/git-for-windows-automation),
  [git-for-windows/MINGW-packages](https://github.com/git-for-windows/MINGW-packages),
  and most other component repositories consume this Action in their
  CI. Breaking changes here block their CI, so the v0/v1/v2 release
  trains exist to give consumers a stable pin.

## Commit message conventions

- Write flowing prose; no bullet points and no Markdown section
  headers in commit messages.
- Stick to plain ASCII and English, avoid technical jargon unless
  necessary to bring across a specific aspect.
- Lead with motivation (why), then non-obvious context, then
  intention. Only mention implementation details if the diff is not
  already obvious. References (PR/issue/discussion URLs) go at
  the end, not the top, and are full URLs, never GitHub abbreviations.
- Cite external facts (release notes, upstream behavior, etc.) with
  inline URLs so each claim is self-contained.
- Trailers come at the end in this order: first `Assisted-by:`, then
  `Signed-off-by:`. The `Assisted-by:` value names the AI model that
  helped, not the product or platform (e.g. `Assisted-by: Opus 4.7`,
  not `Assisted-by: Copilot CLI`).
- Use one commit per logical change; do not bundle unrelated edits
  together even if they touch the same file.
- Commit early, commit often. It is much easier to combine even
  incomplete commits into a complete, well-separated commit than to
  split morally-separate changes out from a messy commit.
- Regenerated `dist/index.js` goes in a separate commit at the tip of
  the topic branch. It **never** goes into the same commit as the source
  change that necessitated it. The convention is the same as of the
  `npm-run-package` workflow, where the auto-generated subject is
  `npm run build && npm run package`.

## Validating changes

For any change to `action.yml`, `main.ts`, or `src/`:

1. Run `npm run all` locally. It must pass cleanly.
2. Verify `dist/index.js` is rebuilt (`git status` should show it
   modified) and commit it in a dedicated follow-up commit with
   subject `npm run build && npm run package`.
3. The `build-test` workflow on the PR will re-run the full chain and
   re-verify the bundled artifact; the matrix workflow can be
   triggered manually (`workflow_dispatch`) to exercise the actual
   download paths on a Windows runner.

Documentation-only changes (README, AGENTS) do not need the full
chain, but `npm run format-check` should still pass.
