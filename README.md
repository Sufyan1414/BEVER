# BEVER — Hyperlocal Marketplace & Delivery Platform

BEVER connects customers with local businesses through a fast, reliable hyperlocal delivery experience.

---

## What is BEVER?

BEVER is a platform for local businesses to sell products and get them delivered to nearby customers. Think of it like a local version of quick-commerce — but built specifically for independent merchants in your area.

---

## The Five Parts of BEVER

| Part | Who Uses It | Technology |
|---|---|---|
| Customer App | People ordering products | React Native + Expo |
| Merchant App | Shop owners | React Native + Expo |
| Rider App | Delivery partners | React Native + Expo |
| Admin Dashboard | BEVER team | React (web) |
| WhatsApp Bot | Customers via WhatsApp | Connects to same backend |

**All five parts share one backend and one database.** There is no separate system for each app. Every order, customer, merchant, and delivery record lives in one place.

---

## The Backend

BEVER uses **Supabase** as its backend. Supabase is a free, open-source platform that provides:

- **PostgreSQL database** — stores all data (orders, products, users, stores)
- **Supabase Auth** — handles login and user accounts securely
- **Supabase Realtime** — pushes live updates to apps (e.g. order status changes)
- **Supabase Storage** — stores images (product photos, store banners)
- **PostGIS** — a database extension for location/map queries (find nearby stores)

---

## How Notifications Work

BEVER uses **Firebase Cloud Messaging (FCM)** — Google's free push notification service — to send alerts to mobile apps:

- Merchant gets notified when a new order arrives
- Rider gets notified when a delivery is assigned
- Customer gets notified when their order status changes

> **Important:** Push notifications are delivery mechanisms only. If a notification is missed or delayed, the app fetches the latest order state directly from the database. The database is always the source of truth.

---

## Maps

BEVER uses **OpenStreetMap**-based mapping — a free, open-source alternative to Google Maps. No paid map APIs are used.

---

## Payments (First Version)

- **COD** — Cash on Delivery
- **UPI** — Direct bank transfer via UPI

No complex payment gateway is integrated at this stage.

---

## Monorepo Structure

This project is a **monorepo** — all parts of BEVER live in one code repository. This makes it easy to share code, maintain consistency, and avoid duplication.

```
bever/
├── apps/
│   ├── customer/        ← Customer mobile app
│   ├── merchant/        ← Merchant mobile app
│   ├── rider/           ← Rider mobile app
│   └── admin/           ← Admin web dashboard
├── packages/
│   ├── shared/          ← Shared TypeScript types, constants, utilities
│   └── supabase/        ← Database configuration, migrations, RLS policies
└── docs/                ← Architecture and design documents
```

---

## Key Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System boundaries and data flow
- [ORDER_STATE_MACHINE.md](./ORDER_STATE_MACHINE.md) — How orders move through the system
- [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) — Rules every developer must follow

---

## Getting Started (Developers)

See [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) for setup instructions and non-negotiable rules before contributing to this project.
