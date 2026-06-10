import {
  addProjectConfiguration,
  readProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './rename-ssr-experimental-platform';

describe('rename-ssr-experimental-platform migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should rename ssr.experimentalPlatform to ssr.platform in options', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
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

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.options.ssr).toStrictEqual({
      entry: 'src/server.ts',
      platform: 'neutral',
    });
  });

  it('should rename ssr.experimentalPlatform to ssr.platform in configurations', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:application',
          configurations: {
            production: {
              ssr: { entry: 'src/server.ts', experimentalPlatform: 'node' },
            },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.build.configurations.production.ssr).toStrictEqual({
      entry: 'src/server.ts',
      platform: 'node',
    });
  });

  it('should be a no-op when ssr.platform is already used', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:application',
          options: {
            ssr: { entry: 'src/server.ts', platform: 'neutral' },
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

  it('should keep the existing platform value when both keys are set', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:application',
          options: {
            ssr: {
              entry: 'src/server.ts',
              platform: 'neutral',
              experimentalPlatform: 'node',
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

  it('should update multiple projects', async () => {
    for (const name of ['app1', 'app2']) {
      addProjectConfiguration(tree, name, {
        root: `apps/${name}`,
        projectType: 'application',
        targets: {
          build: {
            executor: '@nx/angular:application',
            options: {
              ssr: { entry: 'src/server.ts', experimentalPlatform: 'neutral' },
            },
          },
        },
      });
    }

    await migration(tree);

    for (const name of ['app1', 'app2']) {
      const project = readProjectConfiguration(tree, name);
      expect(project.targets.build.options.ssr).toStrictEqual({
        entry: 'src/server.ts',
        platform: 'neutral',
      });
    }
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

  it('should skip targets that do not use the @nx/angular:application executor', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular/build:application',
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
});
