import { Schema } from './schema';
import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  toJS,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import init from '../init/init';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
import { jestProjectGenerator } from '@nrwl/jest';

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
}

export async function libraryGenerator(host: Tree, schema: Schema) {
  const tasks: GeneratorCallback[] = [];

  const options = normalizeOptions(host, schema);
  if (options.publishable === true && !schema.importPath) {
    throw new Error(
      `For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)`
    );
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
    updateTsConfig(host, options);
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

  if (options.publishable || options.buildable) {
    updateLibPackageNpmScope(host, options);
  }

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

  return lintTask;
}

function addProject(host: Tree, options: NormalizedSchema) {
  const targets: { [key: string]: any } = {};

  if (options.publishable || options.buildable) {
    const { libsDir } = getWorkspaceLayout(host);

    targets.build = {
      builder: '@nrwl/web:package',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: `dist/${libsDir}/${options.projectDirectory}`,
        tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
        project: `${options.projectRoot}/package.json`,
        entryFile: maybeJs(options, `${options.projectRoot}/src/index.ts`),
        external: [],
        assets: ['README.md'],
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

function updateTsConfig(host: Tree, options: NormalizedSchema) {
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
      maybeJs(options, `${libsDir}/${options.projectDirectory}/src/index.ts`),
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
}

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = projectName;
  const { libsDir, npmScope } = getWorkspaceLayout(host);
  const projectRoot = joinPathFragments(`${libsDir}/${projectDirectory}`);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const importPath = options.importPath || `@${npmScope}/${projectDirectory}`;

  const normalized: NormalizedSchema = {
    ...options,
    fileName,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    importPath,
  };

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
