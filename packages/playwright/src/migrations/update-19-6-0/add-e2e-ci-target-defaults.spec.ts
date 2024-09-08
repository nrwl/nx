import { ProjectGraph, readNxJson, type Tree, updateNxJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import addE2eCiTargetDefaults from './add-e2e-ci-target-defaults';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('add-e2e-ci-target-defaults', () => {
  let tree: Tree;
  let tempFs: TempFs;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tempFs = new TempFs('add-e2e-ci');
    tree.root = tempFs.tempDir;
    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
  });

  afterEach(() => {
    tempFs.reset();
  });

  it('should do nothing when the plugin is not registered', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = [];
    updateNxJson(tree, nxJson);

    // ACT
    await addE2eCiTargetDefaults(tree);

    // ASSERT
    expect(readNxJson(tree).targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
          "cache": true,
        },
        "lint": {
          "cache": true,
        },
      }
    `);
  });

  it('should add the targetDefaults with the correct ciTargetName and buildTarget when there is one plugin', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/playwright/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      },
    ];
    updateNxJson(tree, nxJson);

    addProject(tree, tempFs);

    // ACT
    await addE2eCiTargetDefaults(tree);

    // ASSERT
    expect(readNxJson(tree).targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
          "cache": true,
        },
        "e2e-ci--**/*": {
          "dependsOn": [
            "^build",
          ],
        },
        "lint": {
          "cache": true,
        },
      }
    `);
  });

  it.each`
    webServerCommand
    ${`'npx nx run app:serve-static'`}
    ${`"npx nx run app:serve-static"`}
    ${`'npx nx serve-static app'`}
    ${`"npx nx serve-static app"`}
  `(
    'should handle the webServerCommand $webServerCommand',
    async ({ webServerCommand }) => {
      const nxJson = readNxJson(tree);
      nxJson.plugins = [
        {
          plugin: '@nx/playwright/plugin',
          options: { targetName: 'e2e', ciTargetName: 'e2e-ci' },
        },
      ];
      updateNxJson(tree, nxJson);
      addProject(tree, tempFs);
      tree.write(
        `app-e2e/playwright.config.ts`,
        `import { defineConfig, devices } from '@playwright/test';
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
    command: ${webServerCommand},
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});`
      );

      await addE2eCiTargetDefaults(tree);

      expect(readNxJson(tree).targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
          "cache": true,
        },
        "e2e-ci--**/*": {
          "dependsOn": [
            "^build",
          ],
        },
        "lint": {
          "cache": true,
        },
      }
    `);
    }
  );

  it('should add the targetDefaults with the correct ciTargetNames and buildTargets when there is more than one plugin', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/playwright/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        include: ['app-e2e/**'],
      },
      {
        plugin: '@nx/playwright/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'playwright:e2e-ci',
        },
        include: ['shop-e2e/**'],
      },
    ];
    updateNxJson(tree, nxJson);

    addProject(tree, tempFs);
    addProject(tree, tempFs, {
      buildTargetName: 'build',
      ciTargetName: 'playwright:e2e-ci',
      appName: 'shop',
    });

    // ACT
    await addE2eCiTargetDefaults(tree);

    // ASSERT
    expect(readNxJson(tree).targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
          "cache": true,
        },
        "e2e-ci--**/*": {
          "dependsOn": [
            "^build",
          ],
        },
        "lint": {
          "cache": true,
        },
        "playwright:e2e-ci--**/*": {
          "dependsOn": [
            "^build",
          ],
        },
      }
    `);
  });

  it('should only add the targetDefaults with the correct ciTargetName and buildTargets when there is more than one plugin with only one matching multiple projects', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/playwright/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        include: ['cart-e2e/**'],
      },
      {
        plugin: '@nx/playwright/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'playwright:e2e-ci',
        },
      },
    ];
    updateNxJson(tree, nxJson);

    addProject(tree, tempFs);
    addProject(tree, tempFs, {
      buildTargetName: 'bundle',
      ciTargetName: 'playwright:e2e-ci',
      appName: 'shop',
    });

    // ACT
    await addE2eCiTargetDefaults(tree);

    // ASSERT
    expect(readNxJson(tree).targetDefaults).toMatchInlineSnapshot(`
      {
        "build": {
          "cache": true,
        },
        "lint": {
          "cache": true,
        },
        "playwright:e2e-ci--**/*": {
          "dependsOn": [
            "^build",
            "^bundle",
          ],
        },
      }
    `);
  });
});

function addProject(
  tree: Tree,
  tempFs: TempFs,
  overrides: {
    ciTargetName: string;
    buildTargetName: string;
    appName: string;
    noCi?: boolean;
  } = { ciTargetName: 'e2e-ci', buildTargetName: 'build', appName: 'app' }
) {
  const appProjectConfig = {
    name: overrides.appName,
    root: overrides.appName,
    sourceRoot: `${overrides.appName}/src`,
    projectType: 'application',
  };
  const viteConfig = `/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/${overrides.appName}',

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
  //  plugins: [ nxViteTsPaths() ],
  // },

  build: {
    outDir: '../../dist/${overrides.appName}',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});`;

  const e2eProjectConfig = {
    name: `${overrides.appName}-e2e`,
    root: `${overrides.appName}-e2e`,
    sourceRoot: `${overrides.appName}-e2e/src`,
    projectType: 'application',
  };

  const playwrightConfig = `import { defineConfig, devices } from '@playwright/test';
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
    command: 'npx nx run ${overrides.appName}:serve-static',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});`;

  tree.write(`${overrides.appName}/vite.config.ts`, viteConfig);
  tree.write(
    `${overrides.appName}/project.json`,
    JSON.stringify(appProjectConfig)
  );
  tree.write(`${overrides.appName}-e2e/playwright.config.ts`, playwrightConfig);
  tree.write(
    `${overrides.appName}-e2e/project.json`,
    JSON.stringify(e2eProjectConfig)
  );
  tempFs.createFilesSync({
    [`${overrides.appName}/vite.config.ts`]: viteConfig,
    [`${overrides.appName}/project.json`]: JSON.stringify(appProjectConfig),
    [`${overrides.appName}-e2e/playwright.config.ts`]: playwrightConfig,
    [`${overrides.appName}-e2e/project.json`]: JSON.stringify(e2eProjectConfig),
  });

  projectGraph.nodes[overrides.appName] = {
    name: overrides.appName,
    type: 'app',
    data: {
      projectType: 'application',
      root: overrides.appName,
      targets: {
        [overrides.buildTargetName]: {},
        'serve-static': {
          dependsOn: [overrides.buildTargetName],
          options: {
            buildTarget: overrides.buildTargetName,
          },
        },
      },
    },
  };

  projectGraph.nodes[`${overrides.appName}-e2e`] = {
    name: `${overrides.appName}-e2e`,
    type: 'app',
    data: {
      projectType: 'application',
      root: `${overrides.appName}-e2e`,
      targets: {
        e2e: {},
        [overrides.ciTargetName]: {},
      },
    },
  };
}
