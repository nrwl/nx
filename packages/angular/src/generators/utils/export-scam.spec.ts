import { addProjectConfiguration, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { exportScam } from './export-scam';

describe('exportScam', () => {
  it('should not throw when project is an application (does not have entry point)', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT & ASSERT
    expect(() =>
      exportScam(tree, {
        directory: 'apps/app1/src/app/example',
        filePath: 'apps/app1/src/example/example-component.ts',
        name: 'example',
        projectName: 'app1',
        modulePath: 'apps/app1/src/example/example-module.ts',
        inlineScam: true,
        export: true,
      })
    ).not.toThrow();
  });

  it('should export the component', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    exportScam(tree, {
      directory: 'libs/lib1/src/lib/example',
      filePath: 'libs/lib1/src/lib/example/example-component.ts',
      name: 'example',
      projectName: 'lib1',
      modulePath: 'libs/lib1/src/lib/example/example-module.ts',
      inlineScam: true,
      export: true,
    });

    // ASSERT
    const entryPointSource = tree.read(`libs/lib1/src/index.ts`, 'utf-8');
    expect(entryPointSource).toMatchInlineSnapshot(
      `"export * from './lib/example/example-component';"`
    );
  });

  it('should export the component and the module when "--inline-scam=false"', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    exportScam(tree, {
      directory: 'libs/lib1/src/lib/example',
      filePath: 'libs/lib1/src/lib/example/example-component.ts',
      name: 'example',
      projectName: 'lib1',
      modulePath: 'libs/lib1/src/lib/example/example-module.ts',
      inlineScam: false,
      export: true,
    });

    // ASSERT
    const entryPointSource = tree.read(`libs/lib1/src/index.ts`, 'utf-8');
    expect(entryPointSource).toMatchInlineSnapshot(`
      "export * from './lib/example/example-component';
      export * from './lib/example/example-module';"
    `);
  });

  it('should export the component from the secondary entrypoint', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write('libs/lib1/src/index.ts', '');
    tree.write('libs/lib1/feature/src/index.ts', '');
    writeJson(tree, 'libs/lib1/feature/ng-package.json', {
      lib: { entryFile: './src/index.ts' },
    });

    // ACT
    exportScam(tree, {
      directory: 'libs/lib1/feature/src/lib/example',
      filePath: 'libs/lib1/feature/src/lib/example/example-component.ts',
      name: 'example',
      projectName: 'lib1',
      modulePath: 'libs/lib1/feature/src/lib/example/example-module.ts',
      inlineScam: true,
      export: true,
    });

    // ASSERT
    const entryPointSource = tree.read(
      `libs/lib1/feature/src/index.ts`,
      'utf-8'
    );
    expect(entryPointSource).toMatchInlineSnapshot(
      `"export * from './lib/example/example-component';"`
    );
  });
});
