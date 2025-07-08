import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { NxJsonConfiguration } from '../config/nx-json';
import {
  ProjectConfiguration,
  ProjectMetadata,
  TargetConfiguration,
} from '../config/workspace-json-project-json';
import { mergeTargetConfigurations } from '../project-graph/utils/project-configuration-utils';
import { readJsonFile } from './fileutils';
import { getNxRequirePaths } from './installation-directory';
import {
  getPackageManagerCommand,
  PackageManagerCommands,
} from './package-manager';

export interface NxProjectPackageJsonConfiguration
  extends Partial<ProjectConfiguration> {
  includedScripts?: string[];
}

export type ArrayPackageGroup = { package: string; version: string }[];
export type MixedPackageGroup =
  | (string | { package: string; version: string })[]
  | Record<string, string>;
export type PackageGroup = MixedPackageGroup | ArrayPackageGroup;

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

let packageManagerCommand: PackageManagerCommands | undefined;

export function getMetadataFromPackageJson(
  packageJson: PackageJson,
  isInPackageManagerWorkspaces: boolean
): ProjectMetadata {
  const { scripts, nx, description, name, exports, main } = packageJson;
  const includedScripts = nx?.includedScripts || Object.keys(scripts ?? {});
  return {
    targetGroups: {
      ...(includedScripts.length ? { 'NPM Scripts': includedScripts } : {}),
    },
    description,
    js: {
      packageName: name,
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
  workspaceRoot: string
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
      res[targetName]
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
    // TODO: Talk to @jason about this.
    /**
     * The problem with this is that for ts solution workspaces where a project may have the `@nx/js` package as a dependency.
     * This will resolve the package to the project's source directory instead of the module at the workspace root.
     * When we require.resolve('@nx/js') who's main file is `index.js`, it will resolve to the project's source directory which does not contain the `index.js` file.
     * Which triggers and error returns false and does not apply the `nx-release-publish` target.
     */
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
  requirePaths = getNxRequirePaths()
): {
  packageJson: PackageJson;
  path: string;
} {
  // Get stack trace to see who called this function
  const stack = new Error().stack;
  const caller = stack?.split('\n')[2]?.trim() || 'unknown';

  console.log(
    `[readModulePackageJsonWithoutFallbacks] Resolving ${moduleSpecifier}/package.json`
  );
  console.log(`[readModulePackageJsonWithoutFallbacks] Called from: ${caller}`);
  console.log(
    `[readModulePackageJsonWithoutFallbacks] Current working directory: ${process.cwd()}`
  );
  console.log(
    `[readModulePackageJsonWithoutFallbacks] NODE_PATH: ${
      process.env.NODE_PATH || 'undefined'
    }`
  );
  console.log(
    `[readModulePackageJsonWithoutFallbacks] Require paths provided: ${requirePaths.join(
      ', '
    )}`
  );
  console.log(
    `[readModulePackageJsonWithoutFallbacks] Default getNxRequirePaths(): ${getNxRequirePaths().join(
      ', '
    )}`
  );

  // Check what's actually in the provided paths
  requirePaths.forEach((path) => {
    const packagePath = join(
      path,
      'node_modules',
      moduleSpecifier,
      'package.json'
    );
    const packageDirPath = join(path, 'node_modules', moduleSpecifier);
    console.log(
      `[readModulePackageJsonWithoutFallbacks] Checking: ${packagePath} -> exists: ${existsSync(
        packagePath
      )}`
    );
    console.log(
      `[readModulePackageJsonWithoutFallbacks] Checking dir: ${packageDirPath} -> exists: ${existsSync(
        packageDirPath
      )}`
    );
    if (existsSync(packageDirPath)) {
      console.log(
        `[readModulePackageJsonWithoutFallbacks] ${packageDirPath} is symlink: ${
          existsSync(packageDirPath) &&
          require('fs').lstatSync(packageDirPath).isSymbolicLink()
        }`
      );
    }
  });

  // Try without paths first
  try {
    const withoutPaths = require.resolve(`${moduleSpecifier}/package.json`);
    console.log(
      `[readModulePackageJsonWithoutFallbacks] Without paths: ${withoutPaths}`
    );
  } catch (e) {
    console.log(
      `[readModulePackageJsonWithoutFallbacks] Without paths: FAILED - ${e.message}`
    );
  }

  // Try with empty paths array
  try {
    const emptyPaths = require.resolve(`${moduleSpecifier}/package.json`, {
      paths: [],
    });
    console.log(
      `[readModulePackageJsonWithoutFallbacks] With empty paths: ${emptyPaths}`
    );
  } catch (e) {
    console.log(
      `[readModulePackageJsonWithoutFallbacks] With empty paths: FAILED - ${e.message}`
    );
  }

  const packageJsonPath: string = require.resolve(
    `${moduleSpecifier}/package.json`,
    {
      paths: requirePaths,
    }
  );
  console.log(
    `[readModulePackageJsonWithoutFallbacks] With paths resolved to: ${packageJsonPath}`
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

  console.log(`[readModulePackageJson] Resolving ${moduleSpecifier}`);
  console.log(
    `[readModulePackageJson] Require paths: ${requirePaths.join(', ')}`
  );

  try {
    ({ path: packageJsonPath, packageJson } =
      readModulePackageJsonWithoutFallbacks(moduleSpecifier, requirePaths));
    console.log(
      `[readModulePackageJson] Resolved via primary method: ${packageJsonPath}`
    );
  } catch (e) {
    console.log(
      `[readModulePackageJson] Primary method failed: ${e.message}, using fallback`
    );
    console.log(
      `[readModulePackageJson] Fallback require.resolve with paths: ${requirePaths.join(
        ', '
      )}`
    );
    const entryPoint = require.resolve(moduleSpecifier, {
      paths: requirePaths,
    });
    console.log(
      `[readModulePackageJson] Entry point resolved to: ${entryPoint}`
    );

    let moduleRootPath = dirname(entryPoint);
    packageJsonPath = join(moduleRootPath, 'package.json');

    while (!existsSync(packageJsonPath)) {
      moduleRootPath = dirname(moduleRootPath);
      packageJsonPath = join(moduleRootPath, 'package.json');
    }

    console.log(
      `[readModulePackageJson] Final package.json path: ${packageJsonPath}`
    );
    packageJson = readJsonFile(packageJsonPath);
    if (packageJson.name && packageJson.name !== moduleSpecifier) {
      throw new Error(
        `Found module ${packageJson.name} while trying to locate ${moduleSpecifier}/package.json`
      );
    }
  }

  console.log(
    `[readModulePackageJson] ${moduleSpecifier} version: ${packageJson.version}, resolved to: ${packageJsonPath}`
  );

  return {
    packageJson,
    path: packageJsonPath,
  };
}
