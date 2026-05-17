import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  PostService,
  PostServiceError,
  type PostStore,
} from "./post-service";

function makeStore(overrides: Partial<PostStore> = {}): PostStore {
  return {
    create: vi.fn().mockResolvedValue({
      id: "post_1",
      authorId: "admin_1",
      slug: "judul-dakwah",
      kind: "ARTICLE",
      title: "Judul Dakwah",
      body: "Isi dakwah",
      videoUrl: null,
      coverImage: null,
      status: "DRAFT",
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    update: vi.fn().mockResolvedValue({ id: "post_1" }),
    delete: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue({
      id: "post_1",
      authorId: "admin_1",
      slug: "judul-dakwah",
      kind: "ARTICLE",
      title: "Judul Dakwah",
      body: "Isi dakwah",
      videoUrl: null,
      coverImage: null,
      status: "DRAFT",
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findBySlug: vi.fn().mockResolvedValue(null),
    listFeed: vi.fn().mockResolvedValue([]),
    listAll: vi.fn().mockResolvedValue([]),
    countBySlug: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe("PostService", () => {
  let store: PostStore;
  let service: PostService;

  beforeEach(() => {
    store = makeStore();
    service = new PostService({ store });
  });

  // --- Task 1: CRUD ---

  describe("createPost", () => {
    it("creates a DRAFT post with auto-generated slug", async () => {
      const result = await service.createPost({
        authorId: "admin_1",
        kind: "ARTICLE",
        title: "Judul Dakwah",
        body: "Isi dakwah",
      });

      expect(store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: "admin_1",
          kind: "ARTICLE",
          title: "Judul Dakwah",
          body: "Isi dakwah",
          slug: expect.stringContaining("judul-dakwah"),
          status: "DRAFT",
        }),
      );
      expect(result.id).toBe("post_1");
    });

    it("creates VIDEO post with videoUrl", async () => {
      await service.createPost({
        authorId: "admin_1",
        kind: "VIDEO",
        title: "Video Dakwah",
        body: "Deskripsi video",
        videoUrl: "https://youtube.com/watch?v=abc",
      });

      expect(store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "VIDEO",
          videoUrl: "https://youtube.com/watch?v=abc",
        }),
      );
    });

    it("generates unique slug when duplicate exists", async () => {
      store.countBySlug = vi.fn()
        .mockResolvedValueOnce(1) // first slug taken
        .mockResolvedValueOnce(0); // suffixed slug free

      await service.createPost({
        authorId: "admin_1",
        kind: "ARTICLE",
        title: "Judul Dakwah",
        body: "Isi",
      });

      // Should append suffix
      const call = vi.mocked(store.create).mock.calls[0][0];
      expect(call.slug).toMatch(/^judul-dakwah-\d+$/);
    });

    it("rejects empty title", async () => {
      await expect(
        service.createPost({ authorId: "a", kind: "ARTICLE", title: "", body: "x" }),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });
  });

  describe("updatePost", () => {
    it("updates title and body", async () => {
      await service.updatePost("post_1", { title: "Baru", body: "Isi baru" });

      expect(store.update).toHaveBeenCalledWith(
        "post_1",
        expect.objectContaining({ title: "Baru", body: "Isi baru" }),
      );
    });

    it("rejects update on non-existent post", async () => {
      store.findById = vi.fn().mockResolvedValue(null);

      await expect(
        service.updatePost("nope", { title: "X" }),
      ).rejects.toMatchObject({ code: "POST_NOT_FOUND" });
    });
  });

  describe("deletePost", () => {
    it("deletes existing post", async () => {
      await service.deletePost("post_1");
      expect(store.delete).toHaveBeenCalledWith("post_1");
    });

    it("rejects delete on non-existent post", async () => {
      store.findById = vi.fn().mockResolvedValue(null);
      await expect(service.deletePost("nope")).rejects.toMatchObject({ code: "POST_NOT_FOUND" });
    });
  });

  // --- Task 2: Feed & Publish ---

  describe("publish / unpublish", () => {
    it("publishes DRAFT → PUBLISHED with publishedAt", async () => {
      store.findById = vi.fn().mockResolvedValue({ id: "post_1", status: "DRAFT" });

      await service.setPublishStatus("post_1", "PUBLISHED");

      expect(store.update).toHaveBeenCalledWith(
        "post_1",
        expect.objectContaining({
          status: "PUBLISHED",
          publishedAt: expect.any(Date),
        }),
      );
    });

    it("unpublishes PUBLISHED → DRAFT, clears publishedAt", async () => {
      store.findById = vi.fn().mockResolvedValue({ id: "post_1", status: "PUBLISHED" });

      await service.setPublishStatus("post_1", "DRAFT");

      expect(store.update).toHaveBeenCalledWith(
        "post_1",
        expect.objectContaining({
          status: "DRAFT",
          publishedAt: null,
        }),
      );
    });

    it("archives post", async () => {
      store.findById = vi.fn().mockResolvedValue({ id: "post_1", status: "PUBLISHED" });

      await service.setPublishStatus("post_1", "ARCHIVED");

      expect(store.update).toHaveBeenCalledWith(
        "post_1",
        expect.objectContaining({ status: "ARCHIVED" }),
      );
    });
  });

  describe("getFeed", () => {
    it("returns published posts sorted by publishedAt desc", async () => {
      const posts = [
        { id: "p2", title: "Newer", publishedAt: new Date("2026-01-02") },
        { id: "p1", title: "Older", publishedAt: new Date("2026-01-01") },
      ];
      store.listFeed = vi.fn().mockResolvedValue(posts);

      const result = await service.getFeed({ limit: 10, offset: 0 });

      expect(store.listFeed).toHaveBeenCalledWith({ limit: 10, offset: 0 });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("p2");
    });
  });

  describe("getPostBySlug", () => {
    it("returns post with author info", async () => {
      store.findBySlug = vi.fn().mockResolvedValue({
        id: "post_1",
        slug: "judul-dakwah",
        title: "Judul",
        author: { name: "Admin" },
      });

      const result = await service.getPostBySlug("judul-dakwah");
      expect(result).toMatchObject({ slug: "judul-dakwah" });
    });

    it("returns null for unknown slug", async () => {
      store.findBySlug = vi.fn().mockResolvedValue(null);
      const result = await service.getPostBySlug("nope");
      expect(result).toBeNull();
    });
  });
});
