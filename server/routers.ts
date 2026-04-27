import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { lomloeRouter } from "./routers/lomloe";
import { materialsRouter } from "./routers/materials";
import { challengeRouter } from "./routers/challenge";
import { groupsRouter } from "./routers/groups";
import { progressRouter } from "./routers/progress";
import { forumRouter } from "./routers/forum";
import { presentationsRouter } from "./routers/presentations";
import { analyticsRouter } from "./routers/analytics";
import { notificationsRouter } from "./routers/notifications";
import { voiceRouter } from "./routers/voice";
import { plannerRouter } from "./routers/planner";
import { geoDialectRouter } from "./routers/geoDialect";
import { accountabilityRouter } from "./routers/accountability";
import { privacyRouter } from "./routers/privacy";
import { auditRouter } from "./routers/audit";
import { dpaRouter } from "./routers/dpa";
import { whatsNewRouter } from "./routers/whatsNew";
import { selfHealRouter } from "./routers/selfHeal";
import { assignmentRequestsRouter } from "./routers/assignmentRequests";
import { teacherAttendanceRouter } from "./routers/teacherAttendance";
import { teacherProfileRouter } from "./routers/teacherProfile";
import { directorRouter } from "./routers/director";
import { hosRouter } from "./routers/hos";
import { wakeWordsRouter } from "./routers/wakeWords";
import { audioResponsesRouter } from "./routers/audioResponses";
import { attendanceRouter } from "./routers/attendance";
import { teamsRouter } from "./routers/teams";
import { dmCallRouter } from "./routers/dmCall";
import { webrtcRouter } from "./routers/webrtc";
import { meetingInvitationRouter } from "./routers/meetingInvitation";
import { callChatRouter } from "./routers/callChat";
import { callBackgroundRouter } from "./routers/callBackground";
import { ainaRouter } from "./routers/aina";
import { localAuthRouter } from "./routers/localAuth";
import { ilpRouter, lessonPlanRouter } from "./routers/individualPlans";
import { tenantsRouter } from "./routers/tenants";
import { territorialDirectorRouter } from "./routers/territorialDirector";
import { registerRouter } from "./routers/register";
import { coverRouter } from "./routers/cover";
import { infantilRouter } from "./routers/infantil";
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    setTtsVoice: protectedProcedure
      .input(z.object({ voice: z.enum(["nova", "shimmer", "alloy", "fable"]) }))
      .mutation(async ({ ctx, input }) => {
        const dbConn = await getDb();
        if (!dbConn) return { success: false };
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbConn.update(users).set({ ttsVoice: input.voice }).where(eq(users.id, ctx.user.id));
        return { success: true };
      }),

    setCutcgMemberNumber: protectedProcedure
      .input(z.object({ memberNumber: z.string().max(32).nullable() }))
      .mutation(async ({ ctx, input }) => {
        const dbConn = await getDb();
        if (!dbConn) return { success: false };
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbConn.update(users).set({ cutcgMemberNumber: input.memberNumber }).where(eq(users.id, ctx.user.id));
        return { success: true };
      }),

    /**
     * Change the current user's password.
     * If mustChangePassword is true, clears the flag after a successful change.
     * Requires the current password to be supplied (prevents CSRF abuse).
     */
    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1),
          newPassword: z.string().min(8).max(128),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { TRPCError } = await import("@trpc/server");
        const dbConn = await getDb();
        if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");

        // Fetch the stored hash
        const [row] = await dbConn
          .select({ passwordHash: users.passwordHash, mustChangePassword: users.mustChangePassword })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);

        if (!row?.passwordHash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No local password is set for this account. Use Manus OAuth to sign in.",
          });
        }

        const valid = await bcrypt.compare(input.currentPassword, row.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
        }

        const newHash = await bcrypt.hash(input.newPassword, 12);
        await dbConn
          .update(users)
          .set({ passwordHash: newHash, mustChangePassword: false })
          .where(eq(users.id, ctx.user.id));

        return { success: true };
      }),
  }),
  lomloe: lomloeRouter,
  materials: materialsRouter,
  challenge: challengeRouter,
  groups: groupsRouter,
  progress: progressRouter,
  forum: forumRouter,
  presentations: presentationsRouter,
  analytics: analyticsRouter,
  notifications: notificationsRouter,
  voice: voiceRouter,
  planner: plannerRouter,
  geoDialect: geoDialectRouter,
  accountability: accountabilityRouter,
  privacy: privacyRouter,
  audit: auditRouter,
  dpa: dpaRouter,
  whatsNew: whatsNewRouter,
  selfHeal: selfHealRouter,
  director: directorRouter,
  hos: hosRouter,
  wakeWords: wakeWordsRouter,
  audioResponses: audioResponsesRouter,
  attendance: attendanceRouter,
  teams: teamsRouter,
  dmCall: dmCallRouter,
  webrtc: webrtcRouter,
  meetingInvitation: meetingInvitationRouter,
  callChat: callChatRouter,
  callBackground: callBackgroundRouter,
  aina: ainaRouter,
  localAuth: localAuthRouter,
  ilp: ilpRouter,
  lessonPlan: lessonPlanRouter,
  tenants: tenantsRouter,
  territorialDirector: territorialDirectorRouter,
  assignmentRequests: assignmentRequestsRouter,
  teacherAttendance: teacherAttendanceRouter,
  teacherProfile: teacherProfileRouter,
  register: registerRouter,
  cover: coverRouter,
  infantil: infantilRouter,
});

export type AppRouter = typeof appRouter;
