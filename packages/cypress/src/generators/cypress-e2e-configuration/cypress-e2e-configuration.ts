import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  parseTargetString,
  readProjectConfiguration,
  runTasksInSerial,
  toJS,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { Linter } from '@nx/linter';
import { join } from 'path';
import { addLinterToCyProject } from '../../utils/add-linter';
import { addDefaultE2EConfig } from '../../utils/config';
import { installedCypressVersion } from '../../utils/cypress-version';
import { viteVersion } from '../../utils/versions';
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
}
type NormalizedSchema = ReturnType<typeof normalizeOptions>;

export async function cypressE2EConfigurationGenerator(
  tree: Tree,
  options: CypressE2EConfigSchema
) {
  const opts = normalizeOptions(tree, options);

  const tasks: GeneratorCallback[] = [];

  if (!installedCypressVersion()) {
    tasks.push(await cypressInitGenerator(tree, opts));
  }
  if (opts.bundler === 'vite') {
    tasks.push(addDependenciesToPackageJson(tree, {}, { vite: viteVersion }));
  }
  await addFiles(tree, opts);
  addTarget(tree, opts);
  addLinterToCyProject(tree, {
    ...opts,
    cypressDir: opts.directory,
  });

  if (!opts.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
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

  return {
    ...options,
    bundler: options.bundler ?? 'webpack',
    rootProject: projectConfig.root === '.',
    linter: options.linter ?? Linter.EsLint,
    devServerTarget:
      options.devServerTarget ??
      (projectConfig.targets.serve ? `${options.project}:serve` : undefined),
  };
}

async function addFiles(tree: Tree, options: NormalizedSchema) {
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
    });

    const cyFile = joinPathFragments(projectConfig.root, 'cypress.config.ts');

    const updatedCyConfig = await addDefaultE2EConfig(
      tree.read(cyFile, 'utf-8'),
      {
        directory: options.directory,
        bundler: options.bundler,
      }
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
        cyVersion && cyVersion < 10 ? 'cypress.json' : 'cypress.config.ts'
      ),
      testingType: 'e2e',
    },
  };
  if (opts.baseUrl) {
    projectConfig.targets.e2e.options = {
      ...projectConfig.targets.e2e.options,
      baseUrl: opts.baseUrl,
    };
  } else if (opts.devServerTarget) {
    const parsedTarget = parseTargetString(opts.devServerTarget);

    projectConfig.targets.e2e.options = {
      ...projectConfig.targets.e2e.options,
      devServerTarget: opts.devServerTarget,
      port: opts.port,
    };

    projectConfig.targets.e2e.configurations = {
      [parsedTarget.configuration || 'production']: {
        devServerTarget: `${opts.devServerTarget}${
          parsedTarget.configuration ? '' : ':production'
        }`,
      },
    };
    const devServerProjectConfig = readProjectConfiguration(
      tree,
      parsedTarget.project
    );
    if (devServerProjectConfig.targets?.['serve-static']) {
      projectConfig.targets.e2e.configurations.ci = {
        devServerTarget: `${parsedTarget.project}:serve-static`,
      };
    }
  } else {
    throw new Error('Either baseUrl or devServerTarget must be provided');
  }

  updateProjectConfiguration(tree, opts.project, projectConfig);
}

export default cypressE2EConfigurationGenerator;
export const compat = convertNxGenerator(cypressE2EConfigurationGenerator);
