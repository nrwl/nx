import {
  addProjectConfiguration,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateWithMfImport from './migrate-with-mf-import-to-new-package';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
}));

describe('migrate-with-mf-import-to-new-package', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = { dependencies: {}, nodes: {} };
    addProject(
      tree,
      {
        name: 'shell',
        root: 'apps/shell',
        sourceRoot: 'apps/shell/src',
        projectType: 'application',
      },
      ['npm:@nx/angular']
    );
  });

  it('should migrate the import correctly for withMf', async () => {
    // ARRANGE
    tree.write(
      'apps/shell/webpack.config.ts',
      `import { withModuleFederation } from '@nx/angular/module-federation';`
    );

    // ACT
    await migrateWithMfImport(tree);

    // ASSERT
    expect(tree.read('apps/shell/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { withModuleFederation } from '@nx/module-federation/angular';
      "
    `);
  });

  it('should migrate the require correctly for withMf', async () => {
    // ARRANGE
    tree.write(
      'apps/shell/webpack.config.js',
      `const { withModuleFederation } = require('@nx/angular/module-federation');`
    );

    // ACT
    await migrateWithMfImport(tree);

    // ASSERT
    expect(tree.read('apps/shell/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { withModuleFederation } = require('@nx/module-federation/angular');
      "
    `);
  });

  it('should migrate the import correctly for withMfSSR', async () => {
    // ARRANGE
    tree.write(
      'apps/shell/webpack.config.ts',
      `import { withModuleFederationForSSR } from '@nx/angular/module-federation';`
    );

    // ACT
    await migrateWithMfImport(tree);

    // ASSERT
    expect(tree.read('apps/shell/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { withModuleFederationForSSR } from '@nx/module-federation/angular';
      "
    `);
  });

  it('should migrate the require correctly for withMfSSR', async () => {
    // ARRANGE
    tree.write(
      'apps/shell/webpack.config.js',
      `const { withModuleFederationForSSR } = require('@nx/angular/module-federation');`
    );

    // ACT
    await migrateWithMfImport(tree);

    // ASSERT
    expect(tree.read('apps/shell/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { withModuleFederationForSSR } = require('@nx/module-federation/angular');
      "
    `);
  });

  it('should rewrite all matching imports in a single file', async () => {
    // ARRANGE
    tree.write(
      'apps/shell/webpack.config.ts',
      `import { withModuleFederation } from '@nx/angular/module-federation';
import { withModuleFederationForSSR } from '@nx/angular/module-federation';
const fallback = require('@nx/angular/module-federation');`
    );

    // ACT
    await migrateWithMfImport(tree);

    // ASSERT
    expect(tree.read('apps/shell/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { withModuleFederation } from '@nx/module-federation/angular';
      import { withModuleFederationForSSR } from '@nx/module-federation/angular';
      const fallback = require('@nx/module-federation/angular');
      "
    `);
  });

  it('should skip projects that do not depend on @nx/angular', async () => {
    // ARRANGE
    addProject(tree, {
      name: 'unrelated',
      root: 'apps/unrelated',
      sourceRoot: 'apps/unrelated/src',
      projectType: 'application',
    });
    tree.write(
      'apps/unrelated/webpack.config.ts',
      `import { withModuleFederation } from '@nx/angular/module-federation';`
    );

    // ACT
    await migrateWithMfImport(tree);

    // ASSERT
    const content = tree.read('apps/unrelated/webpack.config.ts', 'utf-8');
    expect(content).toContain(`'@nx/angular/module-federation'`);
    expect(content).not.toContain(`'@nx/module-federation/angular'`);
  });

  it('should add @nx/module-federation to package.json when files were rewritten', async () => {
    // ARRANGE
    tree.write(
      'apps/shell/webpack.config.ts',
      `import { withModuleFederation } from '@nx/angular/module-federation';`
    );

    // ACT
    await migrateWithMfImport(tree);

    // ASSERT
    const pkg = JSON.parse(tree.read('package.json', 'utf-8'));
    expect(pkg.devDependencies?.['@nx/module-federation']).toBeDefined();
  });

  it('should not add @nx/module-federation to package.json when nothing was rewritten', async () => {
    // ARRANGE: no file uses the deprecated import path
    // ACT
    await migrateWithMfImport(tree);

    // ASSERT
    const pkg = JSON.parse(tree.read('package.json', 'utf-8'));
    expect(pkg.devDependencies?.['@nx/module-federation']).toBeUndefined();
  });

  describe('idempotent', () => {
    it('should migrate the import correctly for withMf even when run twice', async () => {
      // ARRANGE
      tree.write(
        'apps/shell/webpack.config.ts',
        `import { withModuleFederation } from '@nx/angular/module-federation';`
      );

      // ACT
      await migrateWithMfImport(tree);
      await migrateWithMfImport(tree);

      // ASSERT
      expect(tree.read('apps/shell/webpack.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { withModuleFederation } from '@nx/module-federation/angular';
        "
      `);
    });

    it('should migrate the require correctly for withMfSSR even when run twice', async () => {
      // ARRANGE
      tree.write(
        'apps/shell/webpack.config.js',
        `const { withModuleFederationForSSR } = require('@nx/angular/module-federation');`
      );

      // ACT
      await migrateWithMfImport(tree);
      await migrateWithMfImport(tree);

      // ASSERT
      expect(tree.read('apps/shell/webpack.config.js', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { withModuleFederationForSSR } = require('@nx/module-federation/angular');
        "
      `);
    });
  });
});

function addProject(
  tree: Tree,
  config: ProjectConfiguration,
  dependencies: string[] = []
): void {
  projectGraph.nodes[config.name] = {
    data: config,
    name: config.name,
    type: config.projectType === 'library' ? 'lib' : 'app',
  };
  projectGraph.dependencies[config.name] = dependencies.map((d) => ({
    source: config.name,
    target: d,
    type: 'static',
  }));
  addProjectConfiguration(tree, config.name, config);
}
