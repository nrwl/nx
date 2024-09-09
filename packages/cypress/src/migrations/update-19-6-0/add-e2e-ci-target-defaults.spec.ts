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
        plugin: '@nx/cypress/plugin',
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

  it('should add the targetDefaults with the correct buildTarget when the e2e project depends on itself', async () => {
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

    addSelfDependentProject(tree, tempFs);

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
            "build",
          ],
        },
        "lint": {
          "cache": true,
        },
      }
    `);
  });

  it('should add the targetDefaults with the correct ciTargetNames and buildTargets when there is more than one plugin', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        include: ['app-e2e/**'],
      },
      {
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'cypress:e2e-ci',
        },
        include: ['shop-e2e/**'],
      },
    ];
    updateNxJson(tree, nxJson);

    addProject(tree, tempFs);
    addProject(tree, tempFs, {
      buildTargetName: 'build',
      ciTargetName: 'cypress:e2e-ci',
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
        "cypress:e2e-ci--**/*": {
          "dependsOn": [
            "^build",
          ],
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

  it('should only add the targetDefaults with the correct ciTargetName and buildTargets when there is more than one plugin with only one matching multiple projects', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'e2e-ci',
        },
        include: ['cart-e2e/**'],
      },
      {
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'cypress:e2e-ci',
        },
      },
    ];
    updateNxJson(tree, nxJson);

    addProject(tree, tempFs);
    addProject(tree, tempFs, {
      buildTargetName: 'bundle',
      ciTargetName: 'cypress:e2e-ci',
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
        "cypress:e2e-ci--**/*": {
          "dependsOn": [
            "^build",
            "^bundle",
          ],
        },
        "lint": {
          "cache": true,
        },
      }
    `);
  });

  it('should not add the targetDefaults when the ciWebServerCommand is not present', async () => {
    // ARRANGE
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      {
        plugin: '@nx/cypress/plugin',
        options: {
          targetName: 'e2e',
          ciTargetName: 'cypress:e2e-ci',
        },
      },
    ];
    updateNxJson(tree, nxJson);

    addProject(tree, tempFs, {
      appName: 'app',
      buildTargetName: 'build',
      ciTargetName: 'cypress:e2e-ci',
      noCi: true,
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

  tree.write(`${overrides.appName}/vite.config.ts`, viteConfig);
  tree.write(
    `${overrides.appName}/project.json`,
    JSON.stringify(appProjectConfig)
  );
  tree.write(`${overrides.appName}-e2e/cypress.config.ts`, cypressConfig);
  tree.write(
    `${overrides.appName}-e2e/project.json`,
    JSON.stringify(e2eProjectConfig)
  );
  tempFs.createFilesSync({
    [`${overrides.appName}/vite.config.ts`]: viteConfig,
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

function addSelfDependentProject(tree: Tree, tempFs: TempFs) {
  const appProjectConfig = {
    name: 'app-e2e',
    root: 'app-e2e',
    sourceRoot: `app-e2e/src`,
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
        default: 'nx run app-e2e:serve',
        production: 'nx run app-e2e:preview',
      },
      ciWebServerCommand: 'nx run app-e2e:serve-static',
  }
    }),
    baseUrl: 'http://localhost:4200',
  },
});
`;

  tree.write(`app-e2e/project.json`, JSON.stringify(appProjectConfig));
  tree.write(`app-e2e/cypress.config.ts`, cypressConfig);

  tempFs.createFilesSync({
    [`app-e2e/project.json`]: JSON.stringify(appProjectConfig),
    [`app-e2e/cypress.config.ts`]: cypressConfig,
  });

  projectGraph.nodes['app-e2e'] = {
    name: 'app-e2e',
    type: 'app',
    data: {
      projectType: 'application',
      root: 'app-e2e',
      targets: {
        build: {},
        'serve-static': {
          dependsOn: ['build'],
        },
      },
    },
  };
}
