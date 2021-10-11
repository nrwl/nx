import { vol, fs } from 'memfs';

jest.mock('fs', () => require('memfs').fs);
jest.mock('@nrwl/tao/src/utils/app-root', () => ({
  appRootPath: '/root',
}));
import {
  buildProjectGraph,
  projectGraphMigrate3to4,
  projectGraphCompat4to3,
} from './build-project-graph';
import {
  NxJsonConfiguration,
  stripIndents,
  DependencyType,
} from '@nrwl/devkit';
import { defaultFileHasher } from '../hasher/file-hasher';
import { projectFileDataCompatAdapter } from '../file-utils';

describe('project graph', () => {
  let packageJson: any;
  let workspaceJson: any;
  let nxJson: NxJsonConfiguration;
  let tsConfigJson: any;
  let filesJson: any;

  beforeEach(() => {
    packageJson = {
      name: '@nrwl/workspace-src',
      dependencies: {
        express: '4.0.0',
        'happy-nrwl': '1.0.0',
      },
      devDependencies: {
        '@nrwl/workspace': '*',
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
        'shared-util': {
          root: 'libs/shared/util/',
          sourceRoot: 'libs/shared/util/src',
          projectType: 'library',
        },
        'shared-util-data': {
          root: 'libs/shared/util/data',
          sourceRoot: 'libs/shared/util/data/src',
          projectType: 'library',
        },
        'lazy-lib': {
          root: 'libs/lazy-lib',
          sourceRoot: 'libs/lazy-lib',
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
            deploy: '*',
          },
        },
      },
      projects: {
        api: { tags: [] },
        demo: { tags: [], implicitDependencies: ['api'] },
        'demo-e2e': { tags: [] },
        ui: { tags: [] },
        'shared-util': { tags: [] },
        'shared-util-data': { tags: [] },
        'lazy-lib': { tags: [] },
      },
    };
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
      './nx.json': JSON.stringify(nxJson),
      './workspace.json': JSON.stringify(workspaceJson),
      './tsconfig.base.json': JSON.stringify(tsConfigJson),
    };
    vol.reset();
    vol.fromJSON(filesJson, '/root');
  });

  it('should throw an appropriate error for an invalid json config', async () => {
    vol.appendFileSync('/root/tsconfig.base.json', 'invalid');
    try {
      await buildProjectGraph();
      fail('Invalid tsconfigs should cause project graph to throw error');
    } catch (e) {
      expect(e.message).toMatchInlineSnapshot(
        `"InvalidSymbol in /root/tsconfig.base.json at position 247"`
      );
    }
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
        { source: 'demo', target: 'api', type: 'implicit' },
        {
          source: 'demo',
          target: 'ui',
          type: 'static',
        },
        { source: 'demo', target: 'shared-util-data', type: 'static' },
        {
          source: 'demo',
          target: 'lazy-lib',
          type: 'static',
        },
      ],
      'demo-e2e': [],
      'lazy-lib': [],
      'npm:@nrwl/workspace': [],
      'npm:express': [],
      'npm:happy-nrwl': [],
      'shared-util': [
        { source: 'shared-util', target: 'npm:happy-nrwl', type: 'static' },
      ],
      'shared-util-data': [],
      ui: [
        { source: 'ui', target: 'shared-util', type: 'static' },
        {
          source: 'ui',
          target: 'lazy-lib',
          type: 'static',
        },
      ],
    });
  });

  it('should update the graph if a project got renamed', async () => {
    let graph = await buildProjectGraph();
    expect(graph.nodes).toMatchObject({
      demo: { name: 'demo', type: 'app' },
    });
    workspaceJson.projects.renamed = workspaceJson.projects.demo;
    fs.writeFileSync('/root/workspace.json', JSON.stringify(workspaceJson));

    defaultFileHasher.init();

    graph = await buildProjectGraph();
    expect(graph.nodes).toMatchObject({
      renamed: { name: 'renamed', type: 'app' },
    });
  });

  it('should handle circular dependencies', async () => {
    fs.writeFileSync(
      '/root/libs/shared/util/src/index.ts',
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
        type: DependencyType.static,
        source: 'ui',
        target: 'lazy-lib',
      },
    ]);
  });

  describe('project graph adapters', () => {
    it('should map FileData to deprecated graph version', () => {
      expect(
        projectFileDataCompatAdapter({ file: 'a.ts', hash: 'some hash' }, '3.0')
      ).toEqual({ file: 'a.ts', hash: 'some hash', ext: '.ts' });
      expect(
        projectFileDataCompatAdapter(
          {
            file: 'a.ts',
            hash: 'some hash',
            deps: [],
          },
          '3.0'
        )
      ).toEqual({ file: 'a.ts', hash: 'some hash', ext: '.ts', deps: [] });
      expect(
        projectFileDataCompatAdapter(
          {
            file: 'a.ts',
            hash: 'some hash',
            ext: '.keepthis',
          },
          '3.0'
        )
      ).toEqual({ file: 'a.ts', hash: 'some hash', ext: '.keepthis' });
    });
    it('should map FileData to latest graph version', () => {
      expect(
        projectFileDataCompatAdapter(
          { file: 'a.ts', hash: 'some hash', ext: '.ts' },
          '4.0'
        )
      ).toEqual({ file: 'a.ts', hash: 'some hash' });
      expect(
        projectFileDataCompatAdapter(
          { file: 'a.ts', hash: 'some hash', ext: '.ts', deps: [] },
          '4.0'
        )
      ).toEqual({ file: 'a.ts', hash: 'some hash', deps: [] });
    });
    it('should map nodes to deprecated graph version', () => {
      const source = {
        nodes: {
          node1: {
            name: 'node1',
            type: 'app',
            data: {
              files: [
                { file: 'index.ts', hash: 'some hash' },
                {
                  file: 'node1.jpeg',
                  hash: 'some hash',
                  ext: '.keepextension',
                },
              ],
            },
          },
          node2: {
            name: 'node2',
            type: 'lib',
            data: {
              files: [{ file: 'node2.html', hash: 'some hash', deps: [] }],
            },
          },
        },
        dependencies: {},
        version: '4.0',
      };
      const result = {
        nodes: {
          node1: {
            name: 'node1',
            type: 'app',
            data: {
              files: [
                { file: 'index.ts', hash: 'some hash', ext: '.ts' },
                {
                  file: 'node1.jpeg',
                  hash: 'some hash',
                  ext: '.keepextension',
                },
              ],
            },
          },
          node2: {
            name: 'node2',
            type: 'lib',
            data: {
              files: [
                {
                  file: 'node2.html',
                  hash: 'some hash',
                  deps: [],
                  ext: '.html',
                },
              ],
            },
          },
        },
        dependencies: {},
        version: '3.0',
      };
      expect(projectGraphCompat4to3(source)).toEqual(result);
    });
    it('should map nodes to latest graph version', () => {
      const source = {
        nodes: {
          node1: {
            name: 'node1',
            type: 'app',
            data: {
              files: [
                { file: 'index.ts', hash: 'some hash', ext: '.ts' },
                {
                  file: 'node1.jpeg',
                  hash: 'some hash',
                  ext: '.keepextension',
                },
              ],
            },
          },
          node2: {
            name: 'node2',
            type: 'lib',
            data: {
              files: [
                {
                  file: 'node2.html',
                  hash: 'some hash',
                  deps: [],
                  ext: '.html',
                },
              ],
            },
          },
        },
        dependencies: {},
        version: '3.0',
      };
      const result = {
        nodes: {
          node1: {
            name: 'node1',
            type: 'app',
            data: {
              files: [
                { file: 'index.ts', hash: 'some hash' },
                { file: 'node1.jpeg', hash: 'some hash' },
              ],
            },
          },
          node2: {
            name: 'node2',
            type: 'lib',
            data: {
              files: [{ file: 'node2.html', hash: 'some hash', deps: [] }],
            },
          },
        },
        dependencies: {},
        version: '4.0',
      };
      expect(projectGraphMigrate3to4(source)).toEqual(result);
    });
  });
});
