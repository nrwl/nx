import { cleanupProject, runCLI } from '@nx/e2e-utils';
import { setupMiscTests } from './misc-setup';

describe('Nx Commands - help', () => {
  beforeAll(() => setupMiscTests());

  afterAll(() => cleanupProject());

  it('should show help if no command provided', () => {
    const output = runCLI('', { silenceError: true });
    expect(output).toContain('Smart Repos · Fast Builds');
    expect(output).toContain('Commands:');
  });
});
