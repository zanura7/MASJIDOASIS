import type { PrismaClient } from "@prisma/client";

import type {
  QuestionStore,
  QuestionRecord,
  QuestionCategory,
  QuestionStatus,
} from "./question-service";
import type { AnswerStore, AnswerRecord } from "./answer-service";

export function buildQuestionStore(prisma: PrismaClient): QuestionStore {
  return {
    async create(input) {
      const row = await prisma.question.create({
        data: {
          askerId: input.askerId,
          category: input.category as any,
          title: input.title,
          body: input.body,
          status: input.status as any,
          isPrivate: input.isPrivate,
        },
        include: {
          asker: { select: { name: true, avatarUrl: true } },
        },
      });
      return row as unknown as QuestionRecord;
    },

    async updateStatus(id, status) {
      const row = await prisma.question.update({
        where: { id },
        data: { status: status as any },
      });
      return row as unknown as QuestionRecord;
    },

    async findById(id) {
      const row = await prisma.question.findUnique({
        where: { id },
        include: {
          asker: { select: { name: true, avatarUrl: true } },
          answers: {
            include: { responder: { select: { name: true, avatarUrl: true, role: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      return (row as unknown as QuestionRecord) ?? null;
    },

    async listPublic(opts) {
      const where: Record<string, unknown> = {
        isPrivate: false,
        status: { in: ["OPEN", "ANSWERED", "CLOSED"] },
      };
      if (opts.category) where.category = opts.category;

      const rows = await prisma.question.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: opts.limit,
        skip: opts.offset,
        include: {
          asker: { select: { name: true, avatarUrl: true } },
          answers: {
            include: { responder: { select: { name: true, avatarUrl: true, role: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      return rows as unknown as QuestionRecord[];
    },

    async listByAsker(askerId, opts) {
      const rows = await prisma.question.findMany({
        where: { askerId },
        orderBy: { createdAt: "desc" },
        take: opts.limit,
        skip: opts.offset,
        include: {
          answers: {
            include: { responder: { select: { name: true, avatarUrl: true, role: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      return rows as unknown as QuestionRecord[];
    },

    async listForModeration(opts) {
      const rows = await prisma.question.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: opts.limit,
        skip: opts.offset,
        include: {
          asker: { select: { name: true, avatarUrl: true } },
        },
      });
      return rows as unknown as QuestionRecord[];
    },
  };
}

export function buildAnswerStore(prisma: PrismaClient): AnswerStore {
  return {
    async create(input) {
      const row = await prisma.answer.create({
        data: {
          questionId: input.questionId,
          responderId: input.responderId,
          body: input.body,
        },
        include: {
          responder: { select: { name: true, avatarUrl: true, role: true } },
        },
      });
      return row as unknown as AnswerRecord;
    },

    async listByQuestion(questionId) {
      const rows = await prisma.answer.findMany({
        where: { questionId },
        orderBy: { createdAt: "asc" },
        include: {
          responder: { select: { name: true, avatarUrl: true, role: true } },
        },
      });
      return rows as unknown as AnswerRecord[];
    },
  };
}
