import { createFileRoute, type ErrorComponentProps, useNavigate } from '@tanstack/react-router'
import { type CSSProperties, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, type Bill, fetchBills, formatCents, payShare, type Share } from '../api'

export const Route = createFileRoute('/')({
  // The home id lives in the URL (?home=...), so the page can be bookmarked and shared.
  validateSearch: (search: Record<string, unknown>): { home?: string } => {
    const home = search.home
    return typeof home === 'string' && home.trim() !== '' ? { home: home.trim() } : {}
  },
  component: Home,
  errorComponent: PageCrash,
})

type Load =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; homeName: string; bills: Bill[] }

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}

function payFailureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return 'Someone else already paid this share. Press Refresh to see the latest.'
    }
    if (error.status === null) {
      return `${error.message} Retrying is safe: the share cannot be paid twice.`
    }
    return `Payment failed: ${error.message}`
  }
  return 'Payment failed. Please try again.'
}

function markPaid(bills: Bill[], shareId: string, paidAt: string): Bill[] {
  return bills.map((bill) => ({
    ...bill,
    shares: bill.shares.map((share) => (share.id === shareId ? { ...share, paidAt } : share)),
  }))
}

function Home() {
  const { home } = Route.useSearch()
  const navigate = useNavigate({ from: '/' })
  const [input, setInput] = useState(home ?? '')

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = input.trim()
    void navigate({ search: value === '' ? {} : { home: value } })
  }

  return (
    <main style={styles.page}>
      <h1>Shared bills</h1>
      <form onSubmit={onSubmit} style={styles.form}>
        <label style={styles.label}>
          Home ID
          <input value={input} onChange={(event) => setInput(event.target.value)} />
        </label>
        <button type="submit">Load home</button>
      </form>
      {home === undefined ? (
        <p>Enter a home ID to see its bills.</p>
      ) : (
        <HomeBills key={home} homeId={home} />
      )}
    </main>
  )
}

function HomeBills({ homeId }: { homeId: string }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [paying, setPaying] = useState<ReadonlySet<string>>(new Set())
  const [payErrors, setPayErrors] = useState<Readonly<Record<string, string>>>({})
  const controllerRef = useRef<AbortController | null>(null)
  // One idempotency key per share, kept until the payment succeeds, so that
  // retrying after a timeout reuses the same key instead of making a new payment.
  const keysRef = useRef(new Map<string, string>())

  const loadBills = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoad({ status: 'loading' })

    fetchBills(homeId, controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return
        setLoad({ status: 'ready', homeName: data.homeName, bills: data.bills })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        setLoad({ status: 'error', message: errorMessage(error) })
      },
    )
  }, [homeId])

  useEffect(() => {
    loadBills()
    return () => controllerRef.current?.abort()
  }, [loadBills])

  async function pay(bill: Bill, share: Share) {
    if (paying.has(share.id)) return

    const key = keysRef.current.get(share.id) ?? crypto.randomUUID()
    keysRef.current.set(share.id, key)

    setPaying((previous) => new Set(previous).add(share.id))
    setPayErrors((previous) => {
      const { [share.id]: _cleared, ...rest } = previous
      return rest
    })

    try {
      const paid = await payShare(bill.id, share.id, key)
      // Only after the server confirms do we mark the share as paid.
      setLoad((current) =>
        current.status === 'ready'
          ? { ...current, bills: markPaid(current.bills, paid.id, paid.paidAt) }
          : current,
      )
      keysRef.current.delete(share.id)
    } catch (error) {
      // The share stays unpaid; we just show why.
      setPayErrors((previous) => ({ ...previous, [share.id]: payFailureMessage(error) }))
    } finally {
      setPaying((previous) => {
        const next = new Set(previous)
        next.delete(share.id)
        return next
      })
    }
  }

  if (load.status === 'loading') {
    return <p role="status">Loading bills…</p>
  }

  if (load.status === 'error') {
    return (
      <div role="alert">
        <p style={styles.error}>Could not load this home: {load.message}</p>
        <button type="button" onClick={loadBills}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <section>
      <div style={styles.header}>
        <h2>{load.homeName}</h2>
        <button type="button" onClick={loadBills}>
          Refresh
        </button>
      </div>

      {load.bills.length === 0 ? (
        <p>No bills yet for this home.</p>
      ) : (
        load.bills.map((bill) => (
          <article key={bill.id} style={styles.card}>
            <h3>
              {bill.title} · {formatCents(bill.totalCents)}
            </h3>
            <ul style={styles.list}>
              {bill.shares.map((share) => {
                const isPaying = paying.has(share.id)
                const failure = payErrors[share.id]
                return (
                  <li key={share.id} style={styles.row}>
                    <span style={styles.member}>{share.memberName}</span>
                    <span>{formatCents(share.amountCents)}</span>
                    {share.paidAt === null ? (
                      <button type="button" disabled={isPaying} onClick={() => pay(bill, share)}>
                        {isPaying ? 'Paying…' : 'Pay'}
                      </button>
                    ) : (
                      <span>Paid {new Date(share.paidAt).toLocaleDateString()}</span>
                    )}
                    {failure !== undefined && (
                      <p role="alert" style={styles.error}>
                        {failure}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          </article>
        ))
      )}
    </section>
  )
}

// Last safety net: if anything in the page throws while rendering, show this
// instead of a blank screen.
function PageCrash({ error }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
  return (
    <main style={styles.page}>
      <h1>Something went wrong</h1>
      <p role="alert">{message}</p>
      <button type="button" onClick={() => window.location.reload()}>
        Reload the page
      </button>
    </main>
  )
}

const styles = {
  page: { maxWidth: 640, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' },
  form: { display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 24 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  card: { border: '1px solid #ccc', borderRadius: 8, padding: 16, marginBottom: 16 },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0',
    borderTop: '1px solid #eee',
  },
  member: { flex: 1 },
  error: { color: '#b00020', margin: 0, flexBasis: '100%' },
} satisfies Record<string, CSSProperties>
