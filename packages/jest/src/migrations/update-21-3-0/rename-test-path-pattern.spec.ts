import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  updateJson,
  type NxJsonConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './rename-test-path-pattern';

describe('rename-test-path-pattern migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should rename "testPathPattern" option', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: { testPathPattern: 'some-regex' },
          configurations: {
            development: { testPathPattern: 'regex-dev' },
            production: { testPathPattern: 'regex-prod' },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets!.test.options.testPathPattern).toBeUndefined();
    expect(project.targets!.test.options.testPathPatterns).toBe('some-regex');
    expect(
      project.targets!.test.configurations!.development.testPathPattern
    ).toBeUndefined();
    expect(
      project.targets!.test.configurations!.development.testPathPatterns
    ).toBe('regex-dev');
    expect(
      project.targets!.test.configurations!.production.testPathPattern
    ).toBeUndefined();
    expect(
      project.targets!.test.configurations!.production.testPathPatterns
    ).toBe('regex-prod');
  });

  it('should not rename "testPathPattern" from target not using the @nx/jest:jest executor', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        test: {
          executor: '@org/awesome-plugin:executor',
          options: { testPathPattern: 'some-regex' },
          configurations: {
            development: { testPathPattern: 'regex-dev' },
            production: { testPathPattern: 'regex-prod' },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets!.test.options.testPathPattern).toBe('some-regex');
    expect(
      project.targets!.test.configurations!.development.testPathPattern
    ).toBe('regex-dev');
    expect(
      project.targets!.test.configurations!.production.testPathPattern
    ).toBe('regex-prod');
  });

  it('should rename "testPathPattern" option in nx.json target defaults for a target with the @nx/jest:jest executor', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = [
        {
          target: 'test',
          executor: '@nx/jest:jest',
          options: { testPathPattern: 'some-regex' },
          configurations: {
            development: { testPathPattern: 'regex-dev' },
            production: { testPathPattern: 'regex-prod' },
          },
        },
      ];
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults).toEqual([
      {
        target: 'test',
        executor: '@nx/jest:jest',
        options: { testPathPatterns: 'some-regex' },
        configurations: {
          development: { testPathPatterns: 'regex-dev' },
          production: { testPathPatterns: 'regex-prod' },
        },
      },
    ]);
  });

  it('should rename "testPathPattern" option in nx.json target defaults for the @nx/jest:jest executor', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = [
        {
          executor: '@nx/jest:jest',
          options: { testPathPattern: 'some-regex' },
          configurations: {
            development: { testPathPattern: 'regex-dev' },
            production: { testPathPattern: 'regex-prod' },
          },
        },
      ];
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults).toEqual([
      {
        executor: '@nx/jest:jest',
        options: { testPathPatterns: 'some-regex' },
        configurations: {
          development: { testPathPatterns: 'regex-dev' },
          production: { testPathPatterns: 'regex-prod' },
        },
      },
    ]);
  });
});
