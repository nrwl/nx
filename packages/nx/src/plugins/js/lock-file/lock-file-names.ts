// No imports: the project graph builder loads this, and must not load the lock file parsers.

export const YARN_LOCK_FILE = 'yarn.lock';
export const NPM_LOCK_FILE = 'package-lock.json';
export const PNPM_LOCK_FILE = 'pnpm-lock.yaml';
export const BUN_LOCK_FILE = 'bun.lockb';
export const BUN_TEXT_LOCK_FILE = 'bun.lock';

export const LOCKFILES = [
  YARN_LOCK_FILE,
  NPM_LOCK_FILE,
  PNPM_LOCK_FILE,
  BUN_LOCK_FILE,
  BUN_TEXT_LOCK_FILE,
];
