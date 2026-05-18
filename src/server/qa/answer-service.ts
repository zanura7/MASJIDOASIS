import type { QuestionStore } from "./question-service";

export class AnswerServiceError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = "AnswerServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface AnswerRecord {
  id: string;
  questionId: string;
  responderId: string;
  body: string;
  acceptedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  responder?: { name: string; avatarUrl: string | null };
  [key: string]: unknown;
}

export interface AnswerQuestionInput {
  questionId: string;
  responderId: string;
  body: string;
}

export interface AnswerStore {
  create(input: {
    questionId: string;
    responderId: string;
    body: string;
  }): Promise<AnswerRecord>;

  listByQuestion(questionId: string): Promise<AnswerRecord[]>;
}

export interface AnswerServiceDeps {
  answerStore: AnswerStore;
  questionStore: QuestionStore;
}

export class AnswerService {
  private answerStore: AnswerStore;
  private questionStore: QuestionStore;

  constructor(deps: AnswerServiceDeps) {
    this.answerStore = deps.answerStore;
    this.questionStore = deps.questionStore;
  }

  async answerQuestion(input: AnswerQuestionInput): Promise<AnswerRecord> {
    if (!input.body || input.body.trim() === "") {
      throw new AnswerServiceError("VALIDATION_ERROR", 400, "answer body is required");
    }

    const question = await this.questionStore.findById(input.questionId);
    if (!question) {
      throw new AnswerServiceError("QUESTION_NOT_FOUND", 404, "question not found");
    }

    if (question.status !== "OPEN") {
      throw new AnswerServiceError(
        "INVALID_STATUS",
        400,
        `cannot answer question with status ${question.status}`,
      );
    }

    const answer = await this.answerStore.create({
      questionId: input.questionId,
      responderId: input.responderId,
      body: input.body.trim(),
    });

    await this.questionStore.updateStatus(input.questionId, "ANSWERED");

    return answer;
  }

  async getAnswers(questionId: string): Promise<AnswerRecord[]> {
    return this.answerStore.listByQuestion(questionId);
  }
}
