import { joinPathFragments, stripIndents, Tree } from '@nx/devkit';
import { RollupExecutorOptions } from '../../../executors/rollup/schema';
import { normalizePathOptions } from './normalize-path-options';

const aliases = {
  entryFile: 'main',
  exports: 'generateExportsField',
  f: 'format',
};

export function extractRollupConfigFromExecutorOptions(
  tree: Tree,
  options: RollupExecutorOptions,
  configurations: Record<string, Partial<RollupExecutorOptions>>,
  projectRoot: string
) {
  normalizePathOptions(projectRoot, options);

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
    if (aliases[key]) {
      defaultOptions[aliases[key]] = value;
    } else {
      defaultOptions[key] = value;
    }
  }
  let configurationOptions: Record<string, Record<string, unknown>>;
  if (hasConfigurations) {
    configurationOptions = {};
    for (const [key, value] of Object.entries(configurations)) {
      let newConfigFileName: string;
      let oldRollupConfigForConfiguration: string[];
      for (const [optionKey, optionValue] of Object.entries(value)) {
        if (optionKey === 'watch') continue;

        /**
         * If a configuration lists rollupConfig as an option
         * Collect the options and set up a new file to point to
         * Set the `--config` option to the new file
         */
        if (optionKey === 'rollupConfig') {
          oldRollupConfigForConfiguration = Array.isArray(optionValue)
            ? optionValue
            : optionValue
            ? [optionValue]
            : [];
          newConfigFileName = `rollup.${key}.config.js`;
          for (let i = 0; i < oldRollupConfigForConfiguration.length; i++) {
            const file = oldRollupConfigForConfiguration[i];
            if (file === newConfigFileName) {
              tree.rename(
                joinPathFragments(projectRoot, newConfigFileName),
                joinPathFragments(
                  projectRoot,
                  `rollup.${key}.migrated.config.js`
                )
              );
              oldRollupConfigForConfiguration.splice(
                i,
                1,
                `./rollup.${key}.migrated.config.js`
              );
            }
          }

          delete value[optionKey];
          value['config'] = newConfigFileName;
          continue;
        }

        delete value[optionKey];
        configurationOptions[key] ??= {};
        configurationOptions[key][optionKey] = optionValue;
      }

      /**
       * Only if we encountered a rollupConfig in the current configuration
       * should we write a new config file, containing all the config values
       */
      if (newConfigFileName) {
        tree.write(
          joinPathFragments(projectRoot, newConfigFileName),
          createNewRollupConfig(
            oldRollupConfigForConfiguration,
            defaultOptions,
            configurationOptions[key],
            true
          )
        );
      }
    }
  }

  tree.write(
    joinPathFragments(projectRoot, `rollup.config.js`),
    createNewRollupConfig(oldRollupConfig, defaultOptions, configurationOptions)
  );

  return defaultOptions;
}

function createNewRollupConfig(
  oldRollupConfig: string[],
  defaultOptions: Record<string, unknown>,
  configurationOptions?:
    | Record<string, Record<string, unknown>>
    | Record<string, unknown>,
  singleConfiguration = false
) {
  if (configurationOptions) {
    return stripIndents`
      const { withNx } = require('@nx/rollup/with-nx');
      
      // These options were migrated by @nx/rollup:convert-to-inferred from project.json
      const configValues =  ${JSON.stringify(
        singleConfiguration
          ? {
              ...defaultOptions,
              ...configurationOptions,
            }
          : {
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
    return stripIndents`
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
}
