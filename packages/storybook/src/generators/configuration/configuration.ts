import {
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  logger,
  offsetFromRoot,
  readJson,
  readProjectConfiguration,
  toJS,
  Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

import { Linter } from '@nrwl/linter';
import { join } from 'path';

import {
  isFramework,
  readCurrentWorkspaceStorybookVersionFromGenerator,
  TsConfig,
} from '../../utils/utilities';
import { cypressProjectGenerator } from '../cypress-project/cypress-project';
import { StorybookConfigureSchema } from './schema';
import { initGenerator } from '../init/init';
import { checkAndCleanWithSemver } from '@nrwl/workspace/src/utilities/version-utils';
import { gte, lt } from 'semver';

export async function configurationGenerator(
  tree: Tree,
  rawSchema: StorybookConfigureSchema
) {
  const schema = normalizeSchema(rawSchema);

  const tasks: GeneratorCallback[] = [];

  const workspaceStorybookVersion = getCurrentWorkspaceStorybookVersion(tree);

  if (workspaceStorybookVersion === '5') {
    logger.warn(
      `Your Storybook version is ${workspaceStorybookVersion}.
      Nx no longer supports Storybook versions lower than 6. 
      Please update your Storybook package versions and try again.
      You can use the "nx migrate" command.`
    );
    return;
  }

  const { projectType } = readProjectConfiguration(tree, schema.name);

  const initTask = await initGenerator(tree, {
    uiFramework: schema.uiFramework,
  });
  tasks.push(initTask);

  createRootStorybookDir(tree, schema.js);
  createProjectStorybookDir(tree, schema.name, schema.uiFramework, schema.js);
  configureTsProjectConfig(tree, schema);
  configureTsSolutionConfig(tree, schema);
  updateLintConfig(tree, schema);
  addStorybookTask(tree, schema.name, schema.uiFramework);
  if (schema.configureCypress) {
    if (projectType !== 'application') {
      const cypressTask = await cypressProjectGenerator(tree, {
        name: schema.name,
        js: schema.js,
        linter: schema.linter,
        directory: schema.cypressDirectory,
        standaloneConfig: schema.standaloneConfig,
      });
      tasks.push(cypressTask);
    } else {
      logger.warn('There is already an e2e project setup');
    }
  }

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

function normalizeSchema(schema: StorybookConfigureSchema) {
  const defaults = {
    configureCypress: true,
    linter: Linter.TsLint,
    js: false,
  };
  return {
    ...defaults,
    ...schema,
  };
}

function createRootStorybookDir(tree: Tree, js: boolean) {
  if (tree.exists('.storybook')) {
    logger.warn(
      `.storybook folder already exists at root! Skipping generating files in it.`
    );
    return;
  }

  logger.debug(`adding .storybook folder to the root directory`);

  const templatePath = join(__dirname, './root-files');
  generateFiles(tree, templatePath, '', {});

  if (js) {
    toJS(tree);
  }
}

function createProjectStorybookDir(
  tree: Tree,
  projectName: string,
  uiFramework: StorybookConfigureSchema['uiFramework'],
  js: boolean
) {
  const { root, projectType } = readProjectConfiguration(tree, projectName);
  const projectDirectory = projectType === 'application' ? 'app' : 'lib';

  const storybookRoot = join(root, '.storybook');

  if (tree.exists(storybookRoot)) {
    logger.warn(
      `.storybook folder already exists for ${projectName}! Skipping generating files in it.`
    );
    return;
  }

  logger.debug(`adding .storybook folder to ${projectDirectory}`);
  const templatePath = join(__dirname, './project-files');

  generateFiles(tree, templatePath, root, {
    tmpl: '',
    uiFramework,
    offsetFromRoot: offsetFromRoot(root),
    projectType: projectDirectory,
    useWebpack5:
      uiFramework === '@storybook/angular' ||
      uiFramework === '@storybook/react',
    existsRootWebpackConfig: tree.exists('.storybook/webpack.config.js'),
  });

  if (js) {
    toJS(tree);
  }
}

function getTsConfigPath(
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

function configureTsProjectConfig(
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

  tsConfigContent.exclude = [
    ...(tsConfigContent.exclude || []),
    '**/*.stories.ts',
    '**/*.stories.js',
    ...(isFramework('react', schema)
      ? ['**/*.stories.jsx', '**/*.stories.tsx']
      : []),
  ];

  writeJson(tree, tsConfigPath, tsConfigContent);
}

function configureTsSolutionConfig(
  tree: Tree,
  schema: StorybookConfigureSchema
) {
  const { name: projectName } = schema;

  const { root } = readProjectConfiguration(tree, projectName);
  const tsConfigPath = join(root, 'tsconfig.json');
  const tsConfigContent = readJson<TsConfig>(tree, tsConfigPath);

  tsConfigContent.references = [
    ...(tsConfigContent.references || []),
    {
      path: './.storybook/tsconfig.json',
    },
  ];

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
function updateLintConfig(tree: Tree, schema: StorybookConfigureSchema) {
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

function dedupe(arr: string[]) {
  return Array.from(new Set(arr));
}

function addStorybookTask(
  tree: Tree,
  projectName: string,
  uiFramework: string
) {
  const projectConfig = readProjectConfiguration(tree, projectName);
  projectConfig.targets['storybook'] = {
    executor: '@nrwl/storybook:storybook',
    options: {
      uiFramework,
      port: 4400,
      config: {
        configFolder: `${projectConfig.root}/.storybook`,
      },
    },
    configurations: {
      ci: {
        quiet: true,
      },
    },
  };
  projectConfig.targets['build-storybook'] = {
    executor: '@nrwl/storybook:build',
    outputs: ['{options.outputPath}'],
    options: {
      uiFramework,
      outputPath: joinPathFragments('dist/storybook', projectName),
      config: {
        configFolder: `${projectConfig.root}/.storybook`,
      },
    },
    configurations: {
      ci: {
        quiet: true,
      },
    },
  };

  updateProjectConfiguration(tree, projectName, projectConfig);
}

function getCurrentWorkspaceStorybookVersion(tree: Tree): string {
  let workspaceStorybookVersion =
    readCurrentWorkspaceStorybookVersionFromGenerator(tree);

  if (
    gte(
      checkAndCleanWithSemver('@storybook/core', workspaceStorybookVersion),
      '6.0.0'
    )
  ) {
    workspaceStorybookVersion = '6';
  }

  if (
    lt(
      checkAndCleanWithSemver('@storybook/core', workspaceStorybookVersion),
      '6.0.0'
    )
  ) {
    workspaceStorybookVersion = '5';
  }

  return workspaceStorybookVersion;
}

export default configurationGenerator;
export const configurationSchematic = convertNxGenerator(
  configurationGenerator
);
