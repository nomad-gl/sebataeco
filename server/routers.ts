import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
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
});

export type AppRouter = typeof appRouter;
