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
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { Linter } from '@nx/eslint';
import { join, relative } from 'path';
import {
  dedupe,
  findStorybookAndBuildTargetsAndCompiler,
  TsConfig,
} from '../../../utils/utilities';
import { StorybookConfigureSchema } from '../schema';
import { UiFramework } from '../../../utils/models';
import { nxVersion } from '../../../utils/versions';
import { findEslintFile } from '@nx/eslint/src/generators/utils/eslint-file';
import { useFlatConfig } from '@nx/eslint/src/utils/flat-config';

const DEFAULT_PORT = 4400;

export function addStorybookTask(
  tree: Tree,
  projectName: string,
  uiFramework: UiFramework,
  interactionTests: boolean
) {
  if (uiFramework === '@storybook/react-native') {
    return;
  }
  const projectConfig = readProjectConfiguration(tree, projectName);
  projectConfig.targets['storybook'] = {
    executor: '@nx/storybook:storybook',
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
    executor: '@nx/storybook:build',
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

  if (interactionTests === true) {
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
  interactionTests: boolean
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

  if (interactionTests === true) {
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
  const nrwlWeb = ensurePackage<typeof import('@nx/web')>('@nx/web', nxVersion);
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

export function createStorybookTsconfigFile(
  tree: Tree,
  projectRoot: string,
  uiFramework: UiFramework,
  isRootProject: boolean,
  mainDir: 'components' | 'src'
) {
  // First let's check if old configuration file exists
  // If it exists, let's rename it and move it to the new location
  const oldStorybookTsConfigPath = joinPathFragments(
    projectRoot,
    '.storybook/tsconfig.json'
  );

  if (tree.exists(oldStorybookTsConfigPath)) {
    logger.warn(`.storybook/tsconfig.json already exists for this project`);
    logger.warn(
      `It will be renamed and moved to tsconfig.storybook.json.
      Please make sure all settings look correct after this change.
      Also, please make sure to use "nx migrate" to move from one version of Nx to another.
      `
    );
    renameAndMoveOldTsConfig(projectRoot, oldStorybookTsConfigPath, tree);
    return;
  }

  const storybookTsConfigPath = joinPathFragments(
    projectRoot,
    'tsconfig.storybook.json'
  );

  if (tree.exists(storybookTsConfigPath)) {
    logger.info(`tsconfig.storybook.json already exists for this project`);
    return;
  }

  const exclude = [`${mainDir}/**/*.spec.ts`, `${mainDir}/**/*.test.ts`];
  if (
    uiFramework === '@storybook/react-webpack5' ||
    uiFramework === '@storybook/react-vite'
  ) {
    exclude.push(
      `${mainDir}/**/*.spec.js`,
      `${mainDir}/**/*.test.js`,
      `${mainDir}/**/*.spec.tsx`,
      `${mainDir}/**/*.test.tsx`,
      `${mainDir}/**/*.spec.jsx`,
      `${mainDir}/**/*.test.js`
    );
  }

  let files: string[];

  if (
    uiFramework === '@storybook/react-webpack5' ||
    uiFramework === '@storybook/react-vite'
  ) {
    const offset = offsetFromRoot(projectRoot);

    files = [
      `${
        !isRootProject ? offset : ''
      }node_modules/@nx/react/typings/styled-jsx.d.ts`,
      `${
        !isRootProject ? offset : ''
      }node_modules/@nx/react/typings/cssmodule.d.ts`,
      `${
        !isRootProject ? offset : ''
      }node_modules/@nx/react/typings/image.d.ts`,
    ];
  }

  const include: string[] = [
    `${mainDir}/**/*.stories.ts`,
    `${mainDir}/**/*.stories.js`,
    `${mainDir}/**/*.stories.jsx`,
    `${mainDir}/**/*.stories.tsx`,
    `${mainDir}/**/*.stories.mdx`,
    '.storybook/*.js',
    '.storybook/*.ts',
  ];

  if (uiFramework === '@storybook/react-native') {
    include.push('*.ts', '*.tsx');
  }

  const storybookTsConfig: TsConfig = {
    extends: './tsconfig.json',
    compilerOptions: {
      emitDecoratorMetadata: true,
      outDir:
        uiFramework === '@storybook/react-webpack5' ||
        uiFramework === '@storybook/react-vite'
          ? ''
          : undefined,
    },
    files,
    exclude,
    include,
  };

  writeJson(tree, storybookTsConfigPath, storybookTsConfig);
}

export function editTsconfigBaseJson(tree: Tree) {
  let tsconfigBasePath = 'tsconfig.base.json';

  // standalone workspace maybe
  if (!tree.exists(tsconfigBasePath)) tsconfigBasePath = 'tsconfig.json';

  if (!tree.exists(tsconfigBasePath)) return;

  const tsconfigBaseContent = readJson<TsConfig>(tree, tsconfigBasePath);

  if (!tsconfigBaseContent.compilerOptions)
    tsconfigBaseContent.compilerOptions = {};
  tsconfigBaseContent.compilerOptions.skipLibCheck = true;

  writeJson(tree, tsconfigBasePath, tsconfigBaseContent);
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
      ...(schema.uiFramework === '@storybook/react-native' ||
      schema.uiFramework?.startsWith('@storybook/react')
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

  if (schema.uiFramework === '@storybook/angular') {
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
  } else {
    if (
      !tsConfigContent.references
        ?.map((reference) => reference.path)
        ?.includes('./tsconfig.storybook.json')
    ) {
      tsConfigContent.references = [
        ...(tsConfigContent.references || []),
        {
          path: './tsconfig.storybook.json',
        },
      ];
    }
  }

  writeJson(tree, tsConfigPath, tsConfigContent);
}

/**
 * When adding storybook we need to inform ESLint
 * of the additional tsconfig.json file which will be the only tsconfig
 * which includes *.stories files.
 *
 * This is done within the eslint config file.
 */
export function updateLintConfig(tree: Tree, schema: StorybookConfigureSchema) {
  const { name: projectName } = schema;

  const { root } = readProjectConfiguration(tree, projectName);

  const eslintFile = findEslintFile(tree, root);
  if (!eslintFile) {
    return;
  }

  const parserConfigPath = join(
    root,
    schema.uiFramework === '@storybook/angular'
      ? '.storybook/tsconfig.json'
      : 'tsconfig.storybook.json'
  );

  if (useFlatConfig(tree)) {
    let config = tree.read(eslintFile, 'utf-8');
    const projectRegex = RegExp(/project:\s?\[?['"](.*)['"]\]?/g);
    let match;
    while ((match = projectRegex.exec(config)) !== null) {
      const matchSet = new Set(
        match[1].split(',').map((p) => p.trim().replace(/['"]/g, ''))
      );
      matchSet.add(parserConfigPath);
      const insert = `project: [${Array.from(matchSet)
        .map((p) => `'${p}'`)
        .join(', ')}]`;
      config =
        config.slice(0, match.index) +
        insert +
        config.slice(match.index + match[0].length);
    }
    tree.write(eslintFile, config);
  } else {
    updateJson(tree, join(root, eslintFile), (json) => {
      if (typeof json.parserOptions?.project === 'string') {
        json.parserOptions.project = [json.parserOptions.project];
      }

      if (json.parserOptions?.project) {
        json.parserOptions.project = dedupe([
          ...json.parserOptions.project,
          parserConfigPath,
        ]);
      }

      const overrides = json.overrides || [];
      for (const o of overrides) {
        if (typeof o.parserOptions?.project === 'string') {
          o.parserOptions.project = [o.parserOptions.project];
        }
        if (o.parserOptions?.project) {
          o.parserOptions.project = dedupe([
            ...o.parserOptions.project,
            parserConfigPath,
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

      if (
        !nxJson.namedInputs.production.includes(
          '!{projectRoot}/tsconfig.storybook.json'
        )
      ) {
        nxJson.namedInputs.production.push(
          '!{projectRoot}/tsconfig.storybook.json'
        );
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
        '{projectRoot}/.storybook/**/*'
      )
    ) {
      nxJson.targetDefaults['build-storybook'].inputs.push(
        '{projectRoot}/.storybook/**/*'
      );
    }

    // Delete the !{projectRoot}/.storybook/**/* glob from build-storybook
    // because we want to rebuild Storybook if the .storybook folder changes
    const index = nxJson.targetDefaults['build-storybook'].inputs.indexOf(
      '!{projectRoot}/.storybook/**/*'
    );

    if (index !== -1) {
      nxJson.targetDefaults['build-storybook'].inputs.splice(index, 1);
    }

    if (
      !nxJson.targetDefaults['build-storybook'].inputs.includes(
        '{projectRoot}/tsconfig.storybook.json'
      )
    ) {
      nxJson.targetDefaults['build-storybook'].inputs.push(
        '{projectRoot}/tsconfig.storybook.json'
      );
    }

    updateNxJson(tree, nxJson);
  }
}

export function createProjectStorybookDir(
  tree: Tree,
  projectName: string,
  uiFramework: UiFramework,
  js: boolean,
  tsConfiguration: boolean,
  root: string,
  projectType: string,
  projectIsRootProjectInStandaloneWorkspace: boolean,
  interactionTests: boolean,
  mainDir?: string,
  isNextJs?: boolean,
  usesSwc?: boolean,
  usesVite?: boolean,
  viteConfigFilePath?: string
) {
  let projectDirectory =
    projectType === 'application'
      ? isNextJs
        ? 'components'
        : 'src/app'
      : 'src/lib';

  if (uiFramework === '@storybook/vue3-vite') {
    projectDirectory = 'src';
  }

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

  const templatePath = join(
    __dirname,
    `../project-files${tsConfiguration ? '-ts' : ''}`
  );

  generateFiles(tree, templatePath, root, {
    tmpl: '',
    uiFramework,
    offsetFromRoot: offsetFromRoot(root),
    projectDirectory,
    projectType,
    interactionTests,
    mainDir,
    isNextJs: isNextJs && projectType === 'application',
    usesSwc,
    usesVite,
    isRootProject: projectIsRootProjectInStandaloneWorkspace,
    viteConfigFilePath,
  });

  if (js) {
    toJS(tree);
  }

  if (uiFramework !== '@storybook/angular') {
    // This file is only used for Angular
    // For non-Angular projects, we generate a file
    // called tsconfig.storybook.json at the root of the project
    // using the createStorybookTsconfigFile function
    // since Storybook is only taking into account .storybook/tsconfig.json
    // for Angular projects
    tree.delete(join(root, '.storybook/tsconfig.json'));
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
    path?.length > 0
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
  return relative(workspaceRoot, projectRoot)?.length === 0;
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
    '@nx/cypress:cypress',
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

export function renameAndMoveOldTsConfig(
  projectRoot: string,
  pathToStorybookConfigFile: string,
  tree: Tree
) {
  if (pathToStorybookConfigFile && tree.exists(pathToStorybookConfigFile)) {
    updateJson(tree, pathToStorybookConfigFile, (json) => {
      if (json.extends?.startsWith('../')) {
        // drop one level of nesting
        json.extends = json.extends.replace('../', './');
      }

      for (let i = 0; i < json.files?.length; i++) {
        // drop one level of nesting
        if (json.files[i].startsWith('../../../')) {
          json.files[i] = json.files[i].replace('../../../', '../../');
        }
      }

      for (let i = 0; i < json.include?.length; i++) {
        if (json.include[i].startsWith('../')) {
          json.include[i] = json.include[i].replace('../', '');
        }

        if (json.include[i] === '*.js') {
          json.include[i] = '.storybook/*.js';
        }
        if (json.include[i] === '*.ts') {
          json.include[i] = '.storybook/*.ts';
        }
      }

      for (let i = 0; i < json.exclude?.length; i++) {
        if (json.exclude[i].startsWith('../')) {
          json.exclude[i] = json.exclude[i].replace('../', 'src/');
        }
      }

      return json;
    });

    tree.rename(
      pathToStorybookConfigFile,
      joinPathFragments(projectRoot, `tsconfig.storybook.json`)
    );
  }

  const projectTsConfig = joinPathFragments(projectRoot, 'tsconfig.json');

  if (tree.exists(projectTsConfig)) {
    updateJson(tree, projectTsConfig, (json) => {
      for (let i = 0; i < json.references?.length; i++) {
        if (json.references[i].path === './.storybook/tsconfig.json') {
          json.references[i].path = './tsconfig.storybook.json';
          break;
        }
      }
      return json;
    });
  }

  const eslintFile = findEslintFile(tree, projectRoot);
  if (eslintFile) {
    const fileName = joinPathFragments(projectRoot, eslintFile);
    const config = tree.read(fileName, 'utf-8');
    tree.write(
      fileName,
      config.replace(/\.storybook\/tsconfig\.json/g, 'tsconfig.storybook.json')
    );
  }
}
