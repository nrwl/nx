import { extname } from 'path';
import { jsonDiff } from '../../utils/json-diff';
import { vol } from 'memfs';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { createProjectGraph } from '../project-graph';
import { filterAffected } from './affected-project-graph';
import { FileData, WholeFileChange } from '../file-utils';
import { NxJson } from '../shared-interfaces';

jest.mock('fs', () => require('memfs').fs);
jest.mock('../../utils/app-root', () => ({ appRootPath: '/root' }));

describe('project graph', () => {
  let packageJson: any;
  let workspaceJson: any;
  let tsConfigJson: any;
  let nxJson: NxJson;
  let filesJson: any;
  let filesAtMasterJson: any;
  let files: FileData[];
  let readFileAtRevision: (path: string, rev: string) => string;

  beforeEach(() => {
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
      './tsconfig.json': JSON.stringify(tsConfigJson),
    };
    files = Object.keys(filesJson).map((f) => ({
      file: f,
      ext: extname(f),
      hash: 'some-hash',
    }));
    readFileAtRevision = (p, r) => {
      const fromFs = filesJson[`./${p}`];
      if (!fromFs) {
        throw new Error(`File not found: ${p}`);
      }
      if (r === 'master') {
        const fromMaster = filesAtMasterJson[`./${p}`];
        return fromMaster || fromFs;
      } else {
        return fromFs;
      }
    };
    vol.fromJSON(filesJson, '/root');
  });

  it('should create nodes and dependencies with workspace projects', () => {
    const graph = createProjectGraph();
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
    expect(affected).toEqual({
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
        'demo-e2e': {
          name: 'demo-e2e',
          type: 'e2e',
          data: expect.anything(),
        },
        ui: {
          name: 'ui',
          type: 'lib',
          data: expect.anything(),
        },
      },
      dependencies: {
        'demo-e2e': [
          {
            type: 'implicit',
            source: 'demo-e2e',
            target: 'demo',
          },
        ],
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
        api: [],
        ui: [],
      },
    });
  });

  it('should create nodes and dependencies with npm packages', () => {
    const graph = createProjectGraph();
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
        'demo-e2e': {
          name: 'demo-e2e',
          type: 'e2e',
          data: expect.anything(),
        },
      },
      dependencies: {
        'npm:happy-nrwl': [],
        'demo-e2e': [
          {
            type: 'implicit',
            source: 'demo-e2e',
            target: 'demo',
          },
        ],
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

  it('should support implicit JSON file dependencies (some projects)', () => {
    const graph = createProjectGraph();
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

    expect(Object.keys(affected.nodes)).toEqual(['demo', 'demo-e2e', 'api']);
  });

  it('should support implicit JSON file dependencies (all projects)', () => {
    const graph = createProjectGraph();
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
