import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getProjects,
  joinPathFragments,
  logger,
  offsetFromRoot,
  ProjectConfiguration,
  readProjectConfiguration,
  runTasksInSerial,
  stripIndents,
  toJS,
  Tree,
  updateJson,
} from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';
import {
  getRelativePathToRootTsConfig,
  initGenerator as jsInitGenerator,
} from '@nx/js';
import { Linter } from '@nx/eslint';
import { join } from 'path';
import { major } from 'semver';
import { addLinterToCyProject } from '../../utils/add-linter';
import { installedCypressVersion } from '../../utils/cypress-version';
import {
  cypressVersion,
  typesNodeVersion,
  viteVersion,
} from '../../utils/versions';
import { cypressInitGenerator } from '../init/init';
import { Schema } from './schema';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';

export interface CypressProjectSchema extends Schema {
  projectName: string;
  projectRoot: string;
  rootProject: boolean;
}

function createFiles(tree: Tree, options: CypressProjectSchema) {
  // if not installed or >v10 use v10 folder
  // else use v9 folder
  const cypressVersion = installedCypressVersion();
  const cypressFiles =
    cypressVersion && cypressVersion < 10 ? 'v9-and-under' : 'v10-and-after';

  generateFiles(
    tree,
    join(__dirname, './files', cypressFiles),
    options.projectRoot,
    {
      tmpl: '',
      ...options,
      project: options.project || 'Project',
      ext: options.js ? 'js' : 'ts',
      offsetFromRoot: offsetFromRoot(options.projectRoot),
      rootTsConfigPath: getRelativePathToRootTsConfig(
        tree,
        options.projectRoot
      ),
      bundler: options.bundler,
    }
  );

  if (cypressVersion && cypressVersion < 7) {
    updateJson(tree, join(options.projectRoot, 'cypress.json'), (json) => {
      json.pluginsFile = './src/plugins/index';
      return json;
    });
  } else if (cypressVersion < 10) {
    const pluginPath = join(options.projectRoot, 'src/plugins/index.js');
    if (tree.exists(pluginPath)) {
      tree.delete(pluginPath);
    }
  }

  if (options.js) {
    toJS(tree);
  }
}

function addProject(tree: Tree, options: CypressProjectSchema) {
  let e2eProjectConfig: ProjectConfiguration;

  const detectedCypressVersion =
    installedCypressVersion() ??
    major(checkAndCleanWithSemver('cypress', cypressVersion));

  const cypressConfig =
    detectedCypressVersion < 10 ? 'cypress.json' : 'cypress.config.ts';

  if (options.baseUrl) {
    e2eProjectConfig = {
      root: options.projectRoot,
      sourceRoot: joinPathFragments(options.projectRoot, 'src'),
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: joinPathFragments(
              options.projectRoot,
              cypressConfig
            ),
            baseUrl: options.baseUrl,
            testingType: 'e2e',
          },
        },
      },
      tags: [],
      implicitDependencies: options.project ? [options.project] : undefined,
    };
  } else if (options.project) {
    const project = readProjectConfiguration(tree, options.project);

    if (!project.targets) {
      logger.warn(stripIndents`
      NOTE: Project, "${options.project}", does not have any targets defined and a baseUrl was not provided. Nx will use
      "${options.project}:serve" as the devServerTarget. But you may need to define this target within the project, "${options.project}".
      `);
    }
    const devServerTarget =
      project.targets?.serve && project.targets?.serve?.defaultConfiguration
        ? `${options.project}:serve:${project.targets.serve.defaultConfiguration}`
        : `${options.project}:serve`;
    e2eProjectConfig = {
      root: options.projectRoot,
      sourceRoot: joinPathFragments(options.projectRoot, 'src'),
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: joinPathFragments(
              options.projectRoot,
              cypressConfig
            ),
            devServerTarget,
            testingType: 'e2e',
          },
          configurations: {
            production: {
              devServerTarget: `${options.project}:serve:production`,
            },
          },
        },
      },
      tags: [],
      implicitDependencies: options.project ? [options.project] : undefined,
    };
    if (project.targets?.['serve-static']) {
      e2eProjectConfig.targets.e2e.configurations.ci = {
        devServerTarget: `${options.project}:serve-static`,
      };
    }
  } else {
    throw new Error(`Either project or baseUrl should be specified.`);
  }

  if (detectedCypressVersion < 7) {
    e2eProjectConfig.targets.e2e.options.tsConfig = joinPathFragments(
      options.projectRoot,
      'tsconfig.json'
    );
  }
  addProjectConfiguration(tree, options.projectName, e2eProjectConfig);
}

/**
 * @deprecated use cypressE2EConfigurationGenerator instead
 **/
export async function cypressProjectGenerator(host: Tree, schema: Schema) {
  return await cypressProjectGeneratorInternal(host, {
    projectNameAndRootFormat: 'derived',
    addPlugin: false,
    ...schema,
  });
}

/**
 * @deprecated use cypressE2EConfigurationGenerator instead
 **/
export async function cypressProjectGeneratorInternal(
  host: Tree,
  schema: Schema
) {
  const options = await normalizeOptions(host, schema);
  const tasks: GeneratorCallback[] = [];
  const cypressVersion = installedCypressVersion();
  // if there is an installed cypress version, then we don't call
  // init since we want to keep the existing version that is installed
  if (!cypressVersion) {
    tasks.push(await jsInitGenerator(host, { ...options, skipFormat: true }));
    tasks.push(
      await cypressInitGenerator(host, {
        ...options,
        skipFormat: true,
        addPlugin: options.addPlugin,
      })
    );
  }

  createFiles(host, options);
  addProject(host, options);
  const installTask = await addLinterToCyProject(host, {
    ...options,
    cypressDir: 'src',
    linter: schema.linter,
    project: options.projectName,
    overwriteExisting: true,
  });
  tasks.push(installTask);

  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(host, options));
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }
  return runTasksInSerial(...tasks);
}

function ensureDependencies(tree: Tree, options: CypressProjectSchema) {
  const devDependencies: Record<string, string> = {
    '@types/node': typesNodeVersion,
  };

  if (options.bundler === 'vite') {
    devDependencies['vite'] = viteVersion;
  }

  return runTasksInSerial(
    ...[
      addDependenciesToPackageJson(tree, {}, devDependencies),
      () => {
        logShowProjectCommand(options.projectName);
      },
    ]
  );
}

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<CypressProjectSchema> {
  let maybeRootProject: ProjectConfiguration;
  let isRootProject = false;

  const projects = getProjects(host);
  // nx will set the project option for generators when ran within a project.
  // since the root project will always be set for standalone projects we can just check it here.
  if (options.project) {
    maybeRootProject = projects.get(options.project);
  }

  if (
    maybeRootProject?.root === '.' ||
    // should still check to see if we are in a standalone based workspace
    (!maybeRootProject &&
      Array.from(projects.values()).some((config) => config.root === '.'))
  ) {
    isRootProject = true;
  }

  let { projectName, projectRoot } = await determineProjectNameAndRootOptions(
    host,
    {
      name: options.name,
      projectType: 'application',
      directory: isRootProject ? options.name : options.directory,
      projectNameAndRootFormat: isRootProject
        ? 'as-provided'
        : options.projectNameAndRootFormat,
      callingGenerator: '@nx/cypress:cypress-project',
    }
  );

  options.linter = options.linter || Linter.EsLint;
  options.bundler = options.bundler || 'webpack';
  return {
    ...options,
    // other generators depend on the rootProject flag down stream
    rootProject: isRootProject,
    projectName,
    projectRoot,
  };
}

export default cypressProjectGenerator;
