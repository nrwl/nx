import { addProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { pipeGenerator } from './pipe';
import type { Schema } from './schema';

describe('pipe generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'test', {
      root: 'test',
      sourceRoot: 'test/src',
      projectType: 'application',
    });
  });

  it('should generate correctly', async () => {
    // ACT
    await generatePipeWithDefaultOptions(tree, { skipFormat: false });

    // ASSERT
    expect(tree.read('test/src/app/test.pipe.ts', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('test/src/app/test.pipe.spec.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should handle path with file extension', async () => {
    await generatePipeWithDefaultOptions(tree, {
      path: 'test/src/app/test.pipe.ts',
      skipFormat: false,
    });

    expect(tree.read('test/src/app/test.pipe.ts', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('test/src/app/test.pipe.spec.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should not import the pipe into an existing module', async () => {
    // ARRANGE
    addModule(tree);

    // ACT
    await generatePipeWithDefaultOptions(tree, { standalone: true });

    // ASSERT
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).not.toContain(
      'TestPipe'
    );
  });

  it('should not generate test file when skipTests=true', async () => {
    // ACT
    await generatePipeWithDefaultOptions(tree, {
      path: 'test/src/app/my-pipes/test',
      skipTests: true,
    });

    // ASSERT
    expect(
      tree.exists('test/src/app/my-pipes/test/test.pipe.spec.ts')
    ).toBeFalsy();
  });

  it('should error when the class name is invalid', async () => {
    await expect(
      generatePipeWithDefaultOptions(tree, { name: '404' })
    ).rejects.toThrow('Class name "404Pipe" is invalid.');
  });

  describe('--no-standalone', () => {
    beforeEach(() => {
      addModule(tree);
    });

    it('should generate a pipe with test files and attach to the NgModule automatically', async () => {
      // ARRANGE

      // ACT
      await generatePipeWithDefaultOptions(tree, {
        standalone: false,
        skipFormat: false,
      });

      // ASSERT
      expect(tree.read('test/src/app/test.pipe.ts', 'utf-8')).toMatchSnapshot();
      expect(
        tree.read('test/src/app/test.pipe.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('test/src/app/test.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should import the pipe correctly when files are flat', async () => {
      // ARRANGE

      // ACT
      await generatePipeWithDefaultOptions(tree, {
        path: 'test/src/app/test/test',
        standalone: false,
      });

      // ASSERT
      expect(
        tree.read('test/src/app/test/test.pipe.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('test/src/app/test/test.pipe.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('test/src/app/test.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should import the pipe correctly when files are flat but deeply nested', async () => {
      // ARRANGE

      // ACT
      await generatePipeWithDefaultOptions(tree, {
        path: 'test/src/app/my-pipes/test/test',
        standalone: false,
      });

      // ASSERT
      expect(
        tree.read('test/src/app/my-pipes/test/test.pipe.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('test/src/app/my-pipes/test/test.pipe.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('test/src/app/test.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should export the pipe correctly when directory is nested deeper', async () => {
      // ARRANGE

      // ACT
      await generatePipeWithDefaultOptions(tree, {
        path: 'test/src/app/my-pipes/test/test',
        export: true,
        standalone: false,
      });

      // ASSERT
      expect(
        tree.read('test/src/app/test.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should not import the pipe when skipImport=true', async () => {
      // ARRANGE

      // ACT
      await generatePipeWithDefaultOptions(tree, {
        path: 'test/src/app/my-pipes/test/test',
        skipImport: true,
        standalone: false,
      });

      // ASSERT
      expect(tree.read('test/src/app/test.module.ts', 'utf-8')).not.toContain(
        'TestPipe'
      );
    });
  });
});

function addModule(tree: Tree) {
  tree.write(
    'test/src/app/test.module.ts',
    `import { NgModule } from '@angular/core';
@NgModule({
  imports: [],
  declarations: [],
  exports: [],
})
export class TestModule {}
`
  );
}

async function generatePipeWithDefaultOptions(
  tree: Tree,
  overrides: Partial<Schema> = {}
) {
  await pipeGenerator(tree, {
    name: 'test',
    path: 'test/src/app/test',
    skipFormat: true,
    ...overrides,
  });
}
