import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ProjectGraph, type Tree } from '@nx/devkit';
import useServeStaticPreviewForCommand from './use-serve-static-preview-for-command';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

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
  });

  it('should update when it does not use serve-static for non-vite', async () => {
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
          command: 'npx nx run app:serve-static',
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
          command: 'npx nx run app:preview',
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
});

const basePlaywrightConfig = (
  appName: string
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
    command: 'npx nx run ${appName}:serve',
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
  } = {}
) {
  const appProjectConfig = {
    name: 'app',
    root: 'app',
    sourceRoot: `${'app'}/src`,
    projectType: 'application',
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
    tree.write(`app/webpack.config.ts`, ``);
  }

  tree.write(`app/project.json`, JSON.stringify(appProjectConfig));
  tree.write(`app-e2e/playwright.config.ts`, basePlaywrightConfig('app'));
  tree.write(`app-e2e/project.json`, JSON.stringify(e2eProjectConfig));
  if (!overrides.noVite) {
    tempFs.createFile(`app/vite.config.ts`, viteConfig);
  } else {
    tempFs.createFile(`app/webpack.config.ts`, ``);
  }
  tempFs.createFilesSync({
    [`app/project.json`]: JSON.stringify(appProjectConfig),
    [`app-e2e/playwright.config.ts`]: basePlaywrightConfig('app'),
    [`app-e2e/project.json`]: JSON.stringify(e2eProjectConfig),
  });

  projectGraph.nodes['app'] = {
    name: 'app',
    type: 'app',
    data: {
      projectType: 'application',
      root: 'app',
      targets: {},
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
