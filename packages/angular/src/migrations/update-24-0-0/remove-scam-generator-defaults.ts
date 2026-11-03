import {
  formatFiles,
  getProjects,
  readJson,
  readNxJson,
  updateNxJson,
  updateProjectConfiguration,
  writeJson,
  type MigrationReturnObject,
  type Tree,
} from '@nx/devkit';

const COLLECTION = '@nx/angular';
const REMOVED_GENERATORS = [
  'scam',
  'scam-directive',
  'scam-pipe',
  'scam-to-standalone',
];

export default async function (tree: Tree): Promise<MigrationReturnObject> {
  const nxJson = readNxJson(tree);
  if (nxJson && removeGeneratorDefaults(nxJson)) {
    updateNxJson(tree, nxJson);
  }

  const angularJsonProjects = removeAngularJsonGeneratorDefaults(tree);
  for (const [projectName, project] of getProjects(tree)) {
    // updateProjectConfiguration can't write angular.json projects.
    if (angularJsonProjects.has(projectName)) {
      continue;
    }
    if (removeGeneratorDefaults(project)) {
      updateProjectConfiguration(tree, projectName, project);
    }
  }

  await formatFiles(tree);

  return { skipAgentic: true };
}

function removeAngularJsonGeneratorDefaults(tree: Tree): Set<string> {
  if (!tree.exists('angular.json')) {
    return new Set();
  }

  const angularJson = readJson(tree, 'angular.json');
  const projects: Record<string, unknown> = isRecord(angularJson.projects)
    ? angularJson.projects
    : {};
  let changed = false;
  for (const project of Object.values(projects)) {
    if (!isRecord(project)) {
      continue;
    }
    // The Angular CLI uses `schematics`, and Nx also reads `generators`.
    for (const key of ['schematics', 'generators']) {
      const config = { generators: project[key] };
      if (removeGeneratorDefaults(config)) {
        project[key] = config.generators;
        changed = true;
      }
    }
  }

  if (changed) {
    writeJson(tree, 'angular.json', angularJson);
  }

  return new Set(Object.keys(projects));
}

function removeGeneratorDefaults(config: { generators?: unknown }): boolean {
  const { generators } = config;
  if (!isRecord(generators)) {
    return false;
  }

  let changed = removeKeys(
    generators,
    REMOVED_GENERATORS.map((generator) => `${COLLECTION}:${generator}`)
  );

  const collection = generators[COLLECTION];
  if (isRecord(collection) && removeKeys(collection, REMOVED_GENERATORS)) {
    changed = true;
    if (Object.keys(collection).length === 0) {
      delete generators[COLLECTION];
    }
  }

  if (changed && Object.keys(generators).length === 0) {
    // `delete` would keep the old value: updateProjectConfiguration merges into package.json `nx`.
    config.generators = undefined;
  }

  return changed;
}

function removeKeys(obj: Record<string, unknown>, keys: string[]): boolean {
  const presentKeys = keys.filter((key) => key in obj);
  for (const key of presentKeys) {
    delete obj[key];
  }
  return presentKeys.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
