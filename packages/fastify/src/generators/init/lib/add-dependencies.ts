import type { GeneratorCallback, Tree } from '@nrwl/devkit';
import { addDependenciesToPackageJson } from '@nrwl/devkit';
import { fastifyVersion } from '../../../utils/versions';

export function addDependencies(tree: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
    {
      fastify: fastifyVersion,
      tslib: '^2.0.0',
    },
    {}
  );
}
