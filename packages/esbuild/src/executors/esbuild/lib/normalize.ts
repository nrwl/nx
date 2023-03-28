import { parse } from 'path';
import {
  EsBuildExecutorOptions,
  NormalizedEsBuildExecutorOptions,
} from '../schema';
import { ExecutorContext, joinPathFragments } from '@nrwl/devkit';

export function normalizeOptions(
  options: EsBuildExecutorOptions,
  context: ExecutorContext
): NormalizedEsBuildExecutorOptions {
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

  if (options.additionalEntryPoints?.length > 0) {
    const { outputFileName, ...rest } = options;
    if (outputFileName) {
      throw new Error(
        `Cannot use outputFileName and additionalEntry points together. Please remove outputFileName and try again.`
      );
    }
    return {
      ...rest,
      assets,
      external: options.external ?? [],
      singleEntry: false,
      // Use the `main` file name as the output file name.
      // This is needed for `@nrwl/js:node` to know the main file to execute.
      // NOTE: The .js default extension may be replaced later in getOutfile() call.
      outputFileName: `${parse(options.main).name}.js`,
    };
  } else {
    return {
      ...options,
      assets,
      external: options.external ?? [],
      singleEntry: true,
      outputFileName:
        // NOTE: The .js default extension may be replaced later in getOutfile() call.
        options.outputFileName ?? `${parse(options.main).name}.js`,
    };
  }
}
