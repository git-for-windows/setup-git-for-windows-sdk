# Azure Pipelines task usage

## 1. Build the GitHub Action bundle

```bash
npm ci
npm run package
```

## 2A. Run the adapter directly (no extension)

Add a step that runs the adapter Node entry. Remember to first install the task
adapter dependencies and Node.js.

```yaml
steps:
- task: NodeTool@0
  inputs:
    versionSpec: '20.x'

- script: |
    cd azure-pipelines-task
    npm ci
  displayName: Install adapter deps

- script: |
    node azure-pipelines-task/index.js
  displayName: Setup Git for Windows SDK
  env:
    INPUT_FLAVOR: minimal
    INPUT_ARCHITECTURE: x86_64
    INPUT_VERBOSE: '250'
    # INPUT_GITHUBTOKEN: $(GITHUB_TOKEN)

- script: |
    bash.exe -lc "gcc --version && uname -a"
  displayName: Smoke test
```

## 2B. Package and install as an Azure DevOps extension

This repo includes a `vss-extension.json` manifest.

Package it with `tfx` and install to your org. Then reference the task by its
fully-qualified name:

```yaml
steps:
- task: git-for-windows.SetupGitForWindowsSDK@1
  inputs:
    flavor: minimal
    architecture: x86_64
```

### Cleanup on self-hosted agents

```yaml
- task: git-for-windows.SetupGitForWindowsSDK@1
  displayName: Cleanup SDK
  inputs:
    post: true
    cleanup: true
```

## Caching

This task adapter does not directly support caching like the GitHub Action.
Instead you should pair with the `Cache@2` task using the `cacheKey` and
`result` variables set by the adapter.
