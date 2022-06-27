import { addProjectConfiguration, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { exportScam } from './export-scam';

describe('exportScam', () => {
  it('should not throw when project is an application (does not have entry point)', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT & ASSERT
    expect(() =>
      exportScam(
        tree,
        {
          componentDirectory: 'apps/app1/src/app/example',
          componentFileName: 'example.component',
          componentFilePath: 'apps/app1/src/example/example.component.ts',
        },
        {
          name: 'example',
          project: 'app1',
          inlineScam: true,
          export: true,
          path: 'apps/app1/src/app',
          projectSourceRoot: 'apps/app1/src',
        }
      )
    ).not.toThrow();
  });

  it('should export the component', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    exportScam(
      tree,
      {
        componentDirectory: 'libs/lib1/src/lib/example',
        componentFileName: 'example.component',
        componentFilePath: 'libs/lib1/src/lib/example/example.component.ts',
      },
      {
        name: 'example',
        project: 'lib1',
        inlineScam: true,
        export: true,
        path: 'libs/lib1/src/lib',
        projectSourceRoot: 'libs/lib1/src',
      }
    );

    // ASSERT
    const entryPointSource = tree.read(`libs/lib1/src/index.ts`, 'utf-8');
    expect(entryPointSource).toMatchInlineSnapshot(
      `"export * from \\"./lib/example/example.component\\";"`
    );
  });

  it('should export the component and the module when "--inline-scam=false"', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    exportScam(
      tree,
      {
        componentDirectory: 'libs/lib1/src/lib/example',
        componentFileName: 'example.component',
        componentFilePath: 'libs/lib1/src/lib/example/example.component.ts',
      },
      {
        name: 'example',
        project: 'lib1',
        inlineScam: false,
        export: true,
        path: 'libs/lib1/src/lib',
        projectSourceRoot: 'libs/lib1/src',
      }
    );

    // ASSERT
    const entryPointSource = tree.read(`libs/lib1/src/index.ts`, 'utf-8');
    expect(entryPointSource).toMatchInlineSnapshot(`
      "export * from \\"./lib/example/example.component\\";
      export * from \\"./lib/example/example.module\\";"
    `);
  });

  it('should export the component from the secondary entrypoint', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
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
    exportScam(
      tree,
      {
        componentDirectory: 'libs/lib1/feature/src/lib/example',
        componentFileName: 'example.component',
        componentFilePath:
          'libs/lib1/feature/src/lib/example/example.component.ts',
      },
      {
        name: 'example',
        project: 'lib1',
        inlineScam: true,
        export: true,
        path: 'libs/lib1/feature/src/lib',
        projectSourceRoot: 'libs/lib1/src',
      }
    );

    // ASSERT
    const entryPointSource = tree.read(
      `libs/lib1/feature/src/index.ts`,
      'utf-8'
    );
    expect(entryPointSource).toMatchInlineSnapshot(
      `"export * from \\"./lib/example/example.component\\";"`
    );
  });
});
