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
const MAX_TITLE_LENGTH = 200

export function parseTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const title = value.trim()
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) return null
  return title
}

// Money must be a positive whole number of cents that JavaScript can hold exactly.
// This rejects 0, -100, 10.5, "1000", null, NaN, Infinity and huge values like 1e21.
export function parseTotalCents(value: unknown): number | null {
  if (typeof value !== 'number') return null
  if (!Number.isSafeInteger(value) || value <= 0) return null
  return value
}
