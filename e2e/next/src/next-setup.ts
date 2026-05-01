import { cleanupProject, newProject } from '@nx/e2e-utils';

export interface NextTestSetup {
  proj: string;
  originalEnv: string;
}

export function setupNextTest(): NextTestSetup {
  const proj = newProject({
    packages: ['@nx/next', '@nx/cypress'],
  });
  const originalEnv = process.env.NODE_ENV;

  return {
    proj,
    originalEnv,
  };
}

export function resetNextEnv(setup: NextTestSetup): void {
  process.env.NODE_ENV = setup.originalEnv;
}

export function cleanupNextTest(): void {
  cleanupProject();
}
