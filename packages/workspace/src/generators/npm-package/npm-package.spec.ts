import {
  readJson,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { npmPackageGenerator } from './npm-package';

describe('@nx/workspace:npm-package', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    const nxJson = readNxJson(tree);
    nxJson.workspaceLayout = {
      appsDir: 'packages',
      libsDir: 'packages',
    };
    updateNxJson(tree, nxJson);
  });

  it('should generate a minimal package', async () => {
    await npmPackageGenerator(tree, {
      name: 'my-package',
    });

    const project = readProjectConfiguration(tree, 'my-package');
    expect(project).toMatchInlineSnapshot(`
      {
        "$schema": "../../node_modules/nx/schemas/project-schema.json",
        "name": "my-package",
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
        "name": "@proj/my-package",
        "version": "0.0.0",
        "scripts": {
          "test": "node index.js"
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

      const existingIndex = `export * from './src';\n`;
      writeJson(tree, 'packages/my-package/package.json', existingPackageJson);
      tree.write('packages/my-package/index.ts', existingIndex);

      await npmPackageGenerator(tree, {
        name: 'my-package',
      });

      expect(readJson(tree, 'packages/my-package/package.json')).toEqual(
        existingPackageJson
      );
      expect(tree.read('packages/my-package/index.ts').toString()).toEqual(
        existingIndex
      );
    });
  });
});
