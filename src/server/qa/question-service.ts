export class QuestionServiceError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = "QuestionServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type QuestionCategory = "USTADZ" | "DOKTER";
export type QuestionStatus = "PENDING" | "OPEN" | "ANSWERED" | "REJECTED" | "CLOSED";

export interface QuestionRecord {
  id: string;
  askerId: string;
  category: QuestionCategory;
  title: string;
  body: string;
  status: QuestionStatus;
  isPrivate: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  asker?: { name: string; avatarUrl: string | null };
  answers?: unknown[];
  [key: string]: unknown;
}

export interface AskQuestionInput {
  askerId: string;
  category: QuestionCategory;
  title: string;
  body: string;
  isPrivate?: boolean;
}

export interface QuestionStore {
  create(input: {
    askerId: string;
    category: QuestionCategory;
    title: string;
    body: string;
    status: QuestionStatus;
    isPrivate: boolean;
  }): Promise<QuestionRecord>;

  updateStatus(id: string, status: QuestionStatus): Promise<QuestionRecord>;

  findById(id: string): Promise<QuestionRecord | null>;

  listPublic(opts: {
    category?: QuestionCategory;
    limit: number;
    offset: number;
  }): Promise<QuestionRecord[]>;

  listByAsker(askerId: string, opts: { limit: number; offset: number }): Promise<QuestionRecord[]>;

  listForModeration(opts: { limit: number; offset: number }): Promise<QuestionRecord[]>;
}

export interface QuestionServiceDeps {
  store: QuestionStore;
}

export class QuestionService {
  private store: QuestionStore;

  constructor(deps: QuestionServiceDeps) {
    this.store = deps.store;
  }

  async askQuestion(input: AskQuestionInput): Promise<QuestionRecord> {
    if (!input.title || input.title.trim() === "") {
      throw new QuestionServiceError("VALIDATION_ERROR", 400, "title is required");
    }
    if (!input.body || input.body.trim() === "") {
      throw new QuestionServiceError("VALIDATION_ERROR", 400, "body is required");
    }

    return this.store.create({
      askerId: input.askerId,
      category: input.category,
      title: input.title.trim(),
      body: input.body.trim(),
      status: "PENDING", // needs moderation
      isPrivate: input.isPrivate ?? false,
    });
  }

  async moderateQuestion(id: string, status: QuestionStatus): Promise<QuestionRecord> {
    const existing = await this.store.findById(id);
    if (!existing) {
      throw new QuestionServiceError("QUESTION_NOT_FOUND", 404, "question not found");
    }

    return this.store.updateStatus(id, status);
  }

  async listPublicQuestions(opts: {
    category?: QuestionCategory;
    limit: number;
    offset: number;
  }): Promise<QuestionRecord[]> {
    return this.store.listPublic(opts);
  }

  async listMyQuestions(
    askerId: string,
    opts: { limit: number; offset: number },
  ): Promise<QuestionRecord[]> {
    return this.store.listByAsker(askerId, opts);
  }

  async listForModeration(opts: { limit: number; offset: number }): Promise<QuestionRecord[]> {
    return this.store.listForModeration(opts);
  }

  async getQuestionDetail(id: string): Promise<QuestionRecord | null> {
    return this.store.findById(id);
  }
}
