import { describe, expect, it } from 'vitest'
import { shareAmount } from '../src/lib/split'

function split(total: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => shareAmount(total, count, i))
}

describe('shareAmount', () => {
  it('gives extra cents to the first members', () => {
    expect(split(1000, 3)).toEqual([334, 333, 333])
  })

  it('handles a total smaller than the member count', () => {
    expect(split(2, 5)).toEqual([1, 1, 0, 0, 0])
  })

  it('always adds up to the total', () => {
    for (let count = 1; count <= 12; count++) {
      for (const total of [1, 7, 100, 999, 100001]) {
        expect(split(total, count).reduce((a, b) => a + b, 0)).toBe(total)
      }
    }
  })
})
