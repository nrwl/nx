import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { normalizePath } from './path';

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
 * pnpm config resolved once per prune and threaded into the settings-yaml and
 * patch-artifact builders, so neither re-detects the pnpm version nor re-reads
 * the root config and lockfile.
 */
type PrunedPnpmConfig = {
  pnpmMajor: number | null;
  patchedDependencies: Record<string, string>;
};

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
 * `precomputed` lets a caller pass the pnpm major and pruned patchedDependencies
 * it already resolved instead of recomputing them here.
 */
export function getPrunedPnpmInstallSettingsYaml(
  workspaceRootPath: string = workspaceRoot,
  prunedLockfileContent?: string,
  precomputed?: PrunedPnpmConfig
): string | null {
  // pnpm 11 was the first major to read these settings only from
  // pnpm-workspace.yaml; later majors keep that behavior. pnpm 10 and below
  // still read them from the emitted package.json, so nothing to carry.
  const pnpmMajor = precomputed?.pnpmMajor ?? getPnpmMajor(workspaceRootPath);
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
  const patchedDependencies =
    precomputed?.patchedDependencies ??
    (prunedLockfileContent
      ? getPrunedPatchedDependencies(workspaceRootPath, prunedLockfileContent)
      : {});
  if (Object.keys(patchedDependencies).length > 0) {
    settings.patchedDependencies =
      normalizePrunedPatchedDependencies(patchedDependencies);
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

let lastParsedPnpmLockfile: {
  content: string;
  parsed: object | null;
} | null = null;

/**
 * Parses pnpm lockfile content, memoizing the last result: one prune run reads
 * the same content for the patch scope, the build-script approvals, the
 * local-path artifacts, and the link-closure validation, and a watch-mode
 * rebuild re-reads an unchanged lockfile. Returns null when the content is not
 * valid YAML or does not parse to an object. Consumers must not mutate the
 * returned document.
 */
function parsePnpmLockfileYaml(content: string): object | null {
  if (lastParsedPnpmLockfile?.content !== content) {
    let parsed: unknown;
    try {
      parsed = require('@zkochan/js-yaml').load(content) ?? {};
    } catch {
      parsed = null;
    }
    lastParsedPnpmLockfile = {
      content,
      parsed: typeof parsed === 'object' ? parsed : null,
    };
  }
  return lastParsedPnpmLockfile.parsed;
}

/**
 * Extracts the package names from a pnpm v9 lockfile's `packages` keys
 * (`name@version`, `@scope/name@version`, optionally with a `(peer@ver)` suffix).
 */
function getPnpmLockfilePackageNames(lockfileContent: string): Set<string> {
  const names = new Set<string>();
  const parsed = parsePnpmLockfileYaml(lockfileContent) as {
    packages?: Record<string, unknown>;
  } | null;
  if (!parsed) {
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
    // pnpm <=10 reads patchedDependencies from the package.json `pnpm` field,
    // pnpm 11 only from pnpm-workspace.yaml. When both declare the same key the
    // pnpm-workspace.yaml value is the authoritative one on pnpm 11 (pnpm
    // migrates the config there), so read package.json first and let the
    // pnpm-workspace.yaml value win on conflict.
    const rootPackageJsonPath = join(workspaceRootPath, 'package.json');
    if (existsSync(rootPackageJsonPath)) {
      const rootPackageJson = readJsonFile<PackageJson>(rootPackageJsonPath);
      Object.assign(merged, rootPackageJson.pnpm?.patchedDependencies ?? {});
    }
    const rootWorkspaceYaml = join(workspaceRootPath, 'pnpm-workspace.yaml');
    if (existsSync(rootWorkspaceYaml)) {
      const yaml = readYamlFile<{
        patchedDependencies?: Record<string, string>;
      }>(rootWorkspaceYaml);
      Object.assign(merged, yaml?.patchedDependencies ?? {});
    }
  } catch {
    // Unreadable or malformed root config: carry no patches rather than guess.
    return {};
  }
  return merged;
}

type RootPnpmBuildSettings = {
  onlyBuiltDependencies?: string[];
  neverBuiltDependencies?: string[];
  allowBuilds?: Record<string, boolean>;
  supportedArchitectures?: NonNullable<
    PackageJson['pnpm']
  >['supportedArchitectures'];
};

/**
 * The workspace root's pnpm build-script settings, read from both the
 * pnpm-workspace.yaml and the root package.json `pnpm` field, with the
 * pnpm-workspace.yaml value winning per field (pnpm migrates config there, and
 * pnpm 10 reads both). Mirrors `readRootPatchedDependencies`.
 */
function readRootPnpmBuildSettings(
  workspaceRootPath: string
): RootPnpmBuildSettings {
  const fields = [
    'onlyBuiltDependencies',
    'neverBuiltDependencies',
    'allowBuilds',
    'supportedArchitectures',
  ] as const;
  const merged: RootPnpmBuildSettings = {};
  try {
    const sources: RootPnpmBuildSettings[] = [];
    const rootPackageJsonPath = join(workspaceRootPath, 'package.json');
    if (existsSync(rootPackageJsonPath)) {
      sources.push(readJsonFile<PackageJson>(rootPackageJsonPath).pnpm ?? {});
    }
    const rootWorkspaceYaml = join(workspaceRootPath, 'pnpm-workspace.yaml');
    if (existsSync(rootWorkspaceYaml)) {
      sources.push(
        readYamlFile<RootPnpmBuildSettings>(rootWorkspaceYaml) ?? {}
      );
    }
    // Later source (pnpm-workspace.yaml) wins per field.
    for (const source of sources) {
      for (const field of fields) {
        if (source[field] !== undefined) {
          merged[field] = source[field] as any;
        }
      }
    }
  } catch {
    // Unreadable or malformed root config: carry no settings rather than guess.
    return {};
  }
  return merged;
}

type PrunedPnpmPackageJsonBuildSettings = Pick<
  NonNullable<PackageJson['pnpm']>,
  'onlyBuiltDependencies' | 'neverBuiltDependencies' | 'supportedArchitectures'
>;

/**
 * The pnpm build-script approvals a standalone pruned output must declare in its
 * emitted package.json so native production deps still run their build scripts on
 * pnpm <=10, or null when there is nothing to carry.
 *
 * pnpm <=10 reads `onlyBuiltDependencies`/`neverBuiltDependencies` (and
 * `supportedArchitectures`) from the package.json `pnpm` field; pnpm 11 removed
 * those keys and reads `allowBuilds` only from pnpm-workspace.yaml (carried there
 * by `getPrunedPnpmInstallSettingsYaml`), so this returns null on pnpm 11+. The
 * root may declare the approvals in pnpm-workspace.yaml (pnpm 10) or the
 * package.json `pnpm` field (pnpm 9), and pnpm 10.26+ uses the `allowBuilds` map,
 * so read both root sources and fold a root `allowBuilds` map into the
 * on/never-built lists pnpm <=10 understands. Approvals are scoped to the
 * packages the pruned lockfile keeps; one for a dropped package is inert.
 *
 * Counterpart to the pnpm 11 `getPrunedPnpmInstallSettingsYaml`; keep the two in
 * sync when pnpm changes where build approvals are read from.
 */
export function getPrunedPnpmPackageJsonBuildSettings(
  workspaceRootPath: string = workspaceRoot,
  prunedLockfileContent?: string,
  precomputed?: PrunedPnpmConfig
): PrunedPnpmPackageJsonBuildSettings | null {
  const pnpmMajor = precomputed?.pnpmMajor ?? getPnpmMajor(workspaceRootPath);
  if (pnpmMajor === null || pnpmMajor >= 11) {
    return null;
  }
  const root = readRootPnpmBuildSettings(workspaceRootPath);
  const present = prunedLockfileContent
    ? getPnpmLockfilePackageNames(prunedLockfileContent)
    : null;
  const scopeToLockfile = (names: Iterable<string>): string[] => {
    const scoped = [...names];
    return present ? scoped.filter((name) => present.has(name)) : scoped;
  };

  // pnpm 10.26+ declares approvals as an allowBuilds map; fold it into the
  // on/never-built lists pnpm <=10 reads from package.json.
  const onlyBuilt = new Set(root.onlyBuiltDependencies ?? []);
  const neverBuilt = new Set(root.neverBuiltDependencies ?? []);
  for (const [name, allowed] of Object.entries(root.allowBuilds ?? {})) {
    (allowed ? onlyBuilt : neverBuilt).add(name);
  }

  const settings: PrunedPnpmPackageJsonBuildSettings = {};
  const scopedOnlyBuilt = scopeToLockfile(onlyBuilt);
  if (scopedOnlyBuilt.length > 0) {
    settings.onlyBuiltDependencies = scopedOnlyBuilt;
  }
  const scopedNeverBuilt = scopeToLockfile(neverBuilt);
  if (scopedNeverBuilt.length > 0) {
    settings.neverBuiltDependencies = scopedNeverBuilt;
  }
  if (root.supportedArchitectures) {
    settings.supportedArchitectures = root.supportedArchitectures;
  }
  return Object.keys(settings).length > 0 ? settings : null;
}

/**
 * Folds the pnpm <=10 package.json additions a standalone pruned output needs
 * (build approvals from `getPrunedPnpmPackageJsonBuildSettings`, plus the
 * `patchedDependencies` declaration) onto `packageJson` in place. Build-approval
 * lists union the manifest's own entries with the carried ones so a project-level
 * approval is never dropped. Does nothing when there is nothing to add.
 */
function applyPrunedPnpmPackageJsonSettings(
  packageJson: PackageJson,
  buildSettings: PrunedPnpmPackageJsonBuildSettings | null,
  patchedDependencies: Record<string, string> | null
): void {
  if (!buildSettings && !patchedDependencies) {
    return;
  }
  const union = (a: string[] = [], b: string[] = []) => [
    ...new Set([...a, ...b]),
  ];
  packageJson.pnpm ??= {};
  if (buildSettings?.onlyBuiltDependencies) {
    packageJson.pnpm.onlyBuiltDependencies = union(
      packageJson.pnpm.onlyBuiltDependencies,
      buildSettings.onlyBuiltDependencies
    );
  }
  if (buildSettings?.neverBuiltDependencies) {
    packageJson.pnpm.neverBuiltDependencies = union(
      packageJson.pnpm.neverBuiltDependencies,
      buildSettings.neverBuiltDependencies
    );
  }
  if (buildSettings?.supportedArchitectures) {
    packageJson.pnpm.supportedArchitectures = {
      ...buildSettings.supportedArchitectures,
      ...packageJson.pnpm.supportedArchitectures,
    };
  }
  if (patchedDependencies) {
    packageJson.pnpm.patchedDependencies = patchedDependencies;
  }
}

function getPrunedLockfilePatchedKeys(
  prunedLockfileContent: string
): Set<string> {
  const parsed = parsePnpmLockfileYaml(prunedLockfileContent) as {
    patchedDependencies?: Record<string, unknown>;
  } | null;
  return new Set(Object.keys(parsed?.patchedDependencies ?? {}));
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
  prunedLockfileContent?: string,
  precomputed?: PrunedPnpmConfig
): {
  patchFiles: Array<{ path: string; content: string }>;
  packageJsonPatchedDependencies: Record<string, string> | null;
} {
  const patchedDependencies =
    precomputed?.patchedDependencies ??
    getPrunedPatchedDependencies(workspaceRootPath, prunedLockfileContent);
  if (Object.keys(patchedDependencies).length === 0) {
    return { patchFiles: [], packageJsonPatchedDependencies: null };
  }
  const patchFiles: Array<{ path: string; content: string }> = [];
  // normalizePrunedPatchPath can map two different sources to one shipped path
  // (it drops `.`/`..` and a leading `patches/`), which would ship a single file
  // for both entries and apply the wrong patch. Detect the clash and fail loudly
  // rather than silently corrupt the output.
  const shippedFrom = new Map<string, string>();
  for (const patchPath of new Set(Object.values(patchedDependencies))) {
    // The config/lockfile side normalizes an absolute patch path under patches/,
    // so read its source from that absolute location to keep the shipped file in
    // sync; only a relative path resolves against the workspace root.
    const source = isAbsolute(patchPath)
      ? patchPath
      : join(workspaceRootPath, patchPath);
    const destination = normalizePrunedPatchPath(patchPath);
    const existingSource = shippedFrom.get(destination);
    if (existingSource !== undefined && existingSource !== source) {
      throw new Error(
        `Cannot prune pnpm patches: "${existingSource}" and "${source}" both ship to "${destination}" in the standalone output. Rename one so the patches do not collide.`
      );
    }
    shippedFrom.set(destination, source);
    if (existsSync(source)) {
      // Ship the patch under the `patches/<subpath>` path the pruned output
      // declares, reading it from wherever the workspace kept it.
      patchFiles.push({
        path: destination,
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
  const pnpmMajor = precomputed?.pnpmMajor ?? getPnpmMajor(workspaceRootPath);
  return {
    patchFiles,
    packageJsonPatchedDependencies:
      pnpmMajor !== null && pnpmMajor < 11
        ? normalizePrunedPatchedDependencies(patchedDependencies)
        : null,
  };
}

const WORKSPACE_MODULES_DIR = 'workspace_modules';

const LOCKFILE_DEP_SECTIONS = [
  'dependencies',
  'optionalDependencies',
  'devDependencies',
] as const;

// A pruned lockfile dep ref is a plain ref string (pre-v9 importers, all package
// snapshots) or an inline `{ specifier, version }` object (v9 importers).
type PrunedLockfileDepRef = string | { version?: string };
type PrunedLockfileSnapshot = {
  resolution?: { tarball?: string; directory?: string };
  dependencies?: Record<string, PrunedLockfileDepRef>;
  optionalDependencies?: Record<string, PrunedLockfileDepRef>;
  devDependencies?: Record<string, PrunedLockfileDepRef>;
};

/** True when a workspace-root-relative path escapes the output root. */
function localPathEscapesOutput(wsRelativePath: string): boolean {
  // An absolute path counts as escaping: join(workspaceRoot, target) would
  // silently rebase it under the workspace root instead of resolving it.
  return (
    isAbsolute(wsRelativePath) || wsRelativePath.split(/[\\/]/).includes('..')
  );
}

/** True when a resolution `directory` points at a copied workspace module. */
function isUnderWorkspaceModules(directory: string): boolean {
  return (
    directory === WORKSPACE_MODULES_DIR ||
    directory.startsWith(`${WORKSPACE_MODULES_DIR}/`) ||
    directory.startsWith(`${WORKSPACE_MODULES_DIR}\\`)
  );
}

/**
 * pnpm resolves every pruned-lockfile `link:` ref relative to the lockfile
 * directory: snapshot refs are read against it directly (verified on pnpm
 * 9/10/11), and the output's only importer is `.`, the lockfile directory
 * itself. Normalize the ref to a workspace-root-relative posix path. An
 * absolute target is returned as-is (join would rebase it) so the escape check
 * can reject it.
 */
function resolveLinkTarget(linkRef: string): string {
  const refPath = linkRef.slice('link:'.length);
  return normalizePath(isAbsolute(refPath) ? refPath : join(refPath));
}

type ParsedPrunedLockfile = {
  packages?: Record<string, PrunedLockfileSnapshot>;
  snapshots?: Record<string, PrunedLockfileSnapshot>;
  importers?: Record<string, PrunedLockfileSnapshot>;
};

function parsePrunedLockfile(content: string): ParsedPrunedLockfile | null {
  return parsePnpmLockfileYaml(content) as ParsedPrunedLockfile | null;
}

/**
 * The non-workspace `link:` target directories the pruned lockfile references
 * (root importer versions and package snapshot refs, e.g. from copied
 * workspace modules and vendored `file:` directories), each resolved to a
 * workspace-root-relative posix path paired with the lockfile ref it came from.
 * Targets under `workspace_modules/` are excluded (copy-workspace-modules ships
 * those); a target that escapes the workspace root is included so the caller
 * can report it; a target that is the workspace root itself is skipped with a
 * warning (shipping it would copy the entire workspace).
 */
// The link-closure validator and the local-path artifact collector both walk
// the same parsed lockfile in one prune run; caching per document runs the walk
// (and its warnings) once. Callers must not mutate the returned array.
const collectedPrunedLinkTargets = new WeakMap<
  ParsedPrunedLockfile,
  Array<{ target: string; ref: string }>
>();

function collectPrunedLinkTargetDirs(
  parsed: ParsedPrunedLockfile
): Array<{ target: string; ref: string }> {
  const cached = collectedPrunedLinkTargets.get(parsed);
  if (cached) {
    return cached;
  }
  const targets = new Map<string, string>();
  const addRef = (value: PrunedLockfileDepRef): void => {
    const ref = typeof value === 'string' ? value : value?.version;
    if (typeof ref !== 'string' || !ref.startsWith('link:')) {
      return;
    }
    const target = resolveLinkTarget(ref);
    if (target === '' || target === '.') {
      logger.warn(
        `Local-path dependency "${ref}" resolves to the workspace root itself and cannot be shipped into the pruned output.`
      );
      return;
    }
    if (!isUnderWorkspaceModules(target) && !targets.has(target)) {
      targets.set(target, ref);
    }
  };

  // Every link: ref resolves from the lockfile dir (see resolveLinkTarget), so
  // scan the root importer and both dependency-carrying package sections.
  const rootImporter = parsed.importers?.['.'] ?? {};
  for (const section of LOCKFILE_DEP_SECTIONS) {
    for (const value of Object.values(rootImporter[section] ?? {})) {
      addRef(value);
    }
  }
  for (const section of [parsed.snapshots, parsed.packages]) {
    for (const snapshot of Object.values(section ?? {})) {
      for (const depSection of LOCKFILE_DEP_SECTIONS) {
        for (const value of Object.values(snapshot?.[depSection] ?? {})) {
          addRef(value);
        }
      }
    }
  }
  const result = [...targets].map(([target, ref]) => ({ target, ref }));
  collectedPrunedLinkTargets.set(parsed, result);
  return result;
}

/**
 * The non-workspace local-path packages a standalone pruned output must ship so
 * `pnpm install` can resolve them, each as `{ path, sourcePath }` (path relative
 * to the output root, sourcePath the absolute file to ship there). pnpm records
 * every such path relative to the workspace root, and the deploy root is the
 * workspace root, so a source vendored inside the workspace has a clean
 * output-root-relative subpath and ships as-is. Three shapes are shipped:
 * - a `file:` tarball (`resolution.tarball`) -> the `.tgz` file.
 * - a `file:` directory (`resolution.directory`) not under `workspace_modules/`
 *   -> the directory tree (copied workspace modules carry a `workspace_modules/`
 *   directory resolution and are shipped by copy-workspace-modules, so they are
 *   skipped here).
 * - a `link:` target (a root importer `link:` version, or a package `link:`
 *   snapshot ref) -> the target directory tree.
 * `node_modules` is filtered from every directory copy; symlinked entries are
 * skipped with a warning; entries are deduped by destination. A source that
 * resolves outside the workspace root, or is missing on disk, is skipped with a
 * warning (it is not reproducibly deployable). Returns source paths rather than
 * bytes so the file-writing prune paths can copy without buffering whole trees;
 * the bundler asset pipelines read the bytes as they emit.
 */
export function getPrunedPnpmLocalPathArtifacts(
  workspaceRootPath: string = workspaceRoot,
  prunedLockfileContent?: string
): Array<{ path: string; sourcePath: string }> {
  if (!prunedLockfileContent) {
    return [];
  }
  const parsed = parsePrunedLockfile(prunedLockfileContent);
  if (!parsed) {
    return [];
  }

  const artifacts: Array<{ path: string; sourcePath: string }> = [];
  const shippedRoots = new Set<string>();
  const seenDestinations = new Set<string>();

  // The absolute source for a shippable target, or null (with a warning) when
  // the target escapes the workspace root or is missing on disk.
  const resolveShippableSource = (
    wsRelativePath: string,
    origin: string
  ): string | null => {
    if (localPathEscapesOutput(wsRelativePath)) {
      logger.warn(
        `Local-path dependency "${origin}" resolves outside the workspace root and cannot be shipped into the pruned output. Vendor it inside the workspace to deploy it.`
      );
      return null;
    }
    const source = join(workspaceRootPath, wsRelativePath);
    if (!existsSync(source)) {
      logger.warn(
        `Local-path dependency "${origin}" was not found at ${source}; the pruned output references it but cannot ship it.`
      );
      return null;
    }
    return source;
  };

  const shipFile = (wsRelativePath: string, origin: string): void => {
    if (shippedRoots.has(wsRelativePath)) {
      return;
    }
    shippedRoots.add(wsRelativePath);
    const source = resolveShippableSource(wsRelativePath, origin);
    if (!source || seenDestinations.has(wsRelativePath)) {
      return;
    }
    seenDestinations.add(wsRelativePath);
    artifacts.push({ path: wsRelativePath, sourcePath: source });
  };

  const shipDirectory = (wsRelativePath: string, origin: string): void => {
    if (shippedRoots.has(wsRelativePath)) {
      return;
    }
    shippedRoots.add(wsRelativePath);
    const source = resolveShippableSource(wsRelativePath, origin);
    if (!source) {
      return;
    }
    if (!statSync(source).isDirectory()) {
      logger.warn(
        `Local-path dependency "${origin}" is not a directory at ${source}; the pruned output references it but cannot ship it.`
      );
      return;
    }
    // Walk the tree, skipping node_modules, deduping by destination.
    const walk = (absoluteDir: string, destinationDir: string): void => {
      for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') {
          continue;
        }
        const absoluteEntry = join(absoluteDir, entry.name);
        const destinationEntry = `${destinationDir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(absoluteEntry, destinationEntry);
        } else if (entry.isFile()) {
          if (seenDestinations.has(destinationEntry)) {
            continue;
          }
          seenDestinations.add(destinationEntry);
          artifacts.push({ path: destinationEntry, sourcePath: absoluteEntry });
        } else if (entry.isSymbolicLink()) {
          // Following links risks cycles and machine-specific targets, so they
          // are not shipped; surface the gap instead of silently dropping it.
          logger.warn(
            `Local-path dependency "${origin}" contains a symbolic link at ${absoluteEntry}, which is not shipped into the pruned output.`
          );
        }
      }
    };
    walk(source, wsRelativePath);
  };

  // file: tarball + file: directory resolutions (resolutions live in `packages`).
  for (const snapshot of Object.values(parsed.packages ?? {})) {
    const tarball = snapshot?.resolution?.tarball;
    if (tarball?.startsWith('file:')) {
      shipFile(tarball.slice('file:'.length), tarball);
      continue;
    }
    const directory = snapshot?.resolution?.directory;
    if (directory && !isUnderWorkspaceModules(directory)) {
      shipDirectory(normalizePath(directory), `file:${directory}`);
    }
  }

  // link: targets (root importer versions + directory-package snapshot refs).
  for (const { target, ref } of collectPrunedLinkTargetDirs(parsed)) {
    shipDirectory(target, ref);
  }

  return artifacts;
}

/**
 * Fails the pruned build when a shipped local-path target has a required
 * dependency that will not be resolvable in the standalone deploy. Two shapes
 * are validated:
 * - a `link:` target: a symlink, not a packed package, so pnpm never installs
 *   the linked target's own dependency closure.
 * - a `file:` directory package whose lockfile entry carries no dependency
 *   edges (a peer backfilled by the pnpm lock-file parser when
 *   `autoInstallPeers` is off; pnpm never resolved its closure at source).
 * In both cases the target itself installs, `pnpm install --frozen-lockfile`
 * exits 0, and the target resolves its `require`s only from the deploy-root
 * node_modules, i.e. the app's direct dependencies (verified on pnpm 9.15.9).
 * A required dep of the target that is not a direct (or optional) dependency of
 * the final app manifest would fail at runtime with MODULE_NOT_FOUND, so this
 * throws at build time with the remedy.
 *
 * Only a required dep absent from the app's installed direct deps fails. A peer
 * or optional dep of the target, or a required dep present only in the app's
 * devDependencies (a `--prod` install may omit it), warns instead; these are not
 * provably broken. The app's own peerDependencies count as installed: the pruned
 * lockfile's root importer folds them into `dependencies` (mirroring pnpm's
 * autoInstallPeers), so the deploy install provides them. A backfilled `file:`
 * tarball peer's manifest is inside the archive and is not read, so its closure
 * is not validated. pnpm-only; call sites gate on the package manager.
 */
export function validatePrunedLocalPathClosure(
  packageJson: PackageJson,
  workspaceRootPath: string,
  prunedLockfileContent?: string
): void {
  if (!prunedLockfileContent) {
    return;
  }
  const parsed = parsePrunedLockfile(prunedLockfileContent);
  if (!parsed) {
    return;
  }
  const targets = new Map<string, 'link' | 'directory'>();
  // Copied workspace modules and entries with resolved edges install their
  // recorded closure and are skipped; a link: target for the same path wins the
  // kind so the failure message names the sharper cause.
  for (const [key, entry] of Object.entries(parsed.packages ?? {})) {
    const directory = entry?.resolution?.directory;
    if (
      !directory ||
      isUnderWorkspaceModules(directory) ||
      localPathEscapesOutput(directory)
    ) {
      continue;
    }
    const snapshot = parsed.snapshots?.[key] ?? entry;
    const hasEdges = LOCKFILE_DEP_SECTIONS.some(
      (section) => Object.keys(snapshot?.[section] ?? {}).length > 0
    );
    if (!hasEdges) {
      targets.set(normalizePath(directory), 'directory');
    }
  }
  for (const { target } of collectPrunedLinkTargetDirs(parsed)) {
    if (!localPathEscapesOutput(target)) {
      targets.set(target, 'link');
    }
  }
  if (targets.size === 0) {
    return;
  }
  const rootInstalled = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ]);
  const rootDev = new Set(Object.keys(packageJson.devDependencies ?? {}));
  const appName = packageJson.name || 'the app';

  for (const [target, kind] of targets) {
    const manifestPath = join(workspaceRootPath, target, 'package.json');
    if (!existsSync(manifestPath)) {
      continue;
    }
    let targetManifest: PackageJson;
    try {
      targetManifest = readJsonFile(manifestPath);
    } catch {
      continue;
    }
    const targetName = targetManifest.name || target;
    const descriptor = kind === 'link' ? 'linked package' : 'local package';

    for (const dep of Object.keys(targetManifest.dependencies ?? {})) {
      if (rootInstalled.has(dep)) {
        continue;
      }
      if (rootDev.has(dep)) {
        logger.warn(
          `${descriptor} ${targetName} requires ${dep}, which is only a devDependency of ${appName}; a production (--prod) install of the standalone deploy would omit it.`
        );
        continue;
      }
      throw new Error(
        kind === 'link'
          ? `linked package ${targetName} requires ${dep}, which won't be resolvable in the standalone deploy (link: cannot provide a self-contained dependency closure). Convert ${targetName} to a file: dependency for a self-contained artifact, or add ${dep} to ${appName}'s dependencies.`
          : `local package ${targetName} requires ${dep}, which won't be resolvable in the standalone deploy (its dependency closure was never resolved into the pruned lockfile). Declare ${targetName} as a regular dependency of the package that peer-depends on it, enable autoInstallPeers, or add ${dep} to ${appName}'s dependencies.`
      );
    }

    for (const dep of [
      ...Object.keys(targetManifest.peerDependencies ?? {}),
      ...Object.keys(targetManifest.optionalDependencies ?? {}),
    ]) {
      if (rootInstalled.has(dep) || rootDev.has(dep)) {
        continue;
      }
      logger.warn(
        `${descriptor} ${targetName} may need ${dep} at runtime, which is not a dependency of ${appName}; add it to ${appName} if it fails to resolve.`
      );
    }
  }
}

/**
 * Relocates a `file:`/`link:` specifier recorded relative to `sourceDir` so it
 * resolves from `destDir` instead (both workspace-root-relative posix paths, ''
 * meaning the workspace root itself). Returns null for a non-local-path spec.
 * When the target cannot ship into the pruned output, `spec` is returned
 * unchanged with the `reason`: absolute or escaping the workspace root
 * (`outside-workspace`), or the workspace root itself (`workspace-root`).
 * Every layer of the pruned output (app manifest, copied-module manifests,
 * lockfile snapshot refs) relocates through this one function so the layers
 * cannot disagree.
 */
export function relocatePrunedLocalPathSpec(
  spec: string,
  sourceDir: string,
  destDir: string
): { spec: string; reason?: 'outside-workspace' | 'workspace-root' } | null {
  const protocol = spec.startsWith('link:')
    ? 'link:'
    : spec.startsWith('file:')
      ? 'file:'
      : null;
  if (!protocol) {
    return null;
  }
  const rawPath = spec.slice(protocol.length);
  // join() does not reset on an absolute segment; it would silently rebase the
  // target under sourceDir, so reject absolutes up front.
  if (isAbsolute(rawPath)) {
    return { spec, reason: 'outside-workspace' };
  }
  const wsRelativeTarget = normalizePath(join(sourceDir, rawPath));
  if (wsRelativeTarget.split('/').includes('..')) {
    return { spec, reason: 'outside-workspace' };
  }
  if (wsRelativeTarget === '' || wsRelativeTarget === '.') {
    return { spec, reason: 'workspace-root' };
  }
  const relocated =
    destDir === '' || destDir === '.'
      ? wsRelativeTarget
      : normalizePath(relative(destDir, wsRelativeTarget));
  return { spec: `${protocol}${relocated}` };
}

/** Warns that a local-path target cannot ship, with the reason-specific remedy. */
export function warnUnshippableLocalPathSpec(
  description: string,
  reason: 'outside-workspace' | 'workspace-root'
): void {
  logger.warn(
    reason === 'workspace-root'
      ? `Local-path dependency ${description} resolves to the workspace root itself and cannot be shipped into the pruned output.`
      : `Local-path dependency ${description} resolves outside the workspace root and cannot be shipped into the pruned output. Vendor it inside the workspace to deploy it.`
  );
}

/**
 * Rewrites a standalone pruned manifest's non-workspace local-path specifiers
 * (`file:` tarball/dir, `link:` dir) to be relative to the workspace root, so a
 * non-frozen `pnpm install` of the deploy output resolves them: pnpm re-resolves
 * a manifest specifier relative to the referencing package, and the deploy root
 * is the workspace root, so the shipped source (see
 * `getPrunedPnpmLocalPathArtifacts`) sits at that path. Mutates `packageJson` in
 * place. pnpm-only; call sites gate on the package manager (the rewrite must not
 * touch npm/yarn/bun manifests).
 *
 * Per specifier, in order: resolve a `catalog:` reference first (the bundler's
 * `createPackageJson` does not), skip a workspace package (copied to
 * `workspace_modules/`), then relocate a non-workspace local path from
 * `projectRoot`-relative to workspace-root-relative. A `file:`/`link:` peer
 * dependency is moved into `dependencies` with its `peerDependenciesMeta` entry
 * dropped even when the target cannot ship (pnpm rejects a `file:`/`link:` spec
 * under peerDependencies outright, so leaving it would fail the whole install),
 * mirroring the workspace-module handling. An unshippable target otherwise keeps
 * its specifier, with a warning (see `getPrunedPnpmLocalPathArtifacts`).
 */
export function rewritePrunedLocalPathSpecifiers(
  packageJson: PackageJson,
  projectRoot: string,
  workspaceRootPath: string,
  workspacePackageNames: Set<string>
): void {
  const catalogManager = getCatalogManager(workspaceRootPath);
  const sections: PackageJsonDependencySection[] = [
    'dependencies',
    'optionalDependencies',
    'devDependencies',
    'peerDependencies',
  ];
  for (const section of sections) {
    const deps = packageJson[section];
    if (!deps) {
      continue;
    }
    for (const [name, specifier] of Object.entries(deps)) {
      let resolved = specifier;
      if (catalogManager?.isCatalogReference(specifier)) {
        const resolvedCatalog = catalogManager.resolveCatalogReference(
          workspaceRootPath,
          name,
          specifier
        );
        if (resolvedCatalog) {
          resolved = resolvedCatalog;
          deps[name] = resolvedCatalog;
        }
      }
      if (workspacePackageNames.has(name)) {
        continue;
      }
      const relocation = relocatePrunedLocalPathSpec(resolved, projectRoot, '');
      if (!relocation) {
        continue;
      }
      if (relocation.reason) {
        warnUnshippableLocalPathSpec(
          `"${name}": "${resolved}"`,
          relocation.reason
        );
      }
      if (section === 'peerDependencies') {
        // pnpm rejects a file:/link: spec under peerDependencies, so move it into
        // dependencies (matching the workspace-module handling) and drop the
        // now-orphaned peerDependenciesMeta entry.
        packageJson.dependencies ??= {};
        packageJson.dependencies[name] = relocation.spec;
        delete deps[name];
        if (packageJson.peerDependenciesMeta) {
          delete packageJson.peerDependenciesMeta[name];
        }
      } else if (!relocation.reason) {
        deps[name] = relocation.spec;
      }
    }
  }
}

/**
 * Emits the pnpm install-time artifacts a standalone pruned output needs through
 * a caller-provided `emit` sink: the pnpm 11 settings-only pnpm-workspace.yaml
 * (see `getPrunedPnpmInstallSettingsYaml`), the `pnpm patch` files, and the
 * non-workspace local-path dependencies (`file:` tarballs/dirs and `link:`
 * targets, see `getPrunedPnpmLocalPathArtifacts`), plus, for pnpm <=10, the
 * build-script approvals and `patchedDependencies` declaration folded into
 * `packageJson` in place (see `getPrunedPnpmPackageJsonBuildSettings`).
 * The bundler plugins (webpack, rspack) hold the manifest in memory and emit it
 * as a compilation asset after this returns, so the pnpm <=10 additions are
 * mutated onto `packageJson` rather than written; the file-writing executors use
 * `writePrunedPnpmInstallSettings` instead.
 * Pass `includeLocalPathArtifacts: false` when the lockfile is createLockFile's
 * root-lockfile fallback: its importer references the whole workspace, so
 * shipping its local-path trees would copy unrelated sources into the output.
 */
export function emitPrunedPnpmInstallAssets(
  workspaceRootPath: string,
  prunedLockfileContent: string,
  packageJson: PackageJson,
  emit: (assetPath: string, content: string | Buffer) => void,
  options?: { includeLocalPathArtifacts?: boolean }
): void {
  const config: PrunedPnpmConfig = {
    pnpmMajor: getPnpmMajor(workspaceRootPath),
    patchedDependencies: getPrunedPatchedDependencies(
      workspaceRootPath,
      prunedLockfileContent
    ),
  };
  // Resolve the patch files first so a colliding patch path aborts before any
  // asset is emitted.
  const { patchFiles, packageJsonPatchedDependencies } =
    getPrunedPnpmPatchArtifacts(
      workspaceRootPath,
      prunedLockfileContent,
      config
    );
  const yaml = getPrunedPnpmInstallSettingsYaml(
    workspaceRootPath,
    prunedLockfileContent,
    config
  );
  if (yaml !== null) {
    emit('pnpm-workspace.yaml', yaml);
  }
  for (const { path, content } of patchFiles) {
    emit(path, content);
  }
  if (options?.includeLocalPathArtifacts !== false) {
    for (const { path, sourcePath } of getPrunedPnpmLocalPathArtifacts(
      workspaceRootPath,
      prunedLockfileContent
    )) {
      emit(path, readFileSync(sourcePath));
    }
  }
  const buildSettings = getPrunedPnpmPackageJsonBuildSettings(
    workspaceRootPath,
    prunedLockfileContent,
    config
  );
  applyPrunedPnpmPackageJsonSettings(
    packageJson,
    buildSettings,
    packageJsonPatchedDependencies
  );
}

/**
 * Writes the pnpm install-time artifacts a standalone pruned output needs into
 * `outputDirectory`: the pnpm 11 settings-only pnpm-workspace.yaml (see
 * `getPrunedPnpmInstallSettingsYaml`), the `pnpm patch` files, and the
 * non-workspace local-path dependencies (`file:` tarballs/dirs and `link:`
 * targets), plus the pnpm <=10 build-script approvals and
 * `patchedDependencies` declaration in the emitted package.json. Does nothing for
 * whatever the workspace does not use, and removes a stale pnpm-workspace.yaml a
 * prior deploy left when the output no longer has settings. `allowBuilds` and the
 * patch scope come from `lockfileContent` when the caller already has it in hand,
 * otherwise from the pruned lockfile it just wrote to `outputDirectory`.
 * Pass `includeLocalPathArtifacts: false` when the lockfile is createLockFile's
 * root-lockfile fallback: its importer references the whole workspace, so
 * shipping its local-path trees would copy unrelated sources into the output.
 */
export function writePrunedPnpmInstallSettings(
  outputDirectory: string,
  workspaceRootPath: string = workspaceRoot,
  lockfileContent?: string,
  options?: { includeLocalPathArtifacts?: boolean }
): void {
  const prunedLockfileContent =
    lockfileContent ?? readPrunedLockfile(outputDirectory);
  const config: PrunedPnpmConfig = {
    pnpmMajor: getPnpmMajor(workspaceRootPath),
    patchedDependencies: getPrunedPatchedDependencies(
      workspaceRootPath,
      prunedLockfileContent
    ),
  };
  // Resolve the patch files first so a colliding patch path aborts before any
  // file is written.
  const { patchFiles, packageJsonPatchedDependencies } =
    getPrunedPnpmPatchArtifacts(
      workspaceRootPath,
      prunedLockfileContent,
      config
    );
  const yaml = getPrunedPnpmInstallSettingsYaml(
    workspaceRootPath,
    prunedLockfileContent,
    config
  );
  const settingsPath = join(outputDirectory, 'pnpm-workspace.yaml');
  if (yaml !== null) {
    writeFileSync(settingsPath, yaml);
  } else if (existsSync(settingsPath)) {
    // A cache replay restores only the files the newer entry holds, so once the
    // settings empty out a prior deploy's pnpm-workspace.yaml would linger and
    // pnpm 11 would read its patchedDependencies as a lockfile mismatch. Drop it.
    rmSync(settingsPath);
  }
  // Directory trees flow through here one file at a time, so dedupe the
  // recursive mkdir per destination directory.
  const createdDirs = new Set<string>();
  const ensureDir = (dir: string): void => {
    if (!createdDirs.has(dir)) {
      mkdirSync(dir, { recursive: true });
      createdDirs.add(dir);
    }
  };
  for (const { path, content } of patchFiles) {
    const destination = join(outputDirectory, path);
    ensureDir(dirname(destination));
    writeFileSync(destination, content);
  }
  if (options?.includeLocalPathArtifacts !== false) {
    for (const { path, sourcePath } of getPrunedPnpmLocalPathArtifacts(
      workspaceRootPath,
      prunedLockfileContent
    )) {
      const destination = join(outputDirectory, path);
      ensureDir(dirname(destination));
      copyFileSync(sourcePath, destination);
    }
  }
  const buildSettings = getPrunedPnpmPackageJsonBuildSettings(
    workspaceRootPath,
    prunedLockfileContent,
    config
  );
  if (buildSettings || packageJsonPatchedDependencies) {
    const packageJsonPath = join(outputDirectory, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson: PackageJson = readJsonFile(packageJsonPath);
      applyPrunedPnpmPackageJsonSettings(
        packageJson,
        buildSettings,
        packageJsonPatchedDependencies
      );
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
