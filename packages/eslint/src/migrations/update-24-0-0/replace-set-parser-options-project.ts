import {
  formatFiles,
  getProjects,
  joinPathFragments,
  readJson,
  readNxJson,
  type Tree,
  updateNxJson,
  writeJson,
} from '@nx/devkit';

// Generators that declared `setParserOptionsProject` in Nx 23 and still exist in Nx 24.
const GENERATORS: Record<string, string[]> = {
  '@nx/angular': ['add-linting', 'application', 'library'],
  '@nx/cypress': ['configuration'],
  '@nx/detox': ['application'],
  '@nx/expo': ['application', 'library'],
  '@nx/express': ['application'],
  '@nx/js': ['library'],
  '@nx/nest': ['application', 'library'],
  '@nx/next': ['application', 'library'],
  '@nx/node': ['application', 'library'],
  '@nx/nuxt': ['application'],
  '@nx/playwright': ['configuration'],
  '@nx/plugin': ['plugin'],
  '@nx/react': ['application', 'library'],
  '@nx/react-native': ['application', 'library'],
  '@nx/vue': ['application', 'library'],
  '@nx/web': ['application'],
};

const REMOVED = 'setParserOptionsProject';
const REPLACEMENT = 'enableTypedLinting';

type GeneratorDefaults = Record<string, unknown>;

/**
 * `nx.json`, an `angular.json` project, a `project.json`, or the `nx` key of a
 * project's `package.json`.
 */
interface GeneratorsOwner {
  generators?: Record<string, any>;
}

/** The merged value of both options at a layer, before the migration. */
interface Resolution {
  enableTypedLinting: boolean;
  setParserOptionsProject: boolean;
}

export default async function update(tree: Tree) {
  let changed = false;

  const nxJson = readNxJson(tree);
  const fromNxJson = new Map<string, Resolution>();
  if (nxJson && migrateGenerators([nxJson], fromNxJson)[0]) {
    updateNxJson(tree, nxJson);
    changed = true;
  }

  const angularJson = tree.exists('angular.json')
    ? readJson(tree, 'angular.json')
    : undefined;
  let angularJsonChanged = false;

  for (const [projectName, { root }] of getProjects(tree)) {
    // Edit each file in place: `updateProjectConfiguration` would write the
    // merged configuration to `project.json` and leave `package.json` as is.
    const packageJsonPath = joinPathFragments(root, 'package.json');
    const projectJsonPath = joinPathFragments(root, 'project.json');
    const packageJson = tree.exists(packageJsonPath)
      ? readJson(tree, packageJsonPath)
      : undefined;
    const projectJson = tree.exists(projectJsonPath)
      ? readJson(tree, projectJsonPath)
      : undefined;

    // Nx reads an `angular.json` project's `schematics` as its `generators`.
    const angularJsonProject = angularJson?.projects?.[projectName];
    const angularJsonKey =
      angularJsonProject?.schematics !== undefined
        ? 'schematics'
        : 'generators';
    const angularJsonDefaults = {
      generators: angularJsonProject?.[angularJsonKey],
    };

    // Nx merges `angular.json`, then `package.json`, then `project.json`.
    const [angularJsonProjectChanged, packageJsonChanged, projectJsonChanged] =
      migrateGenerators(
        [
          angularJsonDefaults,
          isRecord(packageJson?.nx) ? packageJson.nx : {},
          projectJson ?? {},
        ],
        new Map(fromNxJson)
      );
    if (angularJsonProjectChanged) {
      if (!angularJsonDefaults.generators) {
        delete angularJsonProject[angularJsonKey];
      }
      angularJsonChanged = true;
    }
    if (packageJsonChanged) {
      writeJson(tree, packageJsonPath, packageJson);
      changed = true;
    }
    if (projectJsonChanged) {
      writeJson(tree, projectJsonPath, projectJson);
      changed = true;
    }
  }

  if (angularJsonChanged) {
    writeJson(tree, 'angular.json', angularJson);
    changed = true;
  }

  if (!changed) {
    return { skipAgentic: true };
  }

  await formatFiles(tree);
}

/**
 * Rewrites the defaults so the merged `enableTypedLinting` equals the pre-migration
 * `enableTypedLinting || setParserOptionsProject`. `owners` merge in order, a later
 * one taking precedence. `resolutions` holds the layers beneath `owners` and is
 * updated to include them. Returns which owners changed.
 */
function migrateGenerators(
  owners: GeneratorsOwner[],
  resolutions: Map<string, Resolution>
): boolean[] {
  const changed = owners.map(() => false);
  const sources = owners.map((owner) =>
    isRecord(owner.generators) ? owner.generators : undefined
  );

  for (const [collection, names] of Object.entries(GENERATORS)) {
    for (const name of names) {
      const flatKey = `${collection}:${name}`;
      const beneath = resolutions.get(flatKey) ?? {
        enableTypedLinting: false,
        setParserOptionsProject: false,
      };

      // Nested before flat: the order `getGeneratorDefaults` merges them in.
      // A later owner's nested entry replaces an earlier one's entirely.
      let resolution = beneath;
      for (const [i, generators] of sources.entries()) {
        const nested = generators?.[collection];
        if (!isRecord(nested) || !(name in nested)) {
          continue;
        }
        const result = migrateEntry(nested, name, beneath);
        resolution = result.resolution;
        if (result.changed) {
          changed[i] = true;
          if (isEmpty(nested)) {
            delete generators[collection];
          }
        }
      }
      // Flat entries merge option by option.
      for (const [i, generators] of sources.entries()) {
        if (!generators) {
          continue;
        }
        const result = migrateEntry(generators, flatKey, resolution);
        resolution = result.resolution;
        if (result.changed) {
          changed[i] = true;
        }
      }
      resolutions.set(flatKey, resolution);
    }
  }

  for (const [i, owner] of owners.entries()) {
    if (changed[i] && isEmpty(owner.generators)) {
      delete owner.generators;
    }
  }
  return changed;
}

/** Migrates `container[key]` and removes it when the migration leaves it empty. */
function migrateEntry(
  container: Record<string, unknown>,
  key: string,
  below: Resolution
): { resolution: Resolution; changed: boolean } {
  const defaults = container[key];
  if (!isRecord(defaults)) {
    return { resolution: below, changed: false };
  }
  const result = migrateDefaults(defaults, below);
  if (result.changed && isEmpty(defaults)) {
    delete container[key];
  }
  return result;
}

function migrateDefaults(
  defaults: GeneratorDefaults,
  below: Resolution
): { resolution: Resolution; changed: boolean } {
  const hasRemoved = REMOVED in defaults;
  const hasReplacement = REPLACEMENT in defaults;
  if (!hasRemoved && !hasReplacement) {
    return { resolution: below, changed: false };
  }

  const resolution: Resolution = {
    enableTypedLinting: hasReplacement
      ? toBoolean(defaults[REPLACEMENT])
      : below.enableTypedLinting,
    setParserOptionsProject: hasRemoved
      ? toBoolean(defaults[REMOVED])
      : below.setParserOptionsProject,
  };
  const expected =
    resolution.enableTypedLinting || resolution.setParserOptionsProject;
  // Layers beneath this one are already migrated to their own merged value.
  const migratedWithoutChange = hasReplacement
    ? toBoolean(defaults[REPLACEMENT])
    : below.enableTypedLinting || below.setParserOptionsProject;

  let changed = false;
  if (hasRemoved) {
    delete defaults[REMOVED];
    changed = true;
  }
  if (migratedWithoutChange !== expected) {
    defaults[REPLACEMENT] = expected;
    changed = true;
  }

  return { resolution, changed };
}

// Mirrors how nx coerces a boolean option: only `true` and `'true'` enable it.
function toBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

function isRecord(value: unknown): value is GeneratorDefaults {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEmpty(value: GeneratorDefaults): boolean {
  return Object.keys(value).length === 0;
}
