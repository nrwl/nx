import {
  BuilderContext,
  createBuilder,
  BuilderOutput
} from '@angular-devkit/architect';
import { JsonObject } from '@angular-devkit/core';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { join, sep, basename } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, statSync, copyFileSync, constants } from 'fs';

//import { buildStaticStandalone } from '@storybook/core/dist/server/build-static';
import * as build from '@storybook/core/standalone';

import { NodeJsSyncHost } from '@angular-devkit/core/node';
import { getRoot } from '../../utils/root';

export interface StorybookConfig extends JsonObject {
  configFolder?: string;
  configPath?: string;
  pluginPath?: string;
  srcRoot?: string;
}

export interface StorybookBuilderOptions extends JsonObject {
  uiFramework: string;
  config: StorybookConfig;
  quiet?: boolean;
}

try {
  require('dotenv').config();
} catch (e) {}

export default createBuilder<StorybookBuilderOptions>(run);

/**
 * @whatItDoes This is the starting point of the builder.
 * @param builderConfig
 */
export function run(
  options: StorybookBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  context.reportStatus(`Building storybook ...`);
  context.logger.info(`ui framework: ${options.uiFramework}`);

  const frameworkPath = `${options.uiFramework}/dist/server/options`;
  return from(import(frameworkPath)).pipe(
    map(m => m.default),
    switchMap(frameworkOptions =>
      from(storybookOptionMapper(options, frameworkOptions, context))
    ),
    switchMap(option => {
      context.logger.info(`Storybook builder starting ...`);
      return runInstance(option);
    }),
    map(loaded => {
      context.logger.info(`Storybook builder finished ...`);
      context.logger.info(`Storybook files availble in ${options.outputPath}`);
      const builder: BuilderOutput = { success: true } as BuilderOutput;
      return builder;
    })
  );
}

function runInstance(options: StorybookBuilderOptions) {
  return from(build({ ...options, ci: true }));
}

async function storybookOptionMapper(
  builderOptions: StorybookBuilderOptions,
  frameworkOptions: any,
  context: BuilderContext
) {
  const storybookConfig = await findOrCreateConfig(
    builderOptions.config,
    context
  );
  const optionsWithFramework = {
    ...builderOptions,
    mode: 'static',
    outputDir: builderOptions.outputPath,
    configDir: storybookConfig,
    ...frameworkOptions,
    frameworkPresets: [...(frameworkOptions.frameworkPresets || [])],

    watch: false
  };
  optionsWithFramework.config;
  return optionsWithFramework;
}

async function findOrCreateConfig(
  config: StorybookConfig,
  context: BuilderContext
): Promise<string> {
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
  } else {
    const host = new NodeJsSyncHost();
    const sourceRoot = await getRoot(context, host);
    if (
      statSync(
        join(context.workspaceRoot, sourceRoot, '.storybook')
      ).isDirectory()
    ) {
      return join(context.workspaceRoot, sourceRoot, '.storybook');
    }
  }
  throw new Error('No configuration settings');
}

function createStorybookConfig(
  configPath: string,
  pluginPath: string,
  srcRoot: string
): string {
  const tmpDir = tmpdir();
  const tmpFolder = mkdtempSync(`${tmpDir}${sep}`);
  copyFileSync(
    configPath,
    `${tmpFolder}${basename(configPath)}`,
    constants.COPYFILE_EXCL
  );
  copyFileSync(
    pluginPath,
    `${tmpFolder}${basename(pluginPath)}`,
    constants.COPYFILE_EXCL
  );
  copyFileSync(
    srcRoot,
    `${tmpFolder}${basename(srcRoot)}`,
    constants.COPYFILE_EXCL
  );
  return tmpFolder;
}
