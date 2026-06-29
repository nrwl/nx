import {
  NX_COPY_ASSETS_PLUGIN_DEPRECATION_MESSAGE,
  NX_VITE_TS_PATHS_DEPRECATION_MESSAGE,
} from './deprecation';

describe('@nx/vite plugin helper deprecations', () => {
  it('links to an existing Vite documentation page', () => {
    expect(NX_VITE_TS_PATHS_DEPRECATION_MESSAGE).toContain(
      'https://nx.dev/technologies/build-tools/vite/api'
    );
    expect(NX_COPY_ASSETS_PLUGIN_DEPRECATION_MESSAGE).toContain(
      'https://nx.dev/technologies/build-tools/vite/api'
    );
  });

  it('does not link to the removed configure-vite page', () => {
    expect(NX_VITE_TS_PATHS_DEPRECATION_MESSAGE).not.toContain(
      'https://nx.dev/docs/technologies/build-tools/vite/configure-vite'
    );
    expect(NX_COPY_ASSETS_PLUGIN_DEPRECATION_MESSAGE).not.toContain(
      'https://nx.dev/docs/technologies/build-tools/vite/configure-vite'
    );
  });
});
