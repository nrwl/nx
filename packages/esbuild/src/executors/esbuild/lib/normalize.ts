import { joinPathFragments, logger, type ExecutorContext } from '@nx/devkit';
import { readTsConfig } from '@nx/js';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import * as pc from 'picocolors';
import type {
  EsBuildExecutorOptions,
  NormalizedEsBuildExecutorOptions,
} from '../schema';

export function normalizeOptions(
  options: EsBuildExecutorOptions,
  context: ExecutorContext
): NormalizedEsBuildExecutorOptions {
  const isTsSolutionSetup = isUsingTsSolutionSetup();
  if (isTsSolutionSetup && options.generatePackageJson) {
    throw new Error(
      `Setting 'generatePackageJson: true' is not supported with the current TypeScript setup. Update the 'package.json' file at the project root as needed and unset the 'generatePackageJson' option.`
    );
  }

  const tsConfig = readTsConfig(options.tsConfig);

  // If we're not generating package.json file, then copy it as-is as an asset when not using ts solution setup.
  const assets =
    options.generatePackageJson || isTsSolutionSetup
      ? options.assets ?? []
      : [
          ...options.assets,
          joinPathFragments(
            context.projectGraph.nodes[context.projectName].data.root,
            'package.json'
          ),
        ];

  if (!options.bundle && options.thirdParty) {
    logger.info(
      pc.yellow(
        `Your build has conflicting options, ${pc.bold(
          'bundle:false'
        )} and ${pc.bold(
          'thirdParty:true'
        )}. Your package.json dependencies might not be generated correctly so we added an update ${pc.bold(
          'thirdParty:false'
        )}`
      )
    );
  }

  const thirdParty = !options.bundle ? false : options.thirdParty;

  const declarationRootDir = options.declarationRootDir
    ? path.join(context.root, options.declarationRootDir)
    : undefined;

  // if option declaration is defined, then it takes precedence over the tsconfig option
  const declaration =
    options.declaration ??
    (tsConfig.options.declaration || tsConfig.options.composite);

  if (options.skipTypeCheck && declaration) {
    logger.info(
      pc.yellow(
        `Your build has conflicting options, ${pc.bold(
          'skipTypeCheck:true'
        )} and ${pc.bold(
          'declaration:true'
        )}. Your declarations won't be generated so we added an update ${pc.bold(
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
      isTsSolutionSetup,
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
      isTsSolutionSetup,
      outputFileName:
        // NOTE: The .js default extension may be replaced later in getOutfile() call.
        options.outputFileName ?? `${path.parse(options.main).name}.js`,
    };
  }
}
