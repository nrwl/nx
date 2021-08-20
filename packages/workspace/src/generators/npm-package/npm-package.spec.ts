import {
  readJson,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { npmPackageGenerator } from './npm-package';

describe('@nrwl/workspace:npm-package', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    const workspaceConfig = readWorkspaceConfiguration(tree);
    workspaceConfig.workspaceLayout = {
      appsDir: 'packages',
      libsDir: 'packages',
    };
    updateWorkspaceConfiguration(tree, workspaceConfig);
  });

  it('should generate a minimal package', async () => {
    await npmPackageGenerator(tree, {
      name: 'my-package',
    });

    const { projects } = readJson(tree, 'workspace.json');
    expect(projects['my-package']).toMatchInlineSnapshot(`
      Object {
        "root": "packages/my-package",
      }
    `);
  });

  it('should only generate package.json and index.js', async () => {
    await npmPackageGenerator(tree, {
      name: 'my-package',
    });

    expect(tree.read('packages/my-package/package.json').toString())
      .toMatchInlineSnapshot(`
      "{
        \\"name\\": \\"@proj/my-package\\",
        \\"scripts\\": {
          \\"test\\": \\"node index.js\\"
        }
      }
      "
    `);
    expect(tree.read('packages/my-package/index.js').toString())
      .toMatchInlineSnapshot(`
      "console.log('Hello World');
      "
    `);
  });

  describe('for existing projects', () => {
    it('should not modify files, only add configuration', async () => {
      const existingPackageJson = {
        name: 'my-existing-package',
        scripts: {
          'existing-script': 'existing',
        },
      };

      const existingIndex = `export * from './src'`;
      writeJson(tree, 'packages/my-package/package.json', existingPackageJson);
      tree.write('packages/my-package/index.ts', existingIndex);

      await npmPackageGenerator(tree, {
        name: 'my-package',
      });

      const { projects } = readJson(tree, 'workspace.json');
      expect(projects['my-package']).toMatchInlineSnapshot(`
              Object {
                "root": "packages/my-package",
              }
          `);

      expect(readJson(tree, 'packages/my-package/package.json')).toEqual(
        existingPackageJson
      );
      expect(tree.read('packages/my-package/index.ts').toString()).toEqual(
        existingIndex
      );
    });
  });
});
