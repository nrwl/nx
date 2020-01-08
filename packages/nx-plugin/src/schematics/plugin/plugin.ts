import { normalize, Path, JsonArray } from '@angular-devkit/core';
import {
  apply,
  chain,
  externalSchematic,
  MergeStrategy,
  mergeWith,
  move,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
  schematic
} from '@angular-devkit/schematics';
import {
  formatFiles,
  names,
  NxJson,
  offsetFromRoot,
  toFileName,
  updateWorkspace
} from '@nrwl/workspace';
import {
  allFilesInDirInHost,
  getProjectConfig,
  readJsonInTree,
  updateJsonInTree,
  updateWorkspaceInTree
} from '@nrwl/workspace/src/utils/ast-utils';
import { Schema } from './schema';
export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: Path;
  projectDirectory: string;
  parsedTags: string[];
  npmScope: string;
  npmPackageName: string;
}

export default function(schema: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    return chain([
      externalSchematic('@nrwl/node', 'lib', {
        ...schema,
        publishable: true
      }),
      addFiles(options),
      updateWorkspaceJson(options),
      updateTsConfig(options),
      schematic('e2e-project', {
        pluginName: options.name,
        pluginOutputPath: `dist/libs/${options.projectDirectory}`,
        npmPackageName: options.npmPackageName
      }),
      formatFiles(options)
    ]);
  };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const nxJson = readJsonInTree<NxJson>(host, 'nx.json');
  const npmScope = nxJson.npmScope;
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
  const npmPackageName = `@${npmScope}/${name}`;
  const normalized: NormalizedSchema = {
    ...options,
    fileName,
    npmScope,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    npmPackageName
  };

  return normalized;
}

function addFiles(options: NormalizedSchema): Rule {
  return chain([
    host => {
      allFilesInDirInHost(
        host,
        normalize(`${options.projectRoot}/src/lib`)
      ).forEach(file => {
        host.delete(file);
      });

      return host;
    },
    mergeWith(
      apply(url(`./files/plugin`), [
        template({
          ...options,
          ...names(options.name),
          tmpl: '',
          offsetFromRoot: offsetFromRoot(options.projectRoot)
        }),
        move(options.projectRoot)
      ]),
      MergeStrategy.Overwrite
    )
  ]);
}

function updateWorkspaceJson(options: NormalizedSchema): Rule {
  return updateWorkspace(workspace => {
    const targets = workspace.projects.get(options.name).targets;
    const build = targets.get('build');
    if (build) {
      (build.options.assets as JsonArray).push(
        ...[
          {
            input: `./${options.projectRoot}/src`,
            glob: '**/*.json',
            output: './src'
          },
          {
            input: `./${options.projectRoot}`,
            glob: 'collection.json',
            output: '.'
          },
          {
            input: `./${options.projectRoot}`,
            glob: 'builders.json',
            output: '.'
          }
        ]
      );
    }
  });
}

function updateTsConfig(options: NormalizedSchema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const projectConfig = getProjectConfig(host, options.name);
    return updateJsonInTree(`${projectConfig.root}/tsconfig.lib.json`, json => {
      json.compilerOptions.rootDir = '.';
      return json;
    });
  };
}
