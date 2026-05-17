import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  ShipmentService,
  ShipmentServiceError,
  type ShipmentStore,
  type ShipmentProviderAdapter,
} from "./shipment-service";

function makeStore(overrides: Partial<ShipmentStore> = {}): ShipmentStore {
  return {
    createShipment: vi.fn().mockResolvedValue({
      id: "ship_1",
      orderId: "order_1",
      courier: "jne",
      service: "REG",
      trackingNo: null,
      status: "CREATED",
      costCents: 1100000,
      weightGram: 1200,
      fromAddress: {},
      toAddress: {},
      providerRef: null,
      providerMeta: null,
      pickedUpAt: null,
      deliveredAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findByOrderId: vi.fn().mockResolvedValue(null),
    updateShipment: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function makeProvider(overrides: Partial<ShipmentProviderAdapter> = {}): ShipmentProviderAdapter {
  return {
    requestPickup: vi.fn().mockResolvedValue({
      providerRef: "KA-12345",
      trackingNo: "JNE1234567890",
    }),
    ...overrides,
  };
}

describe("ShipmentService", () => {
  let store: ShipmentStore;
  let provider: ShipmentProviderAdapter;
  let service: ShipmentService;

  beforeEach(() => {
    store = makeStore();
    provider = makeProvider();
    service = new ShipmentService({ store, provider });
  });

  describe("createShipment", () => {
    it("creates shipment record and calls provider pickup", async () => {
      const result = await service.createShipment({
        orderId: "order_1",
        courier: "jne",
        serviceCode: "REG",
        costCents: 1100000,
        weightGram: 1200,
        fromAddress: {
          name: "Toko Masjid",
          phone: "08123456789",
          address: "Jl. Masjid No. 1",
          city: "Bandung",
          postalCode: "40132",
        },
        toAddress: {
          name: "Budi",
          phone: "08198765432",
          address: "Jl. Merdeka No. 5",
          city: "Jakarta",
          postalCode: "10110",
        },
      });

      expect(store.createShipment).toHaveBeenCalledOnce();
      expect(provider.requestPickup).toHaveBeenCalledOnce();
      expect(store.updateShipment).toHaveBeenCalledWith(
        "ship_1",
        expect.objectContaining({
          providerRef: "KA-12345",
          trackingNo: "JNE1234567890",
        }),
      );
      expect(result.id).toBe("ship_1");
    });

    it("creates shipment even if provider fails (fallback manual)", async () => {
      provider.requestPickup = vi.fn().mockRejectedValue(new Error("API down"));
      
      const result = await service.createShipment({
        orderId: "order_1",
        courier: "jne",
        serviceCode: "REG",
        costCents: 1100000,
        weightGram: 1200,
        fromAddress: { name: "A", phone: "08123", address: "X", city: "Y", postalCode: "1" },
        toAddress: { name: "B", phone: "08456", address: "Z", city: "W", postalCode: "2" },
      });

      expect(store.createShipment).toHaveBeenCalledOnce();
      // Provider failed but shipment record still created
      expect(result.id).toBe("ship_1");
      expect(result.needsManualResi).toBe(true);
    });

    it("rejects duplicate shipment for same order", async () => {
      store.findByOrderId = vi.fn().mockResolvedValue({ id: "existing" });

      await expect(
        service.createShipment({
          orderId: "order_1",
          courier: "jne",
          serviceCode: "REG",
          costCents: 0,
          weightGram: 0,
          fromAddress: { name: "A", phone: "0", address: "X", city: "Y", postalCode: "1" },
          toAddress: { name: "B", phone: "0", address: "Z", city: "W", postalCode: "2" },
        }),
      ).rejects.toMatchObject({ code: "SHIPMENT_EXISTS" });
    });
  });

  describe("setManualResi", () => {
    it("updates tracking number on existing shipment", async () => {
      store.findByOrderId = vi.fn().mockResolvedValue({ id: "ship_1", status: "CREATED", trackingNo: null });

      await service.setManualResi({ orderId: "order_1", trackingNo: "MANUAL123" });

      expect(store.updateShipment).toHaveBeenCalledWith(
        "ship_1",
        expect.objectContaining({ trackingNo: "MANUAL123" }),
      );
    });

    it("rejects if no shipment found", async () => {
      store.findByOrderId = vi.fn().mockResolvedValue(null);

      await expect(
        service.setManualResi({ orderId: "order_1", trackingNo: "X" }),
      ).rejects.toMatchObject({ code: "SHIPMENT_NOT_FOUND" });
    });
  });

  describe("getTracking", () => {
    it("returns shipment info for order", async () => {
      const shipment = {
        id: "ship_1",
        orderId: "order_1",
        courier: "jne",
        service: "REG",
        trackingNo: "JNE123",
        status: "IN_TRANSIT",
      };
      store.findByOrderId = vi.fn().mockResolvedValue(shipment);

      const result = await service.getTracking("order_1");
      expect(result).toMatchObject({ trackingNo: "JNE123", status: "IN_TRANSIT" });
    });

    it("returns null if no shipment", async () => {
      store.findByOrderId = vi.fn().mockResolvedValue(null);
      const result = await service.getTracking("order_1");
      expect(result).toBeNull();
    });
  });
});
