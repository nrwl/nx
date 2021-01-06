import {
  BuilderContext,
  createBuilder,
  BuilderOutput,
} from '@angular-devkit/architect';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { JsonObject } from '@angular-devkit/core';
import { join, sep, basename } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, statSync, copyFileSync, constants } from 'fs';

import { buildDevStandalone } from '@storybook/core/dist/server/build-dev';

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
  host?: string;
  port?: number;
  quiet?: boolean;
  ssl?: boolean;
  sslCert?: string;
  sslKey?: string;
  staticDir?: string[];
  watch?: boolean;
  docsMode?: boolean;
}

try {
  require('dotenv').config();
} catch (e) {}

export default createBuilder<StorybookBuilderOptions>(run);

/**
 * @whatItDoes This is the starting point of the builder.
 * @param builderConfig
 */
function run(
  options: StorybookBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  const frameworkPath = `${options.uiFramework}/dist/server/options`;
  return from(import(frameworkPath)).pipe(
    map((m) => m.default),
    switchMap((frameworkOptions) =>
      from(storybookOptionMapper(options, frameworkOptions, context))
    ),
    switchMap((option) => runInstance(option)),
    map((loaded) => {
      const builder: BuilderOutput = { success: true } as BuilderOutput;
      return builder;
    })
  );
}

function runInstance(options: StorybookBuilderOptions) {
  return new Observable<any>((obs) => {
    buildDevStandalone({ ...options, ci: true })
      .then((sucess) => obs.next(sucess))
      .catch((err) => obs.error(err));
  });
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
    mode: 'dev',
    configDir: storybookConfig,
    ...frameworkOptions,
    frameworkPresets: [...(frameworkOptions.frameworkPresets || [])],
  };
  optionsWithFramework.config;
  return optionsWithFramework;
}

async function findOrCreateConfig(
  config: StorybookConfig,
  context: BuilderContext
): Promise<string> {
  const sourceRoot = await getRoot(context);

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
    statSync(
      join(context.workspaceRoot, sourceRoot, '.storybook')
    ).isDirectory()
  ) {
    return join(context.workspaceRoot, sourceRoot, '.storybook');
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
