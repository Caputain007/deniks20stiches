// Prices are kept in kobo (₦1 = 100 kobo) everywhere except on screen.

const whole = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })
const exact = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 })

export function formatNaira(kobo: number): string {
  return kobo % 100 === 0 ? whole.format(kobo / 100) : exact.format(kobo / 100)
}

/** Parses what an admin types ("25,000", "₦25000.50") into kobo. Returns null if it isn't a valid amount. */
export function parseNairaToKobo(input: string | null | undefined): number | null {
  if (input == null) return null
  const cleaned = String(input)
    .replace(/[₦,\s]/g, '')
    .replace(/^NGN/i, '')
  if (cleaned === '' || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const kobo = Math.round(Number(cleaned) * 100)
  return Number.isSafeInteger(kobo) ? kobo : null
}

/** Kobo to a plain naira string for form inputs ("25000" or "25000.50"). */
export function koboToInput(kobo: number | null | undefined): string {
  if (kobo == null) return ''
  return kobo % 100 === 0 ? String(kobo / 100) : (kobo / 100).toFixed(2)
}
