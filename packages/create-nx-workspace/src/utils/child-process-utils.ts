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
      env: { ...process.env, NX_DAEMON: 'false' },
      shell: true,
      windowsHide: true,
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
      { cwd, env: { ...process.env, NX_DAEMON: 'false' } },
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
