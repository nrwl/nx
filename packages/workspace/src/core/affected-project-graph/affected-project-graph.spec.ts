import { jsonDiff } from '../../utilities/json-diff';
import { vol } from 'memfs';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { createProjectGraphAsync } from '../project-graph';
import { filterAffected } from './affected-project-graph';
import { WholeFileChange } from '../file-utils';
import type { NxJsonConfiguration } from '@nrwl/devkit';

jest.mock('fs', () => require('memfs').fs);
jest.mock('@nrwl/tao/src/utils/app-root', () => ({
  appRootPath: '/root',
}));

describe('project graph', () => {
  let packageJson: any;
  let workspaceJson: any;
  let tsConfigJson: any;
  let nxJson: NxJsonConfiguration;
  let filesJson: any;

  beforeEach(() => {
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
    packageJson = {
      name: '@nrwl/workspace-src',
      scripts: {
        deploy: 'echo deploy',
      },
      dependencies: {
        'happy-nrwl': '1.0.0',
      },
      devDependencies: {
        '@nrwl/workspace': '8.0.0',
      },
    };
    workspaceJson = {
      projects: {
        demo: {
          root: 'apps/demo/',
          sourceRoot: 'apps/demo/src',
          projectType: 'application',
        },
        'demo-e2e': {
          root: 'apps/demo-e2e/',
          sourceRoot: 'apps/demo-e2e/src',
          projectType: 'application',
        },
        ui: {
          root: 'libs/ui/',
          sourceRoot: 'libs/ui/src',
          projectType: 'library',
        },
        util: {
          root: 'libs/util/',
          sourceRoot: 'libs/util/src',
          projectType: 'library',
        },
        api: {
          root: 'apps/api/',
          sourceRoot: 'apps/api/src',
          projectType: 'application',
        },
      },
    };
    nxJson = {
      npmScope: 'nrwl',
      implicitDependencies: {
        'package.json': {
          scripts: {
            deploy: ['demo', 'api'],
          },
          devDependencies: {
            '@nrwl/workspace': '*',
          },
        },
        'something-for-api.txt': ['api'],
      },
      projects: {
        api: { tags: [] },
        demo: { tags: [], implicitDependencies: ['api'] },
        'demo-e2e': { tags: [] },
        ui: { tags: [] },
        util: { tags: [] },
      },
    };
    tsConfigJson = {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@nrwl/ui': ['libs/ui/src/index.ts'],
          '@nrwl/util': ['libs/util/src/index.ts'],
        },
      },
    };
    filesJson = {
      './apps/api/src/index.ts': stripIndents`
        console.log('starting server');
      `,
      './apps/demo/src/index.ts': stripIndents`
        import * as ui from '@nrwl/ui';
      `,
      './apps/demo-e2e/src/integration/app.spec.ts': stripIndents`
        describe('whatever', () => {});
      `,
      './libs/ui/src/index.ts': stripIndents`
        import * as util from '@nrwl/util';
      `,
      './libs/util/src/index.ts': stripIndents`
        import * as happyNrwl from 'happy-nrwl';
      `,
      './package.json': JSON.stringify(packageJson),
      './nx.json': JSON.stringify(nxJson),
      './workspace.json': JSON.stringify(workspaceJson),
      './tsconfig.base.json': JSON.stringify(tsConfigJson),
    };
    vol.fromJSON(filesJson, '/root');
  });

  afterEach(() => [delete process.env.NX_CACHE_PROJECT_GRAPH]);

  it('should create nodes and dependencies with workspace projects', async () => {
    const graph = await createProjectGraphAsync();
    const affected = filterAffected(graph, [
      {
        file: 'something-for-api.txt',
        ext: '.txt',
        hash: 'some-hash',
        getChanges: () => [new WholeFileChange()],
      },
      {
        file: 'libs/ui/src/index.ts',
        ext: '.ts',
        hash: 'some-hash',
        getChanges: () => [new WholeFileChange()],
      },
    ]);
    expect(affected).toMatchObject({
      nodes: {
        api: {
          name: 'api',
          type: 'app',
          data: expect.anything(),
        },
        demo: {
          name: 'demo',
          type: 'app',
          data: expect.anything(),
        },
        ui: {
          name: 'ui',
          type: 'lib',
          data: expect.anything(),
        },
      },
      dependencies: {
        api: [],
        demo: [
          {
            type: 'static',
            source: 'demo',
            target: 'ui',
          },
          {
            type: 'implicit',
            source: 'demo',
            target: 'api',
          },
        ],
        ui: [],
      },
    });
  });

  it('should create nodes and dependencies with npm packages', async () => {
    const graph = await createProjectGraphAsync();
    const updatedPackageJson = {
      ...packageJson,
      dependencies: {
        'happy-nrwl': '2.0.0',
      },
    };

    const affected = filterAffected(graph, [
      {
        file: 'package.json',
        ext: '.json',
        hash: 'some-hash',
        getChanges: () => jsonDiff(packageJson, updatedPackageJson),
      },
    ]);

    expect(affected).toEqual({
      nodes: {
        'npm:happy-nrwl': {
          type: 'npm',
          name: 'npm:happy-nrwl',
          data: expect.anything(),
        },
        util: {
          name: 'util',
          type: 'lib',
          data: expect.anything(),
        },
        ui: {
          name: 'ui',
          type: 'lib',
          data: expect.anything(),
        },
        demo: {
          name: 'demo',
          type: 'app',
          data: expect.anything(),
        },
      },
      dependencies: {
        'npm:happy-nrwl': [],
        demo: [
          {
            type: 'static',
            source: 'demo',
            target: 'ui',
          },
        ],
        ui: [{ type: 'static', source: 'ui', target: 'util' }],
        util: [{ type: 'static', source: 'util', target: 'npm:happy-nrwl' }],
      },
    });
  });

  it('should support implicit JSON file dependencies (some projects)', async () => {
    const graph = await createProjectGraphAsync();
    const updatedPackageJson = {
      ...packageJson,
      scripts: {
        deploy: 'echo deploy!!!',
      },
    };

    const affected = filterAffected(graph, [
      {
        file: 'package.json',
        ext: '.json',
        hash: 'some-hash',
        getChanges: () => jsonDiff(packageJson, updatedPackageJson),
      },
    ]);

    expect(Object.keys(affected.nodes)).toEqual(['demo', 'api']);
  });

  it('should support implicit JSON file dependencies (all projects)', async () => {
    const graph = await createProjectGraphAsync();
    const updatedPackageJson = {
      ...packageJson,
      devDependencies: {
        '@nrwl/workspace': '9.0.0',
      },
    };

    const affected = filterAffected(graph, [
      {
        file: 'package.json',
        ext: '.json',
        hash: 'some-hash',
        getChanges: () => jsonDiff(packageJson, updatedPackageJson),
      },
    ]);

    expect(Object.keys(affected.nodes)).toEqual([
      'npm:@nrwl/workspace',
      'api',
      'demo',
      'demo-e2e',
      'ui',
      'util',
    ]);
  });
});
