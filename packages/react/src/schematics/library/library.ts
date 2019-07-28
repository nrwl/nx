import {
  apply,
  chain,
  externalSchematic,
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
  addDepsToPackageJson,
  formatFiles,
  getNpmScope,
  insert,
  names,
  NxJson,
  offsetFromRoot,
  readJsonInTree,
  toClassName,
  toFileName,
  updateJsonInTree,
  updateWorkspaceInTree,
  addLintFiles,
  generateProjectLint
} from '@nrwl/workspace';
import { join, normalize, Path } from '@angular-devkit/core';
import * as ts from 'typescript';

import { Schema } from './schema';
import { addRoute, addRouter } from '../../utils/ast-utils';
import { reactRouterVersion } from '../../utils/versions';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: Path;
  projectDirectory: string;
  parsedTags: string[];
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
      externalSchematic('@nrwl/react', 'component', {
        name: options.name,
        project: options.name,
        style: options.style,
        skipTests: options.unitTestRunner === 'none',
        export: true,
        routing: options.routing
      }),
      updateParentRoute(options),
      formatFiles(options)
    ])(host, context);
  };
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

function updateParentRoute(options: NormalizedSchema): Rule {
  return options.parentRoute
    ? chain([
        function ensureRouterAdded(host: Tree) {
          const { source, content } = readComponent(host, options.parentRoute);
          const isRouterPresent = content.match(/react-router-dom/);

          if (!isRouterPresent) {
            insert(
              host,
              options.parentRoute,
              addRouter(options.parentRoute, source)
            );
            return addDepsToPackageJson(
              { 'react-router-dom': reactRouterVersion },
              {}
            );
          }
        },
        function addRouteToComponent(host: Tree) {
          const npmScope = getNpmScope(host);
          const { source: componentSource } = readComponent(
            host,
            options.parentRoute
          );

          insert(
            host,
            options.parentRoute,
            addRoute(options.parentRoute, componentSource, {
              libName: options.name,
              componentName: toClassName(options.name),
              moduleName: `@${npmScope}/${options.projectDirectory}`
            })
          );
        },
        addDepsToPackageJson({ 'react-router-dom': reactRouterVersion }, {})
      ])
    : noop();
}

function readComponent(
  host: Tree,
  path: string
): { content: string; source: ts.SourceFile } {
  if (!host.exists(path)) {
    throw new Error(`Cannot find ${path}`);
  }

  const content = host.read(path).toString('utf-8');

  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  return { content, source };
}

function normalizeOptions(options: Schema): NormalizedSchema {
  const name = toFileName(options.name);
  const projectDirectory = options.directory
    ? `${toFileName(options.directory)}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = options.simpleModuleName ? name : projectName;
  const projectRoot = normalize(`libs/${projectDirectory}`);

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
