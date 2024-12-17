import { readJson, Tree, updateJson } from '@nx/devkit';
import { join } from 'node:path';
// TODO: Export from release API before merging
import {
  ManifestActions,
  ManifestData,
} from 'nx/src/command-line/release/version-utils/flexible-version-management';
import { resolveVersionSpec } from './utils/resolve-version-spec';

export default class JsManifestActions extends ManifestActions {
  getPrimaryManifestPath(): string {
    return join(this.projectGraphNode.data.root, 'package.json');
  }

  async ensureManifestExistsAtExpectedLocation(tree: Tree) {
    const packageJsonPath = this.getPrimaryManifestPath();
    if (!tree.exists(packageJsonPath)) {
      throw new Error(
        `The project "${this.projectGraphNode.name}" does not have a package.json available at ${packageJsonPath}.

To fix this you will either need to add a package.json file at that location, or configure "release" within your nx.json to exclude "${this.projectGraphNode.name}" from the current release group, or amend the packageRoot configuration to point to where the package.json should be.`
      );
    }
  }

  async readManifestData(tree: Tree): Promise<ManifestData> {
    const packageJson = readJson(tree, this.getPrimaryManifestPath());
    const dependencies = this.parseDependencies(packageJson);
    return {
      name: packageJson.name,
      currentVersion: packageJson.version,
      dependencies,
    };
  }

  async resolveCurrentVersion(tree: Tree): Promise<string> {
    const packageJsonPath = this.getPrimaryManifestPath();
    try {
      const packageJson = readJson(tree, packageJsonPath);
      return packageJson.version;
    } catch {
      throw new Error(
        `Unable to determine the current version for project "${this.projectGraphNode.name}" from ${packageJsonPath}, please ensure that the "version" field is set within the package.json file`
      );
    }
  }

  async writeVersionToManifest(tree: Tree, newVersion: string) {
    updateJson(tree, this.getPrimaryManifestPath(), (json) => {
      json.version = newVersion;
      return json;
    });
  }

  async updateDependencies(
    tree: Tree,
    dependenciesToUpdate: Record<string, string>
  ) {
    updateJson(tree, this.getPrimaryManifestPath(), (json) => {
      const dependencyTypes = [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ];

      for (const depType of dependencyTypes) {
        if (json[depType]) {
          for (const [dep, version] of Object.entries(dependenciesToUpdate)) {
            if (json[depType][dep]) {
              json[depType][dep] = version;
            }
          }
        }
      }

      return json;
    });
  }

  private parseDependencies(
    packageJson: any
  ): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    const dependencyTypes = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ];

    for (const depType of dependencyTypes) {
      if (packageJson[depType]) {
        result[depType] = {};
        for (const [dep, spec] of Object.entries(packageJson[depType])) {
          const resolvedSpec = resolveVersionSpec(
            dep,
            packageJson.version,
            spec as string,
            this.projectGraphNode.data.root
          );
          result[depType][dep] = resolvedSpec;
        }
      }
    }

    return result;
  }
}
