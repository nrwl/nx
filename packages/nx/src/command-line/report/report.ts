import * as chalk from 'chalk';
import { output } from '../../utils/output';
import { join } from 'path';
import {
  detectPackageManager,
  getPackageManagerVersion,
  PackageManager,
} from '../../utils/package-manager';
import { readJsonFile } from '../../utils/fileutils';
import {
  PackageJson,
  readModulePackageJson,
  readNxMigrateConfig,
} from '../../utils/package-json';
import { getLocalWorkspacePlugins } from '../../utils/plugins/local-plugins';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { gt, valid } from 'semver';
import { findInstalledPlugins } from '../../utils/plugins/installed-plugins';
import { getNxRequirePaths } from '../../utils/installation-directory';
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { ProjectGraphError } from '../../project-graph/error-types';
import {
  getNxKeyInformation,
  NxKeyNotInstalledError,
} from '../../utils/nx-key';
import { type NxKey } from '@nx/key';

const nxPackageJson = readJsonFile<typeof import('../../../package.json')>(
  join(__dirname, '../../../package.json')
);

export const packagesWeCareAbout = [
  'lerna',
  ...nxPackageJson['nx-migrations'].packageGroup.map((x) =>
    typeof x === 'string' ? x : x.package
  ),
  '@nrwl/schematics', // manually added since we don't publish it anymore.
  'typescript',
];

export const patternsWeIgnoreInCommunityReport: Array<string | RegExp> = [
  ...packagesWeCareAbout,
  new RegExp('@nx/powerpack*'),
  '@schematics/angular',
  new RegExp('@angular/*'),
  '@nestjs/schematics',
];

const LINE_SEPARATOR = '---------------------------------------';

/**
 * Reports relevant version numbers for adding to an Nx issue report
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
export async function reportHandler() {
  const {
    pm,
    pmVersion,
    nxKey,
    nxKeyError,
    localPlugins,
    powerpackPlugins,
    communityPlugins,
    registeredPlugins,
    packageVersionsWeCareAbout,
    outOfSyncPackageGroup,
    projectGraphError,
    nativeTarget,
  } = await getReportData();

  const fields = [
    ['Node', process.versions.node],
    ['OS', `${process.platform}-${process.arch}`],
    ['Native Target', nativeTarget ?? 'Unavailable'],
    [pm, pmVersion],
  ];
  let padding = Math.max(...fields.map((f) => f[0].length));
  const bodyLines = fields.map(
    ([field, value]) => `${field.padEnd(padding)}  : ${value}`
  );

  bodyLines.push('');

  padding =
    Math.max(...packageVersionsWeCareAbout.map((x) => x.package.length)) + 1;
  packageVersionsWeCareAbout.forEach((p) => {
    bodyLines.push(
      `${chalk.green(p.package.padEnd(padding))} : ${chalk.bold(p.version)}`
    );
  });

  if (nxKey) {
    bodyLines.push('');
    bodyLines.push(LINE_SEPARATOR);
    bodyLines.push(chalk.green('Nx key licensed packages'));

    bodyLines.push(
      `Licensed to ${nxKey.organizationName} for ${nxKey.seatCount} user${
        nxKey.seatCount > 1 ? 's' : ''
      } in ${
        nxKey.workspaceCount === 9999
          ? 'an unlimited number of'
          : nxKey.workspaceCount
      } workspace${nxKey.workspaceCount > 1 ? 's' : ''}.`
    );

    if (nxKey.realExpiresAt || nxKey.expiresAt) {
      const licenseExpiryDate = new Date(
        (nxKey.realExpiresAt ?? nxKey.expiresAt) * 1000
      );

      // license is not expired
      if (licenseExpiryDate.getTime() >= Date.now()) {
        if ('perpetualNxVersion' in nxKey) {
          bodyLines.push(
            `License expires on ${licenseExpiryDate.toLocaleDateString()}, but will continue to work with Nx ${
              nxKey.perpetualNxVersion
            } and below.`
          );
        } else {
          bodyLines.push(
            `License expires on ${licenseExpiryDate.toLocaleDateString()}.`
          );
        }
      } else {
        if ('perpetualNxVersion' in nxKey) {
          bodyLines.push(
            `License expired on ${licenseExpiryDate.toLocaleDateString()}, but will continue to work with Nx ${
              nxKey.perpetualNxVersion
            } and below.`
          );
        } else {
          bodyLines.push(
            `License expired on ${licenseExpiryDate.toLocaleDateString()}.`
          );
        }
      }
    }

    bodyLines.push('');

    padding =
      Math.max(
        ...powerpackPlugins.map(
          (powerpackPlugin) => powerpackPlugin.name.length
        )
      ) + 1;
    for (const powerpackPlugin of powerpackPlugins) {
      bodyLines.push(
        `${chalk.green(powerpackPlugin.name.padEnd(padding))} : ${chalk.bold(
          powerpackPlugin.version
        )}`
      );
    }
    bodyLines.push('');
  } else if (nxKeyError) {
    bodyLines.push('');
    bodyLines.push(chalk.red('Nx key'));
    bodyLines.push(LINE_SEPARATOR);
    bodyLines.push(nxKeyError.message);
    bodyLines.push('');
  }

  if (registeredPlugins.length) {
    bodyLines.push(LINE_SEPARATOR);
    bodyLines.push('Registered Plugins:');
    for (const plugin of registeredPlugins) {
      bodyLines.push(`${chalk.green(plugin)}`);
    }
  }

  if (communityPlugins.length) {
    bodyLines.push(LINE_SEPARATOR);
    padding = Math.max(...communityPlugins.map((x) => x.name.length)) + 1;
    bodyLines.push('Community plugins:');
    communityPlugins.forEach((p) => {
      bodyLines.push(
        `${chalk.green(p.name.padEnd(padding))}: ${chalk.bold(p.version)}`
      );
    });
  }

  if (localPlugins.length) {
    bodyLines.push(LINE_SEPARATOR);

    bodyLines.push('Local workspace plugins:');

    for (const plugin of localPlugins) {
      bodyLines.push(`\t ${chalk.green(plugin)}`);
    }
  }

  if (outOfSyncPackageGroup) {
    bodyLines.push(LINE_SEPARATOR);
    bodyLines.push(
      `The following packages should match the installed version of ${outOfSyncPackageGroup.basePackage}`
    );
    for (const pkg of outOfSyncPackageGroup.misalignedPackages) {
      bodyLines.push(`  - ${pkg.name}@${pkg.version}`);
    }
    bodyLines.push('');
    bodyLines.push(
      `To fix this, run \`nx migrate ${outOfSyncPackageGroup.migrateTarget}\``
    );
  }

  if (projectGraphError) {
    bodyLines.push(LINE_SEPARATOR);
    bodyLines.push('⚠️ Unable to construct project graph.');
    bodyLines.push(projectGraphError.message);
    bodyLines.push(projectGraphError.stack);
  }

  output.log({
    title: 'Report complete - copy this into the issue template',
    bodyLines,
  });
}

export interface ReportData {
  pm: PackageManager;
  pmVersion: string;
  nxKey: NxKey | null;
  nxKeyError: Error | null;
  powerpackPlugins: PackageJson[];
  localPlugins: string[];
  communityPlugins: PackageJson[];
  registeredPlugins: string[];
  packageVersionsWeCareAbout: {
    package: string;
    version: string;
  }[];
  outOfSyncPackageGroup?: {
    basePackage: string;
    misalignedPackages: {
      name: string;
      version: string;
    }[];
    migrateTarget: string;
  };
  projectGraphError?: Error | null;
  nativeTarget: string | null;
}

export async function getReportData(): Promise<ReportData> {
  const pm = detectPackageManager();
  const pmVersion = getPackageManagerVersion(pm);

  const { graph, error: projectGraphError } = await tryGetProjectGraph();

  const nxJson = readNxJson();
  const localPlugins = await findLocalPlugins(graph, nxJson);
  const powerpackPlugins = findInstalledPowerpackPlugins();
  const communityPlugins = findInstalledCommunityPlugins();
  const registeredPlugins = findRegisteredPluginsBeingUsed(nxJson);

  const packageVersionsWeCareAbout = findInstalledPackagesWeCareAbout();
  packageVersionsWeCareAbout.unshift({
    package: 'nx',
    version: nxPackageJson.version,
  });
  if (globalThis.GLOBAL_NX_VERSION) {
    packageVersionsWeCareAbout.unshift({
      package: 'nx (global)',
      version: globalThis.GLOBAL_NX_VERSION,
    });
  }

  const outOfSyncPackageGroup = findMisalignedPackagesForPackage(nxPackageJson);

  const native = isNativeAvailable();

  let nxKey = null;
  let nxKeyError = null;
  try {
    nxKey = await getNxKeyInformation();
  } catch (e) {
    if (!(e instanceof NxKeyNotInstalledError)) {
      nxKeyError = e;
    }
  }

  return {
    pm,
    nxKey,
    nxKeyError,
    powerpackPlugins,
    pmVersion,
    localPlugins,
    communityPlugins,
    registeredPlugins,
    packageVersionsWeCareAbout,
    outOfSyncPackageGroup,
    projectGraphError,
    nativeTarget: native ? native.getBinaryTarget() : null,
  };
}

async function tryGetProjectGraph() {
  try {
    return { graph: await createProjectGraphAsync() };
  } catch (error) {
    if (error instanceof ProjectGraphError) {
      return {
        graph: error.getPartialProjectGraph(),
        error: error,
      };
    }
    return {
      error,
    };
  }
}

async function findLocalPlugins(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
) {
  try {
    const localPlugins = await getLocalWorkspacePlugins(
      readProjectsConfigurationFromProjectGraph(projectGraph),
      nxJson
    );
    return Array.from(localPlugins.keys());
  } catch {
    return [];
  }
}

function readPackageJson(p: string): PackageJson | null {
  try {
    return readModulePackageJson(p, getNxRequirePaths()).packageJson;
  } catch {
    return null;
  }
}

function readPackageVersion(p: string): string | null {
  return readPackageJson(p)?.version;
}

interface OutOfSyncPackageGroup {
  basePackage: string;
  misalignedPackages: {
    name: string;
    version: string;
  }[];
  migrateTarget: string;
}

export function findMisalignedPackagesForPackage(
  base: PackageJson
): undefined | OutOfSyncPackageGroup {
  const misalignedPackages: { name: string; version: string }[] = [];

  let migrateTarget = base.version;

  const { packageGroup } = readNxMigrateConfig(base);

  for (const entry of packageGroup ?? []) {
    const { package: packageName, version } = entry;
    // should be aligned
    if (version === '*') {
      const installedVersion = readPackageVersion(packageName);

      if (installedVersion && installedVersion !== base.version) {
        if (valid(installedVersion) && gt(installedVersion, migrateTarget)) {
          migrateTarget = installedVersion;
        }
        misalignedPackages.push({
          name: packageName,
          version: installedVersion,
        });
      }
    }
  }

  return misalignedPackages.length
    ? {
        basePackage: base.name,
        misalignedPackages,
        migrateTarget: `${base.name}@${migrateTarget}`,
      }
    : undefined;
}

export function findInstalledPowerpackPlugins(): PackageJson[] {
  const installedPlugins = findInstalledPlugins();
  return installedPlugins.filter((dep) =>
    new RegExp(
      '@nx/powerpack*|@nx/(.+)-cache|@nx/(conformance|owners|enterprise*)'
    ).test(dep.name)
  );
}

export function findInstalledCommunityPlugins(): PackageJson[] {
  const installedPlugins = findInstalledPlugins();
  return installedPlugins.filter(
    (dep) =>
      dep.name !== 'nx' &&
      !patternsWeIgnoreInCommunityReport.some((pattern) =>
        typeof pattern === 'string'
          ? pattern === dep.name
          : pattern.test(dep.name)
      )
  );
}

export function findRegisteredPluginsBeingUsed(nxJson: NxJsonConfiguration) {
  if (!nxJson.plugins) {
    return [];
  }

  return nxJson.plugins.map((plugin) =>
    typeof plugin === 'object' ? plugin.plugin : plugin
  );
}

export function findInstalledPackagesWeCareAbout() {
  const packagesWeMayCareAbout: Record<string, string> = {};
  // TODO (v20): Remove workaround for hiding @nrwl packages when matching @nx package is found.
  const packageChangeMap: Record<string, string> = {
    '@nrwl/nx-plugin': '@nx/plugin',
    '@nx/plugin': '@nrwl/nx-plugin',
    '@nrwl/eslint-plugin-nx': '@nx/eslint-plugin',
    '@nx/eslint-plugin': '@nrwl/eslint-plugin-nx',
    '@nrwl/nx-cloud': 'nx-cloud',
  };

  for (const pkg of packagesWeCareAbout) {
    const v = readPackageVersion(pkg);
    if (v) {
      // If its a @nrwl scoped package, keep the version if there is no
      // corresponding @nx scoped package, or it has a different version.
      if (pkg.startsWith('@nrwl/')) {
        const otherPackage =
          packageChangeMap[pkg] ?? pkg.replace('@nrwl/', '@nx/');
        const otherVersion = packagesWeMayCareAbout[otherPackage];
        if (!otherVersion || v !== otherVersion) {
          packagesWeMayCareAbout[pkg] = v;
        }
        // If its a @nx scoped package, always keep the version, and
        // remove the corresponding @nrwl scoped package if it exists.
      } else if (pkg.startsWith('@nx/')) {
        const otherPackage =
          packageChangeMap[pkg] ?? pkg.replace('@nx/', '@nrwl/');
        const otherVersion = packagesWeMayCareAbout[otherPackage];
        if (otherVersion && v === otherVersion) {
          delete packagesWeMayCareAbout[otherPackage];
        }
        packagesWeMayCareAbout[pkg] = v;
      } else {
        packagesWeMayCareAbout[pkg] = v;
      }
    }
  }

  return Object.entries(packagesWeMayCareAbout).map(([pkg, version]) => ({
    package: pkg,
    version,
  }));
}

function isNativeAvailable(): typeof import('../../native') | false {
  try {
    return require('../../native');
  } catch {
    return false;
  }
}
