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
import { join } from 'node:path';
import { AfterAllProjectsVersioned, VersionActions } from 'nx/release';
import type { NxReleaseVersionConfiguration } from 'nx/src/config/nx-json';
import { parseRegistryOptions } from '../utils/npm-config';
import { updateLockFile } from './utils/update-lock-file';
import chalk = require('chalk');
import { isRange, satisfiesRange } from './utils/semver';

export const afterAllProjectsVersioned: AfterAllProjectsVersioned = async (
  cwd: string,
  {
    rootVersionActionsOptions,
    ...opts
  }: {
    dryRun?: boolean;
    verbose?: boolean;
    rootVersionActionsOptions?: Record<string, unknown>;
  }
) => {
  return {
    changedFiles: await updateLockFile(cwd, {
      ...opts,
      useLegacyVersioning: false,
      options: rootVersionActionsOptions,
    }),
    deletedFiles: [],
  };
};

// Cache at the module level to avoid re-detecting the package manager for each instance
let pm: PackageManager | undefined;

export default class JsVersionActions extends VersionActions {
  validManifestFilenames = ['package.json'];

  async readCurrentVersionFromSourceManifest(tree: Tree): Promise<{
    currentVersion: string;
    manifestPath: string;
  }> {
    const sourcePackageJsonPath = join(
      this.projectGraphNode.data.root,
      'package.json'
    );
    try {
      const packageJson = readJson(tree, sourcePackageJsonPath);
      return {
        manifestPath: sourcePackageJsonPath,
        currentVersion: packageJson.version,
      };
    } catch {
      throw new Error(
        `Unable to determine the current version for project "${this.projectGraphNode.name}" from ${sourcePackageJsonPath}, please ensure that the "version" field is set within the package.json file`
      );
    }
  }

  async readCurrentVersionFromRegistry(
    tree: Tree,
    currentVersionResolverMetadata: NxReleaseVersionConfiguration['currentVersionResolverMetadata']
  ): Promise<{
    currentVersion: string;
    logText: string;
  }> {
    const sourcePackageJsonPath = join(
      this.projectGraphNode.data.root,
      'package.json'
    );
    const packageJson = readJson(tree, sourcePackageJsonPath);
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
        packageRoot: this.projectGraphNode.data.root,
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
            // Only reject on stderr if it contains actual errors, not just npm warnings
            // npm 11+ writes "npm warn" messages to stderr even on successful commands
            if (
              stderr &&
              !stderr
                .trim()
                .split('\n')
                .every((line) => line.startsWith('npm warn'))
            ) {
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

  async readCurrentVersionOfDependency(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependencyProjectName: string
  ): Promise<{
    currentVersion: string | null;
    dependencyCollection: string | null;
  }> {
    const sourcePackageJsonPath = join(
      this.projectGraphNode.data.root,
      'package.json'
    );
    const json = readJson(tree, sourcePackageJsonPath);
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

  async updateProjectVersion(
    tree: Tree,
    newVersion: string
  ): Promise<string[]> {
    const logMessages: string[] = [];
    for (const manifestToUpdate of this.manifestsToUpdate) {
      updateJson(tree, manifestToUpdate.manifestPath, (json) => {
        json.version = newVersion;
        return json;
      });
      logMessages.push(
        `✍️  New version ${newVersion} written to manifest: ${manifestToUpdate.manifestPath}`
      );
    }
    return logMessages;
  }

  async updateProjectDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ): Promise<string[]> {
    let numDependenciesToUpdate = Object.keys(dependenciesToUpdate).length;
    if (numDependenciesToUpdate === 0) {
      return [];
    }

    const logMessages: string[] = [];
    for (const manifestToUpdate of this.manifestsToUpdate) {
      updateJson(tree, manifestToUpdate.manifestPath, (json) => {
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
              const currentVersion = json[depType][packageName];
              if (currentVersion) {
                // Check if the local dependency protocol should be preserved or not
                if (
                  manifestToUpdate.preserveLocalDependencyProtocols &&
                  this.isLocalDependencyProtocol(currentVersion)
                ) {
                  // Reduce the count appropriately to avoid confusing user-facing logs
                  numDependenciesToUpdate--;
                  continue;
                } else if (
                  depType === 'peerDependencies' &&
                  !this.isLocalDependencyProtocol(currentVersion) &&
                  isRange(currentVersion)
                ) {
                  // If peerDependency with a range, do some additional processing to determine whether to update the version
                  if (satisfiesRange(version, currentVersion)) {
                    // If the current version is a valid range, then we should not update it
                    continue;
                  } else {
                    throw new Error(
                      `The version "${version}" is not a valid range for peerDependency "${packageName}" in manifest "${manifestToUpdate.manifestPath}". Please update to a valid range.`
                    );
                  }
                }
                json[depType][packageName] = version;
              }
            }
          }
        }

        return json;
      });

      // If we ignored local dependecy protocols, then we could have dynamically ended up with zero here and we should not log anything related to dependencies
      if (numDependenciesToUpdate === 0) {
        return [];
      }

      const depText =
        numDependenciesToUpdate === 1 ? 'dependency' : 'dependencies';

      logMessages.push(
        `✍️  Updated ${numDependenciesToUpdate} ${depText} in manifest: ${manifestToUpdate.manifestPath}`
      );
    }
    return logMessages;
  }

  // NOTE: The TODOs were carried over from the original implementation, they are not yet implemented
  private isLocalDependencyProtocol(versionSpecifier: string): boolean {
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
}
