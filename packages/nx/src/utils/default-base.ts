import { execSync } from 'child_process';

export function deduceDefaultBase(): string {
  const nxDefaultBase = 'main';
  try {
    return (
      execSync('git config --get init.defaultBranch', {
        windowsHide: true,
      })
        .toString()
        .trim() || nxDefaultBase
    );
  } catch {
    return nxDefaultBase;
  }
}
