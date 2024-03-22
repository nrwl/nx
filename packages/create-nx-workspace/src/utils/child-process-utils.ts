import { spawn, execFile } from 'child_process';
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

export function execAndWait(
  file: string,
  args: string[],
  cwd: string,
  workspaceRoot?: string
) {
  return new Promise<{ code: number; stdout: string }>((res, rej) => {
    const env: any = { ...process.env, NX_DAEMON: 'false' };

    if (workspaceRoot) {
      env.NX_WORKSPACE_ROOT = workspaceRoot;
    }
    const childProcess = execFile(file, args, {
      cwd,
      env,
    });
    let log = Buffer.from('');
    childProcess.on('exit', (code: number) => {
      if (code !== 0) {
        const logFile = join(cwd, 'error.log');
        writeFileSync(logFile, log);
        rej(new CreateNxWorkspaceError(log.toString().trim(), code, logFile));
      } else {
        res({ code, stdout: log.toString().trim() });
      }
    });
    childProcess.stdout?.on('data', (data) => (log += data));
    childProcess.stderr?.on('data', (data) => (log += data));
  });
}
