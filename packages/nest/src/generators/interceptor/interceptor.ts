import type { Tree } from '@nx/devkit';
import type {
  NestGeneratorWithLanguageOption,
  NestGeneratorWithTestOption,
  NormalizedOptions,
} from '../utils';
import {
  normalizeOptions,
  runNestSchematic,
  unitTestRunnerToSpec,
} from '../utils';

export type InterceptorGeneratorOptions = NestGeneratorWithLanguageOption &
  NestGeneratorWithTestOption;

export async function interceptorGenerator(
  tree: Tree,
  rawOptions: InterceptorGeneratorOptions
): Promise<any> {
  const options = await normalizeInterceptorOptions(tree, rawOptions);

  return runNestSchematic(tree, 'interceptor', options);
}

export default interceptorGenerator;

async function normalizeInterceptorOptions(
  tree: Tree,
  options: InterceptorGeneratorOptions
): Promise<NormalizedOptions> {
  const normalizedOptions = await normalizeOptions(tree, options);
  return {
    ...normalizedOptions,
    language: options.language,
    spec: unitTestRunnerToSpec(options.unitTestRunner),
  };
}
