import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { installedCypressVersion } from '../../utils/cypress-version';
import { configurationGenerator } from '../configuration/configuration';
import {
  createSupportFileImport,
  updateImports,
  updatePluginFile,
  updateProjectPaths,
} from './conversion.util';
import { migrateCypressProject } from './migrate-to-cypress-11';

jest.mock('../../utils/cypress-version');

describe('convertToCypressTen', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    mockedInstalledCypressVersion.mockReturnValue(9);
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('convertCypressProject', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'app', {
        root: 'app',
        sourceRoot: 'app/src',
        targets: {
          serve: {
            executor: '@nx/web:file-server',
            options: {},
          },
        },
      });
      mockedInstalledCypressVersion.mockReturnValue(9);

      addProjectConfiguration(tree, 'app-e2e', {
        projectType: 'application',
        root: 'app-e2e',
        sourceRoot: 'app-e2e/src',
        targets: {},
        implicitDependencies: ['app'],
        tags: [],
      });

      writeJson(tree, 'app-e2e/tsconfig.json', {
        include: ['src/**/*.ts', 'src/**/*.js'],
      });

      await configurationGenerator(tree, {
        skipFormat: true,
        project: 'app-e2e',
        devServerTarget: 'app:serve',
        addPlugin: false,
      });
    });

    it('should update project w/defaults', async () => {
      expect(tree.exists('app-e2e/cypress.json')).toBeTruthy();

      await migrateCypressProject(tree);

      expect(tree.exists('app-e2e/cypress.config.ts')).toBeTruthy();
      expect(tree.read('app-e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
      expect(readJson(tree, 'app-e2e/tsconfig.json').include).toEqual([
        'src/**/*.ts',
        'src/**/*.js',
        'cypress.config.ts',
      ]);
      expect(tree.exists('app-e2e/src/e2e/app.cy.ts')).toBeTruthy();
      expect(tree.exists('app-e2e/src/support/e2e.ts')).toBeTruthy();
    });

    it('should update project w/customized config', async () => {
      expect(tree.exists('app-e2e/cypress.json')).toBeTruthy();

      updateJson(tree, 'app-e2e/cypress.json', (json) => {
        json = {
          ...json,
          baseUrl: 'http://localhost:4200',
          supportFile: false,
          pluginsFile: './src/plugins/index.js',
        };

        return json;
      });

      await migrateCypressProject(tree);

      expect(tree.exists('app-e2e/cypress.config.ts')).toBeTruthy();
      expect(tree.read('app-e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
      expect(readJson(tree, 'app-e2e/tsconfig.json').include).toEqual([
        'src/**/*.ts',
        'src/**/*.js',
        'cypress.config.ts',
      ]);
      expect(tree.exists('app-e2e/src/e2e/app.cy.ts')).toBeTruthy();
      expect(tree.exists('app-e2e/src/support/e2e.ts')).toBeTruthy();
    });

    it('should not update a non e2e project', async () => {
      await migrateCypressProject(tree);
      expect(tree.exists('app/cypress.config.ts')).toBeFalsy();
      expect(tree.exists('app/src/e2e/app.cy.ts')).toBeFalsy();
      expect(tree.exists('app/src/support/e2e.ts')).toBeFalsy();
    });

    it('should handle custom target names', async () => {
      expect(tree.exists('app-e2e/cypress.json')).toBeTruthy();
      const pc = readProjectConfiguration(tree, 'app-e2e');
      pc.targets = {
        'e2e-custom': {
          ...pc.targets['e2e'],
        },
      };
      delete pc.targets['e2e'];
      updateProjectConfiguration(tree, 'app-e2e', pc);

      await migrateCypressProject(tree);

      expect(tree.exists('app-e2e/cypress.config.ts')).toBeTruthy();
      expect(tree.read('app-e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
      expect(readJson(tree, 'app-e2e/tsconfig.json').include).toEqual([
        'src/**/*.ts',
        'src/**/*.js',
        'cypress.config.ts',
      ]);
      expect(tree.exists('app-e2e/src/e2e/app.cy.ts')).toBeTruthy();
      expect(tree.exists('app-e2e/src/support/e2e.ts')).toBeTruthy();
    });

    it('should infer targets with --all flag', async () => {
      expect(tree.exists('app-e2e/cypress.json')).toBeTruthy();
      const pc = readProjectConfiguration(tree, 'app-e2e');
      pc.targets = {
        ...pc.targets,
        'e2e-custom': {
          ...pc.targets['e2e'],
        },
      };

      updateProjectConfiguration(tree, 'app-e2e', pc);

      await migrateCypressProject(tree);

      expect(tree.exists('app-e2e/cypress.config.ts')).toBeTruthy();
      expect(tree.read('app-e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
      expect(readJson(tree, 'app-e2e/tsconfig.json').include).toEqual([
        'src/**/*.ts',
        'src/**/*.js',
        'cypress.config.ts',
      ]);
      expect(tree.exists('app-e2e/src/e2e/app.cy.ts')).toBeTruthy();
      expect(tree.exists('app-e2e/src/support/e2e.ts')).toBeTruthy();
      expect(
        readProjectConfiguration(tree, 'app-e2e').targets
      ).toMatchSnapshot();
    });

    it('should not break when an invalid target is passed in', async () => {
      expect(tree.exists('app-e2e/cypress.json')).toBeTruthy();
      const pc = readProjectConfiguration(tree, 'app-e2e');
      pc.targets = {
        ...pc.targets,
        'e2e-custom': {
          ...pc.targets['e2e'],
        },
      };

      updateProjectConfiguration(tree, 'app-e2e', pc);

      await migrateCypressProject(tree);

      expect(tree.exists('app-e2e/cypress.config.ts')).toBeTruthy();
      expect(tree.read('app-e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
      expect(readJson(tree, 'app-e2e/tsconfig.json').include).toEqual([
        'src/**/*.ts',
        'src/**/*.js',
        'cypress.config.ts',
      ]);
      expect(tree.exists('app-e2e/src/e2e/app.cy.ts')).toBeTruthy();
      expect(tree.exists('app-e2e/src/support/e2e.ts')).toBeTruthy();
      expect(
        readProjectConfiguration(tree, 'app-e2e').targets
      ).toMatchSnapshot();
    });

    it('should handle multiple configurations', async () => {
      expect(tree.exists('app-e2e/cypress.json')).toBeTruthy();
      const pc = readProjectConfiguration(tree, 'app-e2e');
      pc.targets = {
        ...pc.targets,
        e2e: {
          ...pc.targets['e2e'],
          configurations: {
            production: {
              devServerTarget: 'target:serve:production',
            },
            static: {
              baseUrl: 'http://localhost:3000',
            },
          },
        },
      };

      updateProjectConfiguration(tree, 'app-e2e', pc);

      await migrateCypressProject(tree);

      expect(tree.exists('app-e2e/cypress.config.ts')).toBeTruthy();
      expect(tree.read('app-e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
      expect(readJson(tree, 'app-e2e/tsconfig.json').include).toEqual([
        'src/**/*.ts',
        'src/**/*.js',
        'cypress.config.ts',
      ]);
      expect(tree.exists('app-e2e/src/e2e/app.cy.ts')).toBeTruthy();
      expect(tree.exists('app-e2e/src/support/e2e.ts')).toBeTruthy();
      expect(
        readProjectConfiguration(tree, 'app-e2e').targets['e2e']
      ).toMatchSnapshot();
    });

    it('should handle multiple configurations with no default cypressConfig option', async () => {
      expect(tree.exists('app-e2e/cypress.json')).toBeTruthy();
      tree.write(
        'app-e2e/cypress.production.json',
        JSON.stringify({
          fileServerFolder: '.',
          fixturesFolder: './src/fixtures',
          integrationFolder: './src/release-integration',
          modifyObstructiveCode: false,
          pluginsFile: './src/plugins/index',
          supportFile: './src/support/index.ts',
          video: true,
          videosFolder: '../dist/cypress/client-e2e/videos',
          screenshotsFolder: '../dist/cypress/client-e2e/screenshots',
          chromeWebSecurity: false,
        })
      );
      const pc = readProjectConfiguration(tree, 'app-e2e');
      pc.targets = {
        ...pc.targets,
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            baseUrl: 'http://localhost:4200',
          },
          configurations: {
            production: {
              cypressConfig: 'app-e2e/cypress.production.json',
              devServerTarget: 'target:serve:production',
            },
            static: {
              baseUrl: 'http://localhost:3000',
              cypressConfig: 'app-e2e/cypress.json',
            },
          },
        },
      };

      updateProjectConfiguration(tree, 'app-e2e', pc);

      await migrateCypressProject(tree);

      expect(tree.exists('app-e2e/cypress.config.ts')).toBeTruthy();
      expect(tree.read('app-e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
      expect(readJson(tree, 'app-e2e/tsconfig.json').include).toEqual([
        'src/**/*.ts',
        'src/**/*.js',
        'cypress.production.config.ts',
        'cypress.config.ts',
      ]);
      expect(tree.exists('app-e2e/src/e2e/app.cy.ts')).toBeTruthy();
      expect(tree.exists('app-e2e/src/support/e2e.ts')).toBeTruthy();
      expect(
        readProjectConfiguration(tree, 'app-e2e').targets['e2e']
      ).toMatchSnapshot();
    });

    it('should handle sharing the same config across projects', async () => {
      mockedInstalledCypressVersion.mockReturnValue(9);
      addProjectConfiguration(tree, 'app-two', {
        root: 'app-two',
        sourceRoot: 'app-two/src',
        targets: {
          serve: {
            executor: '@nx/web:file-server',
            options: {},
          },
        },
      });

      addProjectConfiguration(tree, 'app-two-e2e', {
        projectType: 'application',
        root: 'app-two-e2e',
        sourceRoot: 'app-two-e2e/src',
        targets: {},
        implicitDependencies: ['app-two'],
        tags: [],
      });

      writeJson(tree, 'app-two-e2e/tsconfig.json', {
        include: ['src/**/*.ts', 'src/**/*.js'],
      });

      await configurationGenerator(tree, {
        skipFormat: true,
        project: 'app-two-e2e',
        devServerTarget: 'app-two:serve',
        addPlugin: false,
      });

      const appOneProjectConfig = readProjectConfiguration(tree, 'app-e2e');
      appOneProjectConfig.targets['e2e'].options.cypressConfig = 'cypress.json';
      updateProjectConfiguration(tree, 'app-e2e', appOneProjectConfig);
      const appTwoProjectConfig = readProjectConfiguration(tree, 'app-two-e2e');
      appTwoProjectConfig.targets['e2e'].options.cypressConfig = 'cypress.json';
      updateProjectConfiguration(tree, 'app-two-e2e', appTwoProjectConfig);

      tree.write(
        'cypress.json',
        JSON.stringify({
          fileServerFolder: '.',
          fixturesFolder: './src/fixtures',
          integrationFolder: './src/integration',
          modifyObstructiveCode: false,
          video: true,
          chromeWebSecurity: false,
        })
      );

      await migrateCypressProject(tree);

      expect(tree.read('cypress.config.ts', 'utf-8')).toMatchSnapshot();
      expect(readJson(tree, 'app-e2e/tsconfig.json').include).toEqual([
        'src/**/*.ts',
        'src/**/*.js',
        '../cypress.config.ts',
      ]);
      expect(tree.exists('app-e2e/src/e2e/app.cy.ts')).toBeTruthy();
      expect(tree.exists('app-e2e/src/support/e2e.ts')).toBeTruthy();
      expect(readProjectConfiguration(tree, 'app-e2e').targets['e2e']).toEqual({
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: 'cypress.config.ts',
          devServerTarget: 'app:serve',
          testingType: 'e2e',
        },
      });
      expect(readJson(tree, 'app-two-e2e/tsconfig.json').include).toEqual([
        'src/**/*.ts',
        'src/**/*.js',
        '../cypress.config.ts',
      ]);
      expect(tree.exists('app-two-e2e/src/e2e/app.cy.ts')).toBeTruthy();
      expect(tree.exists('app-two-e2e/src/support/e2e.ts')).toBeTruthy();
      expect(
        readProjectConfiguration(tree, 'app-two-e2e').targets['e2e']
      ).toEqual({
        executor: '@nx/cypress:cypress',
        options: {
          cypressConfig: 'cypress.config.ts',
          devServerTarget: 'app-two:serve',
          testingType: 'e2e',
        },
      });
    });
  });

  describe('updateProjectPaths', () => {
    const cypressConfigs = {
      cypressConfigTs: {
        e2e: {
          integrationFolder: 'src/e2e',
          supportFile: 'src/support/e2e.ts',
        },
      },
      cypressConfigJson: {
        integrationFolder: 'src/integration',
        supportFile: 'src/support/index.ts',
      },
    };

    const projectConfig = {
      root: 'app-e2e',
      sourceRoot: 'app-e2e/src',
    };
    const filePaths = [
      'src/integration/nested/something.spec.ts',
      'src/integration/something.spec.ts',
      'src/integration/another.spec.ts',
      'src/integration/another.spec.js',
      'src/integration/another.spec.tsx',
      'src/integration/another.spec.jsx',
      'src/integration/another.spec.cjs',
      'src/integration/another.spec.mjs',
      'src/integration/blah/another/a.spec.ts',
      'src/integration/blah/c/a.spec.ts',
      'src/support/index.ts',
      'src/plugins/index.ts',
      'src/fixtures/example.json',
    ];

    beforeEach(() => {
      for (const path of filePaths) {
        tree.write(
          joinPathFragments(projectConfig.root, path),
          String.raw`
import { getGreeting } from '../support/app.po';

import { blah } from '../support';
const eh = require('../support')

import { blah } from "../support";
const eh = require("../support")

import { blah } from '../../support';
const eh = require('../../support')

import { blah } from "../../support";
const eh = require("../../support")
`
        );
      }
    });

    it('should rename old support file to e2e.ts', () => {
      const newSupportFile = joinPathFragments(
        projectConfig.root,
        cypressConfigs.cypressConfigTs.e2e.supportFile
      );
      const oldSupportFile = joinPathFragments(
        projectConfig.root,
        cypressConfigs.cypressConfigJson.supportFile
      );
      updateProjectPaths(tree, projectConfig, cypressConfigs);

      expect(tree.exists(newSupportFile)).toEqual(true);
      expect(tree.exists(oldSupportFile)).toEqual(false);
    });

    it('should rename files .spec. to .cy.', () => {
      const specs = tree
        .children(projectConfig.root)
        .filter((path) => path.endsWith('.spec.ts'));

      updateProjectPaths(tree, projectConfig, cypressConfigs);
      const actualSpecs = tree
        .children(projectConfig.root)
        .filter((path) => path.endsWith('.spec.ts'));
      const actualCy = tree
        .children(projectConfig.root)
        .filter((path) => path.endsWith('.cy.ts'));

      expect(actualSpecs.length).toEqual(0);
      expect(actualCy.length).toEqual(specs.length);
    });

    it('should move files to the new integration folder (e2e/)', () => {
      const newIntegrationFolder = joinPathFragments(
        projectConfig.root,
        cypressConfigs.cypressConfigTs.e2e.integrationFolder
      );
      const oldIntegrationFolder = joinPathFragments(
        projectConfig.root,
        cypressConfigs.cypressConfigJson.integrationFolder
      );
      const oldIntegrationFolderContents = tree.children(oldIntegrationFolder);

      updateProjectPaths(tree, projectConfig, cypressConfigs);

      const newIntegrationFolderContents = tree.children(newIntegrationFolder);

      expect(tree.exists(oldIntegrationFolder)).toEqual(false);
      expect(newIntegrationFolderContents.length).toEqual(
        oldIntegrationFolderContents.length
      );
      expect(tree.exists('app-e2e/src/fixtures/example.json')).toEqual(true);
    });

    it('should rename files', () => {
      const newIntegrationFolder = joinPathFragments(
        projectConfig.root,
        cypressConfigs.cypressConfigTs.e2e.integrationFolder
      );
      const oldIntegrationFolder = joinPathFragments(
        projectConfig.root,
        cypressConfigs.cypressConfigJson.integrationFolder
      );
      updateProjectPaths(tree, projectConfig, {
        cypressConfigTs: cypressConfigs.cypressConfigTs,
        cypressConfigJson: cypressConfigs.cypressConfigJson,
      });
      expect(tree.exists(newIntegrationFolder)).toEqual(true);
      expect(tree.exists(oldIntegrationFolder)).toEqual(false);
      expect(
        tree.exists(`${newIntegrationFolder}/nested/something.cy.ts`)
      ).toBe(true);
    });
  });

  describe('updateImports', () => {
    const filePath = 'app-e2e/src/e2e/sometest.cy.ts';
    const fileContents = String.raw`
import { getGreeting } from '../support/app.po';

import { blah } from '../support';
const eh = require('../support')

import { blah } from "../support";
const eh = require("../support")

describe('a', () => {
  beforeEach(() => {
    cy.visit('/')
    blah()
    eh()
  });

  it('should display welcome message', () => {
    // Custom command example, see \`../support/commands.ts\` file
    cy.login('my-email@something.com', 'myPassword');

    // Function helper example, see \`../support/app.po.ts\` file
    getGreeting().contains('Welcome a');
  });
});

`;

    beforeEach(() => {
      tree.write(filePath, fileContents);
    });

    it('should update imports', () => {
      updateImports(tree, filePath, 'support', 'support/e2e');
      const actual = tree.read(filePath, 'utf-8');

      expect(actual).toMatchSnapshot();
    });
  });

  describe('Support File Imports', () => {
    const newImport = 'app-e2e/src/support/e2e.ts';

    it('should update imports w/defaults', () => {
      const oldImport = 'app-e2e/src/support/index.ts';

      const actual = createSupportFileImport(
        oldImport,
        newImport,
        'app-e2e/src'
      );
      expect(actual).toEqual({
        oldImportPathLeaf: 'support',
        newImportPathLeaf: 'support/e2e',
      });
    });

    it('should handle custom support file location', () => {
      const oldImport = 'app-e2e/src/support/blah.ts';

      const actual = createSupportFileImport(
        oldImport,
        newImport,
        'app-e2e/src'
      );
      expect(actual).toEqual({
        oldImportPathLeaf: 'support/blah',
        newImportPathLeaf: 'support/e2e',
      });
    });

    it('should handle nested custom support location', () => {
      const oldImport = 'app-e2e/src/support/blah/abc.ts';

      const actual = createSupportFileImport(
        oldImport,
        newImport,
        'app-e2e/src'
      );
      expect(actual).toEqual({
        oldImportPathLeaf: 'support/blah/abc',
        newImportPathLeaf: 'support/e2e',
      });
    });

    it('should handle nested custom support location w/index.ts', () => {
      const oldImport = 'app-e2e/src/support/something/neat/index.ts';

      const actual = createSupportFileImport(
        oldImport,
        newImport,
        'app-e2e/src'
      );
      expect(actual).toEqual({
        oldImportPathLeaf: 'support/something/neat',
        newImportPathLeaf: 'support/e2e',
      });
    });
  });

  describe(updatePluginFile.name, () => {
    it('should update module.exports for ts files', () => {
      tree.write(
        'app-e2e/src/plugins/index.ts',
        `
function myCoolFunction() {
  console.log('cool') 
}

module.exports = function(on, config) {
  // do stuff
}

module.exports.blah = myCoolFunction;
`
      );
      const actual = updatePluginFile(
        tree,
        { root: 'app-e2e' },
        {
          cypressConfigJson: {},
          cypressConfigTs: { e2e: { pluginsFile: './src/plugins/index.ts' } },
        }
      );

      expect(actual.cypressConfigTs.e2e.pluginsFile).toEqual(
        './src/plugins/index'
      );
      expect(tree.read('app-e2e/src/plugins/index.ts', 'utf-8')).toEqual(`
function myCoolFunction() {
  console.log('cool') 
}

export default function(on, config) {
  // do stuff
}

export const blah = myCoolFunction;
`);
    });
    it('should not update .js file', () => {
      const pluginFileContent = `
function myCoolFunction() {
  console.log('cool') 
}

module.exports = function(on, config) {
  // do stuff
}

module.exports.blah = myCoolFunction;
`;
      tree.write('app-e2e/src/plugins/index.js', pluginFileContent);
      const actual = updatePluginFile(
        tree,
        { root: 'app-e2e' },
        {
          cypressConfigJson: {},
          cypressConfigTs: { e2e: { pluginsFile: './src/plugins/index.js' } },
        }
      );

      expect(actual.cypressConfigTs.e2e.pluginsFile).toEqual(
        './src/plugins/index'
      );
      expect(tree.read('app-e2e/src/plugins/index.js', 'utf-8')).toEqual(
        pluginFileContent
      );
    });

    it('should not update if no file is preset', () => {
      const actual = updatePluginFile(
        tree,
        { root: 'app-e2e' },
        {
          cypressConfigJson: {},
          cypressConfigTs: { e2e: { pluginsFile: false } },
        }
      );

      expect(actual.cypressConfigTs.e2e.pluginsFile).toBeFalsy();
      expect(tree.exists('app-e2e/src/plugins/index.ts')).toBeFalsy();
    });
  });
});
