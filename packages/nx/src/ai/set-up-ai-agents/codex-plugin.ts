import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { delimiter, join } from 'path';
import { codexPluginMarketplace, codexPluginPackage } from '../constants';

// Codex installs plugins per user and enables them per project. The
// @nx/codex-plugin installer caches the Nx plugin without enabling it globally.

export function isCodexAvailable(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const extensions =
    process.platform === 'win32'
      ? (env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')
      : [''];
  return (env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .some((dir) =>
      extensions.some((ext) => existsSync(join(dir, `codex${ext}`)))
    );
}

function resolveCodexHome(env: NodeJS.ProcessEnv): string {
  return env.CODEX_HOME?.trim() || join(homedir(), '.codex');
}

export function isCodexPluginInstalled(
  version: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return existsSync(
    join(
      resolveCodexHome(env),
      'plugins',
      'cache',
      codexPluginMarketplace,
      'nx',
      version
    )
  );
}

export function codexPluginInstallCommand(version: string): string {
  return `npx -y ${codexPluginPackage}@${version} install`;
}

export function installCodexPlugin(
  version: string,
  cwd: string
): { ok: boolean; error?: string } {
  try {
    const stdout = execSync(`${codexPluginInstallCommand(version)} --json`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180_000,
      windowsHide: true,
    });
    let result: { ok?: boolean; error?: string } = {};
    try {
      result = JSON.parse(stdout);
    } catch {
      // The installer exited successfully but printed no JSON report.
    }
    return result.ok === false
      ? {
          ok: false,
          error: result.error ?? 'The installer reported a failure.',
        }
      : { ok: true };
  } catch (e) {
    const error = e as Error & { stderr?: Buffer | string };
    return {
      ok: false,
      error: error.stderr?.toString().trim() || error.message,
    };
  }
}
