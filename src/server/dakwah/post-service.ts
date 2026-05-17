export class PostServiceError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = "PostServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type PostKind = "ARTICLE" | "VIDEO";
export type PostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface PostRecord {
  id: string;
  authorId: string;
  slug: string;
  kind: PostKind;
  title: string;
  body: string;
  videoUrl?: string | null;
  coverImage?: string | null;
  status: PostStatus;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  author?: { name: string };
  [key: string]: unknown;
}

export interface CreatePostInput {
  authorId: string;
  kind: PostKind;
  title: string;
  body: string;
  videoUrl?: string;
  coverImage?: string;
}

export interface UpdatePostInput {
  title?: string;
  body?: string;
  videoUrl?: string;
  coverImage?: string;
}

export interface PostStore {
  create(input: {
    authorId: string;
    slug: string;
    kind: PostKind;
    title: string;
    body: string;
    videoUrl?: string | null;
    coverImage?: string | null;
    status: PostStatus;
    publishedAt?: Date | null;
  }): Promise<PostRecord>;

  update(postId: string, patch: Partial<PostRecord>): Promise<PostRecord>;

  delete(postId: string): Promise<void>;

  findById(postId: string): Promise<PostRecord | null>;

  findBySlug(slug: string): Promise<PostRecord | null>;

  countBySlug(slug: string): Promise<number>;

  listFeed(opts: { limit: number; offset: number }): Promise<PostRecord[]>;

  listAll(opts: { limit: number; offset: number }): Promise<PostRecord[]>;
}

export interface PostServiceDeps {
  store: PostStore;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class PostService {
  private store: PostStore;

  constructor(deps: PostServiceDeps) {
    this.store = deps.store;
  }

  async createPost(input: CreatePostInput): Promise<PostRecord> {
    if (!input.title || input.title.trim() === "") {
      throw new PostServiceError("VALIDATION_ERROR", 400, "title is required");
    }

    let slug = slugify(input.title);
    const count = await this.store.countBySlug(slug);
    if (count > 0) {
      slug = `${slug}-${Date.now()}`;
    }

    return this.store.create({
      authorId: input.authorId,
      slug,
      kind: input.kind,
      title: input.title.trim(),
      body: input.body,
      videoUrl: input.videoUrl ?? null,
      coverImage: input.coverImage ?? null,
      status: "DRAFT",
      publishedAt: null,
    });
  }

  async updatePost(postId: string, input: UpdatePostInput): Promise<PostRecord> {
    const existing = await this.store.findById(postId);
    if (!existing) {
      throw new PostServiceError("POST_NOT_FOUND", 404, "post not found");
    }

    const patch: Partial<PostRecord> = {};
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.body !== undefined) patch.body = input.body;
    if (input.videoUrl !== undefined) patch.videoUrl = input.videoUrl;
    if (input.coverImage !== undefined) patch.coverImage = input.coverImage;

    return this.store.update(postId, patch);
  }

  async deletePost(postId: string): Promise<void> {
    const existing = await this.store.findById(postId);
    if (!existing) {
      throw new PostServiceError("POST_NOT_FOUND", 404, "post not found");
    }
    await this.store.delete(postId);
  }

  async setPublishStatus(postId: string, status: PostStatus): Promise<PostRecord> {
    const existing = await this.store.findById(postId);
    if (!existing) {
      throw new PostServiceError("POST_NOT_FOUND", 404, "post not found");
    }

    const patch: Partial<PostRecord> = { status };

    if (status === "PUBLISHED" && existing.status !== "PUBLISHED") {
      patch.publishedAt = new Date();
    } else if (status === "DRAFT") {
      patch.publishedAt = null;
    }

    return this.store.update(postId, patch);
  }

  async getFeed(opts: { limit: number; offset: number }): Promise<PostRecord[]> {
    return this.store.listFeed(opts);
  }

  async getPostBySlug(slug: string): Promise<PostRecord | null> {
    return this.store.findBySlug(slug);
  }

  async listAllAdmin(opts: { limit: number; offset: number }): Promise<PostRecord[]> {
    return this.store.listAll(opts);
  }
}
