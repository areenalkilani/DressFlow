# DressFlow

نظام حجز وتأجير البدلات والفساتين

Arabic RTL, multi-tenant rental management built with Next.js App Router, TypeScript, Tailwind CSS and Supabase. This is an internal shop system. There is no public registration, demo database or localStorage persistence.

## Requirements

- Node.js **22.x** (the installed Supabase SDK requires Node 22+).
- A Supabase project and a Vercel account for deployment.
- Passwords of at least 12 characters for accounts provisioned by this application.

## 1. Install and configure

```sh
npm install
```

Copy `.env.example` to `.env.local` and supply:

| Variable                        | Value                                                     | Visibility                       |
| ------------------------------- | --------------------------------------------------------- | -------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project URL from Supabase Project Settings → API          | Public                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project's legacy `anon` key, or publishable key           | Public, protected by RLS         |
| `SUPABASE_SERVICE_ROLE_KEY`     | Project's legacy `service_role` key, or server secret key | Server only                      |
| `SUPER_ADMIN_PASSWORD`          | A strong initial password you choose                      | Bootstrap only; remove afterward |

Do not put a service-role/secret key in a `NEXT_PUBLIC_` variable. Environment files are ignored by Git. Without configuration, the application displays an Arabic setup screen and does not fabricate operational data.

## 2. Apply database migrations

In Supabase's SQL Editor, run each file in `supabase/migrations` in filename order **once**, in a new project:

1. `202609170001_core.sql`
2. `202609170002_workflows.sql`
3. `202609170003_settings_admin.sql`
4. `202609170004_integrity.sql`
5. `202609180005_self_service_settings.sql`

For an existing project with migrations 001–004 already applied, run only 005. See [account settings and installation](docs/ACCOUNT-AND-INSTALL.md) for email confirmation and PWA setup.

Alternatively, use the Supabase CLI: initialize/link this repository to your project, then run `supabase db push`. The SQL Editor route requires no local Docker installation. The migrations create all tables, functions, indexes, defaults, RLS policies, and the private `rental-images` storage bucket. Do not seed operational data manually.

Set the API exposed schema to `public`; leave `auth` and `storage` managed by Supabase. Keep RLS enabled. Do not grant direct writes on booking, payment, membership or profile tables to authenticated clients: the workflow functions intentionally own those writes.

## 3. Configure Supabase Auth

In Authentication settings:

- **Disable “Allow new users to sign up.”** Hiding registration in the UI alone is insufficient.
- Enable the **Email** provider for both shop accounts and the Super Admin. All accounts sign in with a real email address and password managed by Supabase Auth.
- Phone numbers remain contact information. The Phone provider and Twilio are not required.
- Set Site URL to the production HTTPS URL. Add your localhost URL and controlled deployment URLs to the redirect allowlist if using recovery links through the Supabase dashboard.
- Configure Auth rate limits and strong password requirements. The application never logs passwords.

The Super Admin verifies email ownership out-of-band before creating/changing an account. Server-side `auth.admin.createUser({email, password, email_confirm: true})` provisions it; `signInWithPassword({email,password})` signs it in. There is no synthetic email workaround or password table. Email is stored in Supabase Auth and shown only through the authorized admin page. Existing phone-only users can be edited to add an email to the same Auth user; their UUID, tenant membership, password and operational records remain unchanged. No SQL migration is required for this switch.

**SMS and recovery:** this version uses administrator-assisted password recovery. The Super Admin verifies ownership and sets a new password in the account editor; no SMS provider is required for that workflow. If you enable SMS verification/OTP, configure a supported SMS provider in Supabase Phone settings (provider credentials, sender number/messaging service, regional delivery permissions, and message templates), configure provider billing, and test real delivery. Do not enable an OTP-based flow without that setup. Super Admin recovery can use Supabase Auth's administrative controls; configure custom SMTP before relying on email recovery delivery. No unconfigured OTP or recovery buttons are shown.

Official references: [phone/password authentication](https://supabase.com/docs/guides/auth/passwords), [server-side auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [admin user creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

## 4. Bootstrap the Super Admin

```sh
npm run bootstrap
```

This creates `areen.alkilani@hotmail.com` using the supplied password, then inserts its restricted `super_admin` profile. It compensates by deleting the new Auth user if profile insertion fails. It does not replace an existing admin or reset an existing password. Remove `SUPER_ADMIN_PASSWORD` from `.env.local` after success, and do not add it to Vercel.

Open `/login`, choose **دخول مدير النظام**, sign in, and create a shop with its email, contact phone and password. Each shop receives three default categories and settings automatically. The shop owner signs in with email and password. For an existing phone-only shop, edit its account and supply a real email before attempting email login.

## 5. Run and deploy

```sh
npm run dev
npm run typecheck
npm test
npm run test:db
npm run build
npm start
```

On Windows with only Node 20 installed, this repository includes a development-local Node 22 binary under `node_modules/node/bin/node.exe`. Prefer installing Node 22 normally for consistent terminal and hosting behavior.

On Vercel, import the repository, select the Next.js preset and **Node 22.x**, set the three Supabase variables for the intended environment, and deploy. No VPS, custom persistent server, local image directory or background worker is required. Use separate Supabase projects for preview and production when preview users must not access production data.

## Business behavior

- Customer, booking and availability forms use one **العنوان** field. It is stored in the existing locality field so the current database and warning RPCs continue to work; legacy city values are retained. Address warnings compare the entered address text, so consistent spelling is recommended.
- Every inventory card includes **مين استأجرها؟** with customer names, addresses, rental dates, item status and links to bookings. The history highlights addresses shared by different brides in noncancelled bookings.
- Offer creation separates discount type, eligible inventory and event-date validity, with a summary and explicit target selection. Monetary inputs hide stepper arrows and ignore arrow-key and mouse-wheel increments while retaining decimal validation.

- One booking is one agreement with multiple physical items and booking-level payments. Customer identity is reused by phone within a shop; each agreement also snapshots customer details.
- The inclusive blocked range defaults to event date −2 through event date +2. PostgreSQL's GiST exclusion constraint prevents overlapping active reservations even under concurrent inserts. Inventory rows are locked in deterministic order while saving. Manual rental/delivery/return dates must remain consistent.
- Returned items remain blocked until cleaning completes. An unreturned or unready physical item cannot be delivered to a second customer. Each item transitions independently. Once all items finish cleaning, the agreement becomes completed.
- Same-town bride checks are warnings only. They consider noncancelled historical bookings and are independently configurable.
- Offers are evaluated against the **event date**. The single best qualifying offer applies; offers do not stack. A bundle with explicit dress targets requires every specified dress. Category targets accept qualifying category items once the minimum quantity is met. A bundle prices all eligible selected items as one package; it is not repeatedly applied in groups.
- Each item stores original price, its manually selected price, allocated offer price and offer name. Allocation rounds down to cents and assigns the remainder to the highest-priced eligible item. The booking stores offer snapshots, subtotal, automatic discount, calculated total and negotiated total. A negotiated booking total need not be allocated to items.
- Changing inventory prices or offers leaves existing bookings unchanged. **Explicitly editing an active, undelivered agreement recalculates it using current prices/offers**, with a visible warning. Delivered agreements cannot have items removed or dates rewritten.
- Payments are append-only and cannot exceed the agreed total. The balance is always calculated from the payment ledger. These are records of cash/external payments, not a card-processing gateway. Cancelled agreements retain payments for audit; physical cash refunds are settled by the shop, and a refund accounting module is not included.
- A fitting is automatically suggested for brides only. Default time is noon in the tenant timezone. Manual datetime fields explicitly use the operator device's timezone; saved timestamps are UTC and displayed in the store timezone.
- Due and late statuses derive from dates. Notifications are generated idempotently on every authenticated workspace load and refreshed each minute while visible. A shop does not have to open a particular booking. No email/SMS/push delivery is implied. For processing while all browsers are closed, schedule the same tenant-scoped logic through a separate audited Supabase job; no insecure service-role HTTP cron endpoint is exposed.
- Inventory/category/customer deletion is blocked by foreign keys when referenced. Hide items/categories or deactivate offers to preserve history. Tenant-owned images are private and served using one-hour signed URLs after authentication.
- Login email and contact phone changes are restricted to the Super Admin. Password changes require the current password and authenticate using the account email. Failed administrative identity changes leave a shop disabled, preventing partial changes from exposing data; correct the issue and save again to reactivate.

## Architecture and security

- `src/app/actions.ts`: validated server actions and server-side authorization. Operational operations use the user's RLS-scoped client. The service-role client is isolated in a `server-only` module and used for administrative account provisioning only.
- `src/lib/data.ts`: authenticated queries with pagination beyond Supabase's default result cap. The first version loads a shop's operational workspace into memory for fast local filtering. Large multi-year inventories may benefit from route-level server pagination in a later version.
- `src/proxy.ts`: SSR session refresh. Server authorization verifies the Auth user and database membership, rather than trusting cookie payloads.
- `supabase/migrations`: normalized tables, composite tenant foreign keys, storage policies, transaction functions and constraints.
- `src/components`: Arabic RTL responsive workspace, accessible dialogs, forms, status views, printable booking files, and calendar/list views.

Super Admin access does not grant operational tenant reads through normal RLS. Database policies consult current membership and tenant status, so disabling an account blocks existing sessions immediately. Profile roles and membership cannot be changed by normal clients. Notification read state is shared by a shop because this version provisions one shop owner per tenant.

## Verification boundaries

`npm run test:db` executes the actual SQL migrations in PGlite (a local PostgreSQL engine), with platform-shaped Auth and Storage schemas. It tests booking rules, constraints, pricing snapshots, lifecycle, payments, RLS, disabled accounts and storage folder policies. It does not simulate real SMS delivery, the GoTrue service, hosted Storage uploads, network concurrency or Vercel infrastructure.

`npm run test:browser` verifies the real unconfigured application and a **test-only**, isolated component harness. The harness is under `tests/`, has no application route, does not ship demo accounts, and cannot persist operational data. It verifies RTL, responsive layout, navigation, dialogs and empty states. Use the connected smoke checklist in `docs/ACCEPTANCE.md` after supplying real Supabase credentials. Do not describe hosted authentication or storage as verified until that checklist has been run.
