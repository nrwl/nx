import type * as ts from 'typescript';
import {
  addDependenciesToPackageJson,
  applyChangesToString,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  joinPathFragments,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import initGenerator from '../init/init';

import type { Schema } from './schema';
import {
  corsVersion,
  expressVersion,
  isbotVersion,
  typesCorsVersion,
  typesExpressVersion,
} from '../../utils/versions';
import { addStaticRouter } from '../../utils/ast-utils';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

function readEntryFile(
  host: Tree,
  path: string
): { content: string; source: ts.SourceFile } {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const content = host.read(path, 'utf-8');
  return {
    content,
    source: tsModule.createSourceFile(
      path,
      content,
      tsModule.ScriptTarget.Latest,
      true
    ),
  };
}

interface AppComponentInfo {
  importPath: string;
  filePath: string;
}

export async function setupSsrGenerator(tree: Tree, options: Schema) {
  await initGenerator(tree, { skipFormat: true });
  const projectConfig = readProjectConfiguration(tree, options.project);
  const projectRoot = projectConfig.root;
  const appImportCandidates: AppComponentInfo[] = [
    options.appComponentImportPath ?? 'app/app',
    'app',
    'App',
    'app/App',
    'App/App',
  ].map((importPath) => {
    return {
      importPath,
      filePath: joinPathFragments(
        projectConfig.sourceRoot || projectConfig.root,
        `${importPath}.tsx`
      ),
    };
  });

  const appComponentInfo = appImportCandidates.find((candidate) =>
    tree.exists(candidate.filePath)
  );

  if (!appComponentInfo) {
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
      dependsOn: ['build'],
      executor: '@nx/webpack:webpack',
      outputs: ['{options.outputPath}'],
      defaultConfiguration: 'production',
      options: {
        target: 'node',
        main: `${projectRoot}/server.ts`,
        outputPath: joinPathFragments(originalOutputPath, 'server'),
        outputFileName: 'server.js',
        tsConfig: `${projectRoot}/tsconfig.server.json`,
        compiler: 'babel',
        externalDependencies: 'all',
        outputHashing: 'none',
        isolatedConfig: true,
        webpackConfig: joinPathFragments(projectRoot, 'webpack.config.js'),
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
      executor: '@nx/js:node',
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
      executor: '@nx/webpack:ssr-dev-server',
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

  const nxJson = readNxJson(tree);
  if (
    nxJson.tasksRunnerOptions?.default &&
    !nxJson.tasksRunnerOptions.default.options.cacheableOperations.includes(
      'server'
    )
  ) {
    nxJson.tasksRunnerOptions.default.options.cacheableOperations = [
      ...nxJson.tasksRunnerOptions.default.options.cacheableOperations,
      'server',
    ];
  }

  generateFiles(tree, joinPathFragments(__dirname, 'files'), projectRoot, {
    tmpl: '',
    extraInclude:
      options.extraInclude?.length > 0
        ? `"${options.extraInclude.join('", "')}",`
        : '',
    appComponentImport: appComponentInfo.importPath,
    browserBuildOutputPath: projectConfig.targets.build.options.outputPath,
  });

  // Add <StaticRouter> to server main if needed.
  // TODO: need to read main.server.tsx not main.tsx.
  const appContent = tree.read(appComponentInfo.filePath, 'utf-8');
  const isRouterPresent = appContent.match(/react-router-dom/);
  if (isRouterPresent) {
    const serverEntry = joinPathFragments(projectRoot, 'src/main.server.tsx');
    const { content, source } = readEntryFile(tree, serverEntry);
    const changes = applyChangesToString(
      content,
      addStaticRouter(serverEntry, source)
    );
    tree.write(serverEntry, changes);
  }

  updateNxJson(tree, nxJson);

  const installTask = addDependenciesToPackageJson(
    tree,
    {
      express: expressVersion,
      isbot: isbotVersion,
      cors: corsVersion,
    },
    {
      '@types/express': typesExpressVersion,
      '@types/cors': typesCorsVersion,
    }
  );

  await formatFiles(tree);

  return installTask;
}

export default setupSsrGenerator;

export const setupSsrSchematic = convertNxGenerator(setupSsrGenerator);
