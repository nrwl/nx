import updateCiWebserverForVite from './update-ci-webserver-for-vite';
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

describe('updateCiWebserverForVite', () => {
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

  it('should do nothing if vite is not found for application', async () => {
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
      buildTargetName: 'build',
      ciTargetName: 'e2e-ci',
      appName: 'app',
      noVite: true,
    });

    // ACT
    await updateCiWebserverForVite(tree);

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
            ciWebServerCommand: 'nx run app:serve-static',
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
    await updateCiWebserverForVite(tree);

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
          ? `ciWebServerCommand: 'nx run ${overrides.appName}:serve-static',`
          : ''
      }
    }),
    baseUrl: 'http://localhost:4200',
  },
});
`;

  if (!overrides.noVite) {
    tree.write(`${overrides.appName}/vite.config.ts`, viteConfig);
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
        [overrides.buildTargetName]: {},
        'serve-static': {
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
