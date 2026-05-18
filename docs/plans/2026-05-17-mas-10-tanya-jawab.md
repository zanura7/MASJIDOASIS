# MAS-10: Tanya Jawab Ustadz/Dokter Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.
> Ensure strict TDD (Red-Green-Refactor) per test-driven-development skill.

**Goal:** Implement Q&A system where members ask questions, admins moderate (approve/reject), and Ustadz/Dokter answer.

**Architecture:**
1. Update `QuestionStatus` enum in Prisma schema to support moderation (`PENDING`, `OPEN`, `ANSWERED`, `REJECTED`, `CLOSED`).
2. Build `QuestionService` handling member question submission, admin moderation, and feed listing.
3. Build `AnswerService` handling Ustadz/Dokter answers to `OPEN` questions.
4. Expose API routes for Admin (moderate), Member (ask, view), Ustadz/Dokter (answer).

**Tech Stack:** Next.js API Routes, Prisma, Vitest.

---

### Task 1: Schema & QuestionService Core (Ask, Moderate)

**Objective:** Allow members to ask questions and admins to moderate them.

**Steps:**
1. Update schema: `QuestionStatus` -> `PENDING`, `OPEN`, `ANSWERED`, `REJECTED`, `CLOSED`. Run migration.
2. Write tests for `askQuestion` (defaults to PENDING) and `moderateQuestion` (updates status to OPEN/REJECTED).
3. Implement `QuestionService` and `QuestionStore` adapter.
4. Pass tests.

### Task 2: QuestionService List & Feeds

**Objective:** Allow fetching questions by status/category.

**Steps:**
1. Write tests for `listPublicQuestions` (only OPEN, ANSWERED, CLOSED, not private), `listMyQuestions` (asker), `listForModeration` (admin, PENDING).
2. Implement methods in service and adapter.
3. Pass tests.

### Task 3: AnswerService

**Objective:** Allow Ustadz/Dokter to answer OPEN questions.

**Steps:**
1. Write tests for `answerQuestion` (must be Ustadz/Dokter, updates question status to ANSWERED) and `getAnswers`.
2. Implement `AnswerService` and `AnswerStore` adapter.
3. Pass tests.

### Task 4: API Endpoints

**Objective:** ExposeREST API.

**Steps:**
1. Write tests for API routes.
2. Implement `POST /api/qa/questions` (member)
3. Implement `GET /api/qa/questions` (public feed)
4. Implement `GET /api/qa/questions/me` (member private)
5. Implement `GET /api/admin/qa/questions` & `POST /api/admin/qa/questions/[id]/moderate` (admin)
6. Implement `POST /api/qa/questions/[id]/answers` (ustadz/dokter)
7. Pass tests.
