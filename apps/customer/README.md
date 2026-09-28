# Customer App — BEVER

**Status: Not yet built. Package scaffold only.**

This is the BEVER customer-facing mobile app.

## Tech Stack
- React Native
- Expo (with Expo Router for navigation)
- TypeScript
- NativeWind (Tailwind CSS for React Native)
- Zustand (state management)
- Supabase JS SDK
- react-native-maps (with OpenStreetMap tiles — NOT Google Maps)

## Features (planned for first build)
- Browse stores without login
- Search stores and products
- View store and product pages
- Add to cart (one store at a time)
- Checkout with address selection
- COD / UPI payment selection
- Place order
- Track order status in real time
- Receive push notifications
- View order history
- Reorder

## Setup
1. Copy `.env.example` to `.env.local` and fill in Supabase credentials
2. Add `google-services.json` (from Firebase Console) for push notifications
3. Run `yarn install` from the repo root
4. Run `yarn customer` from the repo root, or `yarn start` from this directory

## Rules
- All types must be imported from `@bever/shared`
- Never use order status strings directly — use the `OrderStatus` type
- Never subscribe to entire Realtime tables
- All lists must be paginated
- Read DEVELOPMENT_RULES.md before making any changes
