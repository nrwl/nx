import {
  chain,
  move,
  noop,
  Rule,
  schematic,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  NodePackageInstallTask,
  RepositoryInitializerTask,
} from '@angular-devkit/schematics/tasks';

import {
  addDepsToPackageJson,
  updateWorkspaceInTree,
} from '../../utils/ast-utils';

import { formatFiles } from '../../utils/rules/format-files';

import { nxVersion } from '../../utils/versions';
import * as path from 'path';
import { Observable } from 'rxjs';
import { spawn } from 'child_process';
import { getPackageManagerCommand } from '@nrwl/tao/src/shared/package-manager';
import * as yargsParser from 'yargs-parser';
import { names } from '@nrwl/devkit';

export enum Preset {
  Empty = 'empty',
  OSS = 'oss',
  WebComponents = 'web-components',
  Angular = 'angular',
  AngularWithNest = 'angular-nest',
  React = 'react',
  ReactWithExpress = 'react-express',
  NextJs = 'next',
  Nest = 'nest',
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
  defaultBase?: string;
  nxWorkspaceRoot?: string;
  linter: 'tslint' | 'eslint';
  packageManager?: string;
}

class RunPresetTask {
  toConfiguration() {
    return {
      name: 'RunPreset',
    };
  }
}

function createPresetTaskExecutor(opts: Schema) {
  const cliCommand = opts.cli === 'angular' ? 'ng' : 'nx';
  const parsedArgs = yargsParser(process.argv, {
    boolean: ['interactive'],
  });

  return {
    name: 'RunPreset',
    create: () => {
      return Promise.resolve(() => {
        const spawnOptions = {
          stdio: [process.stdin, process.stdout, process.stderr],
          shell: true,
          cwd: path.join(opts.nxWorkspaceRoot || process.cwd(), opts.directory),
        };
        const pmc = getPackageManagerCommand();
        const executable = `${pmc.exec} ${cliCommand}`;
        const args = [
          `g`,
          `@nrwl/workspace:preset`,
          `--name=${opts.appName}`,
          opts.style ? `--style=${opts.style}` : null,
          opts.linter ? `--linter=${opts.linter}` : null,
          opts.npmScope
            ? `--npmScope=${opts.npmScope}`
            : `--npmScope=${opts.name}`,
          opts.preset ? `--preset=${opts.preset}` : null,
          `--cli=${cliCommand}`,
          parsedArgs.interactive ? '--interactive=true' : '--interactive=false',
        ].filter((e) => !!e);
        return new Observable((obs) => {
          spawn(executable, args, spawnOptions).on('close', (code: number) => {
            if (code === 0) {
              obs.next();
              obs.complete();
            } else {
              const message = 'Workspace creation failed, see above.';
              obs.error(new Error(message));
            }
          });
        });
      });
    },
  };
}

export default function (options: Schema): Rule {
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

  options = normalizeOptions(options);

  const layout = options.preset === 'oss' ? 'packages' : 'apps-and-libs';
  const workspaceOpts = {
    ...options,
    layout,
    preset: undefined,
    nxCloud: undefined,
  };
  return (host: Tree, context: SchematicContext) => {
    const engineHost = (context.engine.workflow as any).engineHost;
    engineHost.registerTaskExecutor(createPresetTaskExecutor(options));

    return chain([
      schematic('workspace', workspaceOpts),
      options.cli === 'angular' ? setDefaultPackageManager(options) : noop(),
      setDefaultLinter(options),
      addPresetDependencies(options),
      addCloudDependencies(options),
      move('/', options.directory),
      addTasks(options),
      formatFiles({ skipFormat: false }, options.directory),
    ])(Tree.empty(), context);
  };
}

function addCloudDependencies(options: Schema) {
  return options.nxCloud
    ? addDepsToPackageJson({}, { '@nrwl/nx-cloud': 'latest' }, false)
    : noop();
}

function addPresetDependencies(options: Schema) {
  if (options.preset === 'empty') {
    return noop();
  } else if (options.preset === 'web-components') {
    return addDepsToPackageJson(
      {},
      {
        '@nrwl/web': nxVersion,
      },
      false
    );
  } else if (options.preset === 'angular') {
    return addDepsToPackageJson(
      {
        '@nrwl/angular': nxVersion,
      },
      {},
      false
    );
  } else if (options.preset === 'angular-nest') {
    return addDepsToPackageJson(
      {
        '@nrwl/angular': nxVersion,
      },
      {
        '@nrwl/nest': nxVersion,
      },
      false
    );
  } else if (options.preset === 'react') {
    return addDepsToPackageJson(
      {},
      {
        '@nrwl/react': nxVersion,
      },
      false
    );
  } else if (options.preset === 'react-express') {
    return addDepsToPackageJson(
      {},
      {
        '@nrwl/react': nxVersion,
        '@nrwl/express': nxVersion,
      },
      false
    );
  } else if (options.preset === 'next') {
    return addDepsToPackageJson(
      {},
      {
        '@nrwl/next': nxVersion,
      },
      false
    );
  } else if (options.preset === 'nest') {
    return addDepsToPackageJson(
      {},
      {
        '@nrwl/nest': nxVersion,
      },
      false
    );
  } else {
    return noop();
  }
}

function addTasks(options: Schema) {
  return (host: Tree, context: SchematicContext) => {
    let packageTask;
    let presetInstallTask;
    if (!options.skipInstall) {
      packageTask = context.addTask(
        new NodePackageInstallTask(options.directory)
      );
    }
    if (options.preset !== 'empty') {
      const createPresetTask = context.addTask(new RunPresetTask(), [
        packageTask,
      ]);

      presetInstallTask = context.addTask(
        new NodePackageInstallTask(options.directory),
        [createPresetTask]
      );
    }
    if (!options.skipGit) {
      const commit =
        typeof options.commit == 'object'
          ? options.commit
          : !!options.commit
          ? {}
          : false;
      context.addTask(
        new RepositoryInitializerTask(options.directory, commit),
        presetInstallTask
          ? [presetInstallTask]
          : packageTask
          ? [packageTask]
          : []
      );
    }
  };
}

function normalizeOptions(options: Schema): Schema {
  options.name = names(options.name).fileName;
  if (!options.directory) {
    options.directory = options.name;
  }

  return options;
}

function setDefaultLinter({ linter, preset }: Schema): Rule {
  // Don't do anything if someone doesn't pick angular
  if (preset === 'angular' || preset === 'angular-nest') {
    switch (linter) {
      case 'eslint': {
        return setESLintDefault();
      }
      case 'tslint': {
        return setTSLintDefault();
      }
      default: {
        return noop();
      }
    }
  } else {
    return noop();
  }
}

/**
 * This sets ESLint as the default for any schematics that default to TSLint
 */
function setESLintDefault() {
  return updateWorkspaceInTree((json) => {
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
function setTSLintDefault() {
  return updateWorkspaceInTree((json) => {
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

function setDefaultPackageManager({ packageManager }: Schema) {
  if (!packageManager) {
    return noop();
  }

  return updateWorkspaceInTree((json) => {
    if (!json.cli) {
      json.cli = {};
    }
    json.cli['packageManager'] = packageManager;
    return json;
  });
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
