// The shop's size chart (body measurements in inches) and the "find my size" rule,
// shared by the measurements page and admin.

export type SizeChartRow = { size: string; bust: number; waist: number; hips: number }
export type ChartMeasure = 'bust' | 'waist' | 'hips'
export const CHART_MEASURES: ChartMeasure[] = ['bust', 'waist', 'hips']

const isMeasure = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 120

export function parseSizeChart(raw: string): SizeChartRow[] {
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data
      .filter(
        (r) =>
          r &&
          typeof r.size === 'string' &&
          r.size.trim() &&
          isMeasure(r.bust) &&
          isMeasure(r.waist) &&
          isMeasure(r.hips),
      )
      .map((r) => ({ size: r.size.trim().slice(0, 12), bust: r.bust, waist: r.waist, hips: r.hips }))
  } catch {
    return []
  }
}

export type SizeSuggestion =
  | {
      kind: 'size'
      size: string
      index: number
      decidedBy: ChartMeasure[]
      perMeasure: Partial<Record<ChartMeasure, string>>
    }
  | { kind: 'too-big'; over: ChartMeasure[] }
  | { kind: 'none' }

/**
 * Each size's numbers are the largest body it fits. For every measurement given,
 * find the smallest size that fits it; the biggest of those is the suggestion, so
 * nothing is tight. A tolerance of a quarter inch absorbs rounding.
 */
export function suggestSize(chart: SizeChartRow[], inches: Partial<Record<ChartMeasure, number>>): SizeSuggestion {
  const given = CHART_MEASURES.filter((m) => typeof inches[m] === 'number' && inches[m]! > 0)
  if (chart.length === 0 || given.length === 0) return { kind: 'none' }

  const fits: Partial<Record<ChartMeasure, number>> = {}
  const over: ChartMeasure[] = []
  for (const m of given) {
    const index = chart.findIndex((row) => row[m] + 0.25 >= inches[m]!)
    if (index < 0) over.push(m)
    else fits[m] = index
  }
  if (over.length) return { kind: 'too-big', over }

  const index = Math.max(...given.map((m) => fits[m]!))
  return {
    kind: 'size',
    size: chart[index].size,
    index,
    decidedBy: given.filter((m) => fits[m] === index),
    perMeasure: Object.fromEntries(given.map((m) => [m, chart[fits[m]!].size])),
  }
}
