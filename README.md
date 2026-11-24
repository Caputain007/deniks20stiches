# Deniks20 Stitches online store

The Deniks20 Stitches shop: Malaysian hijabs, modest ready-to-wear, abayas and accessories, with online payment and delivery across Nigeria and abroad.

- **Shop**: catalogue by category, product pages with at least 4 photos, sizes with live stock, a bag, checkout with a Nigerian state picker or any country, the delivery fee shown before paying, payment through Paystack, an order page and order tracking.
- **Admin** at `/admin`: add products and photos, set prices, sizes and stock, then publish. Also: categories, orders (ship with tracking, mark delivered, cancel and restock), delivery fees, shop details, admins and passwords.

Built with Next.js 16 on Vercel, Neon Postgres (through Drizzle ORM), Vercel Blob for photos and Paystack for payments. Order emails through Resend are optional.

## Put it online (one time)

1. **Import the repo.** In Vercel go to **Add New → Project** and import `Caputain007/deniks20stiches`. Keep the defaults. The first deployment fails because there's no database yet. That's expected.
2. **Database.** In the project, open **Storage → Create Database → Neon** and connect it to the project for all environments. This adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. **Photo storage.** Open **Storage → Create → Blob**, choose **public** access and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`.
4. **Environment variables.** In **Settings → Environment Variables**, add the values listed in [`.env.example`](.env.example):
   - `AUTH_SECRET`: a random string of 32+ characters (`openssl rand -base64 32`)
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: the first admin sign-in
   - `PAYSTACK_SECRET_KEY`: start with the test key (`sk_test_…`)
5. **Redeploy** from the Deployments tab. Each build runs the database migrations first.
6. **Paystack webhook.** In Paystack → **Settings → API Keys & Webhooks**, set the webhook URL to `https://YOUR-DOMAIN/api/paystack/webhook`. Do this in both test and live mode.
7. **Set up the shop.** Sign in at `/admin` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Set your delivery fees, check the details in **Settings**, then add products. Each product needs at least 4 photos before it can be published.
8. **Test, then go live.** Place a test order with one of Paystack's test cards. When it works, swap in the live secret key (`sk_live_…`), make sure the live webhook URL is set, and redeploy. To take overseas cards, request **international payments** in your Paystack dashboard (Paystack reviews the request).
9. **Domain.** Add the shop's domain in **Settings → Domains**, then set `SITE_URL` to it.

## How payments work

- Prices are stored in kobo, the unit Paystack charges in, and everything is charged in naira. Customers paying with an overseas card are charged in naira, and their bank converts it.
- At checkout the server prices the bag again from the database, checks stock and the delivery fee, saves a pending order and sends the customer to Paystack's checkout page.
- An order is only marked as paid after the server confirms the payment with Paystack's API. Both the return redirect and the webhook do this check, and running it twice is harmless. Stock goes down when the order is paid. If the amount doesn't match the order total, the order stays unpaid and a note is added for the admin.
- Cancelling a paid order in admin puts its items back in stock. Refund the money from the Paystack dashboard.

## Photos

Photos are resized in the browser to 1600 px (large) and 640 px (thumbnail) WebP files and uploaded straight to Vercel Blob. Large photos from phones never pass through the server. The first photo is the cover. The admin can reorder, describe and delete photos, but a live product can never drop below 4.

## Speed

Shop pages are cached and rebuilt when an admin changes something or a sale changes stock. Browsing doesn't wake the database, which keeps Neon usage low.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET, ADMIN_*; set LOCAL_UPLOADS=1
npm run db:migrate
npm run dev
```

To change the database: edit `lib/db/schema.ts`, run `npm run db:generate`, and commit the new file in `drizzle/`. It's applied on the next deploy.

`dev/sample-images` holds the illustrative photos from the old static site.
