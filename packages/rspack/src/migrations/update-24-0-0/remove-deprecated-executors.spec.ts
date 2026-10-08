import {
  addProjectConfiguration,
  joinPathFragments,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
  writeJson,
  type ExpandedPluginConfiguration,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
  detectPackageManager,
} from '@nx/devkit';
import {
  mockCjsModule,
  resetCjsMocks,
  TempFs,
} from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { join } from 'node:path';
import { getRelativeProjectJsonSchemaPath } from '@nx/devkit/internal';
import type { RspackPluginOptions } from '../../plugins/plugin';
import { getLockFileName } from '@nx/js';

let fs: TempFs;
let projectGraph: ProjectGraph;
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: vi
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
  updateProjectConfiguration: vi
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
          projectConfiguration['// targets'] =
            `to see all targets run: nx show project ${projectName} --web`;
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
vi.mock('nx/src/devkit-internals', async () => {
  const actual = await vi.importActual<any>('nx/src/devkit-internals');
  const { retrieveProjectConfigurations } = await vi.importActual<any>(
    'nx/src/project-graph/utils/retrieve-workspace-files'
  );
  return {
    ...actual,
    retrieveProjectConfigurations,
  };
});

function addProject(tree: Tree, name: string, project: ProjectConfiguration) {
  addProjectConfiguration(tree, name, project);
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

interface ProjectOptions {
  appName: string;
  appRoot: string;
  buildTargetName: string;
  buildExecutor: string;
  serveTargetName: string;
  serveExecutor: string;
}

const defaultProjectOptions: ProjectOptions = {
  appName: 'app1',
  appRoot: 'apps/app1',
  buildTargetName: 'build',
  buildExecutor: '@nx/rspack:rspack',
  serveTargetName: 'serve',
  serveExecutor: '@nx/rspack:dev-server',
};

const defaultRspackConfig = `const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
const { useLegacyNxPlugin } = require('@nx/rspack');

// This file was migrated using @nx/rspack:convert-config-to-rspack-plugin from your './rspack.config.old.js'
// Please check that the options here are correct as they were moved from the old rspack.config.js to this file.
const options = {};

/**
 * @type{import('@rspack/core').RspackOptionsNormalized}
 */
module.exports = async () => ({
  plugins: [
    new NxAppRspackPlugin(options),
    new NxReactRspackPlugin(),
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await useLegacyNxPlugin(require('./rspack.config.old'), options),
  ],
});
`;

function writeRspackConfig(
  tree: Tree,
  projectRoot: string,
  rspackConfig = defaultRspackConfig
) {
  tree.write(`${projectRoot}/rspack.config.js`, rspackConfig);
  fs.createFileSync(`${projectRoot}/rspack.config.js`, rspackConfig);
  // loadConfigFile `require`s the config, which `vi.doMock` cannot reach.
  mockCjsModule(
    import.meta.url,
    join(fs.tempDir, projectRoot, 'rspack.config.js'),
    {}
  );
}

function createProject(
  tree: Tree,
  opts: Partial<ProjectOptions> = {},
  extraTargetOptions?: Record<string, Record<string, unknown>>
) {
  let projectOpts = { ...defaultProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.buildTargetName]: {
        executor: projectOpts.buildExecutor,
        options: {
          rspackConfig: `${projectOpts.appRoot}/rspack.config.js`,
          outputPath: `dist/${projectOpts.appRoot}`,
          index: `${projectOpts.appRoot}/src/index.html`,
          main: `${projectOpts.appRoot}/src/main.tsx`,
          tsConfig: `${projectOpts.appRoot}/tsconfig.app.json`,
          assets: [
            `${projectOpts.appRoot}/src/favicon.ico`,
            `${projectOpts.appRoot}/src/assets`,
          ],
          styles: [`${projectOpts.appRoot}/src/styles.scss`],
          scripts: [],
          ...extraTargetOptions?.[projectOpts.buildTargetName],
        },
        configurations: {
          development: {
            extractLicenses: false,
            optimization: false,
            sourceMap: true,
            vendorChunk: true,
          },
          production: {
            fileReplacements: [
              {
                replace: `${projectOpts.appRoot}/src/environments/environment.ts`,
                with: `${projectOpts.appRoot}/src/environments/environment.prod.ts`,
              },
            ],
            optimization: true,
            outputHashing: 'all',
            sourceMap: false,
            namedChunks: false,
            extractLicenses: true,
            vendorChunk: false,
          },
        },
        defaultConfiguration: 'production',
      },
      [projectOpts.serveTargetName]: {
        executor: projectOpts.serveExecutor,
        options: {
          buildTarget: `${projectOpts.appName}:${projectOpts.buildTargetName}`,
          hmr: true,
          ssl: true,
          sslCert: `${projectOpts.appRoot}/server.crt`,
          sslKey: `${projectOpts.appRoot}/server.key`,
          ...extraTargetOptions?.[projectOpts.serveTargetName],
        },
        configurations: {
          development: {
            buildTarget: `${projectOpts.appName}:${projectOpts.buildTargetName}:development`,
            open: true,
          },
          production: {
            buildTarget: `${projectOpts.appName}:${projectOpts.buildTargetName}:production`,
            hmr: false,
          },
        },
        defaultConfiguration: 'development',
      },
    },
  };
  fs.createFileSync(
    `${projectOpts.appRoot}/proxy.conf.json`,
    `{
      "/api": {
        "target": "http://localhost:3333",
        "secure": false
      }
    }`
  );

  writeRspackConfig(tree, projectOpts.appRoot, `module.exports = {};`);

  addProject(tree, project.name, project);
  fs.createFileSync(
    `${projectOpts.appRoot}/project.json`,
    JSON.stringify(project)
  );
  return project;
}

import * as converter from '../../generators/convert-to-inferred/convert-to-inferred';
import update from './remove-deprecated-executors';

describe('remove-deprecated-executors', () => {
  // The migration loads its converter through `require`, which vi.mock cannot
  // reach, so hand it the module that sees the mocked project graph.
  beforeEach(() => {
    mockCjsModule(
      import.meta.url,
      '../../generators/convert-to-inferred/convert-to-inferred',
      converter
    );
  });
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('rspack');
    tree = createTreeWithEmptyWorkspace();
    tree.root = fs.tempDir;
    const lockFileName = getLockFileName(detectPackageManager(fs.tempDir));
    fs.createFileSync(lockFileName, '');
    tree.write(lockFileName, '');

    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
  });

  afterEach(() => {
    fs.cleanup();
    resetCjsMocks();
    vi.resetModules();
  });

  it('converts targets using the removed executors to the inference plugin', async () => {
    const project = createProject(tree);
    writeRspackConfig(tree, project.root);

    await update(tree);

    expect(
      readNxJson(tree).plugins.find(
        (plugin) =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/rspack/plugin'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "buildTargetName": "build",
          "previewTargetName": "preview",
          "serveStaticTargetName": "serve-static",
          "serveTargetName": "serve",
        },
        "plugin": "@nx/rspack/plugin",
      }
    `);
    expect(readProjectConfiguration(tree, project.name).targets)
      .toMatchInlineSnapshot(`
      {
        "build": {
          "configurations": {
            "development": {},
            "production": {},
          },
          "defaultConfiguration": "production",
        },
        "serve": {
          "configurations": {
            "development": {},
            "production": {},
          },
          "defaultConfiguration": "development",
        },
      }
    `);
  });

  it('skips the prompt when no project uses the removed executors', async () => {
    const nxJson = readNxJson(tree);

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(readNxJson(tree)).toEqual(nxJson);
  });
});
