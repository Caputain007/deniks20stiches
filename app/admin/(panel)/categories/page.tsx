import type { Metadata } from 'next'
import { asc, count } from 'drizzle-orm'
import { deleteCategory, moveCategory, saveCategory } from '@/app/actions/admin-shop'
import { ActionButton } from '@/components/admin/action-button'
import { CategoryEditForm, NewCategoryForm } from '@/components/admin/settings-forms'
import { PageHeader, Panel } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'

export const metadata: Metadata = { title: 'Categories' }

export default async function CategoriesPage() {
  await requireAdmin()
  const db = getDb()
  const [categories, counts] = await Promise.all([
    db.select().from(schema.categories).orderBy(asc(schema.categories.position), asc(schema.categories.name)),
    db
      .select({ categoryId: schema.products.categoryId, n: count() })
      .from(schema.products)
      .groupBy(schema.products.categoryId),
  ])
  const productCount = (id: number) => counts.find((c) => c.categoryId === id)?.n ?? 0

  return (
    <>
      <PageHeader title="Categories" />
      <p className="-mt-4 mb-6 max-w-2xl text-muted">
        Categories group your products in the shop menu. Only categories with live products show to customers.
      </p>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ul className="space-y-4">
          {categories.map((c, i) => (
            <li key={c.id}>
              <Panel>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted">
                    {productCount(c.id)} product{productCount(c.id) === 1 ? '' : 's'}
                  </p>
                  <div className="flex gap-2">
                    <ActionButton action={moveCategory.bind(null, c.id, -1)} className="btn btn-quiet btn-sm px-2">
                      <span aria-label={`Move ${c.name} up`}>↑</span>
                    </ActionButton>
                    <ActionButton action={moveCategory.bind(null, c.id, 1)} className="btn btn-quiet btn-sm px-2">
                      <span aria-label={`Move ${c.name} down`}>↓</span>
                    </ActionButton>
                  </div>
                </div>
                <CategoryEditForm
                  action={saveCategory.bind(null, c.id)}
                  category={{ name: c.name, slug: c.slug, description: c.description }}
                  first={i === 0}
                />
                {productCount(c.id) === 0 && (
                  <div className="mt-3">
                    <ActionButton
                      action={deleteCategory.bind(null, c.id)}
                      confirm={`Delete ${c.name}?`}
                      className="btn btn-danger btn-sm"
                    >
                      Delete category
                    </ActionButton>
                  </div>
                )}
              </Panel>
            </li>
          ))}
        </ul>
        <Panel title="Add a category" className="self-start">
          <NewCategoryForm />
        </Panel>
      </div>
    </>
  )
}
