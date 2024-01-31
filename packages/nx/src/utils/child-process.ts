import {
  exec,
  execSync,
  type ExecOptions,
  type ExecSyncOptions,
} from 'child_process';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { getPackageManagerCommand } from './package-manager';
import { workspaceRoot, workspaceRootInner } from './workspace-root';
import { ChildProcess } from '../native';

export function runNxSync(
  cmd: string,
  options?: ExecSyncOptions & { cwd?: string }
) {
  let baseCmd: string;
  if (existsSync(join(workspaceRoot, 'package.json'))) {
    baseCmd = `${getPackageManagerCommand().exec} nx`;
  } else {
    options ??= {};
    options.cwd ??= process.cwd();
    const offsetFromRoot = relative(
      options.cwd,
      workspaceRootInner(options.cwd, null)
    );
    if (process.platform === 'win32') {
      baseCmd = '.\\' + join(`${offsetFromRoot}`, 'nx.bat');
    } else {
      baseCmd = './' + join(`${offsetFromRoot}`, 'nx');
    }
  }
  execSync(`${baseCmd} ${cmd}`, options);
}

export async function runNxAsync(
  cmd: string,
  options?: ExecOptions & { cwd?: string; silent?: boolean }
) {
  let baseCmd: string;
  if (existsSync(join(workspaceRoot, 'package.json'))) {
    baseCmd = `${getPackageManagerCommand().exec} nx`;
  } else {
    options ??= {};
    options.cwd ??= process.cwd();
    const offsetFromRoot = relative(
      options.cwd,
      workspaceRootInner(options.cwd, null)
    );
    if (process.platform === 'win32') {
      baseCmd = '.\\' + join(`${offsetFromRoot}`, 'nx.bat');
    } else {
      baseCmd = './' + join(`${offsetFromRoot}`, 'nx');
    }
  }
  const silent = options?.silent ?? true;
  if (options?.silent) {
    delete options.silent;
  }
  await new Promise((resolve, reject) => {
    const child = exec(
      `${baseCmd} ${cmd}`,
      options,
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      }
    );
    if (!silent) {
      child.stdout?.pipe(process.stdout);
      child.stderr?.pipe(process.stderr);
    }
  });
}

function messageToCode(message: string): number {
  if (message.startsWith('Terminated by ')) {
    switch (message.replace('Terminated by ', '').trim()) {
      case 'Termination':
        return 143;
      case 'Interrupt':
        return 130;
      default:
        return 128;
    }
  } else if (message.startsWith('Exited with code ')) {
    return parseInt(message.replace('Exited with code ', '').trim());
  } else if (message === 'Success') {
    return 0;
  } else {
    return 1;
  }
}

export class PseudoTtyProcess {
  isAlive = true;

  exitCallbacks = [];

  constructor(private childProcess: ChildProcess) {
    childProcess.onExit((message) => {
      this.isAlive = false;

      const exitCode = messageToCode(message);

      this.exitCallbacks.forEach((cb) => cb(exitCode));
    });
  }

  onExit(callback: (code: number) => void): void {
    this.exitCallbacks.push(callback);
  }

  onOutput(callback: (message: string) => void): void {
    this.childProcess.onOutput(callback);
  }

  kill(): void {
    try {
      this.childProcess.kill();
    } catch {
      // when the child process completes before we explicitly call kill, this will throw
      // do nothing
    } finally {
      if (this.isAlive == true) {
        this.isAlive = false;
      }
    }
  }
}
