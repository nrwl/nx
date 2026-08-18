import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './rename-ssr-experimental-platform';

const ssrApplicationExecutors = [
  '@angular/build:application',
  '@angular-devkit/build-angular:application',
  '@nx/angular:application',
];

describe('rename-ssr-experimental-platform migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  test.each(ssrApplicationExecutors)(
    'should rename ssr.experimentalPlatform to ssr.platform in options for the "%s" executor',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
        targets: {
          build: {
            executor,
            options: {
              ssr: { entry: 'src/server.ts', experimentalPlatform: 'neutral' },
            },
          },
        },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.build.options.ssr).toStrictEqual({
        entry: 'src/server.ts',
        platform: 'neutral',
      });
    }
  );

  it('should rename ssr.experimentalPlatform to ssr.platform in configurations', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:application',
          options: {
            ssr: { entry: 'src/server.ts', experimentalPlatform: 'node' },
          },
          configurations: {
            production: {
              ssr: { entry: 'src/server.ts', experimentalPlatform: 'neutral' },
            },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options.ssr).toStrictEqual({
      entry: 'src/server.ts',
      platform: 'node',
    });
    expect(project.targets.build.configurations.production.ssr).toStrictEqual({
      entry: 'src/server.ts',
      platform: 'neutral',
    });
  });

  it('should overwrite an existing ssr.platform with the deprecated value when both are set', async () => {
    // Matches Angular's update-workspace-config: experimentalPlatform wins.
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:application',
          options: {
            ssr: {
              entry: 'src/server.ts',
              platform: 'node',
              experimentalPlatform: 'neutral',
            },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options.ssr).toStrictEqual({
      entry: 'src/server.ts',
      platform: 'neutral',
    });
  });

  it('should be a no-op when ssr.platform is already used', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:application',
          options: { ssr: { entry: 'src/server.ts', platform: 'neutral' } },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options.ssr).toStrictEqual({
      entry: 'src/server.ts',
      platform: 'neutral',
    });
  });

  it('should skip targets when ssr is a boolean', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:application',
          options: { ssr: true },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options.ssr).toBe(true);
  });

  it('should skip non-application projects', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nx/angular:application',
          options: {
            ssr: { entry: 'src/server.ts', experimentalPlatform: 'neutral' },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'lib1');
    expect(project.targets.build.options.ssr).toStrictEqual({
      entry: 'src/server.ts',
      experimentalPlatform: 'neutral',
    });
  });

  it('should skip targets that do not use an application executor', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:ng-packagr-lite',
          options: {
            ssr: { entry: 'src/server.ts', experimentalPlatform: 'neutral' },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options.ssr).toStrictEqual({
      entry: 'src/server.ts',
      experimentalPlatform: 'neutral',
    });
  });

  describe('nx.json targetDefaults', () => {
    it('should rename in a record-shaped targetDefault keyed by executor', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        '@nx/angular:application': {
          options: {
            ssr: { entry: 'src/server.ts', experimentalPlatform: 'neutral' },
          },
        },
      };
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(
        (readNxJson(tree).targetDefaults as any)['@nx/angular:application']
          .options.ssr
      ).toStrictEqual({ entry: 'src/server.ts', platform: 'neutral' });
    });

    it('should rename in a record-shaped targetDefault keyed by target name with an executor', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: {
          executor: '@nx/angular:application',
          options: {
            ssr: { entry: 'src/server.ts', experimentalPlatform: 'neutral' },
          },
        },
      };
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(
        (readNxJson(tree).targetDefaults as any).build.options.ssr
      ).toStrictEqual({ entry: 'src/server.ts', platform: 'neutral' });
    });

    it('should skip a record-shaped targetDefault keyed by target name without an executor', async () => {
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults = {
        build: {
          options: {
            ssr: { entry: 'src/server.ts', experimentalPlatform: 'neutral' },
          },
        },
      };
      updateNxJson(tree, nxJson);

      await migration(tree);

      expect(
        (readNxJson(tree).targetDefaults as any).build.options.ssr
      ).toStrictEqual({
        entry: 'src/server.ts',
        experimentalPlatform: 'neutral',
      });
    });
  });
});
