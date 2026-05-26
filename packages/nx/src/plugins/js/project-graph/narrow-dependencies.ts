import type { CreateDependenciesContext } from '@nx/devkit';
import { DependencyNarrower } from './narrow-dependencies/dependency-narrower';
import type { NormalizedOptions } from './narrowing-options';
import type { RawDependency } from './types';

export async function narrowDependencies(
  dependencies: RawDependency[],
  context: CreateDependenciesContext,
  options: NormalizedOptions
): Promise<RawDependency[]> {
  return new DependencyNarrower(context, options).narrow(dependencies);
}
