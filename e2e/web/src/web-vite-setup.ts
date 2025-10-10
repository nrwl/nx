import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupWebViteTest() {
  beforeEach(() => newProject());
  afterEach(() => cleanupProject());
}
