import {vi} from 'vitest'

export const Octokit = vi.fn().mockImplementation(() => {
        return {
            actions: {
                listWorkflowRuns: vi.fn().mockResolvedValue({
                    data: {
                        workflow_runs: [
                            {
                                head_sha: 'mock_sha'
                            }
                        ]
                    }
                }),
                listWorkflowRunArtifacts: vi.fn().mockResolvedValue({
                    data: {
                        artifacts: [
                            {
                                name: 'git-sdk-64-build-installers',
                                id: 12345,
                                created_at: '2025-08-12T12:00:00Z'
                            }
                        ]
                    }
                }),
                downloadArtifact: vi.fn().mockResolvedValue({
                    data: 'mock artifact content'
                })
            },
            repos: {
                getBranch: vi.fn().mockResolvedValue({
                    data: {
                        commit: {
                            sha: 'mock_sha'
                        }
                    }
                }),
                getReleaseByTag: vi.fn().mockResolvedValue({
                    status: 200,
                    data: {
                        html_url: 'https://github.com/git-for-windows/git-sdk-64/releases/tag/ci-artifacts',
                        assets: [
                            {
                                name: 'git-sdk-x86_64-minimal.tar.gz',
                                updated_at: '2025-08-12T12:00:00Z',
                                browser_download_url: 'https://example.com/git-sdk-x86_64-minimal.tar.gz'
                            },
                            {
                                name: 'git-sdk-x86_64-build-installers.tar.zst',
                                updated_at: '2025-08-12T12:00:00Z',
                                browser_download_url: 'https://example.com/git-sdk-x86_64-build-installers.tar.zst'
                            }
                        ]
                    }
                }),
                listReleases: vi.fn().mockResolvedValue({
                    data: [
                        {
                            tag_name: 'v2.41.0.windows.1',
                            assets: [
                                {
                                    name: 'git-sdk-64-build-installers.7z',
                                    browser_download_url: 'https://example.com/git-sdk-64-build-installers.7z'
                                }
                            ]
                        }
                    ]
                })
            }
        }
    })
