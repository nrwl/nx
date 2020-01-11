import { extname } from 'path';
import { vol, fs } from 'memfs';
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
        'package.json': {
          scripts: {
            deploy: '*'
          }
        }
      },
      projects: {
        api: { tags: [] },
        demo: { tags: [], implicitDependencies: ['api'] },
        'demo-e2e': { tags: [] },
        ui: { tags: [] },
        'shared-util': { tags: [] }
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
        import * as util from '@nrwl/shared/util';
      `,
      './libs/shared/util/src/index.ts': stripIndents`
        import * as happyNrwl from 'happy-nrwl/a/b/c';
      `,
      './package.json': JSON.stringify(packageJson),
      './nx.json': JSON.stringify(nxJson),
      './workspace.json': JSON.stringify(workspaceJson)
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
      'shared-util': { name: 'shared-util', type: 'lib' }
    });

    expect(graph.dependencies).toMatchObject({
      'demo-e2e': [
        { type: DependencyType.implicit, source: 'demo-e2e', target: 'demo' }
      ],
      demo: expect.arrayContaining([
        { type: DependencyType.implicit, source: 'demo', target: 'api' },
        { type: DependencyType.static, source: 'demo', target: 'ui' }
      ]),
      ui: [{ type: DependencyType.static, source: 'ui', target: 'shared-util' }]
    });
  });

  it('should handle circular dependencies', () => {
    fs.writeFileSync(
      '/root/libs/shared/util/src/index.ts',
      `import * as ui from '@nrwl/ui';`
    );

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
