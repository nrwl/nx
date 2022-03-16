import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { createApp, createLib, createWebApp } from '../utils/testing';
import { DependencyType, ProjectGraph } from '@nrwl/devkit';

let projectGraph: ProjectGraph;
jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

describe('Migrate babel setup', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    schematicRunner = new SchematicTestRunner(
      '@nrwl/react',
      path.join(__dirname, '../../../migrations.json')
    );
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          react: '16.13.1',
          'react-dom': '16.13.1',
        },
      })
    );
    projectGraph = {
      nodes: {
        demo: {
          name: 'demo',
          type: 'app',
          data: {
            root: 'apps/demo',
            files: [],
          },
        },
        ui: {
          name: 'ui',
          type: 'lib',
          data: {
            root: 'libs/ui',
            files: [],
          },
        },
      },
      externalNodes: {
        'npm:react': {
          name: 'npm:react',
          type: 'npm',
          data: {
            version: '1',
            packageName: 'react',
          },
        },
      },
      dependencies: {
        demo: [
          {
            type: DependencyType.static,
            source: 'demo',
            target: 'npm:react',
          },
        ],
        ui: [
          {
            type: DependencyType.static,
            source: 'ui',
            target: 'npm:react',
          },
        ],
        'npm:react': [],
      },
    };
  });

  it(`should create .babelrc for projects without them`, async () => {
    tree = await createApp(tree, 'demo');
    tree = await createLib(tree, 'ui');

    tree = await schematicRunner
      .runSchematicAsync('babelrc-9.4.0', {}, tree)
      .toPromise();

    expect(tree.exists('/babel.config.json')).toBe(true);
    expect(tree.exists('/apps/demo/.babelrc')).toBe(true);
    expect(tree.exists('/libs/ui/.babelrc')).toBe(true);
  });

  it(`should not overwrite existing .babelrc files`, async () => {
    tree = await createApp(tree, 'demo');
    tree.create('/apps/demo/.babelrc', '{}');

    tree = await schematicRunner
      .runSchematicAsync('babelrc-9.4.0', {}, tree)
      .toPromise();

    const content = tree.read('/apps/demo/.babelrc').toString();
    expect(content.trim()).toEqual('{}');
  });

  it(`should not migrate non-React projects`, async () => {
    tree = await createWebApp(tree, 'demo');

    projectGraph.dependencies.demo = [];

    tree = await schematicRunner
      .runSchematicAsync('babelrc-9.4.0', {}, tree)
      .toPromise();

    expect(tree.exists('/apps/demo/.babelrc')).toBe(false);
  });

  it(`should not overwrite babel.config.js file`, async () => {
    tree.create('/babel.config.js', 'module.exports = {};');

    tree = await schematicRunner
      .runSchematicAsync('babelrc-9.4.0', {}, tree)
      .toPromise();

    expect(tree.exists('/babel.config.js')).toBe(true);
    expect(tree.exists('/babel.config.json')).toBe(false);
  });
});
