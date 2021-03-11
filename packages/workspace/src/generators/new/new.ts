import {
  Tree,
  formatFiles,
  updateJson,
  addDependenciesToPackageJson,
  installPackagesTask,
  getWorkspacePath as devkitGetWorkspacePath,
  convertNxGenerator,
  names,
  getPackageManagerCommand,
  WorkspaceJsonConfiguration,
} from '@nrwl/devkit';

import { join } from 'path';
import * as yargsParser from 'yargs-parser';
import { spawn, SpawnOptions } from 'child_process';

import { workspaceGenerator } from '../workspace/workspace';
import { nxVersion } from '../../utils/versions';
import { reformattedWorkspaceJsonOrNull } from '@nrwl/tao/src/shared/workspace';

export enum Preset {
  Empty = 'empty',
  OSS = 'oss',
  WebComponents = 'web-components',
  Angular = 'angular',
  AngularWithNest = 'angular-nest',
  React = 'react',
  ReactWithExpress = 'react-express',
  NextJs = 'next',
  Gatsby = 'gatsby',
  Nest = 'nest',
  Express = 'express',
}

export interface Schema {
  cli: 'nx' | 'angular';
  directory: string;
  name: string;
  appName: string;
  npmScope?: string;
  skipInstall?: boolean;
  skipGit?: boolean;
  style?: string;
  nxCloud?: boolean;
  preset: Preset;
  commit?: { name: string; email: string; message?: string };
  defaultBase: string;
  linter: 'tslint' | 'eslint';
  packageManager?: 'npm' | 'yarn' | 'pnpm';
}

function generatePreset(host: Tree, opts: Schema) {
  const cliCommand = opts.cli === 'angular' ? 'ng' : 'nx';
  const parsedArgs = yargsParser(process.argv, {
    boolean: ['interactive'],
  });
  const spawnOptions = {
    stdio: [process.stdin, process.stdout, process.stderr],
    shell: true,
    cwd: join(host.root, opts.directory),
  };
  const pmc = getPackageManagerCommand();
  const executable = `${pmc.exec} ${cliCommand}`;
  const args = [
    `g`,
    `@nrwl/workspace:preset`,
    `--name=${opts.appName}`,
    opts.style ? `--style=${opts.style}` : null,
    opts.linter ? `--linter=${opts.linter}` : null,
    opts.npmScope ? `--npmScope=${opts.npmScope}` : `--npmScope=${opts.name}`,
    opts.preset ? `--preset=${opts.preset}` : null,
    `--cli=${cliCommand}`,
    parsedArgs.interactive ? '--interactive=true' : '--interactive=false',
  ].filter((e) => !!e);
  return new Promise((resolve, reject) => {
    spawn(executable, args, spawnOptions).on('close', (code: number) => {
      if (code === 0) {
        resolve();
      } else {
        const message = 'Workspace creation failed, see above.';
        reject(new Error(message));
      }
    });
  });
}

async function initializeGitRepo(
  host: Tree,
  rootDirectory: string,
  options: Schema
) {
  const execute = (args: ReadonlyArray<string>, ignoreErrorStream = false) => {
    const outputStream = 'ignore';
    const errorStream = ignoreErrorStream ? 'ignore' : process.stderr;
    const spawnOptions: SpawnOptions = {
      stdio: [process.stdin, outputStream, errorStream],
      shell: true,
      cwd: join(host.root, rootDirectory),
      env: {
        ...process.env,
        ...(options.commit.name
          ? {
              GIT_AUTHOR_NAME: options.commit.name,
              GIT_COMMITTER_NAME: options.commit.name,
            }
          : {}),
        ...(options.commit.email
          ? {
              GIT_AUTHOR_EMAIL: options.commit.email,
              GIT_COMMITTER_EMAIL: options.commit.email,
            }
          : {}),
      },
    };
    return new Promise((resolve, reject) => {
      spawn('git', args, spawnOptions).on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
    });
  };
  const hasCommand = await execute(['--version']).then(
    () => true,
    () => false
  );
  if (!hasCommand) {
    return;
  }
  const insideRepo = await execute(
    ['rev-parse', '--is-inside-work-tree'],
    true
  ).then(
    () => true,
    () => false
  );
  if (insideRepo) {
    console.info(
      `Directory is already under version control. Skipping initialization of git.`
    );
    return;
  }
  await execute(['init']);
  await execute(['add', '.']);
  if (options.commit) {
    const message = options.commit.message || 'initial commit';
    await execute(['commit', `-m "${message}"`]);
  }
  console.info('Successfully initialized git.');
}

export async function newGenerator(host: Tree, options: Schema) {
  if (
    options.skipInstall &&
    options.preset !== 'empty' &&
    options.preset !== 'oss'
  ) {
    throw new Error(`Cannot select a preset when skipInstall is set to true.`);
  }
  if (options.skipInstall && options.nxCloud) {
    throw new Error(`Cannot select nxCloud when skipInstall is set to true.`);
  }

  if (devkitGetWorkspacePath(host)) {
    throw new Error(
      'Cannot generate a new workspace within an existing workspace'
    );
  }

  options = normalizeOptions(options);

  const layout: 'packages' | 'apps-and-libs' =
    options.preset === 'oss' ? 'packages' : 'apps-and-libs';
  const workspaceOpts = {
    ...options,
    layout,
    preset: undefined,
    nxCloud: undefined,
  };
  await workspaceGenerator(host, workspaceOpts);

  if (options.cli === 'angular') {
    setDefaultPackageManager(host, options);
  }
  setDefaultLinter(host, options);
  addPresetDependencies(host, options);
  addCloudDependencies(host, options);

  await formatFiles(host);
  return async () => {
    installPackagesTask(host, false, options.directory, options.packageManager);
    await generatePreset(host, options);
    if (!options.skipGit) {
      await initializeGitRepo(host, options.directory, options);
    }
  };
}

export default newGenerator;
export const newSchematic = convertNxGenerator(newGenerator);

function addCloudDependencies(host: Tree, options: Schema) {
  if (options.nxCloud) {
    return addDependenciesToPackageJson(
      host,
      {},
      { '@nrwl/nx-cloud': 'latest' },
      join(options.directory, 'package.json')
    );
  }
}

const presetDependencies: Omit<
  Record<
    Preset,
    { dependencies: Record<string, string>; dev: Record<string, string> }
  >,
  Preset.Empty | Preset.OSS
> = {
  [Preset.WebComponents]: { dependencies: {}, dev: { '@nrwl/web': nxVersion } },
  [Preset.Angular]: { dependencies: { '@nrwl/angular': nxVersion }, dev: {} },
  [Preset.AngularWithNest]: {
    dependencies: { '@nrwl/angular': nxVersion },
    dev: { '@nrwl/nest': nxVersion },
  },
  [Preset.React]: {
    dependencies: {},
    dev: {
      '@nrwl/react': nxVersion,
    },
  },
  [Preset.ReactWithExpress]: {
    dependencies: {},
    dev: {
      '@nrwl/react': nxVersion,
      '@nrwl/express': nxVersion,
    },
  },
  [Preset.Nest]: {
    dependencies: {},
    dev: {
      '@nrwl/nest': nxVersion,
    },
  },
  [Preset.Express]: {
    dependencies: {},
    dev: {
      '@nrwl/express': nxVersion,
    },
  },
  [Preset.NextJs]: {
    dependencies: {},
    dev: {
      '@nrwl/next': nxVersion,
    },
  },
  [Preset.Gatsby]: {
    dependencies: {},
    dev: {
      '@nrwl/gatsby': nxVersion,
    },
  },
};

function addPresetDependencies(host: Tree, options: Schema) {
  if (options.preset === Preset.Empty || options.preset === Preset.OSS) {
    return;
  }
  const { dependencies, dev } = presetDependencies[options.preset];
  return addDependenciesToPackageJson(
    host,
    dependencies,
    dev,
    join(options.directory, 'package.json')
  );
}

function normalizeOptions(options: Schema): Schema {
  options.name = names(options.name).fileName;
  if (!options.directory) {
    options.directory = options.name;
  }

  return options;
}

function setDefaultLinter(host: Tree, options: Schema) {
  const { linter, preset } = options;
  // Don't do anything if someone doesn't pick angular
  if (preset !== 'angular' && preset !== 'angular-nest') {
    return;
  }

  switch (linter) {
    case 'eslint': {
      setESLintDefault(host, options);
      break;
    }
    case 'tslint': {
      setTSLintDefault(host, options);
      break;
    }
  }
}

/**
 * This sets ESLint as the default for any schematics that default to TSLint
 */
function setESLintDefault(host: Tree, options: Schema) {
  updateJson(host, getWorkspacePath(host, options), (json) => {
    setDefault(json, '@nrwl/angular', 'application', 'linter', 'eslint');
    setDefault(json, '@nrwl/angular', 'library', 'linter', 'eslint');
    setDefault(
      json,
      '@nrwl/angular',
      'storybook-configuration',
      'linter',
      'eslint'
    );
    return json;
  });
}

/**
 * This sets TSLint as the default for any schematics that default to ESLint
 */
function setTSLintDefault(host: Tree, options: Schema) {
  updateJson(host, getWorkspacePath(host, options), (json) => {
    setDefault(json, '@nrwl/workspace', 'library', 'linter', 'tslint');
    setDefault(json, '@nrwl/cypress', 'cypress-project', 'linter', 'tslint');
    setDefault(json, '@nrwl/cypress', 'cypress-project', 'linter', 'tslint');
    setDefault(json, '@nrwl/node', 'application', 'linter', 'tslint');
    setDefault(json, '@nrwl/node', 'library', 'linter', 'tslint');
    setDefault(json, '@nrwl/nest', 'application', 'linter', 'tslint');
    setDefault(json, '@nrwl/nest', 'library', 'linter', 'tslint');
    setDefault(json, '@nrwl/express', 'application', 'linter', 'tslint');
    setDefault(json, '@nrwl/express', 'library', 'linter', 'tslint');

    return json;
  });
}

function getWorkspacePath(host: Tree, { directory, cli }: Schema) {
  return join(directory, cli === 'angular' ? 'angular.json' : 'workspace.json');
}

function setDefaultPackageManager(host: Tree, options: Schema) {
  if (!options.packageManager) {
    return;
  }

  updateJson<WorkspaceJsonConfiguration>(
    host,
    getWorkspacePath(host, options),
    (json) => {
      if (!json.cli) {
        json.cli = {};
      }
      json.cli.packageManager = options.packageManager;
      return json;
    }
  );
}

function setDefault(
  json: any,
  collectionName: string,
  generatorName: string,
  key: string,
  value: any
) {
  if (!json.schematics) json.schematics = {};
  if (
    json.schematics[collectionName] &&
    json.schematics[collectionName][generatorName]
  ) {
    json.schematics[collectionName][generatorName][key] = value;
  } else if (json.schematics[`${collectionName}:${generatorName}`]) {
    json.schematics[`${collectionName}:${generatorName}`][key] = value;
  } else {
    json.schematics[collectionName] = json.schematics[collectionName] || {};
    json.schematics[collectionName][generatorName] = { [key]: value };
  }
}
