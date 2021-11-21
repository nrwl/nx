import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  offsetFromRoot,
  ProjectConfiguration,
  toJS,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';
import { join } from 'path';
import { GeneratorSchema } from './schema';
import { swcCliVersion, swcCoreVersion, swcHelpersVersion } from './versions';

// nx-ignore-next-line
const { jestProjectGenerator } = require('@nrwl/jest');
// nx-ignore-next-line
const { lintProjectGenerator, Linter } = require('@nrwl/linter');

export async function projectGenerator(
  tree: Tree,
  schema: GeneratorSchema,
  destinationDir: string,
  filesDir: string,
  projectType: 'library' | 'application'
) {
  const options = normalizeOptions(tree, schema, destinationDir);

  createFiles(tree, options, filesDir);

  addProject(tree, options, destinationDir, projectType);

  if (!schema.skipTsConfig) {
    updateRootTsConfig(tree, options);
  }

  const tasks: GeneratorCallback[] = [];

  if (options.linter !== 'none') {
    const lintCallback = await addLint(tree, options);
    tasks.push(lintCallback);
  }
  if (options.unitTestRunner === 'jest') {
    const jestCallback = await addJest(tree, options);
    tasks.push(jestCallback);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export interface NormalizedSchema extends GeneratorSchema {
  name: string;
  fileName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  importPath?: string;
}

function addProject(
  tree: Tree,
  options: NormalizedSchema,
  destinationDir: string,
  projectType: 'library' | 'application'
) {
  const projectConfiguration: ProjectConfiguration = {
    root: options.projectRoot,
    sourceRoot: joinPathFragments(options.projectRoot, 'src'),
    projectType: projectType,
    targets: {},
    tags: options.parsedTags,
  };

  if (options.buildable && options.config != 'npm-scripts') {
    projectConfiguration.targets.build = {
      executor: `@nrwl/js:${options.compiler}`,
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: `dist/${destinationDir}/${options.projectDirectory}`,
        main: `${options.projectRoot}/src/index` + (options.js ? '.js' : '.ts'),
        tsConfig: `${options.projectRoot}/${
          projectType === 'library' ? 'tsconfig.lib.json' : 'tsconfig.app.json'
        }`,
        assets: [`${options.projectRoot}/*.md`],
      },
    };
  }

  if (options.config === 'workspace') {
    addProjectConfiguration(tree, options.name, projectConfiguration, false);
  } else if (options.config === 'project') {
    addProjectConfiguration(tree, options.name, projectConfiguration, true);
  } else {
    addProjectConfiguration(
      tree,
      options.name,
      {
        root: projectConfiguration.root,
        tags: projectConfiguration.tags,
      },
      true
    );
  }
}

export function addLint(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  return lintProjectGenerator(tree, {
    project: options.name,
    linter: options.linter,
    skipFormat: true,
    tsConfigPaths: [
      joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
    ],
    eslintFilePatterns: [
      `${options.projectRoot}/**/*.${options.js ? 'js' : 'ts'}`,
    ],
    setParserOptionsProject: options.setParserOptionsProject,
  });
}

function updateTsConfig(tree: Tree, options: NormalizedSchema) {
  updateJson(tree, join(options.projectRoot, 'tsconfig.json'), (json) => {
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
  });
}

function createFiles(tree: Tree, options: NormalizedSchema, filesDir: string) {
  const { className, name, propertyName } = names(options.name);

  generateFiles(tree, filesDir, options.projectRoot, {
    ...options,
    dot: '.',
    className,
    name,
    propertyName,
    js: !!options.js,
    cliCommand: 'nx',
    strict: undefined,
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    buildable: options.buildable === true,
    hasUnitTestRunner: options.unitTestRunner !== 'none',
  });

  if (options.buildable && options.compiler === 'swc') {
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@swc/core': swcCoreVersion,
        '@swc/helpers': swcHelpersVersion,
        '@swc/cli': swcCliVersion,
      }
    );
    addSwcConfig(tree, options.projectRoot);
  }

  if (options.unitTestRunner === 'none') {
    tree.delete(
      join(options.projectRoot, 'src/lib', `${options.fileName}.spec.ts`)
    );
    tree.delete(
      join(options.projectRoot, 'src/app', `${options.fileName}.spec.ts`)
    );
  }

  if (options.js) {
    toJS(tree);
  }

  const packageJsonPath = join(options.projectRoot, 'package.json');
  if (options.config === 'npm-scripts') {
    updateJson(tree, packageJsonPath, (json) => {
      json.scripts = {
        build: "echo 'implement build'",
        test: "echo 'implement test'",
      };
      return json;
    });
  } else if (!options.buildable) {
    tree.delete(packageJsonPath);
  }

  updateTsConfig(tree, options);
}

async function addJest(
  tree: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  return await jestProjectGenerator(tree, {
    project: options.name,
    setupFile: 'none',
    supportTsx: true,
    skipSerializers: true,
    testEnvironment: options.testEnvironment,
    skipFormat: true,
  });
}

function normalizeOptions(
  tree: Tree,
  options: GeneratorSchema,
  destinationDir: string
): NormalizedSchema {
  if (options.config === 'npm-scripts') {
    options.unitTestRunner = 'none';
    options.linter = Linter.None;
    options.buildable = false;
  }

  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  if (!options.unitTestRunner && options.config !== 'npm-scripts') {
    options.unitTestRunner = 'jest';
  }

  if (!options.linter && options.config !== 'npm-scripts') {
    options.linter = Linter.EsLint;
  }

  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const fileName = getCaseAwareFileName({
    fileName: options.simpleModuleName ? name : projectName,
    pascalCaseFiles: options.pascalCaseFiles,
  });

  const { npmScope } = getWorkspaceLayout(tree);

  const projectRoot = joinPathFragments(destinationDir, projectDirectory);

  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  const defaultImportPath = `@${npmScope}/${projectDirectory}`;
  const importPath = options.importPath || defaultImportPath;

  return {
    ...options,
    fileName,
    name: projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    importPath,
  };
}

function getCaseAwareFileName(options: {
  pascalCaseFiles: boolean;
  fileName: string;
}) {
  const normalized = names(options.fileName);

  return options.pascalCaseFiles ? normalized.className : normalized.fileName;
}

function updateRootTsConfig(host: Tree, options: NormalizedSchema) {
  updateJson(host, 'tsconfig.base.json', (json) => {
    const c = json.compilerOptions;
    c.paths = c.paths || {};
    delete c.paths[options.name];

    if (c.paths[options.importPath]) {
      throw new Error(
        `You already have a library using the import path "${options.importPath}". Make sure to specify a unique one.`
      );
    }

    c.paths[options.importPath] = [
      joinPathFragments(
        options.projectRoot,
        './src',
        'index.' + (options.js ? 'js' : 'ts')
      ),
    ];

    return json;
  });
}

// TODO(chau): change back to 2015 when https://github.com/swc-project/swc/issues/1108 is solved
// target: 'es2015'
// TODO(chau): "exclude" is required here to exclude spec files as --ignore cli option is not working atm
// Open issue: https://github.com/swc-project/cli/issues/20
const swcOptionsString = () => `{
  "jsc": {
    "target": "es2017",
    "parser": {
      "syntax": "typescript",
      "decorators": true,
      "dynamicImport": true
    },
    "transform": {
      "decoratorMetadata": true,
      "legacyDecorator": true
    },
    "keepClassNames": true,
    "externalHelpers": true,
    "loose": true
  },
  "module": {
    "type": "commonjs",
    "strict": true,
    "noInterop": true
  },
  "exclude": ["./src/**/.*.spec.ts$"]
}`;

function addSwcConfig(tree: Tree, projectDir: string) {
  const swcrcPath = join(projectDir, '.swcrc');
  const isSwcConfigExist = tree.exists(swcrcPath);
  if (isSwcConfigExist) return;

  tree.write(swcrcPath, swcOptionsString());
}
