import type { Context } from 'hono'

const MAX_NAME_LENGTH = 100

// Returns the parsed JSON body only if it is a plain object.
// Bad JSON, an array, or null all become `null`, so routes can answer cleanly.
export async function readJsonObject(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const data: unknown = await c.req.json()
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return data as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

// A valid name is a string with 1 to 100 characters after trimming.
export function parseName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) return null
  return name
}
