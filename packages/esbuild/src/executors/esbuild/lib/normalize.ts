import * as fs from 'fs';
import * as path from 'path';
import {
  EsBuildExecutorOptions,
  NormalizedEsBuildExecutorOptions,
} from '../schema';
import { ExecutorContext, joinPathFragments, logger } from '@nx/devkit';
import chalk = require('chalk');
import * as esbuild from 'esbuild';
import { readTsConfig } from '@nx/js';

export function normalizeOptions(
  options: EsBuildExecutorOptions,
  context: ExecutorContext
): NormalizedEsBuildExecutorOptions {
  const tsConfig = readTsConfig(options.tsConfig);

  // If we're not generating package.json file, then copy it as-is as an asset.
  const assets = options.generatePackageJson
    ? options.assets
    : [
        ...options.assets,
        joinPathFragments(
          context.projectGraph.nodes[context.projectName].data.root,
          'package.json'
        ),
      ];

  if (!options.bundle && options.thirdParty) {
    logger.info(
      chalk.yellow(
        `Your build has conflicting options, ${chalk.bold(
          'bundle:false'
        )} and ${chalk.bold(
          'thirdParty:true'
        )}. Your package.json depedencies might not be generated correctly so we added an update ${chalk.bold(
          'thirdParty:false'
        )}`
      )
    );
  }

  const thirdParty = !options.bundle ? false : options.thirdParty;

  const { root: projectRoot } =
    context.projectsConfigurations.projects[context.projectName];
  const declarationRootDir = options.declarationRootDir
    ? path.join(context.root, options.declarationRootDir)
    : undefined;

  // if option declaration is defined, then it takes precedence over the tsconfig option
  const declaration =
    options.declaration ??
    (tsConfig.options.declaration || tsConfig.options.composite);

  if (options.skipTypeCheck && declaration) {
    logger.info(
      chalk.yellow(
        `Your build has conflicting options, ${chalk.bold(
          'skipTypeCheck:true'
        )} and ${chalk.bold(
          'declaration:true'
        )}. Your declarations won't be generated so we added an update ${chalk.bold(
          'skipTypeCheck:false'
        )}`
      )
    );
  }

  const skipTypeCheck = declaration ? false : options.skipTypeCheck;

  let userDefinedBuildOptions: esbuild.BuildOptions;
  if (options.esbuildConfig) {
    const userDefinedConfig = path.resolve(context.root, options.esbuildConfig);

    if (options.esbuildOptions)
      throw new Error(
        `Cannot use both esbuildOptions and esbuildConfig options. Remove one of them and try again.`
      );
    if (!fs.existsSync(userDefinedConfig))
      throw new Error(
        `Path of esbuildConfig does not exist: ${userDefinedConfig}`
      );
    userDefinedBuildOptions = require(userDefinedConfig);
  } else if (options.esbuildOptions) {
    userDefinedBuildOptions = options.esbuildOptions;
  }

  if (options.additionalEntryPoints?.length > 0) {
    const { outputFileName, ...rest } = options;
    if (outputFileName) {
      throw new Error(
        `Cannot use outputFileName and additionalEntry points together. Please remove outputFileName and try again.`
      );
    }
    return {
      ...rest,
      thirdParty,
      assets,
      declaration,
      declarationRootDir,
      skipTypeCheck,
      userDefinedBuildOptions,
      external: options.external ?? [],
      singleEntry: false,
      // Use the `main` file name as the output file name.
      // This is needed for `@nx/js:node` to know the main file to execute.
      // NOTE: The .js default extension may be replaced later in getOutfile() call.
      outputFileName: `${path.parse(options.main).name}.js`,
    };
  } else {
    return {
      ...options,
      thirdParty,
      assets,
      declaration,
      declarationRootDir,
      skipTypeCheck,
      userDefinedBuildOptions,
      external: options.external ?? [],
      singleEntry: true,
      outputFileName:
        // NOTE: The .js default extension may be replaced later in getOutfile() call.
        options.outputFileName ?? `${path.parse(options.main).name}.js`,
    };
  }
}
