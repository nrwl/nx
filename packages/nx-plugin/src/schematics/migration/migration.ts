import { JsonArray, JsonObject } from '@angular-devkit/core';
import {
  apply,
  chain,
  mergeWith,
  move,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
  filter,
  noop,
} from '@angular-devkit/schematics';
import {
  getProjectConfig,
  toFileName,
  updateJsonInTree,
  updateWorkspace,
} from '@nrwl/workspace';
import * as path from 'path';
import { Schema } from './schema';

export interface NormalizedSchema extends Schema {
  projectRoot: string;
  projectSourceRoot: string;
}

export default function (schema: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    return chain([
      addFiles(options),
      updateMigrationsJson(options),
      updateWorkspaceJson(options),
      updatePackageJson(options),
    ]);
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  let name: string;
  if (options.name) {
    name = toFileName(options.name);
  } else {
    name = toFileName(`update-${options.version}`);
  }

  let description: string;
  if (options.description) {
    description = options.description;
  } else {
    description = name;
  }

  const { root: projectRoot, sourceRoot: projectSourceRoot } = getProjectConfig(
    host,
    options.project
  );

  const normalized: NormalizedSchema = {
    ...options,
    name,
    description,
    projectRoot,
    projectSourceRoot,
  };

  return normalized;
}

function addFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/migration`), [
      template({
        ...options,
        tmpl: '',
      }),
      options.unitTestRunner === 'none'
        ? filter((file) => !file.endsWith('.spec.ts'))
        : noop(),
      move(`${options.projectSourceRoot}/migrations`),
    ])
  );
}

function updateWorkspaceJson(options: NormalizedSchema): Rule {
  return updateWorkspace((workspace) => {
    const targets = workspace.projects.get(options.project).targets;
    const build = targets.get('build');
    if (
      build &&
      (build.options.assets as JsonArray).filter(
        (asset) => (asset as JsonObject).glob === 'migrations.json'
      ).length === 0
    ) {
      (build.options.assets as JsonArray).push(
        ...[
          {
            input: `./${options.projectRoot}`,
            glob: 'migrations.json',
            output: '.',
          },
        ]
      );
    }
  });
}

function updateMigrationsJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(
    path.join(options.projectRoot, 'migrations.json'),
    (json) => {
      const schematics = json.schematics ? json.schematics : {};
      schematics[options.name] = {
        version: options.version,
        description: options.description,
        factory: `./src/migrations/${options.name}/${options.name}`,
      };
      json.schematics = schematics;

      if (options.packageJsonUpdates) {
        const packageJsonUpdatesObj = json.packageJsonUpdates
          ? json.packageJsonUpdates
          : {};
        if (!packageJsonUpdatesObj[options.version]) {
          packageJsonUpdatesObj[options.version] = {
            version: options.version,
            packages: {},
          };
        }
        json.packageJsonUpdates = packageJsonUpdatesObj;
      }

      return json;
    }
  );
}

function updatePackageJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(
    path.join(options.projectRoot, 'package.json'),
    (json) => {
      if (!json['ng-update'] || !json['ng-update'].migrations) {
        if (json['ng-update']) {
          json['ng-update'].migrations = './migrations.json';
        } else {
          json['ng-update'] = {
            migrations: './migrations.json',
          };
        }
      }

      return json;
    }
  );
}
