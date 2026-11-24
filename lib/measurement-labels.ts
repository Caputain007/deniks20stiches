import type { MeasurementPurpose, MeasurementStatus } from './db/schema'

export const MEASUREMENT_PURPOSE_LABELS: Record<MeasurementPurpose, string> = {
  bespoke: 'Bespoke outfit',
  alteration: 'Adjusting a piece they bought',
  keep: 'To keep on file',
}

export const MEASUREMENT_STATUS_LABELS: Record<MeasurementStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  done: 'Done',
}
