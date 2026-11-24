import { formatNaira } from '@/lib/money'

export function Price({
  kobo,
  compareAt,
  className = '',
}: {
  kobo: number
  compareAt?: number | null
  className?: string
}) {
  if (compareAt && compareAt > kobo) {
    return (
      <span className={className}>
        <span className="text-rose">{formatNaira(kobo)}</span>{' '}
        <s className="text-muted">
          <span className="sr-only">was </span>
          {formatNaira(compareAt)}
        </s>
      </span>
    )
  }
  return <span className={className}>{formatNaira(kobo)}</span>
}
