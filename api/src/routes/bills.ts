import { Hono } from 'hono'
import { shareAmount } from '../lib/split'
import { parseTitle, parseTotalCents, readJsonObject } from '../lib/validate'

export const bills = new Hono<{ Bindings: Env }>()

bills.post('/homes/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')

  // 1. Does the home exist? (404 wins over everything else)
  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()
  if (home === null) {
    return c.json({ error: 'home not found' }, 404)
  }

  // 2. Is the input valid?
  const body = await readJsonObject(c)
  const title = body === null ? null : parseTitle(body.title)
  const totalCents = body === null ? null : parseTotalCents(body.totalCents)
  if (title === null) {
    return c.json({ error: 'title must be a non-empty string up to 200 characters' }, 422)
  }
  if (totalCents === null) {
    return c.json({ error: 'totalCents must be a positive whole number' }, 422)
  }

  // 3. Who is in the home, in the order they were added?
  const { results: members } = await c.env.DB.prepare(
    'SELECT id FROM members WHERE home_id = ? ORDER BY seq',
  )
    .bind(homeId)
    .all<{ id: string }>()
  if (members.length === 0) {
    return c.json({ error: 'home has no members to split the bill between' }, 422)
  }

  // 4. Build the bill and one share per member.
  const billId = crypto.randomUUID()
  const shares = members.map((member, index) => ({
    id: crypto.randomUUID(),
    memberId: member.id,
    amountCents: shareAmount(totalCents, members.length, index),
    paidAt: null,
  }))

  // 5. Save all of it in ONE batch. D1 runs a batch as a single transaction:
  //    either the bill and every share are saved, or nothing is.
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)',
    ).bind(billId, homeId, title, totalCents),
    ...shares.map((share) =>
      c.env.DB.prepare(
        'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)',
      ).bind(share.id, billId, share.memberId, share.amountCents),
    ),
  ])

  return c.json({ id: billId, homeId, title, totalCents, shares }, 201)
})
