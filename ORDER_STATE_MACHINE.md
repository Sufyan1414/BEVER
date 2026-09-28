# BEVER — Order State Machine

This document is the definitive specification for how orders move through the BEVER system. **No application may invent, skip, or modify order states outside of this specification.**

---

## Guiding Principle

The order state machine is enforced at the **database level** via PostgreSQL functions and/or triggers. Client apps may request a state transition, but the database will reject illegal transitions. No app can silently put an order into an invalid state.

---

## Order Lifecycle (Happy Path)

```
                    ┌─────────┐
                    │ PENDING │  ← Order placed by customer
                    └────┬────┘
                         │ Merchant reviews order
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
    ┌──────────────────┐       ┌──────────┐
    │ MERCHANT_ACCEPTED│       │ REJECTED │ ← Terminal state
    └────────┬─────────┘       └──────────┘
             │ Merchant starts preparing
             ▼
       ┌────────────┐
       │ PREPARING  │
       └─────┬──────┘
             │ Merchant finishes, order is ready
             ▼
    ┌──────────────────┐
    │ READY_FOR_PICKUP │
    └────────┬─────────┘
             │ Admin/system assigns a rider
             ▼
    ┌─────────────────┐
    │  RIDER_ASSIGNED │
    └────────┬────────┘
             │ Rider arrives at the store
             ▼
    ┌──────────────────┐
    │  RIDER_AT_STORE  │
    └────────┬─────────┘
             │ Rider picks up the order
             ▼
       ┌───────────┐
       │ PICKED_UP │
       └─────┬─────┘
             │ Rider leaves for customer location
             ▼
    ┌──────────────────┐
    │ OUT_FOR_DELIVERY │
    └────────┬─────────┘
             │ Rider reaches customer, OTP confirmed
             ▼
       ┌───────────┐
       │ DELIVERED │  ← Terminal state (success)
       └───────────┘
```

---

## Terminal and Error States

These states end the order's active lifecycle.

| State | Meaning | Who Triggers |
|---|---|---|
| `REJECTED` | Merchant declined the order | Merchant App |
| `CANCELLED` | Customer cancelled before merchant accepted | Customer App / Admin |
| `PAYMENT_FAILED` | Payment could not be confirmed (future UPI use) | System / Admin |
| `DELIVERY_FAILED` | Rider was unable to complete delivery | Rider App / Admin |
| `REFUND_PENDING` | Refund has been initiated but not completed | Admin |
| `REFUNDED` | Refund has been completed | Admin |

---

## Full State Transition Table

This table shows every valid transition. Any transition not listed here is **illegal and must be rejected by the database**.

| From State | To State | Who Can Trigger | Condition |
|---|---|---|---|
| `PENDING` | `MERCHANT_ACCEPTED` | Merchant | Order is valid |
| `PENDING` | `REJECTED` | Merchant | Merchant declines |
| `PENDING` | `CANCELLED` | Customer, Admin | Before merchant accepts |
| `MERCHANT_ACCEPTED` | `PREPARING` | Merchant | — |
| `MERCHANT_ACCEPTED` | `CANCELLED` | Admin | Exceptional case |
| `PREPARING` | `READY_FOR_PICKUP` | Merchant | — |
| `READY_FOR_PICKUP` | `RIDER_ASSIGNED` | Admin / System | A rider is assigned |
| `RIDER_ASSIGNED` | `RIDER_AT_STORE` | Rider | Rider confirms arrival |
| `RIDER_ASSIGNED` | `READY_FOR_PICKUP` | Admin | Rider unassigned |
| `RIDER_AT_STORE` | `PICKED_UP` | Rider | Merchant confirms or rider self-confirms |
| `PICKED_UP` | `OUT_FOR_DELIVERY` | Rider | — |
| `OUT_FOR_DELIVERY` | `DELIVERED` | Rider | OTP confirmed by customer |
| `OUT_FOR_DELIVERY` | `DELIVERY_FAILED` | Rider, Admin | Unable to deliver |
| `DELIVERY_FAILED` | `REFUND_PENDING` | Admin | If prepaid (future) |
| `REFUND_PENDING` | `REFUNDED` | Admin | Refund completed |

---

## State Definitions

### `PENDING`
The customer has placed the order. It is waiting for the merchant to accept or reject it. No rider is involved yet.

### `MERCHANT_ACCEPTED`
The merchant has confirmed they can fulfil the order. Preparation has not started yet.

### `PREPARING`
The merchant is actively preparing the order (picking, packing).

### `READY_FOR_PICKUP`
The order is packed and ready for a rider to collect. The system (or admin) should now assign a rider.

### `RIDER_ASSIGNED`
A rider has been assigned to this order. The rider has been notified.

### `RIDER_AT_STORE`
The rider has arrived at the merchant's store location.

### `PICKED_UP`
The rider has collected the order from the store and is about to depart.

### `OUT_FOR_DELIVERY`
The rider is en route to the customer's delivery address.

### `DELIVERED`
The order has been successfully delivered. Customer confirmed via OTP. This is the successful terminal state.

### `REJECTED`
The merchant declined the order. Customer should be notified immediately. If prepaid, a refund process begins.

### `CANCELLED`
The order was cancelled (typically by the customer before the merchant accepted, or by admin in exceptional cases).

### `PAYMENT_FAILED`
Reserved for future prepaid payment flows. The payment attempt did not succeed.

### `DELIVERY_FAILED`
The rider was unable to complete the delivery (customer not available, wrong address, etc.). Requires admin intervention.

### `REFUND_PENDING`
A refund has been initiated for a prepaid order but has not yet been processed.

### `REFUNDED`
The refund has been completed and confirmed.

---

## Enforcement Rules

1. **Database is the enforcer.** A PostgreSQL function validates every state transition. If an app tries to jump directly from `PENDING` to `DELIVERED`, the database rejects it.

2. **Role-based transition control.** The database function checks not just the transition but also who is making it. A customer cannot change the state to `MERCHANT_ACCEPTED`. A rider cannot change the state to `PREPARING`.

3. **No client-side state machine.** Apps display state and request transitions. They do not maintain their own state machine logic. The database tells them what state an order is in.

4. **Every transition is logged.** A separate `order_status_history` table records every state change, who made it, and when.

5. **Apps recover from missed notifications.** When an app resumes from background, it fetches the current order state from the database. It never assumes its locally cached state is correct.

---

## Order Status History Table

Every transition is recorded:

```
order_status_history
├── id (uuid)
├── order_id (uuid, FK → orders)
├── from_status (order_status enum)
├── to_status (order_status enum)
├── changed_by (uuid, FK → profiles)
├── changed_by_role (text)
├── note (text, optional)
└── created_at (timestamptz)
```

This provides a full audit trail for every order, which is critical for dispute resolution and support.
