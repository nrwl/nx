import { homedir } from 'os';
import { join } from 'path';

/**
 * The home directory pnpm and yarn (classic and berry) resolve their global/
 * user config from. All three call `os.homedir()` (libuv `getpwuid`), which on
 * POSIX reads $HOME first and on Windows reads USERPROFILE, so mirror that for
 * fidelity. (npm and bun resolve home from the environment directly and are
 * handled by their own resolvers.)
 *
 * Note: `os.homedir()` ignores a runtime `process.env.HOME` override under
 * jest, so specs that need a fake home mock `os.homedir()` (see the
 * registry-config specs), matching how the package managers themselves behave.
 */
export function getHomeDir(): string {
  return homedir();
}

export function homeFile(fileName: string): string {
  return join(getHomeDir(), fileName);
}
