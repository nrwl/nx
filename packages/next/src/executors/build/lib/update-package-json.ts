import type { ExecutorContext } from '@nx/devkit';
import type { PackageJson } from 'nx/src/utils/package-json';

export function updatePackageJson(
  packageJson: PackageJson,
  context: ExecutorContext
) {
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  if (!packageJson.scripts.start) {
    packageJson.scripts.start = 'next start';
  }

  packageJson.dependencies ??= {};

  // These are always required for a production Next.js app to run.
  // sharp is for next/image https://nextjs.org/docs/messages/sharp-missing-in-production
  // critters is required for experimental optimizing CSS
  const requiredPackages = [
    'react',
    'react-dom',
    'next',
    'typescript',
    'sharp',
    'critters',
  ];
  for (const pkg of requiredPackages) {
    const externalNode = context.projectGraph.externalNodes[`npm:${pkg}`];
    if (externalNode) {
      packageJson.dependencies[pkg] ??= externalNode.data.version;
    }
  }
}
