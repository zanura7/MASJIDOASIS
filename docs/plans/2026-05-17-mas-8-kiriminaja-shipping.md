# MAS-8: KiriminAja Shipping Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.
> Ensure strict TDD (Red-Green-Refactor) per test-driven-development skill.

**Goal:** Implement real KiriminAja shipping API integration to replace the stub quoter, add shipment tracking, and provide fallback manual tracking.

**Architecture:** 
1. Build `KiriminAjaProvider` as a low-level HTTP client to the KiriminAja API (sandbox/prod config via env vars).
2. Build `ShippingService` adapter implementing `ShippingQuoter` interface to replace `KiriminAjaStubQuoter`.
3. Build `ShipmentService` for creating shipments (`POST /api/orders/[id]/ship` will use this instead of just marking shipped).
4. Add admin/seller endpoints for tracking and manual resi input.

**Tech Stack:** Next.js API Routes, Prisma, Node `fetch`, Jest.

---

### Task 1: Add KiriminAja Config & Provider Skeleton

**Objective:** Define env vars and build the base HTTP client for KiriminAja API.

**Files:**
- Modify: `src/server/env.ts` (if exists) or document env vars.
- Create: `src/server/shipping/kiriminaja-provider.ts`
- Create: `src/server/shipping/kiriminaja-provider.test.ts`

**Steps:**
1. Write failing test for provider initialization (checks API key presence).
2. Write test for `getRates` method mock.
3. Implement `KiriminAjaProvider` with `fetch` wrapper.
4. Pass tests.

---

### Task 2: Implement Real Shipping Quoter

**Objective:** Replace `KiriminAjaStubQuoter` with real API calls via provider.

**Files:**
- Modify: `src/server/marketplace/shipping-quoter.ts`
- Modify: `src/server/marketplace/shipping-quoter.test.ts`
- Modify: `src/server/marketplace/checkout-service.ts` (if DI needs update)

**Steps:**
1. Write failing tests for real quoter using mocked provider.
2. Update `ShippingQuoter` implementation to call `KiriminAjaProvider.getRates`.
3. Handle caching/rate limiting if necessary (or just pass through for now).
4. Pass tests.

---

### Task 3: Build Shipment Creation Service

**Objective:** Create `ShipmentService` to handle creating shipments in KiriminAja and saving to DB.

**Files:**
- Create: `src/server/shipping/shipment-service.ts`
- Create: `src/server/shipping/shipment-service.test.ts`

**Steps:**
1. Write failing tests for `createShipment` (DB insert + API call).
2. Implement DB insertion into `Shipment` model.
3. Implement KiriminAja `createPickup` or equivalent API call.
4. Pass tests.

---

### Task 4: Integrate Shipment Creation into Order Flow

**Objective:** Update `POST /api/orders/[id]/ship` to actually create a shipment.

**Files:**
- Modify: `src/app/api/orders/[id]/ship/route.ts`
- Modify: `src/server/marketplace/order-lifecycle-service.ts`

**Steps:**
1. Write failing tests for `markShipped` expecting shipment creation.
2. Update `markShipped` to call `ShipmentService`.
3. Handle API failures (fallback to manual resi).
4. Pass tests.

---

### Task 5: Manual Resi Fallback & Tracking Endpoints

**Objective:** Allow sellers to input resi manually if API fails, and endpoints for buyers to track.

**Files:**
- Create: `src/app/api/orders/[id]/shipment/route.ts` (GET for tracking, POST for manual resi)
- Modify: `src/server/shipping/shipment-service.ts`

**Steps:**
1. Write tests for manual resi input and tracking fetch.
2. Implement endpoints.
3. Pass tests.
