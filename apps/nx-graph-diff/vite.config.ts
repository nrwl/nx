/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/nx-graph-diff',
  server: {
    port: 4200,
    host: 'localhost',
    middlewareMode: false,
  },
  plugins: [
    react(),
    {
      name: 'nx-json-middleware',
      configureServer(server) {
        server.middlewares.use('/nx.json', (req, res, next) => {
          if (req.method === 'GET') {
            const nxJsonPath = join(__dirname, '../../nx.json');
            try {
              // Clear the require cache to ensure fresh content
              delete require.cache[nxJsonPath];

              // Read fresh content from disk
              const content = readFileSync(nxJsonPath, 'utf-8');

              // Set headers to prevent caching
              res.setHeader('Content-Type', 'application/json');
              res.setHeader(
                'Cache-Control',
                'no-cache, no-store, must-revalidate'
              );
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');

              console.log('Serving fresh nx.json, length:', content.length);
              res.end(content);
            } catch (err) {
              console.error('Error reading nx.json:', err);
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'nx.json not found' }));
            }
          } else {
            next();
          }
        });

        server.middlewares.use(
          '/.nx/workspace-data/project-graph.json',
          (req, res, next) => {
            if (req.method === 'GET') {
              const graphPath = join(
                __dirname,
                '../../.nx/workspace-data/project-graph.json'
              );
              try {
                // Read fresh content from disk
                const content = readFileSync(graphPath, 'utf-8');

                // Set headers to prevent caching
                res.setHeader('Content-Type', 'application/json');
                res.setHeader(
                  'Cache-Control',
                  'no-cache, no-store, must-revalidate'
                );
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');

                console.log(
                  'Serving fresh project-graph.json, length:',
                  content.length
                );
                res.end(content);
              } catch (err) {
                console.error('Error reading project-graph.json:', err);
                res.statusCode = 404;
                res.end(
                  JSON.stringify({ error: 'project-graph.json not found' })
                );
              }
            } else {
              next();
            }
          }
        );

        server.middlewares.use(
          '/api/update-nx-json',
          async (req, res, next) => {
            if (req.method === 'POST') {
              let body = '';
              req.on('data', (chunk) => {
                body += chunk.toString();
              });
              req.on('end', async () => {
                try {
                  const { nxJson } = JSON.parse(body);

                  // Save the original nx.json as backup
                  const nxJsonPath = join(__dirname, '../../nx.json');
                  const backupPath = join(__dirname, '../../nx.json.backup');
                  const originalContent = readFileSync(nxJsonPath, 'utf-8');
                  writeFileSync(backupPath, originalContent);

                  // Write the new nx.json
                  writeFileSync(nxJsonPath, JSON.stringify(nxJson, null, 2));

                  // Regenerate project graph
                  console.log('Regenerating project graph...');
                  const { stdout, stderr } = await execAsync(
                    'pnpm nx graph --file=.nx/workspace-data/project-graph.json',
                    {
                      cwd: join(__dirname, '../..'),
                    }
                  );

                  console.log('Graph generation stdout:', stdout);
                  if (stderr) {
                    console.log('Graph generation stderr:', stderr);
                  }

                  // Wait a moment for file system to settle
                  await new Promise((resolve) => setTimeout(resolve, 1000));

                  // Read the new project graph
                  const graphPath = join(
                    __dirname,
                    '../../.nx/workspace-data/project-graph.json'
                  );
                  console.log('Reading graph from:', graphPath);

                  if (!require('fs').existsSync(graphPath)) {
                    throw new Error(
                      `Project graph file does not exist at ${graphPath}`
                    );
                  }

                  const graphContent = readFileSync(graphPath, 'utf-8');
                  console.log('Graph content length:', graphContent.length);
                  const newGraph = JSON.parse(graphContent);
                  console.log(
                    'New graph nodes count:',
                    Object.keys(newGraph.nodes || {}).length
                  );

                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      success: true,
                      graph: newGraph,
                    })
                  );
                } catch (err) {
                  console.error('Error updating nx.json:', err);
                  res.statusCode = 500;
                  res.end(
                    JSON.stringify({
                      error: 'Failed to update nx.json and regenerate graph',
                      details: err.message,
                    })
                  );
                }
              });
            } else {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method not allowed' }));
            }
          }
        );

        server.middlewares.use(
          '/api/restore-nx-json',
          async (req, res, next) => {
            if (req.method === 'POST') {
              try {
                const nxJsonPath = join(__dirname, '../../nx.json');
                const backupPath = join(__dirname, '../../nx.json.backup');

                // Restore original nx.json
                const originalContent = readFileSync(backupPath, 'utf-8');
                writeFileSync(nxJsonPath, originalContent);

                // Regenerate project graph
                console.log('Restoring project graph...');
                const { stdout, stderr } = await execAsync(
                  'pnpm nx graph --file=.nx/workspace-data/project-graph.json',
                  {
                    cwd: join(__dirname, '../..'),
                  }
                );

                console.log('Restore stdout:', stdout);
                if (stderr) {
                  console.log('Restore stderr:', stderr);
                }

                // Wait a moment for file system to settle
                await new Promise((resolve) => setTimeout(resolve, 1000));

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (err) {
                console.error('Error restoring nx.json:', err);
                res.statusCode = 500;
                res.end(
                  JSON.stringify({
                    error: 'Failed to restore nx.json',
                    details: err.message,
                  })
                );
              }
            } else {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method not allowed' }));
            }
          }
        );
      },
    },
  ],
  preview: {
    port: 4200,
    host: 'localhost',
  },
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
