/**
 * Prisma adapters for PostStore and CommentStore.
 */

import type { PrismaClient } from "@prisma/client";
import type { PostStore, PostRecord, PostKind, PostStatus } from "./post-service";
import type { CommentStore, CommentRecord, CommentStatus } from "./comment-service";

export function buildPostStore(prisma: PrismaClient): PostStore {
  return {
    async create(input) {
      const row = await prisma.post.create({
        data: {
          authorId: input.authorId,
          slug: input.slug,
          kind: input.kind as any,
          title: input.title,
          body: input.body,
          videoUrl: input.videoUrl,
          coverImage: input.coverImage,
          status: input.status as any,
          publishedAt: input.publishedAt,
        },
      });
      return row as unknown as PostRecord;
    },

    async update(postId, patch) {
      const data: Record<string, unknown> = {};
      if (patch.title !== undefined) data.title = patch.title;
      if (patch.body !== undefined) data.body = patch.body;
      if (patch.videoUrl !== undefined) data.videoUrl = patch.videoUrl;
      if (patch.coverImage !== undefined) data.coverImage = patch.coverImage;
      if (patch.status !== undefined) data.status = patch.status as any;
      if (patch.publishedAt !== undefined) data.publishedAt = patch.publishedAt;

      const row = await prisma.post.update({
        where: { id: postId },
        data,
      });
      return row as unknown as PostRecord;
    },

    async delete(postId) {
      await prisma.post.delete({ where: { id: postId } });
    },

    async findById(postId) {
      const row = await prisma.post.findUnique({
        where: { id: postId },
        include: { author: { select: { name: true } } },
      });
      return (row as unknown as PostRecord) ?? null;
    },

    async findBySlug(slug) {
      const row = await prisma.post.findUnique({
        where: { slug },
        include: { author: { select: { name: true, avatarUrl: true } } },
      });
      return (row as unknown as PostRecord) ?? null;
    },

    async countBySlug(slug) {
      return prisma.post.count({ where: { slug } });
    },

    async listFeed(opts) {
      const rows = await prisma.post.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: opts.limit,
        skip: opts.offset,
        include: { author: { select: { name: true, avatarUrl: true } } },
      });
      return rows as unknown as PostRecord[];
    },

    async listAll(opts) {
      const rows = await prisma.post.findMany({
        orderBy: { createdAt: "desc" },
        take: opts.limit,
        skip: opts.offset,
        include: { author: { select: { name: true } } },
      });
      return rows as unknown as PostRecord[];
    },
  };
}

export function buildCommentStore(prisma: PrismaClient): CommentStore {
  return {
    async create(input) {
      const row = await prisma.comment.create({
        data: {
          postId: input.postId,
          authorId: input.authorId,
          body: input.body,
          status: input.status as any,
          parentId: input.parentId,
        },
        include: { author: { select: { name: true, avatarUrl: true } } },
      });
      return row as unknown as CommentRecord;
    },

    async updateStatus(commentId, status) {
      const row = await prisma.comment.update({
        where: { id: commentId },
        data: { status: status as any },
      });
      return row as unknown as CommentRecord;
    },

    async delete(commentId) {
      await prisma.comment.delete({ where: { id: commentId } });
    },

    async findById(commentId) {
      const row = await prisma.comment.findUnique({ where: { id: commentId } });
      return (row as unknown as CommentRecord) ?? null;
    },

    async listByPost(postId, opts) {
      const where: Record<string, unknown> = { postId };
      if (opts.status) where.status = opts.status;

      const rows = await prisma.comment.findMany({
        where,
        orderBy: { createdAt: "asc" },
        take: opts.limit,
        skip: opts.offset,
        include: { author: { select: { name: true, avatarUrl: true } } },
      });
      return rows as unknown as CommentRecord[];
    },
  };
}
