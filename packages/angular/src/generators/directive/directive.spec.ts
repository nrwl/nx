import {
  addProjectConfiguration,
  readProjectConfiguration,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { AngularProjectConfiguration } from '../../utils/types';
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
  });

  it('should generate correctly', async () => {
    // ACT
    await generateDirectiveWithDefaultOptions(tree, { skipFormat: false });

    // ASSERT
    expect(
      tree.read('test/src/app/test.directive.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('test/src/app/test.directive.spec.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should not import the directive into an existing module', async () => {
    // ARRANGE
    addModule(tree);

    // ACT
    await generateDirectiveWithDefaultOptions(tree);

    // ASSERT
    expect(tree.read('test/src/app/test.module.ts', 'utf-8')).not.toContain(
      'TestDirective'
    );
  });

  it('should not generate test file when skipTests=true', async () => {
    // ARRANGE

    // ACT
    await generateDirectiveWithDefaultOptions(tree, {
      path: 'test/src/app/my-directives/test',
      skipTests: true,
    });

    // ASSERT
    expect(
      tree.exists('test/src/app/my-directives/test/test.directive.spec.ts')
    ).toBeFalsy();
  });

  describe('--no-standalone', () => {
    beforeEach(() => {
      addModule(tree);
    });

    it('should generate a directive with test files and attach to the NgModule automatically', async () => {
      // ARRANGE

      // ACT
      await generateDirectiveWithDefaultOptions(tree, {
        standalone: false,
        skipFormat: false,
      });

      // ASSERT
      expect(
        tree.read('test/src/app/test.directive.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('test/src/app/test.directive.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('test/src/app/test.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should import the directive correctly', async () => {
      // ARRANGE

      // ACT
      await generateDirectiveWithDefaultOptions(tree, {
        standalone: false,
      });

      // ASSERT
      expect(
        tree.read('test/src/app/test/test.directive.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('test/src/app/test/test.directive.spec.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(
        tree.read('test/src/app/test.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should import the directive correctly when directory is nested deeper', async () => {
      // ARRANGE

      // ACT
      await generateDirectiveWithDefaultOptions(tree, {
        path: 'test/src/app/my-directives/test/test',
        standalone: false,
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
      expect(
        tree.read('test/src/app/test.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should export the directive correctly when directory is nested deeper', async () => {
      // ARRANGE

      // ACT
      await generateDirectiveWithDefaultOptions(tree, {
        path: 'test/src/app/my-directives/test/test',
        export: true,
        standalone: false,
      });

      // ASSERT
      expect(
        tree.read('test/src/app/test.module.ts', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should not import the directive when skipImport=true', async () => {
      // ARRANGE

      // ACT
      await generateDirectiveWithDefaultOptions(tree, {
        path: 'test/src/app/my-directives',
        skipImport: true,
        standalone: false,
      });

      // ASSERT
      expect(tree.read('test/src/app/test.module.ts', 'utf-8')).not.toContain(
        'TestDirective'
      );
    });
  });

  describe('prefix & selector', () => {
    it('should use the prefix', async () => {
      await directiveGenerator(tree, {
        path: 'test/src/app/example/example',
        name: 'example',
        prefix: 'foo',
      });

      const content = tree.read(
        'test/src/app/example/example.directive.ts',
        'utf-8'
      );
      expect(content).toMatch(/selector: '\[fooExample\]'/);
    });

    it('should use the default project prefix if none is passed', async () => {
      const projectConfig = readProjectConfiguration(tree, 'test');
      updateProjectConfiguration(tree, 'test', {
        ...projectConfig,
        prefix: 'bar',
      } as AngularProjectConfiguration);

      await directiveGenerator(tree, {
        path: 'test/src/app/example/example',
        name: 'example',
      });

      const content = tree.read(
        'test/src/app/example/example.directive.ts',
        'utf-8'
      );
      expect(content).toMatch(/selector: '\[barExample\]'/);
    });

    it('should not use the default project prefix when supplied prefix is ""', async () => {
      const projectConfig = readProjectConfiguration(tree, 'test');
      updateProjectConfiguration(tree, 'test', {
        ...projectConfig,
        prefix: '',
      } as AngularProjectConfiguration);

      await directiveGenerator(tree, {
        path: 'test/src/app/example/example',
        name: 'example',
      });

      const content = tree.read(
        'test/src/app/example/example.directive.ts',
        'utf-8'
      );
      expect(content).toMatch(/selector: '\[example\]'/);
    });

    it('should use provided selector as is', async () => {
      await directiveGenerator(tree, {
        path: 'test/src/app/example/example',
        name: 'example',
        selector: 'mySelector',
      });

      const content = tree.read(
        'test/src/app/example/example.directive.ts',
        'utf-8'
      );
      expect(content).toMatch(/selector: '\[mySelector\]'/);
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

async function generateDirectiveWithDefaultOptions(
  tree: Tree,
  overrides: Partial<Schema> = {}
) {
  await directiveGenerator(tree, {
    name: 'test',
    path: 'test/src/app/test',
    skipFormat: true,
    ...overrides,
  });
}
