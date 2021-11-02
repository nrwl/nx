import {
  readProjectConfiguration,
  visitNotIgnoredFiles,
  writeJsonFile,
  getPackageManagerCommand,
} from '@nrwl/devkit';
import type { Tree } from '@nrwl/devkit';
import { execSync } from 'child_process';
import type { Linter as ESLintLinter } from 'eslint';
import { dirSync } from 'tmp';
import type {
  createESLintConfiguration as CreateESLintConfiguration,
  TSLintRuleOptions,
} from 'tslint-to-eslint-config';
import { tslintToEslintConfigVersion } from '../versions';

let tslintToEslint;
function getConvertToEslintConfig() {
  if (tslintToEslint) {
    return tslintToEslint;
  }

  try {
    // This is usually not possible during runtime but makes it easy to mock in tests
    return require('tslint-to-eslint-config');
  } catch {}

  /**
   * In order to avoid all users of Nx needing to have tslint-to-eslint-config (and therefore tslint)
   * in their node_modules, we dynamically install and uninstall the library as part of the conversion
   * process.
   *
   * NOTE: By taking this approach we have to sacrifice dry-run capabilities for this generator.
   */
  const tempDir = dirSync().name;
  execSync(
    `${
      getPackageManagerCommand().addDev
    } tslint-to-eslint-config@${tslintToEslintConfigVersion}`,
    {
      cwd: tempDir,
      stdio: [0, 1, 2],
    }
  );

  tslintToEslint = require(require.resolve('tslint-to-eslint-config', {
    paths: [tempDir],
  }));
  return tslintToEslint;
}

export async function convertToESLintConfig(
  pathToTslintJson: string,
  tslintJson: Record<string, unknown>,
  ignoreExtendsVals: string[]
): Promise<{
  convertedESLintConfig: ESLintLinter.Config;
  unconvertedTSLintRules: TSLintRuleOptions[];
  ensureESLintPlugins: string[];
}> {
  /**
   * We need to avoid a direct dependency on tslint-to-eslint-config
   * and ensure we are only resolving the dependency from the user's
   * node_modules on demand (it will be installed as part of the
   * conversion generator).
   */
  const {
    createESLintConfiguration,
    findReportedConfiguration,
    joinConfigConversionResults,
  } = getConvertToEslintConfig();

  const updatedTSLintJson = tslintJson;
  /**
   * If ignoreExtendsVals are provided, strip them from the config
   * and commit the result to disk per the notes below.
   */
  if (ignoreExtendsVals.length && updatedTSLintJson.extends) {
    if (
      typeof updatedTSLintJson.extends === 'string' &&
      ignoreExtendsVals.includes(updatedTSLintJson.extends)
    ) {
      delete updatedTSLintJson.extends;
    }
    if (Array.isArray(updatedTSLintJson.extends)) {
      updatedTSLintJson.extends = updatedTSLintJson.extends.filter(
        (ext) => !ignoreExtendsVals.includes(ext)
      );
    }
    /**
     * The reasons we need to interact with the filesystem here:
     *
     * 1) The result of the tslint CLI flag `--print-config` is needed for the
     * conversion process, and unfortunately no equivalent Node API was ever
     * added to tslint, so the tslint CLI needs to always read from disk.
     *
     * 2) When converting project configs, we need to strip the extends path
     * which corresponds to the workspace's root config, otherwise all of the
     * root config's rules will be included in the resultant eslint config for
     * the project. The interaction with the filesystem is needed because of
     * point (1) above - we need to strip the relevant extends and commit that
     * change to disk before the tslint CLI reads the config file.
     */
    writeJsonFile(pathToTslintJson, updatedTSLintJson);
  }
  const reportedConfiguration = await findReportedConfiguration(
    'npx tslint --print-config',
    pathToTslintJson
  );

  if (reportedConfiguration instanceof Error) {
    if (
      reportedConfiguration.message.includes('unknown option `--print-config')
    ) {
      throw new Error(
        '\nError: TSLint v5.18 required in order to run this schematic. Please update your version and try again.\n'
      );
    }
    /**
     * Make a print-config issue easier to understand for the end user.
     * This error could occur if, for example, the user does not have a TSLint plugin installed correctly that they
     * reference in their config.
     */
    const printConfigFailureMessageStart =
      'Command failed: npx tslint --print-config "tslint.json"';
    if (
      reportedConfiguration.message.startsWith(printConfigFailureMessageStart)
    ) {
      throw new Error(
        `\nThere was a critical error when trying to inspect your tslint.json: \n${reportedConfiguration.message.replace(
          printConfigFailureMessageStart,
          ''
        )}`
      );
    }

    throw new Error(`Unexpected error: ${reportedConfiguration.message}`);
  }

  const originalConfigurations = {
    tslint: {
      full: reportedConfiguration,
      raw: updatedTSLintJson,
    },
  };

  const summarizedConfiguration = await (
    createESLintConfiguration as typeof CreateESLintConfiguration
  )(originalConfigurations);

  /**
   * We are expecting it to not find a converter for nx-enforce-module-boundaries
   * and we will explicitly replace it with the ESLint equivalent ourselves.
   */
  if (summarizedConfiguration.missing) {
    summarizedConfiguration.missing = summarizedConfiguration.missing.filter(
      (missingRuleData) =>
        missingRuleData.ruleName !== 'nx-enforce-module-boundaries'
    );
  }

  // These are already covered by our extraEslintDependencies which get installed by the schematic
  const expectedESLintPlugins = [
    '@angular-eslint/eslint-plugin',
    '@angular-eslint/eslint-plugin-template',
  ];

  const convertedESLintConfig = joinConfigConversionResults(
    summarizedConfiguration,
    originalConfigurations
  ) as ESLintLinter.Config;

  if (
    Array.isArray(convertedESLintConfig.extends) &&
    convertedESLintConfig.extends.length
  ) {
    // Ignore any tslint-to-eslint-config default extends that do not apply to Nx
    convertedESLintConfig.extends = convertedESLintConfig.extends.filter(
      (ext) => !ext.startsWith('prettier')
    );
    if (convertedESLintConfig.extends.length === 0) {
      delete convertedESLintConfig.extends;
    }
  }

  return {
    convertedESLintConfig,
    unconvertedTSLintRules: summarizedConfiguration.missing,
    ensureESLintPlugins: Array.from(summarizedConfiguration.plugins).filter(
      (pluginName) => !expectedESLintPlugins.includes(pluginName)
    ),
  };
}

function likelyContainsTSLintComment(fileContent: string): boolean {
  return fileContent.includes('tslint:');
}

export function convertTSLintDisableCommentsForProject(
  tree: Tree,
  projectName: string
) {
  /**
   * We need to avoid a direct dependency on tslint-to-eslint-config
   * and ensure we are only resolving the dependency from the user's
   * node_modules on demand (it will be installed as part of the
   * conversion generator).
   */
  const { convertFileComments } = getConvertToEslintConfig();
  const { root } = readProjectConfiguration(tree, projectName);

  visitNotIgnoredFiles(tree, root, (filePath) => {
    if (!filePath.endsWith('.ts')) {
      return;
    }
    const fileContent = tree.read(filePath, 'utf-8');
    // Avoid updating files if we don't have to
    if (!fileContent || !likelyContainsTSLintComment(fileContent)) {
      return;
    }
    const updatedFileContent = convertFileComments({ fileContent, filePath });
    tree.write(filePath, updatedFileContent);
  });
}
