import { normalize, Path } from '@angular-devkit/core';
import {
  asSource,
  chain,
  externalSchematic,
  filter,
  MergeStrategy,
  mergeWith,
  Rule,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import {
  formatFiles,
  getNpmScope,
  renameDirSyncInTree,
  toFileName
} from '@nrwl/workspace';
import { Schema } from './schema';

export interface NormalizedSchema extends Schema {
  name: string;
  prefix: string;
  fileName: string;
  projectRoot: Path;
  projectDirectory: string;
  parsedTags: string[];
}

export default function(schema: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);
    return chain([
      chain([
        externalSchematic('@nrwl/workspace', 'lib', schema),
        filter(file => !file.endsWith('.ts'))
      ]),
      mergeWith(
        asSource(generateNestFiles(!!schema.directory, options)),
        MergeStrategy.Overwrite
      ),
      formatFiles(options)
    ]);
  };
}

function generateNestFiles(isNested: boolean, options: NormalizedSchema): Rule {
  return chain([
    externalSchematic('@nestjs/schematics', 'library', {
      ...{
        name: options.name,
        prefix: options.prefix
      },
      ...(isNested && {
        path: options.projectDirectory
      })
    }),
    adjustNestFilesToLibrary(options)
  ]);
}

function adjustNestFilesToLibrary(options: NormalizedSchema): Rule {
  return chain([
    removeUnwantedNestFiles(options),
    moveNestFilesToLibraryAndAddIndex(options)
  ]);
}

function removeUnwantedNestFiles(options: NormalizedSchema): Rule {
  return chain([
    (tree: Tree) => {
      const nestDirectory = options.directory
        ? `${options.projectRoot}/${options.name}`
        : options.projectRoot;
      if (tree.exists('nest-cli.json')) {
        tree.delete('nest-cli.json');
      }
      tree.delete(`${nestDirectory}/src/index.ts`);
      if (options.directory) {
        tree.delete(nestDirectory + '/tslint.json');
      }
    },
    filter(file => !file.includes('tsconfig'))
  ]);
}

function moveNestFilesToLibraryAndAddIndex(options: NormalizedSchema): Rule {
  return (tree: Tree) => {
    const libDirectory = options.projectRoot;
    const nestDirectory = options.directory
      ? `${options.projectRoot}/${options.name}`
      : options.projectRoot;
    renameDirSyncInTree(
      tree,
      `${nestDirectory}/src`,
      `${libDirectory}/src/lib`,
      err => {
        if (err) {
          throw err;
        }
      }
    );
    tree.create(
      `${libDirectory}/src/index.ts`,
      `export * from './lib/${options.fileName}.module';
      export * from './lib/${options.fileName}.service';`
    );
    return tree;
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const name = toFileName(options.name);
  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = projectName;
  const projectRoot = normalize(`libs/${projectDirectory}`);
  const defaultPrefix = getNpmScope(host);

  const parsedTags = options.tags
    ? options.tags.split(',').map(s => s.trim())
    : [];

  return {
    ...options,
    fileName,
    prefix: defaultPrefix,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags
  };
}
