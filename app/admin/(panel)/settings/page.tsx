import type { Metadata } from 'next'
import { asc } from 'drizzle-orm'
import { removeAdmin } from '@/app/actions/admin-auth'
import { ActionButton } from '@/components/admin/action-button'
import { AddAdminForm, PasswordForm, ShopSettingsForm } from '@/components/admin/settings-forms'
import { formatDate, PageHeader, Panel } from '@/components/admin/ui'
import { requireAdmin } from '@/lib/auth'
import { getDb, schema } from '@/lib/db'
import { getSettings } from '@/lib/settings'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const me = await requireAdmin()
  const [settings, admins] = await Promise.all([
    getSettings(),
    getDb()
      .select({
        id: schema.adminUsers.id,
        email: schema.adminUsers.email,
        name: schema.adminUsers.name,
        lastLoginAt: schema.adminUsers.lastLoginAt,
      })
      .from(schema.adminUsers)
      .orderBy(asc(schema.adminUsers.id)),
  ])

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Shop details" className="lg:row-span-2">
          <ShopSettingsForm values={settings} />
        </Panel>
        <Panel title="Your password">
          <PasswordForm />
        </Panel>
        <Panel title="Admins">
          <ul className="mb-6 divide-y divide-line">
            {admins.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">
                    {a.name || a.email}
                    {a.id === me.id && <span className="font-normal text-muted"> (you)</span>}
                  </p>
                  <p className="text-sm text-muted">
                    {a.email}
                    {a.lastLoginAt ? `, last signed in ${formatDate(a.lastLoginAt)}` : ', never signed in'}
                  </p>
                </div>
                {a.id !== me.id && (
                  <ActionButton
                    action={removeAdmin.bind(null, a.id)}
                    confirm="Remove this admin?"
                    className="btn btn-danger btn-sm"
                  >
                    Remove
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
          <h3 className="mb-3 font-sans text-base font-bold">Add an admin</h3>
          <AddAdminForm />
        </Panel>
      </div>
    </>
  )
}
