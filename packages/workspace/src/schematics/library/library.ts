import {
  chain,
  externalSchematic,
  Rule,
  Tree,
  SchematicContext,
  mergeWith,
  apply,
  url,
  template,
  move,
  noop
} from '@angular-devkit/schematics';
import { join, normalize } from '@angular-devkit/core';
import { Schema } from './schema';

import { NxJson, updateWorkspaceInTree } from '@nrwl/workspace';
import { updateJsonInTree, readJsonInTree } from '@nrwl/workspace';
import { toFileName, names } from '@nrwl/workspace';
import { formatFiles } from '@nrwl/workspace';
import { offsetFromRoot } from '@nrwl/workspace';
import { generateProjectLint, addLintFiles } from '../../utils/lint';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
}

function addProject(options: NormalizedSchema): Rule {
  return updateWorkspaceInTree(json => {
    const architect: { [key: string]: any } = {};

    architect.lint = generateProjectLint(
      normalize(options.projectRoot),
      join(normalize(options.projectRoot), 'tsconfig.lib.json'),
      options.linter
    );

    json.projects[options.name] = {
      root: options.projectRoot,
      sourceRoot: join(normalize(options.projectRoot), 'src'),
      projectType: 'library',
      schematics: {},
      architect
    };
    return json;
  });
}

function updateTsConfig(options: NormalizedSchema): Rule {
  return chain([
    (host: Tree, context: SchematicContext) => {
      const nxJson = readJsonInTree<NxJson>(host, 'nx.json');
      return updateJsonInTree('tsconfig.json', json => {
        const c = json.compilerOptions;
        delete c.paths[options.name];
        c.paths[`@${nxJson.npmScope}/${options.projectDirectory}`] = [
          `libs/${options.projectDirectory}/src/index.ts`
        ];
        return json;
      })(host, context);
    }
  ]);
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
      move(options.projectRoot)
    ])
  );
}

function updateNxJson(options: NormalizedSchema): Rule {
  return updateJsonInTree<NxJson>('nx.json', json => {
    json.projects[options.name] = { tags: options.parsedTags };
    return json;
  });
}

export default function(schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(schema);
    return chain([
      addLintFiles(options.projectRoot, options.linter),
      createFiles(options),
      !options.skipTsConfig ? updateTsConfig(options) : noop(),
      addProject(options),
      updateNxJson(options),
      options.unitTestRunner !== 'none'
        ? externalSchematic('@nrwl/jest', 'jest-project', {
            project: options.name,
            setupFile: 'none',
            supportTsx: true,
            skipSerializers: true
          })
        : noop(),
      formatFiles(options)
    ])(host, context);
  };
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const name = toFileName(options.name);
  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = options.simpleModuleName ? name : projectName;
  const projectRoot = `libs/${projectDirectory}`;

  const parsedTags = options.tags
    ? options.tags.split(',').map(s => s.trim())
    : [];

  return {
    ...options,
    fileName,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags
  };
}
