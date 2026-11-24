import type { Metadata, Viewport } from 'next'
import { siteUrl } from '@/lib/site-url'
import { forum, mulish, mulishExt } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl() ?? 'http://localhost:3000'),
  title: {
    default: 'Deniks20 Stitches | Malaysian hijabs and modest ready-to-wear',
    template: '%s | Deniks20 Stitches',
  },
  description:
    'Shop Malaysian hijabs, modest ready-to-wear dresses, abayas and accessories from Deniks20 Stitches. Delivery across Nigeria and abroad.',
  openGraph: { siteName: 'Deniks20 Stitches', type: 'website', images: ['/brand/editorial.webp'] },
}

export const viewport: Viewport = {
  themeColor: '#4c2071',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${forum.variable} ${mulish.variable} ${mulishExt.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
