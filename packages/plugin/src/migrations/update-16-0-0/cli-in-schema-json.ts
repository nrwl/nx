import {
  GeneratorsJson,
  getProjects,
  joinPathFragments,
  MigrationsJson,
  ExecutorsJson,
  readJson,
  Tree,
  updateJson,
  output,
} from '@nx/devkit';
import {
  ExecutorsJsonEntry,
  GeneratorsJsonEntry,
} from 'nx/src/config/misc-interfaces';
import { PackageJson, readNxMigrateConfig } from 'nx/src/utils/package-json';
import { dirname } from 'path';

export function updateCliPropsForPlugins(tree: Tree) {
  const projects = getProjects(tree);
  for (const project of projects.values()) {
    if (tree.exists(joinPathFragments(project.root, 'package.json'))) {
      const packageJson: PackageJson = readJson(
        tree,
        joinPathFragments(project.root, 'package.json')
      );
      const migrateConfig = readNxMigrateConfig(packageJson);
      if (migrateConfig.migrations) {
        const migrationsPath = joinPathFragments(
          project.root,
          migrateConfig.migrations
        );
        if (tree.exists(migrationsPath)) {
          updateMigrationsJsonForPlugin(tree, migrationsPath);
        } else {
          output.warn({
            title: `Migrations file specified for ${packageJson.name} does not exist: ${migrationsPath}`,
            bodyLines: [
              'Please ensure that migrations that use the Angular Devkit are placed inside the `schematics` property, and migrations that use the Nx Devkit are placed inside the `generators` property.',
            ],
          });
        }
      }
      if (packageJson.generators) {
        const generatorsPath = joinPathFragments(
          project.root,
          packageJson.generators
        );
        if (tree.exists(generatorsPath)) {
          removeCliFromGeneratorSchemaJsonFiles(tree, generatorsPath);
        } else {
          output.warn({
            title: `Generators file specified for ${packageJson.name} does not exist: ${generatorsPath}`,
            bodyLines: [
              "The `cli` property inside generator's `schema.json` files is no longer supported.",
            ],
          });
        }
      }
      if (packageJson.executors) {
        const executorsPath = joinPathFragments(
          project.root,
          packageJson.executors
        );
        if (tree.exists(executorsPath)) {
          removeCliFromExecutorSchemaJsonFiles(tree, executorsPath);
        } else {
          output.warn({
            title: `Executors file specified for ${packageJson.name} does not exist: ${executorsPath}`,
            bodyLines: [
              "The `cli` property inside executor's `schema.json` files is no longer supported.",
            ],
          });
        }
      }
      if (packageJson.builders) {
        const buildersPath = joinPathFragments(
          project.root,
          packageJson.builders
        );
        if (tree.exists(buildersPath)) {
          removeCliFromExecutorSchemaJsonFiles(tree, buildersPath);
        } else {
          output.warn({
            title: `Builders file specified for ${packageJson.name} does not exist: ${buildersPath}`,
            bodyLines: [
              "The `cli` property inside builder's `schema.json` files is no longer supported.",
            ],
          });
        }
      }
      if (packageJson.schematics) {
        const schematicsPath = joinPathFragments(
          project.root,
          packageJson.schematics
        );
        if (tree.exists(schematicsPath)) {
          removeCliFromGeneratorSchemaJsonFiles(tree, schematicsPath);
        } else {
          output.warn({
            title: `Schematics file specified for ${packageJson.name} does not exist: ${schematicsPath}`,
            bodyLines: [
              "The `cli` property inside schematic's `schema.json` files is no longer supported.",
            ],
          });
        }
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
