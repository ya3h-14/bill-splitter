export type Share = {
  id: string
  memberId: string
  memberName: string
  amountCents: number
  paidAt: string | null
}
export type Bill = {
  id: string
  homeId: string
  title: string
  totalCents: number
  shares: Share[]
}
export type BillsResponse = { homeName: string; bills: Bill[] }
export type PaidShare = { id: string; paidAt: string }

const TIMEOUT_MS = 8000

export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function extractError(data: unknown): string | null {
  if (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof data.error === 'string'
  ) {
    return data.error
  }
  return null
}

// Sends a request and returns the parsed JSON. Every failure becomes an ApiError
// with a message that is safe to show to the user. `status` is null when there
// was no HTTP answer at all (offline or timeout).
async function request(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<unknown> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

  let response: Response
  let text: string
  try {
    response = await fetch(path, { ...init, signal: combined })
    text = await response.text()
  } catch (error) {
    if (signal?.aborted) throw error // the caller cancelled on purpose; it will ignore this
    if (timeout.aborted) {
      throw new ApiError('The server took too long to respond.', null)
    }
    throw new ApiError('Could not reach the server. Check your connection.', null)
  }

  let data: unknown = null
  try {
    data = JSON.parse(text)
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new ApiError(
      extractError(data) ?? `Request failed (${response.status}).`,
      response.status,
    )
  }
  return data
}

function isBillsResponse(value: unknown): value is BillsResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'homeName' in value &&
    typeof value.homeName === 'string' &&
    'bills' in value &&
    Array.isArray(value.bills)
  )
}

function isPaidShare(value: unknown): value is PaidShare {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'paidAt' in value &&
    typeof value.paidAt === 'string'
  )
}

export async function fetchBills(homeId: string, signal?: AbortSignal): Promise<BillsResponse> {
  const data = await request(`/api/homes/${encodeURIComponent(homeId)}/bills`, {}, signal)
  if (!isBillsResponse(data)) throw new ApiError('The server sent an unexpected response.', null)
  return data
}

export async function payShare(billId: string, shareId: string, key: string): Promise<PaidShare> {
  const path = `/api/bills/${encodeURIComponent(billId)}/shares/${encodeURIComponent(shareId)}/pay`
  const data = await request(path, { method: 'POST', headers: { 'Idempotency-Key': key } })
  if (!isPaidShare(data)) throw new ApiError('The server sent an unexpected response.', null)
  return data
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// Display only. All real money logic stays in whole cents on the server.
export function formatCents(cents: number): string {
  return money.format(cents / 100)
}
