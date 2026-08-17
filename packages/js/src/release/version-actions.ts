import {
  getCatalogManager,
  parseDependencySpecifier,
} from '@nx/devkit/internal';
import type { ParsedDependencySpecifier } from '@nx/devkit/internal';
import {
  detectPackageManager,
  PackageManager,
  parseJson,
  ProjectGraph,
  readJson,
  Tree,
  workspaceRoot,
} from '@nx/devkit';
import { exec } from 'node:child_process';
import { join } from 'node:path';
import { applyEdits, FormattingOptions, modify } from 'jsonc-parser';
import { VersionActions } from 'nx/release';
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

// Cache at the module level to avoid re-detecting the package manager for each instance
let pm: PackageManager | undefined;

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
        exec(
          `npm view ${packageName} version --"${registryConfigKey}=${registry}" --tag=${tag}`,
          {
            windowsHide: true,
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
      if (!json[depType]) {
        continue;
      }
      const entries = findDependencyEntriesForPackage(
        json[depType],
        dependencyPackageName
      ).filter((entry) => getEntryVersionSpec(entry));
      if (entries.length === 0) {
        continue;
      }
      // Prefer the entry keyed by the package name itself over aliased entries
      const entry =
        entries.find((e) => e.key === dependencyPackageName) ?? entries[0];
      currentVersion = getEntryVersionSpec(entry);
      dependencyCollection = depType;
      break;
    }

    // Resolve catalog references if needed
    if (currentVersion) {
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
    dependenciesToUpdate: Record<string, string>
  ): Promise<string[]> {
    if (Object.keys(dependenciesToUpdate).length === 0) {
      return [];
    }

    const logMessages: string[] = [];
    const catalogUpdates: Array<{
      packageName: string;
      version: string;
      catalogName?: string;
    }> = [];
    const catalogManager = getCatalogManager(tree.root);

    for (const manifestToUpdate of this.manifestsToUpdate) {
      const json = readJson(tree, manifestToUpdate.manifestPath);
      const manifestUpdates: Array<{
        path: string[];
        value: string;
      }> = [];
      const dependencyTypes = [
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
      ];

      const preserveMatchingDependencyRanges =
        this.finalConfigForProject.preserveMatchingDependencyRanges === true
          ? dependencyTypes
          : this.finalConfigForProject.preserveMatchingDependencyRanges ===
              false
            ? []
            : this.finalConfigForProject.preserveMatchingDependencyRanges ||
              dependencyTypes;

      // Per-manifest count so that skips in one manifest (e.g. preserved local
      // protocols, which are configurable per manifest) do not affect the
      // user-facing logs of the others
      let numDependenciesToUpdate = Object.keys(dependenciesToUpdate).length;

      for (const [dep, version] of Object.entries(dependenciesToUpdate)) {
        const collections = dependencyTypes.filter((depType) => json[depType]);
        if (collections.length === 0) {
          continue;
        }
        // Resolve the package name from the project graph metadata, as it may not match the project name
        const packageName =
          projectGraph.nodes[dep].data.metadata?.js?.packageName;
        if (!packageName) {
          throw new Error(
            `Unable to determine the package name for project "${dep}" from the project graph metadata, please ensure that the "@nx/js" plugin is installed and the project graph has been built. If the issue persists, please report this issue on https://github.com/nrwl/nx/issues`
          );
        }
        let updatedEntries = 0;
        let skippedEntries = 0;
        for (const depType of collections) {
          const entries = findDependencyEntriesForPackage(
            json[depType],
            packageName
          );
          for (const entry of entries) {
            const rawSpecifier = entry.rawSpecifier;
            if (catalogManager?.isCatalogReference(rawSpecifier)) {
              // collect the catalog updates so we can update the catalog definitions later
              const catalogRef =
                catalogManager.parseCatalogReference(rawSpecifier)!;
              catalogUpdates.push({
                packageName,
                version,
                catalogName: catalogRef.catalogName,
              });

              skippedEntries++;
              continue;
            }
            // Check if other local dependency protocols should be preserved
            if (
              manifestToUpdate.preserveLocalDependencyProtocols &&
              this.isLocalDependencyProtocol(rawSpecifier)
            ) {
              skippedEntries++;
              continue;
            }
            const isAlias = entry.parsed.requestedPackageName !== null;
            const versionSpec = getEntryVersionSpec(entry);
            // Nothing to rewrite for an empty version spec: an aliased entry
            // without an inner range (e.g. npm:pkg) floats to the latest version
            if (!versionSpec) {
              continue;
            }
            // With versionPrefix "auto" each declaration keeps its own prefix.
            // The received version carries the prefix of the one entry that was
            // read for the dependency, so re-derive it per entry
            let entryVersion = version;
            if (this.finalConfigForProject.versionPrefix === 'auto') {
              const prefix = versionSpec.match(/^([~^=])/)?.[1] ?? '';
              entryVersion = `${prefix}${version.replace(/^[~^=]/, '')}`;
            }
            if (
              preserveMatchingDependencyRanges.includes(depType) &&
              !this.isLocalDependencyProtocol(rawSpecifier)
            ) {
              // If the dependency is specified using a range, do some additional processing to determine whether to update the version
              if (
                isValidRange(versionSpec) &&
                !isMatchingDependencyRange(entryVersion, versionSpec)
              ) {
                throw new Error(
                  `"preserveMatchingDependencyRanges" is enabled for "${depType}" and the new version "${entryVersion}" is outside the current range for "${packageName}" in manifest "${manifestToUpdate.manifestPath}". Please update the range before releasing.`
                );
              } else if (isValidRange(versionSpec)) {
                // it is a range, but it is valid
                continue;
              }
            }
            manifestUpdates.push({
              path: [depType, entry.key],
              // Only the inner range of an aliased entry is versioned; keep the
              // requested package name and use the registry-compatible npm
              // protocol (a workspace alias only gets here when local
              // protocols are not preserved)
              value: isAlias
                ? `npm:${packageName}@${entryVersion}`
                : entryVersion,
            });
            updatedEntries++;
          }
        }
        // Reduce the count appropriately to avoid confusing user-facing logs
        if (updatedEntries === 0 && skippedEntries > 0) {
          numDependenciesToUpdate--;
        }
      }

      this.updateManifestValues(
        tree,
        manifestToUpdate.manifestPath,
        manifestUpdates
      );

      // If we ignored local dependecy protocols, then we could have dynamically ended up with zero here and we should not log anything related to dependencies
      if (numDependenciesToUpdate > 0) {
        const depText =
          numDependenciesToUpdate === 1 ? 'dependency' : 'dependencies';

        logMessages.push(
          `✍️  Updated ${numDependenciesToUpdate} ${depText} in manifest: ${manifestToUpdate.manifestPath}`
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

interface ManifestDependencyEntry {
  key: string;
  rawSpecifier: string;
  parsed: ParsedDependencySpecifier;
}

/**
 * Finds the entries in a manifest dependency collection that reference the
 * given package: the entry keyed by the package name, plus any aliased entries
 * (`"key": "workspace:<name>@<range>"`, `"key": "npm:<name>[@<range>]"`) whose
 * requested package is the given one. An entry keyed by the package name but
 * aliasing a different package references that other package, not this one.
 */
function findDependencyEntriesForPackage(
  dependencies: Record<string, unknown>,
  packageName: string
): ManifestDependencyEntry[] {
  const entries: ManifestDependencyEntry[] = [];
  for (const [key, rawSpecifier] of Object.entries(dependencies)) {
    if (typeof rawSpecifier !== 'string') {
      continue;
    }
    const parsed = parseDependencySpecifier(rawSpecifier);
    if ((parsed.requestedPackageName ?? key) === packageName) {
      entries.push({ key, rawSpecifier, parsed });
    }
  }
  return entries;
}

/**
 * The versioned part of a manifest dependency entry: the inner range for
 * aliased entries (`^1.0.0` in `workspace:pkg@^1.0.0`), the raw specifier
 * otherwise.
 */
function getEntryVersionSpec(entry: ManifestDependencyEntry): string | null {
  return entry.parsed.requestedPackageName !== null
    ? entry.parsed.range
    : entry.rawSpecifier;
}
