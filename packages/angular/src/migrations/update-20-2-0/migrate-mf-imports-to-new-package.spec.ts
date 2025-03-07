import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateMfImportsToNewPackage from './migrate-mf-imports-to-new-package';

jest.mock('@nx/devkit', () => {
  const original = jest.requireActual('@nx/devkit');
  return {
    ...original,
    createProjectGraphAsync: jest.fn().mockResolvedValue(
      Promise.resolve({
        dependencies: {
          shell: [
            {
              source: 'shell',
              target: 'npm:@nx/webpack',
              type: 'static',
            },
          ],
          remote: [
            {
              source: 'remote',
              target: 'npm:@nx/webpack',
              type: 'static',
            },
          ],
          'npm:@nx/playwright': [
            {
              source: 'npm:@nx/playwright',
              target: 'npm:@nx/webpack',
              type: 'static',
            },
          ],
        },
        nodes: {
          shell: {
            name: 'shell',
            type: 'app',
            data: {
              root: 'apps/shell',
              sourceRoot: 'shell/src',
              targets: {},
            },
          },
          remote: {
            name: 'remote',
            type: 'app',
            data: {
              root: 'apps/remote',
              sourceRoot: 'remote/src',
              targets: {},
            },
          },
        },
        externalNodes: {
          'npm:@nx/playwright': {
            type: 'npm',
            name: 'npm:@nx/playwright',
            data: {
              version: '20.2.0-beta.3',
              packageName: '@nx/playwright',
              hash: 'sha512-8rzIZ8ljVfWsOqmSUSRPo0lT19oAhTR2nAI25V3wbFwhlErQ7kpgKd45W36Tja1aka729cO3mAH5ACKSujU6wQ==',
            },
          },
        },
      })
    ),
  };
});

describe('migrate-mf-imports-to-new-package', () => {
  it('should update the ModuleFederationConfig import to change the import when its a single line', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/shell/webpack.config.js',
      `import { ModuleFederationConfig } from '@nx/webpack';`
    );
    tree.write(
      'apps/shell/module-federation.config.ts',
      `import { ModuleFederationConfig } from '@nx/webpack';`
    );
    tree.write(
      'apps/remote/webpack.config.ts',
      `import { ModuleFederationConfig } from '@nx/webpack';`
    );
    tree.write(
      'apps/remote/module-federation.config.js',
      `import { ModuleFederationConfig } from '@nx/webpack';`
    );

    // ACT
    await migrateMfImportsToNewPackage(tree);

    // ASSERT
    expect(tree.read('apps/shell/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
    expect(tree.read('apps/remote/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
    expect(tree.read('apps/shell/module-federation.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
    expect(tree.read('apps/remote/module-federation.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
  });

  it('should not update the ModuleFederationConfig import when its correct', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/shell/webpack.config.js',
      `import { ModuleFederationConfig } from '@nx/module-federation';`
    );
    tree.write(
      'apps/shell/module-federation.config.ts',
      `import { ModuleFederationConfig } from '@nx/module-federation';`
    );
    tree.write(
      'apps/remote/webpack.config.ts',
      `import { ModuleFederationConfig } from '@nx/module-federation';`
    );
    tree.write(
      'apps/remote/module-federation.config.js',
      `import { ModuleFederationConfig } from '@nx/module-federation';`
    );

    // ACT
    await migrateMfImportsToNewPackage(tree);

    // ASSERT
    expect(tree.read('apps/shell/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
    expect(tree.read('apps/remote/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
    expect(tree.read('apps/shell/module-federation.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
    expect(tree.read('apps/remote/module-federation.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
  });

  it('should update the ModuleFederationConfig import to change the import when its across multiple lines', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/shell/webpack.config.js',
      `import { 
      ModuleFederationConfig 
      } from '@nx/webpack';`
    );
    tree.write(
      'apps/shell/module-federation.config.ts',
      `import { 
      ModuleFederationConfig 
      } from '@nx/webpack';`
    );
    tree.write(
      'apps/remote/webpack.config.ts',
      `import { 
      ModuleFederationConfig 
      } from '@nx/webpack';`
    );
    tree.write(
      'apps/remote/module-federation.config.js',
      `import { 
      ModuleFederationConfig 
      } from '@nx/webpack';`
    );

    // ACT
    await migrateMfImportsToNewPackage(tree);

    // ASSERT
    expect(tree.read('apps/shell/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
    expect(tree.read('apps/remote/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
    expect(tree.read('apps/shell/module-federation.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
    expect(tree.read('apps/remote/module-federation.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
  });

  it('should update the ModuleFederationConfig import to change the import when its a part of multiple imports', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/shell/webpack.config.js',
      `import { something, ModuleFederationConfig } from '@nx/webpack';`
    );
    tree.write(
      'apps/shell/module-federation.config.ts',
      `import { ModuleFederationConfig, something} from '@nx/webpack';`
    );
    tree.write(
      'apps/remote/webpack.config.ts',
      `import { something, ModuleFederationConfig } from '@nx/webpack';`
    );
    tree.write(
      'apps/remote/module-federation.config.js',
      `import { ModuleFederationConfig, something } from '@nx/webpack';`
    );

    // ACT
    await migrateMfImportsToNewPackage(tree);

    // ASSERT
    expect(tree.read('apps/shell/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '@nx/webpack';
      "
    `);
    expect(tree.read('apps/remote/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '@nx/webpack';
      "
    `);
    expect(tree.read('apps/shell/module-federation.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '@nx/webpack';
      "
    `);
    expect(tree.read('apps/remote/module-federation.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '@nx/webpack';
      "
    `);
  });

  it('should update the ModuleFederationConfig import to change the import when its a part of multiple imports across multiple lines', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/shell/webpack.config.js',
      `import { 
        something, 
        ModuleFederationConfig 
      } from '@nx/webpack';`
    );
    tree.write(
      'apps/shell/module-federation.config.ts',
      `import { 
        ModuleFederationConfig, 
        something
      } from '@nx/webpack';`
    );
    tree.write(
      'apps/remote/webpack.config.ts',
      `import { 
        something, 
        ModuleFederationConfig 
      } from '@nx/webpack';`
    );
    tree.write(
      'apps/remote/module-federation.config.js',
      `import { 
        ModuleFederationConfig, 
        something 
      } from '@nx/webpack';`
    );

    // ACT
    await migrateMfImportsToNewPackage(tree);

    // ASSERT
    expect(tree.read('apps/shell/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '@nx/webpack';
      "
    `);
    expect(tree.read('apps/remote/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '@nx/webpack';
      "
    `);
    expect(tree.read('apps/shell/module-federation.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '@nx/webpack';
      "
    `);
    expect(tree.read('apps/remote/module-federation.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '@nx/webpack';
      "
    `);
  });

  it('should not incorrectly update import when it is run twice', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      `apps/shell/webpack.config.ts`,
      `import { composePlugins, withNx, ModuleFederationConfig } from '@nx/webpack';
import { withReact } from '@nx/react';
import { withModuleFederation } from '@nx/react/module-federation';`
    );

    // ACT
    await migrateMfImportsToNewPackage(tree);
    await migrateMfImportsToNewPackage(tree);

    // ASSERT
    expect(tree.read('apps/shell/webpack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { composePlugins, withNx } from '@nx/webpack';
      import { withReact } from '@nx/react';
      import { withModuleFederation } from '@nx/react/module-federation';
      "
    `);
  });
});
