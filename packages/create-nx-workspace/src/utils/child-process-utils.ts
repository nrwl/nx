import { spawn, exec } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { CnwError } from './error-utils';

/**
 * Use spawn only for interactive shells
 */
export function spawnAndWait(
  command: string,
  args: string[],
  cwd: string,
  timeout?: number
) {
  return new Promise((res, rej) => {
    // Combine command and args into a single string to avoid DEP0190 warning
    // (passing args with shell: true is deprecated)
    const fullCommand = [command, ...args]
      .map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))
      .join(' ');

    const childProcess = spawn(fullCommand, {
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
      windowsHide: true,
    });

    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (timeout) {
      timer = setTimeout(() => {
        timedOut = true;
        childProcess.kill('SIGTERM');
      }, timeout);
    }

    childProcess.on('exit', (code, signal) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        rej({ code: 1, timedOut: true });
        return;
      }
      if (code === null) code = signalToCode(signal);
      if (code !== 0) {
        rej({ code: code });
      } else {
        res({ code: 0 });
      }
    });
  });
}

export function execAndWait(
  command: string,
  cwd: string,
  silenceErrors = false,
  timeout?: number
) {
  return new Promise<{ code: number; stdout: string }>((res, rej) => {
    exec(
      command,
      {
        cwd,
        env: { ...process.env, NX_DAEMON: 'false' },
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 10, // 10MB — default 1MB can be exceeded by verbose PM output
        ...(timeout ? { timeout } : {}),
      },
      (error, stdout, stderr) => {
        if (error) {
          if (silenceErrors) {
            rej(error.killed ? { timedOut: true } : undefined);
          } else {
            const logFile = join(cwd, 'error.log');
            writeFileSync(logFile, `${stdout}\n${stderr}`);
            const message =
              stderr && stderr.trim().length
                ? stderr
                : stdout && stdout.trim().length
                  ? stdout
                  : `Command failed with exit code ${error.code ?? 'unknown'}. See ${logFile} for details.`;
            rej(
              new CnwError('UNKNOWN', message, logFile, error.code ?? undefined)
            );
          }
        } else {
          res({ code: 0, stdout });
        }
      }
    );
  });
}

function signalToCode(signal: NodeJS.Signals | null): number {
  switch (signal) {
    case 'SIGHUP':
      return 128 + 1;
    case 'SIGINT':
      return 128 + 2;
    case 'SIGTERM':
      return 128 + 15;
    default:
      return 128;
  }
}
