import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  logger,
  offsetFromRoot,
  parseTargetString,
  ProjectConfiguration,
  ProjectGraph,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  toJS,
  Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';
import { resolveImportPath } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { promptWhenInteractive } from '@nx/devkit/src/generators/prompt';
import { Linter, LinterType } from '@nx/eslint';
import {
  getRelativePathToRootTsConfig,
  initGenerator as jsInitGenerator,
} from '@nx/js';
import {
  getProjectPackageManagerWorkspaceState,
  getProjectPackageManagerWorkspaceStateWarningTask,
} from '@nx/js/src/utils/package-manager-workspaces';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { PackageJson } from 'nx/src/utils/package-json';
import { join } from 'path';
import { addLinterToCyProject } from '../../utils/add-linter';
import { addDefaultE2EConfig } from '../../utils/config';
import { installedCypressVersion } from '../../utils/cypress-version';
import { typesNodeVersion, viteVersion } from '../../utils/versions';
import { addBaseCypressSetup } from '../base-setup/base-setup';
import cypressInitGenerator, { addPlugin } from '../init/init';

export interface CypressE2EConfigSchema {
  project: string;
  baseUrl?: string;
  directory?: string;
  js?: boolean;
  skipFormat?: boolean;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  bundler?: 'webpack' | 'vite' | 'none';
  devServerTarget?: string;
  linter?: Linter | LinterType;
  port?: number | 'cypress-auto';
  jsx?: boolean;
  rootProject?: boolean;

  webServerCommands?: Record<string, string>;
  ciWebServerCommand?: string;
  ciBaseUrl?: string;
  addPlugin?: boolean;
}

type NormalizedSchema = Awaited<ReturnType<typeof normalizeOptions>>;

export function configurationGenerator(
  tree: Tree,
  options: CypressE2EConfigSchema
) {
  return configurationGeneratorInternal(tree, {
    addPlugin: false,
    ...options,
  });
}

export async function configurationGeneratorInternal(
  tree: Tree,
  options: CypressE2EConfigSchema
) {
  const opts = await normalizeOptions(tree, options);
  const tasks: GeneratorCallback[] = [];

  const projectGraph = await createProjectGraphAsync();
  if (!installedCypressVersion()) {
    tasks.push(await jsInitGenerator(tree, { ...options, skipFormat: true }));
    tasks.push(
      await cypressInitGenerator(tree, {
        ...opts,
        skipFormat: true,
      })
    );
  } else if (opts.addPlugin) {
    await addPlugin(tree, projectGraph, false);
  }

  const nxJson = readNxJson(tree);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/cypress/plugin'
      : p.plugin === '@nx/cypress/plugin'
  );

  await addFiles(tree, opts, projectGraph, hasPlugin);
  if (!hasPlugin) {
    addTarget(tree, opts, projectGraph);
  }

  const { root: projectRoot } = readProjectConfiguration(tree, options.project);
  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);
  if (isTsSolutionSetup) {
    createPackageJson(tree, opts);
    ignoreTestOutput(tree);

    if (!options.rootProject) {
      // add the project tsconfig to the workspace root tsconfig.json references
      updateJson(tree, 'tsconfig.json', (json) => {
        json.references ??= [];
        json.references.push({ path: './' + projectRoot });
        return json;
      });
    }
  }

  const linterTask = await addLinterToCyProject(tree, {
    ...opts,
    cypressDir: opts.directory,
  });
  tasks.push(linterTask);

  if (!opts.skipPackageJson) {
    tasks.push(ensureDependencies(tree, opts));
  }

  if (!opts.skipFormat) {
    await formatFiles(tree);
  }

  if (isTsSolutionSetup) {
    const projectPackageManagerWorkspaceState =
      getProjectPackageManagerWorkspaceState(tree, projectRoot);

    if (projectPackageManagerWorkspaceState !== 'included') {
      tasks.push(
        getProjectPackageManagerWorkspaceStateWarningTask(
          projectPackageManagerWorkspaceState,
          tree.root
        )
      );
    }
  }

  return runTasksInSerial(...tasks);
}

function ensureDependencies(tree: Tree, options: NormalizedSchema) {
  const devDependencies: Record<string, string> = {
    '@types/node': typesNodeVersion,
  };

  if (options.bundler === 'vite') {
    devDependencies['vite'] = viteVersion;
  }

  return addDependenciesToPackageJson(tree, {}, devDependencies);
}

async function normalizeOptions(tree: Tree, options: CypressE2EConfigSchema) {
  const isTsSolutionSetup = isUsingTsSolutionSetup(tree);

  let linter = options.linter;
  if (!linter) {
    const choices = isTsSolutionSetup
      ? [{ name: 'none' }, { name: 'eslint' }]
      : [{ name: 'eslint' }, { name: 'none' }];
    const defaultValue = isTsSolutionSetup ? 'none' : 'eslint';

    linter = await promptWhenInteractive<{
      linter: 'none' | 'eslint';
    }>(
      {
        type: 'select',
        name: 'linter',
        message: `Which linter would you like to use?`,
        choices,
        initial: 0,
      },
      { linter: defaultValue }
    ).then(({ linter }) => linter);
  }

  const projectConfig: ProjectConfiguration | undefined =
    readProjectConfiguration(tree, options.project);
  if (projectConfig?.targets?.e2e) {
    throw new Error(`Project ${options.project} already has an e2e target.
Rename or remove the existing e2e target.`);
  }

  if (
    !options.baseUrl &&
    !options.devServerTarget &&
    !projectConfig?.targets?.serve
  ) {
    throw new Error(`The project ${options.project} does not have a 'serve' target.
In this case you need to provide a devServerTarget,'<projectName>:<targetName>[:<configName>]', or a baseUrl option`);
  }

  options.directory ??= 'src';

  const devServerTarget =
    options.devServerTarget ??
    (projectConfig?.targets?.serve ? `${options.project}:serve` : undefined);

  if (!options.baseUrl && !devServerTarget) {
    throw new Error('Either baseUrl or devServerTarget must be provided');
  }

  const nxJson = readNxJson(tree);
  options.addPlugin ??=
    process.env.NX_ADD_PLUGINS !== 'false' &&
    nxJson.useInferencePlugins !== false;

  return {
    ...options,
    bundler: options.bundler ?? 'webpack',
    rootProject: options.rootProject ?? projectConfig.root === '.',
    linter,
    devServerTarget,
  };
}

async function addFiles(
  tree: Tree,
  options: NormalizedSchema,
  projectGraph: ProjectGraph,
  hasPlugin: boolean
) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  const cyVersion = installedCypressVersion();
  const filesToUse = cyVersion && cyVersion < 10 ? 'v9' : 'v10';

  const hasTsConfig = tree.exists(
    joinPathFragments(projectConfig.root, 'tsconfig.json')
  );
  const offsetFromProjectRoot = options.directory
    .split('/')
    .map((_) => '..')
    .join('/');

  const fileOpts = {
    ...options,
    dir: options.directory ?? 'src',
    ext: options.js ? 'js' : 'ts',
    offsetFromRoot: offsetFromRoot(projectConfig.root),
    offsetFromProjectRoot,
    projectRoot: projectConfig.root,
    tsConfigPath: hasTsConfig
      ? `${offsetFromProjectRoot}/tsconfig.json`
      : getRelativePathToRootTsConfig(tree, projectConfig.root),
    tmpl: '',
  };

  generateFiles(
    tree,
    join(__dirname, 'files', filesToUse),
    projectConfig.root,
    fileOpts
  );

  if (filesToUse === 'v10') {
    addBaseCypressSetup(tree, {
      project: options.project,
      directory: options.directory,
      jsx: options.jsx,
      js: options.js,
    });

    const cyFile = joinPathFragments(
      projectConfig.root,
      options.js ? 'cypress.config.js' : 'cypress.config.ts'
    );
    let webServerCommands: Record<string, string>;

    let ciWebServerCommand: string;
    let ciBaseUrl: string;

    if (hasPlugin && options.webServerCommands && options.ciWebServerCommand) {
      webServerCommands = options.webServerCommands;
      ciWebServerCommand = options.ciWebServerCommand;
      ciBaseUrl = options.ciBaseUrl;
    } else if (hasPlugin && options.devServerTarget) {
      webServerCommands = {};

      webServerCommands.default = 'nx run ' + options.devServerTarget;
      const parsedTarget = parseTargetString(
        options.devServerTarget,
        projectGraph
      );

      const devServerProjectConfig: ProjectConfiguration | undefined =
        readProjectConfiguration(tree, parsedTarget.project);
      // Add production e2e target if serve target is found
      if (
        parsedTarget.configuration !== 'production' &&
        devServerProjectConfig?.targets?.[parsedTarget.target]
          ?.configurations?.['production']
      ) {
        webServerCommands.production = `nx run ${parsedTarget.project}:${parsedTarget.target}:production`;
      }
      // Add ci/static e2e target if serve target is found
      if (devServerProjectConfig?.targets?.['serve-static']) {
        ciWebServerCommand = `nx run ${parsedTarget.project}:serve-static`;
      }
    }
    const updatedCyConfig = await addDefaultE2EConfig(
      tree.read(cyFile, 'utf-8'),
      {
        cypressDir: options.directory,
        bundler: options.bundler === 'vite' ? 'vite' : undefined,
        webServerCommands,
        ciWebServerCommand: ciWebServerCommand,
        ciBaseUrl,
      },
      options.baseUrl
    );

    tree.write(cyFile, updatedCyConfig);
  }

  if (
    cyVersion &&
    cyVersion < 7 &&
    tree.exists(
      joinPathFragments(projectConfig.root, 'src', 'plugins', 'index.js')
    )
  ) {
    updateJson(tree, join(projectConfig.root, 'cypress.json'), (json) => {
      json.pluginsFile = './src/plugins/index';
      return json;
    });
  } else if (cyVersion < 10) {
    const pluginPath = join(projectConfig.root, 'src/plugins/index.js');
    if (tree.exists(pluginPath)) {
      tree.delete(pluginPath);
    }
  }

  if (options.js) {
    toJS(tree);
  }
}

function addTarget(
  tree: Tree,
  opts: NormalizedSchema,
  projectGraph: ProjectGraph
) {
  const projectConfig = readProjectConfiguration(tree, opts.project);
  const cyVersion = installedCypressVersion();
  projectConfig.targets ??= {};
  projectConfig.targets.e2e = {
    executor: '@nx/cypress:cypress',
    options: {
      cypressConfig: joinPathFragments(
        projectConfig.root,
        cyVersion && cyVersion < 10
          ? 'cypress.json'
          : `cypress.config.${opts.js ? 'js' : 'ts'}`
      ),
      testingType: 'e2e',
    },
  };
  if (opts.devServerTarget) {
    const parsedTarget = parseTargetString(opts.devServerTarget, projectGraph);

    projectConfig.targets.e2e.options = {
      ...projectConfig.targets.e2e.options,
      devServerTarget: opts.devServerTarget,
      port: opts.port,
    };

    const devServerProjectConfig = readProjectConfiguration(
      tree,
      parsedTarget.project
    );
    // Add production e2e target if serve target is found
    if (
      parsedTarget.configuration !== 'production' &&
      devServerProjectConfig.targets?.[parsedTarget.target]?.configurations?.[
        'production'
      ]
    ) {
      projectConfig.targets.e2e.configurations ??= {};
      projectConfig.targets.e2e.configurations['production'] = {
        devServerTarget: `${parsedTarget.project}:${parsedTarget.target}:production`,
      };
    }
    // Add ci/static e2e target if serve target is found
    if (devServerProjectConfig.targets?.['serve-static']) {
      projectConfig.targets.e2e.configurations ??= {};
      projectConfig.targets.e2e.configurations.ci = {
        devServerTarget: `${parsedTarget.project}:serve-static`,
      };
    }
  } else if (opts.baseUrl) {
    projectConfig.targets.e2e.options = {
      ...projectConfig.targets.e2e.options,
      baseUrl: opts.baseUrl,
    };
  }

  updateProjectConfiguration(tree, opts.project, projectConfig);
}

function createPackageJson(tree: Tree, options: NormalizedSchema) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  const packageJsonPath = joinPathFragments(projectConfig.root, 'package.json');

  if (tree.exists(packageJsonPath)) {
    return;
  }

  const importPath = resolveImportPath(
    tree,
    projectConfig.name,
    projectConfig.root
  );

  const packageJson: PackageJson = {
    name: importPath,
    version: '0.0.1',
    private: true,
  };
  writeJson(tree, packageJsonPath, packageJson);
}

function ignoreTestOutput(tree: Tree): void {
  if (!tree.exists('.gitignore')) {
    logger.warn(`Couldn't find a root .gitignore file to update.`);
  }

  let content = tree.read('.gitignore', 'utf-8');
  if (/^test-output$/gm.test(content)) {
    return;
  }

  content = `${content}\ntest-output\n`;
  tree.write('.gitignore', content);
}

export default configurationGenerator;
