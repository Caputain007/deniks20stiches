import Link from 'next/link'
import type { OrderStatus, ProductStatus } from '@/lib/db/schema'

export function PageHeader({
  title,
  back,
  children,
}: {
  title: string
  back?: { href: string; label: string }
  children?: React.ReactNode
}) {
  return (
    <div className="mb-8">
      {back && (
        <Link href={back.href} className="text-sm text-muted no-underline hover:text-plum">
          ← {back.label}
        </Link>
      )}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {children && <div className="flex flex-wrap gap-3">{children}</div>}
      </div>
    </div>
  )
}

const ORDER_STYLES: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Awaiting payment', className: 'bg-amber/10 text-amber' },
  paid: { label: 'To ship', className: 'bg-plum text-white' },
  shipped: { label: 'Shipped', className: 'bg-blush text-plum' },
  delivered: { label: 'Delivered', className: 'bg-leaf/10 text-leaf' },
  cancelled: { label: 'Cancelled', className: 'bg-line/60 text-muted' },
}

export function OrderBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STYLES[status]
  return (
    <span className={`inline-block whitespace-nowrap px-2 py-0.5 text-xs font-bold ${s.className}`}>{s.label}</span>
  )
}

const PRODUCT_STYLES: Record<ProductStatus, { label: string; className: string }> = {
  active: { label: 'Live', className: 'bg-leaf/10 text-leaf' },
  draft: { label: 'Draft', className: 'bg-amber/10 text-amber' },
  archived: { label: 'Archived', className: 'bg-line/60 text-muted' },
}

export function ProductBadge({ status }: { status: ProductStatus }) {
  const s = PRODUCT_STYLES[status]
  return (
    <span className={`inline-block whitespace-nowrap px-2 py-0.5 text-xs font-bold ${s.className}`}>{s.label}</span>
  )
}

export function Panel({
  title,
  children,
  className = '',
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`bg-white p-5 ring-1 ring-line sm:p-6 ${className}`}>
      {title && <h2 className="mb-4 font-sans text-lg font-bold">{title}</h2>}
      {children}
    </section>
  )
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error'
  children: React.ReactNode
}) {
  const styles = {
    info: 'border-plum text-ink',
    success: 'border-leaf text-leaf',
    warning: 'border-amber text-amber',
    error: 'border-rose text-rose',
  }
  return <div className={`border border-dashed bg-white px-4 py-3 ${styles[tone]}`}>{children}</div>
}

export function formatDate(date: Date | null | undefined) {
  if (!date) return ''
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Lagos',
  }).format(date)
}
