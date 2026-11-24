import Link from 'next/link'

/** Banner links are either pages on this site or full https addresses. */
export function BannerLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return href.startsWith('/') ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} rel="noopener noreferrer">
      {children}
    </a>
  )
}
