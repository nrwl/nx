import { extname } from 'path';
import { vol } from 'memfs';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { createProjectGraph } from './project-graph';
import { DependencyType } from './project-graph-models';
import { FileData } from '../file-utils';
import { NxJson } from '../shared-interfaces';

jest.mock('fs', () => require('memfs').fs);
jest.mock('../../utils/app-root', () => ({ appRootPath: '/root' }));

describe('project graph', () => {
  let packageJson: any;
  let workspaceJson: any;
  let nxJson: NxJson;
  let tsConfigJson: any;
  let filesJson: any;
  let files: FileData[];

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
        'shared-util': {
          root: 'libs/shared/util/',
          sourceRoot: 'libs/shared/util/src',
          projectType: 'library'
        },
        'shared-util-data': {
          root: 'libs/shared/util/data',
          sourceRoot: 'libs/shared/util/data/src',
          projectType: 'library'
        },
        'lazy-lib': {
          root: 'libs/lazy-lib',
          sourceRoot: 'libs/lazy-lib',
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
      projects: {
        api: { tags: [] },
        demo: { tags: [], implicitDependencies: ['api'] },
        'demo-e2e': { tags: [] },
        ui: { tags: [] },
        'shared-util': { tags: [] },
        'shared-util-data': { tags: [] },
        'lazy-lib': { tags: [] }
      }
    };
    tsConfigJson = {
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@nrwl/shared/util': ['libs/shared/util/src/index.ts'],
          '@nrwl/shared-util-data': ['libs/shared/util/data/src/index.ts'],
          '@nrwl/ui': ['libs/ui/src/index.ts'],
          '@nrwl/lazy-lib': ['libs/lazy-lib/src/index.ts']
        }
      }
    };
    filesJson = {
      './apps/api/src/index.ts': stripIndents`
        console.log('starting server');
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
      `,
      './libs/shared/util/src/index.ts': stripIndents`
        import * as happyNrwl from 'happy-nrwl';
      `,
      './libs/shared/util/data/src/index.ts': stripIndents`
        export const SHARED_DATA = 'shared data';
      `,
      './libs/lazy-lib/src/index.ts': stripIndents`
        export const LAZY = 'lazy lib';
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
    vol.fromJSON(filesJson, '/root');
  });

  it('should create nodes and dependencies with workspace projects', () => {
    const graph = createProjectGraph();

    expect(graph.nodes).toMatchObject({
      api: { name: 'api', type: 'app' },
      'demo-e2e': { name: 'demo-e2e', type: 'e2e' },
      demo: { name: 'demo', type: 'app' },
      ui: { name: 'ui', type: 'lib' },
      'shared-util': { name: 'shared-util', type: 'lib' },
      'shared-util-data': { name: 'shared-util-data', type: 'lib' },
      'lazy-lib': { name: 'lazy-lib', type: 'lib' }
    });
    expect(graph.dependencies).toMatchObject({
      'demo-e2e': [
        { type: DependencyType.implicit, source: 'demo-e2e', target: 'demo' }
      ],
      demo: [
        { type: DependencyType.static, source: 'demo', target: 'ui' },
        {
          type: DependencyType.static,
          source: 'demo',
          target: 'shared-util-data'
        },
        {
          type: DependencyType.dynamic,
          source: 'demo',
          target: 'lazy-lib'
        },
        { type: DependencyType.implicit, source: 'demo', target: 'api' }
      ],
      ui: [{ type: DependencyType.static, source: 'ui', target: 'shared-util' }]
    });
  });

  it('should handle circular dependencies', () => {
    filesJson['./libs/shared/util/src/index.ts'] = stripIndents`
        import * as ui from '@nrwl/ui';
        import * as happyNrwl from 'happy-nrwl';
    `;
    vol.fromJSON(filesJson, '/root');

    const graph = createProjectGraph();

    expect(graph.dependencies['shared-util']).toEqual([
      {
        type: DependencyType.static,
        source: 'shared-util',
        target: 'ui'
      }
    ]);
    expect(graph.dependencies['ui']).toEqual([
      {
        type: DependencyType.static,
        source: 'ui',
        target: 'shared-util'
      }
    ]);
  });
});
