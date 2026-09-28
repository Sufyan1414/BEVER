# Admin Dashboard — BEVER

**Status: Not yet built. Package scaffold only.**

This is the BEVER internal admin web dashboard.

## Tech Stack
- React, TypeScript, Tailwind CSS, Vite, Supabase JS SDK

## Features (planned)
- Live order management
- Customer management
- Merchant and store management
- Rider management
- Delivery assignment
- Payments and refunds
- Support and issue tracking
- Basic reports

## Critical Security Note
The admin dashboard has elevated data access. It must be:
- Deployed to a restricted URL or behind authentication
- Never embedded in any mobile app
- The `SUPABASE_SERVICE_ROLE_KEY` must NEVER be in client-side browser code — only in server-side admin functions

## Rules
- All types from `@bever/shared`
- Read DEVELOPMENT_RULES.md before making any changes
