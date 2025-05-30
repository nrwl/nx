import { formatFiles, readNxJson, updateNxJson, type Tree } from '@nx/devkit';

const TYPE_GENERATORS = ['component', 'directive', 'service'] as const;
const TYPE_SEPARATOR_GENERATORS = [
  'guard',
  'interceptor',
  'module',
  'pipe',
  'resolver',
] as const;

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);
  nxJson.generators ??= {};

  for (const generator of TYPE_GENERATORS) {
    setDefault(nxJson.generators, '@nx/angular', generator, 'type', generator);
    setDefault(
      nxJson.generators,
      '@schematics/angular',
      generator,
      'type',
      generator
    );
  }

  setDefault(nxJson.generators, '@nx/angular', 'scam', 'type', 'component');
  setDefault(
    nxJson.generators,
    '@nx/angular',
    'scam-directive',
    'type',
    'directive'
  );

  for (const generator of TYPE_SEPARATOR_GENERATORS) {
    setDefault(
      nxJson.generators,
      '@nx/angular',
      generator,
      'typeSeparator',
      '.'
    );
    setDefault(
      nxJson.generators,
      '@schematics/angular',
      generator,
      'typeSeparator',
      '.'
    );
  }

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}

function setDefault(
  generators: Record<string, any>,
  collection: string,
  generator: string,
  option: 'type' | 'typeSeparator',
  value: string
) {
  const generatorKey = `${collection}:${generator}`;
  if (
    generators[generatorKey]?.[option] ||
    generators[collection]?.[generator]?.[option]
  ) {
    return;
  }

  if (generators[generatorKey]) {
    generators[generatorKey][option] = value;
  } else if (generators[collection]?.[generator]) {
    generators[collection][generator][option] = value;
  } else if (generators[collection]) {
    generators[collection][generator] = { [option]: value };
  } else {
    generators[generatorKey] = { [option]: value };
  }
}
