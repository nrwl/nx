import { execSync, ExecSyncOptions } from 'child_process';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { getPackageManagerCommand } from './package-manager';
import { workspaceRoot, workspaceRootInner } from './workspace-root';

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
