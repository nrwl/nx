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
  url,
} from '@angular-devkit/schematics';
import {
  formatFiles,
  names,
  offsetFromRoot,
  toFileName,
  updateWorkspaceInTree,
  getNpmScope,
} from '@nrwl/workspace';
import { Schema } from './schema';
import { libsDir } from '@nrwl/workspace/src/utils/ast-utils';

export interface NormalizedSchema extends Schema {
  name: string;
  prefix: string;
  fileName: string;
  projectRoot: Path;
  projectDirectory: string;
  parsedTags: string[];
}

export default function (schema: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    return chain([
      externalSchematic('@nrwl/workspace', 'lib', schema),
      createFiles(options),
      addProject(options),
      formatFiles(options),
    ]);
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const defaultPrefix = getNpmScope(host);
  const name = toFileName(options.name);
  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = projectName;
  const projectRoot = normalize(`${libsDir(host)}/${projectDirectory}`);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const normalized: NormalizedSchema = {
    ...options,
    prefix: defaultPrefix, // we could also allow customizing this
    fileName,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
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
        offsetFromRoot: offsetFromRoot(options.projectRoot),
      }),
      move(options.projectRoot),
      options.unitTestRunner === 'none'
        ? filter((file) => !file.endsWith('spec.ts'))
        : noop(),
      options.publishable
        ? noop()
        : filter((file) => !file.endsWith('package.json')),
    ]),
    MergeStrategy.Overwrite
  );
}

function addProject(options: NormalizedSchema): Rule {
  if (!options.publishable) {
    return noop();
  }

  return updateWorkspaceInTree((json, context, host) => {
    const architect = json.projects[options.name].architect;
    if (architect) {
      architect.build = {
        builder: '@nrwl/node:package',
        options: {
          outputPath: `dist/${libsDir(host)}/${options.projectDirectory}`,
          tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
          packageJson: `${options.projectRoot}/package.json`,
          main: `${options.projectRoot}/src/index.ts`,
          assets: [`${options.projectRoot}/*.md`],
        },
      };
    }
    return json;
  });
}
