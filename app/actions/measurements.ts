'use server'

import { and, count, eq, gt } from 'drizzle-orm'
import { after } from 'next/server'
import { z } from 'zod'
import { clientFingerprint, isUniqueViolation, randomCode } from '@/lib/codes'
import { getDb, schema } from '@/lib/db'
import { MEASUREMENT_PURPOSES, MEASUREMENT_UNITS } from '@/lib/db/schema'
import { sendMeasurementAlert } from '@/lib/email'
import { checkMeasure, MEASUREMENTS, REQUIRED_MEASUREMENTS, roundForUnit } from '@/lib/measurements'
import { getOrigin } from '@/lib/origin'
import { getSettings, whatsappLink } from '@/lib/settings'

const trimmed = (max: number) => z.string().trim().max(max)

const inputSchema = z.object({
  name: trimmed(100).min(2, 'Enter your name.'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{7,20}$/, 'Enter a WhatsApp number we can reach, e.g. 0803 123 4567.'),
  email: z.union([z.literal(''), z.email('Enter a valid email address, or leave it empty.').max(254)]),
  purpose: z.enum(MEASUREMENT_PURPOSES, 'Choose what the measurements are for.'),
  orderNumber: trimmed(20),
  notes: trimmed(1000),
  unit: z.enum(MEASUREMENT_UNITS),
  values: z.record(z.string(), z.number().finite()),
  website: z.string().max(200).default(''), // left empty by people; bots fill it in
})

export type MeasurementResult =
  | { ok: true; reference: string; whatsappUrl: string | null }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }

const PER_HOUR = 5

export async function submitMeasurements(input: unknown): Promise<MeasurementResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? 'form')] ??= issue.message
    return { ok: false, error: 'Check the highlighted details and try again.', fieldErrors }
  }
  const data = parsed.data
  if (data.website) return { ok: true, reference: 'M-RECEIVED', whatsappUrl: null }

  const values: Record<string, number> = {}
  for (const def of MEASUREMENTS) {
    const value = data.values[def.key]
    if (value === undefined) {
      if (REQUIRED_MEASUREMENTS.includes(def.key)) {
        return { ok: false, error: `Enter your ${def.label.toLowerCase()} measurement.` }
      }
      continue
    }
    const problem = checkMeasure(def, value, data.unit)
    if (problem) return { ok: false, error: problem }
    values[def.key] = roundForUnit(value, data.unit)
  }

  const db = getDb()
  const sender = await clientFingerprint()
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(schema.measurementRequests)
    .where(
      and(
        eq(schema.measurementRequests.ipHash, sender),
        gt(schema.measurementRequests.createdAt, new Date(Date.now() - 3_600_000)),
      ),
    )
  if (recent >= PER_HOUR) {
    return {
      ok: false,
      error: 'You’ve sent several sets of measurements in the last hour. Message us on WhatsApp if something changed.',
    }
  }

  let saved: typeof schema.measurementRequests.$inferSelect | undefined
  for (let attempt = 0; !saved; attempt++) {
    try {
      ;[saved] = await db
        .insert(schema.measurementRequests)
        .values({
          reference: `M-${randomCode(6)}`,
          name: data.name,
          phone: data.phone,
          email: data.email.toLowerCase(),
          purpose: data.purpose,
          unit: data.unit,
          values,
          notes: data.notes,
          orderNumber: data.purpose === 'alteration' ? data.orderNumber.toUpperCase() : '',
          ipHash: sender,
        })
        .returning()
    } catch (error) {
      if (attempt < 4 && isUniqueViolation(error)) continue
      console.error('Saving measurements failed', error)
      return { ok: false, error: 'We couldn’t save your measurements. Please try again in a moment.' }
    }
  }

  const [settings, origin] = await Promise.all([getSettings(), getOrigin()])
  const request = saved
  after(() => sendMeasurementAlert(request, origin, settings.email))

  return {
    ok: true,
    reference: request.reference,
    whatsappUrl: whatsappLink(
      settings.whatsapp,
      `Hello Deniks20 Stitches, I’ve sent my measurements (reference ${request.reference}).`,
    ),
  }
}
