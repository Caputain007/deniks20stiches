// What we ask customers to measure, shared by the guide, the form and admin.
// Limits are in inches and only catch typing mistakes (e.g. 360 for 36).

export type Unit = 'in' | 'cm'

export const MEASUREMENTS = [
  {
    key: 'bust',
    label: 'Bust',
    how: 'Wrap the tape around the fullest part of your bust, under your arms. Keep it level across your back and breathe normally.',
    min: 20,
    max: 80,
  },
  {
    key: 'waist',
    label: 'Waist',
    how: 'Around your natural waist: the narrowest part of your body, usually just above your belly button. Don’t pull the tape tight.',
    min: 15,
    max: 80,
  },
  {
    key: 'hips',
    label: 'Hips',
    how: 'Stand with your feet together and measure around the fullest part of your hips and bottom.',
    min: 20,
    max: 90,
  },
  {
    key: 'shoulder',
    label: 'Shoulder width',
    how: 'Across your back, from the edge of one shoulder to the edge of the other. Ask someone to help with this one.',
    min: 8,
    max: 30,
  },
  {
    key: 'sleeve',
    label: 'Sleeve length',
    how: 'From the edge of your shoulder, down the outside of a slightly bent arm, to your wrist bone.',
    min: 10,
    max: 40,
  },
  {
    key: 'arm',
    label: 'Upper arm',
    how: 'Around the fullest part of your upper arm, with your arm relaxed at your side.',
    min: 5,
    max: 30,
  },
  {
    key: 'wrist',
    label: 'Wrist',
    how: 'Around your wrist, just above the wrist bone. This sets how wide the cuff is.',
    min: 3,
    max: 15,
  },
  {
    key: 'length',
    label: 'Full length',
    how: 'From the top of your shoulder, next to your neck, straight down to where the hem should sit. Wear the shoes you’ll wear with it.',
    min: 20,
    max: 80,
  },
  {
    key: 'height',
    label: 'Height',
    how: 'Stand straight against a wall without shoes. Measure from the floor to the top of your head.',
    min: 36,
    max: 96,
  },
] as const

export type MeasurementKey = (typeof MEASUREMENTS)[number]['key']
export type MeasurementDef = (typeof MEASUREMENTS)[number]

/** The ones a tailor can't start without. */
export const REQUIRED_MEASUREMENTS: MeasurementKey[] = ['bust', 'waist', 'hips']

export const UNIT_LABELS: Record<Unit, string> = { in: 'inches', cm: 'cm' }

const CM_PER_INCH = 2.54

export function toInches(value: number, unit: Unit): number {
  return unit === 'cm' ? value / CM_PER_INCH : value
}

export function fromInches(inches: number, unit: Unit): number {
  return unit === 'cm' ? inches * CM_PER_INCH : inches
}

/** Rounded the way a tape is read: to the half inch, or the whole centimetre. */
export function roundForUnit(value: number, unit: Unit): number {
  return unit === 'cm' ? Math.round(value) : Math.round(value * 2) / 2
}

export function formatMeasure(value: number, unit: Unit): string {
  const n = roundForUnit(value, unit)
  return `${Number.isInteger(n) ? n : n.toFixed(1)} ${unit}`
}

/** Parses what someone types ("36", "36.5", "36½", "91 cm"). Null when it isn't a number. */
export function parseMeasure(input: string): number | null {
  const cleaned = input
    .trim()
    .replace(/½/g, '.5')
    .replace(/,/g, '.')
    .replace(/\s*(in|inches|"|cm)$/i, '')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return n > 0 ? n : null
}

/** The allowed range for a measurement, in the unit being used. */
export function rangeFor(def: MeasurementDef, unit: Unit): { min: number; max: number } {
  return { min: Math.floor(fromInches(def.min, unit)), max: Math.ceil(fromInches(def.max, unit)) }
}

/** An error to show, or null if the value is believable. */
export function checkMeasure(def: MeasurementDef, value: number, unit: Unit): string | null {
  const { min, max } = rangeFor(def, unit)
  if (value < min || value > max) {
    return `${def.label} should be between ${min} and ${max} ${unit}. Check the number and the unit.`
  }
  return null
}
