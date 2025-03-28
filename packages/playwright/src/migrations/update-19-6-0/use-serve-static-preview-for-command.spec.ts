import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ProjectGraph, readNxJson, type Tree, updateNxJson } from '@nx/devkit';
import useServeStaticPreviewForCommand from './use-serve-static-preview-for-command';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { join } from 'path';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('useServeStaticPreviewForCommand', () => {
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
    jest.resetModules();
  });

  it('should not assume a default if it cannot find a plugin or executor', async () => {
    // ARRANGE
    addProject(tree, tempFs, { noVite: true });

    // ACT
    await useServeStaticPreviewForCommand(tree);

    // ASSERT
    expect(tree.read('app-e2e/playwright.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig, devices } from '@playwright/test';
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
          command: 'npx nx run app:serve',
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
      });
      "
    `);
  });

  it('should use the serveStaticTargetName in the nx.json', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/webpack/plugin',
      options: {
        serveStaticTargetName: 'webpack:serve-static',
      },
    });
    updateNxJson(tree, nxJson);
    addProject(tree, tempFs, { noVite: true });
    mockWebpackConfig({
      output: {
        path: 'dist/foo',
      },
    });

    // ACT
    await useServeStaticPreviewForCommand(tree);

    // ASSERT
    expect(tree.read('app-e2e/playwright.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig, devices } from '@playwright/test';
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
          command: 'npx nx run app:webpack:serve-static',
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
      });
      "
    `);
  });

  it('should update when it does not use preview for vite', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/vite/plugin',
      options: {
        previewTargetName: 'vite:preview',
      },
    });
    updateNxJson(tree, nxJson);
    addProject(tree, tempFs);

    // ACT
    await useServeStaticPreviewForCommand(tree);

    // ASSERT
    expect(tree.read('app-e2e/playwright.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig, devices } from '@playwright/test';
      import { nxE2EPreset } from '@nx/playwright/preset';

      import { workspaceRoot } from '@nx/devkit';

      const baseURL = process.env['BASE_URL'] || 'http://localhost:4300';

      export default defineConfig({
        ...nxE2EPreset(__filename, { testDir: './src' }),
        use: {
          baseURL,
          trace: 'on-first-retry',
        },
        webServer: {
          command: 'npx nx run app:vite:preview',
          url: 'http://localhost:4300',
          reuseExistingServer: !process.env.CI,
          cwd: workspaceRoot,
        },
        projects: [
          {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
          },
        ],
      });
      "
    `);
  });

  it.each`
    webServerCommand                                               | expectedCommand
    ${'echo "start" && npx nx run app:serve'}                      | ${'echo "start" && npx nx run app:webpack:serve-static'}
    ${'echo "start" && npx nx run app:serve:prod'}                 | ${'echo "start" && npx nx run app:webpack:serve-static'}
    ${'echo "start" && npx nx run app:serve --configuration=prod'} | ${'echo "start" && npx nx run app:webpack:serve-static'}
    ${'echo "start" && npx nx run app:serve --port 4200'}          | ${'echo "start" && npx nx run app:webpack:serve-static --port=4200'}
    ${'echo "start" && npx nx run app:serve --port=4200'}          | ${'echo "start" && npx nx run app:webpack:serve-static --port=4200'}
    ${'echo "start" && npx nx serve app'}                          | ${'echo "start" && npx nx run app:webpack:serve-static'}
    ${'echo "start" && npx nx serve app --configuration=prod'}     | ${'echo "start" && npx nx run app:webpack:serve-static'}
    ${'echo "start" && npx nx serve app --port 4200'}              | ${'echo "start" && npx nx run app:webpack:serve-static --port=4200'}
    ${'echo "start" && npx nx serve app --port=4200'}              | ${'echo "start" && npx nx run app:webpack:serve-static --port=4200'}
  `(
    'should replace "$webServerCommand" with "$expectedCommand" when using webpack',
    async ({ webServerCommand, expectedCommand }) => {
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/webpack/plugin',
        options: {
          serveStaticTargetName: 'webpack:serve-static',
        },
      });
      updateNxJson(tree, nxJson);
      addProject(tree, tempFs, { noVite: true, webServerCommand });
      mockWebpackConfig({
        output: {
          path: 'dist/foo',
        },
      });

      await useServeStaticPreviewForCommand(tree);

      expect(tree.read('app-e2e/playwright.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
      "import { defineConfig, devices } from '@playwright/test';
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
          command: '${expectedCommand}',
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
      });
      "
    `);
    }
  );

  it.each`
    webServerCommand                                               | expectedCommand                                              | expectedUrl
    ${'echo "start" && npx nx run app:serve'}                      | ${'echo "start" && npx nx run app:vite:preview'}             | ${'http://localhost:4300'}
    ${'echo "start" && npx nx run app:serve:prod'}                 | ${'echo "start" && npx nx run app:vite:preview'}             | ${'http://localhost:4300'}
    ${'echo "start" && npx nx run app:serve --configuration=prod'} | ${'echo "start" && npx nx run app:vite:preview'}             | ${'http://localhost:4300'}
    ${'echo "start" && npx nx run app:serve --port 4200'}          | ${'echo "start" && npx nx run app:vite:preview --port=4200'} | ${'http://localhost:4200'}
    ${'echo "start" && npx nx run app:serve --port=4200'}          | ${'echo "start" && npx nx run app:vite:preview --port=4200'} | ${'http://localhost:4200'}
    ${'echo "start" && npx nx serve app'}                          | ${'echo "start" && npx nx run app:vite:preview'}             | ${'http://localhost:4300'}
    ${'echo "start" && npx nx serve app --configuration=prod'}     | ${'echo "start" && npx nx run app:vite:preview'}             | ${'http://localhost:4300'}
    ${'echo "start" && npx nx serve app --port 4200'}              | ${'echo "start" && npx nx run app:vite:preview --port=4200'} | ${'http://localhost:4200'}
    ${'echo "start" && npx nx serve app --port=4200'}              | ${'echo "start" && npx nx run app:vite:preview --port=4200'} | ${'http://localhost:4200'}
  `(
    'should replace "$webServerCommand" with "$expectedCommand" when using vite',
    async ({ webServerCommand, expectedCommand, expectedUrl }) => {
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/vite/plugin',
        options: {
          previewTargetName: 'vite:preview',
        },
      });
      updateNxJson(tree, nxJson);
      addProject(tree, tempFs, { webServerCommand });
      mockWebpackConfig({
        output: {
          path: 'dist/foo',
        },
      });

      await useServeStaticPreviewForCommand(tree);

      expect(tree.read('app-e2e/playwright.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
      "import { defineConfig, devices } from '@playwright/test';
      import { nxE2EPreset } from '@nx/playwright/preset';

      import { workspaceRoot } from '@nx/devkit';

      const baseURL = process.env['BASE_URL'] || '${expectedUrl}';

      export default defineConfig({
        ...nxE2EPreset(__filename, { testDir: './src' }),
        use: {
          baseURL,
          trace: 'on-first-retry',
        },
        webServer: {
          command: '${expectedCommand}',
          url: '${expectedUrl}',
          reuseExistingServer: !process.env.CI,
          cwd: workspaceRoot,
        },
        projects: [
          {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
          },
        ],
      });
      "
    `);
    }
  );

  it('should update command to be target name for preview executor', async () => {
    // ARRANGE
    addProject(tree, tempFs, {
      webServerCommand: 'echo "start" && npx nx run app:serve',
      usesExecutors: true,
    });

    // ACT
    await useServeStaticPreviewForCommand(tree);

    // ASSERT
    expect(tree.read('app-e2e/playwright.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig, devices } from '@playwright/test';
      import { nxE2EPreset } from '@nx/playwright/preset';

      import { workspaceRoot } from '@nx/devkit';

      const baseURL = process.env['BASE_URL'] || 'http://localhost:4300';

      export default defineConfig({
        ...nxE2EPreset(__filename, { testDir: './src' }),
        use: {
          baseURL,
          trace: 'on-first-retry',
        },
        webServer: {
          command: 'echo "start" && npx nx run app:test-serve-static',
          url: 'http://localhost:4300',
          reuseExistingServer: !process.env.CI,
          cwd: workspaceRoot,
        },
        projects: [
          {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
          },
        ],
      });
      "
    `);
  });

  function mockWebpackConfig(config: any) {
    jest.mock(join(tempFs.tempDir, 'app/webpack.config.ts'), () => config, {
      virtual: true,
    });
  }
});

const basePlaywrightConfig = (
  appName: string,
  webServerCommand = `npx nx run ${appName}:serve`
) => `import { defineConfig, devices } from '@playwright/test';
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
    command: '${webServerCommand}',
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

const viteConfig = `/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/app',
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
    outDir: '../../dist/app',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});`;

function addProject(
  tree: Tree,
  tempFs: TempFs,
  overrides: {
    noVite?: boolean;
    webServerCommand?: string;
    usesExecutors?: boolean;
  } = {}
) {
  const appProjectConfig = {
    name: 'app',
    root: 'app',
    sourceRoot: `${'app'}/src`,
    projectType: 'application',
    ...(overrides.usesExecutors
      ? {
          targets: {
            'test-serve-static': {
              executor: overrides.noVite
                ? '@nx/web:file-server'
                : '@nx/vite:preview-server',
            },
          },
        }
      : {}),
  };

  const e2eProjectConfig = {
    name: `app-e2e`,
    root: `app-e2e`,
    sourceRoot: `app-e2e/src`,
    projectType: 'application',
  };

  if (!overrides.noVite) {
    tree.write(`app/vite.config.ts`, viteConfig);
  } else {
    tree.write(
      `app/webpack.config.ts`,
      `module.exports = {output: {
        path: 'dist/foo',
      }}`
    );
  }

  tree.write(`app/project.json`, JSON.stringify(appProjectConfig));
  tree.write(
    `app-e2e/playwright.config.ts`,
    basePlaywrightConfig('app', overrides.webServerCommand)
  );
  tree.write(`app-e2e/project.json`, JSON.stringify(e2eProjectConfig));
  if (!overrides.noVite) {
    tempFs.createFileSync(`app/vite.config.ts`, viteConfig);
  } else {
    tempFs.createFileSync(
      `app/webpack.config.ts`,
      `module.exports = {output: {
        path: 'dist/foo',
      }}`
    );
  }
  tempFs.createFilesSync({
    [`app/project.json`]: JSON.stringify(appProjectConfig),
    [`app-e2e/playwright.config.ts`]: basePlaywrightConfig(
      'app',
      overrides.webServerCommand
    ),
    [`app-e2e/project.json`]: JSON.stringify(e2eProjectConfig),
  });

  projectGraph.nodes['app'] = {
    name: 'app',
    type: 'app',
    data: {
      projectType: 'application',
      root: 'app',
      targets: {
        ...(overrides.usesExecutors
          ? {
              'test-serve-static': {
                dependsOn: ['build'],
                executor: overrides.noVite
                  ? '@nx/web:file-server'
                  : '@nx/vite:preview-server',
              },
            }
          : {}),
      },
    },
  };

  projectGraph.nodes[`app-e2e`] = {
    name: `app-e2e`,
    type: 'app',
    data: {
      projectType: 'application',
      root: `app-e2e`,
      targets: {
        e2e: {},
      },
    },
  };
}
