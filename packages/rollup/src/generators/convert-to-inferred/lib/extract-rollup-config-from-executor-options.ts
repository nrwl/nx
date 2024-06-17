import { joinPathFragments, stripIndents, Tree } from '@nx/devkit';
import { RollupExecutorOptions } from '../../../executors/rollup/schema';
import { normalizePathOptions } from './normalize-path-options';

export function extractRollupConfigFromExecutorOptions(
  tree: Tree,
  options: RollupExecutorOptions,
  configurations: Record<string, Partial<RollupExecutorOptions>>,
  projectRoot: string
) {
  normalizePathOptions(projectRoot, options);

  let newRollupConfigContent: string;

  const hasConfigurations =
    !!configurations && Object.keys(configurations).length > 0;

  const oldRollupConfig = Array.isArray(options.rollupConfig)
    ? options.rollupConfig
    : options.rollupConfig
    ? [options.rollupConfig]
    : [];
  delete options.rollupConfig;

  // Resolve conflict with rollup.config.js if it exists.
  for (let i = 0; i < oldRollupConfig.length; i++) {
    const file = oldRollupConfig[i];
    if (file === './rollup.config.js') {
      tree.rename(
        joinPathFragments(projectRoot, 'rollup.config.js'),
        joinPathFragments(projectRoot, `rollup.migrated.config.js`)
      );
      oldRollupConfig.splice(i, 1, './rollup.migrated.config.js');
    }
  }

  const defaultOptions: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (key === 'watch') continue;
    delete options[key];
    defaultOptions[key] = value;
  }
  if (hasConfigurations) {
    const configurationOptions: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries(configurations)) {
      for (const [optionKey, optionValue] of Object.entries(value)) {
        if (optionKey === 'watch') continue;
        delete value[optionKey];
        configurationOptions[key] ??= {};
        configurationOptions[key][optionKey] = optionValue;
      }
    }

    newRollupConfigContent = stripIndents`
      const { withNx } = require('@nx/rollup/with-nx');
      
      // These options were migrated by @nx/rollup:convert-to-inferred from project.json
      const configValues =  ${JSON.stringify(
        {
          default: defaultOptions,
          ...configurationOptions,
        },
        null,
        2
      )}; 
        
      // Determine the correct configValue to use based on the configuration
      const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';
      
      const options = {
        ...configValues.default,
        ...configValues[nxConfiguration],
      };
      
      ${oldRollupConfig.length > 0 ? 'let' : 'const'} config = withNx(options, {
        // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
        // e.g. 
        // output: { sourcemap: true },
      });
      
      ${oldRollupConfig
        // Normalize path
        .map((s) => `config = require('${s}')(config, options);`)
        .join('\n')}
      
      module.exports = config;
    `;
  } else {
    newRollupConfigContent = stripIndents`
      const { withNx } = require('@nx/rollup/with-nx');
      
      // These options were migrated by @nx/rollup:convert-to-inferred from project.json
      const options = ${JSON.stringify(defaultOptions, null, 2)};
      
      ${oldRollupConfig.length > 0 ? 'let' : 'const'} config = withNx(options, {
        // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
        // e.g. 
        // output: { sourcemap: true },
      });
      
      ${oldRollupConfig
        // Normalize path
        .map((s) => `config = require('${s}')(config, options);`)
        .join('\n')}
      
      module.exports = config;
    `;
  }

  tree.write(
    joinPathFragments(projectRoot, `rollup.config.js`),
    newRollupConfigContent
  );

  return defaultOptions;
}
