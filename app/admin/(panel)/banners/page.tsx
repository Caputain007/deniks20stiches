import type { Metadata } from 'next'
import { desc } from 'drizzle-orm'
import { createBanner, deleteBanner, saveBanner } from '@/app/actions/admin-promos'
import { ActionButton } from '@/components/admin/action-button'
import { BannerForm } from '@/components/admin/promo-forms'
import { PageHeader, Panel, StatusPill } from '@/components/admin/ui'
import { bannerStatuses } from '@/lib/admin-queries'
import { requireAdmin } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'
import { toLagosInput } from '@/lib/lagos-time'
import { storageMode } from '@/lib/storage'

export const metadata: Metadata = { title: 'Banners' }

export default async function BannersPage() {
  await requireAdmin()
  const banners = await getDb()
    .select()
    .from(schema.banners)
    .orderBy(desc(schema.banners.updatedAt), desc(schema.banners.id))
  const statuses = bannerStatuses(banners)
  const mode = storageMode()

  return (
    <>
      <PageHeader title="Banners" />
      <p className="-mt-4 mb-8 max-w-2xl text-muted">
        Run a short message across the top of every page, or change the big banner at the top of the home page. Add
        dates to start and stop a banner on its own, for a sale or a holiday.
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="New banner">
          <BannerForm id="new" action={createBanner} mode={mode} isNew />
        </Panel>
        <div className="space-y-6">
          {banners.length === 0 && (
            <p className="border border-dashed border-line px-5 py-8 text-center text-muted">
              No banners yet. The home page shows its usual photo and headline.
            </p>
          )}
          {banners.map((b) => {
            const status = statuses.get(b.id)!
            return (
              <Panel key={b.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-sans text-lg font-bold">
                    {b.placement === 'bar' ? 'Top bar' : 'Home page banner'}
                  </h2>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </div>
                <BannerForm
                  id={`b${b.id}`}
                  action={saveBanner.bind(null, b.id)}
                  mode={mode}
                  initial={{
                    placement: b.placement,
                    title: b.title,
                    body: b.body,
                    linkLabel: b.linkLabel,
                    linkUrl: b.linkUrl,
                    imageUrl: b.imageUrl,
                    imageWidth: b.imageWidth,
                    imageHeight: b.imageHeight,
                    startsAt: toLagosInput(b.startsAt),
                    endsAt: toLagosInput(b.endsAt),
                    active: b.active,
                  }}
                />
                <div className="mt-4 border-t border-line pt-4">
                  <ActionButton
                    action={deleteBanner.bind(null, b.id)}
                    confirm="Delete this banner?"
                    className="btn btn-danger btn-sm"
                  >
                    Delete banner
                  </ActionButton>
                </div>
              </Panel>
            )
          })}
        </div>
      </div>
    </>
  )
}
