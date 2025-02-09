import { joinPathFragments } from '@nx/devkit';
import { PackageJson } from 'nx/src/utils/package-json';
import { DependencyCollection } from './resolve-local-package-dependencies';

export class Package {
  name: string;
  version: string;
  location: string;

  constructor(
    private packageJson: PackageJson,
    workspaceRoot: string,
    workspaceRelativeLocation: string
  ) {
    this.name = packageJson.name;
    this.version = packageJson.version;
    this.location = joinPathFragments(workspaceRoot, workspaceRelativeLocation);
  }

  getLocalDependency(depName: string): {
    collection: DependencyCollection;
    spec: string;
  } | null {
    if (this.packageJson.dependencies?.[depName]) {
      return {
        collection: 'dependencies',
        spec: this.packageJson.dependencies[depName],
      };
    }
    if (this.packageJson.devDependencies?.[depName]) {
      return {
        collection: 'devDependencies',
        spec: this.packageJson.devDependencies[depName],
      };
    }
    if (this.packageJson.peerDependencies?.[depName]) {
      return {
        collection: 'peerDependencies',
        spec: this.packageJson.peerDependencies[depName],
      };
    }
    if (this.packageJson.optionalDependencies?.[depName]) {
      return {
        collection: 'optionalDependencies',
        spec: this.packageJson.optionalDependencies[depName],
      };
    }
    return null;
  }
}
