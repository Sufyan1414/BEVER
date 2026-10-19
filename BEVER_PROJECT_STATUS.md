# BEVER — Development Continuation Status

Updated: 2026-10-08

## Repository
- GitHub: Sufyan1414/BEVER
- Branch: upgrade/sdk-57
- Product: BEVER hyperlocal local-business marketplace
- Pilot geography: Chhatrapati Sambhajinagar / Aurangabad, Maharashtra
- Source of truth: repository + Supabase live state

## Google-build reconciliation
The Google-build commit reviewed was `76f7029c6b613f600543a76aa48349262ffbc363`, exactly one commit after the previous continuation checkpoint.

It changed only:
- Admin demo-mode/configuration behavior.
- Admin environment/configuration files.
- Admin CSS/TypeScript/Vite metadata.
- Root environment example consolidation.
- Removed the workspace package-lock.

Decision:
- **Do not use Google demo-mode behavior as the production BEVER admin source of truth.**
- The Admin app has been restored to the previous Supabase-backed authentication and live operational queries.
- Admin fallback behavior that could silently mutate local state after a live RPC failure has therefore been removed.
- Per-app `.env.example` templates were restored.
- `package-lock.json` was restored for reproducible workspace installs.
- Useful CSS/tooling/configuration improvements from the Google pass remain where they do not alter the production data contract.
- No customer/merchant/rider/Supabase order architecture from the earlier BEVER foundation was replaced.

## Current product principles
- Premium, distinctive UI/UX is a first-class requirement.
- Do not copy Blinkit/Zepto; use their usability as a benchmark.
- Grocery UI Kit reference is the strongest visual inspiration.
- Preserve real functionality; never ship fake/unwired UI.
- Guests can browse and build carts; authentication is required at checkout.
- COD is currently the only supported payment method.
- Orders under ₹199 pay delivery; ₹199+ free delivery.
- Pilot delivery calculation: ₹20 + ₹7 per started km under ₹199.
- No GPS/map/pin flow for location selection: search/select area/address, then delivery details.

## Functional foundation already implemented
- Customer cart → checkout → real server-verified order.
- Secure create_customer_order RPC; direct order inserts blocked.
- Merchant order lifecycle and product availability.
- Rider assignment/accept/arrival/pickup/out-for-delivery/delivery-failed.
- OTP + COD collection for delivery completion.
- Admin rider assignment and operational order controls.
- Realtime listeners with fallback refresh.
- Delivery failure reason persisted and surfaced to customers.
- Temporary BEVER Test Store exists for Chhatrapati Sambhajinagar testing.

## Current audit findings
### High priority
- Customer search is still a placeholder and needs a real store/product search flow.
- Merchant test identity is blocked: the temporary test store is linked to the existing customer profile and must not have its role changed just for testing.
- Runtime verification is still required after the Google-build period.

### Medium priority
- Admin visual polish is still behind the customer direction.
- Google demo mode should only be reintroduced later as an explicitly opt-in development mode, never as an automatic production fallback.

### Low priority
- Figma MCP design writes remain blocked by the Starter-plan tool-call limit; direct code design remains the active path.

## Next large build batches
1. Customer Home: hierarchy, store cards, category browsing, states, real search entry.
2. Store/product experience: premium catalogue, quantity controls, sticky cart affordance.
3. Cart + Checkout: confidence, price breakdown, delivery threshold, COD, address.
4. Orders: tracking hierarchy, delivery OTP, failure/refund states.
5. Auth/profile/location: frictionless first-time journey.
6. Merchant app visual system + operational dashboard.
7. Rider app visual system + delivery workflow.
8. Admin operational console polish.
9. Performance/accessibility/runtime verification.
10. Final end-to-end pilot audit.

## Do not break
- Server-side order pricing and validation.
- RLS/security-definer RPC boundaries.
- Customer browsing location must remain separate from checkout address.
- Test store merchant account must NOT be changed from the existing customer role merely to test merchant UI.
- Do not remove the test store until core customer/order verification is complete.
- Supabase remains the BEVER production backend.
- Apper is auxiliary tooling/preview infrastructure, not a replacement backend.

## Working rule
Make large coherent changes, verify them, commit them, and keep this document updated so a fresh chat can resume without reconstructing the project from conversation history.

## Continuation update — 2026-10-19

### Active customer journey work
- Active branch: `feature/customer-store-search`, based on `upgrade/sdk-57`.
- Open PR: https://github.com/Sufyan1414/BEVER/pull/1 (not merged).
- Home search now filters real nearby stores by name, category, description, and address.
- Store catalogue search filters the selected store's real products by name, description, and unit/pack label, while retaining category filters.
- Checkout now shows a line-by-line item review and prevents duplicate rapid submissions.
- Persisted cart restore validates item identity, price/quantity shape, and single-store consistency.
- Fixed a malformed statement separator in `OrderDetailScreen.tsx` found during source review.
- These changes have not been run through TypeScript, Metro, SQL integration, or device tests. GitHub reported no workflow runs for the latest feature commit.

### Live Supabase checks — read-only
- Confirmed project `atuaafowdoijojdmtgcr` is the active BEVER project in ap-south-1.
- Production migration history currently ends at `20261006113359`.
- Production exposes `public.create_customer_order(p_store_id uuid, p_delivery_address_id uuid, p_items jsonb, p_payment_method payment_method, p_special_instructions text)`; its returned columns match the customer service's current legacy RPC call.
- The live function verifies auth, store active/verified/open state, address ownership and location, delivery radius, product availability, COD, minimum order, and server-side prices before creating order rows.
- **Unit ambiguity to resolve before changing minimum-order data:** the client/store type comments describe `minimum_order_amount` as paise, but the live RPC compares subtotal against `minimum_order_amount * 100`, treating the stored value as rupees. Do not alter existing data or RPC until current store values and intended units are confirmed.
- Supabase's advisor flags `public.spatial_ref_sys` as having RLS disabled. This is a PostGIS reference-system table; do not blindly enable RLS without checking extension ownership and intended exposure, because doing so without appropriate policies can break spatial operations. Review and remediate deliberately.

### Next release gates
1. Install the exact workspace dependencies and run TypeScript checks for customer, merchant, rider, admin, and shared packages.
2. Fix compile/runtime issues found; export Android bundles and test on a real Android device. iOS should also receive a smoke test if available.
3. Confirm minimum-order unit conventions from real store rows and migration history.
4. Verify order create, cancellation, order detail, delivery OTP, and merchant/rider state transitions end-to-end against a disposable database or safely isolated environment.
5. Re-check RLS, function grants/search paths, and Supabase security advisors; never apply speculative production migrations.
6. Only then mark MVP launch-ready.
