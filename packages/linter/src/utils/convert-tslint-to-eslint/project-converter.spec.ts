import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  NxJsonConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { ProjectConverter } from './project-converter';

/**
 * Don't run actual child_process implementation of installPackagesTask()
 */
jest.mock('child_process');

/**
 * Don't run the conversion util, it touches the file system and has its own tests
 */
jest.mock('./utils', () => {
  return {
    // Since upgrading to (ts-)jest 26 this usage of this mock has caused issues...
    // @ts-ignore
    ...jest.requireActual<any>('./utils'),
    convertTSLintConfig: jest.fn(() => {
      return {
        convertedESLintConfig: {
          rules: {
            'some-converted-rule': 'error',
          },
        },
        unconvertedTSLintRules: [],
        ensureESLintPlugins: [],
      };
    }),
  };
});

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
          ignoreExistingTslintConfig: false,
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
          ignoreExistingTslintConfig: false,
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
          ignoreExistingTslintConfig: false,
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
          ignoreExistingTslintConfig: false,
          eslintInitializer: () => undefined,
        })
    ).toThrowErrorMatchingSnapshot();
  });

  it('should not throw if no root tslint.json is found but ignore is set', () => {
    expect(
      () =>
        new ProjectConverter({
          host,
          projectName,
          ignoreExistingTslintConfig: true,
          eslintInitializer: () => undefined,
        })
    ).not.toThrow();
  });

  it('should not throw if no project tslint.json is found', () => {
    writeJson(host, 'tslint.json', {});

    expect(
      () =>
        new ProjectConverter({
          host,
          projectName,
          ignoreExistingTslintConfig: false,
          eslintInitializer: () => undefined,
        })
    ).not.toThrow();
  });

  it('should not throw when not in dry-run and config files successfully found', () => {
    writeJson(host, 'tslint.json', {});
    writeJson(host, `${projectRoot}/tslint.json`, {});

    expect(
      () =>
        new ProjectConverter({
          host,
          projectName,
          ignoreExistingTslintConfig: false,
          eslintInitializer: () => undefined,
        })
    ).not.toThrow();
  });

  describe('ignoreExistingTslintConfig', () => {
    describe('ignoreExistingTslintConfig: false', () => {
      it('should use existing TSLint configs and merge their converted ESLint equivalents with recommended ESLint configs', async () => {
        const { convertTSLintConfig } = require('./utils');
        (convertTSLintConfig as jest.Mock).mockClear();

        writeJson(host, 'tslint.json', {});
        writeJson(host, `${projectRoot}/tslint.json`, {});

        const projectConverterDiscardFalse = new ProjectConverter({
          host,
          projectName,
          ignoreExistingTslintConfig: false,
          eslintInitializer: () => {
            writeJson(host, '.eslintrc.json', {
              rules: {
                'some-recommended-root-eslint-rule': 'error',
              },
            });
            writeJson(host, `${projectRoot}/.eslintrc.json`, {
              rules: {
                'some-recommended-project-eslint-rule': 'error',
              },
            });
            return Promise.resolve(undefined);
          },
        });
        await projectConverterDiscardFalse.initESLint();

        // Existing ESLint rules from init stage will be merged with converted rules
        await projectConverterDiscardFalse.convertRootTSLintConfig((j) => j);
        expect(readJson(host, '.eslintrc.json')).toMatchSnapshot();

        // Existing ESLint rules from init stage will be merged with converted rules
        await projectConverterDiscardFalse.convertProjectConfig((j) => j);
        expect(
          readJson(host, `${projectRoot}/.eslintrc.json`)
        ).toMatchSnapshot();

        expect(convertTSLintConfig).toHaveBeenCalledTimes(2);
      });
    });

    describe('ignoreExistingTslintConfig: true', () => {
      it('should ignore existing TSLint configs and just reset the project to use recommended ESLint configs', async () => {
        const { convertTSLintConfig } = require('./utils');
        (convertTSLintConfig as jest.Mock).mockClear();

        writeJson(host, 'tslint.json', {});
        writeJson(host, `${projectRoot}/tslint.json`, {});

        const projectConverterDiscardTrue = new ProjectConverter({
          host,
          projectName,
          ignoreExistingTslintConfig: true,
          eslintInitializer: () => {
            writeJson(host, '.eslintrc.json', {
              rules: {
                'some-recommended-root-eslint-rule': 'error',
              },
            });
            writeJson(host, `${projectRoot}/.eslintrc.json`, {
              rules: {
                'some-recommended-project-eslint-rule': 'error',
              },
            });
            return Promise.resolve(undefined);
          },
        });
        await projectConverterDiscardTrue.initESLint();

        // Should not contain any converted rules, just existing ESLint rules from init stage
        await projectConverterDiscardTrue.convertRootTSLintConfig((j) => j);
        expect(readJson(host, '.eslintrc.json')).toMatchSnapshot();

        // Should not contain any converted rules, just existing ESLint rules from init stage
        await projectConverterDiscardTrue.convertProjectConfig((j) => j);
        expect(
          readJson(host, `${projectRoot}/.eslintrc.json`)
        ).toMatchSnapshot();

        expect(convertTSLintConfig).not.toHaveBeenCalled();
      });
    });
  });

  describe('setDefaults()', () => {
    it('should save in nx.json', async () => {
      writeJson(host, 'tslint.json', {});
      writeJson(host, `${projectRoot}/tslint.json`, {});

      const projectConverter = new ProjectConverter({
        host,
        projectName,
        ignoreExistingTslintConfig: false,
        eslintInitializer: () => undefined,
      });

      const nxJson = readJson<NxJsonConfiguration>(host, 'nx.json');
      nxJson.generators = {
        '@nrwl/angular': {
          application: {
            linter: 'tslint',
          },
          library: {
            linter: 'tslint',
          },
        },
      };
      writeJson(host, 'nx.json', nxJson);

      // BEFORE - no entry for convert-tslint-to-eslint wthin @nrwl/angular generators
      expect(readJson(host, 'nx.json')).toMatchSnapshot();

      projectConverter.setDefaults('@nrwl/angular', {
        ignoreExistingTslintConfig: true,
        removeTSLintIfNoMoreTSLintTargets: true,
      });

      // AFTER (1) - convert-tslint-to-eslint wthin @nrwl/angular generators has removeTSLintIfNoMoreTSLintTargets set to true
      expect(readJson(host, 'nx.json')).toMatchSnapshot();

      projectConverter.setDefaults('@nrwl/angular', {
        ignoreExistingTslintConfig: false,
        removeTSLintIfNoMoreTSLintTargets: false,
      });

      // AFTER (2) - convert-tslint-to-eslint wthin @nrwl/angular generators has removeTSLintIfNoMoreTSLintTargets set to false
      expect(readJson(host, 'nx.json')).toMatchSnapshot();
    });
  });

  describe('removeTSLintFromWorkspace()', () => {
    it('should remove all relevant traces of TSLint from the workspace', async () => {
      writeJson(host, 'tslint.json', {});
      writeJson(host, `${projectRoot}/tslint.json`, {});

      const projectConverter = new ProjectConverter({
        host,
        projectName,
        ignoreExistingTslintConfig: false,
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

      const nxJson = readJson<NxJsonConfiguration>(host, 'nx.json');
      // Not using shorthand syntax this time
      nxJson.generators = {
        '@nrwl/angular': {
          application: {
            linter: 'tslint',
          },
          library: {
            linter: 'tslint',
          },
        },
      };
      writeJson(host, 'nx.json', nxJson);

      // BEFORE - tslint and codelyzer are present
      expect(readJson(host, 'package.json')).toMatchSnapshot();

      // BEFORE - tslint set as both global linter for @nrwl/angular generators
      expect(readJson(host, 'nx.json')).toMatchSnapshot();

      expect(readProjectConfiguration(host, projectName)).toMatchSnapshot();

      await projectConverter.removeTSLintFromWorkspace()();

      // AFTER - it should remove tslint and codelyzer
      expect(readJson(host, 'package.json')).toMatchSnapshot();

      // AFTER - generators config from global project-level settings removed (because eslint is always default)
      expect(readJson(host, 'nx.json')).toMatchSnapshot();

      // AFTER - generators config from project-level settings removed (because eslint is always default)
      expect(readProjectConfiguration(host, projectName)).toMatchSnapshot();
    });

    it('should remove the entry in generators for convert-tslint-to-eslint because it is no longer needed', async () => {
      writeJson(host, 'tslint.json', {});
      writeJson(host, `${projectRoot}/tslint.json`, {});

      const projectConverter = new ProjectConverter({
        host,
        projectName,
        ignoreExistingTslintConfig: false,
        eslintInitializer: () => undefined,
      });

      const nxJson = readJson<NxJsonConfiguration>(host, 'nx.json');
      nxJson.generators = {
        '@nrwl/angular': {
          'convert-tslint-to-eslint': {
            removeTSLintIfNoMoreTSLintTargets: true,
          },
        },
      };
      writeJson(host, 'nx.json', nxJson);

      // BEFORE - convert-tslint-to-eslint wthin @nrwl/angular generators has a value for removeTSLintIfNoMoreTSLintTargets
      expect(readJson(host, 'nx.json')).toMatchSnapshot();

      await projectConverter.removeTSLintFromWorkspace()();

      // AFTER - generators config no longer has a reference to convert-tslint-to-eslint
      expect(readJson(host, 'nx.json')).toMatchSnapshot();
    });
  });
});
