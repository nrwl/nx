import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupWebpackTest() {
  beforeAll(() => newProject());
  afterAll(() => cleanupProject());
}
