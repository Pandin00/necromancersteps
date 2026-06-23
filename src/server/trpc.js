import { initTRPC } from '@trpc/server';
const t = initTRPC.context().create();
export const router = t.router;
export const publicProcedure = t.procedure;
export const appRouter = router({
    ping: publicProcedure.query(() => {
        return {
            message: 'pong',
        };
    }),
});
//# sourceMappingURL=trpc.js.map