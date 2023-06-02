import { ExecutorContext, names } from '@nx/devkit';
import { ChildProcess, fork } from 'child_process';
import { join } from 'path';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import { ExportExecutorSchema } from './schema';

export interface ExpoExportOutput {
  success: boolean;
}

let childProcess: ChildProcess;

export default async function* exportExecutor(
  options: ExportExecutorSchema,
  context: ExecutorContext
): AsyncGenerator<ExpoExportOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  ensureNodeModulesSymlink(context.root, projectRoot);

  try {
    await exportAsync(context.root, projectRoot, options);

    yield {
      success: true,
    };
  } finally {
    if (childProcess) {
      childProcess.kill();
    }
  }
}

function exportAsync(
  workspaceRoot: string,
  projectRoot: string,
  options: ExportExecutorSchema
): Promise<number> {
  return new Promise((resolve, reject) => {
    childProcess = fork(
      join(workspaceRoot, './node_modules/@expo/cli/build/bin/cli'),
      [
        `export${options.bundler === 'webpack' ? ':web' : ''}`,
        '.',
        ...createExportOptions(options),
      ],
      { cwd: join(workspaceRoot, projectRoot), env: process.env }
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

const nxOptions = ['bundler'];
// options from https://github.com/expo/expo/blob/main/packages/@expo/cli/src/export/index.ts
function createExportOptions(options: ExportExecutorSchema) {
  return Object.keys(options).reduce((acc, k) => {
    if (!nxOptions.includes(k)) {
      const v = options[k];
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
