import { GLOBAL_NX_INSTALLATION_DOCS_URL } from './documentation-links';

describe('documentation links', () => {
  it('points the global Nx warning at the current installation docs', () => {
    expect(GLOBAL_NX_INSTALLATION_DOCS_URL).toBe(
      'https://nx.dev/docs/getting-started/installation#global-installation'
    );
    expect(GLOBAL_NX_INSTALLATION_DOCS_URL).not.toContain(
      '/more-concepts/global-nx'
    );
  });
});
