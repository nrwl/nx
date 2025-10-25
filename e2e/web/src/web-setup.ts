import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupWebTest() {
  beforeAll(() => newProject({ packages: ['@nx/web'] }));
  afterAll(() => cleanupProject());
}
