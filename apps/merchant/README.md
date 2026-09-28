# Merchant App — BEVER

**Status: Not yet built. Package scaffold only.**

This is the BEVER merchant-facing mobile app.

## Tech Stack
- React Native, Expo, TypeScript, NativeWind, Zustand, Supabase JS SDK

## Features (planned for first build)
- Login as merchant
- Dashboard: live incoming orders
- Accept or reject orders with optional rejection reason
- Mark order as Preparing → Ready for Pickup
- Product management: list, toggle available/unavailable
- Store open/close toggle
- Push notifications for new orders

## Rules
- All types from `@bever/shared`
- Only permitted order status transitions (enforced by database anyway)
- Subscribe only to your own store's order stream via Realtime
- Read DEVELOPMENT_RULES.md before making any changes
