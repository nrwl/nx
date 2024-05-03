import { valid } from 'semver';
import { NxJsonConfiguration } from '../config/nx-json';
import { PackageJsonUpdateForPackage } from '../config/misc-interfaces';
import { resolvePackageVersionUsingRegistry } from './package-manager';

export async function updateDependenciesInNxJson(
  nxJson: NxJsonConfiguration,
  updates: Record<string, PackageJsonUpdateForPackage>
) {
  const nxVersion = updates.nx?.version;
  if (nxVersion) {
    nxJson.installation.version = nxVersion;
  }

  for (const plugin of nxJson.plugins ?? []) {
    if (typeof plugin === 'object' && plugin.version) {
      const packageName = getPackageName(plugin.plugin);
      const update = updates[packageName];
      if (update) {
        plugin.version = await normalizeVersionForNxJson(
          plugin.plugin,
          update.version
        );
      }
    }
  }

  if (nxJson.installation.plugins) {
    for (const dep in nxJson.installation.plugins) {
      const update = updates[dep];
      if (update) {
        nxJson.installation.plugins[dep] = await normalizeVersionForNxJson(
          dep,
          update.version
        );
      }
    }
  }

  return nxJson;
}

export function getPackageName(name: string) {
  if (name.startsWith('@')) {
    return name.split('/').slice(0, 2).join('/');
  }
  return name.split('/')[0];
}

export function readDependenciesFromNxJson(
  nxJson: NxJsonConfiguration
): Record<string, string> {
  const deps = {};
  if (nxJson?.installation?.version) {
    deps['nx'] = nxJson.installation.version;
    for (const dep in nxJson.installation.plugins ?? {}) {
      deps[dep] = nxJson.installation.plugins[dep];
    }
    for (const plugin of nxJson.plugins ?? []) {
      if (typeof plugin === 'object' && plugin.version) {
        deps[plugin.plugin] = plugin.version;
      }
    }
  }
  return deps;
}

async function normalizeVersionForNxJson(
  dep: string,
  version: string
): Promise<string> {
  return valid(version)
    ? version
    : await resolvePackageVersionUsingRegistry(dep, version);
}
