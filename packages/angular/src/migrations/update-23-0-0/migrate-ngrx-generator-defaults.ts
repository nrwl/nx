import {
  formatFiles,
  getProjects,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';

const COLLECTION = '@nx/angular';
const OLD_GENERATOR = 'ngrx';
const OLD_KEY = `${COLLECTION}:${OLD_GENERATOR}`;
const ROOT_STORE = 'ngrx-root-store';
const FEATURE_STORE = 'ngrx-feature-store';

// Options supported by ngrx-root-store. The `minimal` option is included here
// because its semantics match the old generator (skip generating root feature
// state files).
const ROOT_STORE_OPTIONS = [
  'name',
  'route',
  'directory',
  'facade',
  'minimal',
  'skipImport',
  'skipPackageJson',
  'skipFormat',
] as const;

// Options supported by ngrx-feature-store. `minimal` is intentionally excluded:
// in the old generator it was a no-op for feature usage, but in
// ngrx-feature-store it skips template generation while still wiring imports,
// which would produce broken modules.
const FEATURE_STORE_OPTIONS = [
  'name',
  'parent',
  'route',
  'directory',
  'facade',
  'barrels',
  'skipImport',
  'skipPackageJson',
  'skipFormat',
] as const;

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);
  if (nxJson?.generators && migrateGenerators(nxJson.generators)) {
    updateNxJson(tree, nxJson);
  }

  const projects = getProjects(tree);
  for (const [projectName, project] of projects) {
    if (project.generators && migrateGenerators(project.generators)) {
      updateProjectConfiguration(tree, projectName, project);
    }
  }

  await formatFiles(tree);
}

function migrateGenerators(generators: Record<string, any>): boolean {
  const flatDefaults = generators[OLD_KEY];
  const nestedDefaults = generators[COLLECTION]?.[OLD_GENERATOR];

  if (!flatDefaults && !nestedDefaults) {
    return false;
  }

  // Match Nx's runtime merge: nested first, then flat overrides.
  // See `getGeneratorDefaults` in packages/nx/src/utils/params.ts.
  const oldDefaults: Record<string, any> = {
    ...(nestedDefaults ?? {}),
    ...(flatDefaults ?? {}),
  };

  // Prefer flat when both shapes exist (it's the dominant runtime shape).
  const useNestedFormat = !flatDefaults && !!nestedDefaults;

  // The deprecated `module` option was an alias for `parent`. The old
  // generator resolved `options.module ?? options.parent`, so `module` won
  // when both were set — preserve that precedence here.
  if (oldDefaults.module !== undefined) {
    oldDefaults.parent = oldDefaults.module;
  }

  const rootStoreDefaults = pick(oldDefaults, ROOT_STORE_OPTIONS);
  const featureStoreDefaults = pick(oldDefaults, FEATURE_STORE_OPTIONS);

  if (Object.keys(rootStoreDefaults).length > 0) {
    setNewDefaults(generators, ROOT_STORE, rootStoreDefaults, useNestedFormat);
  }
  if (Object.keys(featureStoreDefaults).length > 0) {
    setNewDefaults(
      generators,
      FEATURE_STORE,
      featureStoreDefaults,
      useNestedFormat
    );
  }

  delete generators[OLD_KEY];
  if (generators[COLLECTION]?.[OLD_GENERATOR] !== undefined) {
    delete generators[COLLECTION][OLD_GENERATOR];
    if (Object.keys(generators[COLLECTION]).length === 0) {
      delete generators[COLLECTION];
    }
  }

  return true;
}

function pick(
  obj: Record<string, any>,
  keys: readonly string[]
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of keys) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

function setNewDefaults(
  generators: Record<string, any>,
  generator: string,
  newDefaults: Record<string, any>,
  preferNestedFormat: boolean
): void {
  const flatKey = `${COLLECTION}:${generator}`;
  const existingFlat = generators[flatKey];
  const existingNested = generators[COLLECTION]?.[generator];

  // Per-generator destination: prefer whichever shape the user already uses
  // for the replacement key, so the migrated defaults layer correctly under
  // their existing values. Fall back to the input shape when neither exists.
  const writeNested =
    existingNested !== undefined
      ? true
      : existingFlat !== undefined
        ? false
        : preferNestedFormat;

  if (writeNested) {
    generators[COLLECTION] ??= {};
    // Existing user-set defaults take precedence over the migrated ones.
    generators[COLLECTION][generator] = {
      ...newDefaults,
      ...(existingNested ?? {}),
    };
  } else {
    generators[flatKey] = { ...newDefaults, ...(existingFlat ?? {}) };
  }
}
