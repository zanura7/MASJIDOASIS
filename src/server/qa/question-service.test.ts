import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  QuestionService,
  QuestionServiceError,
  type QuestionStore,
} from "./question-service";

function makeStore(overrides: Partial<QuestionStore> = {}): QuestionStore {
  return {
    create: vi.fn().mockResolvedValue({
      id: "q1",
      askerId: "member1",
      category: "USTADZ",
      title: "Hukum zakat",
      body: "Bagaimana cara menghitung zakat?",
      status: "PENDING",
      isPrivate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    updateStatus: vi.fn().mockResolvedValue({}),
    findById: vi.fn().mockResolvedValue({
      id: "q1",
      status: "PENDING",
    }),
    listPublic: vi.fn().mockResolvedValue([]),
    listByAsker: vi.fn().mockResolvedValue([]),
    listForModeration: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("QuestionService", () => {
  let store: QuestionStore;
  let service: QuestionService;

  beforeEach(() => {
    store = makeStore();
    service = new QuestionService({ store });
  });

  describe("askQuestion", () => {
    it("creates question with PENDING status", async () => {
      const result = await service.askQuestion({
        askerId: "member1",
        category: "USTADZ",
        title: "Hukum zakat",
        body: "Bagaimana cara menghitung zakat?",
        isPrivate: false,
      });

      expect(store.create).toHaveBeenCalledWith({
        askerId: "member1",
        category: "USTADZ",
        title: "Hukum zakat",
        body: "Bagaimana cara menghitung zakat?",
        status: "PENDING",
        isPrivate: false,
      });
      expect(result.id).toBe("q1");
    });

    it("rejects empty title", async () => {
      await expect(
        service.askQuestion({
          askerId: "m",
          category: "USTADZ",
          title: "",
          body: "x",
          isPrivate: false,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("rejects empty body", async () => {
      await expect(
        service.askQuestion({
          askerId: "m",
          category: "USTADZ",
          title: "Title",
          body: "",
          isPrivate: false,
        }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  describe("moderateQuestion", () => {
    it("updates status to OPEN", async () => {
      await service.moderateQuestion("q1", "OPEN");
      expect(store.updateStatus).toHaveBeenCalledWith("q1", "OPEN");
    });

    it("updates status to REJECTED", async () => {
      await service.moderateQuestion("q1", "REJECTED");
      expect(store.updateStatus).toHaveBeenCalledWith("q1", "REJECTED");
    });

    it("rejects non-existent question", async () => {
      store.findById = vi.fn().mockResolvedValue(null);
      await expect(
        service.moderateQuestion("nope", "OPEN"),
      ).rejects.toMatchObject({ code: "QUESTION_NOT_FOUND" });
    });
  });

  describe("listPublicQuestions", () => {
    it("fetches OPEN/ANSWERED/CLOSED questions", async () => {
      store.listPublic = vi.fn().mockResolvedValue([{ id: "q1" }]);

      const result = await service.listPublicQuestions({
        category: "USTADZ",
        limit: 10,
        offset: 0,
      });

      expect(store.listPublic).toHaveBeenCalledWith({
        category: "USTADZ",
        limit: 10,
        offset: 0,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("listMyQuestions", () => {
    it("fetches questions by asker", async () => {
      store.listByAsker = vi.fn().mockResolvedValue([{ id: "q1" }]);

      const result = await service.listMyQuestions("member1", { limit: 10, offset: 0 });

      expect(store.listByAsker).toHaveBeenCalledWith("member1", { limit: 10, offset: 0 });
      expect(result).toHaveLength(1);
    });
  });

  describe("listForModeration", () => {
    it("fetches PENDING questions for admin", async () => {
      store.listForModeration = vi.fn().mockResolvedValue([{ id: "q1" }]);

      const result = await service.listForModeration({ limit: 10, offset: 0 });

      expect(store.listForModeration).toHaveBeenCalledWith({ limit: 10, offset: 0 });
      expect(result).toHaveLength(1);
    });
  });
});
