# BEVER — Architecture Overview

This document describes the system boundaries, data ownership, and how the five parts of BEVER interact.

---

## Core Principle: One Backend, One Source of Truth

```
┌─────────────────────────────────────────────────────────────────┐
│                        BEVER BACKEND                            │
│                                                                 │
│   ┌─────────────┐    ┌────────────────┐   ┌─────────────────┐  │
│   │  PostgreSQL  │    │  Supabase Auth │   │ Supabase Storage│  │
│   │  + PostGIS   │    │  (All Users)   │   │ (Images/Files)  │  │
│   └─────────────┘    └────────────────┘   └─────────────────┘  │
│                                                                 │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │            Supabase Realtime                             │  │
│   │   (Live order updates, store status, assignments)        │  │
│   └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
           │              │              │              │
           ▼              ▼              ▼              ▼
    Customer App   Merchant App    Rider App     Admin Web
    (React Native) (React Native) (React Native)  (React)
           │
           ▼
    WhatsApp Bot
    (Same backend)
```

All five client applications read from and write to the **same Supabase database**. There is no separate database, no secondary API layer, and no data duplication between apps.

---

## System Boundaries

### Customer App
- **Can read:** its own profile, public store listings, public product listings, its own orders, its own addresses
- **Can write:** its own profile, its own orders (place/cancel), its own addresses, its own cart (local state only)
- **Cannot access:** other customers' data, merchant-only data, rider-only data, admin data

### Merchant App
- **Can read:** its own store(s), its own products, orders assigned to its store(s), rider assignments for those orders
- **Can write:** its own store open/closed status, its own product availability, order status transitions it is permitted to make (MERCHANT_ACCEPTED, PREPARING, READY_FOR_PICKUP, REJECTED)
- **Cannot access:** other merchants' data, customer personal data beyond what is needed for delivery, rider personal data

### Rider App
- **Can read:** delivery assignments assigned to it, pickup location (store address), delivery location (customer address for active assignment only)
- **Can write:** order status transitions it is permitted to make (RIDER_AT_STORE, PICKED_UP, OUT_FOR_DELIVERY, DELIVERED, DELIVERY_FAILED), COD collection confirmation
- **Cannot access:** other riders' assignments, merchant internal data, customer order history

### Admin Web
- **Can read:** all orders, all customers (summary), all merchants, all stores, all riders, all assignments, all payments, reports
- **Can write:** all data via service-role access — used only for administrative operations
- **Must run in a secured environment.** The service-role key must NEVER appear in mobile apps or public-facing code.

### WhatsApp Bot
- Operates via a backend service (Supabase Edge Function or a lightweight server)
- Uses the same database as all other apps
- Authenticated as a system service — never as a customer directly
- Creates orders on behalf of customers using verified WhatsApp identity

---

## Authentication Model

BEVER uses **Supabase Auth** for all user types. Each user has a single auth account but a specific role:

| Role | Description |
|---|---|
| `customer` | Registered customers |
| `merchant` | Business owners |
| `rider` | Delivery partners |
| `admin` | BEVER platform team |

Role is stored in a `profiles` table and enforced via **Row Level Security (RLS)** policies at the database level. Apps receive a JWT token after login. Every database request is validated against RLS policies using that token.

---

## Row Level Security (RLS)

Every table in the database has RLS enabled. No table is publicly writable without authentication. Key policy principles:

- A customer can only SELECT/UPDATE their own row in `profiles`, `orders`, `addresses`
- A merchant can only SELECT/UPDATE rows linked to their `store_id`
- A rider can only SELECT rows where `rider_id = auth.uid()`
- Order status can only be changed to permitted next states (enforced via database functions/triggers)
- The service-role key bypasses RLS — it is used ONLY by the Admin web and backend functions, NEVER in mobile apps

---

## Data Flow: Placing an Order

```
Customer App
  │
  ├─ 1. Customer taps "Place Order"
  │
  ├─ 2. App sends INSERT to orders table (status = PENDING)
  │       └── Supabase RLS validates customer is authenticated
  │
  ├─ 3. Supabase Realtime broadcasts new order to Merchant App
  │       └── FCM push notification also sent via Supabase Function
  │
  ├─ 4. Merchant accepts → UPDATE orders SET status = MERCHANT_ACCEPTED
  │       └── Supabase Realtime broadcasts to Customer App
  │
  ├─ 5. (Order progresses through state machine — see ORDER_STATE_MACHINE.md)
  │
  └─ 6. Rider marks DELIVERED → Customer sees final status
```

At every step, the **database record is the truth**. If the Customer App misses a Realtime event, it fetches the current order status on app foreground/resume.

---

## Notification Architecture

```
Supabase Database Trigger / Edge Function
          │
          ▼
  Firebase Admin SDK (server-side only)
          │
          ▼
  Firebase Cloud Messaging
          │
     ┌────┴────┐
     ▼         ▼
Customer    Merchant    Rider
  App         App       App
```

Push notifications are sent via a **Supabase Edge Function** (or database trigger) that calls Firebase Admin SDK. The FCM token for each user is stored in the `profiles` table and updated on each app launch.

**FCM tokens must never be used by one user to send notifications to another user directly.**

---

## Maps & Location

- Store locations are stored as PostGIS `GEOMETRY(Point)` in the database
- Customer delivery addresses are stored as `GEOMETRY(Point)` + human-readable text
- Nearby store queries use PostGIS `ST_DWithin` for radius searches
- Maps displayed in apps use **Leaflet.js** (admin web) and **react-native-maps** with OpenStreetMap tiles (mobile apps)
- No Google Maps API. No paid tile service.

---

## Image Storage

- Product images, store banners, and user avatars are stored in **Supabase Storage**
- Images are served via Supabase's built-in CDN
- All images must be compressed before upload (handled in app)
- Supabase Storage bucket policies enforce: customers upload only their own avatars; merchants upload only their own store/product images

---

## Performance Constraints

BEVER is designed for:
- Low-end Android devices (2GB RAM, older processors)
- Slow 3G/4G Indian mobile networks

This means:
- All lists are paginated (no loading entire tables)
- Images are resized and compressed
- Realtime subscriptions are narrow and specific (subscribe only to your own orders, not entire tables)
- No heavy animations or large bundles
- Skeleton screens on loading, not full-screen spinners

---

## What Is NOT in This Architecture

- No Redis, Kafka, RabbitMQ, or message queues (not needed at this scale)
- No separate microservices (one Supabase project handles everything)
- No AI/ML features at runtime (not approved yet)
- No Google Maps (OpenStreetMap only)
- No complex payment gateway (COD + UPI only for first version)
- No multi-vendor cart (one shop per order)
