import { prisma } from "@/server/db";

import { PostService } from "./post-service";
import { CommentService } from "./comment-service";
import { buildPostStore, buildCommentStore } from "./prisma-store";

export function buildPostService(): PostService {
  return new PostService({
    store: buildPostStore(prisma),
  });
}

export function buildCommentService(): CommentService {
  return new CommentService({
    store: buildCommentStore(prisma),
  });
}
