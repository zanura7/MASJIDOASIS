import { prisma } from "@/server/db";

import { QuestionService } from "./question-service";
import { AnswerService } from "./answer-service";
import { buildQuestionStore, buildAnswerStore } from "./prisma-store";

export function buildQuestionService(): QuestionService {
  return new QuestionService({
    store: buildQuestionStore(prisma),
  });
}

export function buildAnswerService(): AnswerService {
  return new AnswerService({
    answerStore: buildAnswerStore(prisma),
    questionStore: buildQuestionStore(prisma),
  });
}
