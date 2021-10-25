import * as ts from 'typescript';
import { assertValidStyle } from '../../utils/assertion';
import {
  addBrowserRouter,
  addInitialRoutes,
  addRoute,
  findComponentImportPath,
} from '../../utils/ast-utils';
import {
  createReactEslintJson,
  extraEslintDependencies,
} from '../../utils/lint';
import {
  reactDomVersion,
  reactRouterDomVersion,
  reactVersion,
  typesReactRouterDomVersion,
} from '../../utils/versions';
import { Schema } from './schema';
import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  applyChangesToString,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getProjects,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  normalizePath,
  offsetFromRoot,
  toJS,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import init from '../init/init';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { jestProjectGenerator } from '@nrwl/jest';
import componentGenerator from '../component/component';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  routePath: string;
  projectDirectory: string;
  parsedTags: string[];
  appMain?: string;
  appSourceRoot?: string;
}

export async function libraryGenerator(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const options = normalizeOptions(host, schema);
  if (options.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }
  if (!options.component) {
    options.style = 'none';
  }

  const initTask = await init(host, {
    ...options,
    e2eTestRunner: 'none',
    skipFormat: true,
  });
  tasks.push(initTask);

  addProject(host, options);

  const lintTask = await addLinting(host, options);
  tasks.push(lintTask);

  createFiles(host, options);

  if (!options.skipTsConfig) {
    updateBaseTsConfig(host, options);
  }

  if (options.unitTestRunner === 'jest') {
    const jestTask = await jestProjectGenerator(host, {
      project: options.name,
      setupFile: 'none',
      supportTsx: true,
      skipSerializers: true,
      babelJest: true,
    });
    tasks.push(jestTask);
  }

  if (options.component) {
    const componentTask = await componentGenerator(host, {
      name: options.name,
      project: options.name,
      flat: true,
      style: options.style,
      skipTests: options.unitTestRunner === 'none',
      export: true,
      routing: options.routing,
      js: options.js,
      pascalCaseFiles: options.pascalCaseFiles,
    });
    tasks.push(componentTask);
  }

  if (options.publishable || options.buildable) {
    updateLibPackageNpmScope(host, options);
  }

  const installTask = await addDependenciesToPackageJson(
    host,
    {
      react: reactVersion,
      'react-dom': reactDomVersion,
    },
    {}
  );
  tasks.push(installTask);

  const routeTask = updateAppRoutes(host, options);
  tasks.push(routeTask);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

async function addLinting(host: Tree, options: NormalizedSchema) {
  const lintTask = await lintProjectGenerator(host, {
    linter: options.linter,
    project: options.name,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
    ],
    eslintFilePatterns: [`${options.projectRoot}/**/*.{ts,tsx,js,jsx}`],
    skipFormat: true,
  });

  if (options.linter === Linter.TsLint) {
    return;
  }

  const reactEslintJson = createReactEslintJson(
    options.projectRoot,
    options.setParserOptionsProject
  );

  updateJson(
    host,
    joinPathFragments(options.projectRoot, '.eslintrc.json'),
    () => reactEslintJson
  );

  const installTask = await addDependenciesToPackageJson(
    host,
    extraEslintDependencies.dependencies,
    extraEslintDependencies.devDependencies
  );

  return runTasksInSerial(lintTask, installTask);
}

function addProject(host: Tree, options: NormalizedSchema) {
  const targets: { [key: string]: any } = {};

  if (options.publishable || options.buildable) {
    const { libsDir } = getWorkspaceLayout(host);
    const external = ['react/jsx-runtime'];

    if (options.style === '@emotion/styled') {
      external.push('@emotion/styled/base');
    }

    targets.build = {
      builder: '@nrwl/web:package',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: `dist/${libsDir}/${options.projectDirectory}`,
        tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
        project: `${options.projectRoot}/package.json`,
        entryFile: maybeJs(options, `${options.projectRoot}/src/index.ts`),
        external,
        rollupConfig: `@nrwl/react/plugins/bundle-rollup`,
        assets: [
          {
            glob: `${options.projectRoot}/README.md`,
            input: '.',
            output: '.',
          },
        ],
      },
    };
  }

  addProjectConfiguration(
    host,
    options.name,
    {
      root: options.projectRoot,
      sourceRoot: joinPathFragments(options.projectRoot, 'src'),
      projectType: 'library',
      tags: options.parsedTags,
      targets,
    },
    options.standaloneConfig
  );
}

function updateTsConfig(tree: Tree, options: NormalizedSchema) {
  updateJson(
    tree,
    joinPathFragments(options.projectRoot, 'tsconfig.json'),
    (json) => {
      if (options.strict) {
        json.compilerOptions = {
          ...json.compilerOptions,
          forceConsistentCasingInFileNames: true,
          strict: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
        };
      }

      return json;
    }
  );
}

function updateBaseTsConfig(host: Tree, options: NormalizedSchema) {
  updateJson(host, 'tsconfig.base.json', (json) => {
    const c = json.compilerOptions;
    c.paths = c.paths || {};
    delete c.paths[options.name];

    if (c.paths[options.importPath]) {
      throw new Error(
        `You already have a library using the import path "${options.importPath}". Make sure to specify a unique one.`
      );
    }

    const { libsDir } = getWorkspaceLayout(host);

    c.paths[options.importPath] = [
      maybeJs(
        options,
        joinPathFragments(libsDir, `${options.projectDirectory}/src/index.ts`)
      ),
    ];

    return json;
  });
}

function createFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(
    host,
    joinPathFragments(__dirname, './files/lib'),
    options.projectRoot,
    {
      ...options,
      ...names(options.name),
      tmpl: '',
      offsetFromRoot: offsetFromRoot(options.projectRoot),
    }
  );

  if (!options.publishable && !options.buildable) {
    host.delete(`${options.projectRoot}/package.json`);
  }

  if (options.js) {
    toJS(host);
  }

  updateTsConfig(host, options);
}

function updateAppRoutes(host: Tree, options: NormalizedSchema) {
  if (!options.appMain || !options.appSourceRoot) {
    return () => {};
  }

  const { content, source } = readComponent(host, options.appMain);

  const componentImportPath = findComponentImportPath('App', source);

  if (!componentImportPath) {
    throw new Error(
      `Could not find App component in ${options.appMain} (Hint: you can omit --appProject, or make sure App exists)`
    );
  }

  const appComponentPath = joinPathFragments(
    options.appSourceRoot,
    maybeJs(options, `${componentImportPath}.tsx`)
  );

  const routerTask = addDependenciesToPackageJson(
    host,
    { 'react-router-dom': reactRouterDomVersion },
    { '@types/react-router-dom': typesReactRouterDomVersion }
  );

  // addBrowserRouterToMain
  const isRouterPresent = content.match(/react-router-dom/);
  if (!isRouterPresent) {
    const changes = applyChangesToString(
      content,
      addBrowserRouter(options.appMain, source)
    );
    host.write(options.appMain, changes);
  }

  // addInitialAppRoutes
  {
    const { content: componentContent, source: componentSource } =
      readComponent(host, appComponentPath);
    const isComponentRouterPresent = componentContent.match(/react-router-dom/);
    if (!isComponentRouterPresent) {
      const changes = applyChangesToString(
        componentContent,
        addInitialRoutes(appComponentPath, componentSource)
      );
      host.write(appComponentPath, changes);
    }
  }

  // addNewAppRoute
  {
    const { content: componentContent, source: componentSource } =
      readComponent(host, appComponentPath);
    const { npmScope } = getWorkspaceLayout(host);
    const changes = applyChangesToString(
      componentContent,
      addRoute(appComponentPath, componentSource, {
        routePath: options.routePath,
        componentName: names(options.name).className,
        moduleName: `@${npmScope}/${options.projectDirectory}`,
      })
    );
    host.write(appComponentPath, changes);
  }

  return routerTask;
}

function readComponent(
  host: Tree,
  path: string
): { content: string; source: ts.SourceFile } {
  if (!host.exists(path)) {
    throw new Error(`Cannot find ${path}`);
  }

  const content = host.read(path, 'utf-8');

  const source = ts.createSourceFile(
    path,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  return { content, source };
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = projectName;
  const { libsDir, npmScope } = getWorkspaceLayout(host);
  const projectRoot = joinPathFragments(libsDir, projectDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const importPath = options.importPath || `@${npmScope}/${projectDirectory}`;

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
    const appProjectConfig = getProjects(host).get(options.appProject);

    if (appProjectConfig.projectType !== 'application') {
      throw new Error(
        `appProject expected type of "application" but got "${appProjectConfig.projectType}"`
      );
    }

    try {
      normalized.appMain = appProjectConfig.targets.build.options.main;
      normalized.appSourceRoot = normalizePath(appProjectConfig.sourceRoot);
    } catch (e) {
      throw new Error(
        `Could not locate project main for ${options.appProject}`
      );
    }
  }

  assertValidStyle(normalized.style);

  return normalized;
}

function updateLibPackageNpmScope(host: Tree, options: NormalizedSchema) {
  return updateJson(host, `${options.projectRoot}/package.json`, (json) => {
    json.name = options.importPath;
    return json;
  });
}

function maybeJs(options: NormalizedSchema, path: string): string {
  return options.js && (path.endsWith('.ts') || path.endsWith('.tsx'))
    ? path.replace(/\.tsx?$/, '.js')
    : path;
}

export default libraryGenerator;
export const librarySchematic = convertNxGenerator(libraryGenerator);
