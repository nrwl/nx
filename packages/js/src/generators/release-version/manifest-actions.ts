import {
  ProjectGraph,
  readJson,
  Tree,
  updateJson,
  workspaceRoot,
} from '@nx/devkit';
import { exec } from 'node:child_process';
import { dirname } from 'node:path';
import { ReleaseVersionGeneratorSchema } from 'nx/src/command-line/release/version';
// TODO: Export from release API before merging
import {
  ManifestActions,
  ManifestData,
} from 'nx/src/command-line/release/version-utils/flexible-version-management';
import { parseRegistryOptions } from '../../utils/npm-config';
import { resolveVersionSpec } from './utils/resolve-version-spec';
import { updateLockFile } from './utils/update-lock-file';
import chalk = require('chalk');

export default class JsManifestActions extends ManifestActions {
  manifestFilename = 'package.json';

  static createAfterAllProjectsVersionedCallback(
    cwd: string,
    opts: {
      dryRun?: boolean;
      verbose?: boolean;
      generatorOptions?: Record<string, unknown>;
    }
  ) {
    return async () => {
      return {
        changedFiles: await updateLockFile(cwd, opts),
        deletedFiles: [],
      };
    };
  }

  async ensureSourceManifestExistsAtExpectedLocation(tree: Tree) {
    const sourcePackageJsonPath = this.getSourceManifestPath();
    if (!tree.exists(sourcePackageJsonPath)) {
      throw new Error(
        `The project "${this.projectGraphNode.name}" does not have a package.json available at ${sourcePackageJsonPath}.

To fix this you will either need to add a package.json file at that location, or configure "release" within your nx.json to exclude "${this.projectGraphNode.name}" from the current release group, or amend the packageRoot configuration to point to where the package.json should be.`
      );
    }
  }

  async readSourceManifestData(tree: Tree): Promise<ManifestData> {
    const sourcePackageJsonPath = this.getSourceManifestPath();
    try {
      const packageJson = readJson(tree, sourcePackageJsonPath);
      const dependencies = this.parseDependencies(packageJson);
      return {
        name: packageJson.name,
        currentVersion: packageJson.version,
        dependencies,
      };
    } catch {
      throw new Error(
        `Unable to read the package.json file at ${sourcePackageJsonPath}, please ensure that the file exists and is valid`
      );
    }
  }

  async readCurrentVersionFromSourceManifest(tree: Tree): Promise<string> {
    const sourcePackageJsonPath = this.getSourceManifestPath();
    try {
      const packageJson = readJson(tree, sourcePackageJsonPath);
      return packageJson.version;
    } catch {
      throw new Error(
        `Unable to determine the current version for project "${this.projectGraphNode.name}" from ${sourcePackageJsonPath}, please ensure that the "version" field is set within the package.json file`
      );
    }
  }

  async readCurrentVersionFromRegistry(
    tree: Tree,
    currentVersionResolverMetadata: ReleaseVersionGeneratorSchema['currentVersionResolverMetadata']
  ): Promise<{
    currentVersion: string;
    logText: string;
  }> {
    const sourceManifestPath = this.getSourceManifestPath();
    const sourceManifestRoot = dirname(sourceManifestPath);
    const packageJson = readJson(tree, sourceManifestPath);
    const packageName = packageJson.name;

    const metadata = currentVersionResolverMetadata;
    const registryArg =
      typeof metadata?.registry === 'string' ? metadata.registry : undefined;
    const tagArg = typeof metadata?.tag === 'string' ? metadata.tag : undefined;

    const warnFn = (message: string) => {
      console.log(chalk.keyword('orange')(message));
    };
    const { registry, tag, registryConfigKey } = await parseRegistryOptions(
      workspaceRoot,
      {
        packageRoot: sourceManifestRoot,
        packageJson,
      },
      {
        registry: registryArg,
        tag: tagArg,
      },
      warnFn
    );

    let currentVersion = null;
    try {
      // Must be non-blocking async to allow spinner to render
      currentVersion = await new Promise<string>((resolve, reject) => {
        exec(
          `npm view ${packageName} version --"${registryConfigKey}=${registry}" --tag=${tag}`,
          {
            windowsHide: false,
          },
          (error, stdout, stderr) => {
            if (error) {
              return reject(error);
            }
            if (stderr) {
              return reject(stderr);
            }
            return resolve(stdout.trim());
          }
        );
      });
    } catch {}

    return {
      currentVersion,
      // Make troubleshooting easier by including the registry and tag data in the log text
      logText: `"${registryConfigKey}=${registry}" tag=${tag}`,
    };
  }

  async getCurrentVersionOfDependency(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependencyProjectName: string
  ): Promise<{
    currentVersion: string | null;
    dependencyCollection: string | null;
  }> {
    const json = readJson(tree, this.getSourceManifestPath());
    // Resolve the package name from the project graph metadata, as it may not match the project name
    const dependencyPackageName =
      projectGraph.nodes[dependencyProjectName].data.metadata?.js?.packageName;
    const dependencyTypes = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ];

    let currentVersion = null;
    let dependencyCollection = null;
    for (const depType of dependencyTypes) {
      if (json[depType] && json[depType][dependencyPackageName]) {
        currentVersion = json[depType][dependencyPackageName];
        dependencyCollection = depType;
        break;
      }
    }
    return {
      currentVersion,
      dependencyCollection,
    };
  }

  async writeVersionToManifests(tree: Tree, newVersion: string): Promise<void> {
    for (const manifestPath of this.manifestsToUpdate) {
      updateJson(tree, manifestPath, (json) => {
        json.version = newVersion;
        return json;
      });
    }
  }

  async updateDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ) {
    for (const manifestPath of this.manifestsToUpdate) {
      updateJson(tree, manifestPath, (json) => {
        const dependencyTypes = [
          'dependencies',
          'devDependencies',
          'peerDependencies',
          'optionalDependencies',
        ];

        for (const depType of dependencyTypes) {
          if (json[depType]) {
            for (const [dep, version] of Object.entries(dependenciesToUpdate)) {
              // Resolve the package name from the project graph metadata, as it may not match the project name
              const packageName =
                projectGraph.nodes[dep].data.metadata?.js?.packageName;
              if (!packageName) {
                throw new Error(
                  `Unable to determine the package name for project "${dep}" from the project graph metadata, please ensure that the "@nx/js" plugin is installed and the project graph has been built. If the issue persists, please report this issue on https://github.com/nrwl/nx/issues`
                );
              }
              if (json[depType][packageName]) {
                json[depType][packageName] = version;
              }
            }
          }
        }

        return json;
      });
    }
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
