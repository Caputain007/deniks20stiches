/** An unpaid order can be paid for this long; after that it expires. */
export const PENDING_ORDER_DAYS = 3

export const PAID_STATUSES = ['paid', 'shipped', 'delivered'] as const
