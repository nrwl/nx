import { TempFs } from '../utils/testing/temp-fs';
const tempFs = new TempFs('explicit-package-json');

import { buildProjectGraph } from './build-project-graph';
import * as fastGlob from 'fast-glob';
import { defaultFileHasher } from '../hasher/file-hasher';
import { NxJsonConfiguration } from '../config/nx-json';
import { stripIndents } from '../utils/strip-indents';
import { DependencyType } from '../config/project-graph';

describe('project graph', () => {
  let packageJson: any;
  let packageLockJson: any;
  let nxJson: NxJsonConfiguration;
  let tsConfigJson: any;
  let filesJson: any;

  beforeEach(async () => {
    packageJson = {
      name: '@nrwl/workspace-src',
      version: '0.0.0',
      dependencies: {
        express: '4.0.0',
        'happy-nrwl': '1.0.0',
      },
      devDependencies: {
        '@nrwl/workspace': '*',
      },
    };
    packageLockJson = {
      name: '@nrwl/workspace-src',
      version: '0.0.0',
      lockfileVersion: 2,
      requires: true,
      packages: {
        '': packageJson,
        'node_modules/@nrwl/workspace': {
          version: '15.0.0',
          resolved:
            'https://registry.npmjs.org/@nrwl/workspace/-/@nrwl/workspace-15.0.0.tgz',
          integrity: 'sha512-12345678==',
          dev: true,
        },
        'node_modules/express': {
          version: '4.0.0',
          resolved: 'https://registry.npmjs.org/express/-/express-4.0.0.tgz',
          integrity: 'sha512-12345678==',
          engines: {
            node: '>=4.2.0',
          },
        },
        'node_modules/happy-nrwl': {
          version: '4.0.0',
          resolved:
            'https://registry.npmjs.org/happy-nrwl/-/happy-nrwl-1.0.0.tgz',
          integrity: 'sha512-12345678==',
        },
      },
      dependencies: {
        '@nrwl/workspace': {
          version: '15.0.0',
          resolved:
            'https://registry.npmjs.org/@nrwl/workspace/-/@nrwl/workspace-15.0.0.tgz',
          integrity: 'sha512-12345678==',
          dev: true,
        },
        express: {
          version: '4.0.0',
          resolved: 'https://registry.npmjs.org/express/-/express-4.0.0.tgz',
          integrity: 'sha512-12345678==',
        },
        'happy-nrwl': {
          version: '1.0.0',
          resolved:
            'https://registry.npmjs.org/happy-nrwl/-/happy-nrwl-1.0.0.tgz',
          integrity: 'sha512-12345678==',
        },
      },
    };

    const demoProjectJson = {
      root: 'apps/demo',
      sourceRoot: 'apps/demo/src',
      projectType: 'application',
      implicitDependencies: ['api'],
      targets: {},
    };

    const demoE2eProjectJson = {
      root: 'apps/demo-e2e',
      sourceRoot: 'apps/demo-e2e/src',
      projectType: 'application',
      targets: {},
    };

    const uiProjectJson = {
      root: 'libs/ui',
      sourceRoot: 'libs/ui/src',
      projectType: 'library',
      targets: {},
    };

    const sharedUtilProjectJson = {
      name: 'shared-util',
      root: 'libs/shared/util',
      sourceRoot: 'libs/shared/util/src',
      projectType: 'library',
      targets: {},
    };

    const sharedUtilDataProjectJson = {
      name: 'shared-util-data',
      root: 'libs/shared/util/data',
      sourceRoot: 'libs/shared/util/data/src',
      projectType: 'library',
      targets: {},
    };

    const lazyLibProjectJson = {
      root: 'libs/lazy-lib',
      sourceRoot: 'libs/lazy-lib',
      projectType: 'library',
      targets: {},
    };

    const apiProjectJson = {
      root: 'apps/api',
      sourceRoot: 'apps/api/src',
      projectType: 'application',
      targets: {},
    };

    nxJson = {};

    tsConfigJson = {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@nrwl/shared/util': ['libs/shared/util/src/index.ts'],
          '@nrwl/shared-util-data': ['libs/shared/util/data/src/index.ts'],
          '@nrwl/ui': ['libs/ui/src/index.ts'],
          '@nrwl/lazy-lib': ['libs/lazy-lib/src/index.ts'],
        },
      },
    };

    filesJson = {
      './apps/api/src/index.ts': stripIndents`
        require('express');
      `,
      './apps/demo/src/index.ts': stripIndents`
        import * as ui from '@nrwl/ui';
        import * as data from '@nrwl/shared-util-data;
        const s = { loadChildren: '@nrwl/lazy-lib#LAZY' }
      `,
      './apps/demo-e2e/src/integration/app.spec.ts': stripIndents`
        describe('whatever', () => {});
      `,
      './libs/ui/src/index.ts': stripIndents`
        import * as util from '@nrwl/shared/util';
        import('@nrwl/lazy-lib');
      `,
      './libs/shared/util/src/index.ts': stripIndents`
        import * as happyNrwl from 'happy-nrwl/a/b/c';
      `,
      './libs/shared/util/data/src/index.ts': stripIndents`
        export const SHARED_DATA = 'shared data';
      `,
      './libs/lazy-lib/src/index.ts': stripIndents`
        export const LAZY = 'lazy lib';
      `,
      './package.json': JSON.stringify(packageJson),
      './package-lock.json': JSON.stringify(packageLockJson),
      './nx.json': JSON.stringify(nxJson),
      './tsconfig.base.json': JSON.stringify(tsConfigJson),
      './apps/demo/project.json': JSON.stringify(demoProjectJson),
      './apps/demo-e2e/project.json': JSON.stringify(demoE2eProjectJson),
      './libs/ui/project.json': JSON.stringify(uiProjectJson),
      './libs/shared/util/project.json': JSON.stringify(sharedUtilProjectJson),
      './libs/shared/util/data/project.json': JSON.stringify(
        sharedUtilDataProjectJson
      ),
      './libs/lazy-lib/project.json': JSON.stringify(lazyLibProjectJson),
      './apps/api/project.json': JSON.stringify(apiProjectJson),
    };

    tempFs.reset();
    await tempFs.createFiles(filesJson);
    await defaultFileHasher.init();

    const globResults = [
      demoProjectJson,
      demoE2eProjectJson,
      uiProjectJson,
      sharedUtilProjectJson,
      sharedUtilDataProjectJson,
      lazyLibProjectJson,
      apiProjectJson,
    ].map((r) => `${r.root}/project.json`);

    jest.spyOn(fastGlob, 'sync').mockImplementation(() => globResults);
  });

  it('should create nodes and dependencies with workspace projects', async () => {
    const graph = await buildProjectGraph();

    expect(graph.nodes).toMatchObject({
      api: { name: 'api', type: 'app' },
      'demo-e2e': { name: 'demo-e2e', type: 'e2e' },
      demo: { name: 'demo', type: 'app' },
      ui: { name: 'ui', type: 'lib' },
      'shared-util': { name: 'shared-util', type: 'lib' },
      'shared-util-data': { name: 'shared-util-data', type: 'lib' },
      'lazy-lib': { name: 'lazy-lib', type: 'lib' },
    });
    expect(graph.externalNodes).toMatchObject({
      'npm:happy-nrwl': {
        name: 'npm:happy-nrwl',
        type: 'npm',
        data: {
          packageName: 'happy-nrwl',
        },
      },
      'npm:express': {
        name: 'npm:express',
        type: 'npm',
        data: {
          packageName: 'express',
        },
      },
    });
    expect(graph.dependencies).toEqual({
      api: [{ source: 'api', target: 'npm:express', type: 'static' }],
      demo: [
        {
          source: 'demo',
          target: 'ui',
          type: 'static',
        },
        { source: 'demo', target: 'shared-util-data', type: 'static' },
        {
          source: 'demo',
          target: 'lazy-lib',
          type: 'dynamic',
        },
        { source: 'demo', target: 'api', type: 'implicit' },
      ],
      'demo-e2e': [],
      'lazy-lib': [],
      'shared-util': [
        { source: 'shared-util', target: 'npm:happy-nrwl', type: 'static' },
      ],
      'shared-util-data': [],
      ui: [
        { source: 'ui', target: 'shared-util', type: 'static' },
        {
          source: 'ui',
          target: 'lazy-lib',
          type: 'dynamic',
        },
      ],
    });
  });

  it('should handle circular dependencies', async () => {
    tempFs.writeFile(
      'libs/shared/util/src/index.ts',
      `import * as ui from '@nrwl/ui';`
    );

    const graph = await buildProjectGraph();

    expect(graph.dependencies['shared-util']).toEqual([
      {
        type: DependencyType.static,
        source: 'shared-util',
        target: 'ui',
      },
    ]);
    expect(graph.dependencies['ui']).toEqual([
      {
        type: DependencyType.static,
        source: 'ui',
        target: 'shared-util',
      },
      {
        type: DependencyType.dynamic,
        source: 'ui',
        target: 'lazy-lib',
      },
    ]);
  });
});
