import { readProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import hostGenerator from '../../generators/host/host';
import { Linter } from '@nx/eslint';
import updateSsrServerPort from './update-ssr-server-port';

describe('update-19-6-0 update-ssr-server-port migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update host and remote port server files', async () => {
    await hostGenerator(tree, {
      directory: 'shell',
      e2eTestRunner: 'none',
      unitTestRunner: 'none',
      ssr: true,
      linter: Linter.EsLint,
      style: 'css',
      remotes: ['product'],
      bundler: 'webpack',
    });
    const remotePort = readProjectConfiguration(tree, 'product').targets.serve
      .options.port;

    const shellPort = readProjectConfiguration(tree, 'shell').targets.serve
      .options.port;

    // This should already exists in the generated project
    tree.write(
      'product/server.ts',
      tree
        .read('product/server.ts', 'utf-8')
        .replace('const port = 4201;', `const port = process.env.PORT || 4200;`)
    );

    updateSsrServerPort(tree);
    expect(tree.read('product/server.ts', 'utf-8')).toContain(
      `port = process.env['PORT'] || ${remotePort}`
    );
    expect(tree.read('product/server.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import * as path from 'path';
      import express from 'express';
      import cors from 'cors';

      import { handleRequest } from './src/main.server';

      const port = process.env['PORT'] || 4201;
      const app = express();

      const browserDist = path.join(process.cwd(), 'dist/product/browser');
      const serverDist = path.join(process.cwd(), 'dist/product/server');
      const indexPath = path.join(browserDist, 'index.html');

      app.use(cors());

      // Client-side static bundles
      app.get(
        '*.*',
        express.static(browserDist, {
          maxAge: '1y',
        })
      );

      // Static bundles for server-side module federation
      app.use(
        '/server',
        express.static(serverDist, {
          maxAge: '1y',
        })
      );

      app.use('*', handleRequest(indexPath));

      const server = app.listen(port, () => {
        console.log(\`Express server listening on http://localhost:\${port}\`);

        /**
         * DO NOT REMOVE IF USING @nx/react:module-federation-dev-ssr executor
         * to serve your Host application with this Remote application.
         * This message allows Nx to determine when the Remote is ready to be
         * consumed by the Host.
         */
        process.send?.('nx.server.ready');
      });

      server.on('error', console.error);
      "
    `);

    tree.write(
      'shell/server.ts',
      tree
        .read('shell/server.ts', 'utf-8')
        .replace(
          'const port = 4200;',
          `const port = process.env['PORT'] || 4200;`
        )
    );

    updateSsrServerPort(tree);
    expect(tree.read('shell/server.ts', 'utf-8')).toContain(
      `port = process.env.PORT || ${shellPort}`
    );
    expect(tree.read('shell/server.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import * as path from 'path';
      import express from 'express';
      import cors from 'cors';
      import { handleRequest } from './src/main.server';
      const port = process.env.PORT || 4200;
      const app = express();
      const browserDist = path.join(process.cwd(), 'dist/shell/browser');
      const indexPath = path.join(browserDist, 'index.html');
      app.use(cors());
      app.get('*.*', express.static(browserDist, {
          maxAge: '1y',
      }));
      app.use('*', handleRequest(indexPath));
      const server = app.listen(port, () => {
          console.log(\`Express server listening on http://localhost:\${port}\`);
      });
      server.on('error', console.error);
      "
    `);
  });

  it('should update a host project server file', async () => {
    await hostGenerator(tree, {
      directory: 'host',
      e2eTestRunner: 'none',
      unitTestRunner: 'none',
      ssr: true,
      linter: Linter.EsLint,
      style: 'css',
      bundler: 'webpack',
    });

    const hostPort = readProjectConfiguration(tree, 'host').targets.serve
      .options.port;

    tree.write(
      'host/server.ts',
      tree
        .read('host/server.ts', 'utf-8')
        .replace(
          'const port = 4200;',
          `const port = process.env['PORT'] || 4200;`
        )
    );

    updateSsrServerPort(tree);

    expect(tree.read('host/server.ts', 'utf-8')).toContain(
      `port = process.env.PORT || ${hostPort}`
    );
    expect(tree.read('host/server.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import * as path from 'path';
      import express from 'express';
      import cors from 'cors';
      import { handleRequest } from './src/main.server';
      const port = process.env.PORT || 4200;
      const app = express();
      const browserDist = path.join(process.cwd(), 'dist/host/browser');
      const indexPath = path.join(browserDist, 'index.html');
      app.use(cors());
      app.get('*.*', express.static(browserDist, {
          maxAge: '1y',
      }));
      app.use('*', handleRequest(indexPath));
      const server = app.listen(port, () => {
          console.log(\`Express server listening on http://localhost:\${port}\`);
      });
      server.on('error', console.error);
      "
    `);
  });

  it('should not update a mfe project that is not ssr', async () => {
    await hostGenerator(tree, {
      directory: 'shell-not-ssr',
      e2eTestRunner: 'none',
      unitTestRunner: 'none',
      ssr: false,
      linter: Linter.EsLint,
      style: 'css',
      bundler: 'webpack',
    });

    tree.write('shell-not-ssr/server.ts', 'const port = 9999;');
    const shellPort = readProjectConfiguration(tree, 'shell-not-ssr').targets
      .serve.options.port;

    updateSsrServerPort(tree);

    expect(tree.read('shell-not-ssr/server.ts', 'utf-8')).not.toContain(
      `port = ${shellPort}`
    );
    expect(tree.read('shell-not-ssr/server.ts', 'utf-8')).toMatchInlineSnapshot(
      `"const port = 9999;"`
    );
  });
});
