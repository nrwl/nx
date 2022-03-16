import { addProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import componentGenerator from './component';

describe('component Generator', () => {
  it('should create the component correctly and export it', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      export: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).toMatchSnapshot();
  });

  it('should create the component correctly and not export it', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      export: false,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).not.toContain(
      `export * from "./lib/example/example.component"`
    );
  });

  it('should create the component correctly but not export it when no entry point exists', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      export: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexExists = tree.exists('libs/lib1/src/index.ts');
    expect(indexExists).toBeFalsy();
  });

  describe('--flat', () => {
    it('should create the component correctly and export it', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write('libs/lib1/src/index.ts', '');

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        flat: true,
        export: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'libs/lib1/src/lib/example.component.ts',
        'utf-8'
      );
      expect(componentSource).toMatchSnapshot();

      const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
      expect(indexSource).toContain(`export * from "./lib/example.component"`);
    });

    it('should create the component correctly and not export it', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write('libs/lib1/src/index.ts', '');

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        flat: true,
        export: false,
      });

      // ASSERT
      const componentSource = tree.read(
        'libs/lib1/src/lib/example.component.ts',
        'utf-8'
      );
      expect(componentSource).toMatchSnapshot();

      const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
      expect(indexSource).not.toContain(
        `export * from "./lib/example.component"`
      );
    });
  });

  describe('--path', () => {
    it('should create the component correctly and export it', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write('libs/lib1/src/index.ts', '');

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        path: 'libs/lib1/src/lib/mycomp',
        export: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'libs/lib1/src/lib/mycomp/example/example.component.ts',
        'utf-8'
      );
      expect(componentSource).toMatchSnapshot();

      const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
      expect(indexSource).toContain(
        `export * from "./lib/mycomp/example/example.component"`
      );
    });

    it('should throw if the path specified is not under the project root', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write('libs/lib1/src/index.ts', '');

      // ACT & ASSERT
      await expect(
        componentGenerator(tree, {
          name: 'example',
          project: 'lib1',
          path: 'apps/app1/src/mycomp',
          export: false,
        })
      ).rejects.toThrow();
    });
  });
});
