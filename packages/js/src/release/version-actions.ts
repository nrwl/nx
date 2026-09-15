import { getCatalogManager, safeSpawn } from '@nx/devkit/internal';
import {
  detectPackageManager,
  PackageManager,
  parseJson,
  ProjectGraph,
  readJson,
  Tree,
  workspaceRoot,
} from '@nx/devkit';
import { join } from 'node:path';
import { applyEdits, FormattingOptions, modify } from 'jsonc-parser';
import { validRange } from 'semver';
import { VersionActions } from 'nx/release';
import type { ResolveVersionForDependency } from 'nx/release';
import type {
  AfterAllProjectsVersioned,
  NxReleaseVersionConfiguration,
} from '@nx/devkit/internal';
import { parseRegistryOptions } from '../utils/npm-config';
import { updateLockFile } from './utils/update-lock-file';
import chalk = require('chalk');
import { isMatchingDependencyRange, isValidRange } from './utils/semver';

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
      options: rootVersionActionsOptions,
    }),
    deletedFiles: [],
  };
};

type LocalDependencyProject = {
  projectName: string;
};

// Cache at the module level to avoid re-detecting the package manager for each instance
let pm: PackageManager | undefined;
// Every project in a release receives the same ProjectGraph. Building these
// indexes once avoids turning dependency updates into quadratic graph scans.
const localDependencyProjectsByGraph = new WeakMap<
  ProjectGraph,
  Map<string, LocalDependencyProject>
>();

export default class JsVersionActions extends VersionActions {
  validManifestFilenames = ['package.json'];
  excludeManifestsFromFormatting = true;

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
        // registry and tag come from the workspace .npmrc, so they reach npm as
        // arguments rather than through a shell.
        const child = safeSpawn(
          'npm',
          [
            'view',
            packageName,
            'version',
            `--${registryConfigKey}=${registry}`,
            `--tag=${tag}`,
          ],
          { stdio: ['ignore', 'pipe', 'pipe'] }
        );
        let stdout = '';
        let stderr = '';
        child.stdout
          .setEncoding('utf-8')
          .on('data', (chunk) => (stdout += chunk));
        child.stderr
          .setEncoding('utf-8')
          .on('data', (chunk) => (stderr += chunk));
        child.on('error', reject);
        child.on('close', (code) => {
          if (code !== 0) {
            return reject(
              new Error(`npm view ${packageName} exited with code ${code}`)
            );
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
        });
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
    const dependencyTypes = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ];
    const dependencyPackageName =
      projectGraph.nodes[dependencyProjectName]?.data.metadata?.js?.packageName;

    let currentVersion = null;
    let dependencyCollection = null;
    if (dependencyPackageName) {
      for (const depType of dependencyTypes) {
        if (json[depType]?.[dependencyPackageName]) {
          currentVersion = json[depType][dependencyPackageName];
          dependencyCollection = depType;
          break;
        }
      }
    }

    // Resolve catalog references if needed
    if (currentVersion && dependencyPackageName) {
      const catalogManager = getCatalogManager(tree.root);
      if (catalogManager?.isCatalogReference(currentVersion)) {
        currentVersion = catalogManager.resolveCatalogReference(
          tree,
          dependencyPackageName,
          currentVersion
        );
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
      this.updateManifestValues(tree, manifestToUpdate.manifestPath, [
        { path: ['version'], value: newVersion },
      ]);
      logMessages.push(
        `✍️  New version ${newVersion} written to manifest: ${manifestToUpdate.manifestPath}`
      );
    }
    return logMessages;
  }

  async updateProjectDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>,
    resolveVersionForDependency?: ResolveVersionForDependency
  ): Promise<string[]> {
    if (
      Object.keys(dependenciesToUpdate).length === 0 &&
      !resolveVersionForDependency
    ) {
      return [];
    }

    const dependencyTypes = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ];
    const localDependencyProjects =
      this.getLocalDependencyProjectLookup(projectGraph);
    for (const projectName of Object.keys(dependenciesToUpdate)) {
      if (!projectGraph.nodes[projectName]?.data.metadata?.js?.packageName) {
        throw new Error(
          `Unable to determine the package name for project "${projectName}" from the project graph metadata, please ensure that the "@nx/js" plugin is installed and the project graph has been built. If the issue persists, please report this issue on https://github.com/nrwl/nx/issues`
        );
      }
    }

    const resolvedVersions = new Map<string, Promise<string>>();
    const resolveVersion = (projectName: string): Promise<string> => {
      let resolution = resolvedVersions.get(projectName);
      if (!resolution) {
        if (!resolveVersionForDependency) {
          throw new Error(
            `No version resolver was provided for dependency project "${projectName}".`
          );
        }
        resolution = resolveVersionForDependency(projectName);
        resolvedVersions.set(projectName, resolution);
      }
      return resolution;
    };

    const manifestUpdates: Array<{
      manifestPath: string;
      updates: Array<{ path: string[]; value: string }>;
    }> = [];
    const catalogUpdates: Array<{
      packageName: string;
      version: string;
      catalogName?: string;
    }> = [];
    const catalogManager = getCatalogManager(tree.root);

    for (const manifestToUpdate of this.manifestsToUpdate) {
      const json = readJson(tree, manifestToUpdate.manifestPath);
      const updates: Array<{
        path: string[];
        value: string;
      }> = [];

      const preserveMatchingDependencyRanges =
        this.finalConfigForProject.preserveMatchingDependencyRanges === true
          ? dependencyTypes
          : this.finalConfigForProject.preserveMatchingDependencyRanges ===
              false
            ? []
            : this.finalConfigForProject.preserveMatchingDependencyRanges ||
              dependencyTypes;

      for (const depType of dependencyTypes) {
        if (json[depType]) {
          for (const [dependencyName, currentVersion] of Object.entries<string>(
            json[depType]
          )) {
            const targetProject = localDependencyProjects.get(dependencyName);
            if (!targetProject) {
              continue;
            }

            let version = dependenciesToUpdate[targetProject.projectName];
            if (version !== undefined) {
              if (catalogManager?.isCatalogReference(currentVersion)) {
                // collect the catalog updates so we can update the catalog definitions later
                const catalogRef =
                  catalogManager.parseCatalogReference(currentVersion)!;
                catalogUpdates.push({
                  packageName: dependencyName,
                  version,
                  catalogName: catalogRef.catalogName,
                });
                continue;
              }

              if (
                manifestToUpdate.preserveLocalDependencyProtocols &&
                this.isLocalDependencyProtocol(currentVersion)
              ) {
                continue;
              }

              if (this.isLocalDependencyProtocol(currentVersion)) {
                version = this.applyVersionPrefix(currentVersion, version);
              }

              if (
                preserveMatchingDependencyRanges.includes(depType) &&
                !this.isLocalDependencyProtocol(currentVersion)
              ) {
                // If the dependency is specified using a range, do some additional processing to determine whether to update the version
                if (
                  isValidRange(currentVersion) &&
                  !isMatchingDependencyRange(version, currentVersion)
                ) {
                  throw new Error(
                    `"preserveMatchingDependencyRanges" is enabled for "${depType}" and the new version "${version}" is outside the current range for "${dependencyName}" in manifest "${manifestToUpdate.manifestPath}". Please update the range before releasing.`
                  );
                } else if (isValidRange(currentVersion)) {
                  continue;
                }
              }
            } else if (
              resolveVersionForDependency &&
              !manifestToUpdate.preserveLocalDependencyProtocols &&
              this.isLocalDependencyProtocol(currentVersion)
            ) {
              try {
                version = await this.resolveLocalDependencySpecifier(
                  dependencyName,
                  currentVersion,
                  targetProject,
                  resolveVersion
                );
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : String(error);
                throw new Error(
                  `Unable to replace local dependency protocol "${currentVersion}" for "${dependencyName}" in manifest "${manifestToUpdate.manifestPath}". ${message}`
                );
              }
            }

            if (version !== undefined) {
              updates.push({
                path: [depType, dependencyName],
                value: version,
              });
            }
          }
        }
      }

      manifestUpdates.push({
        manifestPath: manifestToUpdate.manifestPath,
        updates,
      });
    }

    // Resolve every requested version before writing any manifest so one
    // failed resolver cannot leave a partially updated set of manifests.
    const logMessages: string[] = [];
    for (const manifestUpdate of manifestUpdates) {
      this.updateManifestValues(
        tree,
        manifestUpdate.manifestPath,
        manifestUpdate.updates
      );
      if (manifestUpdate.updates.length > 0) {
        const depText =
          manifestUpdate.updates.length === 1 ? 'dependency' : 'dependencies';
        logMessages.push(
          `✍️  Updated ${manifestUpdate.updates.length} ${depText} in manifest: ${manifestUpdate.manifestPath}`
        );
      }
    }

    // Update catalog definitions in the package manager's catalog file
    if (catalogUpdates.length > 0) {
      // catalogManager is guaranteed to be defined when there are catalog updates
      catalogManager!.updateCatalogVersions(tree, catalogUpdates);

      const catalogText = catalogUpdates.length === 1 ? 'entry' : 'entries';
      logMessages.push(
        `✍️  Updated ${catalogUpdates.length} catalog ${catalogText} in ${catalogManager!
          .getCatalogDefinitionFilePaths()
          .join(', ')}`
      );
    }

    return logMessages;
  }

  private getLocalDependencyProjectLookup(
    projectGraph: ProjectGraph
  ): Map<string, LocalDependencyProject> {
    let lookup = localDependencyProjectsByGraph.get(projectGraph);
    if (lookup) {
      return lookup;
    }

    // This lookup requires the dependency key to match the package name.
    // Package aliases need relationship-specific manifest data that the
    // project graph does not retain. Support is tracked in
    // https://github.com/nrwl/nx/issues/36630.
    lookup = new Map<string, LocalDependencyProject>();
    for (const [projectName, node] of Object.entries(projectGraph.nodes)) {
      const packageName = node.data.metadata?.js?.packageName;
      if (!packageName) {
        continue;
      }
      lookup.set(packageName, { projectName });
    }
    localDependencyProjectsByGraph.set(projectGraph, lookup);
    return lookup;
  }

  private async resolveLocalDependencySpecifier(
    dependencyName: string,
    versionSpecifier: string,
    targetProject: LocalDependencyProject,
    resolveVersion: (projectName: string) => Promise<string>
  ): Promise<string> {
    if (versionSpecifier.startsWith('file:')) {
      const resolvedVersion = await resolveVersion(targetProject.projectName);
      return this.applyVersionPrefix(versionSpecifier, resolvedVersion);
    }

    const range = versionSpecifier.slice('workspace:'.length);

    if (
      range !== '' &&
      range !== '*' &&
      range !== '^' &&
      range !== '~' &&
      validRange(range) !== null
    ) {
      return range;
    }

    const isRelativePath = range.startsWith('.');
    if (
      !isRelativePath &&
      range !== '' &&
      range !== '*' &&
      range !== '^' &&
      range !== '~'
    ) {
      throw new Error(
        `The workspace protocol used by "${dependencyName}" is not a supported range or relative workspace path.`
      );
    }

    const resolvedVersion = await resolveVersion(targetProject.projectName);
    return this.applyVersionPrefix(
      isRelativePath ? 'workspace:*' : `workspace:${range}`,
      resolvedVersion
    );
  }

  private applyVersionPrefix(
    versionSpecifier: string,
    resolvedVersion: string
  ): string {
    const configuredPrefix = this.finalConfigForProject.versionPrefix;
    let prefix = '';
    if (
      configuredPrefix === '~' ||
      configuredPrefix === '^' ||
      configuredPrefix === '='
    ) {
      prefix = configuredPrefix;
    } else if (
      configuredPrefix === 'auto' &&
      versionSpecifier.startsWith('workspace:')
    ) {
      const range = versionSpecifier.slice('workspace:'.length);
      if (range.startsWith('^')) {
        prefix = '^';
      } else if (range.startsWith('~')) {
        prefix = '~';
      }
    }
    return `${prefix}${resolvedVersion.replace(/^[~^=]/, '')}`;
  }

  private updateManifestValues(
    tree: Tree,
    manifestPath: string,
    updates: Array<{ path: string[]; value: string }>
  ): void {
    if (updates.length === 0) {
      return;
    }
    let content = this.readAndValidateManifest(tree, manifestPath);
    const formattingOptions = this.detectFormattingOptions(content);
    for (const update of updates) {
      content = applyEdits(
        content,
        modify(content, update.path, update.value, { formattingOptions })
      );
    }
    this.validateManifestUpdates(content, manifestPath, updates);
    tree.write(manifestPath, content);
  }

  private readAndValidateManifest(tree: Tree, manifestPath: string): string {
    const content = tree.read(manifestPath, 'utf-8');
    try {
      // Match readJson's support for comments and trailing commas while
      // retaining the original text for targeted edits.
      parseJson(content);
    } catch (error) {
      throw new Error(`Cannot parse ${manifestPath}: ${error.message}`);
    }
    return content;
  }

  private validateManifestUpdates(
    content: string,
    manifestPath: string,
    updates: Array<{ path: string[]; value: string }>
  ): void {
    const manifest = parseJson(content);
    for (const update of updates) {
      let actualValue: unknown = manifest;
      for (const pathSegment of update.path) {
        if (
          actualValue === null ||
          typeof actualValue !== 'object' ||
          !(pathSegment in actualValue)
        ) {
          actualValue = undefined;
          break;
        }
        actualValue = (actualValue as Record<string, unknown>)[pathSegment];
      }
      if (actualValue !== update.value) {
        throw new Error(
          `Cannot update ${manifestPath}: "${update.path.join(
            '.'
          )}" resolves to ${JSON.stringify(
            actualValue
          )} instead of ${JSON.stringify(
            update.value
          )} after editing. The manifest may contain duplicate keys.`
        );
      }
    }
  }

  private detectFormattingOptions(content: string): FormattingOptions {
    const indentation = content.match(/^[\t ]+(?=")/m)?.[0] ?? '  ';
    const insertSpaces = !indentation.includes('\t');

    return {
      insertSpaces,
      tabSize: insertSpaces ? indentation.length : 1,
    };
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
