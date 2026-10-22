# BEVER field trial guide (Chhatrapati Sambhajinagar)

Goal of the trial: find out whether local shopkeepers and customers actually want this, using the real apps.
This guide covers installing the apps, onboarding a shopkeeper in about 5 minutes, a device test checklist, and
what to ask and count at the market.

> Status: the apps pass automated typecheck/bundle checks and (for the merchant app) visual screenshot review.
> **They have not yet been run on a real phone against the live database.** Do the checklist in section 3 on your own phone
> and a test shop before you show anyone, and fix anything that breaks.

## 1. Install the test apps (Android)
1. In GitHub open **Actions > Android test APKs > Run workflow** (needs the secret in section 5 once).
2. When it finishes, open the repo's **Releases** page on your phone, download `bever-customer-test.apk` and
   `bever-merchant-test.apk`, and install them (allow "install unknown apps" for your browser when asked).
3. These are debug-key-signed test builds, not Play Store builds.

## 2. Onboard a shopkeeper (about 5 minutes)
1. The shopkeeper installs the **Customer** app and signs up once with their mobile number and a 6-digit PIN.
2. You run `packages/supabase/field-trial/onboard_merchant.sql` in the Supabase SQL editor with their details
   (shop name, address, real latitude/longitude, delivery radius). It makes them a merchant and creates an open, verified store.
3. Add their 10-20 most common products with real prices (commented block at the bottom of that file), or let them add products in the
   **Catalogue** tab of the Merchant app (the "+" button).
4. They install the **Merchant** app and sign in with the same number and PIN.

Prices are stored in paise (Rs 155 = 15500). The minimum order is deliberately left at 0 during the trial (unit question unresolved).

## 3. Device test checklist (do this yourself first)
Customer app
- [ ] Sign up and log in with a phone number and PIN; log out and back in.
- [ ] Choose an area/location near the test shop; the test shop appears.
- [ ] Open the shop, add items, change quantities, see the free-delivery progress bar move toward Rs 199.
- [ ] Checkout (Cash on Delivery): the order is placed and the order tracking screen opens.
- [ ] An address outside the shop's radius is refused with a clear message.
- [ ] Orders tab shows the order under "In progress" and updates when the shop acts.
Merchant app
- [ ] Sign in; the new order appears with the alert banner and vibration (app open).
- [ ] Reject asks for a reason; Accept > Start preparing > Mark ready for pickup all work.
- [ ] Mark a product out of stock: the customer app no longer lets it be ordered.
- [ ] Change a price: a new order uses the new price; an old order keeps its old price.
- [ ] Pause the store: customers can no longer order.
Known gaps to expect (not bugs): no push notification when the app is closed, no UPI (COD only), delivery is handled by you / a runner by hand,
delivery PIN handover is the older 4-digit OTP flow and may not complete in the Rider app (see BEVER_PROJECT_STATUS.md).

## 4. What to ask and count at the market
Do not ask "would you use this?". Ask about behaviour and money.
Shopkeepers
- How many orders do you get by phone/WhatsApp a day? Who delivers them, and what does it cost you?
- If I send you 5 orders this week at no cost, will you accept and pack them? (Then actually do it.)
- Which items do customers ask for that you do not list? How often do prices change?
Customers
- How do you order from local shops today? What stops you ordering more?
- Would you pay Rs 20-40 delivery for a Rs 150-250 order from a shop you trust? What would you order this week?
Track in a simple sheet: shops approached, shops that agreed, shops that listed products, test orders placed, orders accepted,
minutes to accept, orders delivered, repeat orders, and every "I wish it could..." request.

## 5. One-time setup for the APK build
Repo **Settings > Secrets and variables > Actions > New repository secret**: `EXPO_PUBLIC_SUPABASE_ANON_KEY` = your Supabase project's
anon (public) key. Optional variable `EXPO_PUBLIC_SUPABASE_URL` if it differs from `https://atuaafowdoijojdmtgcr.supabase.co`.
Never put the service-role key anywhere in this repo or in these apps.


## Onboarding flow (updated)

- **Merchants** open the Merchant app, tap "Register your shop" and fill the mandatory form (owner, shop, category, address, pincode, hours, FSSAI for food shops, optional GSTIN, terms). They then wait on the "Application received" screen.
- **Riders** open the Rider app, tap "Register here" and fill the mandatory form (name, area, vehicle, vehicle number and licence for motor vehicles, emergency contact, terms).
- **You** review the submitted details with the commented query in `packages/supabase/field-trial/onboard_merchant.sql`, then run that script (merchants) or the rider snippet at its bottom (riders). The applicant taps "check again" and is in.
- **Customers** browse as guests. At checkout they sign in with phone + PIN, and if they have no saved address a short delivery-details form appears (flat/street, pincode, city, state). No SMS OTP is used anywhere.
