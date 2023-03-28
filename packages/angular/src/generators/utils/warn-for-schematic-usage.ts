export function warnForSchematicUsage<T>(convertedGenerator: T): T {
  console.warn(
    'Running generators as schematics is deprecated and will be removed in v17. Prefer `callRule(convertNxGenerator(generator)(options), tree, context)` where "generator" is the name of the generator you wish to use.'
  );

  return convertedGenerator;
}
