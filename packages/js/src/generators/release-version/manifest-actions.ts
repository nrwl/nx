import {
  detectPackageManager,
  PackageManager,
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

// Cache at the module level to avoid re-detecting the package manager for each instance
let pm: PackageManager | undefined;

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

  isLocalDependencyProtocol(versionSpecifier: string): boolean {
    const localPackageProtocols = [
      'file:', // all package managers
      'workspace:', // not npm
      // TODO: Support portal protocol at the project graph level before enabling here
      // 'portal:', // modern yarn only
    ];

    // Not using a supported local protocol
    if (
      !localPackageProtocols.some((protocol) =>
        versionSpecifier.startsWith(protocol)
      )
    ) {
      return false;
    }
    // Supported by all package managers
    if (versionSpecifier.startsWith('file:')) {
      return true;
    }
    // Determine specific package manager in use
    if (!pm) {
      pm = detectPackageManager();
      // pmVersion = getPackageManagerVersion(pm);
    }
    if (pm === 'npm' && versionSpecifier.startsWith('workspace:')) {
      throw new Error(
        `The "workspace:" protocol is not yet supported by npm (https://github.com/npm/rfcs/issues/765). Please ensure you have a valid setup according to your package manager before attempting to release packages.`
      );
    }
    // TODO: Support portal protocol at the project graph level before enabling here
    // if (
    //   version.startsWith('portal:') &&
    //   (pm !== 'yarn' || lt(pmVersion, '2.0.0'))
    // ) {
    //   throw new Error(
    //     `The "portal:" protocol is only supported by yarn@2.0.0 and above. Please ensure you have a valid setup according to your package manager before attempting to release packages.`
    //   );
    // }
    return true;
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
    packageJson: Record<string, unknown>
  ): Record<
    string,
    Record<string, { resolvedVersion: string; rawVersionSpec: string }>
  > {
    const result: Record<
      string, // dependency collection
      Record<
        string, // dependency name
        {
          resolvedVersion: string;
          rawVersionSpec: string;
        }
      >
    > = {};
    const dependencyCollections = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ];

    for (const depCollection of dependencyCollections) {
      if (packageJson[depCollection]) {
        result[depCollection] = {};
        for (const [dep, spec] of Object.entries(packageJson[depCollection])) {
          const resolvedSpec = resolveVersionSpec(
            dep,
            packageJson.version as string,
            spec as string,
            this.projectGraphNode.data.root
          );
          result[depCollection][dep] = {
            resolvedVersion: resolvedSpec,
            rawVersionSpec: spec,
          };
        }
      }
    }

    return result;
  }
}
