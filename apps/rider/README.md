# Rider App — BEVER

**Status: Not yet built. Package scaffold only.**

This is the BEVER rider-facing mobile app.

## Tech Stack
- React Native, Expo, TypeScript, NativeWind, Zustand, Supabase JS SDK, react-native-maps (OpenStreetMap tiles)

## Features (planned for first build)
- Login as rider
- Dashboard: active assignment
- Receive delivery assignment notification
- View pickup location (store)
- Navigate to store externally (opens OS maps app)
- Mark arrived at store
- Mark picked up
- View customer delivery address
- Navigate to customer externally
- Complete delivery with OTP confirmation
- Record COD collection

## Rules
- Maps use OpenStreetMap tiles only — no Google Maps
- All types from `@bever/shared`
- Subscribe only to your own assignment via Realtime
- Read DEVELOPMENT_RULES.md before making any changes
