import { formatFiles, readNxJson, updateNxJson, type Tree } from '@nx/devkit';

const ANGULAR_GENERATORS = [
  'application',
  'library',
  'host',
  'remote',
  'federate-module',
] as const;

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson?.generators) {
    return;
  }

  let updated = false;

  for (const generator of ANGULAR_GENERATORS) {
    if (updateGeneratorDefault(nxJson.generators, '@nx/angular', generator)) {
      updated = true;
    }
  }

  if (updated) {
    updateNxJson(tree, nxJson);
    await formatFiles(tree);
  }
}

function updateGeneratorDefault(
  generators: Record<string, unknown>,
  collection: string,
  generator: string
): boolean {
  const generatorKey = `${collection}:${generator}`;

  // Check "@nx/angular:application" format
  const flatConfig = generators[generatorKey] as Record<string, unknown>;
  if (flatConfig?.unitTestRunner === 'vitest') {
    flatConfig.unitTestRunner = 'vitest-analog';
    return true;
  }

  // Check { "@nx/angular": { "application": {...} } } format
  const nestedConfig = generators[collection] as Record<string, unknown>;
  const generatorConfig = nestedConfig?.[generator] as Record<string, unknown>;
  if (generatorConfig?.unitTestRunner === 'vitest') {
    generatorConfig.unitTestRunner = 'vitest-analog';
    return true;
  }

  return false;
}
