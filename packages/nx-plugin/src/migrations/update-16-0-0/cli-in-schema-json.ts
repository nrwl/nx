import {
  GeneratorsJson,
  getProjects,
  joinPathFragments,
  MigrationsJson,
  ExecutorsJson,
  readJson,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import {
  ExecutorsJsonEntry,
  GeneratorsJsonEntry,
} from 'nx/src/config/misc-interfaces';
import { PackageJson, readNxMigrateConfig } from 'nx/src/utils/package-json';
import { dirname } from 'path';

export function updateCliPropsForPlugins(tree: Tree) {
  const projects = getProjects(tree);
  for (const [name, project] of projects.entries()) {
    if (tree.exists(joinPathFragments(project.root, 'package.json'))) {
      const packageJson: PackageJson = readJson(
        tree,
        joinPathFragments(project.root, 'package.json')
      );
      const migrateConfig = readNxMigrateConfig(packageJson);
      if (migrateConfig.migrations) {
        updateMigrationsJsonForPlugin(
          tree,
          joinPathFragments(project.root, migrateConfig.migrations)
        );
      }
      if (packageJson.generators) {
        removeCliFromGeneratorSchemaJsonFiles(
          tree,
          joinPathFragments(project.root, packageJson.generators)
        );
      }
      if (packageJson.executors) {
        removeCliFromExecutorSchemaJsonFiles(
          tree,
          joinPathFragments(project.root, packageJson.executors)
        );
      }
      if (packageJson.builders) {
        removeCliFromExecutorSchemaJsonFiles(
          tree,
          joinPathFragments(project.root, packageJson.builders)
        );
      }
      if (packageJson.schematics) {
        removeCliFromGeneratorSchemaJsonFiles(
          tree,
          joinPathFragments(project.root, packageJson.schematics)
        );
      }
    }
  }
}

function removeCliFromExecutorSchemaJsonFiles(
  tree: Tree,
  collectionPath: string
) {
  const collection: ExecutorsJson = readJson(tree, collectionPath);
  for (const [name, entry] of Object.entries(collection.executors ?? {}).concat(
    Object.entries(collection.builders ?? {})
  )) {
    deleteCliPropFromSchemaFile(collectionPath, entry, tree);
  }
}

function removeCliFromGeneratorSchemaJsonFiles(
  tree: Tree,
  collectionPath: string
) {
  const collection: GeneratorsJson = readJson(tree, collectionPath);
  for (const [name, entry] of Object.entries(
    collection.generators ?? {}
  ).concat(Object.entries(collection.schematics ?? {}))) {
    deleteCliPropFromSchemaFile(collectionPath, entry, tree);
  }
}

function updateMigrationsJsonForPlugin(tree: Tree, collectionPath: string) {
  updateJson<MigrationsJson>(tree, collectionPath, (json) => {
    for (const migration in json.generators ?? {}) {
      if (!(json.generators[migration].cli === 'nx')) {
        json.schematics ??= {};
        json.schematics[migration] = json.generators[migration];
        delete json.generators[migration];
      }
    }
    for (const migration in json.schematics ?? {}) {
      if (json.schematics[migration].cli === 'nx') {
        json.generators ??= {};
        json.generators[migration] = json.schematics[migration];
        delete json.schematics[migration];
      }
    }
    return json;
  });
}

export default updateCliPropsForPlugins;

function deleteCliPropFromSchemaFile(
  collectionPath: string,
  entry: ExecutorsJsonEntry | GeneratorsJsonEntry,
  tree: Tree
) {
  if (!entry.schema) {
    return;
  }
  const schemaPath = joinPathFragments(dirname(collectionPath), entry.schema);
  if (tree.exists(schemaPath)) {
    updateJson(tree, schemaPath, (json) => {
      if (json.cli) {
        delete json.cli;
      }
      return json;
    });
  } else {
    console.warn(`Could not find schema file ${schemaPath}`);
  }
}
