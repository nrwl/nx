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
import migration from './remove-tsconfig-and-copy-files-options-from-cypress-executor';

describe('remove-tsconfig-and-copy-files-options-from-cypress-executor', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should remove tsConfig and copyFiles from default options', async () => {
    const projectConfig: ProjectConfiguration = {
      root: 'apps/app1-e2e',
      sourceRoot: 'apps/app1-e2e/src',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/cypress.config.ts',
            tsConfig: 'apps/app1-e2e/tsconfig.json',
            copyFiles: '**/*.spec.ts',
            devServerTarget: 'app1:serve',
          },
        },
      },
    };
    addProjectConfiguration(tree, 'app1-e2e', projectConfig);

    await migration(tree);

    const updatedConfig = readProjectConfiguration(tree, 'app1-e2e');
    expect(updatedConfig.targets.e2e.options).toEqual({
      cypressConfig: 'apps/app1-e2e/cypress.config.ts',
      devServerTarget: 'app1:serve',
    });
    expect('tsConfig' in updatedConfig.targets.e2e.options).toEqual(false);
    expect('copyFiles' in updatedConfig.targets.e2e.options).toEqual(false);
  });

  it('should remove tsConfig and copyFiles from configurations', async () => {
    const projectConfig: ProjectConfiguration = {
      root: 'apps/app1-e2e',
      sourceRoot: 'apps/app1-e2e/src',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/cypress.config.ts',
            devServerTarget: 'app1:serve',
          },
          configurations: {
            production: {
              devServerTarget: 'app1:serve:production',
              tsConfig: 'apps/app1-e2e/tsconfig.prod.json',
              copyFiles: '**/*.prod.spec.ts',
            },
          },
        },
      },
    };
    addProjectConfiguration(tree, 'app1-e2e', projectConfig);

    await migration(tree);

    const updatedConfig = readProjectConfiguration(tree, 'app1-e2e');
    expect(updatedConfig.targets.e2e.configurations.production).toEqual({
      devServerTarget: 'app1:serve:production',
    });
    expect(
      'tsConfig' in updatedConfig.targets.e2e.configurations.production
    ).toEqual(false);
    expect(
      'copyFiles' in updatedConfig.targets.e2e.configurations.production
    ).toEqual(false);
  });

  it('should handle projects without the deprecated options', async () => {
    const projectConfig: ProjectConfiguration = {
      root: 'apps/app2-e2e',
      sourceRoot: 'apps/app2-e2e/src',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app2-e2e/cypress.config.ts',
            devServerTarget: 'app2:serve',
          },
        },
      },
    };
    addProjectConfiguration(tree, 'app2-e2e', projectConfig);

    await migration(tree);

    const updatedConfig = readProjectConfiguration(tree, 'app2-e2e');
    expect(updatedConfig.targets.e2e.options).toEqual({
      cypressConfig: 'apps/app2-e2e/cypress.config.ts',
      devServerTarget: 'app2:serve',
    });
  });

  it('should handle projects with multiple targets using cypress executor', async () => {
    const projectConfig: ProjectConfiguration = {
      root: 'apps/app3-e2e',
      sourceRoot: 'apps/app3-e2e/src',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app3-e2e/cypress.config.ts',
            tsConfig: 'apps/app3-e2e/tsconfig.json',
            devServerTarget: 'app3:serve',
          },
        },
        ct: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app3-e2e/cypress.config.ts',
            copyFiles: '**/*.ct.spec.ts',
            devServerTarget: 'app3:serve-ct',
            testingType: 'component',
          },
        },
      },
    };
    addProjectConfiguration(tree, 'app3-e2e', projectConfig);

    await migration(tree);

    const updatedConfig = readProjectConfiguration(tree, 'app3-e2e');
    expect(updatedConfig.targets.e2e.options).toEqual({
      cypressConfig: 'apps/app3-e2e/cypress.config.ts',
      devServerTarget: 'app3:serve',
    });
    expect(updatedConfig.targets.ct.options).toEqual({
      cypressConfig: 'apps/app3-e2e/cypress.config.ts',
      devServerTarget: 'app3:serve-ct',
      testingType: 'component',
    });
  });

  it('should remove tsConfig and copyFiles options in nx.json target defaults for a target with the cypress executor', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults.e2e = {
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: '{projectRoot}/cypress.config.ts',
          tsConfig: '{projectRoot}/tsconfig.json',
          copyFiles: '**/*.spec.ts',
          devServerTarget: '{projectName}:serve',
        },
        configurations: {
          production: {
            devServerTarget: '{projectName}:serve:production',
            tsConfig: '{projectRoot}/tsconfig.prod.json',
            copyFiles: '**/*.prod.spec.ts',
          },
        },
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults.e2e.options).toStrictEqual({
      cypressConfig: '{projectRoot}/cypress.config.ts',
      devServerTarget: '{projectName}:serve',
    });
    expect(nxJson.targetDefaults.e2e.options.tsConfig).toBeUndefined();
    expect(nxJson.targetDefaults.e2e.options.copyFiles).toBeUndefined();
    expect(nxJson.targetDefaults.e2e.configurations.production).toStrictEqual({
      devServerTarget: '{projectName}:serve:production',
    });
    expect(
      nxJson.targetDefaults.e2e.configurations.production.tsConfig
    ).toBeUndefined();
    expect(
      nxJson.targetDefaults.e2e.configurations.production.copyFiles
    ).toBeUndefined();
  });

  it('should remove tsConfig and copyFiles options in nx.json target defaults for the cypress executor', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults ??= {};
      json.targetDefaults['@nx/cypress:cypress'] = {
        options: {
          cypressConfig: '{projectRoot}/cypress.config.ts',
          tsConfig: '{projectRoot}/tsconfig.json',
          copyFiles: '**/*.spec.ts',
          devServerTarget: '{projectName}:serve',
        },
        configurations: {
          production: {
            devServerTarget: '{projectName}:serve:production',
            tsConfig: '{projectRoot}/tsconfig.prod.json',
            copyFiles: '**/*.prod.spec.ts',
          },
        },
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults['@nx/cypress:cypress'].options).toStrictEqual({
      cypressConfig: '{projectRoot}/cypress.config.ts',
      devServerTarget: '{projectName}:serve',
    });
    expect(
      nxJson.targetDefaults['@nx/cypress:cypress'].options.tsConfig
    ).toBeUndefined();
    expect(
      nxJson.targetDefaults['@nx/cypress:cypress'].options.copyFiles
    ).toBeUndefined();
    expect(
      nxJson.targetDefaults['@nx/cypress:cypress'].configurations.production
    ).toStrictEqual({
      devServerTarget: '{projectName}:serve:production',
    });
    expect(
      nxJson.targetDefaults['@nx/cypress:cypress'].configurations.production
        .tsConfig
    ).toBeUndefined();
    expect(
      nxJson.targetDefaults['@nx/cypress:cypress'].configurations.production
        .copyFiles
    ).toBeUndefined();
  });

  it('should remove empty options and configurations objects from project configuration', async () => {
    const projectConfig: ProjectConfiguration = {
      root: 'apps/app4-e2e',
      sourceRoot: 'apps/app4-e2e/src',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            tsConfig: 'apps/app4-e2e/tsconfig.json',
            copyFiles: '**/*.spec.ts',
          },
          configurations: {
            production: {
              tsConfig: 'apps/app4-e2e/tsconfig.prod.json',
              copyFiles: '**/*.prod.spec.ts',
            },
          },
        },
      },
    };
    addProjectConfiguration(tree, 'app4-e2e', projectConfig);

    await migration(tree);

    const updatedConfig = readProjectConfiguration(tree, 'app4-e2e');
    expect(updatedConfig.targets.e2e.options).toBeUndefined();
    expect(updatedConfig.targets.e2e.configurations).toBeUndefined();
  });

  it('should remove empty targetDefault object from nx.json when using a target name as the key', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = {};
      json.targetDefaults.e2e = {
        executor: '@nx/cypress:cypress',
        options: {
          tsConfig: '{projectRoot}/tsconfig.json',
          copyFiles: '**/*.spec.ts',
        },
        configurations: {
          production: {
            tsConfig: '{projectRoot}/tsconfig.prod.json',
            copyFiles: '**/*.prod.spec.ts',
          },
        },
      };
      return json;
    });

    await migration(tree);

    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults).toBeUndefined();
  });

  it('should remove empty targetDefault object from nx.json when using the cypress executor as the key', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = {};
      json.targetDefaults['@nx/cypress:cypress'] = {
        options: {
          tsConfig: '{projectRoot}/tsconfig.json',
          copyFiles: '**/*.spec.ts',
        },
        configurations: {
          production: {
            tsConfig: '{projectRoot}/tsconfig.prod.json',
            copyFiles: '**/*.prod.spec.ts',
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
