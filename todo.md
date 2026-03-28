# SEBA AI Studio – Project TODO

## Knowledge Bank
- [x] Python build script at /home/ubuntu/build_sebasnap_knowledge.py
- [x] TypeScript knowledge bank at server/knowledge/lomloeKnowledgeBank.ts (all 8 competencies × 3 year groups = 24 blocks)

## Server / API
- [x] tRPC procedure: lomloe.getQuestions (filter by competency + yearGroup)
- [x] tRPC procedure: lomloe.getStats (coverage metrics for admin)
- [x] tRPC procedure: lomloe.chat (AI chat with knowledge bank context)

## Client – Core UI
- [x] Global design tokens in index.css (SEBA brand colours, fonts)
- [x] App.tsx routes: /, /practice, /admin
- [x] Home page with hero, competency overview cards, and CTA
- [x] Competency selector component (filter by code + year group)

## Client – AI Chat
- [x] AI chat page with custom chat UI
- [x] LLM responses with LOMLOE knowledge context
- [x] Out-of-scope question handling (advise user politely)

## Client – Practice Mode
- [x] Practice page: question display with 4-option MCQ
- [x] Answer validation with correct/incorrect feedback
- [x] Explanation shown after answer
- [x] Score tracker per session

## Client – Admin Dashboard
- [x] Admin route with knowledge bank stats
- [x] Knowledge bank statistics table (questions per competency/year group)
- [x] Coverage metrics visualisation (bar chart)

## Quality
- [x] Vitest tests for tRPC procedures (24 tests passing)
- [x] TypeScript 0-error check (npx tsc --noEmit)
- [x] pnpm test --run passes (24/24)
- [x] pnpm build succeeds
