import { cleanupProject, getSelectedPackageManager } from '@nx/e2e-utils';

const packageManager = getSelectedPackageManager() || 'pnpm';

export function getCreateNxWorkspacePackageManager() {
  return packageManager;
}

export function registerCreateNxWorkspaceCleanup() {
  afterEach(() => cleanupProject());
}
