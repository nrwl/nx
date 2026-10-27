import { lstatSync, mkdirSync, readdirSync, realpathSync, rmSync } from 'fs';
import { homedir, platform, tmpdir } from 'os';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'path';
import { dirSync } from 'tmp';
import { CnwError } from './error-utils';

/**
 * Creates an empty owner-only directory for a throwaway package install.
 *
 * Package managers and Node read config and modules from every ancestor of
 * the install, so it lives under `~/.nx/tmp` and never under the shared OS
 * temp dir. Throws when `~/.nx` is unusable. The OS does not reap it, so it is
 * removed when the process exits.
 *
 * Mirrors `createTempInstallDirectory` in packages/nx/src/utils/package-manager.ts;
 * create-nx-workspace cannot depend on nx.
 */
export function createTempInstallDirectory(): string {
  const root = ensurePrivateInstallRoot();
  removeStaleInstallDirectories(root);
  const dir = dirSync({ tmpdir: root }).name;
  if (tempInstallDirectories.size === 0) {
    process.once('exit', removeTempInstallDirectories);
  }
  tempInstallDirectories.add(dir);
  return dir;
}

const tempInstallDirectories = new Set<string>();

function removeTempInstallDirectories() {
  for (const dir of tempInstallDirectories) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}

const STALE_INSTALL_DIRECTORY_MS = 24 * 60 * 60 * 1000;

/**
 * Removes install dirs left behind by processes that never reached their exit
 * handler. A day outlasts any realistic install, so a concurrent process's
 * install survives.
 */
function removeStaleInstallDirectories(root: string) {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  const cutoff = Date.now() - STALE_INSTALL_DIRECTORY_MS;
  for (const entry of entries) {
    const path = join(root, entry);
    try {
      const stats = lstatSync(path);
      if (
        stats.isDirectory() &&
        stats.mtimeMs < cutoff &&
        (typeof process.getuid !== 'function' || stats.uid === process.getuid())
      ) {
        rmSync(path, { recursive: true, force: true });
      }
    } catch {}
  }
}

function ensurePrivateInstallRoot(): string {
  let home: string | undefined;
  try {
    home = homedir();
  } catch {}
  if (!home || !isAbsolute(home) || isAtOrUnderSharedTmp(home)) {
    throw privateInstallRootError(
      'there is no home directory separate from the shared temp directory'
    );
  }
  const nxDir = join(home, '.nx');
  const root = join(nxDir, 'tmp');
  for (const dir of [nxDir, root]) {
    if (!isOwnDirClosedToOthers(dir)) {
      throw privateInstallRootError(
        `${dir} is not a directory owned by you and closed to other users`
      );
    }
  }
  return root;
}

function privateInstallRootError(reason: string): CnwError {
  return new CnwError(
    'SANDBOX_FAILED',
    `Nx cannot install packages without a private ~/.nx directory: ${reason}.\n` +
      'Package managers and Node read config and modules from every parent of the install directory, so Nx will not install into the shared temp directory instead.'
  );
}

function isAtOrUnderSharedTmp(dir: string): boolean {
  const sharedTmp = platform() === 'win32' ? tmpdir() : '/tmp';
  const fromSharedTmp = relative(canonicalDir(sharedTmp), canonicalDir(dir));
  return (
    fromSharedTmp === '' ||
    (fromSharedTmp !== '..' &&
      !fromSharedTmp.startsWith('..' + sep) &&
      !isAbsolute(fromSharedTmp))
  );
}

/** Real path of `dir`, resolving its nearest existing ancestor when it is missing. */
function canonicalDir(dir: string): string {
  const missing: string[] = [];
  let candidate = resolve(dir);
  while (true) {
    try {
      return join(realpathSync(candidate), ...missing);
    } catch {
      if (dirname(candidate) === candidate) {
        return resolve(dir);
      }
      missing.unshift(basename(candidate));
      candidate = dirname(candidate);
    }
  }
}

function isOwnDirClosedToOthers(dir: string): boolean {
  try {
    mkdirSync(dir, { mode: 0o700 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code !== 'EEXIST') {
      return false;
    }
  }
  try {
    const stats = lstatSync(dir);
    if (!stats.isDirectory()) {
      return false;
    }
    return (
      typeof process.getuid !== 'function' ||
      (stats.uid === process.getuid() && !(stats.mode & 0o022))
    );
  } catch {
    return false;
  }
}
