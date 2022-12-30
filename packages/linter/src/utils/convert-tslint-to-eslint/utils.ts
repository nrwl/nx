import { addDependenciesToPackageJson, logger } from '@nrwl/devkit';
import type { Tree, GeneratorCallback } from '@nrwl/devkit';
import type { Linter } from 'eslint';
import type { TSLintRuleOptions } from 'tslint-to-eslint-config';
import { convertTslintNxRuleToEslintNxRule } from './convert-nx-enforce-module-boundaries-rule';
import { convertToESLintConfig } from './convert-to-eslint-config';

export function ensureESLintPluginsAreInstalled(
  host: Tree,
  eslintPluginsToBeInstalled: string[]
): GeneratorCallback {
  if (!eslintPluginsToBeInstalled?.length) {
    return () => undefined;
  }

  const additionalDevDependencies = {};

  for (const pluginName of eslintPluginsToBeInstalled) {
    additionalDevDependencies[pluginName] = 'latest';
  }

  logger.info(
    '\nINFO: To most closely match your tslint.json, we will ensure the `latest` version of the following eslint plugin(s) are installed:'
  );
  logger.info('\n  - ' + eslintPluginsToBeInstalled.join('\n  - '));
  logger.info(
    '\nPlease note, you may later wish to pin these to a specific version number in your package.json, rather than leaving it open to `latest`.\n'
  );

  return addDependenciesToPackageJson(host, {}, additionalDevDependencies);
}

/**
 * We don't want the user to depend on the TSLint fallback plugin, we will instead
 * explicitly inform them of the rules that could not be converted automatically and
 * advise them on what to do next.
 */
function warnInCaseOfUnconvertedRules(
  tslintConfigPath: string,
  unconvertedTSLintRules: TSLintRuleOptions[]
): void {
  const unconvertedTSLintRuleNames = unconvertedTSLintRules
    .filter(
      // Ignore formatting related rules, they are handled by Nx format/prettier
      (unconverted) =>
        !['import-spacing', 'whitespace', 'typedef'].includes(
          unconverted.ruleName
        )
    )
    .map((unconverted) => unconverted.ruleName);

  if (unconvertedTSLintRuleNames.length > 0) {
    logger.warn(
      `\nWARNING: Within "${tslintConfigPath}", the following ${unconvertedTSLintRuleNames.length} rule(s) did not have known converters in https://github.com/typescript-eslint/tslint-to-eslint-config`
    );
    logger.warn('\n  - ' + unconvertedTSLintRuleNames.join('\n  - '));
    logger.warn(
      '\nYou will need to decide on how to handle the above manually, but everything else has been handled for you automatically.\n'
    );
  }
}

export async function convertTSLintConfig(
  rawTSLintJson: any,
  tslintJsonPath: string,
  ignoreExtendsVals: string[]
) {
  const convertedProject = await convertToESLintConfig(
    tslintJsonPath,
    rawTSLintJson,
    ignoreExtendsVals
  );
  convertedProject.convertedESLintConfig.rules ||= {};

  /**
   * Apply the custom converter for the nx-module-boundaries rule if applicable
   */
  const convertedNxRule = convertTslintNxRuleToEslintNxRule(rawTSLintJson);
  if (convertedNxRule) {
    convertedProject.convertedESLintConfig.rules[convertedNxRule.ruleName] =
      convertedNxRule.ruleConfig;
  }

  // Remove the `@typescript-eslint/tslint/config` rule
  if (
    convertedProject.convertedESLintConfig.rules[
      '@typescript-eslint/tslint/config'
    ]
  ) {
    delete convertedProject.convertedESLintConfig.rules[
      '@typescript-eslint/tslint/config'
    ];
  }

  warnInCaseOfUnconvertedRules(
    tslintJsonPath,
    convertedProject.unconvertedTSLintRules
  );

  return convertedProject;
}

export function deduplicateOverrides(
  overrides: Linter.Config['overrides'] = []
) {
  const map = new Map();
  for (const o of overrides) {
    const mapKey: string =
      typeof o.files === 'string' ? o.files : o.files.join(',');
    const existing: Set<Linter.ConfigOverride> = map.get(mapKey);
    if (existing) {
      existing.add(o);
      map.set(mapKey, existing);
      continue;
    }
    const set = new Set();
    set.add(o);
    map.set(mapKey, set);
  }

  let dedupedOverrides = [];

  for (const [, overrides] of map.entries()) {
    const overridesArr = Array.from(overrides);
    if (overridesArr.length === 1) {
      dedupedOverrides = [...dedupedOverrides, ...overridesArr];
      continue;
    }
    let mergedOverride = {};
    for (const o of overridesArr) {
      mergedOverride = {
        ...mergedOverride,
        ...(o as any),
      };
    }
    dedupedOverrides.push(mergedOverride);
  }

  return dedupedOverrides;
}
