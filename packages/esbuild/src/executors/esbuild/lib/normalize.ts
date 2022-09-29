import { parse } from 'path';
import {
  EsBuildExecutorOptions,
  NormalizedEsBuildExecutorOptions,
} from '../schema';

export function normalizeOptions(
  options: EsBuildExecutorOptions
): NormalizedEsBuildExecutorOptions {
  if (options.additionalEntryPoints?.length > 0) {
    const { outputFileName, ...rest } = options;
    if (outputFileName) {
      throw new Error(
        `Cannot use outputFileName and additionalEntry points together. Please remove outputFileName and try again.`
      );
    }
    return {
      ...rest,
      singleEntry: false,
    };
  } else {
    return {
      ...options,
      singleEntry: true,
      outputFileName:
        options.outputFileName ?? `${parse(options.main).name}.js`,
    };
  }
}
