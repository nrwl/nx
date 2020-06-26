import { join, normalize, Path } from '@angular-devkit/core';
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
  SchematicsException,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics';
import { CSS_IN_JS_DEPENDENCIES } from '@nrwl/react';
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
  updateWorkspaceInTree,
} from '@nrwl/workspace';
import { toJS } from '@nrwl/workspace/src/utils/rules/to-js';
import * as ts from 'typescript';
import { assertValidStyle } from '../../utils/assertion';
import {
  addBrowserRouter,
  addInitialRoutes,
  addRoute,
  findComponentImportPath,
} from '../../utils/ast-utils';
import { extraEslintDependencies, reactEslintJson } from '../../utils/lint';
import {
  reactDomVersion,
  reactRouterDomVersion,
  reactVersion,
  typesReactRouterDomVersion,
} from '../../utils/versions';
import { Schema } from './schema';
import { libsDir } from '@nrwl/workspace/src/utils/ast-utils';
import { initRootBabelConfig } from '@nrwl/web/src/utils/rules';
import { updateBabelJestConfig } from '../../rules/update-babel-jest-config';

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

export default function (schema: Schema): Rule {
  return (host: Tree, context: SchematicContext) => {
    const options = normalizeOptions(host, schema);

    if (options.publishable === true && !schema.importPath) {
      throw new SchematicsException(
        `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
      );
    }

    if (!options.component) {
      options.style = 'none';
    }
    return chain([
      addLintFiles(options.projectRoot, options.linter, {
        localConfig: reactEslintJson,
        extraPackageDeps: extraEslintDependencies,
      }),
      createFiles(options),
      !options.skipTsConfig ? updateTsConfig(options) : noop(),
      addProject(options),
      updateNxJson(options),
      options.unitTestRunner !== 'none'
        ? chain([
            externalSchematic('@nrwl/jest', 'jest-project', {
              project: options.name,
              setupFile: 'none',
              supportTsx: true,
              skipSerializers: true,
              babelJest: true,
            }),
            updateBabelJestConfig(options.projectRoot, (json) => {
              if (options.style === 'styled-jsx') {
                json.plugins = (json.plugins || []).concat('styled-jsx/babel');
              }
              return json;
            }),
          ])
        : noop(),
      options.component
        ? externalSchematic('@nrwl/react', 'component', {
            name: options.name,
            project: options.name,
            flat: true,
            style: options.style,
            skipTests: options.unitTestRunner === 'none',
            export: true,
            routing: options.routing,
            js: options.js,
            pascalCaseFiles: options.pascalCaseFiles,
          })
        : noop(),
      options.publishable ? updateLibPackageNpmScope(options) : noop(),
      addDepsToPackageJson(
        {
          react: reactVersion,
          'react-dom': reactDomVersion,
        },
        {}
      ),
      updateAppRoutes(options, context),
      initRootBabelConfig(),
      formatFiles(options),
    ])(host, context);
  };
}

function addProject(options: NormalizedSchema): Rule {
  return updateWorkspaceInTree((json, context, host) => {
    const architect: { [key: string]: any } = {};

    architect.lint = generateProjectLint(
      normalize(options.projectRoot),
      join(normalize(options.projectRoot), 'tsconfig.lib.json'),
      options.linter
    );

    if (options.publishable || options.buildable) {
      const external = ['react', 'react-dom'];
      // Also exclude CSS-in-JS packages from build
      if (
        options.style !== 'css' &&
        options.style !== 'scss' &&
        options.style !== 'styl' &&
        options.style !== 'less' &&
        options.style !== 'none'
      ) {
        external.push(
          ...Object.keys(CSS_IN_JS_DEPENDENCIES[options.style].dependencies)
        );
      }
      architect.build = {
        builder: '@nrwl/web:package',
        options: {
          outputPath: `dist/${libsDir(host)}/${options.projectDirectory}`,
          tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
          project: `${options.projectRoot}/package.json`,
          entryFile: maybeJs(options, `${options.projectRoot}/src/index.ts`),
          external,
          babelConfig: `@nrwl/react/plugins/bundle-babel`,
          rollupConfig: `@nrwl/react/plugins/bundle-rollup`,
          assets: [
            {
              glob: 'README.md',
              input: '.',
              output: '.',
            },
          ],
        },
      };
    }

    json.projects[options.name] = {
      root: options.projectRoot,
      sourceRoot: join(normalize(options.projectRoot), 'src'),
      projectType: 'library',
      schematics: {},
      architect,
    };
    return json;
  });
}

function updateTsConfig(options: NormalizedSchema): Rule {
  return chain([
    (host: Tree, context: SchematicContext) => {
      const nxJson = readJsonInTree<NxJson>(host, 'nx.json');
      return updateJsonInTree('tsconfig.base.json', (json) => {
        const c = json.compilerOptions;
        c.paths = c.paths || {};
        delete c.paths[options.name];

        if (c.paths[options.importPath]) {
          throw new SchematicsException(
            `You already have a library using the import path "${options.importPath}". Make sure to specify a unique one.`
          );
        }

        c.paths[options.importPath] = [
          maybeJs(
            options,
            `${libsDir(host)}/${options.projectDirectory}/src/index.ts`
          ),
        ];

        return json;
      })(host, context);
    },
  ]);
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
      options.publishable || options.buildable
        ? noop()
        : filter((file) => !file.endsWith('package.json')),
      options.js ? toJS() : noop(),
    ])
  );
}

function updateNxJson(options: NormalizedSchema): Rule {
  return updateJsonInTree<NxJson>('nx.json', (json) => {
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
      maybeJs(options, `${componentImportPath}.tsx`)
    );
    return chain([
      addDepsToPackageJson(
        { 'react-router-dom': reactRouterDomVersion },
        { '@types/react-router-dom': typesReactRouterDomVersion }
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
              moduleName: `@${npmScope}/${options.projectDirectory}`,
            },
            context
          )
        );
      },
      addDepsToPackageJson({ 'react-router-dom': reactRouterDomVersion }, {}),
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

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
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

  const importPath =
    options.importPath || `@${getNpmScope(host)}/${projectDirectory}`;

  const normalized: NormalizedSchema = {
    ...options,
    fileName,
    routePath: `/${name}`,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    importPath,
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

function updateLibPackageNpmScope(options: NormalizedSchema): Rule {
  return updateJsonInTree(`${options.projectRoot}/package.json`, (json) => {
    json.name = options.importPath;
    return json;
  });
}

function maybeJs(options: NormalizedSchema, path: string): string {
  return options.js && (path.endsWith('.ts') || path.endsWith('.tsx'))
    ? path.replace(/\.tsx?$/, '.js')
    : path;
}
