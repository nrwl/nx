import type { Tree } from '@nrwl/devkit';
import { removeDependenciesFromPackageJson } from '@nrwl/devkit';

export const removeBabelRelatedPackages = async (host: Tree) =>
  removeDependenciesFromPackageJson(
    host,
    [],
    [
      '@babel/core',
      '@babel/preset-env',
      '@babel/preset-typescript',
      '@babel/preset-react',
    ]
  );

export default removeBabelRelatedPackages;
