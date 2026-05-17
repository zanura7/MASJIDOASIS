/**
 * POST /api/orders/[id]/shipment  — seller creates shipment for order (or manual resi)
 * GET  /api/orders/[id]/shipment  — buyer/seller/admin get shipment tracking
 *
 * MAS-8.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAuth, AuthError } from "@/server/auth/middleware";
import { prisma } from "@/server/db";
import { buildShipmentService } from "@/server/shipping/shipment-factory";
import { ShipmentServiceError } from "@/server/shipping/shipment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authOrFail(req: NextRequest): { sub: string; role: string } | NextResponse {
  try {
    const claims = requireAuth(req);
    return { sub: claims.sub, role: claims.role };
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    throw err;
  }
}

/**
 * POST — Seller creates shipment.
 *
 * Body (optional): { trackingNo?: string, courier?: string, service?: string }
 * If trackingNo is provided → treated as manual resi input.
 * If not → attempts KiriminAja API pickup (falls back to needsManualResi).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = authOrFail(req);
  if (auth instanceof NextResponse) return auth;

  const { id: orderId } = await ctx.params;
  if (!orderId) {
    return NextResponse.json(
      { ok: false, code: "BAD_PARAM", message: "order id required" },
      { status: 400 },
    );
  }

  // Verify seller owns the order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      sellerId: true,
      status: true,
      shippingAddress: true,
      shippingCents: true,
      seller: { select: { name: true, phone: true } },
      items: { select: { weightGram: true, qty: true } },
    },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, code: "ORDER_NOT_FOUND", message: "order not found" },
      { status: 404 },
    );
  }

  if (order.sellerId !== auth.sub && auth.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", message: "not your order" },
      { status: 403 },
    );
  }

  let body: { trackingNo?: string; courier?: string; service?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // empty body ok
  }

  const shipmentService = buildShipmentService();

  // If trackingNo provided → manual resi path
  if (body.trackingNo) {
    try {
      // First try setManualResi (if shipment exists)
      const result = await shipmentService.setManualResi({
        orderId,
        trackingNo: body.trackingNo,
      });
      return NextResponse.json({ ok: true, shipment: result });
    } catch (err) {
      if (err instanceof ShipmentServiceError && err.code === "SHIPMENT_NOT_FOUND") {
        // No shipment yet — create one with manual resi
        try {
          const addr = order.shippingAddress as Record<string, string>;
          const totalWeight = (order.items as any[]).reduce(
            (sum: number, it: any) => sum + (it.weightGram ?? 0) * (it.qty ?? 1),
            0,
          ) || 1000;

          const result = await shipmentService.createShipment({
            orderId,
            courier: body.courier ?? "manual",
            serviceCode: body.service ?? "REG",
            costCents: order.shippingCents ?? 0,
            weightGram: totalWeight,
            fromAddress: {
              name: order.seller?.name ?? "Seller",
              phone: order.seller?.phone ?? "",
              address: "-",
              city: "-",
              postalCode: "-",
            },
            toAddress: {
              name: addr?.recipientName ?? addr?.name ?? "Buyer",
              phone: addr?.phone ?? "",
              address: addr?.line1 ?? addr?.address ?? "-",
              city: addr?.city ?? "-",
              postalCode: addr?.postalCode ?? "-",
            },
          });

          // Also set manual resi
          await shipmentService.setManualResi({ orderId, trackingNo: body.trackingNo });
          return NextResponse.json({ ok: true, shipment: { ...result, trackingNo: body.trackingNo } });
        } catch (innerErr) {
          if (innerErr instanceof ShipmentServiceError) {
            return NextResponse.json(
              { ok: false, code: innerErr.code, message: innerErr.message },
              { status: innerErr.httpStatus },
            );
          }
          throw innerErr;
        }
      }
      if (err instanceof ShipmentServiceError) {
        return NextResponse.json(
          { ok: false, code: err.code, message: err.message },
          { status: err.httpStatus },
        );
      }
      throw err;
    }
  }

  // Normal path: create shipment via provider
  try {
    const addr = order.shippingAddress as Record<string, string>;
    const totalWeight = (order.items as any[]).reduce(
      (sum: number, it: any) => sum + (it.weightGram ?? 0) * (it.qty ?? 1),
      0,
    ) || 1000;

    const result = await shipmentService.createShipment({
      orderId,
      courier: body.courier ?? "kiriminaja",
      serviceCode: body.service ?? "REG",
      costCents: order.shippingCents ?? 0,
      weightGram: totalWeight,
      fromAddress: {
        name: order.seller?.name ?? "Seller",
        phone: order.seller?.phone ?? "",
        address: "-",
        city: "-",
        postalCode: "-",
      },
      toAddress: {
        name: addr?.recipientName ?? addr?.name ?? "Buyer",
        phone: addr?.phone ?? "",
        address: addr?.line1 ?? addr?.address ?? "-",
        city: addr?.city ?? "-",
        postalCode: addr?.postalCode ?? "-",
      },
    });
    return NextResponse.json({ ok: true, shipment: result });
  } catch (err) {
    if (err instanceof ShipmentServiceError) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    throw err;
  }
}

/**
 * GET — Anyone involved in the order (buyer/seller/admin) can view tracking.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = authOrFail(req);
  if (auth instanceof NextResponse) return auth;

  const { id: orderId } = await ctx.params;
  if (!orderId) {
    return NextResponse.json(
      { ok: false, code: "BAD_PARAM", message: "order id required" },
      { status: 400 },
    );
  }

  // Verify caller is buyer, seller, or admin
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { buyerId: true, sellerId: true },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, code: "ORDER_NOT_FOUND", message: "order not found" },
      { status: 404 },
    );
  }

  if (order.buyerId !== auth.sub && order.sellerId !== auth.sub && auth.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", message: "not authorized" },
      { status: 403 },
    );
  }

  const shipmentService = buildShipmentService();
  const tracking = await shipmentService.getTracking(orderId);

  if (!tracking) {
    return NextResponse.json(
      { ok: false, code: "NO_SHIPMENT", message: "no shipment found for this order" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, shipment: tracking });
}
