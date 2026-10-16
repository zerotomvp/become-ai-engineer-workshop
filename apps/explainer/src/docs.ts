// The latest version of the API docs.
const docsVersion = '2025-09'

// Finds the documentation to show the model: every topic of the docs.
export async function retrieveDocs(apiUrl: string) {
  const { topics } = await getJson(`${apiUrl}/docs/${docsVersion}`)
  const pages = await Promise.all(
    topics.map(async (topic: string) => {
      const response = await fetch(`${apiUrl}/docs/${docsVersion}/${topic}`)
      return response.text()
    })
  )
  return pages.join('\n\n')
}

export async function getJson(url: string): Promise<any> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  return response.json()
}
