# BEVER — Development Continuation Status

Updated: 2026-10-07

## Repository
- GitHub: Sufyan1414/BEVER
- Branch: upgrade/sdk-57
- Product: BEVER hyperlocal local-business marketplace
- Pilot geography: Chhatrapati Sambhajinagar / Aurangabad, Maharashtra
- Source of truth: repository + Supabase live state

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

## Current design pass
Implemented directly in customer app code:
- New BEVER warm-neutral visual foundation.
- Coral primary accent (#FF5A36) instead of generic amber/yellow.
- Softer neutral surfaces and stronger ink hierarchy.
- Refined customer bottom navigation sizing/weight.
- Home and Cart visual palette aligned to the new direction.

## Next large build batches
1. Customer Home: hierarchy, store cards, category browsing, states, search entry.
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

## Working rule
Make large coherent changes, verify them, commit them, and keep this document updated so a fresh chat can resume without reconstructing the project from conversation history.
