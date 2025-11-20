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
} from './remove-external-options-from-js-executors';

describe('remove-external-options-from-js-executors migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest
      .spyOn(devkit, 'formatFiles')
      .mockImplementation(() => Promise.resolve());
  });

  it.each(executors)(
    'should remove "external" and "externalBuildTargets" options from target using the "%s" executor',
    async (executor) => {
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        targets: {
          build: {
            executor,
            options: {
              main: 'libs/lib1/src/index.ts',
              outputPath: 'dist/libs/lib1',
              tsConfig: 'libs/lib1/tsconfig.lib.json',
              external: ['react', 'react-dom'],
              externalBuildTargets: ['build', 'build-base'],
            },
            configurations: {
              development: {
                tsConfig: 'libs/lib1/tsconfig.lib.json',
                external: 'all',
                externalBuildTargets: ['build'],
              },
              production: {
                tsConfig: 'libs/lib1/tsconfig.lib.prod.json',
                external: 'none',
                externalBuildTargets: ['build', 'build-prod'],
              },
            },
          },
        },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'lib1');
      expect(project.targets.build.options.external).toBeUndefined();
      expect(
        project.targets.build.options.externalBuildTargets
      ).toBeUndefined();
      expect(
        project.targets.build.configurations.development.external
      ).toBeUndefined();
      expect(
        project.targets.build.configurations.development.externalBuildTargets
      ).toBeUndefined();
      expect(
        project.targets.build.configurations.production.external
      ).toBeUndefined();
      expect(
        project.targets.build.configurations.production.externalBuildTargets
      ).toBeUndefined();
    }
  );

  it.each(executors)(
    'should remove empty options object but keep empty configurations from target using the "%s" executor',
    async (executor) => {
      addProjectConfiguration(tree, 'lib1', {
        root: 'libs/lib1',
        targets: {
          build: {
            executor,
            options: {
              external: ['react'],
              externalBuildTargets: ['build'],
            },
            configurations: {
              development: {
                external: 'all',
                externalBuildTargets: ['build'],
              },
              production: {
                external: 'none',
                externalBuildTargets: ['build', 'build-prod'],
              },
            },
          },
        },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'lib1');
      expect(project.targets.build.options).toBeUndefined();
      // we keep them because users might rely on them, e.g. in scripts, CI, etc.
      expect(project.targets.build.configurations).toEqual({
        development: {},
        production: {},
      });
    }
  );

  it('should not delete "external" and "externalBuildTargets" from target not using the relevant executors', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      targets: {
        build: {
          executor: '@org/awesome-plugin:executor',
          options: {
            external: ['react'],
            externalBuildTargets: ['build'],
          },
          configurations: {
            development: {
              external: 'all',
              externalBuildTargets: ['build'],
            },
            production: {
              external: 'none',
              externalBuildTargets: ['build', 'build-prod'],
            },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'lib1');
    expect(project.targets.build.options.external).toEqual(['react']);
    expect(project.targets.build.options.externalBuildTargets).toEqual([
      'build',
    ]);
    expect(project.targets.build.configurations.development.external).toBe(
      'all'
    );
    expect(
      project.targets.build.configurations.development.externalBuildTargets
    ).toEqual(['build']);
    expect(project.targets.build.configurations.production.external).toBe(
      'none'
    );
    expect(
      project.targets.build.configurations.production.externalBuildTargets
    ).toEqual(['build', 'build-prod']);
  });

  it.each(executors)(
    'should delete "external" and "externalBuildTargets" options in nx.json target defaults for a target with the "%s" executor',
    async (executor) => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.targetDefaults ??= {};
        json.targetDefaults.build = {
          executor,
          options: {
            main: '{projectRoot}/src/index.ts',
            outputPath: 'dist/{projectRoot}',
            tsConfig: '{projectRoot}/tsconfig.lib.json',
            external: ['react', 'react-dom'],
            externalBuildTargets: ['build'],
          },
          configurations: {
            development: {
              tsConfig: '{projectRoot}/tsconfig.lib.json',
              external: 'all',
              externalBuildTargets: ['build'],
            },
            production: {
              tsConfig: '{projectRoot}/tsconfig.lib.prod.json',
              external: 'none',
              externalBuildTargets: ['build', 'build-prod'],
            },
          },
        };
        return json;
      });

      await migration(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.targetDefaults.build.options.external).toBeUndefined();
      expect(
        nxJson.targetDefaults.build.options.externalBuildTargets
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults.build.configurations.development.external
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults.build.configurations.development
          .externalBuildTargets
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults.build.configurations.production.external
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults.build.configurations.production
          .externalBuildTargets
      ).toBeUndefined();
    }
  );

  it.each(executors)(
    'should remove empty options but keep empty configurations for a target with the "%s" executor',
    async (executor) => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.targetDefaults ??= {};
        json.targetDefaults.build = {
          executor,
          options: {
            external: ['react'],
            externalBuildTargets: ['build'],
          },
          configurations: {
            development: {
              external: 'all',
              externalBuildTargets: ['build'],
            },
            production: {
              external: 'none',
              externalBuildTargets: ['build', 'build-prod'],
            },
          },
        };
        return json;
      });

      await migration(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.targetDefaults.build.options).toBeUndefined();
      // we keep them because users might rely on them, e.g. in scripts, CI, etc.
      // they might be applying them from target defaults
      expect(nxJson.targetDefaults.build.configurations).toEqual({
        development: {},
        production: {},
      });
    }
  );

  it.each(executors)(
    'should delete "external" and "externalBuildTargets" options in nx.json target defaults for the "%s" executor',
    async (executor) => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.targetDefaults ??= {};
        json.targetDefaults[executor] = {
          options: {
            main: '{projectRoot}/src/index.ts',
            outputPath: 'dist/{projectRoot}',
            tsConfig: '{projectRoot}/tsconfig.lib.json',
            external: ['react', 'react-dom'],
            externalBuildTargets: ['build'],
          },
          configurations: {
            development: {
              tsConfig: '{projectRoot}/tsconfig.lib.json',
              external: 'all',
              externalBuildTargets: ['build'],
            },
            production: {
              tsConfig: '{projectRoot}/tsconfig.lib.prod.json',
              external: 'none',
              externalBuildTargets: ['build', 'build-prod'],
            },
          },
        };
        return json;
      });

      await migration(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.targetDefaults[executor].options.external).toBeUndefined();
      expect(
        nxJson.targetDefaults[executor].options.externalBuildTargets
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults[executor].configurations.development.external
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults[executor].configurations.development
          .externalBuildTargets
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults[executor].configurations.production.external
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults[executor].configurations.production
          .externalBuildTargets
      ).toBeUndefined();
    }
  );

  it.each(executors)(
    'should only delete target defaults for the "%s" executor when nothing remains after migration',
    async (executor) => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.targetDefaults ??= {};
        json.targetDefaults[executor] = {
          options: {
            external: ['react'],
            externalBuildTargets: ['build'],
          },
        };
        return json;
      });

      await migration(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.targetDefaults[executor]).toBeUndefined();
    }
  );
});
