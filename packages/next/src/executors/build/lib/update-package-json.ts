import type { ExecutorContext } from '@nrwl/devkit';
import type { PackageJson } from 'nx/src/utils/package-json';

export function updatePackageJson(
  packageJson: PackageJson,
  context: ExecutorContext
) {
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts.start = 'next start';

  const typescriptNode = context.projectGraph.externalNodes['npm:typescript'];
  if (typescriptNode) {
    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.dependencies['typescript'] = typescriptNode.data.version;
  }
}
