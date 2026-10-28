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
  mockCjsModule,
  resetCjsMocks,
  TempFs,
} from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';
import { getRelativeProjectJsonSchemaPath } from '@nx/devkit/internal';

let fs: TempFs;

let projectGraph: ProjectGraph;
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

interface CreatePlaywrightTestProjectOptions {
  appName: string;
  appRoot: string;
  e2eTargetName: string;
  outputPath: string;
}

const defaultCreatePlaywrightTestProjectOptions: CreatePlaywrightTestProjectOptions =
  {
    appName: 'myapp-e2e',
    appRoot: 'myapp-e2e',
    e2eTargetName: 'e2e',
    outputPath: '{workspaceRoot}/dist/.playwright/myapp-e2e',
  };

function createTestProject(
  tree: Tree,
  opts: Partial<CreatePlaywrightTestProjectOptions> = defaultCreatePlaywrightTestProjectOptions
) {
  let projectOpts = { ...defaultCreatePlaywrightTestProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.e2eTargetName]: {
        executor: '@nx/playwright:playwright',
        outputs: [projectOpts.outputPath],
        options: {
          config: `${projectOpts.appRoot}/playwright.config.ts`,
        },
      },
    },
  };

  const playwrightConfigContents = `import { defineConfig, devices } from '@playwright/test';
  import { nxE2EPreset } from '@nx/playwright/preset';
  import { workspaceRoot } from '@nx/devkit';
  
  const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';
  
  export default defineConfig({
    ...nxE2EPreset(__filename, { testDir: './src' }),
    use: {
      baseURL,
      trace: 'on-first-retry',
    },
    webServer: {
      command: 'npx nx serve myapp',
      url: 'http://localhost:4200',
      reuseExistingServer: true,
      cwd: workspaceRoot,
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
  
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
  
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
    ],
  });`;

  tree.write(
    `${projectOpts.appRoot}/playwright.config.ts`,
    playwrightConfigContents
  );
  fs.createFileSync(
    `${projectOpts.appRoot}/playwright.config.ts`,
    playwrightConfigContents
  );
  // loadConfigFile `require`s the config, which `vi.doMock` cannot reach.
  mockCjsModule(
    import.meta.url,
    join(fs.tempDir, `${projectOpts.appRoot}/playwright.config.ts`),
    {
      default: {
        outputDir: '../dist/.playwright/myapp-e2e',
      },
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
    mockCjsModule(
      import.meta.url,
      '../../generators/convert-to-inferred/convert-to-inferred',
      converter
    );
  });
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('playwright');
    tree = createTreeWithEmptyWorkspace();
    tree.root = fs.tempDir;

    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
  });

  afterEach(() => {
    fs.reset();
    resetCjsMocks();
  });

  it('converts targets using the removed executors to the inference plugin', async () => {
    const project = createTestProject(tree);

    await update(tree);

    expect(
      readNxJson(tree).plugins.find(
        (plugin) =>
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/playwright/plugin'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "ciTargetName": "e2e-ci",
          "targetName": "e2e",
        },
        "plugin": "@nx/playwright/plugin",
      }
    `);
    expect(
      readProjectConfiguration(tree, project.name).targets
    ).toMatchInlineSnapshot(`{}`);
  });

  it('skips the prompt when no project uses the removed executors', async () => {
    const nxJson = readNxJson(tree);

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(readNxJson(tree)).toEqual(nxJson);
  });
});
