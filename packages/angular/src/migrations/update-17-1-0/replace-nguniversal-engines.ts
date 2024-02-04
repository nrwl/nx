import {
  addDependenciesToPackageJson,
  formatFiles,
  normalizePath,
  readJson,
  removeDependenciesFromPackageJson,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import { dirname, relative } from 'path';
import {
  getInstalledPackageVersionInfo,
  versions,
} from '../../generators/utils/version-utils';
import { allTargetOptions } from '../../utils/targets';
import { getProjectsFilteredByDependencies } from '../utils/projects';

const UNIVERSAL_PACKAGES = [
  '@nguniversal/common',
  '@nguniversal/express-engine',
];
/**
 * Regexp to match Universal packages.
 * @nguniversal/common/engine
 * @nguniversal/common
 * @nguniversal/express-engine
 **/
const NGUNIVERSAL_PACKAGE_REGEXP =
  /@nguniversal\/(common(\/engine)?|express-engine)/g;
const serverExecutors = [
  '@angular-devkit/build-angular:server',
  '@nx/angular:webpack-server',
];

export default async function (tree: Tree) {
  const packageJson = readJson(tree, 'package.json');
  if (
    !UNIVERSAL_PACKAGES.some(
      (pkg) =>
        packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg]
    )
  ) {
    return;
  }

  const projects = await getProjectsFilteredByDependencies(tree, [
    'npm:@nguniversal/common',
    'npm:@nguniversal/express-engine',
  ]);
  for (const { project } of projects) {
    if (project.projectType !== 'application') {
      continue;
    }

    const serverMainFiles = new Map<
      string /** Main Path */,
      string /** Output Path */
    >();
    for (const target of Object.values(project.targets ?? {})) {
      if (!serverExecutors.includes(target.executor)) {
        continue;
      }

      const outputPath = project.targets.build?.options?.outputPath;
      for (const [, { main }] of allTargetOptions(target)) {
        if (
          typeof main === 'string' &&
          typeof outputPath === 'string' &&
          tree.read(main, 'utf-8').includes('ngExpressEngine')
        ) {
          serverMainFiles.set(main, outputPath);
        }
      }
    }

    // Replace all import specifiers in all files.
    let hasExpressTokens = false;
    const root = project.sourceRoot ?? `${project.root}/src`;
    const tokensFilePath = `${root}/express.tokens.ts`;

    visitNotIgnoredFiles(tree, root, (path) => {
      if (!path.endsWith('.ts') || path.endsWith('.d.ts')) {
        return;
      }

      let content = tree.read(path, 'utf8');
      if (!content.includes('@nguniversal/')) {
        return;
      }

      // Check if file is importing tokens
      if (content.includes('@nguniversal/express-engine/tokens')) {
        hasExpressTokens ||= true;

        let tokensFileRelativePath: string = normalizePath(
          relative(dirname(path), tokensFilePath)
        );

        if (tokensFileRelativePath.charAt(0) !== '.') {
          tokensFileRelativePath = './' + tokensFileRelativePath;
        }

        content = content.replaceAll(
          '@nguniversal/express-engine/tokens',
          tokensFileRelativePath.slice(0, -3)
        );
      }

      content = content.replaceAll(NGUNIVERSAL_PACKAGE_REGEXP, '@angular/ssr');

      tree.write(path, content);
    });

    // Replace server file and add tokens file if needed
    for (const [path, outputPath] of serverMainFiles.entries()) {
      tree.rename(path, path + '.bak');
      tree.write(path, getServerFileContents(outputPath, hasExpressTokens));

      if (hasExpressTokens) {
        tree.write(tokensFilePath, TOKENS_FILE_CONTENT);
      }
    }
  }

  // Remove universal packages from deps
  for (const name of UNIVERSAL_PACKAGES) {
    removeDependenciesFromPackageJson(tree, [name], [name]);
  }

  const pkgVersions = versions(tree);
  addDependenciesToPackageJson(
    tree,
    {
      '@angular/ssr':
        getInstalledPackageVersionInfo(tree, '@angular-devkit/build-angular')
          ?.version ?? pkgVersions.angularDevkitVersion,
    },
    {}
  );

  await formatFiles(tree);
}

const TOKENS_FILE_CONTENT = `
import { InjectionToken } from '@angular/core';
import { Request, Response } from 'express';

export const REQUEST = new InjectionToken<Request>('REQUEST');
export const RESPONSE = new InjectionToken<Response>('RESPONSE');
`;

function getServerFileContents(
  outputPath: string,
  hasExpressTokens: boolean
): string {
  return (
    `
import 'zone.js/node';

import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import * as express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import bootstrap from './src/main.server';` +
    (hasExpressTokens
      ? `\nimport { REQUEST, RESPONSE } from './src/express.tokens';`
      : '') +
    `

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const distFolder = join(process.cwd(), '${outputPath}');
  const indexHtml = existsSync(join(distFolder, 'index.original.html'))
    ? join(distFolder, 'index.original.html')
    : join(distFolder, 'index.html');

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  // Serve static files from /browser
  server.get('*.*', express.static(distFolder, {
    maxAge: '1y'
  }));

  // All regular routes use the Angular engine
  server.get('*', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: \`\${protocol}://\${headers.host}\${originalUrl}\`,
        publicPath: distFolder,
        providers: [
          { provide: APP_BASE_HREF, useValue: baseUrl },` +
    (hasExpressTokens
      ? '\n          { provide: RESPONSE, useValue: res },\n          { provide: REQUEST, useValue: req }\n'
      : '') +
    `],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(\`Node Express server listening on http://localhost:\${port}\`);
  });
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
}

export default bootstrap;
`
  );
}
