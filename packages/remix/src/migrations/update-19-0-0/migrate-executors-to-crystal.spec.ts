import { getRelativeProjectJsonSchemaPath } from 'nx/src/generators/utils/project-configuration';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
  updateProjectConfiguration: jest
    .fn()
    .mockImplementation((tree, projectName, projectConfiguration) => {
      function handleEmptyTargets(
        projectName: string,
        projectConfiguration: ProjectConfiguration
      ): void {
        if (
          projectConfiguration.targets &&
          !Object.keys(projectConfiguration.targets).length
        ) {
          // Re-order `targets` to appear after the `// target` comment.
          delete projectConfiguration.targets;
          projectConfiguration[
            '// targets'
          ] = `to see all targets run: nx show project ${projectName} --web`;
          projectConfiguration.targets = {};
        } else {
          delete projectConfiguration['// targets'];
        }
      }

      const projectConfigFile = joinPathFragments(
        projectConfiguration.root,
        'project.json'
      );

      if (!tree.exists(projectConfigFile)) {
        throw new Error(
          `Cannot update Project ${projectName} at ${projectConfiguration.root}. It either doesn't exist yet, or may not use project.json for configuration. Use \`addProjectConfiguration()\` instead if you want to create a new project.`
        );
      }
      handleEmptyTargets(projectName, projectConfiguration);
      writeJson(tree, projectConfigFile, {
        name: projectConfiguration.name ?? projectName,
        $schema: getRelativeProjectJsonSchemaPath(tree, projectConfiguration),
        ...projectConfiguration,
        root: undefined,
      });
      projectGraph.nodes[projectName].data = projectConfiguration;
    }),
}));

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateExecutorsToCrystal from './migrate-executors-to-crystal';
import {
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
  readProjectConfiguration,
  addProjectConfiguration as _addProjectConfiguration,
  readNxJson,
  joinPathFragments,
  writeJson,
  updateNxJson,
  getPackageManagerCommand,
} from '@nx/devkit';

function addProjectConfiguration(
  tree: Tree,
  name: string,
  project: ProjectConfiguration
) {
  _addProjectConfiguration(tree, name, project);
  projectGraph.nodes[name] = {
    name: name,
    type: project.projectType === 'application' ? 'app' : 'lib',
    data: {
      projectType: project.projectType,
      root: project.root,
      targets: project.targets,
    },
  };
}

describe('Remix - Migrate Executors To Crystal', () => {
  beforeEach(() => {
    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
  });

  it('should successfully migrate a project using Remix executors to crystal', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const project = createTestProject(tree);

    // ACT
    await migrateExecutorsToCrystal(tree);

    // ASSERT
    // project.json modifications
    const updatedProject = readProjectConfiguration(tree, project.name);
    const targetKeys = Object.keys(updatedProject.targets);
    ['build', 'start', 'serve', 'dev', 'typecheck'].forEach((key) =>
      expect(targetKeys).not.toContain(key)
    );

    // config file modifications
    const remixConfigFile = tree.read(`myapp/remix.config.js`, 'utf-8');
    expect(
      remixConfigFile.includes(
        `serverBuildPath: \`../dist/myapp/build/index.js\``
      )
    ).toBeTruthy();

    // nx.json modifications
    const nxJsonPlugins = readNxJson(tree).plugins;
    const hasRemixPlugin = nxJsonPlugins.find((plugin) =>
      typeof plugin === 'string'
        ? plugin === '@nx/remix/plugin'
        : plugin.plugin === '@nx/remix/plugin'
    );
    expect(hasRemixPlugin).toBeTruthy();
    if (typeof hasRemixPlugin !== 'string') {
      [
        ['buildTargetName', 'build'],
        ['devTargetName', 'serve'],
        ['startTargetName', 'start'],
        ['typecheckTargetName', 'typecheck'],
      ].forEach(([targetOptionName, targetName]) => {
        expect(hasRemixPlugin.options[targetOptionName]).toEqual(targetName);
      });
    }
  });

  it('should successfully update a commonjs config file to use output path', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const project = createTestProject(tree, { remixConfigType: 'cjs' });

    // ACT
    await migrateExecutorsToCrystal(tree);

    // ASSERT
    // config file modifications
    const remixConfigFile = tree.read(`myapp/remix.config.js`, 'utf-8');
    expect(
      remixConfigFile.includes(
        `serverBuildPath: \`../dist/myapp/build/index.js\``
      )
    ).toBeTruthy();
  });

  it('should setup build and serve target names for plugin to match projects', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const project = createTestProject(tree, {
      buildTargetName: 'bundle',
      serveTargetName: 'open',
    });

    // ACT
    await migrateExecutorsToCrystal(tree);

    // ASSERT
    // project.json modifications
    const updatedProject = readProjectConfiguration(tree, project.name);
    const targetKeys = Object.keys(updatedProject.targets);
    ['bundle', 'start', 'open', 'typecheck'].forEach((key) =>
      expect(targetKeys).not.toContain(key)
    );

    // nx.json modifications
    const nxJsonPlugins = readNxJson(tree).plugins;
    const hasRemixPlugin = nxJsonPlugins.find((plugin) =>
      typeof plugin === 'string'
        ? plugin === '@nx/remix/plugin'
        : plugin.plugin === '@nx/remix/plugin'
    );
    expect(hasRemixPlugin).toBeTruthy();
    if (typeof hasRemixPlugin !== 'string') {
      [
        ['buildTargetName', 'bundle'],
        ['devTargetName', 'open'],
        ['startTargetName', 'start'],
        ['typecheckTargetName', 'typecheck'],
      ].forEach(([targetOptionName, targetName]) => {
        expect(hasRemixPlugin.options[targetOptionName]).toEqual(targetName);
      });
    }
  });

  it('should migrate port for serve to an env var', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const project = createTestProject(tree, {
      port: 4200,
    });

    // ACT
    await migrateExecutorsToCrystal(tree);

    // ASSERT
    // project.json modifications
    const updatedProject = readProjectConfiguration(tree, project.name);
    const targetKeys = Object.keys(updatedProject.targets);
    ['build', 'start', 'typecheck'].forEach((key) =>
      expect(targetKeys).not.toContain(key)
    );
    expect(targetKeys).toContain('serve');
    expect(updatedProject.targets.serve.options).toMatchInlineSnapshot(`
      {
        "env": {
          "PORT": 4200,
        },
      }
    `);
  });

  it('should setup build and serve target names using the most common and not migrate projects that dont use it', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const myappProject = createTestProject(tree, {
      appName: 'myapp',
      appRoot: 'myapp',
      buildTargetName: 'bundle',
      serveTargetName: 'open',
    });
    const dashboardProject = createTestProject(tree, {
      appName: 'dashboard',
      appRoot: 'dashboard',
      buildTargetName: 'bundle',
      serveTargetName: 'open',
    });
    const shopProject = createTestProject(tree, {
      appName: 'shop',
      appRoot: 'shop',
      buildTargetName: 'build',
      serveTargetName: 'serve',
    });

    // ACT
    await migrateExecutorsToCrystal(tree);

    // ASSERT
    let updatedProject = readProjectConfiguration(tree, myappProject.name);
    let targetKeys = Object.keys(updatedProject.targets);
    ['bundle', 'start', 'open', 'typecheck'].forEach((key) =>
      expect(targetKeys).not.toContain(key)
    );

    updatedProject = readProjectConfiguration(tree, dashboardProject.name);
    targetKeys = Object.keys(updatedProject.targets);
    ['bundle', 'start', 'open', 'typecheck'].forEach((key) =>
      expect(targetKeys).not.toContain(key)
    );

    updatedProject = readProjectConfiguration(tree, shopProject.name);
    targetKeys = Object.keys(updatedProject.targets);
    ['build', 'serve'].forEach((key) => expect(targetKeys).toContain(key));

    // nx.json modifications
    const nxJsonPlugins = readNxJson(tree).plugins;
    const hasRemixPlugin = nxJsonPlugins.find((plugin) =>
      typeof plugin === 'string'
        ? plugin === '@nx/remix/plugin'
        : plugin.plugin === '@nx/remix/plugin'
    );
    expect(hasRemixPlugin).toBeTruthy();
    if (typeof hasRemixPlugin !== 'string') {
      [
        ['buildTargetName', 'bundle'],
        ['devTargetName', 'open'],
        ['startTargetName', 'start'],
        ['typecheckTargetName', 'typecheck'],
      ].forEach(([targetOptionName, targetName]) => {
        expect(hasRemixPlugin.options[targetOptionName]).toEqual(targetName);
      });
    }
  });

  it('should setup build and serve target names using the most common and migrate only targets for projects that use it', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const myappProject = createTestProject(tree, {
      appName: 'myapp',
      appRoot: 'myapp',
      buildTargetName: 'bundle',
      serveTargetName: 'open',
    });
    const dashboardProject = createTestProject(tree, {
      appName: 'dashboard',
      appRoot: 'dashboard',
      buildTargetName: 'bundle',
      serveTargetName: 'open',
    });
    const shopProject = createTestProject(tree, {
      appName: 'shop',
      appRoot: 'shop',
      buildTargetName: 'build',
      serveTargetName: 'open',
    });

    // ACT
    await migrateExecutorsToCrystal(tree);

    // ASSERT
    let updatedProject = readProjectConfiguration(tree, myappProject.name);
    let targetKeys = Object.keys(updatedProject.targets);
    ['bundle', 'start', 'open', 'typecheck'].forEach((key) =>
      expect(targetKeys).not.toContain(key)
    );

    updatedProject = readProjectConfiguration(tree, dashboardProject.name);
    targetKeys = Object.keys(updatedProject.targets);
    ['bundle', 'start', 'open', 'typecheck'].forEach((key) =>
      expect(targetKeys).not.toContain(key)
    );

    updatedProject = readProjectConfiguration(tree, shopProject.name);
    targetKeys = Object.keys(updatedProject.targets);
    ['start', 'open', 'typecheck'].forEach((key) =>
      expect(targetKeys).not.toContain(key)
    );
    expect(targetKeys).toContain('build');

    // nx.json modifications
    const nxJsonPlugins = readNxJson(tree).plugins;
    const hasRemixPlugin = nxJsonPlugins.find((plugin) =>
      typeof plugin === 'string'
        ? plugin === '@nx/remix/plugin'
        : plugin.plugin === '@nx/remix/plugin'
    );
    expect(hasRemixPlugin).toBeTruthy();
    if (typeof hasRemixPlugin !== 'string') {
      [
        ['buildTargetName', 'bundle'],
        ['devTargetName', 'open'],
        ['startTargetName', 'start'],
        ['typecheckTargetName', 'typecheck'],
      ].forEach(([targetOptionName, targetName]) => {
        expect(hasRemixPlugin.options[targetOptionName]).toEqual(targetName);
      });
    }
  });

  it.each(['build', '@nx/remix:build'])(
    'should not migrate build target if non migratable property exists in the targetDefaults for %s',
    async (targetDefaultName) => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      const nxJson = readNxJson(tree);
      nxJson.targetDefaults ??= {};
      nxJson.targetDefaults[targetDefaultName] = {
        options: {
          generatePackageJson: true,
        },
      };
      updateNxJson(tree, nxJson);

      const myappProject = createTestProject(tree, {
        appName: 'myapp',
        appRoot: 'myapp',
        buildTargetName: 'build',
        serveTargetName: 'open',
      });
      const dashboardProject = createTestProject(tree, {
        appName: 'dashboard',
        appRoot: 'dashboard',
        buildTargetName: 'build',
        serveTargetName: 'open',
      });

      // ACT
      await migrateExecutorsToCrystal(tree);

      // ASSERT
      let updatedProject = readProjectConfiguration(tree, myappProject.name);
      let targetKeys = Object.keys(updatedProject.targets);
      ['start', 'open', 'typecheck'].forEach((key) =>
        expect(targetKeys).not.toContain(key)
      );
      expect(targetKeys).toContain('build');

      updatedProject = readProjectConfiguration(tree, dashboardProject.name);
      targetKeys = Object.keys(updatedProject.targets);
      ['start', 'open', 'typecheck'].forEach((key) =>
        expect(targetKeys).not.toContain(key)
      );
      expect(targetKeys).toContain('build');

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const hasRemixPlugin = nxJsonPlugins.find((plugin) =>
        typeof plugin === 'string'
          ? plugin === '@nx/remix/plugin'
          : plugin.plugin === '@nx/remix/plugin'
      );
      expect(hasRemixPlugin).toBeTruthy();
      if (typeof hasRemixPlugin !== 'string') {
        [
          ['buildTargetName', 'build'],
          ['devTargetName', 'open'],
          ['startTargetName', 'start'],
          ['typecheckTargetName', 'typecheck'],
        ].forEach(([targetOptionName, targetName]) => {
          expect(hasRemixPlugin.options[targetOptionName]).toEqual(targetName);
        });
      }
    }
  );

  it('should migrate build target if migratable property exists in the targetDefaults for @nx/remix:build', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(tree);
    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['@nx/remix:build'] = {
      options: {
        sourcemap: true,
      },
    };
    updateNxJson(tree, nxJson);

    const myappProject = createTestProject(tree, {
      appName: 'myapp',
      appRoot: 'myapp',
      buildTargetName: 'build',
      serveTargetName: 'open',
    });

    // ACT
    await migrateExecutorsToCrystal(tree);

    // ASSERT
    let updatedProject = readProjectConfiguration(tree, myappProject.name);
    let targetKeys = Object.keys(updatedProject.targets);
    ['start', 'open', 'typecheck'].forEach((key) =>
      expect(targetKeys).not.toContain(key)
    );
    expect(targetKeys).toContain('build');
    expect(updatedProject.targets.build).toMatchInlineSnapshot(`
      {
        "options": {
          "sourcemap": true,
        },
      }
    `);
  });
});

interface CreateRemixTestProjectOptions {
  appName: string;
  appRoot: string;
  buildTargetName: string;
  serveTargetName: string;
  outputPath: string;
  generatePackageJson: boolean;
  serveCommand: string;
  port: number;
  remixConfigType: 'esm' | 'cjs';
  remixConfigServerBuildPath: string | 'unset';
}
const defaultCreateRemixTestProjectOptions: CreateRemixTestProjectOptions = {
  appName: 'myapp',
  appRoot: 'myapp',
  buildTargetName: 'build',
  serveTargetName: 'serve',
  outputPath: 'dist/myapp',
  generatePackageJson: false,
  serveCommand: `${getPackageManagerCommand().exec} remix-serve build/index.js`,
  port: 3000,
  remixConfigType: 'esm',
  remixConfigServerBuildPath: 'unset',
};
function createTestProject(
  tree: Tree,
  opts: Partial<CreateRemixTestProjectOptions> = defaultCreateRemixTestProjectOptions
) {
  let projectOpts = { ...defaultCreateRemixTestProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.buildTargetName]: {
        executor: '@nx/remix:build',
        outputs: ['{options.outputPath}'],
        options: {
          outputPath: projectOpts.outputPath,
        },
      },
      [projectOpts.serveTargetName]: {
        executor: `@nx/remix:serve`,
        options: {
          command: projectOpts.serveCommand,
          manual: true,
          port: projectOpts.port,
        },
      },
      start: {
        dependsOn: ['build'],
        command: `remix-serve build/index.js`,
        options: {
          cwd: projectOpts.appRoot,
        },
      },
      typecheck: {
        command: `tsc --project tsconfig.app.json`,
        options: {
          cwd: projectOpts.appRoot,
        },
      },
    },
  };
  if (projectOpts.remixConfigType === 'esm') {
    tree.write(
      `${projectOpts.appRoot}/remix.config.js`,
      `import {createWatchPaths} from '@nx/remix';
import {dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @type {import('@remix-run/dev').AppConfig}
 */
export default {
    ignoredRouteFiles: ["**/.*"],
    // appDirectory: "app",
    // assetsBuildDirectory: "public/build",
    ${
      projectOpts.remixConfigServerBuildPath === 'unset'
        ? `// serverBuildPath: "build/index.js"`
        : projectOpts.remixConfigServerBuildPath
    },
    // publicPath: "/build/",
    watchPaths: () => createWatchPaths(__dirname),
};`
    );
  } else {
    tree.write(
      `${projectOpts.appRoot}/remix.config.js`,
      `/**
 * @type {import('@remix-run/dev').AppConfig}
 */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  ${
    projectOpts.remixConfigServerBuildPath === 'unset'
      ? `// serverBuildPath: "build/index.js"`
      : projectOpts.remixConfigServerBuildPath
  },
  // publicPath: "/build/",
  watchPaths: () => require("@nx/remix").createWatchPaths(__dirname),
};`
    );
  }

  addProjectConfiguration(tree, project.name, project);
  return project;
}
