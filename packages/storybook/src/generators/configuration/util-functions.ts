import {
  createProjectGraphAsync,
  generateFiles,
  joinPathFragments,
  logger,
  offsetFromRoot,
  parseTargetString,
  readJson,
  readNxJson,
  readProjectConfiguration,
  toJS,
  Tree,
  updateJson,
  updateNxJson,
  updateProjectConfiguration,
  workspaceRoot,
  writeJson,
} from '@nrwl/devkit';
import { Linter } from '@nrwl/linter';
import { join, relative } from 'path';
import {
  dedupe,
  findStorybookAndBuildTargetsAndCompiler,
  isFramework,
  TsConfig,
} from '../../utils/utilities';
import { StorybookConfigureSchema } from './schema';
import { getRootTsConfigPathInTree } from '@nrwl/workspace/src/utilities/typescript';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

const DEFAULT_PORT = 4400;

export function addStorybookTask(
  tree: Tree,
  projectName: string,
  uiFramework: string,
  configureTestRunner: boolean
) {
  if (uiFramework === '@storybook/react-native') {
    return;
  }
  const projectConfig = readProjectConfiguration(tree, projectName);
  projectConfig.targets['storybook'] = {
    executor: '@nrwl/storybook:storybook',
    options: {
      uiFramework,
      port: DEFAULT_PORT,
      configDir: `${projectConfig.root}/.storybook`,
    },
    configurations: {
      ci: {
        quiet: true,
      },
    },
  };

  projectConfig.targets['build-storybook'] = {
    executor: '@nrwl/storybook:build',
    outputs: ['{options.outputDir}'],
    options: {
      uiFramework,
      outputDir: joinPathFragments('dist/storybook', projectName),
      configDir: `${projectConfig.root}/.storybook`,
    },
    configurations: {
      ci: {
        quiet: true,
      },
    },
  };

  if (configureTestRunner === true) {
    projectConfig.targets['test-storybook'] = {
      executor: 'nx:run-commands',
      options: {
        command: `test-storybook -c ${projectConfig.root}/.storybook --url=http://localhost:${DEFAULT_PORT}`,
      },
    };
  }

  updateProjectConfiguration(tree, projectName, projectConfig);
}

export function addAngularStorybookTask(
  tree: Tree,
  projectName: string,
  configureTestRunner: boolean
) {
  const projectConfig = readProjectConfiguration(tree, projectName);
  const { ngBuildTarget } = findStorybookAndBuildTargetsAndCompiler(
    projectConfig.targets
  );
  projectConfig.targets['storybook'] = {
    executor: '@storybook/angular:start-storybook',
    options: {
      port: 4400,
      configDir: `${projectConfig.root}/.storybook`,
      browserTarget: `${projectName}:${
        ngBuildTarget ? 'build' : 'build-storybook'
      }`,
      compodoc: false,
    },
    configurations: {
      ci: {
        quiet: true,
      },
    },
  };

  projectConfig.targets['build-storybook'] = {
    executor: '@storybook/angular:build-storybook',
    outputs: ['{options.outputDir}'],
    options: {
      outputDir: joinPathFragments('dist/storybook', projectName),
      configDir: `${projectConfig.root}/.storybook`,
      browserTarget: `${projectName}:${
        ngBuildTarget ? 'build' : 'build-storybook'
      }`,
      compodoc: false,
    },
    configurations: {
      ci: {
        quiet: true,
      },
    },
  };

  if (configureTestRunner === true) {
    projectConfig.targets['test-storybook'] = {
      executor: 'nx:run-commands',
      options: {
        command: `test-storybook -c ${projectConfig.root}/.storybook --url=http://localhost:${DEFAULT_PORT}`,
      },
    };
  }

  updateProjectConfiguration(tree, projectName, projectConfig);
}

export function configureTsProjectConfig(
  tree: Tree,
  schema: StorybookConfigureSchema
) {
  const { name: projectName } = schema;

  let tsConfigPath: string;
  let tsConfigContent: TsConfig;

  try {
    tsConfigPath = getTsConfigPath(tree, projectName);
    tsConfigContent = readJson<TsConfig>(tree, tsConfigPath);
  } catch {
    /**
     * Custom app configurations
     * may contain a tsconfig.json
     * instead of a tsconfig.app.json.
     */

    tsConfigPath = getTsConfigPath(tree, projectName, 'tsconfig.json');
    tsConfigContent = readJson<TsConfig>(tree, tsConfigPath);
  }

  if (
    !tsConfigContent?.exclude?.includes('**/*.stories.ts') &&
    !tsConfigContent?.exclude?.includes('**/*.stories.js')
  ) {
    tsConfigContent.exclude = [
      ...(tsConfigContent.exclude || []),
      '**/*.stories.ts',
      '**/*.stories.js',
      ...(isFramework('react', schema) || isFramework('react-native', schema)
        ? ['**/*.stories.jsx', '**/*.stories.tsx']
        : []),
    ];
  }

  writeJson(tree, tsConfigPath, tsConfigContent);
}

export function configureTsSolutionConfig(
  tree: Tree,
  schema: StorybookConfigureSchema
) {
  const { name: projectName } = schema;

  const { root } = readProjectConfiguration(tree, projectName);
  const tsConfigPath = join(root, 'tsconfig.json');
  const tsConfigContent = readJson<TsConfig>(tree, tsConfigPath);

  if (
    !tsConfigContent.references
      ?.map((reference) => reference.path)
      ?.includes('./.storybook/tsconfig.json')
  ) {
    tsConfigContent.references = [
      ...(tsConfigContent.references || []),
      {
        path: './.storybook/tsconfig.json',
      },
    ];
  }

  writeJson(tree, tsConfigPath, tsConfigContent);
}

/**
 * When adding storybook we need to inform TSLint or ESLint
 * of the additional tsconfig.json file which will be the only tsconfig
 * which includes *.stories files.
 *
 * For TSLint this is done via the builder config, for ESLint this is
 * done within the .eslintrc.json file.
 */
export function updateLintConfig(tree: Tree, schema: StorybookConfigureSchema) {
  const { name: projectName } = schema;

  const { targets, root } = readProjectConfiguration(tree, projectName);
  const tslintTargets = Object.values(targets).filter(
    (target) => target.executor === '@angular-devkit/build-angular:tslint'
  );

  tslintTargets.forEach((target) => {
    target.options.tsConfig = dedupe([
      ...target.options.tsConfig,
      joinPathFragments(root, './.storybook/tsconfig.json'),
    ]);
  });

  if (tree.exists(join(root, '.eslintrc.json'))) {
    updateJson(tree, join(root, '.eslintrc.json'), (json) => {
      if (typeof json.parserOptions?.project === 'string') {
        json.parserOptions.project = [json.parserOptions.project];
      }

      if (Array.isArray(json.parserOptions?.project)) {
        json.parserOptions.project = dedupe([
          ...json.parserOptions.project,
          join(root, '.storybook/tsconfig.json'),
        ]);
      }

      const overrides = json.overrides || [];
      for (const o of overrides) {
        if (typeof o.parserOptions?.project === 'string') {
          o.parserOptions.project = [o.parserOptions.project];
        }
        if (Array.isArray(o.parserOptions?.project)) {
          o.parserOptions.project = dedupe([
            ...o.parserOptions.project,
            join(root, '.storybook/tsconfig.json'),
          ]);
        }
      }

      return json;
    });
  }
}

export function normalizeSchema(
  schema: StorybookConfigureSchema
): StorybookConfigureSchema {
  const defaults = {
    configureCypress: true,
    linter: Linter.EsLint,
    js: false,
  };
  return {
    ...defaults,
    ...schema,
  };
}

export function createRootStorybookDir(
  tree: Tree,
  js: boolean,
  tsConfiguration: boolean
) {
  if (tree.exists('.storybook')) {
    logger.warn(`Root Storybook configuration files already exist!`);
    return;
  }
  logger.debug(`adding .storybook folder to the root directory`);

  const isInNestedWorkspace = workspaceHasRootProject(tree);

  const templatePath = join(
    __dirname,
    `./root-files${tsConfiguration ? '-ts' : ''}`
  );

  generateFiles(tree, templatePath, '', {
    mainName: isInNestedWorkspace ? 'main.root' : 'main',
    tmpl: '',
  });

  const nxJson = readNxJson(tree);

  if (nxJson.namedInputs) {
    const hasProductionFileset = !!nxJson.namedInputs?.production;
    if (hasProductionFileset) {
      nxJson.namedInputs.production.push('!{projectRoot}/.storybook/**/*');
      nxJson.namedInputs.production.push(
        '!{projectRoot}/**/*.stories.@(js|jsx|ts|tsx|mdx)'
      );
    }

    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['build-storybook'] ??= {};
    nxJson.targetDefaults['build-storybook'].inputs ??= [
      'default',
      hasProductionFileset ? '^production' : '^default',
    ];

    nxJson.targetDefaults['build-storybook'].inputs.push(
      '{workspaceRoot}/.storybook/**/*'
    );

    updateNxJson(tree, nxJson);
  }

  if (js) {
    toJS(tree);
  }
}

export function createRootStorybookDirForRootProject(
  tree: Tree,
  projectName: string,
  uiFramework: StorybookConfigureSchema['uiFramework'],
  js: boolean,
  tsConfiguration: boolean,
  root: string,
  projectType: string,
  isNextJs?: boolean,
  usesSwc?: boolean,
  usesVite?: boolean
) {
  const rootConfigExists =
    tree.exists('.storybook/main.root.js') ||
    tree.exists('.storybook/main.root.ts');
  const rootProjectConfigExists =
    tree.exists('.storybook/main.js') || tree.exists('.storybook/main.ts');

  if (!rootConfigExists) {
    createRootStorybookDir(tree, js, tsConfiguration);
  }

  if (rootConfigExists && rootProjectConfigExists) {
    logger.warn(
      `Storybook configuration files already exist for ${projectName}!`
    );
    return;
  }
  if (rootConfigExists && !rootProjectConfigExists) {
    logger.warn(
      `Root Storybook configuration files already exist. 
      Only the project-specific configuration file will be generated.`
    );
  }

  logger.debug(`Creating Storybook configuration files for ${projectName}.`);

  const projectDirectory =
    projectType === 'application'
      ? isNextJs
        ? 'components'
        : 'src/app'
      : 'src/lib';

  const templatePath = join(
    __dirname,
    `./project-files${
      rootFileIsTs(tree, 'main.root', tsConfiguration) ? '-ts' : ''
    }`
  );

  generateFiles(tree, templatePath, root, {
    tmpl: '',
    uiFramework,
    offsetFromRoot: offsetFromRoot(root),
    rootTsConfigPath: getRootTsConfigPathInTree(tree),
    projectDirectory,
    rootMainName: 'main.root',
    existsRootWebpackConfig: tree.exists('.storybook/webpack.config.js'),
    projectType,
    mainDir: isNextJs && projectType === 'application' ? 'components' : 'src',
    isNextJs: isNextJs && projectType === 'application',
    usesSwc,
    usesVite,
    isRootProject: true,
  });

  if (js) {
    toJS(tree);
  }
}

export function createProjectStorybookDir(
  tree: Tree,
  projectName: string,
  uiFramework: StorybookConfigureSchema['uiFramework'],
  js: boolean,
  tsConfiguration: boolean,
  isNextJs?: boolean,
  usesSwc?: boolean,
  usesVite?: boolean
) {
  const { root, projectType } = readProjectConfiguration(tree, projectName);

  const projectDirectory =
    projectType === 'application'
      ? isNextJs
        ? 'components'
        : 'src/app'
      : 'src/lib';

  const storybookRoot = join(root, '.storybook');

  if (tree.exists(storybookRoot)) {
    logger.warn(
      `Storybook configuration files already exist for ${projectName}!`
    );
    return;
  }

  logger.debug(`adding .storybook folder to your ${projectType}`);

  const rootMainName =
    tree.exists('.storybook/main.root.js') ||
    tree.exists('.storybook/main.root.ts')
      ? 'main.root'
      : 'main';

  const templatePath = join(
    __dirname,
    `./project-files${
      rootFileIsTs(tree, rootMainName, tsConfiguration) ? '-ts' : ''
    }`
  );

  generateFiles(tree, templatePath, root, {
    tmpl: '',
    uiFramework,
    offsetFromRoot: offsetFromRoot(root),
    rootTsConfigPath: getRootTsConfigPathInTree(tree),
    projectDirectory,
    rootMainName,
    existsRootWebpackConfig: tree.exists('.storybook/webpack.config.js'),
    projectType,
    mainDir: isNextJs && projectType === 'application' ? 'components' : 'src',
    isNextJs: isNextJs && projectType === 'application',
    usesSwc,
    usesVite,
    isRootProject: false,
  });

  if (js) {
    toJS(tree);
  }
}

export function getTsConfigPath(
  tree: Tree,
  projectName: string,
  path?: string
): string {
  const { root, projectType } = readProjectConfiguration(tree, projectName);
  return join(
    root,
    path && path.length > 0
      ? path
      : projectType === 'application'
      ? 'tsconfig.app.json'
      : 'tsconfig.lib.json'
  );
}

export function addBuildStorybookToCacheableOperations(tree: Tree) {
  updateJson(tree, 'nx.json', (json) => ({
    ...json,
    tasksRunnerOptions: {
      ...(json.tasksRunnerOptions ?? {}),
      default: {
        ...(json.tasksRunnerOptions?.default ?? {}),
        options: {
          ...(json.tasksRunnerOptions?.default?.options ?? {}),
          cacheableOperations: Array.from(
            new Set([
              ...(json.tasksRunnerOptions?.default?.options
                ?.cacheableOperations ?? []),
              'build-storybook',
            ])
          ),
        },
      },
    },
  }));
}

export function projectIsRootProjectInNestedWorkspace(projectRoot: string) {
  return relative(workspaceRoot, projectRoot).length === 0;
}

export function workspaceHasRootProject(tree: Tree) {
  return tree.exists('project.json');
}

export function rootFileIsTs(
  tree: Tree,
  rootFileName: string,
  tsConfiguration: boolean
): boolean {
  if (tree.exists(`.storybook/${rootFileName}.ts`) && !tsConfiguration) {
    logger.info(
      `The root Storybook configuration is in TypeScript, 
      so Nx will generate TypeScript Storybook configuration files 
      in this project's .storybook folder as well.`
    );
    return true;
  } else if (tree.exists(`.storybook/${rootFileName}.js`) && tsConfiguration) {
    logger.info(
      `The root Storybook configuration is in JavaScript, 
        so Nx will generate JavaScript Storybook configuration files 
        in this project's .storybook folder as well.`
    );
    return false;
  } else {
    return tsConfiguration;
  }
}

export async function getE2EProjectName(
  tree: Tree,
  mainProject: string
): Promise<string | undefined> {
  let e2eProject: string;
  const graph = await createProjectGraphAsync();
  forEachExecutorOptions(
    tree,
    '@nrwl/cypress:cypress',
    (options, projectName) => {
      if (e2eProject) {
        return;
      }
      if (options['devServerTarget']) {
        const { project, target } = parseTargetString(
          options['devServerTarget'],
          graph
        );
        if (
          (project === mainProject && target === 'serve') ||
          (project === mainProject && target === 'storybook')
        ) {
          e2eProject = projectName;
        }
      }
    }
  );
  return e2eProject;
}
