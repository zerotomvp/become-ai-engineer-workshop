import type { Context } from 'hono'
import type { z } from 'zod'
import { ApiError } from './errors.ts'

export async function readBody(c: Context): Promise<unknown> {
  const text = await c.req.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError('parameter_invalid', 'The request body must be JSON.')
  }
}

// Turns the first schema problem into one of the API's stable error codes.
export function parse<T extends z.ZodType>(
  schema: T,
  body: unknown
): z.infer<T> {
  const result = schema.safeParse(body)
  if (result.success) return result.data

  const issue = result.error.issues[0]
  if (issue.code === 'unrecognized_keys') {
    const param = [...issue.path, issue.keys[0]].join('.')
    throw new ApiError(
      'unknown_parameter',
      `Received unknown parameter: ${param}`,
      param
    )
  }
  const param = issue.path.join('.')
  if (
    issue.code === 'invalid_type' &&
    valueAt(body, issue.path) === undefined
  ) {
    throw new ApiError(
      'parameter_missing',
      `Missing required parameter: ${param}`,
      param
    )
  }
  throw new ApiError(
    'parameter_invalid',
    `Invalid ${param}: ${issue.message}`,
    param
  )
}

function valueAt(value: unknown, path: PropertyKey[]): unknown {
  return path.reduce<any>((current, key) => current?.[key], value)
}
