-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropIndex
DROP INDEX "comments_postId_idx";

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "status" "CommentStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "comments_postId_status_idx" ON "comments"("postId", "status");
