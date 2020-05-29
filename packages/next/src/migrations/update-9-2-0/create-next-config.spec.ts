import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('create-next-config-9.2.0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    schematicRunner = new SchematicTestRunner(
      '@nrwl/next',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it('should create next.config.js if it does not exist', async () => {
    tree.overwrite(
      '/workspace.json',
      JSON.stringify({
        version: 1,
        projects: {
          demo1: {
            root: 'apps/demo1',
            sourceRoot: 'apps/demo1/src',
            architect: {
              build: {
                builder: '@nrwl/next:build',
                options: {},
              },
            },
          },
          demo2: {
            root: 'apps/demo2',
            sourceRoot: 'apps/demo2/src',
            architect: {
              build: {
                builder: '@nrwl/react:build',
                options: {},
              },
            },
          },
          demo3: {
            root: 'apps/demo3',
            sourceRoot: 'apps/demo3/src',
            architect: {
              build: {
                builder: '@nrwl/next:build',
                options: {},
              },
            },
          },
        },
        newProjectRoot: '',
      })
    );

    tree = await schematicRunner
      .runSchematicAsync('create-next-config-9.2.0', {}, tree)
      .toPromise();

    // Creates config for Next apps
    const content = tree.read('apps/demo1/next.config.js').toString();
    expect(content).toContain('withStylus(');
    expect(content).toContain('withLess(');
    expect(content).toContain('withSass(');
    expect(content).toContain('withCSS(');

    // Doesn't create config for non-Next apps
    expect(tree.exists('apps/demo2/next.config.js')).toBe(false);
  });

  it('should keep existing next.config.js', async () => {
    tree.overwrite(
      '/workspace.json',
      JSON.stringify({
        version: 1,
        projects: {
          demo: {
            root: 'apps/demo',
            sourceRoot: 'apps/demo/src',
            architect: {
              build: {
                builder: '@nrwl/next:build',
                options: {},
              },
            },
          },
        },
        newProjectRoot: '',
      })
    );

    tree.create('apps/demo/next.config.js', `module.exports = {};`);

    tree = await schematicRunner
      .runSchematicAsync('create-next-config-9.2.0', {}, tree)
      .toPromise();

    const content = tree.read(`apps/demo/next.config.js`).toString();

    expect(content).not.toContain('withStylus(withLess(withSass(withCSS({');
  });
});
