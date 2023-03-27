import {
  createProjectGraphAsync,
  ensurePackage,
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
import { forEachExecutorOptions } from '@nrwl/devkit/src/generators/executor-options-utils';
import { Linter } from '@nrwl/linter';
import { join, relative } from 'path';
import {
  dedupe,
  findStorybookAndBuildTargetsAndCompiler,
  TsConfig,
} from '../../../utils/utilities';
import { StorybookConfigureSchema } from '../schema';
import { UiFramework, UiFramework7 } from '../../../utils/models';
import { nxVersion } from '../../../utils/versions';

const DEFAULT_PORT = 4400;

export function addStorybookTask(
  tree: Tree,
  projectName: string,
  uiFramework: string,
  configureTestRunner: boolean,
  usesV7?: boolean
) {
  if (uiFramework === '@storybook/react-native') {
    return;
  }
  const projectConfig = readProjectConfiguration(tree, projectName);
  projectConfig.targets['storybook'] = {
    executor: '@nrwl/storybook:storybook',
    options: {
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
      outputDir: joinPathFragments('dist/storybook', projectName),
      configDir: `${projectConfig.root}/.storybook`,
    },
    configurations: {
      ci: {
        quiet: true,
      },
    },
  };

  if (!usesV7) {
    projectConfig.targets['storybook'].options.uiFramework = uiFramework;
    projectConfig.targets['build-storybook'].options.uiFramework = uiFramework;
  }

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

export function addStaticTarget(tree: Tree, opts: StorybookConfigureSchema) {
  const nrwlWeb = ensurePackage<typeof import('@nrwl/web')>(
    '@nrwl/web',
    nxVersion
  );
  nrwlWeb.webStaticServeGenerator(tree, {
    buildTarget: `${opts.name}:build-storybook`,
    outputPath: joinPathFragments('dist/storybook', opts.name),
    targetName: 'static-storybook',
  });

  const projectConfig = readProjectConfiguration(tree, opts.name);

  projectConfig.targets['static-storybook'].configurations = {
    ci: {
      buildTarget: `${opts.name}:build-storybook:ci`,
    },
  };

  updateProjectConfiguration(tree, opts.name, projectConfig);
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
      ...(schema.uiFramework === '@storybook/react' ||
      schema.uiFramework === '@storybook/react-native' ||
      schema.storybook7UiFramework?.startsWith('@storybook/react')
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

export function addStorybookToNamedInputs(tree: Tree) {
  const nxJson = readNxJson(tree);

  if (nxJson.namedInputs) {
    const hasProductionFileset = !!nxJson.namedInputs?.production;
    if (hasProductionFileset) {
      if (
        !nxJson.namedInputs.production.includes(
          '!{projectRoot}/**/*.stories.@(js|jsx|ts|tsx|mdx)'
        )
      ) {
        nxJson.namedInputs.production.push(
          '!{projectRoot}/**/*.stories.@(js|jsx|ts|tsx|mdx)'
        );
      }
      if (
        !nxJson.namedInputs.production.includes(
          '!{projectRoot}/.storybook/**/*'
        )
      ) {
        nxJson.namedInputs.production.push('!{projectRoot}/.storybook/**/*');
      }
    }

    nxJson.targetDefaults ??= {};
    nxJson.targetDefaults['build-storybook'] ??= {};
    nxJson.targetDefaults['build-storybook'].inputs ??= [
      'default',
      hasProductionFileset ? '^production' : '^default',
    ];

    if (
      !nxJson.targetDefaults['build-storybook'].inputs.includes(
        '!{projectRoot}/.storybook/**/*'
      )
    ) {
      nxJson.targetDefaults['build-storybook'].inputs.push(
        '!{projectRoot}/.storybook/**/*'
      );
    }

    updateNxJson(tree, nxJson);
  }
}

export function createProjectStorybookDir(
  tree: Tree,
  projectName: string,
  uiFramework: UiFramework | UiFramework7,
  js: boolean,
  tsConfiguration: boolean,
  root: string,
  projectType: string,
  projectIsRootProjectInStandaloneWorkspace: boolean,
  isNextJs?: boolean,
  usesSwc?: boolean,
  usesVite?: boolean,
  usesV7?: boolean,
  viteConfigFilePath?: string
) {
  const projectDirectory =
    projectType === 'application'
      ? isNextJs
        ? 'components'
        : 'src/app'
      : 'src/lib';

  const storybookConfigExists = projectIsRootProjectInStandaloneWorkspace
    ? tree.exists('.storybook/main.js') || tree.exists('.storybook/main.ts')
    : tree.exists(join(root, '.storybook/main.ts')) ||
      tree.exists(join(root, '.storybook/main.js'));

  if (storybookConfigExists) {
    logger.warn(
      `Storybook configuration files already exist for ${projectName}!`
    );
    return;
  }

  logger.debug(`adding .storybook folder to your ${projectType}`);

  const templatePath = join(
    __dirname,
    `../project-files${usesV7 ? '-7' : ''}${tsConfiguration ? '-ts' : ''}`
  );

  generateFiles(tree, templatePath, root, {
    tmpl: '',
    uiFramework,
    offsetFromRoot: offsetFromRoot(root),
    projectDirectory,
    projectType,
    mainDir: isNextJs && projectType === 'application' ? 'components' : 'src',
    isNextJs: isNextJs && projectType === 'application',
    usesSwc,
    usesVite,
    isRootProject: projectIsRootProjectInStandaloneWorkspace,
    viteConfigFilePath,
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

export function projectIsRootProjectInStandaloneWorkspace(projectRoot: string) {
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

export function getViteConfigFilePath(
  tree: Tree,
  projectRoot: string,
  configFile?: string
): string | undefined {
  return configFile && tree.exists(configFile)
    ? configFile
    : tree.exists(joinPathFragments(`${projectRoot}/vite.config.ts`))
    ? joinPathFragments(`${projectRoot}/vite.config.ts`)
    : tree.exists(joinPathFragments(`${projectRoot}/vite.config.js`))
    ? joinPathFragments(`${projectRoot}/vite.config.js`)
    : undefined;
}
