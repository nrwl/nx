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

import { toFileName } from '../../utils/name-utils';

import { formatFiles } from '../../utils/rules/format-files';

import { nxVersion } from '../../utils/versions';
import * as path from 'path';
import { Observable } from 'rxjs';
import { spawn } from 'child_process';
import { platform } from 'os';
// @ts-ignore
import yargsParser = require('yargs-parser');

export interface Schema {
  directory: string;
  name: string;
  appName: string;
  npmScope?: string;
  skipInstall?: boolean;
  skipGit?: boolean;
  style?: string;
  nxCloud?: boolean;
  preset:
    | 'empty'
    | 'oss'
    | 'angular'
    | 'react'
    | 'web-components'
    | 'angular-nest'
    | 'react-express'
    | 'next';
  commit?: { name: string; email: string; message?: string };
  defaultBase?: string;
}

class RunPresetTask {
  toConfiguration() {
    return {
      name: 'RunPreset',
    };
  }
}

function createPresetTaskExecutor(cli: string, opts: Schema) {
  const cliCommand = cli === 'angular' ? 'ng' : 'nx';
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
          cwd: path.join(process.cwd(), opts.directory),
        };
        const executable =
          platform() === 'win32'
            ? `.\\node_modules\\.bin\\${cliCommand}`
            : `./node_modules/.bin/${cliCommand}`;
        const args = [
          `g`,
          `@nrwl/workspace:preset`,
          `--name=${opts.appName}`,
          opts.style ? `--style=${opts.style}` : null,
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

export function sharedNew(cli: string, options: Schema): Rule {
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
    engineHost.registerTaskExecutor(createPresetTaskExecutor(cli, options));

    return chain([
      schematic('workspace', { ...workspaceOpts, cli }),
      cli === 'angular' ? setDefaultLinter('tslint') : noop(),
      addPresetDependencies(options),
      addCloudDependencies(options),
      move('/', options.directory),
      addTasks(options),
      formatFiles(),
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
  options.name = toFileName(options.name);
  if (!options.directory) {
    options.directory = options.name;
  }

  return options;
}

function setDefaultLinter(linter: string) {
  return updateWorkspaceInTree((json) => {
    if (!json.schematics) {
      json.schematics = {};
    }
    json.schematics['@nrwl/workspace'] = { library: { linter } };
    json.schematics['@nrwl/cypress'] = { 'cypress-project': { linter } };
    json.schematics['@nrwl/node'] = {
      application: { linter },
      library: { linter },
    };
    json.schematics['@nrwl/nest'] = {
      application: { linter },
      library: { linter },
    };
    json.schematics['@nrwl/express'] = {
      application: { linter },
      library: { linter },
    };
    return json;
  });
}
