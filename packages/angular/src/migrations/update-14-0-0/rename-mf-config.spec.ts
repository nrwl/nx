import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import host from '../../generators/host/host';
import renameMFConfig from './rename-mf-config';

describe('Module Federation Config Migration', () => {
  it('should rename files in projects that have an mfe.config.js', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);

    await host(tree, {
      name: 'host1',
    });

    tree.rename(
      'apps/host1/module-federation.config.js',
      'apps/host1/mfe.config.js'
    );

    const contentsOfMFEConfig = tree.read('apps/host1/mfe.config.js', 'utf-8');
    expect(tree.exists('apps/host1/mfe.config.js')).toBeTruthy();

    // ACT
    renameMFConfig(tree);

    // ASSERT
    expect(tree.exists('apps/host1/mfe.config.js')).not.toBeTruthy();
    expect(tree.exists('apps/host1/module-federation.config.js')).toBeTruthy();
    expect(
      tree.read('apps/host1/module-federation.config.js', 'utf-8')
    ).toEqual(contentsOfMFEConfig);
  });

  it('should fix dynamic hosts', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);

    await host(tree, {
      name: 'host1',
      dynamic: true,
    });

    tree.rename(
      'apps/host1/module-federation.config.js',
      'apps/host1/mfe.config.js'
    );

    tree.rename(
      'apps/host1/src/assets/module-federation.manifest.json',
      'apps/host1/src/assets/mfe.manifest.json'
    );

    tree.write(
      'apps/host1/src/main.ts',
      tree
        .read('apps/host1/src/main.ts', 'utf-8')
        .replace('module-federation.manifest', 'mfe.manifest')
    );

    const contentsOfMFEConfig = tree.read('apps/host1/mfe.config.js', 'utf-8');
    const contentsOfMFEManifest = tree.read(
      'apps/host1/src/assets/mfe.manifest.json',
      'utf-8'
    );
    expect(tree.exists('apps/host1/mfe.config.js')).toBeTruthy();

    // ACT
    renameMFConfig(tree);

    // ASSERT
    expect(tree.exists('apps/host1/mfe.config.js')).not.toBeTruthy();
    expect(tree.exists('apps/host1/module-federation.config.js')).toBeTruthy();
    expect(
      tree.read('apps/host1/module-federation.config.js', 'utf-8')
    ).toEqual(contentsOfMFEConfig);
    expect(
      tree.read('apps/host1/src/assets/module-federation.config.json', 'utf-8')
    ).toEqual(contentsOfMFEManifest);
  });
});
