import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  CommentService,
  CommentServiceError,
  type CommentStore,
} from "./comment-service";

function makeStore(overrides: Partial<CommentStore> = {}): CommentStore {
  return {
    create: vi.fn().mockResolvedValue({
      id: "comment_1",
      postId: "post_1",
      authorId: "member_1",
      body: "Komentar bagus",
      status: "APPROVED",
      parentId: null,
      createdAt: new Date(),
    }),
    updateStatus: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue({
      id: "comment_1",
      status: "APPROVED",
    }),
    listByPost: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("CommentService", () => {
  let store: CommentStore;
  let service: CommentService;

  beforeEach(() => {
    store = makeStore();
    service = new CommentService({ store });
  });

  describe("addComment", () => {
    it("creates a new comment with APPROVED status", async () => {
      const result = await service.addComment({
        postId: "post_1",
        authorId: "member_1",
        body: "Mantap",
      });

      expect(store.create).toHaveBeenCalledWith({
        postId: "post_1",
        authorId: "member_1",
        body: "Mantap",
        status: "APPROVED",
        parentId: null,
      });
      expect(result.id).toBe("comment_1");
    });

    it("rejects empty body", async () => {
      await expect(
        service.addComment({ postId: "p", authorId: "a", body: "" }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  describe("moderateComment", () => {
    it("updates status to REJECTED", async () => {
      await service.moderateComment("comment_1", "REJECTED");
      expect(store.updateStatus).toHaveBeenCalledWith("comment_1", "REJECTED");
    });

    it("rejects non-existent comment", async () => {
      store.findById = vi.fn().mockResolvedValue(null);
      await expect(
        service.moderateComment("nope", "APPROVED"),
      ).rejects.toMatchObject({ code: "COMMENT_NOT_FOUND" });
    });
  });

  describe("listPostComments", () => {
    it("fetches APPROVED comments for a post", async () => {
      store.listByPost = vi.fn().mockResolvedValue([{ id: "c1" }]);

      const result = await service.listPostComments("post_1", { limit: 10, offset: 0 });

      expect(store.listByPost).toHaveBeenCalledWith("post_1", { limit: 10, offset: 0, status: "APPROVED" });
      expect(result).toHaveLength(1);
    });
  });
});
