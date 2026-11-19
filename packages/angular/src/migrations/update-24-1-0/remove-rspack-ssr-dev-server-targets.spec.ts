import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  writeJson,
  type ProjectGraph,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './remove-rspack-ssr-dev-server-targets';

let projectGraph: ProjectGraph | Error;
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: async () => {
    if (projectGraph instanceof Error) {
      throw projectGraph;
    }
    return projectGraph;
  },
}));

const ssrDevServer = '@angular-devkit/build-angular:ssr-dev-server';
const generatedServeSsr: TargetConfiguration = {
  continuous: true,
  readyWhen: { signal: true },
  executor: ssrDevServer,
  defaultConfiguration: 'development',
  configurations: {
    development: {
      browserTarget: 'app1:build:development',
      serverTarget: 'app1:server:development',
    },
    production: {
      browserTarget: 'app1:build:production',
      serverTarget: 'app1:server:production',
    },
  },
};
const serveTarget: TargetConfiguration = { options: { port: 4200 } };
const serverTarget: TargetConfiguration = {
  executor: '@angular-devkit/build-angular:server',
};
// Same shape as `generatedServeSsr`, plus a configuration whose server exists
const serveSsrWithExternalConfiguration: TargetConfiguration = {
  ...generatedServeSsr,
  configurations: {
    ...generatedServeSsr.configurations,
    external: { browserTarget: 'app2:build', serverTarget: 'app2:server' },
  },
};

describe('remove-rspack-ssr-dev-server-targets migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  // `graphTargets` are app1's targets as the project graph merges them, for
  // targets that come from targetDefaults or a plugin. Defaults to `targets`.
  function arrange({
    targets,
    graphTargets = targets,
    rspack = true,
  }: {
    targets: Record<string, TargetConfiguration>;
    graphTargets?: Record<string, TargetConfiguration>;
    rspack?: boolean;
  }) {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
      targets,
    });
    if (rspack) {
      tree.write('apps/app1/rspack.config.ts', '');
    }
    const app2Targets = {
      build: { executor: '@angular-devkit/build-angular:browser' },
      server: serverTarget,
    };
    addProjectConfiguration(tree, 'app2', {
      root: 'apps/app2',
      projectType: 'application',
      targets: app2Targets,
    });
    projectGraph = {
      nodes: {
        app1: {
          name: 'app1',
          type: 'app',
          data: { root: 'apps/app1', targets: graphTargets },
        },
        app2: {
          name: 'app2',
          type: 'app',
          data: { root: 'apps/app2', targets: app2Targets },
        },
      },
      dependencies: {},
    };
  }

  it.each<
    [
      string,
      {
        targets: Record<string, TargetConfiguration>;
        graphTargets?: Record<string, TargetConfiguration>;
        expected: Record<string, TargetConfiguration>;
      },
    ]
  >([
    [
      'the generated serve-ssr target',
      {
        targets: { 'serve-ssr': generatedServeSsr, serve: serveTarget },
        expected: { serve: serveTarget },
      },
    ],
    [
      'a target with another name',
      {
        targets: { ssr: generatedServeSsr, serve: serveTarget },
        expected: { serve: serveTarget },
      },
    ],
    [
      'a target that sets serverTarget in its options',
      {
        targets: {
          'serve-ssr': {
            executor: ssrDevServer,
            options: {
              browserTarget: 'app1:build',
              serverTarget: 'app1:server',
            },
          },
          serve: serveTarget,
        },
        expected: { serve: serveTarget },
      },
    ],
    [
      'a target whose builder comes from targetDefaults',
      {
        targets: {
          'serve-ssr': { configurations: generatedServeSsr.configurations },
          serve: serveTarget,
        },
        graphTargets: { 'serve-ssr': generatedServeSsr, serve: serveTarget },
        expected: { serve: serveTarget },
      },
    ],
  ])('should remove %s', async (_, { targets, graphTargets, expected }) => {
    arrange({ targets, graphTargets });

    await update(tree);

    expect(readProjectConfiguration(tree, 'app1').targets).toEqual(expected);
  });

  it.each<
    [
      string,
      {
        targets: Record<string, TargetConfiguration>;
        graphTargets?: Record<string, TargetConfiguration>;
        rspack?: boolean;
      },
    ]
  >([
    [
      'a serve-ssr target that uses another builder',
      {
        targets: {
          'serve-ssr': {
            ...generatedServeSsr,
            executor: '@nx/angular:module-federation-dev-ssr',
          },
        },
      },
    ],
    [
      'a target whose server target exists',
      { targets: { 'serve-ssr': generatedServeSsr, server: serverTarget } },
    ],
    [
      'a target with one configuration whose server target exists',
      { targets: { 'serve-ssr': serveSsrWithExternalConfiguration } },
    ],
    [
      'a target that sets no serverTarget',
      {
        targets: {
          'serve-ssr': {
            executor: ssrDevServer,
            options: { browserTarget: 'app1:build' },
          },
        },
      },
    ],
    [
      'a target that targetDefaults gives a configuration whose server target exists',
      {
        targets: { 'serve-ssr': generatedServeSsr },
        graphTargets: {
          'serve-ssr': {
            ...serveSsrWithExternalConfiguration,
            defaultConfiguration: 'external',
          },
        },
      },
    ],
    [
      'a target whose server target a plugin infers',
      {
        targets: { 'serve-ssr': generatedServeSsr },
        graphTargets: { 'serve-ssr': generatedServeSsr, server: serverTarget },
      },
    ],
    [
      'a target in a project without an Rspack config',
      { targets: { 'serve-ssr': generatedServeSsr }, rspack: false },
    ],
  ])('should keep %s', async (_, options) => {
    arrange(options);
    const before = readJson(tree, 'apps/app1/project.json');

    const result = await update(tree);

    expect(readJson(tree, 'apps/app1/project.json')).toEqual(before);
    expect(result).toBeUndefined();
  });

  it("should keep a target that the project's package.json also declares", async () => {
    const packageJsonServeSsr: TargetConfiguration = {
      executor: ssrDevServer,
      configurations: {
        pkg: {
          browserTarget: 'app1:build:pkg',
          serverTarget: 'app1:server:pkg',
        },
      },
    };
    arrange({
      targets: { 'serve-ssr': generatedServeSsr },
      graphTargets: {
        'serve-ssr': {
          ...generatedServeSsr,
          configurations: {
            ...packageJsonServeSsr.configurations,
            ...generatedServeSsr.configurations,
          },
        },
      },
    });
    writeJson(tree, 'apps/app1/package.json', {
      name: 'app1',
      nx: { targets: { 'serve-ssr': packageJsonServeSsr } },
    });
    const projectJson = readJson(tree, 'apps/app1/project.json');
    const packageJson = readJson(tree, 'apps/app1/package.json');

    const result = await update(tree);

    expect(readJson(tree, 'apps/app1/project.json')).toEqual(projectJson);
    expect(readJson(tree, 'apps/app1/package.json')).toEqual(packageJson);
    expect(result).toBeUndefined();
  });

  it('should name each removed target in one next step', async () => {
    arrange({
      targets: { 'serve-ssr': generatedServeSsr, ssr: generatedServeSsr },
    });

    const result = await update(tree);

    expect(result).toEqual([
      'Removed app1:serve-ssr, app1:ssr. These "@angular-devkit/build-angular:ssr-dev-server" targets pointed at a server target that doesn\'t exist, so they couldn\'t run. Use "nx serve <project>" to serve the application instead.',
    ]);
  });

  it('should change nothing when the project graph cannot be created', async () => {
    arrange({ targets: { 'serve-ssr': generatedServeSsr } });
    projectGraph = new Error('A plugin failed');
    const before = readJson(tree, 'apps/app1/project.json');

    await expect(update(tree)).resolves.toBeUndefined();
    expect(readJson(tree, 'apps/app1/project.json')).toEqual(before);
  });
});
