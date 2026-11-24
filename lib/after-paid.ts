import 'server-only'
import { revalidateTag } from 'next/cache'
import { after } from 'next/server'
import { CATALOG_TAG } from './catalog'
import { sendOrderPaidEmails, sendPaymentIssueEmail } from './email'
import { getOrderWithItems, type Order, type PaymentIssue } from './orders'
import { getSettings } from './settings'

/** Run once an order becomes paid: stock changed, so refresh the shop; email after responding. */
export function afterPaid(orderId: number, origin: string) {
  revalidateTag(CATALOG_TAG, { expire: 0 })
  after(async () => {
    const order = await getOrderWithItems({ id: orderId })
    if (!order) return
    const settings = await getSettings()
    await sendOrderPaidEmails(order, order.items, origin, settings.email)
  })
}

/** Tell the shop about a payment that needs a refund or a check. */
export function afterPaymentIssue(order: Order, issue: PaymentIssue, origin: string) {
  after(async () => {
    const settings = await getSettings()
    await sendPaymentIssueEmail(order, issue, origin, settings.email)
  })
}
