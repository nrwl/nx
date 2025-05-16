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
