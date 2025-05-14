import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  updateJson,
  type NxJsonConfiguration,
  type Tree,
} from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration, {
  executors,
} from './remove-tailwind-config-from-ng-packagr-executors';

describe('remove-tailwind-config-from-ng-packagr-executors migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest
      .spyOn(devkit, 'formatFiles')
      .mockImplementation(() => Promise.resolve());
  });

  it.each(executors)(
    'should remove "tailwindConfig" option from target using the "%s" executor',
    async (executor) => {
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        targets: {
          build: {
            executor,
            options: {
              project: 'libs/lib1/ng-package.json',
              tailwindConfig: 'libs/lib1/tailwind.config.js',
            },
            configurations: {
              development: {
                tsConfig: 'libs/lib1/tsconfig.lib.json',
                tailwindConfig: 'libs/lib1/tailwind.config.dev.js',
              },
              production: {
                tsConfig: 'libs/lib1/tsconfig.lib.prod.json',
                tailwindConfig: 'libs/lib1/tailwind.config.prod.js',
              },
            },
          },
        },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'lib1');
      expect(project.targets.build.options.tailwindConfig).toBeUndefined();
      expect(
        project.targets.build.configurations.development.tailwindConfig
      ).toBeUndefined();
      expect(
        project.targets.build.configurations.production.tailwindConfig
      ).toBeUndefined();
    }
  );

  it.each(executors)(
    'should remove empty objects from target using the "%s" executor',
    async (executor) => {
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        targets: {
          build: {
            executor,
            options: {
              tailwindConfig: 'libs/lib1/tailwind.config.js',
            },
            configurations: {
              development: {
                tailwindConfig: 'libs/lib1/tailwind.config.dev.js',
              },
              production: {
                tailwindConfig: 'libs/lib1/tailwind.config.prod.js',
              },
            },
          },
        },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'lib1');
      expect(project.targets.build.options).toBeUndefined();
      expect(project.targets.build.configurations).toBeUndefined();
    }
  );

  it('should not delete "tailwindConfig" from target not using the relevant executors', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      targets: {
        build: {
          executor: '@org/awesome-plugin:executor',
          options: {
            tailwindConfig: 'libs/lib1/tailwind.config.js',
          },
          configurations: {
            development: {
              tailwindConfig: 'libs/lib1/tailwind.config.dev.js',
            },
            production: {
              tailwindConfig: 'libs/lib1/tailwind.config.prod.js',
            },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'lib1');
    expect(project.targets.build.options.tailwindConfig).toBe(
      'libs/lib1/tailwind.config.js'
    );
    expect(
      project.targets.build.configurations.development.tailwindConfig
    ).toBe('libs/lib1/tailwind.config.dev.js');
    expect(project.targets.build.configurations.production.tailwindConfig).toBe(
      'libs/lib1/tailwind.config.prod.js'
    );
  });

  it.each(executors)(
    'should delete "tailwindConfig" option in nx.json target defaults for a target with the "%s" executor',
    async (executor) => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.targetDefaults ??= {};
        json.targetDefaults.build = {
          executor,
          options: {
            project: '{projectRoot}/ng-package.json',
            tailwindConfig: '{projectRoot}/tailwind.config.js',
          },
          configurations: {
            development: {
              tsConfig: '{projectRoot}/tsconfig.lib.json',
              tailwindConfig: '{projectRoot}/tailwind.config.dev.js',
            },
            production: {
              tsConfig: '{projectRoot}/tsconfig.lib.prod.json',
              tailwindConfig: '{projectRoot}/tailwind.config.prod.js',
            },
          },
        };
        return json;
      });

      await migration(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(
        nxJson.targetDefaults.build.options.tailwindConfig
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults.build.configurations.development.tailwindConfig
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults.build.configurations.production.tailwindConfig
      ).toBeUndefined();
    }
  );

  it.each(executors)(
    'should delete empty target defaults for a target with the "%s" executor',
    async (executor) => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.targetDefaults ??= {};
        json.targetDefaults.build = {
          executor,
          options: {
            tailwindConfig: '{projectRoot}/tailwind.config.js',
          },
          configurations: {
            development: {
              tailwindConfig: '{projectRoot}/tailwind.config.dev.js',
            },
            production: {
              tailwindConfig: '{projectRoot}/tailwind.config.prod.js',
            },
          },
        };
        return json;
      });

      await migration(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.targetDefaults.build).toBeUndefined();
    }
  );

  it.each(executors)(
    'should delete "tailwindConfig" option in nx.json target defaults for the "%s" executor',
    async (executor) => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.targetDefaults ??= {};
        json.targetDefaults[executor] = {
          options: {
            project: '{projectRoot}/ng-package.json',
            tailwindConfig: '{projectRoot}/tailwind.config.js',
          },
          configurations: {
            development: {
              tsConfig: '{projectRoot}/tsconfig.lib.json',
              tailwindConfig: '{projectRoot}/tailwind.config.dev.js',
            },
            production: {
              tsConfig: '{projectRoot}/tsconfig.lib.prod.json',
              tailwindConfig: '{projectRoot}/tailwind.config.prod.js',
            },
          },
        };
        return json;
      });

      await migration(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(
        nxJson.targetDefaults[executor].options.tailwindConfig
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults[executor].configurations.development
          .tailwindConfig
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults[executor].configurations.production.tailwindConfig
      ).toBeUndefined();
    }
  );

  it.each(executors)(
    'should delete empty target defaults for a target with the "%s" executor',
    async (executor) => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.targetDefaults ??= {};
        json.targetDefaults[executor] = {
          options: {
            tailwindConfig: '{projectRoot}/tailwind.config.js',
          },
          configurations: {
            development: {
              tailwindConfig: '{projectRoot}/tailwind.config.dev.js',
            },
            production: {
              tailwindConfig: '{projectRoot}/tailwind.config.prod.js',
            },
          },
        };
        return json;
      });

      await migration(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      console.log(nxJson.targetDefaults);
      expect(nxJson.targetDefaults[executor]).toBeUndefined();
    }
  );
});
