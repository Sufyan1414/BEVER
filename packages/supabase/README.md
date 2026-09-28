# @bever/supabase — Database Configuration

This package contains all database configuration for BEVER:
- SQL migrations (schema, RLS policies, triggers)
- Supabase CLI configuration
- Generated TypeScript types (after running `yarn types:generate`)

## Directory Structure

```
packages/supabase/
├── migrations/
│   ├── 001_initial_schema.sql     ← Tables, enums, indexes
│   ├── 002_rls_policies.sql       ← Row Level Security policies
│   └── 003_order_state_machine.sql ← Triggers enforcing the state machine
├── src/
│   └── database.types.ts          ← Auto-generated (run yarn types:generate)
├── .supabase/
│   └── config.toml                ← Supabase CLI project config
└── package.json
```

## Before You Start

You need:
1. A Supabase account (free) — https://supabase.com
2. Supabase CLI installed — https://supabase.com/docs/guides/cli

## Setup Steps

1. Create a new project at https://supabase.com
2. Update `.supabase/config.toml` with your project ID
3. Run migrations: `yarn db:push`
4. Generate TypeScript types: `yarn types:generate`

## Rules

- Never modify a migration file that has already been applied to production.
- Always create a new numbered migration file for schema changes.
- Always test migrations locally with `yarn db:reset` before pushing.
