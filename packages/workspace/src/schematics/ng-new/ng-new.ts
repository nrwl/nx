import {
  chain,
  move,
  noop,
  Rule,
  schematic,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import { Schema } from './schema';
import {
  NodePackageInstallTask,
  RepositoryInitializerTask
} from '@angular-devkit/schematics/tasks';

import { addDepsToPackageJson } from '../../utils/ast-utils';

import { toFileName } from '../../utils/name-utils';

import { formatFiles } from '../../utils/rules/format-files';

import { nxVersion } from '../../utils/versions';
import * as path from 'path';
import { Observable } from 'rxjs';
import { spawn } from 'child_process';

class RunPresetTask {
  toConfiguration() {
    return {
      name: 'RunPreset'
    };
  }
}

function createPresetTaskExecutor(opts: Schema) {
  return {
    name: 'RunPreset',
    create: () => {
      return Promise.resolve(() => {
        const spawnOptions = {
          stdio: [process.stdin, process.stdout, process.stderr],
          shell: true,
          cwd: path.join(process.cwd(), opts.directory)
        };
        const args = [
          `g`,
          `@nrwl/workspace:preset`,
          `--name='${opts.name}'`,
          `--style='${opts.style}'`,
          `--npmScope='${opts.npmScope}'`,
          `--preset='${opts.preset}'`
        ];
        return new Observable(obs => {
          spawn('ng', args, spawnOptions).on('close', (code: number) => {
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
    }
  };
}

export default function(options: Schema): Rule {
  if (options.skipInstall && options.preset !== 'empty') {
    throw new Error(`Cannot select a preset when skipInstall is set to true.`);
  }

  options = normalizeOptions(options);
  const workspaceOpts = { ...options, preset: undefined };
  return (host: Tree, context: SchematicContext) => {
    const engineHost = (context.engine.workflow as any).engineHost;
    engineHost.registerTaskExecutor(createPresetTaskExecutor(options));

    return chain([
      schematic('workspace', workspaceOpts),
      addDependencies(options),
      move('/', options.directory),
      addTasks(options),
      formatFiles()
    ])(Tree.empty(), context);
  };
}

function addDependencies(options: Schema) {
  if (options.preset === 'empty') {
    return noop();
  } else if (options.preset === 'angular') {
    return addDepsToPackageJson(
      {
        '@nrwl/angular': nxVersion
      },
      {}
    );
  } else if (options.preset === 'react') {
    return addDepsToPackageJson(
      {},
      {
        '@nrwl/react': nxVersion
      }
    );
  } else if (options.preset === 'web-components') {
    return addDepsToPackageJson(
      {},
      {
        '@nrwl/web': nxVersion
      }
    );
  } else {
    return addDepsToPackageJson(
      {
        '@nrwl/angular': nxVersion
      },
      {
        '@nrwl/nest': nxVersion
      }
    );
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
        packageTask
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
