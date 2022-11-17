import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  Tree,
  updateProjectConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

import type { Schema } from './schema';
import {
  expressVersion,
  isbotVersion,
  typesExpressVersion,
} from '../../utils/versions';

export async function setupSsrGenerator(tree: Tree, options: Schema) {
  const projectConfig = readProjectConfiguration(tree, options.project);
  const projectRoot = projectConfig.root;
  const appImportCandidates = [
    options.appComponentImportPath,
    'app',
    'App',
    'app/App',
    'App/App',
  ];
  const appComponentImport = appImportCandidates.find(
    (app) =>
      tree.exists(joinPathFragments(projectConfig.sourceRoot, `${app}.tsx`)) ||
      tree.exists(joinPathFragments(projectConfig.sourceRoot, `${app}.jsx`)) ||
      tree.exists(joinPathFragments(projectConfig.sourceRoot, `${app}.js`))
  );

  if (!appComponentImport) {
    throw new Error(
      `Cannot find an import path for <App/> component. Try passing setting --appComponentImportPath option.`
    );
  }

  if (!projectConfig.targets.build || !projectConfig.targets.serve) {
    throw new Error(
      `Project ${options.project} does not have build and serve targets`
    );
  }

  if (projectConfig.targets.server) {
    throw new Error(`Project ${options.project} already has a server target.`);
  }

  const originalOutputPath = projectConfig.targets.build?.options?.outputPath;

  if (!originalOutputPath) {
    throw new Error(
      `Project ${options.project} does not contain a outputPath for the build target.`
    );
  }

  projectConfig.targets.build.options.outputPath = joinPathFragments(
    originalOutputPath,
    'browser'
  );
  projectConfig.targets = {
    ...projectConfig.targets,
    server: {
      executor: '@nrwl/webpack:webpack',
      outputs: ['{options.outputPath}'],
      defaultConfiguration: 'production',
      options: {
        target: 'node',
        main: `${projectRoot}/server.ts`,
        outputPath: joinPathFragments(originalOutputPath, 'server'),
        tsConfig: `${projectRoot}/tsconfig.server.json`,
        compiler: 'babel',
        externalDependencies: 'all',
        outputHashing: 'none',
        webpackConfig: '@nrwl/react/plugins/webpack',
      },
      configurations: {
        development: {
          optimization: false,
          sourceMap: true,
        },
        production: {
          fileReplacements: [
            {
              replace: `${projectRoot}/src/environments/environment.ts`,
              with: `${projectRoot}/src/environments/environment.prod.ts`,
            },
          ],
          sourceMap: false,
        },
      },
    },
    'serve-browser': projectConfig.targets.serve,
    'serve-server': {
      executor: '@nrwl/js:node',
      defaultConfiguration: 'development',
      options: {
        buildTarget: `${options.project}:server:development`,
        buildTargetOptions: {
          watch: true,
        },
      },
      configurations: {
        development: {},
        production: {
          buildTarget: `${options.project}:server:production`,
        },
      },
    },
    serve: {
      executor: '@nrwl/webpack:ssr-dev-server',
      defaultConfiguration: 'development',
      options: {
        browserTarget: `${options.project}:build:development`,
        serverTarget: `${options.project}:serve-server:development`,
        port: options.serverPort,
        browserTargetOptions: {
          watch: true,
        },
      },
      configurations: {
        development: {},
        production: {
          browserTarget: `${options.project}:build:production`,
          serverTarget: `${options.project}:serve-server:production`,
        },
      },
    },
  };

  updateProjectConfiguration(tree, options.project, projectConfig);

  const workspace = readWorkspaceConfiguration(tree);
  if (
    workspace.tasksRunnerOptions?.default &&
    !workspace.tasksRunnerOptions.default.options.cacheableOperations['server']
  ) {
    workspace.tasksRunnerOptions.default.options.cacheableOperations = [
      ...workspace.tasksRunnerOptions.default.options.cacheableOperations,
      'server',
    ];
  }

  generateFiles(tree, joinPathFragments(__dirname, 'files'), projectRoot, {
    tmpl: '',
    appComponentImport,
    browserBuildOutputPath: projectConfig.targets.build.options.outputPath,
  });

  updateWorkspaceConfiguration(tree, workspace);

  const installTask = addDependenciesToPackageJson(
    tree,
    {
      express: expressVersion,
      isbot: isbotVersion,
    },
    {
      '@types/express': typesExpressVersion,
    }
  );

  await formatFiles(tree);

  return installTask;
}

export default setupSsrGenerator;

export const setupSsrSchematic = convertNxGenerator(setupSsrGenerator);
