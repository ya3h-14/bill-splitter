import { describe, expect, it } from 'vitest'
import { call, createBill, createHome } from './helpers'

type BillList = {
  homeName: string
  bills: { id: string; shares: { memberName: string; amountCents: number }[] }[]
}

describe('list bills', () => {
  it('returns each bill with its shares in the order members were added', async () => {
    const { homeId } = await createHome(['Asha', 'Ben', 'Chen'])
    await createBill(homeId, 1000)

    const list = await call<BillList>('GET', `/api/homes/${homeId}/bills`)

    expect(list.status).toBe(200)
    expect(list.body.bills).toHaveLength(1)
    expect(list.body.bills[0]?.shares.map((s) => s.memberName)).toEqual(['Asha', 'Ben', 'Chen'])
    expect(list.body.bills[0]?.shares.map((s) => s.amountCents)).toEqual([334, 333, 333])
  })

  it('returns an empty list for a home with no bills', async () => {
    const { homeId } = await createHome(['Asha'])
    const list = await call<BillList>('GET', `/api/homes/${homeId}/bills`)
    expect(list.status).toBe(200)
    expect(list.body.bills).toEqual([])
  })

  it('returns 404 when the home does not exist', async () => {
    const list = await call('GET', '/api/homes/does-not-exist/bills')
    expect(list.status).toBe(404)
  })
})
