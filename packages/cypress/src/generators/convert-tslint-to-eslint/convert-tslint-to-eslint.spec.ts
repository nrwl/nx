import {
  addProjectConfiguration,
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  Tree,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { exampleRootTslintJson } from '@nrwl/linter';
import { conversionGenerator } from './convert-tslint-to-eslint';

/**
 * Don't run actual child_process implementation of installPackagesTask()
 */
jest.mock('child_process');

const projectName = 'e2e-app-1';
const projectRoot = `apps/${projectName}`;
const projectTSLintJsonPath = joinPathFragments(projectRoot, 'tslint.json');
// Used to configure the test Tree and stub the response from tslint-to-eslint-config util findReportedConfiguration()
const projectTslintJsonData = {
  raw: {
    extends: '../../tslint.json',
    rules: {
      // User custom TS rule
      'no-empty-interface': true,
      // User custom rule with no known automated converter
      'some-super-custom-rule-with-no-converter': true,
    },
    linterOptions: {
      exclude: ['!**/*'],
    },
  },
  tslintPrintConfigResult: {
    rules: {
      'no-empty-interface': {
        ruleArguments: [],
        ruleSeverity: 'error',
      },
      'some-super-custom-rule-with-no-converter': {
        ruleArguments: [],
        ruleSeverity: 'error',
      },
    },
  },
};

function mockFindReportedConfiguration(_, pathToTslintJson) {
  switch (pathToTslintJson) {
    case 'tslint.json':
      return exampleRootTslintJson.tslintPrintConfigResult;
    case projectTSLintJsonPath:
      return projectTslintJsonData.tslintPrintConfigResult;
    default:
      throw new Error(
        `mockFindReportedConfiguration - Did not recognize path ${pathToTslintJson}`
      );
  }
}

/**
 * See ./mock-tslint-to-eslint-config.ts for why this is needed
 */
jest.mock('tslint-to-eslint-config', () => {
  return {
    // Since upgrading to (ts-)jest 26 this usage of this mock has caused issues...
    // @ts-ignore
    ...jest.requireActual<any>('tslint-to-eslint-config'),
    findReportedConfiguration: jest.fn(mockFindReportedConfiguration),
  };
});

/**
 * Mock the the mutating fs utilities used within the conversion logic, they are not
 * needed because of our stubbed response for findReportedConfiguration() above, and
 * they would cause noise in the git data of the actual Nx repo when the tests run.
 */
jest.mock('fs', () => {
  return {
    // Since upgrading to (ts-)jest 26 this usage of this mock has caused issues...
    // @ts-ignore
    ...jest.requireActual<any>('fs'),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
  };
});

describe('convert-tslint-to-eslint', () => {
  let host: Tree;

  beforeEach(async () => {
    host = createTreeWithEmptyWorkspace();

    writeJson(host, 'tslint.json', exampleRootTslintJson.raw);

    addProjectConfiguration(host, projectName, {
      root: projectRoot,
      projectType: 'application',
      targets: {
        /**
         * LINT TARGET CONFIG - BEFORE CONVERSION
         *
         * TSLint executor configured for the project
         */
        lint: {
          executor: '@angular-devkit/build-angular:tslint',
          options: {
            exclude: ['**/node_modules/**', '!apps/e2e-app-1/**/*'],
            tsConfig: ['apps/e2e-app-1/tsconfig.app.json'],
          },
        },
      },
    });

    /**
     * Existing tslint.json file for the project
     */
    writeJson(host, 'apps/e2e-app-1/tslint.json', projectTslintJsonData.raw);
  });

  it('should work for Cypress applications', async () => {
    await conversionGenerator(host, {
      project: projectName,
      ignoreExistingTslintConfig: false,
      removeTSLintIfNoMoreTSLintTargets: false,
    });

    /**
     * It should ensure the required Nx packages are installed and available
     *
     * NOTE: tslint-to-eslint-config should NOT be present
     */
    expect(readJson(host, 'package.json')).toMatchSnapshot();

    /**
     * LINT TARGET CONFIG - AFTER CONVERSION
     *
     * It should replace the TSLint executor with the ESLint one
     */
    expect(readProjectConfiguration(host, projectName)).toMatchSnapshot();

    /**
     * The root level .eslintrc.json should now have been generated
     */
    expect(readJson(host, '.eslintrc.json')).toMatchSnapshot();

    /**
     * The project level .eslintrc.json should now have been generated
     * and extend from the root, as well as applying any customizations
     * which are specific to this projectType.
     */
    expect(
      readJson(host, joinPathFragments(projectRoot, '.eslintrc.json'))
    ).toMatchSnapshot();

    /**
     * The project's TSLint file should have been deleted
     */
    expect(host.exists(projectTSLintJsonPath)).toEqual(false);
  });
});
