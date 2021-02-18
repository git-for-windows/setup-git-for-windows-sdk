import {get} from '../src/downloader'
import {mocked} from 'ts-jest/utils'
import fetch from 'node-fetch'

const buildIdResponse = {
  count: 1,
  value: [
    {
      _links: [Object],
      properties: {},
      tags: [],
      validationResults: [],
      plans: [Array],
      triggerInfo: [Object],
      id: 71000,
      buildNumber: '71000',
      status: 'completed',
      result: 'succeeded',
      queueTime: '2021-02-16T03:11:20.8026424Z',
      startTime: '2021-02-16T03:11:35.5385517Z',
      finishTime: '2021-02-16T03:42:07.4413436Z',
      url:
        'https://dev.azure.com/Git-for-Windows/f3317b6a-fa67-40d4-9a33-b652e06943df/_apis/build/Builds/71000',
      definition: [Object],
      project: [Object],
      uri: 'vstfs:///Build/Build/71000',
      sourceBranch: 'refs/heads/main',
      sourceVersion: 'c1d940ae0b2de75e18f642e76750f19b0f92dbc6',
      priority: 'normal',
      reason: 'individualCI',
      requestedFor: [Object],
      requestedBy: [Object],
      lastChangedDate: '2021-02-16T03:42:07.653Z',
      lastChangedBy: [Object],
      orchestrationPlan: [Object],
      logs: [Object],
      repository: [Object],
      keepForever: true,
      retainedByRelease: false,
      triggeredByBuild: null
    }
  ]
}

jest.mock('node-fetch')
const {Response} = jest.requireActual('node-fetch')

test('can obtain build ID', async () => {
  mocked(fetch).mockReturnValue(
    Promise.resolve(new Response(JSON.stringify(buildIdResponse)))
  )
  const {id} = await get('minimal', 'x86_64')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(id).toEqual('git-sdk-64-minimal-71000')
})
