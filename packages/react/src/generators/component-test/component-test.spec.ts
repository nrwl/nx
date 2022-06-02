import { assertMinimumCypressVersion } from '@nrwl/cypress/src/utils/cypress-version';
import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import libraryGenerator from '../library/library';
import { componentTestGenerator } from './component-test';

jest.mock('@nrwl/cypress/src/utils/cypress-version');
describe(componentTestGenerator.name, () => {
  let tree: Tree;
  let mockedAssertMinimumCypressVersion: jest.Mock<
    ReturnType<typeof assertMinimumCypressVersion>
  > = assertMinimumCypressVersion as never;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });
  it('should create component test for tsx files', async () => {
    mockedAssertMinimumCypressVersion.mockReturnValue();
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
    });

    componentTestGenerator(tree, {
      project: 'some-lib',
      componentPath: 'lib/some-lib.tsx',
    });

    expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
  });

  it('should create component test for jsx files', async () => {
    mockedAssertMinimumCypressVersion.mockReturnValue();
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
      js: true,
    });

    componentTestGenerator(tree, {
      project: 'some-lib',
      componentPath: 'lib/some-lib.jsx',
    });

    expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.jsx')).toBeTruthy();
  });

  it('should not throw if path is invalid', async () => {
    mockedAssertMinimumCypressVersion.mockReturnValue();
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
    });

    expect(() => {
      componentTestGenerator(tree, {
        project: 'some-lib',
        componentPath: 'lib/blah/abc-123.blah',
      });
    }).not.toThrow();
  });

  it('should handle being provided the full path to the component', async () => {
    mockedAssertMinimumCypressVersion.mockReturnValue();
    await libraryGenerator(tree, {
      linter: Linter.EsLint,
      name: 'some-lib',
      skipFormat: true,
      skipTsConfig: false,
      style: 'scss',
      unitTestRunner: 'none',
      component: true,
    });

    componentTestGenerator(tree, {
      project: 'some-lib',
      componentPath: 'libs/some-lib/src/lib/some-lib.tsx',
    });

    expect(tree.exists('libs/some-lib/src/lib/some-lib.cy.tsx')).toBeTruthy();
  });
});
