import { nxViteTsPaths } from './nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from './nx-copy-assets.plugin';

describe('removed Vite helper stubs', () => {
  it('leaves alias resolution to the migrated Vite configuration', () => {
    const options = Object.freeze({ buildLibsFromSource: false });
    const plugin = nxViteTsPaths(options);
    expect(plugin).toEqual({ name: 'nx-vite-ts-paths' });
    expect(Object.keys(options)).toEqual(['buildLibsFromSource']);
  });

  it('provides a loadable plugin without filesystem or watcher hooks', () => {
    expect(
      nxCopyAssetsPlugin([{ input: 'missing', output: 'assets', glob: '**/*' }])
    ).toEqual({ name: 'nx-copy-assets-plugin' });
  });
});
