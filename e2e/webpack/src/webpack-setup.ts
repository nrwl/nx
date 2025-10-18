import { cleanupProject, newProject } from '@nx/e2e-utils';

export function setupWebpackTest() {
  beforeAll(() =>
    newProject({ packages: ['@nx/webpack', '@nx/js', '@nx/react', '@nx/web'] })
  );
  afterAll(() => cleanupProject());
}
