/*
 * This is only a minimal custom server to get started.
 * You may want to consider using Express or another server framework, and enable security features such as CORS.
 *
 * For more examples, see the Next.js repo:
 * - Express: https://github.com/vercel/next.js/tree/canary/examples/custom-server-express
 * - Hapi: https://github.com/vercel/next.js/tree/canary/examples/custom-server-hapi
 */
import { createServer } from 'http';
import { parse } from 'url';
import * as path from 'path';
import next from 'next';

// Next.js server options:
// - The environment variable is set by `@nx/next:server` when running the dev server.
// - The fallback `__dirname` is for production builds.
// - Feel free to change this to suit your needs.
const dir = process.env.NX_NEXT_DIR || path.join(__dirname, '..');
const dev = process.env.NODE_ENV === 'development';

// HTTP Server options:
// - Feel free to change this to suit your needs.
const hostname = process.env.HOST || 'localhost';
const port = process.env.PORT ? parseInt(process.env.PORT) : 4200;

async function main() {
  const nextApp = next({ dev, dir });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '', true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, hostname);

  console.log(`[ ready ] on http://${hostname}:${port}`)
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

