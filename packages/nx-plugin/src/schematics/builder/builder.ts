import {
  apply,
  chain,
  filter,
  mergeWith,
  move,
  noop,
  Rule,
  SchematicContext,
  template,
  Tree,
  url
} from '@angular-devkit/schematics';
import {
  getProjectConfig,
  names,
  readNxJsonInTree,
  toFileName,
  updateJsonInTree
} from '@nrwl/workspace';
import * as path from 'path';
import { Schema } from './schema';

export interface NormalizedSchema extends Schema {
  fileName: string;
  projectRoot: string;
  projectSourceRoot: string;
  npmScope: string;
}

export default function(schema: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    return chain([addFiles(options), updateBuildersJson(options)]);
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const nxJson = readNxJsonInTree(host);
  const npmScope = nxJson.npmScope;
  const fileName = toFileName(options.name);

  const { root: projectRoot, sourceRoot: projectSourceRoot } = getProjectConfig(
    host,
    options.project
  );

  let description: string;
  if (options.description) {
    description = options.description;
  } else {
    description = `${options.name} builder`;
  }

  const normalized: NormalizedSchema = {
    ...options,
    fileName,
    description,
    projectRoot,
    projectSourceRoot,
    npmScope
  };

  return normalized;
}

function addFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/builder`), [
      template({
        ...options,
        ...names(options.name),
        tmpl: ''
      }),
      options.unitTestRunner === 'none'
        ? filter(file => !file.endsWith('.spec.ts'))
        : noop(),
      move(`${options.projectSourceRoot}/builders`)
    ])
  );
}

function updateBuildersJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(
    path.join(options.projectRoot, 'builders.json'),
    json => {
      const builders = json.builders ? json.builders : {};
      builders[options.name] = {
        implementation: `./src/builders/${options.name}/builder`,
        schema: `./src/builders/${options.name}/schema.json`,
        description: options.description
      };
      json.builders = builders;

      return json;
    }
  );
}
