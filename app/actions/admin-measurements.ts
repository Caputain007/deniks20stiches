'use server'

import { eq } from 'drizzle-orm'
import { refresh, updateTag } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'
import { MEASUREMENT_STATUSES, type MeasurementStatus } from '@/lib/db/schema'
import { SETTINGS_TAG } from '@/lib/settings'
import { CHART_MEASURES } from '@/lib/size-chart'

export type ActionState = { ok?: boolean; message?: string; error?: string } | null

const LABELS: Record<MeasurementStatus, string> = {
  new: 'Moved back to new.',
  contacted: 'Marked as contacted.',
  done: 'Marked as done.',
}

export async function setMeasurementStatus(id: number, status: MeasurementStatus): Promise<ActionState> {
  await requireAdmin()
  if (!MEASUREMENT_STATUSES.includes(status)) return { error: 'Unknown status.' }
  await getDb().update(schema.measurementRequests).set({ status }).where(eq(schema.measurementRequests.id, id))
  refresh()
  return { ok: true, message: LABELS[status] }
}

const inches = z.coerce
  .number({ error: 'Use numbers for bust, waist and hips.' })
  .min(10, 'Each measurement should be between 10 and 100 inches.')
  .max(100, 'Each measurement should be between 10 and 100 inches.')

const rowSchema = z.object({
  size: z.string().trim().min(1, 'Give every row a size.').max(12, 'Keep size names short, like M or XXL.'),
  bust: inches,
  waist: inches,
  hips: inches,
})

/** Replaces the size chart used by "find your size" on the measurements page. */
export async function saveSizeChart(rows: unknown): Promise<ActionState> {
  await requireAdmin()
  const parsed = z.array(rowSchema).max(15, 'Keep the chart to 15 sizes or fewer.').safeParse(rows)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const chart = parsed.data
  const names = new Set(chart.map((r) => r.size.toUpperCase()))
  if (names.size !== chart.length) return { error: 'Each size should appear once.' }
  for (let i = 1; i < chart.length; i++) {
    for (const m of CHART_MEASURES) {
      if (chart[i][m] < chart[i - 1][m]) {
        return { error: `List sizes from smallest to largest: ${chart[i].size} is smaller than ${chart[i - 1].size}.` }
      }
    }
  }
  await getDb()
    .insert(schema.settings)
    .values({ key: 'sizeChart', value: JSON.stringify(chart) })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: JSON.stringify(chart), updatedAt: new Date() } })
  updateTag(SETTINGS_TAG)
  refresh()
  return { ok: true, message: chart.length ? 'Size chart saved.' : 'Size chart cleared. “Find your size” is hidden.' }
}
