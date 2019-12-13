import { extname } from 'path';
import { vol } from 'memfs';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { createProjectGraph } from '../project-graph';
import { filterAffected } from './affected-project-graph';
import { FileData } from '../file-utils';
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
      dependencies: {
        'happy-nrwl': '1.0.0'
      },
      devDependencies: {
        '@nrwl/workspace': '*'
      }
    };
    workspaceJson = {
      projects: {
        demo: {
          root: 'apps/demo/',
          sourceRoot: 'apps/demo/src',
          projectType: 'application'
        },
        'demo-e2e': {
          root: 'apps/demo-e2e/',
          sourceRoot: 'apps/demo-e2e/src',
          projectType: 'application'
        },
        ui: {
          root: 'libs/ui/',
          sourceRoot: 'libs/ui/src',
          projectType: 'library'
        },
        util: {
          root: 'libs/util/',
          sourceRoot: 'libs/util/src',
          projectType: 'library'
        },
        api: {
          root: 'apps/api/',
          sourceRoot: 'apps/api/src',
          projectType: 'application'
        }
      }
    };
    nxJson = {
      npmScope: 'nrwl',
      implicitDependencies: {
        'something-for-api.txt': ['api']
      },
      projects: {
        api: { tags: [] },
        demo: { tags: [], implicitDependencies: ['api'] },
        'demo-e2e': { tags: [] },
        ui: { tags: [] },
        util: { tags: [] }
      }
    };
    tsConfigJson = {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@nrwl/ui': ['libs/ui/src/index.ts'],
          '@nrwl/util': ['libs/util/src/index.ts']
        }
      }
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
      './tsconfig.json': JSON.stringify(tsConfigJson)
    };
    files = Object.keys(filesJson).map(f => ({
      file: f,
      ext: extname(f),
      mtime: 1
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
        mtime: 1,
        getChanges: () => ['SOMETHING CHANGED']
      },
      {
        file: 'libs/ui/src/index.ts',
        ext: '.ts',
        mtime: 1,
        getChanges: () => ['SOMETHING CHANGED']
      }
    ]);
    expect(affected).toEqual({
      nodes: {
        api: {
          name: 'api',
          type: 'app',
          data: expect.anything()
        },
        demo: {
          name: 'demo',
          type: 'app',
          data: expect.anything()
        },
        'demo-e2e': {
          name: 'demo-e2e',
          type: 'e2e',
          data: expect.anything()
        },
        ui: {
          name: 'ui',
          type: 'lib',
          data: expect.anything()
        }
      },
      dependencies: {
        'demo-e2e': [
          {
            type: 'implicit',
            source: 'demo-e2e',
            target: 'demo'
          }
        ],
        demo: [
          {
            type: 'static',
            source: 'demo',
            target: 'ui'
          },
          {
            type: 'implicit',
            source: 'demo',
            target: 'api'
          }
        ]
      }
    });
  });
});
