module.exports = {
    __esModule: true,
    Octokit: jest.fn().mockImplementation(() => {
        return {
            actions: {
                listWorkflowRuns: jest.fn().mockResolvedValue({
                    data: {
                        workflow_runs: [
                            {
                                head_sha: 'mock_sha'
                            }
                        ]
                    }
                }),
                listWorkflowRunArtifacts: jest.fn().mockResolvedValue({
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
                downloadArtifact: jest.fn().mockResolvedValue({
                    data: 'mock artifact content'
                })
            },
            repos: {
                getBranch: jest.fn().mockResolvedValue({
                    data: {
                        commit: {
                            sha: 'mock_sha'
                        }
                    }
                }),
                listReleases: jest.fn().mockResolvedValue({
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
}
