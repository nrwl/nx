import { execSync } from 'child_process';

export function resolveEas(workspaceRoot: string): string {
  try {
    execSync('eas --version');
  } catch {
    throw new Error(
      'EAS is not installed. Please run `npm install --global eas-cli` or `yarn global add eas-cli`.'
    );
  }

  let npmGlobalPath: string, yarnGlobalPath: string;
  try {
    npmGlobalPath = execSync('npm root -g', { windowsHide: true })
      ?.toString()
      ?.trim()
      ?.replace('\u001b[2K\u001b[1G', ''); // strip out ansi codes
  } catch {}
  try {
    yarnGlobalPath = execSync('yarn global dir', { windowsHide: true })
      ?.toString()
      ?.trim()
      ?.replace('\u001b[2K\u001b[1G', ''); // strip out ansi codes
  } catch {}

  try {
    return require.resolve('eas-cli/bin/run', {
      paths: [npmGlobalPath, yarnGlobalPath, workspaceRoot].filter(
        Boolean
      ) as string[],
    });
  } catch {
    throw new Error(
      'Can not resolve EAS. Please run `npm install --global eas-cli` or `yarn global add eas-cli`.'
    );
  }
}
