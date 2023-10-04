import { addProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { directiveGenerator } from './directive';
import type { Schema } from './schema';

describe('directive generator', () => {
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

  it('should generate a directive with test files and attach to the NgModule automatically', async () => {
    // ARRANGE

    // ACT
    await generateDirectiveWithDefaultOptions(tree);

    // ASSERT
    expect(
      tree.read('test/src/app/test.directive.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('test/src/app/test.directive.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should import the directive correctly when flat=false', async () => {
    // ARRANGE

    // ACT
    await generateDirectiveWithDefaultOptions(tree, { flat: false });

    // ASSERT
    expect(
      tree.read('test/src/app/test/test.directive.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('test/src/app/test/test.directive.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should not import the directive when standalone=true', async () => {
    // ARRANGE

    // ACT
    await generateDirectiveWithDefaultOptions(tree, { standalone: true });

    // ASSERT
    expect(
      tree.read('test/src/app/test.directive.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('test/src/app/test.directive.spec.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should import the directive correctly when flat=false and path is nested deeper', async () => {
    // ARRANGE

    // ACT
    await generateDirectiveWithDefaultOptions(tree, {
      flat: false,
      path: 'test/src/app/my-directives',
    });

    // ASSERT
    expect(
      tree.read('test/src/app/my-directives/test/test.directive.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read(
        'test/src/app/my-directives/test/test.directive.spec.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should export the directive correctly when flat=false and path is nested deeper', async () => {
    // ARRANGE

    // ACT
    await generateDirectiveWithDefaultOptions(tree, {
      flat: false,
      path: 'test/src/app/my-directives',
      export: true,
    });

    // ASSERT
    expect(
      tree.read('test/src/app/my-directives/test/test.directive.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read(
        'test/src/app/my-directives/test/test.directive.spec.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should not import the directive when skipImport=true', async () => {
    // ARRANGE

    // ACT
    await generateDirectiveWithDefaultOptions(tree, {
      flat: false,
      path: 'test/src/app/my-directives',
      skipImport: true,
    });

    // ASSERT
    expect(
      tree.read('test/src/app/my-directives/test/test.directive.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read(
        'test/src/app/my-directives/test/test.directive.spec.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should not generate test file when skipTests=true', async () => {
    // ARRANGE

    // ACT
    await generateDirectiveWithDefaultOptions(tree, {
      flat: false,
      path: 'test/src/app/my-directives',
      skipTests: true,
    });

    // ASSERT
    expect(
      tree.read('test/src/app/my-directives/test/test.directive.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.exists('test/src/app/my-directives/test/test.directive.spec.ts')
    ).toBeFalsy();
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).toMatchSnapshot();
  });
});

async function generateDirectiveWithDefaultOptions(
  tree: Tree,
  overrides: Partial<Schema> = {}
) {
  await directiveGenerator(tree, {
    name: 'test',
    project: 'test',
    flat: true,
    ...overrides,
  });
}
