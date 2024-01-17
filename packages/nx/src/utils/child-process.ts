import { execSync, ExecSyncOptions } from 'child_process';
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

export class PseudoTtyProcess {
  isAlive = true;

  exitCallbacks = [];

  constructor(private childProcess: ChildProcess) {
    childProcess.onExit((exitCode) => {
      this.isAlive = false;
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
