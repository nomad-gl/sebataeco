# Multi-Tenant Data Isolation Audit

## Strategy

Each **director** creates a **tenant** when they first sign in (or when a SEBA admin promotes them). All users they invite inherit that `tenant_id`. Every data query is filtered by `tenant_id` from `ctx.user`. SEBA admins (`role === 'admin'`) bypass the filter and see all tenants.

The isolation is implemented at the **database query layer** in `server/db.ts` and enforced by a `tenantProcedure` middleware in `server/routers.ts`. No frontend changes are needed — the API simply returns less data.

---

## Table Classification

### Category A — Needs `tenant_id` column (direct tenant data)

These tables store data created by or for a specific school/director group.

| Table | Current owner column | Tenant strategy |
|---|---|---|
| `users` | — | Add `tenant_id` (nullable for admins) |
| `teaching_materials` | `userId` | Add `tenant_id` |
| `class_challenges` | `hostId` | Add `tenant_id` |
| `class_groups` | `userId` | Add `tenant_id` |
| `group_students` | via `groupId` | Inherited via group's `tenant_id` |
| `group_messages` | `userId` | Add `tenant_id` |
| `group_challenge_log` | via `groupId` | Inherited via group's `tenant_id` |
| `student_progress` | via `groupId` | Inherited via group's `tenant_id` |
| `assignments` | `userId` | Add `tenant_id` |
| `assignment_completions` | via `assignmentId` | Inherited |
| `forum_channels` | `createdBy` | Add `tenant_id` |
| `forum_messages` | `userId` | Inherited via channel's `tenant_id` |
| `forum_direct_messages` | `senderId/receiverId` | Add `tenant_id` |
| `forum_presence` | `userId` | Filter by tenant users |
| `aina_user_profiles` | `userId` | Filter by tenant users |
| `aina_message_ratings` | `userId` | Filter by tenant users |
| `school_calendars` | `userId` | Add `tenant_id` |
| `school_calendar_events` | via `calendarId` | Inherited |
| `lesson_plans` | `userId` | Add `tenant_id` |
| `ai_assessments` | `userId` | Add `tenant_id` |
| `ai_grade_overrides` | `userId` | Add `tenant_id` |
| `ai_bias_flags` | `userId` | Add `tenant_id` |
| `ai_learning_paths` | `userId` | Add `tenant_id` |
| `student_reports` | `userId` | Add `tenant_id` |
| `calendar_sessions` | `userId` | Add `tenant_id` |
| `session_templates` | `userId` | Add `tenant_id` |
| `lesson_plan_templates` | `userId` | Add `tenant_id` |
| `timetable_slots` | `userId` | Add `tenant_id` |
| `attendance_records` | via `groupId` | Inherited |
| `assessment_events` | `userId` | Add `tenant_id` |
| `saved_situacions` | `userId` | Add `tenant_id` |
| `school_settings` | `userId` | Add `tenant_id` |
| `wake_words` | `userId` | Add `tenant_id` |
| `audio_responses` | `userId` | Add `tenant_id` |
| `attendance_changes` | `userId` | Add `tenant_id` |
| `teams_channels` | `createdBy` | Add `tenant_id` |
| `teams_messages` | `userId` | Inherited via channel |
| `teams_assignments` | `createdBy` | Add `tenant_id` |
| `teams_submissions` | `userId` | Inherited |
| `teams_files` | `uploadedBy` | Add `tenant_id` |
| `individual_learning_plans` | `userId` | Add `tenant_id` |
| `individual_lesson_plans` | `userId` | Add `tenant_id` |
| `teacher_invites` | `invitedBy` | Add `tenant_id` |
| `meeting_invitations` | `inviterId` | Add `tenant_id` |
| `dm_calls` | `callerId` | Add `tenant_id` |
| `call_chat_messages` | `userId` | Add `tenant_id` |
| `webrtc_sessions` | — | Add `tenant_id` |
| `bias_scan_runs` | `userId` | Add `tenant_id` |
| `bias_scan_fix_suggestions` | via `scanRunId` | Inherited |

### Category B — System/global tables (no tenant_id needed)

These tables are either global system data or already scoped by userId with no cross-tenant risk.

| Table | Reason |
|---|---|
| `practice_sessions` | Per-user personal practice — already userId scoped, no cross-leak risk |
| `challenge_participants` | Anonymous student nicknames — no PII, no cross-tenant risk |
| `question_answers` | Global question bank answers |
| `question_review_status` | Global question bank moderation |
| `generated_questions` | Global question bank |
| `question_translations` | Global question bank |
| `admin_audit_logs` | Admin-only, already protected by adminProcedure |
| `dpa_acceptances` | Per-user legal acceptance |
| `whats_new_dismissals` | Per-user UI state |
| `error_logs` | System logs — admin only |
| `fix_history` | System logs — admin only |
| `bias_scan_runs` | Already userId scoped |
| `app_settings` | Global system config — admin only |
| `notifications` | Per-user, already userId scoped |
| `forum_reactions` | Scoped via message |
| `forum_pins` | Scoped via channel |
| `channel_files` | Scoped via channel |
| `forum_thread_replies` | Scoped via message |
| `webrtc_signals` | Ephemeral signalling |
| `webrtc_participants` | Ephemeral |
| `password_reset_tokens` | Per-user auth token |

### Category C — New table to create

| Table | Purpose |
|---|---|
| `tenants` | One row per director group: `id`, `name`, `ownerUserId`, `createdAt` |

---

## Migration Plan

1. Create `tenants` table.
2. Add `tenant_id INT NULL` to `users` table.
3. Add `tenant_id INT NOT NULL DEFAULT 0` to all Category A tables (0 = legacy/unassigned).
4. Backfill: for each existing director user, create a tenant row and set their `tenant_id`. For each user they invited (via `teacher_invites`), set the same `tenant_id`.
5. Add `tenantProcedure` middleware to `server/routers.ts`.
6. Update all db helpers in `server/db.ts` to accept and apply `tenantId`.

---

## Key Rules

- A user with `tenant_id = NULL` is a SEBA admin — they bypass all tenant filters.
- A user with `tenant_id = N` can only read/write rows where `tenant_id = N`.
- When a director invites a user, the invite row stores `tenant_id`; on registration the new user inherits it.
- The `tenants` table is only readable/writable by admins and the owning director.
