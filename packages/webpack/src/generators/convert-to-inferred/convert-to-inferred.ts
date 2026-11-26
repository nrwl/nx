import {
  AggregatedLog,
  migrateProjectExecutorsToPlugin,
  NoTargetsToMigrateError,
} from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  type ProjectConfiguration,
  type Tree,
  logger as devkitLogger,
} from '@nx/devkit';
import { ast, query } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';
import { createNodesV2, type WebpackPluginOptions } from '../../plugins/plugin';
import {
  webpackCliVersion,
  assertSupportedWebpackVersion,
} from '../../utils/versions';
import {
  buildPostTargetTransformerFactory,
  servePostTargetTransformerFactory,
  type MigrationContext,
} from './utils';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  assertSupportedWebpackVersion(tree);

  const projectGraph = await createProjectGraphAsync();
  const migrationContext: MigrationContext = {
    logger: new AggregatedLog(),
    projectGraph,
    workspaceRoot: tree.root,
  };

  const logger = createCollectingLogger();

  const migratedProjects =
    await migrateProjectExecutorsToPlugin<WebpackPluginOptions>(
      tree,
      projectGraph,
      '@nx/webpack/plugin',
      createNodesV2,
      {
        buildTargetName: 'build',
        previewTargetName: 'preview',
        serveStaticTargetName: 'serve-static',
        serveTargetName: 'serve',
      },
      [
        {
          executors: ['@nx/webpack:webpack', '@nrwl/webpack:webpack'],
          postTargetTransformer:
            buildPostTargetTransformerFactory(migrationContext),
          targetPluginOptionMapper: (target) => ({ buildTargetName: target }),
          skipProjectFilter: skipProjectFilterFactory(tree),
        },
        {
          executors: ['@nx/webpack:dev-server', '@nrwl/webpack:dev-server'],
          postTargetTransformer:
            servePostTargetTransformerFactory(migrationContext),
          targetPluginOptionMapper: (target) => ({ serveTargetName: target }),
          skipProjectFilter: skipProjectFilterFactory(tree),
        },
      ],
      options.project,
      logger
    );

  if (migratedProjects.size === 0) {
    const convertMessage = [...logger.loggedMessages.values()]
      .flat()
      .find((v) => v.includes('@nx/webpack:convert-config-to-webpack-plugin'));

    if (convertMessage) {
      logger.flushLogs((message) => !convertMessage.includes(message));
      throw new Error(convertMessage);
    } else {
      logger.flushLogs();
      throw new NoTargetsToMigrateError();
    }
  } else {
    logger.flushLogs();
  }

  const installCallback = addDependenciesToPackageJson(
    tree,
    {},
    { 'webpack-cli': webpackCliVersion },
    undefined,
    true
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  // Flushed now rather than in the callback so remove-deprecated-executors, which
  // skips the install callback, still prints these.
  migrationContext.logger.flushLogs();

  return installCallback;
}

function skipProjectFilterFactory(tree: Tree) {
  return function skipProjectFilter(
    projectConfiguration: ProjectConfiguration
  ): false | string {
    const buildTarget = Object.values(projectConfiguration.targets ?? {}).find(
      (target) =>
        target.executor === '@nx/webpack:webpack' ||
        target.executor === '@nrwl/webpack:webpack'
    );
    if (!buildTarget) {
      throw new Error(
        `No @nx/webpack:webpack target found in ${projectConfiguration.root}.`
      );
    }
    const webpackConfigPath = buildTarget.options.webpackConfig;
    if (!webpackConfigPath) {
      return `The webpack config path is missing in the project configuration (${projectConfiguration.root}).`;
    }

    const webpackConfigSource = tree.read(webpackConfigPath, 'utf-8');
    if (webpackConfigSource === null) {
      throw new Error(`Cannot read ${webpackConfigPath}`);
    }
    const sourceFile = ast(webpackConfigSource);

    const composePluginsSelector =
      'CallExpression:has(Identifier[name=composePlugins])';
    const composePlugins = query<ts.CallExpression>(
      sourceFile,
      composePluginsSelector
    )[0];

    if (composePlugins) {
      return `The webpack config (${webpackConfigPath}) can only work with the  "@nx/webpack:webpack" executor. Run the "@nx/webpack:convert-config-to-webpack-plugin" generator first.`;
    }

    const nxAppWebpackPluginSelector =
      'PropertyAssignment:has(Identifier[name=plugins]) NewExpression:has(Identifier[name=NxAppWebpackPlugin])';
    const nxAppWebpackPlugin = query<ts.NewExpression>(
      sourceFile,
      nxAppWebpackPluginSelector
    )[0];

    if (!nxAppWebpackPlugin) {
      return `No "NxAppWebpackPlugin" found in the webpack config (${webpackConfigPath}). Its usage is required for the migration to work.`;
    }

    return false;
  };
}

export function createCollectingLogger(): typeof devkitLogger & {
  loggedMessages: Map<string, string[]>;
  flushLogs: (filter?: (message: string) => boolean) => void;
} {
  const loggedMessages = new Map<string, string[]>();

  const flushLogs = (filter?: (message: string) => boolean) => {
    loggedMessages.forEach((messages, method) => {
      messages.forEach((message) => {
        if (!filter || filter(message)) {
          if (!isLoggerMethod(method)) {
            throw new TypeError(`logger.${method} is not a function`);
          }
          devkitLogger[method](message);
        }
      });
    });
  };

  return new Proxy(
    { ...devkitLogger, loggedMessages, flushLogs },
    {
      get(target, property) {
        const originalMethod = Reflect.get(target, property);

        if (typeof originalMethod === 'function') {
          return (...args: unknown[]) => {
            const message = args.join(' ');
            const propertyString = String(property);
            if (!loggedMessages.has(message)) {
              loggedMessages.set(propertyString, []);
            }
            const messages = loggedMessages.get(propertyString);
            if (!messages) {
              throw new TypeError(
                `No messages collected for logger.${propertyString}`
              );
            }
            messages.push(message);
          };
        }

        return originalMethod;
      },
    }
  );
}

function isLoggerMethod(method: string): method is keyof typeof devkitLogger {
  return method in devkitLogger;
}
