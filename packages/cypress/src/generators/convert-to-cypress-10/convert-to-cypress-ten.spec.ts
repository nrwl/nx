import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { installedCypressVersion } from '../../utils/cypress-version';
import { cypressProjectGenerator } from '../cypress-project/cypress-project';
import {
  createSupportFileImport,
  updateImports,
  updateProjectPaths,
  verifyProjectForUpgrade,
} from './conversion.util';
import { convertCypressProject } from './convert-to-cypress-ten';

jest.mock('../../utils/cypress-version');

describe('convertToCypressTen', () => {
  let tree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    mockedInstalledCypressVersion.mockReturnValue(9);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('convertCypressProject', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'app', {
        root: 'apps/app',
        sourceRoot: 'apps/app/src',
        targets: {
          serve: {
            executor: '@nrwl/web:file-server',
            options: {},
          },
        },
      });
      mockedInstalledCypressVersion.mockReturnValue(9);

      await cypressProjectGenerator(tree, {
        name: 'app-e2e',
        skipFormat: true,
        project: 'app',
      });
    });

    it('should update project w/defaults', async () => {
      expect(tree.exists('apps/app-e2e/cypress.json')).toBeTruthy();

      await convertCypressProject(tree, {
        targets: ['e2e'],
        project: 'app-e2e',
      });

      expect(tree.exists('apps/app-e2e/cypress.config.ts')).toBeTruthy();
      expect(
        tree.read('apps/app-e2e/cypress.config.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.exists('apps/app-e2e/src/e2e/app.cy.ts')).toBeTruthy();
      expect(tree.exists('apps/app-e2e/src/support/e2e.ts')).toBeTruthy();
    });

    it('should update project w/customized config', async () => {
      expect(tree.exists('apps/app-e2e/cypress.json')).toBeTruthy();

      updateJson(tree, 'apps/app-e2e/cypress.json', (json) => {
        json = {
          ...json,
          baseUrl: 'http://localhost:4200',
          supportFile: false,
          pluginsFile: './src/plugins/index.js',
        };

        return json;
      });

      await convertCypressProject(tree, {
        targets: ['e2e'],
        project: 'app-e2e',
      });

      expect(tree.exists('apps/app-e2e/cypress.config.ts')).toBeTruthy();
      expect(
        tree.read('apps/app-e2e/cypress.config.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.exists('apps/app-e2e/src/e2e/app.cy.ts')).toBeTruthy();
      expect(tree.exists('apps/app-e2e/src/support/e2e.ts')).toBeTruthy();
    });

    it('should not update a non e2e project', async () => {
      await convertCypressProject(tree, {
        targets: ['e2e'],
        project: 'app',
      });
      expect(tree.exists('apps/app/cypress.config.ts')).toBeFalsy();
      expect(tree.exists('apps/app/src/e2e/app.cy.ts')).toBeFalsy();
      expect(tree.exists('apps/app/src/support/e2e.ts')).toBeFalsy();
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
      root: 'apps/app-e2e',
      sourceRoot: 'apps/app-e2e/src',
    };
    const filePaths = [
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
      expect(tree.exists('apps/app-e2e/src/fixtures/example.json')).toEqual(
        true
      );
    });
  });

  describe('verifyProjectForUpgrade', () => {
    let projectConfiguration: ProjectConfiguration;

    beforeEach(() => {
      addProjectConfiguration(tree, 'app-e2e', {
        root: 'apps/app-e2e',
        sourceRoot: 'apps/app-e2e/src',
        targets: {
          e2e: {
            executor: '@nrwl/cypress:cypress',
            options: {
              cypressConfig: 'apps/app-e2e/cypress.json',
              devServerTarget: 'app:serve',
            },
          },
        },
      });
      tree.write('apps/app-e2e/cypress.json', '{}');
      projectConfiguration = readProjectConfiguration(tree, 'app-e2e');
    });

    it('should not upgrade if both cypress configs are present', () => {
      tree.write('apps/app-e2e/cypress.config.ts', `blah`);
      const actual = verifyProjectForUpgrade(tree, projectConfiguration, 'e2e');
      expect(actual).toMatchSnapshot();
    });

    it('should not upgrade if not using cypress executor', () => {
      projectConfiguration.targets.e2e.executor = 'not cypress executor';
      const actual = verifyProjectForUpgrade(tree, projectConfiguration, 'e2e');
      expect(actual).toMatchSnapshot();
    });

    it('should not upgrade if < v8 is installed', () => {
      mockedInstalledCypressVersion.mockReturnValue(7);
      tree.delete('apps/app-e2e/cypress.config.ts');

      const actual = verifyProjectForUpgrade(tree, projectConfiguration, 'e2e');

      expect(actual.shouldUpgrade).toEqual(false);
    });

    it('should allow upgrade', () => {
      tree.delete('apps/app-e2e/cypress.config.ts');

      const actual = verifyProjectForUpgrade(tree, projectConfiguration, 'e2e');

      expect(actual).toMatchSnapshot();
    });
  });

  describe('updateImports', () => {
    const filePath = 'apps/app-e2e/src/e2e/sometest.cy.ts';
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
    const newImport = 'apps/app-e2e/src/support/e2e.ts';

    it('should update imports w/defaults', () => {
      const oldImport = 'apps/app-e2e/src/support/index.ts';

      const actual = createSupportFileImport(
        oldImport,
        newImport,
        'apps/app-e2e/src'
      );
      expect(actual).toEqual({
        oldImportPathLeaf: 'support',
        newImportPathLeaf: 'support/e2e',
      });
    });

    it('should handle custom support file location', () => {
      const oldImport = 'apps/app-e2e/src/support/blah.ts';

      const actual = createSupportFileImport(
        oldImport,
        newImport,
        'apps/app-e2e/src'
      );
      expect(actual).toEqual({
        oldImportPathLeaf: 'support/blah',
        newImportPathLeaf: 'support/e2e',
      });
    });

    it('should handle nested custom support location', () => {
      const oldImport = 'apps/app-e2e/src/support/blah/abc.ts';

      const actual = createSupportFileImport(
        oldImport,
        newImport,
        'apps/app-e2e/src'
      );
      expect(actual).toEqual({
        oldImportPathLeaf: 'support/blah/abc',
        newImportPathLeaf: 'support/e2e',
      });
    });

    it('should handle nested custom support location w/index.ts', () => {
      const oldImport = 'apps/app-e2e/src/support/something/neat/index.ts';

      const actual = createSupportFileImport(
        oldImport,
        newImport,
        'apps/app-e2e/src'
      );
      expect(actual).toEqual({
        oldImportPathLeaf: 'support/something/neat',
        newImportPathLeaf: 'support/e2e',
      });
    });
  });
});
