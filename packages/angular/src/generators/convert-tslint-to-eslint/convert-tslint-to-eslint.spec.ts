import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
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

const appProjectName = 'angular-app-1';
const appProjectRoot = `apps/${appProjectName}`;
const appProjectTSLintJsonPath = joinPathFragments(
  appProjectRoot,
  'tslint.json'
);
const projectPrefix = 'angular-app';
const libProjectName = 'angular-lib-1';
const libProjectRoot = `libs/${libProjectName}`;
const libProjectTSLintJsonPath = joinPathFragments(
  libProjectRoot,
  'tslint.json'
);
// Used to configure the test Tree and stub the response from tslint-to-eslint-config util findReportedConfiguration()
const projectTslintJsonData = {
  raw: {
    extends: '../../tslint.json',
    rules: {
      // Standard Nx/Angular CLI generated rules
      'directive-selector': [true, 'attribute', projectPrefix, 'camelCase'],
      'component-selector': [true, 'element', projectPrefix, 'kebab-case'],
      // User custom TS rule
      'no-empty-interface': true,
      // User custom template/HTML rule
      'template-banana-in-box': true,
      // User custom rule with no known automated converter
      'some-super-custom-rule-with-no-converter': true,
    },
    linterOptions: {
      exclude: ['!**/*'],
    },
  },
  tslintPrintConfigResult: {
    rules: {
      'directive-selector': {
        ruleArguments: ['attribute', projectPrefix, 'camelCase'],
        ruleSeverity: 'error',
      },
      'component-selector': {
        ruleArguments: ['element', projectPrefix, 'kebab-case'],
        ruleSeverity: 'error',
      },
      'no-empty-interface': {
        ruleArguments: [],
        ruleSeverity: 'error',
      },
      'template-banana-in-box': {
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
    case appProjectTSLintJsonPath:
      return {
        /**
         * Add in an example of rule which requires type-checking so we can test
         * that parserOptions.project is appropriately preserved in the final
         * config in this case.
         */
        rules: {
          ...projectTslintJsonData.tslintPrintConfigResult.rules,
          'await-promise': {
            ruleArguments: [],
            ruleSeverity: 'error',
          },
        },
      };
    case libProjectTSLintJsonPath:
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

    addProjectConfiguration(host, appProjectName, {
      root: appProjectRoot,
      prefix: projectPrefix,
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
            exclude: ['**/node_modules/**', '!apps/angular-app-1/**/*'],
            tsConfig: ['apps/angular-app-1/tsconfig.app.json'],
          },
        },
      },
    } as ProjectConfiguration);

    addProjectConfiguration(host, libProjectName, {
      root: libProjectRoot,
      prefix: projectPrefix,
      projectType: 'library',
      targets: {
        /**
         * LINT TARGET CONFIG - BEFORE CONVERSION
         *
         * TSLint executor configured for the project
         */
        lint: {
          executor: '@angular-devkit/build-angular:tslint',
          options: {
            exclude: ['**/node_modules/**', '!libs/angular-lib-1/**/*'],
            tsConfig: ['libs/angular-lib-1/tsconfig.app.json'],
          },
        },
      },
    } as ProjectConfiguration);

    /**
     * Existing tslint.json file for the app project
     */
    writeJson(host, 'apps/angular-app-1/tslint.json', {
      ...projectTslintJsonData.raw,
      rules: {
        ...projectTslintJsonData.raw.rules,
        /**
         * Add in an example of rule which requires type-checking so we can test
         * that parserOptions.project is appropriately preserved in the final
         * config in this case.
         */
        'await-promise': true,
      },
    });
    /**
     * Existing tslint.json file for the lib project
     */
    writeJson(
      host,
      'libs/angular-lib-1/tslint.json',
      projectTslintJsonData.raw
    );
  });

  it('should work for Angular applications', async () => {
    await conversionGenerator(host, {
      project: appProjectName,
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
    expect(readProjectConfiguration(host, appProjectName)).toMatchSnapshot();

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
      readJson(host, joinPathFragments(appProjectRoot, '.eslintrc.json'))
    ).toMatchSnapshot();

    /**
     * The project's TSLint file should have been deleted
     */
    expect(host.exists(appProjectTSLintJsonPath)).toEqual(false);
  });

  it('should work for Angular libraries', async () => {
    await conversionGenerator(host, {
      project: libProjectName,
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
    expect(readProjectConfiguration(host, libProjectName)).toMatchSnapshot();

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
      readJson(host, joinPathFragments(libProjectRoot, '.eslintrc.json'))
    ).toMatchSnapshot();

    /**
     * The project's TSLint file should have been deleted
     */
    expect(host.exists(libProjectTSLintJsonPath)).toEqual(false);
  });

  it('should not override .eslint config if migration in progress', async () => {
    /**
     * First we convert app
     */
    await conversionGenerator(host, {
      project: appProjectName,
      ignoreExistingTslintConfig: false,
      removeTSLintIfNoMoreTSLintTargets: true,
    });

    /**
     * The root level .eslintrc.json should now have been generated
     */
    const eslintContent = readJson(host, '.eslintrc.json');
    expect(eslintContent).toMatchSnapshot();

    /**
     * We will make a change to the eslint config before the next step
     */
    eslintContent.overrides[0].rules[
      '@nrwl/nx/enforce-module-boundaries'
    ][1].enforceBuildableLibDependency = false;
    writeJson(host, '.eslintrc.json', eslintContent);

    /**
     * Convert the lib
     */
    await conversionGenerator(host, {
      project: libProjectName,
      ignoreExistingTslintConfig: false,
      removeTSLintIfNoMoreTSLintTargets: true,
    });

    /**
     * The project level .eslintrc.json should now have been generated
     * and extend from the root, as well as applying any customizations
     * which are specific to this projectType.
     */
    expect(
      readJson(host, joinPathFragments(libProjectRoot, '.eslintrc.json'))
    ).toMatchSnapshot();

    /**
     * The root level .eslintrc.json should not be re-created
     * if it already existed
     */
    expect(readJson(host, '.eslintrc.json')).toMatchSnapshot();

    /**
     * The root TSLint file should have been deleted
     */
    expect(host.exists('tslint.json')).toEqual(false);
  });
});
