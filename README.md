# Aoupa production operations

Aoupa distributes Blender add-ons from `https://aoupa.online`. It supports real accounts, admin-managed add-ons and versions, private ZIP delivery, tutorials, and USD-only Stripe Checkout.

## 1. Configure the environment

Create the runtime file and replace every placeholder:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Required values:

```dotenv
NEXT_PUBLIC_SITE_URL=https://aoupa.online
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
PAID_CHECKOUT_ENABLED=false
```

Use the URL without a trailing slash. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is designed for public clients; `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never commit `.env`, bake server secrets into an image, or give the service-role key to browser code.

Changes to `NEXT_PUBLIC_*` values require rebuilding the image.

## 2. Initialize Supabase

Create and link a Supabase project, then apply every migration in filename order:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The required order is:

1. `supabase/migrations/202607230001_initial_schema.sql`
2. `supabase/migrations/202607260001_google_auth_profile.sql`
3. `supabase/migrations/202607260002_production_ready.sql`
4. `supabase/migrations/202607260003_product_management.sql`
5. `supabase/migrations/202607260004_addon_donations.sql`
6. `supabase/migrations/202608030001_addon_login_and_reviews.sql`

When using the SQL Editor instead of the CLI, execute those complete files in the same order. Do not load `supabase/seed.sql` into production.

The migrations create the database functions, row-level security policies, and the public `product-media` and private `product-files` storage buckets.

## 3. Configure account authentication

In **Supabase Dashboard → Authentication → URL Configuration**, set:

- Site URL: `https://aoupa.online`
- Redirect allow list: `https://aoupa.online/auth/callback`
- Redirect allow list: `https://aoupa.online/auth/confirm`

Use token-hash links in the Supabase email templates.

Confirmation:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Password recovery:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password
```

Configure a custom SMTP provider under **Authentication → SMTP Settings** before launch. Use a verified sender on `aoupa.online` and publish the provider's SPF, DKIM, and recommended DMARC DNS records. Test confirmation and recovery delivery end to end.

For Google sign-in:

1. Create and publish the OAuth consent screen in Google Cloud.
2. Create a **Web application** OAuth client.
3. Copy the exact Supabase Google callback shown under **Authentication → Providers → Google**—normally `https://YOUR_PROJECT.supabase.co/auth/v1/callback`—into Google's authorized redirect URIs.
4. Save the Google Client ID and Client Secret in the Supabase Google provider and enable it.
5. Test sign-in through `https://aoupa.online/auth`.

## 4. Bootstrap the first admin

Sign up the owner through `/auth`, confirm the email, and copy that user's exact UUID from **Supabase Dashboard → Authentication → Users**. Promote only that UUID:

```sql
update public.profiles
set role = 'admin',
    updated_at = now()
where id = 'PASTE_EXACT_AUTH_USER_UUID'::uuid;

select id, email, role
from public.profiles
where id = 'PASTE_EXACT_AUTH_USER_UUID'::uuid;
```

The verification query must return the intended owner with role `admin`. An email setting alone does not grant admin access.

Alternatively, on the Docker host, use the server-only bootstrap command after
the owner has signed in once:

```bash
docker compose exec app node scripts/promote-admin.mjs owner@example.com
```

The command requires `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` in `.env`, matches exactly one profile, and verifies
the resulting `admin` role before reporting success.

## 5. Build and run Docker

```bash
docker compose build --pull
docker compose up -d
docker compose ps
```

Check readiness and inspect logs:

```bash
curl -fsS http://127.0.0.1:3000/api/health
docker compose logs --tail=200 -f app
```

After changing runtime-only secrets, run `docker compose up -d --force-recreate`. After changing source or any `NEXT_PUBLIC_*` value, rebuild and run `docker compose up -d --build`.

## 6. DNS, TLS, and reverse proxy

Point the apex `aoupa.online` A record to the Docker host's public IPv4 address. Add an AAAA record only when the host and firewall have working public IPv6. Allow inbound ports 80 and 443.

Terminate TLS with Caddy, Nginx, or another reverse proxy and forward HTTPS traffic to `127.0.0.1:3000`. Preserve the `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers, issue a trusted certificate, and redirect HTTP to HTTPS. Keep port 3000 private; the Compose default binds it to loopback.

## 7. Manage add-ons and releases

1. Sign in as the promoted owner and open `/admin/products`.
2. Choose **New add-on**, enter the metadata and USD pricing, attach the required ZIP, and optionally add a JPG, PNG, or WEBP cover.
3. Optionally upload an MP4 or WEBM tutorial and/or add an HTTPS YouTube or external tutorial link.
4. Choose **Upload and publish**. A draft is created; images and ZIPs use Supabase signed upload URLs, while videos upload to the VPS in 4 MB chunks. Publication occurs only after storage is verified.
5. Use **Edit** to update metadata, USD pricing, cover, or tutorial. A paid price change creates a new Stripe Price and archives the previous one.
6. Use **Add version** to publish another ZIP and changelog. Existing owners automatically see the latest release in `/library`.
7. Confirm the add-on appears under `/addons` and its product page opens.
8. From a separate customer account, claim a free add-on or complete Stripe Checkout for a paid add-on.
9. Confirm it appears in `/library`, then download it. Downloads use short-lived signed URLs from the private bucket.

Free claims create an entitlement but no payment order. Remove an incomplete draft from the admin list or retry publication after correcting its upload.

### VPS video storage (up to 500 MB)

New MP4/WEBM videos are stored on the VPS. Supabase still manages authentication,
administrator roles, products, and `products.tutorial_video_path`. That column now
also accepts a `vps:<product-uuid>/<video-uuid>.mp4` (or `.webm`) reference; no database
migration is needed. Existing Supabase video paths remain playable. Uploading a
replacement moves that product's video to VPS storage and removes the old file
after the database update succeeds. Images and ZIP releases continue using Supabase.

Run the application using the Node Docker deployment above. Docker Compose mounts
the persistent `video-data` volume at `/app/data/videos` and sets `VPS_VIDEO_DIR`.
Rebuilding/recreating the container keeps the files. Back up this volume together
with Supabase data; do not use `docker compose down -v` unless you intend to delete
the stored videos. Keep sufficient free disk space for uploads and replacements.
For Node without Docker, set `VPS_VIDEO_DIR` to a persistent absolute directory
writable by the application user. This storage backend requires a VPS filesystem;
the Cloudflare Workers `build:sites` deployment is not supported for these routes.
Use one app instance or mount the same shared directory on all instances.

Admin authentication and a signed, size-bound, 24-hour upload token protect each
chunk request. Chunks are at most 4 MB and retry up to three times. Completed files
are published atomically and served publicly at `/media/videos/...` with HTTP Range
support for seeking. Unfinished uploads are not publicly accessible. After an
interrupted upload, selecting the file and saving again starts a new upload.

For Nginx, add these settings to the existing site `server` block (and keep the
existing `location /` proxy configuration):

```nginx
client_max_body_size 8m;
proxy_read_timeout 300s;
proxy_send_timeout 300s;
```

Validate and reload Nginx, then deploy:

```bash
sudo nginx -t && sudo systemctl reload nginx
docker compose up -d --build
```

No Supabase Storage plan upgrade or bucket size increase is required for VPS videos.
Verify by editing a product, uploading a video larger than 50 MB, saving, then
opening its public page and seeking to the middle of the video. In browser Network,
uploads should use `/api/admin/video-upload`, and seeking should return `206` from
`/media/videos/...`. Recreate the container and verify playback again to check persistence.

If the server crashes during a chunk, a `.lock` file can remain. A fresh upload uses
a new ID. Partial `.part` and `.lock` files older than 48 hours can be removed during
maintenance after confirming no upload is active; completed `.mp4` and `.webm` files
must be retained while referenced by Supabase.

## 8. Test Stripe payments

Stripe is USD-only. Start with Stripe test-mode credentials:

```dotenv
PAID_CHECKOUT_ENABLED=true
STRIPE_SECRET_KEY=sk_test_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
```

Register `https://aoupa.online/api/stripe/webhook` for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `checkout.session.async_payment_failed`

Use the signing secret generated for that exact test-mode endpoint. After rebuilding, create a paid add-on in Admin and buy it from a separate customer account. Stripe's standard successful test card is `4242 4242 4242 4242`; use any future expiry and any three-digit CVC.

Verify that the order becomes `paid`, the add-on appears in `/library`, and duplicate webhook delivery does not create duplicate access. Never expose either Stripe value, prefix it with `NEXT_PUBLIC_`, commit it, or include it as a Docker build argument. Checkout remains unavailable while `PAID_CHECKOUT_ENABLED=false`.

### Switch Stripe to live payments

Activate the Stripe account, switch Workbench/Dashboard out of test mode, and
create a live webhook endpoint at
`https://aoupa.online/api/stripe/webhook` with the same four event types listed
above. Replace the VPS values with the live secret key (`sk_live_...`) and the
signing secret from that exact live endpoint, then recreate the app container.
Test and live webhook endpoints have different signing secrets.

Stripe test Products and Prices cannot be used in live mode. After changing the
credentials, open each paid add-on in Admin and save it once. Aoupa detects that
the stored test catalog objects are unavailable to the live account, creates a
new one-time USD Product and Price in live mode, and stores the new IDs before
checkout is enabled for that item. Donations use inline live-mode price data and
do not require this per-product catalog sync.

## 9. Test donations for free add-ons

Published free add-ons display an optional one-time Donate panel with USD 3, 5,
10, and 20 presets plus a custom amount. The API, database constraint, and
Stripe Checkout all enforce a minimum of USD 3. Donations can be completed by a
guest or signed-in customer and never create product entitlements.

Complete a test donation with Stripe's test card and confirm it appears under
`/admin/donations` as `paid`. The same signed webhook endpoint and payment
events used for paid add-ons process donations.

## 10. Quality checks

```bash
npm ci
npm run typecheck
npm test
npm run build:node
npm run build:sites
docker compose config --no-env-resolution --quiet
```

Run the checks before rebuilding the production container. `build:node` creates the standalone Docker runtime; `build:sites` prepares the OpenNext Sites artifact.
