// Cents for the member at `index` (0 = first member added).
// Everyone gets the base amount; the first `remainder` members get one extra cent.
// Example: 1000 between 3 gives 334, 333, 333.
export function shareAmount(totalCents: number, memberCount: number, index: number): number {
  const base = Math.floor(totalCents / memberCount)
  const remainder = totalCents % memberCount
  return base + (index < remainder ? 1 : 0)
}
