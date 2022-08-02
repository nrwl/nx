/*
 * This is only a minimal custom server to get started.
 * You should customize this server with CORS and other security features.
 */
import express from 'express';
import * as path from 'path';
import next from 'next';

// Next.js server options:
// - The environment variable is set by `@nrwl/next:server` when running the dev server.
// - The fallback `__dirname` is for production builds.
// - Feel free to change this to suit your needs.
const dir = process.env.NX_NEXT_DIR || path.join(__dirname, '..');
const publicDir = process.env.NX_NEXT_PUBLIC_DIR || path.join(__dirname, '../public');
const dev = process.env.NODE_ENV === 'development';

// Express server options:
// - Feel free to change this to suit your needs.
const hostname = process.env.HOST || 'localhost';
const port = process.env.PORT ? parseInt(process.env.PORT) : 4200;

async function main() {
  const nextApp = next({ dev, dir });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  const expressApp = express();

  expressApp.get('/api', (req, res) => {
    res.send({ message: 'Welcome!' });
  });

  // Serve static files from public folder.
  expressApp.use(express.static(publicDir));

  // Redirect requests to Next.js app.
  expressApp.all('*', (req, res) => {
    console.log('Forwarding request to Next.js: ', req.url);
    handle(req, res)
  });

  return new Promise<void>((resolve, reject) => {
    expressApp.on('error', (err) => reject(err));
    expressApp.listen(port, () => {
      console.log(`[ ready ] on http://${hostname}:${port}`)
      resolve();
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

