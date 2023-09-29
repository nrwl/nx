import { ensureCypressInstallation } from '@nx/e2e/utils';

describe('Ensure Cypress Binary is Installed', () => {
  beforeAll(() => {
    ensureCypressInstallation(process.cwd());
  });

  it('should ensure cypress binary is available for the e2es', () => {
    expect(true).toBe(true);
  });
});
