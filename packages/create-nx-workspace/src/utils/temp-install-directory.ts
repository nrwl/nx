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
 * the install, so it lives under `~/.nx/tmp`, or under the OS temp dir when it
 * and all of its ancestors are closed to other users. Throws when neither
 * qualifies. The OS does not reap it, so it is removed when the process exits.
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

const TMPDIR_INSTALL_ROOT = 'nx-installs';

function ensurePrivateInstallRoot(): string {
  const homeRefusal = homeInstallRootRefusal();
  if (typeof homeRefusal !== 'string') {
    return homeRefusal.root;
  }
  const tmp = tmpdir();
  const fallbackRoot = join(tmp, TMPDIR_INSTALL_ROOT);
  let tmpRefusal = privateTreeRefusal(tmp);
  if (!tmpRefusal) {
    if (isOwnDirClosedToOthers(fallbackRoot)) {
      return fallbackRoot;
    }
    tmpRefusal = `${fallbackRoot} is not a directory owned by you and closed to other users`;
  }
  throw new CnwError(
    'SANDBOX_FAILED',
    'Nx cannot install packages because it found no directory closed to other users to install into.\n' +
      `  ~/.nx/tmp: ${homeRefusal}.\n` +
      `  The OS temp directory: ${tmpRefusal}.\n` +
      'Package managers and Node read config and modules from every parent of the install directory, so Nx will not install where another user could write to it or to any of its parents.'
  );
}

function homeInstallRootRefusal(): { root: string } | string {
  let home: string | undefined;
  try {
    home = homedir();
  } catch {}
  if (!home || !isAbsolute(home) || isAtOrUnderSharedTmp(home)) {
    return 'there is no home directory separate from the shared temp directory';
  }
  const nxDir = join(home, '.nx');
  const root = join(nxDir, 'tmp');
  for (const dir of [nxDir, root]) {
    if (!isOwnDirClosedToOthers(dir)) {
      return `${dir} is not a directory owned by you and closed to other users`;
    }
  }
  return { root };
}

/**
 * Mirrors `privateTreeRefusal` in packages/nx/src/utils/package-manager.ts.
 */
function privateTreeRefusal(dir: string): string | undefined {
  if (typeof process.getuid !== 'function') {
    try {
      if (lstatSync(dir).isDirectory()) {
        return undefined;
      }
    } catch {}
    return `${dir} is not a real directory`;
  }
  for (const leaf of [resolve(dir), canonicalDir(dir)]) {
    for (let p = leaf; ; p = dirname(p)) {
      const refusal = privatePathRefusal(p, p === leaf);
      if (refusal) {
        return refusal;
      }
      if (dirname(p) === p) {
        break;
      }
    }
  }
  return undefined;
}

function privatePathRefusal(path: string, isLeaf: boolean): string | undefined {
  let stats: ReturnType<typeof lstatSync>;
  try {
    stats = lstatSync(path);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    return `${path} could not be inspected${code ? ` (${code})` : ''}`;
  }
  const uid = process.getuid();
  const trustedOwner = stats.uid === uid || (!isLeaf && stats.uid === 0);
  if (stats.isSymbolicLink() && !isLeaf) {
    return trustedOwner ? undefined : `${path} is owned by uid ${stats.uid}`;
  }
  if (!stats.isDirectory()) {
    return stats.isSymbolicLink()
      ? `${path} is a symlink, not a real directory`
      : `${path} is not a directory`;
  }
  if (stats.mode & 0o022) {
    const mode = (stats.mode & 0o7777).toString(8).padStart(4, '0');
    return `${path} is writable by other users (mode ${mode})`;
  }
  return trustedOwner ? undefined : `${path} is owned by uid ${stats.uid}`;
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
