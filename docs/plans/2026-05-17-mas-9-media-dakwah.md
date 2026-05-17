# MAS-9: Media Dakwah Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.
> Ensure strict TDD (Red-Green-Refactor) per test-driven-development skill.

**Goal:** Implement CRUD and feed delivery for Dakwah posts (articles/videos) including member comments and moderation.

**Architecture:** 
1. Build `PostService` handling create, update, list (feed), and publish/unpublish.
2. Build `CommentService` handling comment creation, moderation (approve/reject), and list.
3. Expose API routes for Admin (CRUD posts, moderate comments) and Member (feed, detail, create comment).
4. Rely on existing Prisma `Post` and `Comment` models (`PostKind`, `PostStatus`, `CommentStatus`).

**Tech Stack:** Next.js API Routes, Prisma, Vitest.

---

### Task 1: PostService Core (Create/Update/Delete)

**Objective:** Build service layer for admins to manage dakwah posts.

**Files:**
- Create: `src/server/dakwah/post-service.ts`
- Create: `src/server/dakwah/post-service.test.ts`
- Create: `src/server/dakwah/prisma-store.ts`

**Steps:**
1. Write failing tests for `createPost`, `updatePost`, `deletePost`.
2. Implement `PostService` wrapping `PostStore` adapter.
3. Pass tests.

---

### Task 2: PostService Feed & Publish Lifecycle

**Objective:** Allow admins to publish/unpublish, and members to fetch the feed.

**Files:**
- Modify: `src/server/dakwah/post-service.ts`
- Modify: `src/server/dakwah/post-service.test.ts`

**Steps:**
1. Write failing tests for `setPublishStatus` (updates `publishedAt`), `getFeed` (filters published, sorts descending), and `getPostBySlug`.
2. Implement methods in service and store adapter.
3. Pass tests.

---

### Task 3: CommentService Core

**Objective:** Build service for users to comment and admins to moderate.

**Files:**
- Create: `src/server/dakwah/comment-service.ts`
- Create: `src/server/dakwah/comment-service.test.ts`
- Modify: `src/server/dakwah/prisma-store.ts`

**Steps:**
1. Write failing tests for `addComment` (default status PENDING/APPROVED depending on config, let's use APPROVED by default for now unless specified), `moderateComment` (admin sets REJECTED/APPROVED), and `listPostComments`.
2. Implement service and store methods.
3. Pass tests.

---

### Task 4: Admin API Endpoints

**Objective:** Expose REST API for admin management.

**Files:**
- Create: `src/app/api/admin/posts/route.ts` (GET list, POST create)
- Create: `src/app/api/admin/posts/[id]/route.ts` (PUT update, DELETE, PATCH status)
- Create: `src/app/api/admin/comments/[id]/moderate/route.ts` (POST approve/reject)

**Steps:**
1. Write failing tests mocking `PostService` and `requireRole("ADMIN")`.
2. Implement endpoints.
3. Pass tests.

---

### Task 5: Public/Member API Endpoints

**Objective:** Expose endpoints for the frontend feed and commenting.

**Files:**
- Create: `src/app/api/posts/route.ts` (GET public feed)
- Create: `src/app/api/posts/[slug]/route.ts` (GET single post + comments)
- Create: `src/app/api/posts/[slug]/comments/route.ts` (POST add comment, requires auth)

**Steps:**
1. Write failing tests (no auth for GET, MEMBER auth for POST).
2. Implement endpoints.
3. Pass tests.
