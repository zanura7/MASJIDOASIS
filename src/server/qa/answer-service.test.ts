import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  AnswerService,
  AnswerServiceError,
  type AnswerStore,
} from "./answer-service";
import type { QuestionStore, QuestionStatus } from "./question-service";

function makeAnswerStore(overrides: Partial<AnswerStore> = {}): AnswerStore {
  return {
    create: vi.fn().mockResolvedValue({
      id: "a1",
      questionId: "q1",
      responderId: "u1",
      body: "Ini jawabannya",
      createdAt: new Date(),
    }),
    listByQuestion: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeQuestionStore(overrides: Partial<QuestionStore> = {}): QuestionStore {
  return {
    create: vi.fn(),
    updateStatus: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      id: "q1",
      status: "OPEN",
    }),
    listPublic: vi.fn(),
    listByAsker: vi.fn(),
    listForModeration: vi.fn(),
    ...overrides,
  };
}

describe("AnswerService", () => {
  let answerStore: AnswerStore;
  let questionStore: QuestionStore;
  let service: AnswerService;

  beforeEach(() => {
    answerStore = makeAnswerStore();
    questionStore = makeQuestionStore();
    service = new AnswerService({ answerStore, questionStore });
  });

  describe("answerQuestion", () => {
    it("creates answer and updates question status to ANSWERED", async () => {
      const result = await service.answerQuestion({
        questionId: "q1",
        responderId: "u1",
        body: "Ini jawaban",
      });

      expect(answerStore.create).toHaveBeenCalledWith({
        questionId: "q1",
        responderId: "u1",
        body: "Ini jawaban",
      });
      expect(questionStore.updateStatus).toHaveBeenCalledWith("q1", "ANSWERED");
      expect(result.id).toBe("a1");
    });

    it("rejects answering non-existent question", async () => {
      questionStore.findById = vi.fn().mockResolvedValue(null);
      await expect(
        service.answerQuestion({ questionId: "nope", responderId: "u1", body: "x" }),
      ).rejects.toMatchObject({ code: "QUESTION_NOT_FOUND" });
    });

    it("rejects answering question that is not OPEN", async () => {
      questionStore.findById = vi.fn().mockResolvedValue({ id: "q1", status: "CLOSED" });
      await expect(
        service.answerQuestion({ questionId: "q1", responderId: "u1", body: "x" }),
      ).rejects.toMatchObject({ code: "INVALID_STATUS" });
    });

    it("rejects empty body", async () => {
      await expect(
        service.answerQuestion({ questionId: "q1", responderId: "u1", body: "" }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  describe("getAnswers", () => {
    it("returns answers for a question", async () => {
      answerStore.listByQuestion = vi.fn().mockResolvedValue([{ id: "a1" }]);
      const result = await service.getAnswers("q1");
      expect(answerStore.listByQuestion).toHaveBeenCalledWith("q1");
      expect(result).toHaveLength(1);
    });
  });
});
