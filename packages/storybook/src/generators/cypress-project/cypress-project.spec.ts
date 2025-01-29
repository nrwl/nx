jest.mock('nx/src/project-graph/plugins/in-process-loader', () => ({
  ...jest.requireActual('nx/src/project-graph/plugins/in-process-loader'),
  loadNxPlugin: jest.fn().mockImplementation(() => {
    return [Promise.resolve({}), () => {}];
  }),
}));
import {
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { libraryGenerator } from '@nx/js';
import { cypressProjectGenerator } from './cypress-project';

describe('@nx/storybook:cypress-project', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await libraryGenerator(tree, {
      name: 'test-ui-lib',
      directory: 'apps/test-ui-lib',
    });
  });
  afterEach(() => jest.clearAllMocks());

  it('should generate files', async () => {
    await cypressProjectGenerator(tree, {
      name: 'test-ui-lib',
      directory: 'apps/test-ui-lib-e2e',
      linter: Linter.EsLint,
    });

    expect(tree.exists('apps/test-ui-lib-e2e/cypress.config.ts')).toBeTruthy();
    const cypressConfig = tree.read(
      'apps/test-ui-lib-e2e/cypress.config.ts',
      'utf-8'
    );
    expect(cypressConfig).toMatchSnapshot();
  });

  it('should update `angular.json` file', async () => {
    await cypressProjectGenerator(tree, {
      name: 'test-ui-lib',
      directory: 'apps/test-ui-lib-e2e',
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
      directory: 'apps/one/two/test-ui-lib-e2e',
      linter: Linter.EsLint,
    });
    expect(readProjectConfiguration(tree, 'test-ui-lib-e2e')).toBeDefined();
    expect(
      tree.exists('apps/one/two/test-ui-lib-e2e/cypress.config.ts')
    ).toBeTruthy();
  });

  it('should generate a correct cypress.config.ts file when using inferred plugins', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push('@nx/cypress/plugin');
    updateNxJson(tree, nxJson);

    // ACT
    await cypressProjectGenerator(tree, {
      name: 'test-ui-lib',
      directory: 'apps/test-ui-lib-e2e',
      linter: Linter.EsLint,
    });

    // ASSERT
    expect(tree.exists('apps/test-ui-lib-e2e/cypress.config.ts')).toBeTruthy();
    const cypressConfig = tree.read(
      'apps/test-ui-lib-e2e/cypress.config.ts',
      'utf-8'
    );
    expect(cypressConfig).toMatchSnapshot();
  });
});
