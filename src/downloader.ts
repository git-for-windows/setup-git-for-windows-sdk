import https from 'https'

async function fetchJSONFromURL<T>(url: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    https
      .request(url, {}, res => {
        if (res.statusCode !== 200) {
          reject(
            new Error(
              `Got code ${res.statusCode}, URL: ${url}, message: ${res.statusMessage}`
            )
          )
          return
        }
        const data: Uint8Array[] = []
        res
          .on('data', (chunk: Uint8Array) => data.push(chunk))
          .on('end', () => {
            try {
              resolve(JSON.parse(Buffer.concat(data).toString('utf-8')))
            } catch (e) {
              reject(e)
            }
          })
          .on('error', e => reject(e))
      })
      .on('error', e => reject(e))
      .end()
  })
}

export async function get(
  flavor: string,
  architecture: string
): Promise<{
  id: string
}> {
  if (!['x86_64', 'i686'].includes(architecture)) {
    throw new Error(`Unsupported architecture: ${architecture}`)
  }

  let definitionId: number
  switch (flavor) {
    case 'minimal':
      if (architecture === 'i686') {
        throw new Error(`Flavor "minimal" is only available for x86_64`)
      }
      definitionId = 22
      break
    case 'makepkg-git':
      if (architecture === 'i686') {
        throw new Error(`Flavor "makepkg-git" is only available for x86_64`)
      }
      definitionId = 29
      break
    case 'build-installers':
      definitionId = architecture === 'i686' ? 30 : 29
      break
    default:
      throw new Error(`Unknown flavor: '${flavor}`)
  }

  const baseURL = 'https://dev.azure.com/git-for-windows/git/_apis/build/builds'
  const data = await fetchJSONFromURL<{
    count: number
    value: [{id: string}]
  }>(
    `${baseURL}?definitions=${definitionId}&statusFilter=completed&resultFilter=succeeded&$top=1`
  )
  if (data.count !== 1) {
    throw new Error(`Unexpected number of builds: ${data.count}`)
  }
  return {id: data.value[0].id}
}
