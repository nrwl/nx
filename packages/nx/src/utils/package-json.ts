import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { existsSync, writeFileSync } from 'fs';
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
import { mergeTargetConfigurations } from '../project-graph/utils/project-configuration-utils';
import { getCatalogManager } from './catalog';
import { readJsonFile } from './fileutils';
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
  };
  overrides?: PackageOverride;
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
  };
}

export function normalizePackageGroup(
  packageGroup: PackageGroup,
): ArrayPackageGroup {
  return Array.isArray(packageGroup)
    ? packageGroup.map((x) =>
      typeof x === 'string' ? { package: x, version: '*' } : x,
    )
    : Object.entries(packageGroup).map(([pkg, version]) => ({
      package: pkg,
      version,
    }));
}

export function readNxMigrateConfig(
  json: Partial<PackageJson>,
): NxMigrationsConfiguration & { packageGroup?: ArrayPackageGroup } {
  const parseNxMigrationsConfig = (
    fromJson?: string | NxMigrationsConfiguration,
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
  packageManagerCommand: PackageManagerCommands,
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

let packageManagerCommand: PackageManagerCommands | undefined;

export function getMetadataFromPackageJson(
  packageJson: PackageJson,
  isInPackageManagerWorkspaces: boolean,
): ProjectMetadata {
  const { scripts, nx, description, name, exports, main, version } =
    packageJson;
  const includedScripts = nx?.includedScripts || Object.keys(scripts ?? {});
  return {
    targetGroups: {
      ...(includedScripts.length ? { 'NPM Scripts': includedScripts } : {}),
    },
    description,
    js: {
      packageName: name,
      packageVersion: version,
      packageExports: exports,
      packageMain: main,
      isInPackageManagerWorkspaces,
    },
  };
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
) {
  const { scripts, nx, private: isPrivate } = packageJson ?? {};
  const res: Record<string, TargetConfiguration> = {};
  const includedScripts = nx?.includedScripts || Object.keys(scripts ?? {});
  for (const script of includedScripts) {
    packageManagerCommand ??= getPackageManagerCommand();
    res[script] = buildTargetFromScript(script, scripts, packageManagerCommand);
  }
  for (const targetName in nx?.targets) {
    res[targetName] = mergeTargetConfigurations(
      nx?.targets[targetName],
      res[targetName],
    );
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
    const nxReleasePublishTargetDefaults =
      nxJson?.targetDefaults?.['nx-release-publish'] ?? {};
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

function hasNxJsPlugin(projectRoot: string, workspaceRoot: string) {
  try {
    // nx-ignore-next-line
    require.resolve('@nx/js/package.json', {
      paths: [projectRoot, ...getNxRequirePaths(workspaceRoot), __dirname],
    });
    return true;
  } catch {
    return false;
  }
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
  requirePaths = getNxRequirePaths(),
): {
  packageJson: PackageJson;
  path: string;
} {
  const packageJsonPath: string = require.resolve(
    `${moduleSpecifier}/package.json`,
    {
      paths: requirePaths,
    },
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
  requirePaths = getNxRequirePaths(),
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
        `Found module ${packageJson.name} while trying to locate ${moduleSpecifier}/package.json`,
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
function preparePackageInstallation(pkg: string, requiredVersion: string) {
  const { dir: tempDir, cleanup } = createTempNpmDirectory?.() ?? {
    dir: dirSync().name,
    cleanup: () => {
    },
  };

  console.log(`Fetching ${pkg}...`);
  const packageManager = detectPackageManager();
  const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';
  generatePackageManagerFiles(tempDir, packageManager);

  const preInstallCommand = getPackageManagerCommand(packageManager).preInstall;
  const pmCommands = getPackageManagerCommand(packageManager);
  let addCommand = pmCommands.addDev;
  if (packageManager === 'pnpm') {
    addCommand = 'pnpm add -D'; // we need to ensure that we are not using workspace command
  }

  const installCommand = `${addCommand} ${pkg}@${requiredVersion} ${
    pmCommands.ignoreScriptsFlag ?? ''
  }`;

  const execOptions = {
    cwd: tempDir,
    stdio: isVerbose ? 'inherit' : 'ignore',
    windowsHide: true,
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
): {
  tempDir: string;
  cleanup: () => void;
} {
  const { tempDir, cleanup, preInstallCommand, installCommand, execOptions } =
    preparePackageInstallation(pkg, requiredVersion);

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
): Promise<{
  tempDir: string;
  cleanup: () => void;
}> {
  const { tempDir, cleanup, preInstallCommand, installCommand, execOptions } =
    preparePackageInstallation(pkg, requiredVersion);

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
  dependencyLookup?: PackageJsonDependencySection[],
): string | null;
export function getDependencyVersionFromPackageJson(
  tree: Tree,
  packageName: string,
  packageJson?: PackageJson,
  dependencyLookup?: PackageJsonDependencySection[],
): string | null;
export function getDependencyVersionFromPackageJson(
  packageName: string,
  workspaceRootPath?: string,
  packageJsonPath?: string,
  dependencyLookup?: PackageJsonDependencySection[],
): string | null;
export function getDependencyVersionFromPackageJson(
  packageName: string,
  workspaceRootPath?: string,
  packageJson?: PackageJson,
  dependencyLookup?: PackageJsonDependencySection[],
): string | null;
export function getDependencyVersionFromPackageJson(
  treeOrPackageName: Tree | string,
  packageNameOrRoot?: string,
  packageJsonPathOrObjectOrRoot?: string | PackageJson,
  dependencyLookup?: PackageJsonDependencySection[],
): string | null {
  if (typeof treeOrPackageName !== 'string') {
    return getDependencyVersionFromPackageJsonFromTree(
      treeOrPackageName,
      packageNameOrRoot!,
      packageJsonPathOrObjectOrRoot,
      dependencyLookup,
    );
  } else {
    return getDependencyVersionFromPackageJsonFromFileSystem(
      treeOrPackageName,
      packageNameOrRoot,
      packageJsonPathOrObjectOrRoot,
      dependencyLookup,
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
  ],
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
  ],
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
  packageManager: PackageManager = detectPackageManager(),
) {
  const [pmMajor] = getPackageManagerVersion(packageManager).split('.');
  switch (packageManager) {
    case 'yarn':
      if (+pmMajor >= 2) {
        writeFileSync(
          join(root, '.yarnrc.yml'),
          'nodeLinker: node-modules\nenableScripts: false',
        );
      }
      break;
  }
}
