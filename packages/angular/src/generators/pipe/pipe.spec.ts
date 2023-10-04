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

    tree.write(
      'test/src/app/test.module.ts',
      `import {NgModule} from "@angular/core";
    @NgModule({
      imports: [],
      declarations: [],
      exports: []
    })
    export class TestModule {}`
    );
  });

  it('should generate a pipe with test files and attach to the NgModule automatically', async () => {
    // ARRANGE

    // ACT
    await generatePipeWithDefaultOptions(tree);

    // ASSERT
    expect(tree.read('test/src/app/test.pipe.ts', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('test/src/app/test.pipe.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should import the pipe correctly when flat=false', async () => {
    // ARRANGE

    // ACT
    await generatePipeWithDefaultOptions(tree, { flat: false });

    // ASSERT
    expect(
      tree.read('test/src/app/test/test.pipe.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('test/src/app/test/test.pipe.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should not import the pipe when standalone=true', async () => {
    // ARRANGE

    // ACT
    await generatePipeWithDefaultOptions(tree, { standalone: true });

    // ASSERT
    expect(tree.read('test/src/app/test.pipe.ts', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('test/src/app/test.pipe.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should import the pipe correctly when flat=false and path is nested deeper', async () => {
    // ARRANGE

    // ACT
    await generatePipeWithDefaultOptions(tree, {
      flat: false,
      path: 'test/src/app/my-pipes',
    });

    // ASSERT
    expect(
      tree.read('test/src/app/my-pipes/test/test.pipe.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('test/src/app/my-pipes/test/test.pipe.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should export the pipe correctly when flat=false and path is nested deeper', async () => {
    // ARRANGE

    // ACT
    await generatePipeWithDefaultOptions(tree, {
      flat: false,
      path: 'test/src/app/my-pipes',
      export: true,
    });

    // ASSERT
    expect(
      tree.read('test/src/app/my-pipes/test/test.pipe.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('test/src/app/my-pipes/test/test.pipe.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should not import the pipe when skipImport=true', async () => {
    // ARRANGE

    // ACT
    await generatePipeWithDefaultOptions(tree, {
      flat: false,
      path: 'test/src/app/my-pipes',
      skipImport: true,
    });

    // ASSERT
    expect(
      tree.read('test/src/app/my-pipes/test/test.pipe.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('test/src/app/my-pipes/test/test.pipe.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should not generate test file when skipTests=true', async () => {
    // ARRANGE

    // ACT
    await generatePipeWithDefaultOptions(tree, {
      flat: false,
      path: 'test/src/app/my-pipes',
      skipTests: true,
    });

    // ASSERT
    expect(
      tree.read('test/src/app/my-pipes/test/test.pipe.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.exists('test/src/app/my-pipes/test/test.pipe.spec.ts')
    ).toBeFalsy();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });
});

async function generatePipeWithDefaultOptions(
  tree: Tree,
  overrides: Partial<Schema> = {}
) {
  await pipeGenerator(tree, {
    name: 'test',
    project: 'test',
    flat: true,
    ...overrides,
  });
}
