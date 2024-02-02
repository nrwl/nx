import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  parseTargetString,
  ProjectGraph,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  toJS,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import {
  getRelativePathToRootTsConfig,
  initGenerator as jsInitGenerator,
} from '@nx/js';
import { Linter } from '@nx/eslint';
import { join } from 'path';
import { addLinterToCyProject } from '../../utils/add-linter';
import { addDefaultE2EConfig } from '../../utils/config';
import { installedCypressVersion } from '../../utils/cypress-version';
import { typesNodeVersion, viteVersion } from '../../utils/versions';
import cypressInitGenerator from '../init/init';
import { addBaseCypressSetup } from '../base-setup/base-setup';

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
  linter?: Linter;
  port?: number | 'cypress-auto';
  jsx?: boolean;
  rootProject?: boolean;

  webServerCommands?: Record<string, string>;
  ciWebServerCommand?: string;
  addPlugin?: boolean;
}

type NormalizedSchema = ReturnType<typeof normalizeOptions>;

export function configurationGenerator(
  tree: Tree,
  options: CypressE2EConfigSchema
) {
  return configurationGeneratorInternal(tree, { addPlugin: false, ...options });
}

export async function configurationGeneratorInternal(
  tree: Tree,
  options: CypressE2EConfigSchema
) {
  const opts = normalizeOptions(tree, options);

  const tasks: GeneratorCallback[] = [];

  if (!installedCypressVersion()) {
    tasks.push(await jsInitGenerator(tree, { ...options, skipFormat: true }));
    tasks.push(
      await cypressInitGenerator(tree, {
        ...opts,
        skipFormat: true,
        addPlugin: options.addPlugin,
      })
    );
  }
  const projectGraph = await createProjectGraphAsync();
  const nxJson = readNxJson(tree);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/cypress/plugin'
      : p.plugin === '@nx/cypress/plugin'
  );

  await addFiles(tree, opts, projectGraph, hasPlugin);
  if (!hasPlugin) {
    addTarget(tree, opts);
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

function normalizeOptions(tree: Tree, options: CypressE2EConfigSchema) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  if (projectConfig?.targets?.e2e) {
    throw new Error(`Project ${options.project} already has an e2e target.
Rename or remove the existing e2e target.`);
  }

  if (
    !options.baseUrl &&
    !options.devServerTarget &&
    !projectConfig.targets.serve
  ) {
    throw new Error(`The project ${options.project} does not have a 'serve' target.
In this case you need to provide a devServerTarget,'<projectName>:<targetName>[:<configName>]', or a baseUrl option`);
  }

  options.directory ??= 'src';

  const devServerTarget =
    options.devServerTarget ??
    (projectConfig.targets.serve ? `${options.project}:serve` : undefined);

  if (!options.baseUrl && !devServerTarget) {
    throw new Error('Either baseUrl or devServerTarget must be provided');
  }

  return {
    ...options,
    addPlugin: options.addPlugin ?? process.env.NX_ADD_PLUGINS !== 'false',
    bundler: options.bundler ?? 'webpack',
    rootProject: options.rootProject ?? projectConfig.root === '.',
    linter: options.linter ?? Linter.EsLint,
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

    if (hasPlugin && options.webServerCommands && options.ciWebServerCommand) {
      webServerCommands = options.webServerCommands;
      ciWebServerCommand = options.ciWebServerCommand;
    } else if (hasPlugin && options.devServerTarget) {
      webServerCommands = {};

      webServerCommands.default = 'nx run ' + options.devServerTarget;
      const parsedTarget = parseTargetString(
        options.devServerTarget,
        projectGraph
      );

      const devServerProjectConfig = readProjectConfiguration(
        tree,
        parsedTarget.project
      );
      // Add production e2e target if serve target is found
      if (
        parsedTarget.configuration !== 'production' &&
        devServerProjectConfig.targets[parsedTarget.target]?.configurations?.[
          'production'
        ]
      ) {
        webServerCommands.production = `nx run ${parsedTarget.project}:${parsedTarget.target}:production`;
      }
      // Add ci/static e2e target if serve target is found
      if (devServerProjectConfig.targets?.['serve-static']) {
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

function addTarget(tree: Tree, opts: NormalizedSchema) {
  const projectConfig = readProjectConfiguration(tree, opts.project);
  const cyVersion = installedCypressVersion();
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
    const parsedTarget = parseTargetString(opts.devServerTarget);

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

export default configurationGenerator;
