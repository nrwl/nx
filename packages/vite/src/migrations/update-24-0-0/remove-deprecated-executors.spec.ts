import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration as _addProjectConfiguration,
  type ExpandedPluginConfiguration,
  joinPathFragments,
  type ProjectConfiguration,
  type ProjectGraph,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateNxJson,
  writeJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import {
  mockCjsModule as mockConverterModule,
  TempFs,
} from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';
import type { VitePluginOptions } from '../../plugins/plugin';
import { getRelativeProjectJsonSchemaPath } from '@nx/devkit/internal';

let fs: TempFs;

let projectGraph: ProjectGraph;

let mockedConfigs = {};
const getMockedConfig = (
  opts: { configFile: string; mode: 'development' },
  target: string
) => {
  const relativeConfigFile = opts.configFile.replace(`${fs.tempDir}/`, '');
  return Promise.resolve({
    path: opts.configFile,
    config: mockedConfigs[relativeConfigFile],
    build: mockedConfigs[relativeConfigFile]['build'],
    test: mockedConfigs[relativeConfigFile]['test'],
    dependencies: [],
  });
};

vi.mock('vite', () => ({
  resolveConfig: vi.fn().mockImplementation(getMockedConfig),
}));

vi.mock('../../utils/executor-utils', () => ({
  loadViteDynamicImport: vi.fn().mockImplementation(() => ({
    resolveConfig: vi.fn().mockImplementation(getMockedConfig),
  })),
}));

vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: vi.fn().mockImplementation(async () => {
    return projectGraph;
  }),
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

interface CreateViteTestProjectOptions {
  appName: string;
  appRoot: string;
  buildTargetName: string;
  serveTargetName: string;
  previewTargetName: string;
  outputPath: string;
}

const defaultCreateViteTestProjectOptions: CreateViteTestProjectOptions = {
  appName: 'myapp',
  appRoot: 'myapp',
  buildTargetName: 'build',
  serveTargetName: 'serve',
  previewTargetName: 'preview',
  outputPath: '{workspaceRoot}/dist/myapp',
};

function createTestProject(
  tree: Tree,
  opts: Partial<CreateViteTestProjectOptions> = defaultCreateViteTestProjectOptions
) {
  let projectOpts = { ...defaultCreateViteTestProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.buildTargetName]: {
        executor: '@nx/vite:build',
        outputs: [projectOpts.outputPath],
        options: {
          configFile: `${projectOpts.appRoot}/vite.config.ts`,
        },
      },
      [projectOpts.serveTargetName]: {
        executor: '@nx/vite:dev-server',
        options: {
          buildTarget: `${projectOpts.appName}:${projectOpts.buildTargetName}`,
        },
      },
      [projectOpts.previewTargetName]: {
        executor: '@nx/vite:preview-server',
        options: {
          buildTarget: `${projectOpts.appName}:${projectOpts.buildTargetName}`,
        },
      },
    },
  };

  const viteConfigContents = `/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/myapp',

  server: {
    port: 4200,
    host: 'localhost',
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  plugins: [react(), nxViteTsPaths()],

  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },

  build: {
    outDir: '../../dist/apps/myapp',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/myapp',
      provider: 'v8',
    },
  },
});`;

  tree.write(`${projectOpts.appRoot}/vite.config.ts`, viteConfigContents);
  fs.createFileSync(
    `${projectOpts.appRoot}/vite.config.ts`,
    viteConfigContents
  );
  tree.write(`${projectOpts.appRoot}/index.html`, `<html></html>`);
  fs.createFileSync(`${projectOpts.appRoot}/index.html`, `<html></html>`);

  mockedConfigs[`${projectOpts.appRoot}/vite.config.ts`] = {
    root: `${projectOpts.appRoot}`,
    cacheDir: `../../node_modules/.vite/${projectOpts.appName}`,

    server: {
      port: 4200,
      host: 'localhost',
    },

    preview: {
      port: 4300,
      host: 'localhost',
    },

    build: {
      outDir: `../../dist/${projectOpts.appRoot}`,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },

    test: {
      globals: true,
      cache: {
        dir: '../../node_modules/.vitest',
      },
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

      reporters: ['default'],
      coverage: {
        reportsDirectory: `../../coverage/${projectOpts.appRoot}`,
        provider: 'v8',
      },
    },
  };

  vi.doMock(
    join(fs.tempDir, `${projectOpts.appRoot}/vite.config.ts`),
    () => ({
      default: mockedConfigs[`${projectOpts.appRoot}/vite.config.ts`],
    }),
    {
      virtual: true,
    }
  );

  addProjectConfiguration(tree, project.name, project);
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
    mockConverterModule(
      import.meta.url,
      '../../generators/convert-to-inferred/convert-to-inferred',
      converter
    );
  });
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('vite');
    tree = createTreeWithEmptyWorkspace();
    tree.root = fs.tempDir;
    mockedConfigs = {};

    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
  });

  afterEach(() => {
    fs.reset();
  });

  it('converts targets using the removed executors to the inference plugin', async () => {
    const project = createTestProject(tree);

    await update(tree);

    expect(
      readNxJson(tree).plugins.find(
        (plugin) =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/vite/plugin'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "buildTargetName": "build",
          "devTargetName": "dev",
          "previewTargetName": "preview",
          "serveStaticTargetName": "serve-static",
          "serveTargetName": "serve",
          "typecheckTargetName": "typecheck",
        },
        "plugin": "@nx/vite/plugin",
      }
    `);
    expect(readProjectConfiguration(tree, project.name).targets)
      .toMatchInlineSnapshot(`
      {
        "build": {
          "options": {
            "config": "./vite.config.ts",
          },
        },
      }
    `);
  });

  it('skips the prompt when no project uses the removed executors', async () => {
    const nxJson = readNxJson(tree);

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(readNxJson(tree)).toEqual(nxJson);
  });

  it('converts @nx/vitest:test targets with the @nx/vitest converter', async () => {
    addProjectConfiguration(tree, 'lib', {
      root: 'lib',
      targets: { test: { executor: '@nx/vitest:test' } },
    });
    const convertVitestToInferred = vi.fn();
    mockConverterModule(import.meta.url, '@nx/vitest/internal', {
      convertVitestToInferred,
    });

    await update(tree);

    expect(convertVitestToInferred).toHaveBeenCalledWith(tree, {
      project: 'lib',
      skipFormat: true,
    });
  });
});
