import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import { readJson, readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { libraryGenerator } from '@nx/js';
import { cypressProjectGenerator } from './cypress-project';

jest.mock('@nx/cypress/src/utils/cypress-version');
describe('@nx/storybook:cypress-project', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await libraryGenerator(tree, {
      name: 'test-ui-lib',
    });
  });
  afterEach(() => jest.clearAllMocks());

  it('should generate files', async () => {
    await cypressProjectGenerator(tree, {
      name: 'test-ui-lib',
      linter: Linter.EsLint,
    });

    expect(tree.exists('apps/test-ui-lib-e2e/cypress.config.ts')).toBeTruthy();
    const cypressConfig = tree.read(
      'apps/test-ui-lib-e2e/cypress.config.ts',
      'utf-8'
    );
    expect(cypressConfig).toMatchSnapshot();
  });

  it('should update cypress.json file if present', async () => {
    mockedInstalledCypressVersion.mockReturnValue(9);

    await cypressProjectGenerator(tree, {
      name: 'test-ui-lib',
      linter: Linter.EsLint,
    });

    expect(tree.exists('apps/test-ui-lib-e2e/cypress.json')).toBeTruthy();
    const cypressConfig = readJson(tree, 'apps/test-ui-lib-e2e/cypress.json');
    expect(cypressConfig.baseUrl).toEqual('http://localhost:4400');
  });

  it('should update `angular.json` file', async () => {
    await cypressProjectGenerator(tree, {
      name: 'test-ui-lib',
      linter: Linter.EsLint,
    });
    const project = readProjectConfiguration(tree, 'test-ui-lib-e2e');

    expect(project.targets.e2e.options.devServerTarget).toEqual(
      'test-ui-lib:storybook'
    );
    expect(project.targets.e2e.options.headless).toBeUndefined();
    expect(project.targets.e2e.options.watch).toBeUndefined();
    expect(project.targets.e2e.configurations).toEqual({
      ci: { devServerTarget: `test-ui-lib:storybook:ci` },
    });
  });

  it('should generate in the correct folder', async () => {
    await cypressProjectGenerator(tree, {
      name: 'test-ui-lib',
      directory: 'one/two',
      linter: Linter.EsLint,
    });
    expect(
      readProjectConfiguration(tree, 'one-two-test-ui-lib-e2e')
    ).toBeDefined();
    expect(
      tree.exists('apps/one/two/test-ui-lib-e2e/cypress.config.ts')
    ).toBeTruthy();
  });

  it('should make sure the cypress packages are installed', async () => {
    expect(
      readJson(tree, 'package.json').devDependencies['cypress']
    ).toBeFalsy();
    await cypressProjectGenerator(tree, {
      name: 'test-ui-lib',
      directory: 'one/two',
      linter: Linter.EsLint,
    });
    expect(
      readJson(tree, 'package.json').devDependencies['cypress']
    ).toBeTruthy();

    expect(
      readJson(tree, 'package.json').devDependencies['@nx/cypress']
    ).toBeTruthy();
  });
});
