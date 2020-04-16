import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import {
  apply,
  chain,
  mergeWith,
  move,
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
  npmPackageName: string;
  fileTemplate: string;
}

export default function(schema: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    return chain([addFiles(options), updateCollectionJson(options)]);
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

  const npmPackageName = `@${npmScope}/${fileName}`;

  const fileTemplate = getFileTemplate();

  let description: string;
  if (options.description) {
    description = options.description;
  } else {
    description = `${options.name} schematic`;
  }

  const normalized: NormalizedSchema = {
    ...options,
    fileName,
    description,
    projectRoot,
    projectSourceRoot,
    npmScope,
    npmPackageName,
    fileTemplate
  };

  return normalized;
}

function addFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/schematic`), [
      template({
        ...options,
        ...names(options.name),
        tmpl: ''
      }),
      move(`${options.projectSourceRoot}/schematics`)
    ])
  );
}

function updateCollectionJson(options: NormalizedSchema): Rule {
  return updateJsonInTree(
    path.join(options.projectRoot, 'collection.json'),
    json => {
      const schematics = json.schematics ? json.schematics : {};
      schematics[options.name] = {
        factory: `./src/schematics/${options.name}/schematic`,
        schema: `./src/schematics/${options.name}/schema.json`,
        description: options.description
      };
      json.schematics = schematics;

      return json;
    }
  );
}

function getFileTemplate() {
  return stripIndents`
    const variable = "<%= projectName %>";
  `;
}
