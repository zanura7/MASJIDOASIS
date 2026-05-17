export class CommentServiceError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = "CommentServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type CommentStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CommentRecord {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  status: CommentStatus;
  parentId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  author?: { name: string; avatarUrl: string | null };
  [key: string]: unknown;
}

export interface CreateCommentInput {
  postId: string;
  authorId: string;
  body: string;
  parentId?: string;
}

export interface CommentStore {
  create(input: {
    postId: string;
    authorId: string;
    body: string;
    status: CommentStatus;
    parentId: string | null;
  }): Promise<CommentRecord>;

  updateStatus(commentId: string, status: CommentStatus): Promise<CommentRecord>;

  delete(commentId: string): Promise<void>;

  findById(commentId: string): Promise<CommentRecord | null>;

  listByPost(
    postId: string,
    opts: { limit: number; offset: number; status?: CommentStatus },
  ): Promise<CommentRecord[]>;
}

export interface CommentServiceDeps {
  store: CommentStore;
}

export class CommentService {
  private store: CommentStore;

  constructor(deps: CommentServiceDeps) {
    this.store = deps.store;
  }

  async addComment(input: CreateCommentInput): Promise<CommentRecord> {
    if (!input.body || input.body.trim() === "") {
      throw new CommentServiceError("VALIDATION_ERROR", 400, "comment body is required");
    }

    return this.store.create({
      postId: input.postId,
      authorId: input.authorId,
      body: input.body.trim(),
      status: "APPROVED", // auto-approve for now, can be configured later
      parentId: input.parentId ?? null,
    });
  }

  async moderateComment(commentId: string, status: CommentStatus): Promise<CommentRecord> {
    const existing = await this.store.findById(commentId);
    if (!existing) {
      throw new CommentServiceError("COMMENT_NOT_FOUND", 404, "comment not found");
    }
    return this.store.updateStatus(commentId, status);
  }

  async deleteComment(commentId: string): Promise<void> {
    const existing = await this.store.findById(commentId);
    if (!existing) {
      throw new CommentServiceError("COMMENT_NOT_FOUND", 404, "comment not found");
    }
    await this.store.delete(commentId);
  }

  async listPostComments(
    postId: string,
    opts: { limit: number; offset: number },
  ): Promise<CommentRecord[]> {
    return this.store.listByPost(postId, { ...opts, status: "APPROVED" });
  }
}
