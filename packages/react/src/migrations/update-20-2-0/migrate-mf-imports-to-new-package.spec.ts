import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateMfImportsToNewPackage from './migrate-mf-imports-to-new-package';

describe.each([
  ['webpack', '@nx/webpack'],
  ['rspack', '@nx/rspack/module-federation'],
])('migrate-mf-imports-to-new-package --bundler=%s', (bundler, importPath) => {
  it('should update the ModuleFederationConfig import to change the import when its a single line', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      `apps/shell/${bundler}.config.js`,
      `import { ModuleFederationConfig } from '${importPath}';`
    );
    tree.write(
      'apps/shell/module-federation.config.ts',
      `import { ModuleFederationConfig } from '${importPath}';`
    );
    tree.write(
      `apps/remote/${bundler}.config.ts`,
      `import { ModuleFederationConfig } from '${importPath}';`
    );
    tree.write(
      'apps/remote/module-federation.config.js',
      `import { ModuleFederationConfig } from '${importPath}';`
    );

    // ACT
    await migrateMfImportsToNewPackage(tree);

    // ASSERT
    expect(tree.read(`apps/shell/${bundler}.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
    expect(tree.read(`apps/remote/${bundler}.config.ts`, 'utf-8'))
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
      `apps/shell/${bundler}.config.js`,
      `import { ModuleFederationConfig } from '@nx/module-federation';`
    );
    tree.write(
      'apps/shell/module-federation.config.ts',
      `import { ModuleFederationConfig } from '@nx/module-federation';`
    );
    tree.write(
      `apps/remote/${bundler}.config.ts`,
      `import { ModuleFederationConfig } from '@nx/module-federation';`
    );
    tree.write(
      'apps/remote/module-federation.config.js',
      `import { ModuleFederationConfig } from '@nx/module-federation';`
    );

    // ACT
    await migrateMfImportsToNewPackage(tree);

    // ASSERT
    expect(tree.read(`apps/shell/${bundler}.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
    expect(tree.read(`apps/remote/${bundler}.config.ts`, 'utf-8'))
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
      `apps/shell/${bundler}.config.js`,
      `import { 
      ModuleFederationConfig 
      } from '${importPath}';`
    );
    tree.write(
      'apps/shell/module-federation.config.ts',
      `import { 
      ModuleFederationConfig 
      } from '${importPath}';`
    );
    tree.write(
      `apps/remote/${bundler}.config.ts`,
      `import { 
      ModuleFederationConfig 
      } from '${importPath}';`
    );
    tree.write(
      'apps/remote/module-federation.config.js',
      `import { 
      ModuleFederationConfig 
      } from '${importPath}';`
    );

    // ACT
    await migrateMfImportsToNewPackage(tree);

    // ASSERT
    expect(tree.read(`apps/shell/${bundler}.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
    expect(tree.read(`apps/remote/${bundler}.config.ts`, 'utf-8'))
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
      `apps/shell/${bundler}.config.js`,
      `import { something, ModuleFederationConfig } from '${importPath}';`
    );
    tree.write(
      'apps/shell/module-federation.config.ts',
      `import { ModuleFederationConfig, something} from '${importPath}';`
    );
    tree.write(
      `apps/remote/${bundler}.config.ts`,
      `import { something, ModuleFederationConfig } from '${importPath}';`
    );
    tree.write(
      'apps/remote/module-federation.config.js',
      `import { ModuleFederationConfig, something } from '${importPath}';`
    );

    // ACT
    await migrateMfImportsToNewPackage(tree);

    // ASSERT
    expect(tree.read(`apps/shell/${bundler}.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '${importPath}';
      "
    `);
    expect(tree.read(`apps/remote/${bundler}.config.ts`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '${importPath}';
      "
    `);
    expect(tree.read('apps/shell/module-federation.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '${importPath}';
      "
    `);
    expect(tree.read('apps/remote/module-federation.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '${importPath}';
      "
    `);
  });

  it('should update the ModuleFederationConfig import to change the import when its a part of multiple imports across multiple lines', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      `apps/shell/${bundler}.config.js`,
      `import { 
        something, 
        ModuleFederationConfig 
      } from '${importPath}';`
    );
    tree.write(
      'apps/shell/module-federation.config.ts',
      `import { 
        ModuleFederationConfig, 
        something
      } from '${importPath}';`
    );
    tree.write(
      `apps/remote/${bundler}.config.ts`,
      `import { 
        something, 
        ModuleFederationConfig 
      } from '${importPath}';`
    );
    tree.write(
      'apps/remote/module-federation.config.js',
      `import { 
        ModuleFederationConfig, 
        something 
      } from '${importPath}';`
    );

    // ACT
    await migrateMfImportsToNewPackage(tree);

    // ASSERT
    expect(tree.read(`apps/shell/${bundler}.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '${importPath}';
      "
    `);
    expect(tree.read(`apps/remote/${bundler}.config.ts`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '${importPath}';
      "
    `);
    expect(tree.read('apps/shell/module-federation.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '${importPath}';
      "
    `);
    expect(tree.read('apps/remote/module-federation.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { ModuleFederationConfig } from '@nx/module-federation';
      import { something } from '${importPath}';
      "
    `);
  });

  it('should update the correct import when there are multiple from the bundler', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      `apps/shell/${bundler}.config.js`,
      `import {something} from '${importPath}';
      import { 
        ModuleFederationConfig 
      } from '${importPath}';`
    );

    // ACT
    await migrateMfImportsToNewPackage(tree);

    // ASSERT
    expect(tree.read(`apps/shell/${bundler}.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { something } from '${importPath}';
      import { ModuleFederationConfig } from '@nx/module-federation';
      "
    `);
  });
});
