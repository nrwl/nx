import {
  addProjectConfiguration,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  TargetConfiguration,
  toJS,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import init from '../init/init';
import { addLinting } from '../../utils/add-linting';
import { addJest } from '../../utils/add-jest';
import { NormalizedSchema, normalizeOptions } from './lib/normalize-options';
import { Schema } from './schema';

export async function reactNativeLibraryGenerator(
  host: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  const options = normalizeOptions(host, schema);
  if (options.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
  }

  addProject(host, options);
  createFiles(host, options);

  const initTask = await init(host, {
    ...options,
    skipFormat: true,
    e2eTestRunner: 'none',
  });

  const lintTask = await addLinting(
    host,
    options.name,
    options.projectRoot,
    [joinPathFragments(options.projectRoot, 'tsconfig.lib.json')],
    options.linter,
    options.setParserOptionsProject
  );

  if (!options.skipTsConfig) {
    updateBaseTsConfig(host, options);
  }

  const jestTask = await addJest(
    host,
    options.unitTestRunner,
    options.name,
    options.projectRoot
  );

  if (options.publishable || options.buildable) {
    updateLibPackageNpmScope(host, options);
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(initTask, lintTask, jestTask);
}

function addProject(host: Tree, options: NormalizedSchema) {
  const targets: { [key: string]: TargetConfiguration } = {};

  if (options.publishable || options.buildable) {
    const { libsDir } = getWorkspaceLayout(host);
    const external = ['react/jsx-runtime'];

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

  addProjectConfiguration(host, options.name, {
    root: options.projectRoot,
    sourceRoot: joinPathFragments(options.projectRoot, 'src'),
    projectType: 'library',
    tags: options.parsedTags,
    targets,
  });
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

export default reactNativeLibraryGenerator;
export const reactNativeLibrarySchematic = convertNxGenerator(
  reactNativeLibraryGenerator
);
