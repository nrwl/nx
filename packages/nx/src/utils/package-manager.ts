import { exec, execSync } from 'child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import {
  Pair,
  ParsedNode,
  parseDocument,
  stringify as YAMLStringify,
  YAMLMap,
  YAMLSeq,
  Scalar,
} from 'yaml';
import { rm } from 'node:fs/promises';
import { dirname, join, relative } from 'path';
import { gte, lt, parse, satisfies } from 'semver';
import { dirSync } from 'tmp';
import { promisify } from 'util';

import { readNxJson } from '../config/configuration';
import { readPackageJson } from '../project-graph/file-utils';
import {
  readFileIfExisting,
  readJsonFile,
  readYamlFile,
  writeJsonFile,
} from './fileutils';
import { getNxInstallationPath } from './installation-directory';
import { PackageJson, readModulePackageJson } from './package-json';
import { workspaceRoot } from './workspace-root';

const execAsync = promisify(exec);

export type PackageManager = 'yarn' | 'pnpm' | 'npm' | 'bun';

export interface PackageManagerCommands {
  preInstall?: string;
  install: string;
  ciInstall: string;
  updateLockFile: string;
  add: string;
  addDev: string;
  rm: string;
  exec: string;
  dlx: string;
  list: string;
  run: (script: string, args?: string) => string;
  // Make this required once bun adds programatically support for reading config https://github.com/oven-sh/bun/issues/7140
  getRegistryUrl?: string;
  publish: (
    packageRoot: string,
    registry: string,
    registryConfigKey: string,
    tag: string
  ) => string;
}

/**
 * Detects which package manager is used in the workspace based on the lock file.
 */
export function detectPackageManager(dir: string = ''): PackageManager {
  const nxJson = readNxJson();
  return (
    nxJson.cli?.packageManager ??
    (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))
      ? 'bun'
      : existsSync(join(dir, 'yarn.lock'))
      ? 'yarn'
      : existsSync(join(dir, 'pnpm-lock.yaml'))
      ? 'pnpm'
      : 'npm')
  );
}

/**
 * Returns true if the workspace is using npm workspaces, yarn workspaces, or pnpm workspaces.
 * @param packageManager The package manager to use. If not provided, it will be detected based on the lock file.
 * @param root The directory the commands will be ran inside of. Defaults to the current workspace's root.
 */
export function isWorkspacesEnabled(
  packageManager: PackageManager = detectPackageManager(),
  root: string = workspaceRoot
): boolean {
  if (packageManager === 'pnpm') {
    if (!existsSync(join(root, 'pnpm-workspace.yaml'))) {
      return false;
    }

    try {
      const content = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf-8');
      const { load } = require('@zkochan/js-yaml');
      const { packages } = load(content) ?? {};
      return packages !== undefined;
    } catch {
      return false;
    }
  }

  // yarn and npm both use the same 'workspaces' property in package.json
  const packageJson: PackageJson = readPackageJson(root);
  return !!packageJson?.workspaces;
}

/**
 * Returns commands for the package manager used in the workspace.
 * By default, the package manager is derived based on the lock file,
 * but it can also be passed in explicitly.
 *
 * Example:
 *
 * ```javascript
 * execSync(`${getPackageManagerCommand().addDev} my-dev-package`);
 * ```
 *
 * @param packageManager The package manager to use. If not provided, it will be detected based on the lock file.
 * @param root The directory the commands will be ran inside of. Defaults to the current workspace's root.
 */
export function getPackageManagerCommand(
  packageManager: PackageManager = detectPackageManager(),
  root: string = workspaceRoot
): PackageManagerCommands {
  const commands: { [pm in PackageManager]: () => PackageManagerCommands } = {
    yarn: () => {
      let yarnVersion: string, useBerry: boolean;
      try {
        yarnVersion = getPackageManagerVersion('yarn', root);
        useBerry = gte(yarnVersion, '2.0.0');
      } catch {
        yarnVersion = 'latest';
        useBerry = true;
      }

      return {
        preInstall: `yarn set version ${yarnVersion}`,
        install: 'yarn',
        ciInstall: useBerry
          ? 'yarn install --immutable'
          : 'yarn install --frozen-lockfile',
        updateLockFile: useBerry
          ? 'yarn install --mode update-lockfile'
          : 'yarn install',
        add: useBerry ? 'yarn add' : 'yarn add -W',
        addDev: useBerry ? 'yarn add -D' : 'yarn add -D -W',
        rm: 'yarn remove',
        exec: 'yarn',
        dlx: useBerry ? 'yarn dlx' : 'yarn',
        run: (script: string, args?: string) =>
          `yarn ${script}${args ? ` ${args}` : ''}`,
        list: useBerry ? 'yarn info --name-only' : 'yarn list',
        getRegistryUrl: useBerry
          ? 'yarn config get npmRegistryServer'
          : 'yarn config get registry',
        publish: (packageRoot, registry, registryConfigKey, tag) =>
          `npm publish "${packageRoot}" --json --"${registryConfigKey}=${registry}" --tag=${tag}`,
      };
    },
    pnpm: () => {
      let modernPnpm: boolean,
        includeDoubleDashBeforeArgs: boolean,
        allowRegistryConfigKey: boolean;
      try {
        const pnpmVersion = getPackageManagerVersion('pnpm', root);
        modernPnpm = gte(pnpmVersion, '6.13.0');
        includeDoubleDashBeforeArgs = lt(pnpmVersion, '7.0.0');
        // Support for --@scope:registry was added in pnpm v10.5.0 and backported to v9.15.7.
        // Versions >=10.0.0 and <10.5.0 do NOT support this CLI option.
        allowRegistryConfigKey = satisfies(
          pnpmVersion,
          '>=9.15.7 <10.0.0 || >=10.5.0'
        );
      } catch {
        modernPnpm = true;
        includeDoubleDashBeforeArgs = true;
        allowRegistryConfigKey = false;
      }

      const isPnpmWorkspace = existsSync(join(root, 'pnpm-workspace.yaml'));
      return {
        install: 'pnpm install --no-frozen-lockfile', // explicitly disable in case of CI
        ciInstall: 'pnpm install --frozen-lockfile',
        updateLockFile: 'pnpm install --lockfile-only',
        add: isPnpmWorkspace ? 'pnpm add -w' : 'pnpm add',
        addDev: isPnpmWorkspace ? 'pnpm add -Dw' : 'pnpm add -D',
        rm: 'pnpm rm',
        exec: modernPnpm ? 'pnpm exec' : 'pnpx',
        dlx: modernPnpm ? 'pnpm dlx' : 'pnpx',
        run: (script: string, args?: string) =>
          `pnpm run ${script}${
            args
              ? includeDoubleDashBeforeArgs
                ? ' -- ' + args
                : ` ${args}`
              : ''
          }`,
        list: 'pnpm ls --depth 100',
        getRegistryUrl: 'pnpm config get registry',
        publish: (packageRoot, registry, registryConfigKey, tag) =>
          `pnpm publish "${packageRoot}" --json --"${
            allowRegistryConfigKey ? registryConfigKey : 'registry'
          }=${registry}" --tag=${tag} --no-git-checks`,
      };
    },
    npm: () => {
      // TODO: Remove this
      process.env.npm_config_legacy_peer_deps ??= 'true';

      return {
        install: 'npm install',
        ciInstall: 'npm ci --legacy-peer-deps',
        updateLockFile: 'npm install --package-lock-only',
        add: 'npm install',
        addDev: 'npm install -D',
        rm: 'npm rm',
        exec: 'npx',
        dlx: 'npx',
        run: (script: string, args?: string) =>
          `npm run ${script}${args ? ' -- ' + args : ''}`,
        list: 'npm ls',
        getRegistryUrl: 'npm config get registry',
        publish: (packageRoot, registry, registryConfigKey, tag) =>
          `npm publish "${packageRoot}" --json --"${registryConfigKey}=${registry}" --tag=${tag}`,
      };
    },
    bun: () => {
      // bun doesn't current support programmatically reading config https://github.com/oven-sh/bun/issues/7140
      return {
        install: 'bun install',
        ciInstall: 'bun install --no-cache',
        updateLockFile: 'bun install --frozen-lockfile',
        add: 'bun install',
        addDev: 'bun install -D',
        rm: 'bun rm',
        exec: 'bun',
        dlx: 'bunx',
        run: (script: string, args: string) => `bun run ${script} -- ${args}`,
        list: 'bun pm ls',
        // Unlike npm, bun publish does not support a custom registryConfigKey option
        publish: (packageRoot, registry, registryConfigKey, tag) =>
          `bun publish --cwd="${packageRoot}" --json --registry="${registry}" --tag=${tag}`,
      };
    },
  };

  return commands[packageManager]();
}

/**
 * Returns the version of the package manager used in the workspace.
 * By default, the package manager is derived based on the lock file,
 * but it can also be passed in explicitly.
 */
export function getPackageManagerVersion(
  packageManager: PackageManager = detectPackageManager(),
  cwd = process.cwd()
): string {
  let version: string;
  if (existsSync(join(cwd, 'package.json'))) {
    const packageManagerEntry = readJsonFile<PackageJson>(
      join(cwd, 'package.json')
    )?.packageManager;
    version = parseVersionFromPackageManagerField(
      packageManager,
      packageManagerEntry
    );
  }
  if (!version) {
    try {
      version = execSync(`${packageManager} --version`, {
        cwd,
        encoding: 'utf-8',
        windowsHide: true,
      }).trim();
    } catch {}
  }
  if (!version) {
    throw new Error(`Cannot determine the version of ${packageManager}.`);
  }
  return version;
}

export function parseVersionFromPackageManagerField(
  requestedPackageManager: string,
  packageManagerFieldValue: string | undefined
): null | string {
  if (!packageManagerFieldValue) return null;
  const [packageManagerFromPackageJson, versionFromPackageJson] =
    packageManagerFieldValue.split('@');
  if (
    versionFromPackageJson &&
    // If it's a URL, it's not a valid range by default, unless users set `COREPACK_ENABLE_UNSAFE_CUSTOM_URLS=1`.
    // In the unsafe case, there's no way to reliably pare out the version since it could be anything, e.g. http://mydomain.com/bin/yarn.js.
    // See: https://github.com/nodejs/corepack/blob/2b43f26/sources/corepackUtils.ts#L110-L112
    !URL.canParse(versionFromPackageJson) &&
    packageManagerFromPackageJson === requestedPackageManager &&
    versionFromPackageJson
  ) {
    // The range could have a validation hash attached, like "3.2.3+sha224.953c8233f7a92884eee2de69a1b92d1f2ec1655e66d08071ba9a02fa".
    // We just want to parse out the "<major>.<minor>.<patch>". Semver treats "+" as a build, which is not included in the resulting version.
    return parse(versionFromPackageJson)?.version ?? null;
  }
  return null;
}

/**
 * Checks for a project level npmrc file by crawling up the file tree until
 * hitting a package.json file, as this is how npm finds them as well.
 */
export function findFileInPackageJsonDirectory(
  file: string,
  directory: string = process.cwd()
): string | null {
  while (!existsSync(join(directory, 'package.json'))) {
    if (directory === workspaceRoot) {
      // we reached the workspace root and we didn't find a package.json file
      return null;
    }
    directory = dirname(directory);
  }
  const path = join(directory, file);
  return existsSync(path) ? path : null;
}

/**
 * We copy yarnrc.yml to the temporary directory to ensure things like the specified
 * package registry are still used. However, there are a few relative paths that can
 * cause issues, so we modify them to fit the new directory.
 *
 * Exported for testing - not meant to be used outside of this file.
 *
 * @param contents The string contents of the yarnrc.yml file
 * @returns Updated string contents of the yarnrc.yml file
 */
export function modifyYarnRcYmlToFitNewDirectory(contents: string): string {
  const { parseSyml, stringifySyml } = require('@yarnpkg/parsers');
  const parsed: {
    yarnPath?: string;
    plugins?: (string | { path: string; spec: string })[];
  } = parseSyml(contents);

  if (parsed.yarnPath) {
    // yarnPath is relative to the workspace root, so we need to make it relative
    // to the new directory s.t. it still points to the same yarn binary.
    delete parsed.yarnPath;
  }
  if (parsed.plugins) {
    // Plugins specified by a string are relative paths from workspace root.
    // ex: https://yarnpkg.com/advanced/plugin-tutorial#writing-our-first-plugin
    delete parsed.plugins;
  }
  return stringifySyml(parsed);
}

/**
 * We copy .yarnrc to the temporary directory to ensure things like the specified
 * package registry are still used. However, there are a few relative paths that can
 * cause issues, so we modify them to fit the new directory.
 *
 * Exported for testing - not meant to be used outside of this file.
 *
 * @param contents The string contents of the yarnrc.yml file
 * @returns Updated string contents of the yarnrc.yml file
 */
export function modifyYarnRcToFitNewDirectory(contents: string): string {
  const lines = contents.split('\n');
  const yarnPathIndex = lines.findIndex((line) => line.startsWith('yarn-path'));
  if (yarnPathIndex !== -1) {
    lines.splice(yarnPathIndex, 1);
  }
  return lines.join('\n');
}

export function copyPackageManagerConfigurationFiles(
  root: string,
  destination: string
) {
  for (const packageManagerConfigFile of [
    '.npmrc',
    '.yarnrc',
    '.yarnrc.yml',
    'bunfig.toml',
  ]) {
    // f is an absolute path, including the {workspaceRoot}.
    const f = findFileInPackageJsonDirectory(packageManagerConfigFile, root);
    if (f) {
      // Destination should be the same relative path from the {workspaceRoot},
      // but now relative to the destination. `relative` makes `{workspaceRoot}/some/path`
      // look like `./some/path`, and joining that gets us `{destination}/some/path
      const destinationPath = join(destination, relative(root, f));
      switch (packageManagerConfigFile) {
        case '.npmrc': {
          copyFileSync(f, destinationPath);
          break;
        }
        case '.yarnrc': {
          const updated = modifyYarnRcToFitNewDirectory(readFileIfExisting(f));
          writeFileSync(destinationPath, updated);
          break;
        }
        case '.yarnrc.yml': {
          const updated = modifyYarnRcYmlToFitNewDirectory(
            readFileIfExisting(f)
          );
          writeFileSync(destinationPath, updated);
          break;
        }
        case 'bunfig.toml': {
          copyFileSync(f, destinationPath);
          break;
        }
      }
    }
  }
}

/**
 * Creates a temporary directory where you can run package manager commands safely.
 *
 * For cases where you'd want to install packages that require an `.npmrc` set up,
 * this function looks up for the nearest `.npmrc` (if exists) and copies it over to the
 * temp directory.
 *
 * @param skipCopy - If true, skips copying package manager configuration files to the temporary directory.
 *                   This is useful when creating a workspace from scratch (e.g., in create-nx-workspace)
 *                   where no existing configuration files are available to copy.
 */
export function createTempNpmDirectory(skipCopy = false) {
  const dir = dirSync().name;

  // A package.json is needed for pnpm pack and for .npmrc to resolve
  writeJsonFile(`${dir}/package.json`, {});
  if (!skipCopy) {
    const isNonJs = !existsSync(join(workspaceRoot, 'package.json'));
    copyPackageManagerConfigurationFiles(
      isNonJs ? getNxInstallationPath(workspaceRoot) : workspaceRoot,
      dir
    );
  }

  const cleanup = async () => {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // It's okay if this fails, the OS will clean it up eventually
    }
  };

  return { dir, cleanup };
}

/**
 * Returns the resolved version for a given package and version tag using the
 * NPM registry (when using Yarn it will fall back to NPM to fetch the info).
 */
export async function resolvePackageVersionUsingRegistry(
  packageName: string,
  version: string
): Promise<string> {
  try {
    const result = await packageRegistryView(packageName, version, 'version');

    if (!result) {
      throw new Error(`Unable to resolve version ${packageName}@${version}.`);
    }

    const lines = result.split('\n');
    if (lines.length === 1) {
      return lines[0];
    }

    /**
     * The output contains multiple lines ordered by release date, so the last
     * version might not be the last one in the list. We need to sort it. Each
     * line looks like:
     *
     * <package>@<version> '<version>'
     */
    const resolvedVersion = lines
      .map((line) => line.split(' ')[1])
      .sort()
      .pop()
      .replace(/'/g, '');

    return resolvedVersion;
  } catch {
    throw new Error(`Unable to resolve version ${packageName}@${version}.`);
  }
}

/**
 * Return the resolved version for a given package and version tag using by
 * installing it in a temporary directory and fetching the version from the
 * package.json.
 */
export async function resolvePackageVersionUsingInstallation(
  packageName: string,
  version: string
): Promise<string> {
  const { dir, cleanup } = createTempNpmDirectory();

  try {
    const pmc = getPackageManagerCommand();
    await execAsync(`${pmc.add} ${packageName}@${version}`, {
      cwd: dir,
      windowsHide: true,
    });

    const { packageJson } = readModulePackageJson(packageName, [dir]);

    return packageJson.version;
  } finally {
    await cleanup();
  }
}

export async function packageRegistryView(
  pkg: string,
  version: string,
  args: string
): Promise<string> {
  let pm = detectPackageManager();
  if (pm === 'yarn' || pm === 'bun') {
    /**
     * yarn has `yarn info` but it behaves differently than (p)npm,
     * which makes it's usage unreliable
     *
     * @see https://github.com/nrwl/nx/pull/9667#discussion_r842553994
     *
     * Bun has a pm ls function but it only relates to its lockfile
     * and acts differently from all other package managers
     * from Jarred: "it probably would be bun pm view <package-name>"
     */
    pm = 'npm';
  }

  const { stdout } = await execAsync(`${pm} view ${pkg}@${version} ${args}`, {
    windowsHide: true,
  });
  return stdout.toString().trim();
}

export async function packageRegistryPack(
  cwd: string,
  pkg: string,
  version: string
): Promise<{ tarballPath: string }> {
  let pm = detectPackageManager();
  if (pm === 'yarn' || pm === 'bun') {
    /**
     * `(p)npm pack` will download a tarball of the specified version,
     * whereas `yarn` pack creates a tarball of the active workspace, so it
     * does not work for getting the content of a library.
     *
     * @see https://github.com/nrwl/nx/pull/9667#discussion_r842553994
     *
     * bun doesn't currently support pack
     */
    pm = 'npm';
  }

  const { stdout } = await execAsync(`${pm} pack ${pkg}@${version}`, {
    cwd,
    windowsHide: true,
  });

  const tarballPath = stdout.trim();
  return { tarballPath };
}

/**
 * Gets the workspaces defined in the package manager configuration.
 * @returns workspaces defined in the package manager configuration, empty array if none are defined
 */
export function getPackageWorkspaces(
  packageManager: PackageManager = detectPackageManager(),
  root: string = workspaceRoot
): string[] {
  let workspaces: string[];

  if (
    packageManager === 'npm' ||
    packageManager === 'yarn' ||
    packageManager === 'bun'
  ) {
    const packageJson = readPackageJson(root);
    workspaces = packageJson.workspaces;
  } else if (packageManager === 'pnpm') {
    const pnpmWorkspacePath = join(root, 'pnpm-workspace.yaml');
    if (existsSync(pnpmWorkspacePath)) {
      const { packages } =
        readYamlFile<{ packages: string[] }>(pnpmWorkspacePath) ?? {};
      workspaces = packages;
    }
  }

  return workspaces ?? [];
}

/**
 * Adds a package to the workspaces defined in the package manager configuration.
 * If the package is already included in the workspaces, it will not be added again.
 * @param packageManager The package manager to use. If not provided, it will be detected based on the lock file.
 * @param workspaces The workspaces to add the package to. Defaults to the workspaces defined in the package manager configuration.
 * @param root The directory the commands will be ran inside of. Defaults to the current workspace's root.
 * @param packagePath The path of the package to add to the workspaces
 */
export function addPackagePathToWorkspaces(
  packagePath: string,
  packageManager: PackageManager = detectPackageManager(),
  workspaces: string[] = getPackageWorkspaces(packageManager),
  root: string = workspaceRoot
): void {
  if (
    packageManager === 'npm' ||
    packageManager === 'yarn' ||
    packageManager === 'bun'
  ) {
    workspaces.push(packagePath);
    const packageJson = readPackageJson(root);
    const updatedPackageJson = {
      ...packageJson,
      workspaces,
    };
    const packageJsonPath = join(root, 'package.json');
    writeJsonFile(packageJsonPath, updatedPackageJson);
  } else if (packageManager === 'pnpm') {
    const pnpmWorkspacePath = join(root, 'pnpm-workspace.yaml');
    if (existsSync(pnpmWorkspacePath)) {
      const pnpmWorkspaceDocument = parseDocument(
        readFileIfExisting(pnpmWorkspacePath)
      );
      const pnpmWorkspaceContents: ParsedNode | null =
        pnpmWorkspaceDocument.contents;
      if (!pnpmWorkspaceContents) {
        writeFileSync(
          pnpmWorkspacePath,
          YAMLStringify({
            packages: [packagePath],
          })
        );
      } else if (pnpmWorkspaceContents instanceof YAMLMap) {
        const packages: Pair | undefined = pnpmWorkspaceContents.items.find(
          (item: Pair) => {
            return item.key instanceof Scalar
              ? item.key?.value === 'packages'
              : item.key === 'packages';
          }
        );
        if (packages) {
          if (packages.value instanceof YAMLSeq === false) {
            packages.value = new YAMLSeq();
          }
          (packages.value as YAMLSeq).items ??= [];
          (packages.value as YAMLSeq).items.push(packagePath);
        } else {
          // if the 'packages' key doesn't exist, create it
          const packagesSeq = new YAMLSeq();
          packagesSeq.items ??= [];
          packagesSeq.items.push(packagePath);

          pnpmWorkspaceDocument.add(
            pnpmWorkspaceDocument.createPair('packages', packagesSeq)
          );
        }
        writeFileSync(pnpmWorkspacePath, YAMLStringify(pnpmWorkspaceContents));
      }
    } else {
      // If the file doesn't exist, create it
      writeFileSync(
        pnpmWorkspacePath,
        YAMLStringify({
          packages: [packagePath],
        })
      );
    }
  }
}
