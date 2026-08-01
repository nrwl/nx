import { readNxJson, type Tree } from '@nx/devkit';

export function getComponentType(tree: Tree): string | undefined {
  const nxJson = readNxJson(tree);
  const componentType =
    nxJson.generators?.['@nx/angular:component']?.type ??
    nxJson.generators?.['@nx/angular']?.component?.type;

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
    typeSeparator = '-';
  }

  return typeSeparator;
}
