import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  CampaignService,
  CampaignServiceError,
  type CampaignStore,
} from "./campaign-service";

function makeStore(overrides: Partial<CampaignStore> = {}): CampaignStore {
  return {
    create: vi.fn().mockResolvedValue({
      id: "cmp_1",
      ownerId: "admin_1",
      slug: "renovasi-masjid",
      title: "Renovasi Masjid",
      description: "Dana renovasi masjid",
      targetCents: BigInt(50_000_000_00),
      raisedCents: BigInt(0),
      currency: "IDR",
      status: "DRAFT",
      coverImage: null,
      startsAt: null,
      endsAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    update: vi.fn().mockResolvedValue({ id: "cmp_1" }),
    delete: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue({
      id: "cmp_1",
      ownerId: "admin_1",
      slug: "renovasi-masjid",
      title: "Renovasi Masjid",
      description: "Dana renovasi masjid",
      targetCents: BigInt(50_000_000_00),
      raisedCents: BigInt(0),
      currency: "IDR",
      status: "DRAFT",
      coverImage: null,
      startsAt: null,
      endsAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findBySlug: vi.fn().mockResolvedValue(null),
    listActive: vi.fn().mockResolvedValue([]),
    listAll: vi.fn().mockResolvedValue([]),
    countBySlug: vi.fn().mockResolvedValue(0),
    incrementRaised: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("CampaignService", () => {
  let store: CampaignStore;
  let service: CampaignService;

  beforeEach(() => {
    store = makeStore();
    service = new CampaignService({ store });
  });

  // --- Task 1: CRUD ---

  describe("createCampaign", () => {
    it("should create a campaign with unique slug", async () => {
      const result = await service.createCampaign({
        ownerId: "admin_1",
        title: "Renovasi Masjid",
        description: "Dana renovasi masjid",
        targetCents: BigInt(50_000_000_00),
        coverImage: "https://example.com/cover.jpg",
      });

      expect(result.id).toBe("cmp_1");
      expect(result.slug).toBe("renovasi-masjid");
      expect(result.status).toBe("DRAFT");
      expect(store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: "admin_1",
          slug: "renovasi-masjid",
          title: "Renovasi Masjid",
          targetCents: BigInt(50_000_000_00),
          status: "DRAFT",
        })
      );
    });

    it("should reject empty title", async () => {
      await expect(
        service.createCampaign({
          ownerId: "admin_1",
          title: "",
          description: "Dana renovasi",
          targetCents: BigInt(10_000_000_00),
        })
      ).rejects.toThrow(CampaignServiceError);
    });

    it("should reject zero or negative target", async () => {
      await expect(
        service.createCampaign({
          ownerId: "admin_1",
          title: "Campaign",
          description: "Desc",
          targetCents: BigInt(0),
        })
      ).rejects.toThrow(CampaignServiceError);

      await expect(
        service.createCampaign({
          ownerId: "admin_1",
          title: "Campaign",
          description: "Desc",
          targetCents: BigInt(-1000),
        })
      ).rejects.toThrow(CampaignServiceError);
    });

    it("should generate unique slug when duplicate exists", async () => {
      store.countBySlug = vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      await service.createCampaign({
        ownerId: "admin_1",
        title: "Renovasi Masjid",
        description: "Dana renovasi",
        targetCents: BigInt(10_000_000_00),
      });

      expect(store.countBySlug).toHaveBeenCalledWith("renovasi-masjid");
      expect(store.countBySlug).toHaveBeenCalledWith("renovasi-masjid-2");
      expect(store.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "renovasi-masjid-2" })
      );
    });
  });

  describe("updateCampaign", () => {
    it("should update campaign fields", async () => {
      await service.updateCampaign("cmp_1", {
        title: "Renovasi Masjid Updated",
        description: "New description",
      });

      expect(store.update).toHaveBeenCalledWith("cmp_1", {
        title: "Renovasi Masjid Updated",
        description: "New description",
      });
    });

    it("should reject update if campaign not found", async () => {
      store.findById = vi.fn().mockResolvedValue(null);

      await expect(
        service.updateCampaign("cmp_999", { title: "New" })
      ).rejects.toThrow(CampaignServiceError);
    });

    it("should reject update if campaign is CLOSED", async () => {
      store.findById = vi.fn().mockResolvedValue({
        id: "cmp_1",
        status: "CLOSED",
      });

      await expect(
        service.updateCampaign("cmp_1", { title: "New" })
      ).rejects.toThrow(CampaignServiceError);
    });
  });

  describe("deleteCampaign", () => {
    it("should delete campaign if no donations exist", async () => {
      await service.deleteCampaign("cmp_1");

      expect(store.delete).toHaveBeenCalledWith("cmp_1");
    });

    it("should reject delete if campaign not found", async () => {
      store.findById = vi.fn().mockResolvedValue(null);

      await expect(service.deleteCampaign("cmp_999")).rejects.toThrow(
        CampaignServiceError
      );
    });

    it("should reject delete if campaign has raised funds", async () => {
      store.findById = vi.fn().mockResolvedValue({
        id: "cmp_1",
        raisedCents: BigInt(1000_00),
      });

      await expect(service.deleteCampaign("cmp_1")).rejects.toThrow(
        CampaignServiceError
      );
    });
  });

  // --- Task 2: Publish / Close ---

  describe("publishCampaign", () => {
    it("should publish a DRAFT campaign", async () => {
      await service.publishCampaign("cmp_1");

      expect(store.update).toHaveBeenCalledWith(
        "cmp_1",
        expect.objectContaining({ status: "ACTIVE" })
      );
    });

    it("should reject publish if campaign not found", async () => {
      store.findById = vi.fn().mockResolvedValue(null);

      await expect(service.publishCampaign("cmp_999")).rejects.toThrow(
        CampaignServiceError
      );
    });

    it("should reject publish if campaign is already ACTIVE", async () => {
      store.findById = vi.fn().mockResolvedValue({
        id: "cmp_1",
        status: "ACTIVE",
      });

      await expect(service.publishCampaign("cmp_1")).rejects.toThrow(
        CampaignServiceError
      );
    });
  });

  describe("closeCampaign", () => {
    it("should close an ACTIVE campaign", async () => {
      store.findById = vi.fn().mockResolvedValue({
        id: "cmp_1",
        status: "ACTIVE",
      });

      await service.closeCampaign("cmp_1");

      expect(store.update).toHaveBeenCalledWith(
        "cmp_1",
        expect.objectContaining({ status: "CLOSED" })
      );
    });

    it("should reject close if campaign not found", async () => {
      store.findById = vi.fn().mockResolvedValue(null);

      await expect(service.closeCampaign("cmp_999")).rejects.toThrow(
        CampaignServiceError
      );
    });

    it("should reject close if campaign is already CLOSED", async () => {
      store.findById = vi.fn().mockResolvedValue({
        id: "cmp_1",
        status: "CLOSED",
      });

      await expect(service.closeCampaign("cmp_1")).rejects.toThrow(
        CampaignServiceError
      );
    });
  });

  // --- Task 3: List ---

  describe("listActiveCampaigns", () => {
    it("should return active campaigns", async () => {
      store.listActive = vi.fn().mockResolvedValue([
        { id: "cmp_1", status: "ACTIVE" },
        { id: "cmp_2", status: "ACTIVE" },
      ]);

      const result = await service.listActiveCampaigns();

      expect(result).toHaveLength(2);
      expect(store.listActive).toHaveBeenCalled();
    });
  });

  describe("getCampaignBySlug", () => {
    it("should return campaign by slug", async () => {
      store.findBySlug = vi.fn().mockResolvedValue({
        id: "cmp_1",
        slug: "renovasi-masjid",
      });

      const result = await service.getCampaignBySlug("renovasi-masjid");

      expect(result?.id).toBe("cmp_1");
      expect(store.findBySlug).toHaveBeenCalledWith("renovasi-masjid");
    });

    it("should return null if not found", async () => {
      store.findBySlug = vi.fn().mockResolvedValue(null);

      const result = await service.getCampaignBySlug("not-found");

      expect(result).toBeNull();
    });
  });
});
