import { formatMeasure, MEASUREMENTS, type MeasurementKey, type Unit } from '@/lib/measurements'

// A front-view figure in a hijab and long dress. Every measurement is drawn as a
// faint running stitch; the one being measured is sewn in plum with its label.

type P = readonly [number, number]
const CX = 150
const r1 = (n: number) => Math.round(n * 10) / 10
const mirror = (pts: readonly P[]): P[] => pts.map(([x, y]) => [2 * CX - x, y] as const)

/** Smooth path through points (Catmull-Rom as cubic Béziers). */
function smooth(points: readonly P[], closed = true): string {
  const n = points.length
  const at = (i: number) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    d += `C${r1(p1[0] + (p2[0] - p0[0]) / 6)},${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)},${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]},${p2[1]}`
  }
  return closed ? `${d}Z` : d
}

const symmetric = (top: P, right: readonly P[], bottom: P) =>
  smooth([top, ...right, bottom, ...mirror(right).reverse()])

const TORSO = symmetric(
  [150, 95],
  [
    [168, 97],
    [186, 102],
    [190, 112],
    [187, 128],
    [189, 146],
    [184, 166],
    [176, 190],
    [181, 214],
    [190, 238],
    [197, 300],
    [205, 380],
    [214, 462],
    [183, 467],
  ],
  [150, 468],
)

const ARM_RIGHT: P[] = [
  [184, 104],
  [196, 109],
  [204, 128],
  [210, 168],
  [214, 210],
  [217, 249],
  [220, 262],
  [217, 276],
  [211, 280],
  [205, 274],
  [204, 262],
  [207, 249],
  [203, 210],
  [198, 170],
  [192, 142],
  [186, 128],
]
const ARMS = [smooth(ARM_RIGHT), smooth(mirror(ARM_RIGHT))]

const HIJAB = symmetric(
  [150, 17],
  [
    [166, 21],
    [177, 37],
    [180, 58],
    [177, 78],
    [183, 92],
    [197, 106],
    [201, 119],
    [192, 130],
    [172, 135],
  ],
  [150, 137],
)

type Overlay =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; label: P }
  | { kind: 'path'; d: string; ends: [P, P]; vertical: boolean; label: P }

const OVERLAYS: Record<MeasurementKey, Overlay> = {
  shoulder: {
    kind: 'path',
    d: 'M112,100 L188,100',
    ends: [
      [112, 100],
      [188, 100],
    ],
    vertical: false,
    label: [234, 96],
  },
  bust: { kind: 'ellipse', cx: 150, cy: 146, rx: 40, ry: 6.5, label: [234, 150] },
  waist: { kind: 'ellipse', cx: 150, cy: 190, rx: 27, ry: 5, label: [234, 194] },
  hips: { kind: 'ellipse', cx: 150, cy: 238, rx: 41, ry: 6.5, label: [234, 242] },
  sleeve: {
    kind: 'path',
    d: smooth(
      [
        [190, 97],
        [203, 102],
        [213, 127],
        [219, 168],
        [223, 210],
        [226, 249],
      ],
      false,
    ),
    ends: [
      [190, 97],
      [226, 249],
    ],
    vertical: true,
    label: [234, 180],
  },
  arm: { kind: 'ellipse', cx: 201, cy: 160, rx: 8.5, ry: 3, label: [234, 164] },
  wrist: { kind: 'ellipse', cx: 212, cy: 249, rx: 6.5, ry: 2.5, label: [234, 254] },
  length: {
    kind: 'path',
    d: 'M132,98 L132,466',
    ends: [
      [132, 98],
      [132, 466],
    ],
    vertical: true,
    label: [139, 322],
  },
  height: {
    kind: 'path',
    d: 'M30,17 L30,482',
    ends: [
      [30, 17],
      [30, 482],
    ],
    vertical: true,
    label: [37, 262],
  },
}

/** Short names fit beside the figure; the full name is in the text next to it. */
const SHORT: Partial<Record<MeasurementKey, string>> = {
  shoulder: 'Shoulder',
  sleeve: 'Sleeve',
  length: 'Length',
}

function Shape({ overlay, className }: { overlay: Overlay; className: string }) {
  if (overlay.kind === 'ellipse') {
    return <ellipse cx={overlay.cx} cy={overlay.cy} rx={overlay.rx} ry={overlay.ry} className={className} />
  }
  return (
    <>
      <path d={overlay.d} className={className} />
      {overlay.ends.map(([x, y]) => (
        <path
          key={`${x}-${y}`}
          d={overlay.vertical ? `M${x - 5},${y} L${x + 5},${y}` : `M${x},${y - 5} L${x},${y + 5}`}
          className={`${className} measure-tick`}
        />
      ))}
    </>
  )
}

export function MeasureFigure({
  active,
  values = {},
  unit = 'in',
  className = '',
}: {
  active: MeasurementKey | null
  values?: Partial<Record<MeasurementKey, number>>
  unit?: Unit
  className?: string
}) {
  const def = MEASUREMENTS.find((m) => m.key === active)
  const overlay = active ? OVERLAYS[active] : null
  const value = active ? values[active] : undefined
  const labelLines = def ? [SHORT[def.key] ?? def.label, ...(value ? [formatMeasure(value, unit)] : [])] : []
  const labelWidth = Math.max(...labelLines.map((l) => l.length), 0) * 8.4 + 12

  return (
    <svg
      viewBox="0 0 330 492"
      role="img"
      aria-label={def ? `Where to measure your ${def.label.toLowerCase()}` : 'Where to measure'}
      className={`measure-figure ${className}`}
    >
      {/* floor */}
      <path d="M58,482 L262,482" className="measure-floor" />
      <ellipse cx="136" cy="473" rx="11" ry="5.5" className="measure-shade" />
      <ellipse cx="164" cy="473" rx="11" ry="5.5" className="measure-shade" />
      {ARMS.map((d) => (
        <path key={d} d={d} className="measure-body" />
      ))}
      <path d={TORSO} className="measure-body" />
      <path d={HIJAB} className="measure-shade" />
      <ellipse cx="150" cy="58" rx="14.5" ry="19" className="measure-face" />

      {MEASUREMENTS.filter((m) => m.key !== active).map((m) => (
        <Shape key={m.key} overlay={OVERLAYS[m.key]} className="measure-guide" />
      ))}

      {overlay && def && (
        // Keyed so the stitch is sewn again each time a different measurement is chosen.
        <g key={def.key}>
          {def.key === 'height' && <path d="M30,17 L150,17" className="measure-guide" />}
          <Shape overlay={overlay} className="measure-active" />
          <g className="measure-label">
            <rect
              x={overlay.label[0] - 5}
              y={overlay.label[1] - 16}
              width={labelWidth}
              height={labelLines.length * 19 + 6}
              rx="2"
            />
            {labelLines.map((line, i) => (
              <text key={line} x={overlay.label[0]} y={overlay.label[1] + i * 19} className={i ? 'value' : ''}>
                {line}
              </text>
            ))}
          </g>
        </g>
      )}
    </svg>
  )
}
