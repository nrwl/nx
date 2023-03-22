import { execSync, ExecSyncOptions } from 'child_process';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import {
  getPackageManagerCommand,
  detectPackageManager,
} from './package-manager';
import { workspaceRoot, workspaceRootInner } from './workspace-root';

export function runNxSync(
  cmd: string,
  options?: ExecSyncOptions & { cwd?: string }
) {
  const baseCmd = getNxCommand(options?.cwd);
  execSync(`${baseCmd} ${cmd}`, options);
}

export function getNxCommand(cwd?: string): string {
  let baseCmd: string;
  const root = workspaceRootInner(cwd, null);
  const pm = existsSync(join(root, 'package.json'))
    ? detectPackageManager(root) ?? 'npm'
    : null;
  if (pm) {
    return `${getPackageManagerCommand(pm).exec} nx`;
  } else {
    cwd ??= process.cwd();
    const offsetFromRoot = relative(cwd, root);
    if (process.platform === 'win32') {
      baseCmd = '.\\' + join(`${offsetFromRoot}`, 'nx.bat');
    } else {
      baseCmd = './' + join(`${offsetFromRoot}`, 'nx');
    }
  }
  return;
}
