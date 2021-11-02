import { execSync } from 'child_process';

// TODO (v13): Update to main
export function deduceDefaultBase(): string {
  const nxDefaultBase = 'main';
  try {
    return (
      execSync('git config --get init.defaultBranch').toString().trim() ||
      nxDefaultBase
    );
  } catch {
    return nxDefaultBase;
  }
}

export function checkGitVersion(): string | null {
  try {
    let gitVersionOutput = execSync('git --version').toString().trim();
    return gitVersionOutput.match(/[0-9]+\.[0-9]+\.+[0-9]+/)[0];
  } catch {
    return null;
  }
}
