import { execSync } from 'child_process';
import { fileExists } from './fileutils';

export function detectPackageManager(): string {
  try {
    const output = execSync(`nx config cli.packageManager`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
      .split('\n');
    return output[output.length - 1].trim();
  } catch (e) {
    return fileExists('yarn.lock')
      ? 'yarn'
      : fileExists('pnpm-lock.yaml')
      ? 'pnpm'
      : 'npm';
  }
}
