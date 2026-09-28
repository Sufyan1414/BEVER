# BEVER — Development Rules

These rules are non-negotiable. Every developer working on BEVER must read and follow this document before writing a single line of code.

---

## 1. Architecture Rules

### 1.1 — One Backend, One Database
There is one Supabase project. There is one PostgreSQL database. All apps (customer, merchant, rider, admin, WhatsApp) use the same backend. Do not create separate databases, shadow tables, or duplicate data sources.

### 1.2 — Database Is the Source of Truth
The database state is always correct. Realtime subscriptions, push notifications, and local app state are conveniences — not the source of truth. Apps must fetch from the server when in doubt. Never trust stale local state.

### 1.3 — Never Invent Order States
The only valid order states are defined in `ORDER_STATE_MACHINE.md`. Do not add new states without updating that document and the database enum. Do not use strings like `"processing"`, `"on_way"`, etc. in any app code.

### 1.4 — Never Expose the Service-Role Key
The Supabase service-role key bypasses all Row Level Security. It must NEVER appear in any mobile app, any client-side code, any `.env` file committed to git, or any public-facing service. It lives only in the Admin web backend (server-side) and secure Supabase Edge Functions.

### 1.5 — Row Level Security on Every Table
Every table in the database must have RLS enabled. No table is openly readable or writable without explicit policy. If you create a new table and do not add RLS policies, you have introduced a security vulnerability.

---

## 2. Technology Rules

### 2.1 — Tech Stack Is Fixed
Do not introduce new technologies, libraries, or frameworks without explicit approval. The approved stack is:

| Layer | Technology |
|---|---|
| Mobile apps | React Native, Expo, TypeScript, NativeWind, Zustand |
| Admin web | React, TypeScript, Tailwind CSS |
| Backend | Supabase (PostgreSQL + PostGIS + Auth + Realtime + Storage) |
| Push notifications | Firebase Cloud Messaging |
| Maps | OpenStreetMap-based (react-native-maps with OSM tiles, Leaflet.js for web) |
| Payments (v1) | COD and UPI only |

### 2.2 — No Paid APIs Without Approval
Do not introduce any paid API, paid SDK, or paid cloud service without explicit written approval from the founder. This includes (but is not limited to): Google Maps, Twilio, SendGrid, Stripe, Razorpay, AWS, GCP services, any AI/LLM API.

### 2.3 — No AI at Runtime Without Approval
Do not call any AI or LLM API at runtime (e.g. OpenAI, Gemini, Claude) without explicit approval. AI may be used as a development tool, but not as a runtime dependency.

### 2.4 — No Google Maps
Use OpenStreetMap-based solutions only. Do not use the Google Maps SDK, Google Maps JavaScript API, Google Places API, or any Google-proprietary mapping product.

---

## 3. Code Quality Rules

### 3.1 — TypeScript Everywhere
All code must be written in TypeScript. `any` types are not allowed. All data types must be properly defined using shared type definitions from `packages/shared/`.

### 3.2 — Shared Types Are the Contract
All database entity types (Order, Product, Store, Profile, etc.) are defined once in `packages/shared/src/types/`. All apps import from there. Do not redefine types locally in individual apps.

### 3.3 — No Silent Failures
Every network request, database operation, or state mutation must handle:
- Loading state (show skeleton/spinner)
- Success state (update UI)
- Error state (show a user-friendly message)
- Retry logic where appropriate (e.g. network timeout)

Never swallow errors silently. Always `console.error()` at minimum, and show appropriate UI feedback.

### 3.4 — Server Validation Is Mandatory
Do not rely on client-side validation alone. Every important write operation (place order, update status, etc.) must be validated on the server (database constraint, RLS policy, or Supabase Edge Function). Client-side validation is for UX only.

---

## 4. Security Rules

### 4.1 — No Secrets in Code or Git
Never commit any of the following to git:
- Supabase URL (use environment variables)
- Supabase anon key (use environment variables — note: anon key is safe to use in apps but must still be in env vars)
- Supabase service-role key (NEVER in any app)
- Firebase config keys (use environment variables)
- Any other API key or secret

Use `.env.local` files (never committed) and `.env.example` files (committed, with no real values).

### 4.2 — RLS Policies Must Match App Permissions
Before every release, verify that RLS policies exactly match what each app role is permitted to do. There must be no accidental over-permissioning.

### 4.3 — Customer Personal Data Is Private
A customer's full name, phone number, and delivery address must never be readable by the merchant app or rider app except:
- Merchant: receives only the first name and order details (no full address)
- Rider: receives the delivery address only for their currently active assignment, only after RIDER_ASSIGNED state

---

## 5. Performance Rules

### 5.1 — Paginate All Lists
No endpoint or query fetches an entire table. All list queries must use `limit` and `offset` (or cursor-based pagination). Default page size: 20 items.

### 5.2 — Narrow Realtime Subscriptions
Subscribe to Realtime only for data you need right now. Do not subscribe to entire tables. Example: subscribe to `orders?id=eq.${orderId}` for a specific order, not the entire `orders` table.

### 5.3 — Compress and Resize Images
All images must be compressed before upload. Product images must not exceed 800×800px. Store banners must not exceed 1200×400px. Use appropriate compression.

### 5.4 — No Heavy Animations
Do not use heavy CSS animations, complex transitions, or large animated assets. Skeleton loading screens are preferred over full-screen spinners.

### 5.5 — Indexes on All Frequently Queried Columns
Every column used in WHERE clauses, ORDER BY, or JOINs in hot queries must have a database index. Key columns: `orders.status`, `orders.customer_id`, `orders.store_id`, `products.store_id`, `delivery_assignments.rider_id`.

---

## 6. Development Workflow Rules

### 6.1 — Monorepo Structure Must Be Respected
All apps live in `apps/`. All shared code lives in `packages/`. Do not duplicate code between apps. If two apps need the same utility, it goes in `packages/shared/`.

### 6.2 — No Fake Data in Production
Do not seed fake orders, fake products, or fake users into a production environment. Seeding scripts are for development/testing only.

### 6.3 — Document Every Schema Change
Every change to the database schema must be documented as a migration file in `packages/supabase/migrations/`. Migrations must be numbered sequentially and descriptively named.

### 6.4 — Never Run Migrations Manually
Database changes must be applied via the Supabase migration system. Do not make ad-hoc changes via the Supabase Studio dashboard that are not also saved as migration files.

### 6.5 — Feature Scope Is Founder-Approved
Do not add features not in the current sprint specification. Do not add "nice to have" features speculatively. Every feature must be explicitly requested or approved.

---

## 7. The One-Store-Per-Order Rule

At launch, a customer's cart can only contain products from **one store**. If a customer adds a product from a different store, the app must prompt them to clear the current cart first.

Do not implement multi-vendor carts. Do not build it as a "hidden option". This is a deliberate business and technical constraint.

---

## 8. Free-First Infrastructure

At all times, prefer the free tier of any service. Do not provision paid infrastructure speculatively. The platform must be capable of running at zero infrastructure cost during development and low-volume early operation.

Current free tier limits to respect:
- Supabase Free: 500MB database, 1GB storage, 50,000 MAUs — monitor and flag before hitting limits
- Firebase FCM: Free for all push notifications
- Expo: Free for builds (with limits) and OTA updates (with limits)

---

## Quick Reference: What You Must NEVER Do

| ❌ Never Do This |
|---|
| Expose Supabase service-role key in any app |
| Create a table without RLS |
| Use an order state not in ORDER_STATE_MACHINE.md |
| Call a paid API without approval |
| Use Google Maps |
| Commit secrets or API keys to git |
| Fetch an entire table without pagination |
| Subscribe to an entire Realtime table |
| Add unrequested features |
| Make schema changes without migration files |
| Trust client-side state over server state |
| Silently swallow errors |
