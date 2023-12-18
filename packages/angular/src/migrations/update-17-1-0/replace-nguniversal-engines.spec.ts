import {
  addProjectConfiguration,
  readJson,
  updateJson,
  writeJson,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './replace-nguniversal-engines';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
  formatFiles: jest.fn(),
}));

describe('replace-nguniversal-engines migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = {
        '@nguniversal/common': '16.0.0',
        '@nguniversal/express-engine': '16.0.0',
      };
      return json;
    });

    const project: ProjectConfiguration = {
      root: '',
      sourceRoot: 'src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/app1/browser',
            main: 'main.ts',
            tsConfig: 'tsconfig.json',
            polyfills: '',
          },
        },
        server: {
          executor: '@angular-devkit/build-angular:server',
          options: {
            outputPath: 'dist/app1/server',
            tsConfig: 'tsconfig.json',
            main: 'server.ts',
          },
          configurations: {
            production: {
              main: 'server.ts',
            },
          },
        },
      },
    };
    projectGraph = {
      dependencies: {
        app1: [
          { source: 'app1', target: 'npm:@nguniversal/common', type: 'static' },
        ],
      },
      nodes: { app1: { data: project, name: 'app1', type: 'app' } },
    };
    addProjectConfiguration(tree, 'app1', project);

    tree.write(
      'server.ts',
      `
  import 'zone.js/node';

import { APP_BASE_HREF } from '@angular/common';
import { ngExpressEngine } from '@nguniversal/express-engine';
import * as express from 'express';
import { existsSync } from 'fs';
import { join } from 'path';

import { AppServerModule } from './src/main.server';

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const distFolder = join(process.cwd(), 'dist/browser');
  const indexHtml = existsSync(join(distFolder, 'index.original.html'))
    ? 'index.original.html'
    : 'index';

  // Our Universal express-engine (found @ https://github.com/angular/universal/tree/main/modules/express-engine)
  server.engine(
    'html',
    ngExpressEngine({
      bootstrap: AppServerModule,
      inlineCriticalCss: true,
    }),
  );

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  // Serve static files from /browser
  server.get(
    '*.*',
    express.static(distFolder, {
      maxAge: '1y',
    }),
  );

  // All regular routes use the Universal engine
  server.get('*', (req, res) => {
    res.render(indexHtml, { req, providers: [{ provide: APP_BASE_HREF, useValue: req.baseUrl }] });
  });

  return server;
}

function run() {
  const port = process.env.PORT || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port);
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = (mainModule && mainModule.filename) || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
} `
    );
  });

  it('should remove all "@nguniversal/" from dependencies', async () => {
    await migration(tree);

    const { dependencies } = readJson(tree, 'package.json');
    expect(dependencies['@nguniversal/common']).toBeUndefined();
    expect(dependencies['@nguniversal/express-engine']).toBeUndefined();
  });

  it('should add "@angular/ssr" as a dependencies', async () => {
    await migration(tree);

    const { dependencies } = readJson(tree, 'package.json');
    expect(dependencies['@angular/ssr']).toBeDefined();
  });

  it('should not add "@angular/ssr" when there is no dependency on "@nguniversal"', async () => {
    writeJson(tree, 'package.json', {
      dependencies: { '@angular/common': '16.0.0' },
    });

    await migration(tree);

    const { dependencies } = readJson(tree, 'package.json');
    expect(dependencies['@angular/ssr']).toBeUndefined();
  });

  it('should replace imports from "@nguniversal/common" to "@angular/ssr"', async () => {
    tree.write(
      'src/file.ts',
      `
      import { CommonEngine } from '@nguniversal/common';
      import { Component } from '@angular/core';
    `
    );

    await migration(tree);

    expect(tree.read('src/file.ts', 'utf-8')).toContain(
      `import { CommonEngine } from '@angular/ssr';`
    );
  });

  it('should replace and backup "server.ts" file', async () => {
    await migration(tree);

    expect(tree.read('server.ts.bak', 'utf-8')).toContain(
      `import { ngExpressEngine } from '@nguniversal/express-engine';`
    );
    const newServerFile = tree.read('server.ts', 'utf-8');
    expect(newServerFile).toContain(
      `import { CommonEngine } from '@angular/ssr';`
    );
    expect(newServerFile).toContain(
      `const distFolder = join(process.cwd(), 'dist/app1/browser');`
    );
  });

  it('should create tokens file and replace usages of "@nguniversal/express-engine/tokens"', async () => {
    const filePath = 'src/tokens-usage.ts';
    tree.write(
      filePath,
      `import { RESPONSE } from '@nguniversal/express-engine/tokens';`
    );

    await migration(tree);

    expect(tree.read(filePath, 'utf-8')).toContain(
      `import { RESPONSE } from './express.tokens';`
    );
    const newServerFile = tree.read('server.ts', 'utf-8');
    expect(newServerFile).toContain(`{ provide: RESPONSE, useValue: res }`);
    expect(newServerFile).toContain(
      `import { REQUEST, RESPONSE } from './src/express.tokens';`
    );
    expect(tree.exists('src/express.tokens.ts')).toBe(true);
  });

  it('should import tokens file correctly in nested paths', async () => {
    const filePath = 'src/nested/folder/home/home.component.ts';
    tree.write(
      filePath,
      `import { RESPONSE } from '@nguniversal/express-engine/tokens';`
    );

    await migration(tree);

    expect(tree.read(filePath, 'utf-8')).toContain(
      `import { RESPONSE } from '../../../express.tokens';`
    );
  });

  it('should not create tokens file when "@nguniversal/express-engine/tokens" is not used', async () => {
    await migration(tree);

    const newServerFile = tree.read('server.ts', 'utf-8');
    expect(newServerFile).not.toContain(`{ provide: RESPONSE, useValue: res }`);
    expect(newServerFile).not.toContain(
      `import { REQUEST, RESPONSE } from './src/express.tokens';`
    );
    expect(tree.exists('src/express.tokens.ts')).toBe(false);
  });

  it('should not process non-TypeScript files', async () => {
    const content = `import { ngExpressEngine } from '@nguniversal/express-engine';`;
    tree.write('src/foo.txt', content);

    await migration(tree);

    expect(tree.read('src/foo.txt', 'utf-8')).toBe(content);
  });
});
