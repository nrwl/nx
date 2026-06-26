import { normalizeWorkspaceInstallationSource } from './connect-to-nx-cloud';

describe('normalizeWorkspaceInstallationSource', () => {
  it('should leave a plain nx-init source unchanged', () => {
    expect(normalizeWorkspaceInstallationSource('nx-init')).toBe('nx-init');
  });

  it.each([
    'nx-init-angular',
    'nx-init-monorepo',
    'nx-init-nest',
    'nx-init-npm-repo',
    'nx-init-turborepo',
  ])('should collapse the %s flavor to nx-init', (source) => {
    expect(normalizeWorkspaceInstallationSource(source)).toBe('nx-init');
  });

  it.each(['nx-connect', 'nx-console', 'user', 'vcs-repository', 'unknown'])(
    'should leave the non-init source %s verbatim',
    (source) => {
      expect(normalizeWorkspaceInstallationSource(source)).toBe(source);
    }
  );
});
