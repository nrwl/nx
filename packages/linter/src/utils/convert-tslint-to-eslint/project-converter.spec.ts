import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  readJson,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { ProjectConverter } from './project-converter';

/**
 * Don't run actual child_process implementation of installPackagesTask()
 */
jest.mock('child_process');

describe('ProjectConverter', () => {
  let host: Tree;
  const projectName = 'foo';
  const projectRoot = `apps/${projectName}`;

  beforeEach(async () => {
    // Clean up any previous dry run simulations
    process.argv = process.argv.filter(
      (a) => !['--dry-run', '--dryRun', '-d'].includes(a)
    );
    host = createTreeWithEmptyWorkspace();
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
            exclude: ['**/node_modules/**', `!${projectRoot}/**/*`],
            tsConfig: [`${projectRoot}/tsconfig.app.json`],
          },
        },
      },
      /**
       * PROJECT-LEVEL GENERATOR CONFIG - BEFORE CONVERSION
       *
       * Default set to tslint, using shorthand syntax
       */
      generators: {
        '@nrwl/angular:library': {
          linter: 'tslint',
        },
        '@nrwl/angular:application': {
          e2eTestRunner: 'cypress',
          linter: 'eslint',
          unitTestRunner: 'jest',
        },
      },
    });
  });

  it('should throw if --dry-run is set', () => {
    writeJson(host, 'tslint.json', {});
    writeJson(host, `${projectRoot}/tslint.json`, {});

    process.argv.push('--dry-run');

    expect(
      () =>
        new ProjectConverter({
          host,
          projectName,
          eslintInitializer: () => undefined,
        })
    ).toThrowErrorMatchingSnapshot();
  });

  it('should throw if --dryRun is set', () => {
    writeJson(host, 'tslint.json', {});
    writeJson(host, `${projectRoot}/tslint.json`, {});

    process.argv.push('--dryRun');

    expect(
      () =>
        new ProjectConverter({
          host,
          projectName,
          eslintInitializer: () => undefined,
        })
    ).toThrowErrorMatchingSnapshot();
  });

  it('should throw if -d is set', () => {
    writeJson(host, 'tslint.json', {});
    writeJson(host, `${projectRoot}/tslint.json`, {});

    process.argv.push('-d');

    expect(
      () =>
        new ProjectConverter({
          host,
          projectName,
          eslintInitializer: () => undefined,
        })
    ).toThrowErrorMatchingSnapshot();
  });

  it('should throw if no root tslint.json is found', () => {
    expect(
      () =>
        new ProjectConverter({
          host,
          projectName,
          eslintInitializer: () => undefined,
        })
    ).toThrowErrorMatchingSnapshot();
  });

  it('should throw if no project tslint.json is found', () => {
    writeJson(host, 'tslint.json', {});

    expect(
      () =>
        new ProjectConverter({
          host,
          projectName,
          eslintInitializer: () => undefined,
        })
    ).toThrowErrorMatchingSnapshot();
  });

  it('should not throw when not in dry-run and config files successfully found', () => {
    writeJson(host, 'tslint.json', {});
    writeJson(host, `${projectRoot}/tslint.json`, {});

    expect(
      () =>
        new ProjectConverter({
          host,
          projectName,
          eslintInitializer: () => undefined,
        })
    ).not.toThrow();
  });

  describe('setDefaults()', () => {
    it('should set the default configuration for removeTSLintIfNoMoreTSLintTargets in workspace.json', async () => {
      writeJson(host, 'tslint.json', {});
      writeJson(host, `${projectRoot}/tslint.json`, {});

      const projectConverter = new ProjectConverter({
        host,
        projectName,
        eslintInitializer: () => undefined,
      });

      const workspace = readWorkspaceConfiguration(host);
      workspace.generators = {
        '@nrwl/angular': {
          application: {
            linter: 'tslint',
          },
          library: {
            linter: 'tslint',
          },
        },
      };
      updateWorkspaceConfiguration(host, workspace);

      // BEFORE - no entry for convert-tslint-to-eslint wthin @nrwl/angular generators
      expect(readJson(host, 'workspace.json')).toMatchSnapshot();

      projectConverter.setDefaults('@nrwl/angular', true);

      // AFTER (1) - convert-tslint-to-eslint wthin @nrwl/angular generators has removeTSLintIfNoMoreTSLintTargets set to true
      expect(readJson(host, 'workspace.json')).toMatchSnapshot();

      projectConverter.setDefaults('@nrwl/angular', false);

      // AFTER (2) - convert-tslint-to-eslint wthin @nrwl/angular generators has removeTSLintIfNoMoreTSLintTargets set to false
      expect(readJson(host, 'workspace.json')).toMatchSnapshot();
    });
  });

  describe('removeTSLintFromWorkspace()', () => {
    it('should remove all relevant traces of TSLint from the workspace', async () => {
      writeJson(host, 'tslint.json', {});
      writeJson(host, `${projectRoot}/tslint.json`, {});

      const projectConverter = new ProjectConverter({
        host,
        projectName,
        eslintInitializer: () => undefined,
      });

      await addDependenciesToPackageJson(
        host,
        {},
        {
          codelyzer: 'latest',
          tslint: 'latest',
        }
      )();

      const workspace = readWorkspaceConfiguration(host);
      // Not using shorthand syntax this time
      workspace.generators = {
        '@nrwl/angular': {
          application: {
            linter: 'tslint',
          },
          library: {
            linter: 'tslint',
          },
        },
      };
      updateWorkspaceConfiguration(host, workspace);

      // BEFORE - tslint and codelyzer are present
      expect(readJson(host, 'package.json')).toMatchSnapshot();

      // BEFORE - tslint set as both global and project-level default linter for @nrwl/angular generators
      expect(readJson(host, 'workspace.json')).toMatchSnapshot();

      await projectConverter.removeTSLintFromWorkspace()();

      // AFTER - it should remove tslint and codelyzer
      expect(readJson(host, 'package.json')).toMatchSnapshot();

      // AFTER - generators config from global and project-level settings removed (because eslint is always default)
      expect(readJson(host, 'workspace.json')).toMatchSnapshot();
    });

    it('should remove the entry in generators for convert-tslint-to-eslint because it is no longer needed', async () => {
      writeJson(host, 'tslint.json', {});
      writeJson(host, `${projectRoot}/tslint.json`, {});

      const projectConverter = new ProjectConverter({
        host,
        projectName,
        eslintInitializer: () => undefined,
      });

      const workspace = readWorkspaceConfiguration(host);
      workspace.generators = {
        '@nrwl/angular': {
          'convert-tslint-to-eslint': {
            removeTSLintIfNoMoreTSLintTargets: true,
          },
        },
      };
      updateWorkspaceConfiguration(host, workspace);

      // BEFORE - convert-tslint-to-eslint wthin @nrwl/angular generators has a value for removeTSLintIfNoMoreTSLintTargets
      expect(readJson(host, 'workspace.json')).toMatchSnapshot();

      await projectConverter.removeTSLintFromWorkspace()();

      // AFTER - generators config no longer has a reference to convert-tslint-to-eslint
      expect(readJson(host, 'workspace.json')).toMatchSnapshot();
    });
  });
});
