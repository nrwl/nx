import type { Linter as ESLintLinter } from 'eslint';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type {
  TSLintRuleOptions,
  createESLintConfiguration as CreateESLintConfiguration,
} from 'tslint-to-eslint-config';

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
  } = require('tslint-to-eslint-config');

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
    mkdirSync(dirname(pathToTslintJson), { recursive: true });
    writeFileSync(pathToTslintJson, JSON.stringify(updatedTSLintJson));
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

  const summarizedConfiguration = await (createESLintConfiguration as typeof CreateESLintConfiguration)(
    originalConfigurations
  );

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
