import type { Metadata } from 'next'
import { asc } from 'drizzle-orm'
import { NewProductForm } from '@/components/admin/product-forms'
import { PageHeader, Panel } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'

export const metadata: Metadata = { title: 'Add product' }

export default async function NewProductPage() {
  await requireAdmin()
  const categories = await getDb()
    .select({ id: schema.categories.id, name: schema.categories.name })
    .from(schema.categories)
    .orderBy(asc(schema.categories.position), asc(schema.categories.name))

  return (
    <>
      <PageHeader title="Add product" back={{ href: '/admin/products', label: 'Products' }} />
      <Panel className="max-w-xl">
        <p className="mb-5 text-muted">
          Start with the basics. On the next page you’ll add photos, sizes and stock, then publish.
        </p>
        <NewProductForm categories={categories} />
      </Panel>
    </>
  )
}
