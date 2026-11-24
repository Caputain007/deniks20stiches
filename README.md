# Deniks20 Stitches online store

The Deniks20 Stitches shop: Malaysian hijabs, modest ready-to-wear, abayas and accessories, with online payment and delivery across Nigeria and abroad.

- **Shop**: a tab for every category, plus Sale, Bespoke and Measurements. Product pages with at least 4 photos, sizes with live stock, a bag, and checkout with delivery (Nigerian state picker or any country, fee shown before paying) or free pickup from the shop in Lokoja. Coupon codes, payment through Paystack, an order page and order tracking.
- **Measurements**: a measuring guide with a figure that shows where the tape goes, a size finder for the letter sizes, and a step-by-step form for sending measurements for bespoke tailoring or alterations.
- **Admin** at `/admin`: add products and photos, set prices (and a "was" price for the Sale tab), sizes and stock, mark thrift pieces as pre-loved, then publish. Also: orders (ship with tracking or mark ready to collect, mark delivered, cancel and restock), measurements customers sent, banners (a bar across the top or the home page banner, with start and end dates), coupons, the size chart, the WhatsApp catalogue list and Meta feed, delivery fees and pickup, shop details, admins and passwords.

Built with Next.js 16 on Vercel, Neon Postgres (through Drizzle ORM), Vercel Blob for photos and Paystack for payments. Order emails through Resend are optional.

## Put it online (one time)

1. **Import the repo.** In Vercel go to **Add New → Project** and import `Caputain007/deniks20stiches`. Keep the defaults and leave **Root Directory** empty. [`vercel.json`](vercel.json) sets the framework (Next.js) and the build commands, so they apply even to a project first set up for the old one-page site. The first deployment fails because there's no database yet. That's expected.
2. **Database.** In the project, open **Storage → Create Database → Neon** and connect it to the project for all environments. This adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Pick a European region such as Frankfurt (AWS `eu-central-1`), which is closer to Nigeria than the US. Then set the same place under **Settings → Functions → Function Regions** (Frankfurt, `fra1`), so the server and the database sit side by side.
3. **Photo storage.** Open **Storage → Create → Blob**, choose **Public** access, connect it to the project and tick **Add a read-write token env var to this connection**. This adds `BLOB_READ_WRITE_TOKEN`, which photo uploads need.
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
- Every Paystack reference the shop creates is random and recorded. Payments are matched to orders only through those references, so other payments on the same Paystack account are ignored.
- An order is only marked as paid after the server confirms the payment with Paystack's API. Both the return redirect and the webhook do this check, and running it twice is harmless. Stock goes down when the order is paid.
- Anything that needs a person (a customer who paid twice, a payment that arrived after a cancel, or an amount that doesn't match) shows as **Payment needs attention** on the order and the dashboard, and is emailed to the shop if emails are on.
- If two people buy the last piece at the same moment, the second order is flagged so you can refund or restock. Cancelling a paid order puts back exactly what it took from stock. Refund the money from the Paystack dashboard.
- An unpaid order can be paid later from its order page for 3 days, as long as the prices, stock, delivery fee and coupon haven't changed.

## Coupons and pickup

- Coupons take a percentage or an amount off the items, or take off the delivery fee. They can have a minimum order, a total number of uses, one use per customer (by email) and start and end dates.
- Codes are checked again on the server when the order is placed, with the coupon locked, so the last use of a code can't be taken twice. An unpaid order holds its use for 3 days.
- Pickup orders pay no delivery fee. In admin they're marked **ready to collect** (the customer can be emailed), then **collected**. Turn pickup on or off, and set the instructions, under **Delivery**. The address comes from **Settings**.

## WhatsApp catalogue

- Product links shared in WhatsApp show the photo, name and price.
- **Admin → WhatsApp** lists every live product with buttons to copy its name, price, description and link into the WhatsApp Business app's catalogue, which only takes items by hand.
- `/feeds/meta-catalog.csv` is a product feed in Meta's catalogue format. Add it in Meta Commerce Manager as a scheduled data feed, and Facebook and Instagram catalogues (and a WhatsApp number managed in WhatsApp Manager) pick up new products and price changes on their own.

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
