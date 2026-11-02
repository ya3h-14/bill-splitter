import { describe, expect, it } from 'vitest'
import { call, createBill, createHome } from './helpers'

async function setup() {
  const { homeId } = await createHome(['Asha', 'Ben'])
  const bill = await createBill(homeId, 1000)
  const share = bill.body.shares[0]
  if (!share) throw new Error('bill has no shares')
  return `/api/bills/${bill.body.id}/shares/${share.id}/pay`
}

describe('payment safety', () => {
  it('lets exactly one of two simultaneous payments win', async () => {
    const path = await setup()

    const [a, b] = await Promise.all([
      call('POST', path, { headers: { 'Idempotency-Key': 'key-a' } }),
      call('POST', path, { headers: { 'Idempotency-Key': 'key-b' } }),
    ])

    expect([a.status, b.status].sort()).toEqual([200, 409])
  })

  it('answers 200 to both when two simultaneous requests use the same key', async () => {
    const path = await setup()

    const [a, b] = await Promise.all([
      call('POST', path, { headers: { 'Idempotency-Key': 'same-key' } }),
      call('POST', path, { headers: { 'Idempotency-Key': 'same-key' } }),
    ])

    expect([a.status, b.status]).toEqual([200, 200])
  })
})
