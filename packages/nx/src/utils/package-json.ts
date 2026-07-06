import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

const execAsync = promisify(exec);
import { dirSync } from 'tmp';
import { NxJsonConfiguration } from '../config/nx-json';
import {
  ProjectConfiguration,
  ProjectMetadata,
  TargetConfiguration,
} from '../config/workspace-json-project-json';
import type { Tree } from '../generators/tree';
import { readJson } from '../generators/utils/json';
import { readTargetDefaultsForTarget } from '../project-graph/utils/project-configuration-utils';
import { mergeTargetConfigurations } from '../project-graph/utils/project-configuration/target-merging';
import { getCatalogManager } from './catalog';
import { readJsonFile, readYamlFile } from './fileutils';
import { logger } from './logger';
import { hasNxJsPlugin } from './has-nx-js-plugin';
import { getNxRequirePaths } from './installation-directory';
import {
  createTempNpmDirectory,
  detectPackageManager,
  getPackageManagerCommand,
  getPackageManagerVersion,
  PackageManager,
  PackageManagerCommands,
} from './package-manager';
import { workspaceRoot } from './workspace-root';

export interface NxProjectPackageJsonConfiguration
  extends Partial<ProjectConfiguration> {
  includedScripts?: string[];
}

export type ArrayPackageGroup = { package: string; version: string }[];
export type MixedPackageGroup =
  | (string | { package: string; version: string })[]
  | Record<string, string>;
export type PackageGroup = MixedPackageGroup | ArrayPackageGroup;

export type PackageJsonDependencySection =
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'optionalDependencies';

export interface NxMigrationsConfiguration {
  migrations?: string;
  packageGroup?: PackageGroup;
  /** Signals the package supports `nx migrate --include`. */
  supportsOptionalMigrations?: boolean;
}

type PackageOverride = { [key: string]: string | PackageOverride };

export interface PackageJson {
  // Generic Package.Json Configuration
  name: string;
  version: string;
  license?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  type?: 'module' | 'commonjs';
  main?: string;
  types?: string;
  // interchangeable with `types`: https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html#including-declarations-in-your-npm-package
  typings?: string;
  module?: string;
  exports?:
    | string
    | Record<
        string,
        | string
        | {
            types?: string;
            require?: string;
            import?: string;
            development?: string;
            default?: string;
          }
      >;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: boolean }>;
  resolutions?: Record<string, string>;
  pnpm?: {
    overrides?: PackageOverride;
    onlyBuiltDependencies?: string[];
    neverBuiltDependencies?: string[];
    allowBuilds?: Record<string, boolean>;
    supportedArchitectures?: {
      os?: string[];
      cpu?: string[];
      libc?: string[];
    };
    ignoredOptionalDependencies?: string[];
    packageExtensions?: Record<string, unknown>;
    patchedDependencies?: Record<string, string>;
  };
  overrides?: PackageOverride;
  // npm install-script allowlist (npm 11.16+). Keys are `name`, `name@version`,
  // or git specs; `true` approves, `false` denies.
  allowScripts?: Record<string, boolean>;
  bin?: Record<string, string> | string;
  workspaces?:
    | string[]
    | {
        packages: string[];
      };
  publishConfig?: Record<string, string>;
  files?: string[];

  // Nx Project Configuration
  nx?: NxProjectPackageJsonConfiguration;

  // Nx Plugin Configuration
  generators?: string;
  schematics?: string;
  builders?: string;
  executors?: string;
  'nx-migrations'?: string | NxMigrationsConfiguration;
  'ng-update'?: string | NxMigrationsConfiguration;
  packageManager?: string;
  description?: string;
  keywords?: string[];
}

export interface NxPackageJson extends PackageJson {
  'nx-migrations'?: {
    migrations?: string;
    packageGroup?: (string | { package: string; version: string })[];
    supportsOptionalMigrations?: boolean;
  };
}

export function normalizePackageGroup(
  packageGroup: PackageGroup
): ArrayPackageGroup {
  return Array.isArray(packageGroup)
    ? packageGroup.map((x) =>
        typeof x === 'string' ? { package: x, version: '*' } : x
      )
    : Object.entries(packageGroup).map(([pkg, version]) => ({
        package: pkg,
        version,
      }));
}

export function readNxMigrateConfig(
  json: Partial<PackageJson>
): NxMigrationsConfiguration & { packageGroup?: ArrayPackageGroup } {
  const parseNxMigrationsConfig = (
    fromJson?: string | NxMigrationsConfiguration
  ): NxMigrationsConfiguration & { packageGroup?: ArrayPackageGroup } => {
    if (!fromJson) {
      return {};
    }
    if (typeof fromJson === 'string') {
      return { migrations: fromJson, packageGroup: [] };
    }

    return {
      ...(fromJson.migrations ? { migrations: fromJson.migrations } : {}),
      ...(fromJson.packageGroup
        ? { packageGroup: normalizePackageGroup(fromJson.packageGroup) }
        : {}),
      ...(fromJson.supportsOptionalMigrations
        ? { supportsOptionalMigrations: true }
        : {}),
    };
  };

  return {
    ...parseNxMigrationsConfig(json['ng-update']),
    ...parseNxMigrationsConfig(json['nx-migrations']),
    // In case there's a `migrations` field in `package.json`
    ...parseNxMigrationsConfig(json as any),
  };
}

export function buildTargetFromScript(
  script: string,
  scripts: Record<string, string> = {},
  packageManagerCommand: PackageManagerCommands
): TargetConfiguration {
  return {
    executor: 'nx:run-script',
    options: {
      script,
    },
    metadata: {
      scriptContent: scripts[script],
      runCommand: packageManagerCommand.run(script),
    },
  };
}

export type PackageJsonProjectMetadata = {
  targetGroups: {
    'NPM Scripts'?: Array<string>;
  };
  description: string;
  js: {
    packageName: PackageJson['name'];
    packageVersion: PackageJson['version'];
    packageExports: PackageJson['exports'];
    packageMain: PackageJson['main'];
    isInPackageManagerWorkspaces: boolean;
  };
};

export function getMetadataFromPackageJson(
  packageJson: PackageJson,
  isInPackageManagerWorkspaces: boolean
): ProjectMetadata {
  const { scripts, nx, description, name, exports, main, version } =
    packageJson;
  const includedScripts = nx?.includedScripts || Object.keys(scripts ?? {});
  const metadata: PackageJsonProjectMetadata = {
    targetGroups: includedScripts.length
      ? {
          'NPM Scripts': includedScripts,
        }
      : {},
    description,
    js: {
      packageName: name,
      packageVersion: version,
      packageExports: exports,
      packageMain: main,
      isInPackageManagerWorkspaces,
    },
  };
  return metadata satisfies ProjectMetadata;
}

export function getTagsFromPackageJson(packageJson: PackageJson): string[] {
  const tags = packageJson.private ? ['npm:private'] : ['npm:public'];
  if (packageJson.keywords?.length) {
    tags.push(...packageJson.keywords.map((k) => `npm:${k}`));
  }
  if (packageJson?.nx?.tags?.length) {
    tags.push(...packageJson?.nx.tags);
  }
  return tags;
}

export function readTargetsFromPackageJson(
  packageJson: PackageJson,
  nxJson: NxJsonConfiguration,
  projectRoot: string,
  workspaceRoot: string,
  packageManagerCommand: PackageManagerCommands
) {
  const { scripts, nx, private: isPrivate } = packageJson ?? {};
  const res: Record<string, TargetConfiguration> = {};
  const includedScripts = nx?.includedScripts || Object.keys(scripts ?? {});
  for (const script of includedScripts) {
    res[script] = buildTargetFromScript(script, scripts, packageManagerCommand);
  }
  for (const targetName in nx?.targets) {
    const nxTarget = nx.targets[targetName];
    // If the nx target specifies how to run (via executor or command shorthand),
    // it's incompatible with the inferred nx:run-script target from scripts,
    // so overwrite instead of merge.
    if (res[targetName] && (nxTarget.executor || nxTarget.command)) {
      res[targetName] = nxTarget;
    } else {
      res[targetName] = mergeTargetConfigurations(nxTarget, res[targetName]);
    }
  }

  /**
   * Add implicit nx-release-publish target for all package.json files that are
   * not marked as `"private": true` to allow for lightweight configuration for
   * package based repos.
   *
   * Any targetDefaults for the nx-release-publish target set by the user should
   * be merged with the implicit target.
   */
  if (
    !isPrivate &&
    !res['nx-release-publish'] &&
    hasNxJsPlugin(projectRoot, workspaceRoot)
  ) {
    // No project/plugin context here, so only catch-all entries of a
    // `targetDefaults` value apply (the reader resolves both the object and
    // array value forms).
    const nxReleasePublishTargetDefaults =
      readTargetDefaultsForTarget(
        'nx-release-publish',
        nxJson?.targetDefaults,
        '@nx/js:release-publish'
      ) ?? {};
    res['nx-release-publish'] = {
      executor: '@nx/js:release-publish',
      ...nxReleasePublishTargetDefaults,
      dependsOn: [
        // For maximum correctness, projects should only ever be published once their dependencies are successfully published
        '^nx-release-publish',
        ...(nxReleasePublishTargetDefaults.dependsOn ?? []),
      ],
      options: {
        ...(nxReleasePublishTargetDefaults.options ?? {}),
      },
    };
  }

  return res;
}

/**
 * Uses `require.resolve` to read the package.json for a module.
 *
 * This will fail if the module doesn't export package.json
 *
 * @returns package json contents and path
 */
export function readModulePackageJsonWithoutFallbacks(
  moduleSpecifier: string,
  requirePaths = getNxRequirePaths()
): {
  packageJson: PackageJson;
  path: string;
} {
  const packageJsonPath: string = require.resolve(
    `${moduleSpecifier}/package.json`,
    {
      paths: requirePaths,
    }
  );
  const packageJson: PackageJson = readJsonFile(packageJsonPath);

  return {
    path: packageJsonPath,
    packageJson,
  };
}

/**
 * Reads the package.json file for a specified module.
 *
 * Includes a fallback that accounts for modules that don't export package.json
 *
 * @param {string} moduleSpecifier The module to look up
 * @param {string[]} requirePaths List of paths look in. Pass `module.paths` to ensure non-hoisted dependencies are found.
 *
 * @example
 * // Use the caller's lookup paths for non-hoisted dependencies
 * readModulePackageJson('http-server', module.paths);
 *
 * @returns package json contents and path
 */
export function readModulePackageJson(
  moduleSpecifier: string,
  requirePaths = getNxRequirePaths()
): {
  packageJson: PackageJson;
  path: string;
} {
  let packageJsonPath: string;
  let packageJson: PackageJson;

  try {
    ({ path: packageJsonPath, packageJson } =
      readModulePackageJsonWithoutFallbacks(moduleSpecifier, requirePaths));
  } catch {
    const entryPoint = require.resolve(moduleSpecifier, {
      paths: requirePaths,
    });

    let moduleRootPath = dirname(entryPoint);
    packageJsonPath = join(moduleRootPath, 'package.json');

    while (!existsSync(packageJsonPath)) {
      moduleRootPath = dirname(moduleRootPath);
      packageJsonPath = join(moduleRootPath, 'package.json');
    }

    packageJson = readJsonFile(packageJsonPath);
    if (packageJson.name && packageJson.name !== moduleSpecifier) {
      throw new Error(
        `Found module ${packageJson.name} while trying to locate ${moduleSpecifier}/package.json`
      );
    }
  }

  return {
    packageJson,
    path: packageJsonPath,
  };
}

/**
 * Prepares all necessary information for installing a package to a temporary directory.
 * This is used by both sync and async installation functions.
 */
function preparePackageInstallation(
  pkg: string,
  requiredVersion: string,
  packageManager: PackageManager
) {
  const { dir: tempDir, cleanup } = createTempNpmDirectory?.() ?? {
    dir: dirSync().name,
    cleanup: () => {},
  };

  console.log(`Fetching ${pkg}...`);
  const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';
  generatePackageManagerFiles(tempDir, packageManager);

  // For pnpm, `addDev` is `pnpm add -Dw` when the workspace has a
  // pnpm-workspace.yaml. `createTempNpmDirectory` copies a sanitized copy of
  // it into the temp dir, so the `-w` here resolves to the temp dir.
  const pmCommands = getPackageManagerCommand(packageManager);
  const preInstallCommand = pmCommands.preInstall;

  // Omit peer dependencies from the temp install. `ensurePackage` puts the
  // workspace's `node_modules` on `NODE_PATH`, so a loaded package resolves its
  // peers from the workspace instead of pulling its own (possibly incompatible)
  // copies into the temp dir.
  const omitPeerDependenciesFlag =
    packageManager === 'npm' || packageManager === 'bun'
      ? '--omit=peer'
      : packageManager === 'pnpm'
        ? '--config.auto-install-peers=false'
        : '';
  const installCommand = [
    pmCommands.addDev,
    `${pkg}@${requiredVersion}`,
    omitPeerDependenciesFlag,
    pmCommands.ignoreScriptsFlag,
  ]
    .filter(Boolean)
    .join(' ');

  const execOptions = {
    cwd: tempDir,
    stdio: isVerbose ? 'inherit' : 'ignore',
    windowsHide: true,
    // Yarn Berry requires an environment variable (not a CLI flag) to disable lifecycle scripts.
    // Apply this defensively for all package managers when pulling nx@latest to tmp.
    env: {
      ...process.env,
      YARN_ENABLE_SCRIPTS: 'false',
    },
  } as const;

  return {
    tempDir,
    cleanup,
    preInstallCommand,
    installCommand,
    execOptions,
  };
}

export function installPackageToTmp(
  pkg: string,
  requiredVersion: string,
  packageManager: PackageManager
): {
  tempDir: string;
  cleanup: () => void;
} {
  const { tempDir, cleanup, preInstallCommand, installCommand, execOptions } =
    preparePackageInstallation(pkg, requiredVersion, packageManager);

  if (preInstallCommand) {
    // ensure package.json and repo in tmp folder is set to a proper package manager state
    execSync(preInstallCommand, execOptions);
  }

  execSync(installCommand, execOptions);

  return {
    tempDir,
    cleanup,
  };
}

export async function installPackageToTmpAsync(
  pkg: string,
  requiredVersion: string,
  packageManager: PackageManager
): Promise<{
  tempDir: string;
  cleanup: () => void;
}> {
  const { tempDir, cleanup, preInstallCommand, installCommand, execOptions } =
    preparePackageInstallation(pkg, requiredVersion, packageManager);

  try {
    if (preInstallCommand) {
      // ensure package.json and repo in tmp folder is set to a proper package manager state
      await execAsync(preInstallCommand, execOptions);
    }

    await execAsync(installCommand, execOptions);

    return {
      tempDir,
      cleanup,
    };
  } catch (error) {
    // Clean up on error
    cleanup();
    throw error;
  }
}

/**
 * Get the resolved version of a dependency from package.json.
 *
 * Retrieves a package version and automatically resolves PNPM catalog references
 * (e.g., "catalog:default") to their actual version strings. By default, searches
 * `dependencies` first, then falls back to `devDependencies`.
 *
 * **Tree-based usage** (generators and migrations):
 * Use when you have a `Tree` object, which is typical in Nx generators and migrations.
 *
 * **Filesystem-based usage** (CLI commands and scripts):
 * Use when reading directly from the filesystem without a `Tree` object.
 *
 * @example
 * ```typescript
 * // Tree-based - from root package.json (checks dependencies then devDependencies)
 * const reactVersion = getDependencyVersionFromPackageJson(tree, 'react');
 * // Returns: "^18.0.0" (resolves "catalog:default" if present)
 *
 * // Tree-based - check only dependencies section
 * const version = getDependencyVersionFromPackageJson(
 *   tree,
 *   'react',
 *   'package.json',
 *   ['dependencies']
 * );
 *
 * // Tree-based - check only devDependencies section
 * const version = getDependencyVersionFromPackageJson(
 *   tree,
 *   'jest',
 *   'package.json',
 *   ['devDependencies']
 * );
 *
 * // Tree-based - custom lookup order
 * const version = getDependencyVersionFromPackageJson(
 *   tree,
 *   'pkg',
 *   'package.json',
 *   ['devDependencies', 'dependencies', 'peerDependencies']
 * );
 *
 * // Tree-based - with pre-loaded package.json
 * const packageJson = readJson(tree, 'package.json');
 * const version = getDependencyVersionFromPackageJson(
 *   tree,
 *   'react',
 *   packageJson,
 *   ['dependencies']
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Filesystem-based - from current directory
 * const reactVersion = getDependencyVersionFromPackageJson('react');
 *
 * // Filesystem-based - with workspace root
 * const version = getDependencyVersionFromPackageJson('react', '/path/to/workspace');
 *
 * // Filesystem-based - with specific package.json and section
 * const version = getDependencyVersionFromPackageJson(
 *   'react',
 *   '/path/to/workspace',
 *   'apps/my-app/package.json',
 *   ['dependencies']
 * );
 * ```
 *
 * @param dependencyLookup Array of dependency sections to check in order. Defaults to ['dependencies', 'devDependencies']
 * @returns The resolved version string, or `null` if the package is not found in any of the specified sections
 */
export function getDependencyVersionFromPackageJson(
  tree: Tree,
  packageName: string,
  packageJsonPath?: string,
  dependencyLookup?: PackageJsonDependencySection[]
): string | null;
export function getDependencyVersionFromPackageJson(
  tree: Tree,
  packageName: string,
  packageJson?: PackageJson,
  dependencyLookup?: PackageJsonDependencySection[]
): string | null;
export function getDependencyVersionFromPackageJson(
  packageName: string,
  workspaceRootPath?: string,
  packageJsonPath?: string,
  dependencyLookup?: PackageJsonDependencySection[]
): string | null;
export function getDependencyVersionFromPackageJson(
  packageName: string,
  workspaceRootPath?: string,
  packageJson?: PackageJson,
  dependencyLookup?: PackageJsonDependencySection[]
): string | null;
export function getDependencyVersionFromPackageJson(
  treeOrPackageName: Tree | string,
  packageNameOrRoot?: string,
  packageJsonPathOrObjectOrRoot?: string | PackageJson,
  dependencyLookup?: PackageJsonDependencySection[]
): string | null {
  if (typeof treeOrPackageName !== 'string') {
    return getDependencyVersionFromPackageJsonFromTree(
      treeOrPackageName,
      packageNameOrRoot!,
      packageJsonPathOrObjectOrRoot,
      dependencyLookup
    );
  } else {
    return getDependencyVersionFromPackageJsonFromFileSystem(
      treeOrPackageName,
      packageNameOrRoot,
      packageJsonPathOrObjectOrRoot,
      dependencyLookup
    );
  }
}

/**
 * Tree-based implementation for getDependencyVersionFromPackageJson
 */
function getDependencyVersionFromPackageJsonFromTree(
  tree: Tree,
  packageName: string,
  packageJsonPathOrObject: string | PackageJson = 'package.json',
  dependencyLookup: PackageJsonDependencySection[] = [
    'dependencies',
    'devDependencies',
  ]
): string | null {
  let packageJson: PackageJson;
  if (typeof packageJsonPathOrObject === 'object') {
    packageJson = packageJsonPathOrObject;
  } else if (tree.exists(packageJsonPathOrObject)) {
    packageJson = readJson(tree, packageJsonPathOrObject);
  } else {
    return null;
  }

  let version: string | null = null;
  for (const section of dependencyLookup) {
    const foundVersion = packageJson[section]?.[packageName];
    if (foundVersion) {
      version = foundVersion;
      break;
    }
  }

  // Resolve catalog reference if needed
  const manager = getCatalogManager(tree.root);
  if (version && manager?.isCatalogReference(version)) {
    version = manager.resolveCatalogReference(tree, packageName, version);
  }

  return version;
}

/**
 * Filesystem-based implementation for getDependencyVersionFromPackageJson
 */
function getDependencyVersionFromPackageJsonFromFileSystem(
  packageName: string,
  root: string = workspaceRoot,
  packageJsonPathOrObject: string | PackageJson = 'package.json',
  dependencyLookup: PackageJsonDependencySection[] = [
    'dependencies',
    'devDependencies',
  ]
): string | null {
  let packageJson: PackageJson;
  if (typeof packageJsonPathOrObject === 'object') {
    packageJson = packageJsonPathOrObject;
  } else {
    const packageJsonPath = resolve(root, packageJsonPathOrObject);
    if (existsSync(packageJsonPath)) {
      packageJson = readJsonFile(packageJsonPath);
    } else {
      return null;
    }
  }

  let version: string | null = null;
  for (const section of dependencyLookup) {
    const foundVersion = packageJson[section]?.[packageName];
    if (foundVersion) {
      version = foundVersion;
      break;
    }
  }

  // Resolve catalog reference if needed
  const manager = getCatalogManager(root);
  if (version && manager?.isCatalogReference(version)) {
    version = manager.resolveCatalogReference(root, packageName, version);
  }

  return version;
}

/**
 * Generates necessary files needed for the package manager to work
 * and for the node_modules to be accessible.
 */
function generatePackageManagerFiles(
  root: string,
  packageManager: PackageManager = detectPackageManager()
) {
  const [pmMajor] = getPackageManagerVersion(packageManager).split('.');
  switch (packageManager) {
    case 'yarn':
      if (+pmMajor >= 2) {
        writeFileSync(
          join(root, '.yarnrc.yml'),
          'nodeLinker: node-modules\nenableScripts: false'
        );
      }
      break;
  }
}

/**
 * Drop the pnpm config fields (`overrides`, `ignoredOptionalDependencies`,
 * `packageExtensions`) a pruned standalone lockfile already resolves into its
 * snapshots, then drop an emptied `pnpm` block. Re-declaring them next to a
 * pruned lockfile makes pnpm <=10 fail with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
 * Shared by every prune path that ships a manifest beside a generated lockfile.
 *
 * Counterpart to `stripStandaloneLockfileConfig` in the pnpm lock-file parser,
 * which strips the matching fields from the generated lockfile; keep the two in
 * sync when pnpm adds config fields.
 */
export function stripPrunedLockfilePnpmConfig(packageJson: PackageJson): void {
  if (!packageJson.pnpm) {
    return;
  }
  delete packageJson.pnpm.overrides;
  delete packageJson.pnpm.ignoredOptionalDependencies;
  delete packageJson.pnpm.packageExtensions;
  if (Object.keys(packageJson.pnpm).length === 0) {
    delete packageJson.pnpm;
  }
}

/**
 * Builds the settings-only pnpm-workspace.yaml a standalone pruned output needs
 * on pnpm 11 and above, or null when there is nothing to carry.
 *
 * pnpm 11 was the first major to read these settings only from
 * pnpm-workspace.yaml, never the package.json `pnpm` field, and the rest of the
 * pruned output ships no workspace file. So on pnpm 11+ the build-script
 * approvals (`allowBuilds`) and `supportedArchitectures` the workspace declares
 * would be dropped, and native production deps would never run their build
 * scripts. Carry those from the workspace root, but without a `packages:` key:
 * that flips pnpm into workspace mode, which pnpm 9 rejects outright.
 *
 * The major comes from the build machine's pnpm; the deploy `pnpm install` is
 * assumed to run the same major, which is all that is knowable at build time.
 *
 * pnpm 10 and below read the same settings from the emitted package.json, so
 * this returns null there, and when the workspace declares none. Resolution-time
 * config stays out: it is already baked into the pruned lockfile (see
 * `stripPrunedLockfilePnpmConfig`). `patchedDependencies` are carried too, scoped
 * to the patches the pruned lockfile keeps (see `getPrunedPnpmPatchArtifacts`).
 *
 * Returns the YAML string so both the file-writing prune paths and the webpack
 * asset pipeline (which emits assets rather than writing to disk) can carry it.
 *
 * Pass `prunedLockfileContent` to narrow `allowBuilds` to the packages the pruned
 * output actually installs; entries for packages the prune dropped are left out.
 * Omit it to carry the root allowlist verbatim (pnpm ignores approvals for absent
 * packages either way, so this only keeps the emitted file accurate).
 */
export function getPrunedPnpmInstallSettingsYaml(
  workspaceRootPath: string = workspaceRoot,
  prunedLockfileContent?: string
): string | null {
  // pnpm 11 was the first major to read these settings only from
  // pnpm-workspace.yaml; later majors keep that behavior. pnpm 10 and below
  // still read them from the emitted package.json, so nothing to carry.
  const pnpmMajor = getPnpmMajor(workspaceRootPath);
  if (pnpmMajor === null || pnpmMajor < 11) {
    return null;
  }
  let rootSettings: {
    allowBuilds?: Record<string, boolean>;
    supportedArchitectures?: unknown;
  };
  try {
    const rootWorkspaceYaml = join(workspaceRootPath, 'pnpm-workspace.yaml');
    if (!existsSync(rootWorkspaceYaml)) {
      return null;
    }
    // An empty or comment-only file parses to null/undefined; treat it as no
    // settings rather than dereferencing it below.
    rootSettings = readYamlFile(rootWorkspaceYaml) ?? {};
  } catch {
    // Can't read the root settings (unreadable or malformed
    // pnpm-workspace.yaml). Skip rather than guess. Worst case matches the prior
    // behavior of carrying no install-time settings.
    return null;
  }
  const settings: Record<string, unknown> = {};
  if (rootSettings.allowBuilds) {
    const allowBuilds = prunedLockfileContent
      ? filterAllowBuildsToLockfile(
          rootSettings.allowBuilds,
          prunedLockfileContent
        )
      : rootSettings.allowBuilds;
    if (Object.keys(allowBuilds).length > 0) {
      settings.allowBuilds = allowBuilds;
    }
  }
  if (rootSettings.supportedArchitectures) {
    settings.supportedArchitectures = rootSettings.supportedArchitectures;
  }
  if (prunedLockfileContent) {
    const patchedDependencies = getPrunedPatchedDependencies(
      workspaceRootPath,
      prunedLockfileContent
    );
    if (Object.keys(patchedDependencies).length > 0) {
      settings.patchedDependencies =
        normalizePrunedPatchedDependencies(patchedDependencies);
    }
  }
  if (Object.keys(settings).length === 0) {
    return null;
  }
  const { dump } = require('@zkochan/js-yaml');
  return dump(settings);
}

/**
 * The pnpm major of the workspace's package manager, or null when it cannot be
 * determined (unknown or unparseable version).
 */
function getPnpmMajor(workspaceRootPath: string): number | null {
  try {
    const major = Number.parseInt(
      getPackageManagerVersion('pnpm', workspaceRootPath).split('.')[0],
      10
    );
    return Number.isNaN(major) ? null : major;
  } catch {
    return null;
  }
}

/**
 * Keeps only the `allowBuilds` entries whose package is present in the pruned
 * lockfile. Build-script approvals for packages the prune dropped are inert, so
 * dropping them keeps the emitted pnpm-workspace.yaml scoped to the deployment.
 */
function filterAllowBuildsToLockfile(
  allowBuilds: Record<string, boolean>,
  prunedLockfileContent: string
): Record<string, boolean> {
  const present = getPnpmLockfilePackageNames(prunedLockfileContent);
  const filtered: Record<string, boolean> = {};
  for (const [name, allowed] of Object.entries(allowBuilds)) {
    if (present.has(name)) {
      filtered[name] = allowed;
    }
  }
  return filtered;
}

/**
 * Extracts the package names from a pnpm v9 lockfile's `packages` keys
 * (`name@version`, `@scope/name@version`, optionally with a `(peer@ver)` suffix).
 */
function getPnpmLockfilePackageNames(lockfileContent: string): Set<string> {
  const names = new Set<string>();
  let parsed: { packages?: Record<string, unknown> };
  try {
    const { load } = require('@zkochan/js-yaml');
    parsed = load(lockfileContent) ?? {};
  } catch {
    return names;
  }
  for (const key of Object.keys(parsed.packages ?? {})) {
    // Skip index 0 so a scoped key's leading `@` is not read as the separator.
    const versionSeparator = key.indexOf('@', 1);
    names.add(versionSeparator === -1 ? key : key.slice(0, versionSeparator));
  }
  return names;
}

/**
 * The workspace root's `patchedDependencies` (package key -> patch file path),
 * scoped to the patches the pruned lockfile keeps. pnpm 11 declares them in
 * pnpm-workspace.yaml; pnpm 10 and below in the package.json `pnpm` field, so
 * read both root sources. A patch entry for a package the prune dropped would
 * fail `pnpm install --frozen-lockfile` with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH,
 * so the pruned lockfile's kept `patchedDependencies` keys are the scope.
 */
function getPrunedPatchedDependencies(
  workspaceRootPath: string,
  prunedLockfileContent: string | undefined
): Record<string, string> {
  if (!prunedLockfileContent) {
    return {};
  }
  const survivingKeys = getPrunedLockfilePatchedKeys(prunedLockfileContent);
  if (survivingKeys.size === 0) {
    return {};
  }
  const rootPatches = readRootPatchedDependencies(workspaceRootPath);
  const scoped: Record<string, string> = {};
  for (const key of survivingKeys) {
    if (rootPatches[key]) {
      scoped[key] = rootPatches[key];
    }
  }
  return scoped;
}

/**
 * The path a `.patch` file takes inside the pruned output. Patches must ship
 * under the output's declared `patches/` directory: a source path outside it (a
 * custom directory, or a parent-relative `../` path) would fall outside the
 * prune target's cached `patches` output and be dropped on a cache replay, and a
 * `..` asset name is not one a bundler can emit. The source sub-structure is
 * kept under `patches/`, so two patches that share a file name in different
 * directories do not collide; `.` and `..` segments are dropped anywhere they
 * appear (not just a leading run) so the result can never resolve outside
 * `patches/`, and a leading `patches/` is stripped so the common layout is not
 * nested under a second `patches/`.
 * `filterPatchedDependenciesToPrunedPackages` in the pnpm lock-file parser calls
 * this same helper for the lockfile's object-form path (pnpm 9-10), which pnpm
 * --frozen-lockfile cross-checks against this config path, so the two agree.
 */
export function normalizePrunedPatchPath(patchPath: string): string {
  const segments = patchPath
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.' && segment !== '..');
  if (segments[0] === 'patches') {
    segments.shift();
  }
  return `patches/${segments.join('/')}`;
}

function normalizePrunedPatchedDependencies(
  patchedDependencies: Record<string, string>
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, patchPath] of Object.entries(patchedDependencies)) {
    normalized[key] = normalizePrunedPatchPath(patchPath);
  }
  return normalized;
}

function readRootPatchedDependencies(
  workspaceRootPath: string
): Record<string, string> {
  const merged: Record<string, string> = {};
  try {
    const rootWorkspaceYaml = join(workspaceRootPath, 'pnpm-workspace.yaml');
    if (existsSync(rootWorkspaceYaml)) {
      const yaml = readYamlFile<{
        patchedDependencies?: Record<string, string>;
      }>(rootWorkspaceYaml);
      Object.assign(merged, yaml?.patchedDependencies ?? {});
    }
    const rootPackageJsonPath = join(workspaceRootPath, 'package.json');
    if (existsSync(rootPackageJsonPath)) {
      const rootPackageJson = readJsonFile<PackageJson>(rootPackageJsonPath);
      Object.assign(merged, rootPackageJson.pnpm?.patchedDependencies ?? {});
    }
  } catch {
    // Unreadable or malformed root config: carry no patches rather than guess.
    return {};
  }
  return merged;
}

function getPrunedLockfilePatchedKeys(
  prunedLockfileContent: string
): Set<string> {
  try {
    const { load } = require('@zkochan/js-yaml');
    const parsed: { patchedDependencies?: Record<string, unknown> } =
      load(prunedLockfileContent) ?? {};
    return new Set(Object.keys(parsed.patchedDependencies ?? {}));
  } catch {
    return new Set();
  }
}

/**
 * Patch artifacts a standalone pruned output must ship to keep a `pnpm patch`
 * workspace installable: the `.patch` files (path relative to the output root,
 * plus content) and, on pnpm 10 and below, the `patchedDependencies` map to
 * declare in the emitted package.json. On pnpm 11+ that map is carried in
 * pnpm-workspace.yaml (see `getPrunedPnpmInstallSettingsYaml`), so
 * `packageJsonPatchedDependencies` is null there. Both are scoped to the patches
 * the pruned lockfile keeps. Returns the file contents so the file-writing prune
 * paths and the bundler asset pipelines can each ship them their own way.
 */
export function getPrunedPnpmPatchArtifacts(
  workspaceRootPath: string = workspaceRoot,
  prunedLockfileContent?: string
): {
  patchFiles: Array<{ path: string; content: string }>;
  packageJsonPatchedDependencies: Record<string, string> | null;
} {
  const patchedDependencies = getPrunedPatchedDependencies(
    workspaceRootPath,
    prunedLockfileContent
  );
  if (Object.keys(patchedDependencies).length === 0) {
    return { patchFiles: [], packageJsonPatchedDependencies: null };
  }
  const patchFiles: Array<{ path: string; content: string }> = [];
  for (const patchPath of new Set(Object.values(patchedDependencies))) {
    const source = join(workspaceRootPath, patchPath);
    if (existsSync(source)) {
      // Ship the patch under the `patches/<subpath>` path the pruned output
      // declares, reading it from wherever the workspace kept it.
      patchFiles.push({
        path: normalizePrunedPatchPath(patchPath),
        content: readFileSync(source, 'utf-8'),
      });
    } else {
      // The root config declares this patch but the file is missing (already a
      // broken workspace, the root install would fail too). Warn rather than
      // drop the declaration: the pruned lockfile still lists the patch, so
      // dropping only the config would trade this for a lockfile config mismatch.
      logger.warn(
        `Patch file "${patchPath}" referenced by patchedDependencies was not found; the pruned output declares the patch but cannot ship the file.`
      );
    }
  }
  const pnpmMajor = getPnpmMajor(workspaceRootPath);
  return {
    patchFiles,
    packageJsonPatchedDependencies:
      pnpmMajor !== null && pnpmMajor < 11
        ? normalizePrunedPatchedDependencies(patchedDependencies)
        : null,
  };
}

/**
 * Emits the pnpm install-time artifacts a standalone pruned output needs through
 * a caller-provided `emit` sink: the pnpm 11 settings-only pnpm-workspace.yaml
 * (see `getPrunedPnpmInstallSettingsYaml`) and the `pnpm patch` files, plus, for
 * pnpm <=10, the `patchedDependencies` declaration folded into `packageJson` in
 * place. The bundler plugins (webpack, rspack) hold the manifest in memory and
 * emit it as a compilation asset after this returns, so the pnpm <=10
 * declaration is mutated onto `packageJson` rather than written; the
 * file-writing executors use `writePrunedPnpmInstallSettings` instead.
 */
export function emitPrunedPnpmInstallAssets(
  workspaceRootPath: string,
  prunedLockfileContent: string,
  packageJson: PackageJson,
  emit: (assetPath: string, content: string) => void
): void {
  const yaml = getPrunedPnpmInstallSettingsYaml(
    workspaceRootPath,
    prunedLockfileContent
  );
  if (yaml !== null) {
    emit('pnpm-workspace.yaml', yaml);
  }

  const { patchFiles, packageJsonPatchedDependencies } =
    getPrunedPnpmPatchArtifacts(workspaceRootPath, prunedLockfileContent);
  for (const { path, content } of patchFiles) {
    emit(path, content);
  }
  if (packageJsonPatchedDependencies) {
    packageJson.pnpm = {
      ...packageJson.pnpm,
      patchedDependencies: packageJsonPatchedDependencies,
    };
  }
}

/**
 * Writes the pnpm install-time artifacts a standalone pruned output needs into
 * `outputDirectory`: the pnpm 11 settings-only pnpm-workspace.yaml (see
 * `getPrunedPnpmInstallSettingsYaml`) and the `pnpm patch` files, plus the
 * pnpm <=10 `patchedDependencies` declaration in the emitted package.json. Does
 * nothing for whatever the workspace does not use. `allowBuilds` and the patch
 * scope come from `lockfileContent` when the caller already has it in hand,
 * otherwise from the pruned lockfile it just wrote to `outputDirectory`.
 */
export function writePrunedPnpmInstallSettings(
  outputDirectory: string,
  workspaceRootPath: string = workspaceRoot,
  lockfileContent?: string
): void {
  const prunedLockfileContent =
    lockfileContent ?? readPrunedLockfile(outputDirectory);
  const yaml = getPrunedPnpmInstallSettingsYaml(
    workspaceRootPath,
    prunedLockfileContent
  );
  if (yaml !== null) {
    writeFileSync(join(outputDirectory, 'pnpm-workspace.yaml'), yaml);
  }

  const { patchFiles, packageJsonPatchedDependencies } =
    getPrunedPnpmPatchArtifacts(workspaceRootPath, prunedLockfileContent);
  for (const { path, content } of patchFiles) {
    const destination = join(outputDirectory, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  }
  if (packageJsonPatchedDependencies) {
    const packageJsonPath = join(outputDirectory, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson: PackageJson = readJsonFile(packageJsonPath);
      packageJson.pnpm ??= {};
      packageJson.pnpm.patchedDependencies = packageJsonPatchedDependencies;
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }
  }
}

function readPrunedLockfile(outputDirectory: string): string | undefined {
  const lockfilePath = join(outputDirectory, 'pnpm-lock.yaml');
  return existsSync(lockfilePath)
    ? readFileSync(lockfilePath, 'utf-8')
    : undefined;
}
