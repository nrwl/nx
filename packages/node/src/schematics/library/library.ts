import { normalize, Path } from '@angular-devkit/core';
import {
  apply,
  chain,
  externalSchematic,
  filter,
  MergeStrategy,
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
  formatFiles,
  getProjectConfig,
  names,
  offsetFromRoot,
  toFileName,
  updateJsonInTree
} from '@nrwl/workspace';
import { Schema } from './schema';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: Path;
  projectDirectory: string;
  parsedTags: string[];
}

export default function(schema: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(schema);

    return chain([
      externalSchematic('@nrwl/workspace', 'lib', schema),
      createFiles(options),
      updateTsConfig(options),
      formatFiles(options)
    ]);
  };
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const name = toFileName(options.name);
  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = projectName;
  const projectRoot = normalize(`libs/${projectDirectory}`);

  const parsedTags = options.tags
    ? options.tags.split(',').map(s => s.trim())
    : [];

  const normalized: NormalizedSchema = {
    ...options,
    fileName,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags
  };

  return normalized;
}

function createFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files/lib`), [
      template({
        ...options,
        ...names(options.name),
        tmpl: '',
        offsetFromRoot: offsetFromRoot(options.projectRoot)
      }),
      move(options.projectRoot),
      options.unitTestRunner === 'none'
        ? filter(file => !file.endsWith('spec.ts'))
        : noop()
    ]),
    MergeStrategy.Overwrite
  );
}

function updateTsConfig(options: NormalizedSchema): Rule {
  if (options.unitTestRunner === 'none') {
    return noop();
  }

  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(host, options.name);
    return updateJsonInTree(`${projectConfig.root}/tsconfig.json`, json => {
      json.compilerOptions.types.push('jest');
      return json;
    });
  };
}
