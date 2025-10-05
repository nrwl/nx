import { readNxJson, type Tree } from '@nx/devkit';
import { getInstalledAngularVersionInfo } from './version-utils';

export function getComponentType(tree: Tree): string | undefined {
  const nxJson = readNxJson(tree);
  let componentType =
    nxJson.generators?.['@nx/angular:component']?.type ??
    nxJson.generators?.['@nx/angular']?.component?.type;

  if (!componentType) {
    const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
    if (angularMajorVersion < 20) {
      componentType = 'component';
    }
  }

  return componentType;
}

export function getModuleTypeSeparator(tree: Tree): '-' | '.' {
  const nxJson = readNxJson(tree);
  // We don't have a "module" generator but the @nx/angular collection extends
  // from the @schematics/angular collection so the "module" generator is
  // available there. We check for a generator default for each collection.
  let typeSeparator: '-' | '.' =
    nxJson.generators?.['@nx/angular:module']?.typeSeparator ??
    nxJson.generators?.['@nx/angular']?.module?.typeSeparator ??
    nxJson.generators?.['@schematics/angular:module']?.typeSeparator ??
    nxJson.generators?.['@schematics/angular']?.module?.typeSeparator;

  if (!typeSeparator) {
    const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
    typeSeparator = angularMajorVersion >= 20 ? '-' : '.';
  }

  return typeSeparator;
}
