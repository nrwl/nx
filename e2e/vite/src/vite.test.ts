import { cleanupProject, newProject } from '@nrwl/e2e/utils';

describe('Vite Plugin', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  afterEach(() => cleanupProject());

  xit('should build applications', () => {});

  xit('should serve applications in dev mode', () => {});

  xit('should test applications', () => {});
});
