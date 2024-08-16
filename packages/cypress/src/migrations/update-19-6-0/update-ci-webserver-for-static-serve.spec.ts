import updateCiWebserverForStaticServe from './update-ci-webserver-for-static-serve';
import {
  type Tree,
  type ProjectGraph,
  readNxJson,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('update-ci-webserver-for-static-serve migration', () => {
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

  it('should not error when there are no plugin registrations', async () => {
    const nxJson = readNxJson(tree);
    // ensure there are no plugins
    delete nxJson.plugins;
    updateNxJson(tree, nxJson);
    addProject(tree, tempFs, {
      buildTargetName: 'build',
      ciTargetName: 'e2e-ci',
      appName: 'app',
      noVite: true,
    });

    await expect(updateCiWebserverForStaticServe(tree)).resolves.not.toThrow();
  });

  it('should update to serve-static target for webpack', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      },
      {
        plugin: '@nx/webpack/plugin',
        options: {
          serveStaticTargetName: 'webpack:serve-static',
        },
      },
    ];
    updateNxJson(tree, nxJson);

    addProject(tree, tempFs, {
      buildTargetName: 'build',
      ciTargetName: 'e2e-ci',
      appName: 'app',
      noVite: true,
    });

    // ACT
    await updateCiWebserverForStaticServe(tree);

    // ASSERT
    expect(tree.read('app-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';
      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, {
            cypressDir: 'src',
            bundler: 'vite',
            webServerCommands: {
              default: 'nx run app:serve',
              production: 'nx run app:preview',
            },
            ciWebServerCommand: 'nx run app:webpack:serve-static',
          }),
          baseUrl: 'http://localhost:4200',
        },
      });
      "
    `);
  });

  it('should not update the full command to serve-static target for webpack', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      },
      {
        plugin: '@nx/webpack/plugin',
        options: {
          serveStaticTargetName: 'webpack:serve-static',
        },
      },
    ];
    updateNxJson(tree, nxJson);

    addProject(tree, tempFs, {
      buildTargetName: 'build',
      ciTargetName: 'e2e-ci',
      appName: 'app',
      noVite: true,
    });

    tree.write(
      'app-e2e/cypress.config.ts',
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';
export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'nx run app:serve',
        production: 'nx run app:preview',
      },
      ciWebServerCommand: 'echo "start" && nx run app:serve',
    }),
    baseUrl: 'http://localhost:4200',
  },
});
`
    );

    // ACT
    await updateCiWebserverForStaticServe(tree);

    // ASSERT
    expect(tree.read('app-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';
      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, {
            cypressDir: 'src',
            bundler: 'vite',
            webServerCommands: {
              default: 'nx run app:serve',
              production: 'nx run app:preview',
            },
            ciWebServerCommand: 'echo "start" && nx run app:webpack:serve-static',
          }),
          baseUrl: 'http://localhost:4200',
        },
      });
      "
    `);
  });

  it('should update ciWebServerCommand to preview for vite app', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      },
      {
        plugin: '@nx/vite/plugin',
        options: {
          buildTargetName: 'build',
          previewTargetName: 'preview',
        },
      },
    ];
    updateNxJson(tree, nxJson);

    addProject(tree, tempFs);

    // ACT
    await updateCiWebserverForStaticServe(tree);

    // ASSERT
    expect(tree.read('app-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';
      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, {
            cypressDir: 'src',
            bundler: 'vite',
            webServerCommands: {
              default: 'nx run app:serve',
              production: 'nx run app:preview',
            },
            ciWebServerCommand: 'nx run app:preview',
            ciBaseUrl: 'http://localhost:4300',
          }),
          baseUrl: 'http://localhost:4200',
        },
      });
      "
    `);
  });

  it('should use @nx/vite:preview-server executor target value if it exists when no plugins are found', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
      },
    ];
    updateNxJson(tree, nxJson);

    addProject(tree, tempFs, {
      appName: 'app',
      ciTargetName: 'e2e-ci',
      buildTargetName: 'build',
      usesExecutors: true,
    });

    // ACT
    await updateCiWebserverForStaticServe(tree);

    // ASSERT
    expect(tree.read('app-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';
      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, {
            cypressDir: 'src',
            bundler: 'vite',
            webServerCommands: {
              default: 'nx run app:serve',
              production: 'nx run app:preview',
            },
            ciWebServerCommand: 'nx run app:test-serve-static',
            ciBaseUrl: 'http://localhost:4300',
          }),
          baseUrl: 'http://localhost:4200',
        },
      });
      "
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
    noVite?: boolean;
    usesExecutors?: boolean;
  } = { ciTargetName: 'e2e-ci', buildTargetName: 'build', appName: 'app' }
) {
  const appProjectConfig = {
    name: overrides.appName,
    root: overrides.appName,
    sourceRoot: `${overrides.appName}/src`,
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

  const cypressConfig = `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';
export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'nx run ${overrides.appName}:serve',
        production: 'nx run ${overrides.appName}:preview',
      },
      ${
        !overrides.noCi
          ? `ciWebServerCommand: 'nx run ${overrides.appName}:serve',`
          : ''
      }
    }),
    baseUrl: 'http://localhost:4200',
  },
});
`;

  if (!overrides.noVite) {
    tree.write(`${overrides.appName}/vite.config.ts`, viteConfig);
  } else {
    tree.write(
      `${overrides.appName}/webpack.config.ts`,
      `module.exports = {output: 'dist/foo'}`
    );
  }
  tree.write(
    `${overrides.appName}/project.json`,
    JSON.stringify(appProjectConfig)
  );
  tree.write(`${overrides.appName}-e2e/cypress.config.ts`, cypressConfig);
  tree.write(
    `${overrides.appName}-e2e/project.json`,
    JSON.stringify(e2eProjectConfig)
  );
  if (!overrides.noVite) {
    tempFs.createFile(`${overrides.appName}/vite.config.ts`, viteConfig);
  } else {
    tempFs.createFile(
      `${overrides.appName}/webpack.config.ts`,
      `module.exports = {output: 'dist/foo'}`
    );
  }
  tempFs.createFilesSync({
    [`${overrides.appName}/project.json`]: JSON.stringify(appProjectConfig),
    [`${overrides.appName}-e2e/cypress.config.ts`]: cypressConfig,
    [`${overrides.appName}-e2e/project.json`]: JSON.stringify(e2eProjectConfig),
  });

  projectGraph.nodes[overrides.appName] = {
    name: overrides.appName,
    type: 'app',
    data: {
      projectType: 'application',
      root: overrides.appName,
      targets: {
        ...(overrides.usesExecutors
          ? {
              'test-serve-static': {
                executor: overrides.noVite
                  ? '@nx/web:file-server'
                  : '@nx/vite:preview-server',
                dependsOn: [overrides.buildTargetName],
              },
              [overrides.buildTargetName]: {},
              'serve-static': {
                options: {
                  buildTarget: overrides.buildTargetName,
                },
              },
            }
          : {
              [overrides.buildTargetName]: {},
              'serve-static': {
                options: {
                  buildTarget: overrides.buildTargetName,
                },
              },
            }),
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
