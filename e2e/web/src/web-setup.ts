import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupWebTest() {
  beforeAll(() => newProject());
  afterAll(() => cleanupProject());
}
