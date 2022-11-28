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
import { getImportPath } from 'nx/src/utils/path';
import { jestProjectGenerator } from '@nrwl/jest';
import { swcCoreVersion } from '@nrwl/js/src/utils/versions';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import {
  getRelativePathToRootTsConfig,
  getRootTsConfigPathInTree,
} from '@nrwl/workspace/src/utilities/typescript';
import * as ts from 'typescript';
import { assertValidStyle } from '../../utils/assertion';
import {
  addBrowserRouter,
  addInitialRoutes,
  addRoute,
  findComponentImportPath,
} from '../../utils/ast-utils';
import {
  extendReactEslintJson,
  extraEslintDependencies,
} from '../../utils/lint';
import {
  reactDomVersion,
  reactRouterDomVersion,
  reactVersion,
  typesReactRouterDomVersion,
} from '../../utils/versions';
import componentGenerator from '../component/component';
import initGenerator from '../init/init';
import { Schema } from './schema';
import { updateJestConfigContent } from '../../utils/jest-utils';
import { viteConfigurationGenerator, vitestGenerator } from '@nrwl/vite';
import { normalizeOptions } from './lib/normalize-options';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  routePath: string;
  projectDirectory: string;
  parsedTags: string[];
  appMain?: string;
  appSourceRoot?: string;
  unitTestRunner: 'jest' | 'vitest' | 'none';
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

  const initTask = await initGenerator(host, {
    ...options,
    e2eTestRunner: 'none',
    skipFormat: true,
    skipBabelConfig: options.bundler === 'vite',
  });
  tasks.push(initTask);

  addProject(host, options);

  const lintTask = await addLinting(host, options);
  tasks.push(lintTask);

  createFiles(host, options);

  if (!options.skipTsConfig) {
    updateBaseTsConfig(host, options);
  }

  if (options.buildable && options.bundler === 'vite') {
    const viteTask = await viteConfigurationGenerator(host, {
      uiFramework: 'react',
      project: options.name,
      newProject: true,
      includeLib: true,
      inSourceTests: options.inSourceTests,
      includeVitest: true,
    });
    tasks.push(viteTask);
  }

  if (options.unitTestRunner === 'jest') {
    const jestTask = await jestProjectGenerator(host, {
      ...options,
      project: options.name,
      setupFile: 'none',
      supportTsx: true,
      skipSerializers: true,
      compiler: options.compiler,
    });
    tasks.push(jestTask);
    const jestConfigPath = joinPathFragments(
      options.projectRoot,
      options.js ? 'jest.config.js' : 'jest.config.ts'
    );
    if (options.compiler === 'babel' && host.exists(jestConfigPath)) {
      const updatedContent = updateJestConfigContent(
        host.read(jestConfigPath, 'utf-8')
      );
      host.write(jestConfigPath, updatedContent);
    }
  } else if (
    options.unitTestRunner === 'vitest' &&
    options.bundler !== 'vite' // tests are already configured if bundler is vite
  ) {
    const vitestTask = await vitestGenerator(host, {
      uiFramework: 'react',
      project: options.name,
      inSourceTests: options.inSourceTests,
    });
    tasks.push(vitestTask);
  }

  if (options.component) {
    const componentTask = await componentGenerator(host, {
      name: options.name,
      project: options.name,
      flat: true,
      style: options.style,
      skipTests:
        options.unitTestRunner === 'none' ||
        (options.unitTestRunner === 'vitest' && options.inSourceTests == true),
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

  if (!options.skipPackageJson) {
    const installTask = await addDependenciesToPackageJson(
      host,
      {
        react: reactVersion,
        'react-dom': reactDomVersion,
      },
      options.compiler === 'swc' ? { '@swc/core': swcCoreVersion } : {}
    );
    tasks.push(installTask);
  }

  const routeTask = updateAppRoutes(host, options);
  tasks.push(routeTask);

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

async function addLinting(host: Tree, options: NormalizedSchema) {
  if (options.linter === Linter.EsLint) {
    const lintTask = await lintProjectGenerator(host, {
      linter: options.linter,
      project: options.name,
      tsConfigPaths: [
        joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
      ],
      unitTestRunner: options.unitTestRunner,
      eslintFilePatterns: [`${options.projectRoot}/**/*.{ts,tsx,js,jsx}`],
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
    });

    updateJson(
      host,
      joinPathFragments(options.projectRoot, '.eslintrc.json'),
      extendReactEslintJson
    );

    let installTask = () => {};
    if (!options.skipPackageJson) {
      installTask = await addDependenciesToPackageJson(
        host,
        extraEslintDependencies.dependencies,
        extraEslintDependencies.devDependencies
      );
    }

    return runTasksInSerial(lintTask, installTask);
  } else {
    return () => {};
  }
}

function addProject(host: Tree, options: NormalizedSchema) {
  const targets: { [key: string]: any } = {};

  if (options.publishable || options.buildable) {
    const { libsDir } = getWorkspaceLayout(host);
    const external: string[] = [];

    if (options.style === '@emotion/styled') {
      external.push('@emotion/react/jsx-runtime');
    } else {
      external.push('react/jsx-runtime');
    }

    targets.build = {
      executor: '@nrwl/web:rollup',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: `dist/${libsDir}/${options.projectDirectory}`,
        tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
        project: `${options.projectRoot}/package.json`,
        entryFile: maybeJs(options, `${options.projectRoot}/src/index.ts`),
        external,
        rollupConfig: `@nrwl/react/plugins/bundle-rollup`,
        compiler: options.compiler ?? 'babel',
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
          noImplicitOverride: true,
          noPropertyAccessFromIndexSignature: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
        };
      }

      return json;
    }
  );
}

function updateBaseTsConfig(host: Tree, options: NormalizedSchema) {
  updateJson(host, getRootTsConfigPathInTree(host), (json) => {
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
  const substitutions = {
    ...options,
    ...names(options.name),
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    rootTsConfigPath: getRelativePathToRootTsConfig(host, options.projectRoot),
  };

  generateFiles(
    host,
    joinPathFragments(__dirname, './files/common'),
    options.projectRoot,
    substitutions
  );

  if (options.bundler === 'vite') {
    generateFiles(
      host,
      joinPathFragments(__dirname, './files/vite'),
      options.projectRoot,
      substitutions
    );

    if (host.exists(joinPathFragments(options.projectRoot, '.babelrc'))) {
      host.delete(joinPathFragments(options.projectRoot, '.babelrc'));
    }
  }

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
        moduleName: getImportPath(npmScope, options.projectDirectory),
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
