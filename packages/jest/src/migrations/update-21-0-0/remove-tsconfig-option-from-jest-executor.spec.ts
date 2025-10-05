import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  updateJson,
  type NxJsonConfiguration,
  type ProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './remove-tsconfig-option-from-jest-executor';

describe('remove-tsconfig-option-from-jest-executor', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove tsConfig from default options', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            tsConfig: 'apps/app1/tsconfig.json',
            jestConfig: 'apps/app1/jest.config.ts',
          },
        },
      },
    });

    await migration(tree);

    const updatedConfig = readProjectConfiguration(tree, 'app1');
    expect(updatedConfig.targets.test.options).toStrictEqual({
      jestConfig: 'apps/app1/jest.config.ts',
    });
  });

  it('should remove tsConfig from configurations', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/app1/jest.config.ts',
          },
          configurations: {
            production: {
              tsConfig: 'apps/app1/tsconfig.prod.json',
              codeCoverage: true,
            },
          },
        },
      },
    });

    await migration(tree);

    const updatedConfig = readProjectConfiguration(tree, 'app1');
    expect(updatedConfig.targets.test.configurations.production).toStrictEqual({
      codeCoverage: true,
    });
  });

  it('should handle projects without the deprecated options', async () => {
    const intialProjectConfig: ProjectConfiguration = {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/app1/jest.config.ts',
          },
        },
      },
    };
    addProjectConfiguration(tree, 'app1', intialProjectConfig);

    await migration(tree);

    const updatedConfig = readProjectConfiguration(tree, 'app1');
    expect(updatedConfig.targets.test).toStrictEqual(
      intialProjectConfig.targets.test
    );
  });

  it('should handle projects with multiple targets using jest executor', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/app1/jest.config.ts',
            tsConfig: 'apps/app1/tsconfig.json',
          },
        },
        test2: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/app1/jest.config.ts',
            tsConfig: 'apps/app1/tsconfig.json',
          },
        },
      },
    });

    await migration(tree);

    const updatedConfig = readProjectConfiguration(tree, 'app1');
    expect(updatedConfig.targets.test.options).toStrictEqual({
      jestConfig: 'apps/app1/jest.config.ts',
    });
    expect(updatedConfig.targets.test2.options).toStrictEqual({
      jestConfig: 'apps/app1/jest.config.ts',
    });
  });

  it('should remove tsConfig option in nx.json target defaults for a target with the jest executor', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults.test = {
        executor: '@nx/jest:jest',
        options: {
          jestConfig: '{projectRoot}/jest.config.ts',
          tsConfig: '{projectRoot}/tsconfig.json',
        },
        configurations: {
          production: {
            tsConfig: '{projectRoot}/tsconfig.prod.json',
            codeCoverage: true,
          },
        },
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults.test.options).toStrictEqual({
      jestConfig: '{projectRoot}/jest.config.ts',
    });
    expect(nxJson.targetDefaults.test.configurations.production).toStrictEqual({
      codeCoverage: true,
    });
  });

  it('should remove tsConfig option in nx.json target defaults for the jest executor', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults['@nx/jest:jest'] = {
        options: {
          jestConfig: '{projectRoot}/jest.config.ts',
          tsConfig: '{projectRoot}/tsconfig.json',
        },
        configurations: {
          production: {
            tsConfig: '{projectRoot}/tsconfig.prod.json',
            codeCoverage: true,
          },
        },
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults['@nx/jest:jest'].options).toStrictEqual({
      jestConfig: '{projectRoot}/jest.config.ts',
    });
    expect(
      nxJson.targetDefaults['@nx/jest:jest'].configurations.production
    ).toStrictEqual({
      codeCoverage: true,
    });
  });

  it('should remove empty options and configurations objects from project configuration', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            tsConfig: 'apps/app1/tsconfig.json',
          },
          configurations: {
            production: {
              tsConfig: 'apps/app1/tsconfig.prod.json',
            },
          },
        },
      },
    });

    await migration(tree);

    const updatedConfig = readProjectConfiguration(tree, 'app1');
    expect(updatedConfig.targets.test.options).toBeUndefined();
    expect(updatedConfig.targets.test.configurations).toBeUndefined();
  });

  it('should remove empty targetDefault object from nx.json when using a target name as the key', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = {};
      json.targetDefaults.test = {
        executor: '@nx/jest:jest',
        options: {
          tsConfig: '{projectRoot}/tsconfig.json',
        },
        configurations: {
          production: {
            tsConfig: '{projectRoot}/tsconfig.prod.json',
          },
        },
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults).toBeUndefined();
  });

  it('should remove empty targetDefault object from nx.json when using the jest executor as the key', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = {};
      json.targetDefaults['@nx/jest:jest'] = {
        options: {
          tsConfig: '{projectRoot}/tsconfig.json',
        },
        configurations: {
          production: {
            tsConfig: '{projectRoot}/tsconfig.prod.json',
          },
        },
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults).toBeUndefined();
  });
});
