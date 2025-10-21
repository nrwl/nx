import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupWebViteTest() {
  beforeEach(() => newProject({ packages: ['@nx/web', '@nx/react'] }));
  afterEach(() => cleanupProject());
}
