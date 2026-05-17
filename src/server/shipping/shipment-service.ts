export class ShipmentServiceError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = "ShipmentServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface AddressPayload {
  name: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
}

export interface CreateShipmentInput {
  orderId: string;
  courier: string;
  serviceCode: string;
  costCents: number;
  weightGram: number;
  fromAddress: AddressPayload;
  toAddress: AddressPayload;
}

export interface SetManualResiInput {
  orderId: string;
  trackingNo: string;
}

export interface ShipmentRecord {
  id: string;
  orderId: string;
  courier: string;
  service: string;
  trackingNo: string | null;
  status: string;
  costCents?: number;
  weightGram?: number;
  fromAddress?: unknown;
  toAddress?: unknown;
  providerRef?: string | null;
  providerMeta?: unknown;
  pickedUpAt?: Date | null;
  deliveredAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: unknown;
}

export interface ShipmentStore {
  createShipment(input: {
    orderId: string;
    courier: string;
    service: string;
    costCents: number;
    weightGram: number;
    fromAddress: unknown;
    toAddress: unknown;
    status: string;
  }): Promise<ShipmentRecord>;

  findByOrderId(orderId: string): Promise<ShipmentRecord | null>;

  updateShipment(shipmentId: string, patch: Partial<ShipmentRecord>): Promise<ShipmentRecord>;
}

export interface ShipmentProviderAdapter {
  requestPickup(input: {
    orderId: string;
    courier: string;
    serviceCode: string;
    fromAddress: AddressPayload;
    toAddress: AddressPayload;
    weightGram: number;
  }): Promise<{ providerRef: string; trackingNo: string | null }>;
}

export interface ShipmentServiceDeps {
  store: ShipmentStore;
  provider: ShipmentProviderAdapter;
}

export interface CreateShipmentResult extends ShipmentRecord {
  needsManualResi?: boolean;
}

export class ShipmentService {
  private store: ShipmentStore;
  private provider: ShipmentProviderAdapter;

  constructor(deps: ShipmentServiceDeps) {
    this.store = deps.store;
    this.provider = deps.provider;
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const existing = await this.store.findByOrderId(input.orderId);
    if (existing) {
      throw new ShipmentServiceError("SHIPMENT_EXISTS", 409, "Shipment already exists for this order");
    }

    const created = await this.store.createShipment({
      orderId: input.orderId,
      courier: input.courier,
      service: input.serviceCode,
      costCents: input.costCents,
      weightGram: input.weightGram,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      status: "CREATED",
    });

    try {
      const pickup = await this.provider.requestPickup({
        orderId: input.orderId,
        courier: input.courier,
        serviceCode: input.serviceCode,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        weightGram: input.weightGram,
      });

      await this.store.updateShipment(created.id, {
        providerRef: pickup.providerRef,
        trackingNo: pickup.trackingNo,
      });

      return {
        ...created,
        providerRef: pickup.providerRef,
        trackingNo: pickup.trackingNo,
      };
    } catch {
      return {
        ...created,
        needsManualResi: true,
      };
    }
  }

  async setManualResi(input: SetManualResiInput): Promise<ShipmentRecord> {
    const shipment = await this.store.findByOrderId(input.orderId);
    if (!shipment) {
      throw new ShipmentServiceError("SHIPMENT_NOT_FOUND", 404, "Shipment not found");
    }

    return this.store.updateShipment(shipment.id, {
      trackingNo: input.trackingNo,
    });
  }

  async getTracking(orderId: string): Promise<ShipmentRecord | null> {
    return this.store.findByOrderId(orderId);
  }
}
