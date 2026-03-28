import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { lomloeRouter } from "./routers/lomloe";
import { materialsRouter } from "./routers/materials";
import { challengeRouter } from "./routers/challenge";
import { groupsRouter } from "./routers/groups";
import { progressRouter } from "./routers/progress";
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
});

export type AppRouter = typeof appRouter;
