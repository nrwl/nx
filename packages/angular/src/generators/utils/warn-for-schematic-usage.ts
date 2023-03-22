export function warnForSchematicUsage<T>(convertedGenerator: T): T {
  console.warn(
    'Running generators as schematics is deprecated and will be removed in v17.'
  );

  return convertedGenerator;
}
