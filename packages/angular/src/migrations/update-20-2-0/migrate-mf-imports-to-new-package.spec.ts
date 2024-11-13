import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateMfImportsToNewPackage from './migrate-mf-imports-to-new-package';

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
});
