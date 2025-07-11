import { spawn, exec } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { CreateNxWorkspaceError } from './error-utils';

/**
 * Use spawn only for interactive shells
 */
export function spawnAndWait(command: string, args: string[], cwd: string) {
  return new Promise((res, rej) => {
    const childProcess = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        NX_DAEMON: 'false',
        // This is the same environment variable that ESLint uses to determine if it should use a flat config.
        // Default to true for all new workspaces.
        ESLINT_USE_FLAT_CONFIG: process.env.ESLINT_USE_FLAT_CONFIG ?? 'true',
      },
      shell: true,
      windowsHide: false,
    });

    childProcess.on('exit', (code) => {
      if (code !== 0) {
        rej({ code: code });
      } else {
        res({ code: 0 });
      }
    });
  });
}

export function execAndWait(command: string, cwd: string) {
  return new Promise<{ code: number; stdout: string }>((res, rej) => {
    exec(
      command,
      { cwd, env: { ...process.env, NX_DAEMON: 'false' }, windowsHide: false },
      (error, stdout, stderr) => {
        if (error) {
          const logFile = join(cwd, 'error.log');
          writeFileSync(logFile, `${stdout}\n${stderr}`);
          const message = stderr && stderr.trim().length ? stderr : stdout;
          rej(new CreateNxWorkspaceError(message, error.code, logFile));
        } else {
          res({ code: 0, stdout });
        }
      }
    );
  });
}
