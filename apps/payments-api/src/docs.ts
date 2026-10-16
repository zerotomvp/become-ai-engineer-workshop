import { existsSync, readFileSync } from 'node:fs'
import type { ApiVersion } from './store.ts'

export const docTopics = ['overview', 'payments', 'refunds', 'errors']

// Markdown documentation, one folder per API version.
export function readDoc(version: ApiVersion, topic: string) {
  if (!docTopics.includes(topic)) return undefined
  const file = new URL(`../docs/${version}/${topic}.md`, import.meta.url)
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}
