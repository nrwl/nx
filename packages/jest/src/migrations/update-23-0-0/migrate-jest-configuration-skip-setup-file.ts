import {
  formatFiles,
  getProjects,
  readNxJson,
  type ProjectConfiguration,
  type Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';

const GENERATOR_NAME = '@nx/jest:configuration';
const PACKAGE = '@nx/jest';
const GENERATOR = 'configuration';
const SKIP_SETUP_FILE = 'skipSetupFile';
const SETUP_FILE = 'setupFile';

// Migrate the deprecated `skipSetupFile` option of `@nx/jest:configuration`
// generator defaults. `skipSetupFile: true` was equivalent to setting
// `setupFile: 'none'`, so rewrite to that. `skipSetupFile: false` was a no-op
// — drop it. Run on both `nx.json` `generators` and per-project
// `project.json` `generators`, in both flat (`@nx/jest:configuration`) and
// nested (`@nx/jest` → `configuration`) forms.
export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);
  if (nxJson?.generators && transformGenerators(nxJson.generators)) {
    updateNxJson(tree, nxJson);
  }

  for (const [projectName, projectConfig] of getProjects(tree)) {
    if (
      projectConfig.generators &&
      transformGenerators(projectConfig.generators)
    ) {
      updateProjectConfiguration(
        tree,
        projectName,
        projectConfig as ProjectConfiguration
      );
    }
  }

  await formatFiles(tree);
}

function transformGenerators(generators: Record<string, any>): boolean {
  let changed = false;
  if (transformDefaults(generators[GENERATOR_NAME])) {
    if (Object.keys(generators[GENERATOR_NAME]).length === 0) {
      delete generators[GENERATOR_NAME];
    }
    changed = true;
  }

  const nested = generators[PACKAGE];
  if (
    nested &&
    typeof nested === 'object' &&
    transformDefaults(nested[GENERATOR])
  ) {
    if (nested[GENERATOR] && Object.keys(nested[GENERATOR]).length === 0) {
      delete nested[GENERATOR];
    }
    if (Object.keys(nested).length === 0) {
      delete generators[PACKAGE];
    }
    changed = true;
  }

  return changed;
}

function transformDefaults(defaults: Record<string, any> | undefined): boolean {
  if (!defaults || typeof defaults !== 'object') return false;
  if (!(SKIP_SETUP_FILE in defaults)) return false;

  if (
    defaults[SKIP_SETUP_FILE] === true &&
    defaults[SETUP_FILE] === undefined
  ) {
    defaults[SETUP_FILE] = 'none';
  }
  delete defaults[SKIP_SETUP_FILE];
  return true;
}
