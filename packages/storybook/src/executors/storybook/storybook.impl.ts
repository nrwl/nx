import {
  ExecutorContext,
  logger,
  parseTargetString,
  readTargetOptions,
} from '@nrwl/devkit';
import { Workspaces } from '@nrwl/tao/src/shared/workspace';
import { buildDevStandalone } from '@storybook/core/server';
import 'dotenv/config';
import { constants, copyFileSync, mkdtempSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join, sep } from 'path';
import { CommonNxStorybookConfig, StorybookConfig } from '../models';
import { getStorybookFrameworkPath, runStorybookSetupCheck } from '../utils';

export interface StorybookExecutorOptions extends CommonNxStorybookConfig {
  host?: string;
  port?: number;
  quiet?: boolean;
  https?: boolean;
  sslCert?: string;
  sslKey?: string;
  staticDir?: string[];
  watch?: boolean;
  docsMode?: boolean;
}

export default async function* storybookExecutor(
  options: StorybookExecutorOptions,
  context: ExecutorContext
) {
  let frameworkPath = getStorybookFrameworkPath(options.uiFramework);

  const frameworkOptions = (await import(frameworkPath)).default;
  const option = storybookOptionMapper(options, frameworkOptions, context);

  // print warnings
  runStorybookSetupCheck(options);

  await runInstance(option);

  yield { success: true };

  // This Promise intentionally never resolves, leaving the process running
  await new Promise<{ success: boolean }>(() => {});
}

function runInstance(options: StorybookExecutorOptions) {
  const env = process.env.NODE_ENV ?? 'development';
  process.env.NODE_ENV = env;
  return buildDevStandalone({
    ...options,
    ci: true,
    configType: env.toUpperCase(),
  } as any).catch((error) => {
    // TODO(juri): find a better cleaner way to handle these. Taken from:
    // https://github.com/storybookjs/storybook/blob/dea23e5e9a3e7f5bb25cb6520d3011cc710796c8/lib/core-server/src/build-dev.ts#L138-L166
    if (error instanceof Error) {
      if ((error as any).error) {
        logger.error((error as any).error);
      } else if (
        (error as any).stats &&
        (error as any).stats.compilation.errors
      ) {
        (error as any).stats.compilation.errors.forEach((e: any) =>
          logger.log(e)
        );
      } else {
        logger.error(error as any);
      }
    } else if (error.compilation?.errors) {
      error.compilation.errors.forEach((e: any) => logger.log(e));
    }

    logger.log('');
    logger.warn(
      error.close
        ? `
          FATAL broken build!, will close the process,
          Fix the error below and restart storybook.
        `
        : `
          Broken build, fix the error above.
          You may need to refresh the browser.
        `
    );

    process.exit(1);
  });
}

function storybookOptionMapper(
  builderOptions: StorybookExecutorOptions,
  frameworkOptions: any,
  context: ExecutorContext
) {
  // setStorybookAppProject(context, builderOptions.projectBuildConfig);

  const storybookConfig = findOrCreateConfig(builderOptions.config, context);
  const storybookOptions = {
    ...builderOptions,
    mode: 'dev',
    workspaceRoot: context.root,
    configDir: storybookConfig,
    ...frameworkOptions,
    frameworkPresets: [...(frameworkOptions.frameworkPresets || [])],
  };

  if (builderOptions.uiFramework === '@storybook/angular') {
    let buildProjectName;
    let targetName = 'build'; // default
    let targetOptions = null;

    if (builderOptions.projectBuildConfig) {
      const targetString = normalizeTargetString(
        builderOptions.projectBuildConfig,
        targetName
      );

      const { project, target, configuration } =
        parseTargetString(targetString);

      // set the extracted target name
      targetName = target;
      buildProjectName = project;

      targetOptions = readTargetOptions(
        { project, target, configuration },
        context
      );

      storybookOptions.angularBrowserTarget = targetString;
    } else {
      // to preserve the backwards compatibility for our users Nx resolves the
      // default project just as Storybook used to before

      const ws = new Workspaces(context.root);
      const defaultProjectName = ws.calculateDefaultProjectName(
        context.cwd,
        context.workspace
      );

      buildProjectName = defaultProjectName;

      targetOptions = readTargetOptions(
        {
          project: defaultProjectName,
          target: targetName,
          configuration: '',
        },
        context
      );

      storybookOptions.angularBrowserTarget = normalizeTargetString(
        defaultProjectName,
        targetName
      );
    }

    const project = context.workspace.projects[buildProjectName];

    // construct a builder object for Storybook
    storybookOptions.angularBuilderContext = {
      target: {
        ...project.targets[targetName],
        project: buildProjectName,
      },
      workspaceRoot: context.cwd,
      getProjectMetadata: () => {
        return project;
      },
      getTargetOptions: () => {
        return targetOptions;
      },
      logger: {
        createChild(name) {
          return logger;
        },
      },
    };
  }

  return storybookOptions;
}

function findOrCreateConfig(
  config: StorybookConfig,
  context: ExecutorContext
): string {
  const sourceRoot = context.workspace.projects[context.projectName].root;

  if (config.configFolder && statSync(config.configFolder).isDirectory()) {
    return config.configFolder;
  } else if (
    statSync(config.configPath).isFile() &&
    statSync(config.pluginPath).isFile() &&
    statSync(config.srcRoot).isFile()
  ) {
    return createStorybookConfig(
      config.configPath,
      config.pluginPath,
      config.srcRoot
    );
  } else if (
    statSync(join(context.root, sourceRoot, '.storybook')).isDirectory()
  ) {
    return join(context.root, sourceRoot, '.storybook');
  }
  throw new Error('No configuration settings');
}

function createStorybookConfig(
  configPath: string,
  pluginPath: string,
  srcRoot: string
): string {
  const tmpDir = tmpdir();
  const tmpFolder = `${tmpDir}${sep}`;
  mkdtempSync(tmpFolder);
  copyFileSync(
    configPath,
    `${tmpFolder}/${basename(configPath)}`,
    constants.COPYFILE_EXCL
  );
  copyFileSync(
    pluginPath,
    `${tmpFolder}/${basename(pluginPath)}`,
    constants.COPYFILE_EXCL
  );
  copyFileSync(
    srcRoot,
    `${tmpFolder}/${basename(srcRoot)}`,
    constants.COPYFILE_EXCL
  );
  return tmpFolder;
}

function normalizeTargetString(
  appName: string,
  defaultTarget: string = 'build'
) {
  if (appName.includes(':')) {
    return appName;
  }
  return `${appName}:${defaultTarget}`;
}
