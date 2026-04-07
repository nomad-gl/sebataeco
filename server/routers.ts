import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
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
});

export type AppRouter = typeof appRouter;
