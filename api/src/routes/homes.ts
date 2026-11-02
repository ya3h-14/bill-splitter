import { Hono } from 'hono'
import { parseName, readJsonObject } from '../lib/validate'

export const homes = new Hono<{ Bindings: Env }>()

homes.post('/', async (c) => {
  const body = await readJsonObject(c)
  const name = body === null ? null : parseName(body.name)
  if (name === null) {
    return c.json({ error: 'name must be a non-empty string up to 100 characters' }, 422)
  }

  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(id, name).run()

  return c.json({ id, name }, 201)
})

homes.post('/:homeId/members', async (c) => {
  const homeId = c.req.param('homeId')

  const home = await c.env.DB.prepare('SELECT id FROM homes WHERE id = ?').bind(homeId).first()
  if (home === null) {
    return c.json({ error: 'home not found' }, 404)
  }

  const body = await readJsonObject(c)
  const name = body === null ? null : parseName(body.name)
  if (name === null) {
    return c.json({ error: 'name must be a non-empty string up to 100 characters' }, 422)
  }

  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO members (id, home_id, name) VALUES (?, ?, ?)')
    .bind(id, homeId, name)
    .run()

  return c.json({ id, homeId, name }, 201)
})
