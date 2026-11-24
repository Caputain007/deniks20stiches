// Admins type start and end times in Nigerian time (WAT, UTC+1 all year, no
// daylight saving), using <input type="datetime-local">.

const WAT_OFFSET_MS = 60 * 60 * 1000

/** "2026-12-01T09:00" for a datetime-local input, in Nigerian time. */
export function toLagosInput(date: Date | null | undefined): string {
  if (!date) return ''
  return new Date(date.getTime() + WAT_OFFSET_MS).toISOString().slice(0, 16)
}

/** Parses a datetime-local value typed in Nigerian time. Empty → null; nonsense → undefined. */
export function fromLagosInput(value: string): Date | null | undefined {
  const v = value.trim()
  if (!v) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return undefined
  const date = new Date(`${v}:00+01:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}
