import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { forms } from './routes/forms';
import { menu } from './routes/menu';
import { triggers } from './routes/triggers';
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from './trpc';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/form', forms);
internal.route('/triggers', triggers);

app.route('/internal', internal);

// tRPC setup under /api to ensure Devvit proxies it correctly
app.use(
  '/api/trpc/*',
  trpcServer({
    router: appRouter,
  })
);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
