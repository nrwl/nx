import {
  apply,
  chain,
  externalSchematic,
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
  addDepsToPackageJson,
  addLintFiles,
  formatFiles,
  generateProjectLint,
  getNpmScope,
  getProjectConfig,
  insert,
  names,
  NxJson,
  offsetFromRoot,
  readJsonInTree,
  toClassName,
  toFileName,
  updateJsonInTree,
  updateWorkspaceInTree
} from '@nrwl/workspace';
import { join, normalize, Path } from '@angular-devkit/core';
import * as ts from 'typescript';

import { Schema } from './schema';
import {
  addBrowserRouter,
  addInitialRoutes,
  addRoute,
  findComponentImportPath
} from '../../utils/ast-utils';
import {
  reactRouterTypesVersion,
  reactRouterDomVersion
} from '../../utils/versions';
import { assertValidStyle } from '../../utils/assertion';
import { extraEslintDependencies, reactEslintJson } from '../../utils/lint';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: Path;
  routePath: string;
  projectDirectory: string;
  parsedTags: string[];
  appMain?: string;
  appSourceRoot?: Path;
}

export default function(schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema, context);

    return chain([
      addLintFiles(options.projectRoot, options.linter, {
        localConfig: reactEslintJson,
        extraPackageDeps: extraEslintDependencies
      }),
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
      updateAppRoutes(options, context),
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

    if (options.publishable) {
      architect.build = {
        builder: '@nrwl/web:bundle',
        options: {
          outputPath: `dist/libs/${options.projectDirectory}`,
          tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
          project: `${options.projectRoot}/package.json`,
          entryFile: `${options.projectRoot}/src/index.ts`,
          babelConfig: `@nrwl/react/plugins/bundle-babel`,
          rollupConfig: `@nrwl/react/plugins/bundle-rollup`
        }
      };
    }

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
      move(options.projectRoot),
      options.publishable
        ? noop()
        : filter(file => !file.endsWith('package.json'))
    ])
  );
}

function updateNxJson(options: NormalizedSchema): Rule {
  return updateJsonInTree<NxJson>('nx.json', json => {
    json.projects[options.name] = { tags: options.parsedTags };
    return json;
  });
}

function updateAppRoutes(
  options: NormalizedSchema,
  context: SchematicContext
): Rule {
  if (!options.appMain || !options.appSourceRoot) {
    return noop();
  }
  return (host: Tree) => {
    const { source } = readComponent(host, options.appMain);
    const componentImportPath = findComponentImportPath('App', source);

    if (!componentImportPath) {
      throw new Error(
        `Could not find App component in ${options.appMain} (Hint: you can omit --appProject, or make sure App exists)`
      );
    }

    const appComponentPath = join(
      options.appSourceRoot,
      `${componentImportPath}.tsx`
    );
    return chain([
      addDepsToPackageJson(
        { 'react-router-dom': reactRouterDomVersion },
        { '@types/react-router-dom': reactRouterTypesVersion }
      ),
      function addBrowserRouterToMain(host: Tree) {
        const { content, source } = readComponent(host, options.appMain);
        const isRouterPresent = content.match(/react-router-dom/);
        if (!isRouterPresent) {
          insert(
            host,
            options.appMain,
            addBrowserRouter(options.appMain, source, context)
          );
        }
      },
      function addInitialAppRoutes(host: Tree) {
        const { content, source } = readComponent(host, appComponentPath);
        const isRouterPresent = content.match(/react-router-dom/);
        if (!isRouterPresent) {
          insert(
            host,
            appComponentPath,
            addInitialRoutes(appComponentPath, source, context)
          );
        }
      },
      function addNewAppRoute(host: Tree) {
        const npmScope = getNpmScope(host);
        const { source: componentSource } = readComponent(
          host,
          appComponentPath
        );
        insert(
          host,
          appComponentPath,
          addRoute(
            appComponentPath,
            componentSource,
            {
              routePath: options.routePath,
              componentName: toClassName(options.name),
              moduleName: `@${npmScope}/${options.projectDirectory}`
            },
            context
          )
        );
      },
      addDepsToPackageJson({ 'react-router-dom': reactRouterDomVersion }, {})
    ]);
  };
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

function normalizeOptions(
  host: Tree,
  options: Schema,
  context: SchematicContext
): NormalizedSchema {
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
    routePath: `/${name}`,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags
  };

  if (options.appProject) {
    const appProjectConfig = getProjectConfig(host, options.appProject);

    if (appProjectConfig.projectType !== 'application') {
      throw new Error(
        `appProject expected type of "application" but got "${appProjectConfig.projectType}"`
      );
    }

    try {
      normalized.appMain = appProjectConfig.architect.build.options.main;
      normalized.appSourceRoot = normalize(appProjectConfig.sourceRoot);
    } catch (e) {
      throw new Error(
        `Could not locate project main for ${options.appProject}`
      );
    }
  }

  assertValidStyle(normalized.style);

  return normalized;
}
