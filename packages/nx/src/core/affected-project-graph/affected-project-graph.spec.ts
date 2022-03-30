import { jsonDiff } from '../../utils/json-diff';
import { vol } from 'memfs';
import { filterAffected } from './affected-project-graph';
import { WholeFileChange } from '../file-utils';
import { buildProjectGraph } from '../project-graph/build-project-graph';
import { defaultFileHasher } from '../hasher/file-hasher';
import { WorkspaceJsonConfiguration } from 'nx/src/shared/workspace';
import { NxJsonConfiguration } from 'nx/src/shared/nx';
import { stripIndents } from '../../utils/strip-indents';

jest.mock('fs', () => require('memfs').fs);
jest.mock('nx/src/utils/app-root', () => ({
  workspaceRoot: '/root',
}));

describe('project graph', () => {
  let packageJson: any;
  let workspaceJson: WorkspaceJsonConfiguration;
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
      version: 2,
      projects: {
        demo: {
          root: 'apps/demo/',
          sourceRoot: 'apps/demo/src',
          projectType: 'application',
          implicitDependencies: ['api'],
          targets: {},
        },
        'demo-e2e': {
          root: 'apps/demo-e2e/',
          sourceRoot: 'apps/demo-e2e/src',
          projectType: 'application',
          targets: {},
        },
        ui: {
          root: 'libs/ui/',
          sourceRoot: 'libs/ui/src',
          projectType: 'library',
          targets: {},
        },
        util: {
          root: 'libs/util/',
          sourceRoot: 'libs/util/src',
          projectType: 'library',
          targets: {},
        },
        api: {
          root: 'apps/api/',
          sourceRoot: 'apps/api/src',
          projectType: 'application',
          targets: {},
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
    defaultFileHasher.init();
  });

  afterEach(() => [delete process.env.NX_CACHE_PROJECT_GRAPH]);

  it('should create nodes and dependencies with workspace projects', async () => {
    const graph = await buildProjectGraph();
    const affected = filterAffected(graph, [
      {
        file: 'something-for-api.txt',
        hash: 'some-hash',
        getChanges: () => [new WholeFileChange()],
      },
      {
        file: 'libs/ui/src/index.ts',
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

  it('should create nodes and dependencies with npm packages in externalNodes', async () => {
    const graph = await buildProjectGraph();
    const updatedPackageJson = {
      ...packageJson,
      dependencies: {
        'happy-nrwl': '2.0.0',
      },
    };

    const affected = filterAffected(graph, [
      {
        file: 'package.json',
        hash: 'some-hash',
        getChanges: () => jsonDiff(packageJson, updatedPackageJson),
      },
    ]);

    expect(affected).toEqual({
      nodes: {
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
      externalNodes: {
        'npm:happy-nrwl': {
          type: 'npm',
          name: 'npm:happy-nrwl',
          data: expect.anything(),
        },
      },
      dependencies: {
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
    const graph = await buildProjectGraph();
    const updatedPackageJson = {
      ...packageJson,
      scripts: {
        deploy: 'echo deploy!!!',
      },
    };

    const affected = filterAffected(graph, [
      {
        file: 'package.json',
        hash: 'some-hash',
        getChanges: () => jsonDiff(packageJson, updatedPackageJson),
      },
    ]);

    expect(Object.keys(affected.nodes)).toEqual(['demo', 'api']);
  });

  it('should support implicit JSON file dependencies (all projects)', async () => {
    const graph = await buildProjectGraph();
    const updatedPackageJson = {
      ...packageJson,
      devDependencies: {
        '@nrwl/workspace': '9.0.0',
      },
    };

    const affected = filterAffected(graph, [
      {
        file: 'package.json',
        hash: 'some-hash',
        getChanges: () => jsonDiff(packageJson, updatedPackageJson),
      },
    ]);

    expect(Object.keys(affected.nodes)).toEqual([
      'demo',
      'demo-e2e',
      'ui',
      'util',
      'api',
    ]);
  });
});
