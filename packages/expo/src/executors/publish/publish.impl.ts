import { ExecutorContext, logger, names } from '@nrwl/devkit';
import { join } from 'path';
import { ChildProcess, fork } from 'child_process';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import {
  displayNewlyAddedDepsMessage,
  syncDeps,
} from '../sync-deps/sync-deps.impl';
import { ExpoPublishOptions } from './schema';

export interface ExpoPublishOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* publishExecutor(
  options: ExpoPublishOptions,
  context: ExecutorContext
): AsyncGenerator<ExpoPublishOutput> {
  logger.warn('@nrwl/expo:publish is deprecated and will be removed in Nx 16.');

  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);
  if (options.sync) {
    displayNewlyAddedDepsMessage(
      context.projectName,
      await syncDeps(
        context.projectName,
        projectRoot,
        context.root,
        context.projectGraph
      )
    );
  }

  try {
    await runCliPublish(context.root, projectRoot, options);

    yield { success: true };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

function runCliPublish(
  workspaceRoot: string,
  projectRoot: string,
  options: ExpoPublishOptions
) {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/expo-cli/bin/expo.js'),
      [
        'publish',
        join(workspaceRoot, projectRoot),
        ...createPublishOptions(options),
      ],
      {
        cwd: projectRoot,
      }
    );

    // Ensure the child process is killed when the parent exits
    process.on('exit', () => childProcess.kill());
    process.on('SIGTERM', () => childProcess.kill());

    childProcess.on('error', (err) => {
      reject(err);
    });
    childProcess.on('exit', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(code);
      }
    });
  });
}

const nxOptions = ['sync'];

function createPublishOptions(options: ExpoPublishOptions) {
  return Object.keys(options).reduce((acc, k) => {
    const v = options[k];
    if (!nxOptions.includes(k)) {
      if (typeof v === 'boolean') {
        if (v === true) {
          // when true, does not need to pass the value true, just need to pass the flag in kebob case
          acc.push(`--${names(k).fileName}`);
        }
      } else {
        acc.push(`--${names(k).fileName}`, v);
      }
    }
    return acc;
  }, []);
}
