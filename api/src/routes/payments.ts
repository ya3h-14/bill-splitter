import { Hono } from 'hono'

export const payments = new Hono<{ Bindings: Env }>()

const MAX_KEY_LENGTH = 255

type ShareRow = {
  id: string
  member_id: string
  amount_cents: number
  paid_at: string | null
  idempotency_key: string | null
}

payments.post('/bills/:billId/shares/:shareId/pay', async (c) => {
  const billId = c.req.param('billId')
  const shareId = c.req.param('shareId')

  // 1. The Idempotency-Key header is required.
  const key = c.req.header('Idempotency-Key')?.trim()
  if (key === undefined || key.length === 0 || key.length > MAX_KEY_LENGTH) {
    return c.json({ error: 'Idempotency-Key header is required' }, 400)
  }

  // 2. Try to pay. This is ONE atomic statement: it only changes a row that is
  //    still unpaid. If two requests race, the database lets exactly one through.
  const update = await c.env.DB.prepare(
    `UPDATE shares
     SET paid_at = ?, idempotency_key = ?
     WHERE id = ? AND bill_id = ? AND paid_at IS NULL`,
  )
    .bind(new Date().toISOString(), key, shareId, billId)
    .run()

  // 3. Read the share as it is now.
  const share = await c.env.DB.prepare(
    `SELECT id, member_id, amount_cents, paid_at, idempotency_key
     FROM shares WHERE id = ? AND bill_id = ?`,
  )
    .bind(shareId, billId)
    .first<ShareRow>()

  if (share === null) {
    return c.json({ error: 'bill or share not found' }, 404)
  }

  // 4. Decide the answer.
  //    - our UPDATE changed a row  -> we paid it just now.
  //    - nothing changed, same key -> a repeat of the same request: same answer.
  //    - nothing changed, other key -> someone else already paid it.
  const wePaidIt = update.meta.changes === 1
  if (!wePaidIt && share.idempotency_key !== key) {
    return c.json({ error: 'share already paid' }, 409)
  }

  return c.json(
    {
      id: share.id,
      memberId: share.member_id,
      amountCents: share.amount_cents,
      paidAt: share.paid_at,
    },
    200,
  )
})

payments.get('/homes/:homeId/balances', async (c) => {
  const homeId = c.req.param('homeId')

  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()
  if (home === null) {
    return c.json({ error: 'home not found' }, 404)
  }

  // The unpaid condition is in the JOIN, not in WHERE, so members who owe
  // nothing still show up with 0 instead of disappearing.
  const { results } = await c.env.DB.prepare(
    `SELECT m.id AS memberId,
            m.name AS name,
            COALESCE(SUM(s.amount_cents), 0) AS outstandingCents
     FROM members m
     LEFT JOIN shares s ON s.member_id = m.id AND s.paid_at IS NULL
     WHERE m.home_id = ?
     GROUP BY m.seq, m.id, m.name
     ORDER BY m.seq`,
  )
    .bind(homeId)
    .all<{ memberId: string; name: string; outstandingCents: number }>()

  return c.json({ balances: results }, 200)
})
