import { cleanupProject, getSelectedPackageManager } from '@nx/e2e-utils';

const basePackageManager = getSelectedPackageManager() || 'pnpm';

export function getCreateNxWorkspacePackageManager() {
  return basePackageManager;
}

export function registerCreateNxWorkspaceCleanup() {
  afterEach(() => cleanupProject());
}

