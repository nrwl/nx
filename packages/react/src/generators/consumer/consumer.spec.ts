import { Tree, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import consumerGenerator from './consumer';
import type { SupportedBundler } from '../_utils/normalize';

function snapshotTree(tree: Tree, root: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of tree.listChanges()) {
    if (!entry.path.startsWith(root)) continue;
    if (entry.type === 'DELETE') continue;
    files[entry.path] = entry.content?.toString() ?? '';
  }
  return files;
}

describe('@nx/react:consumer', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it.each<SupportedBundler>(['vite', 'rsbuild', 'rspack'])(
    'generates a consumer for the %s bundler',
    async (bundler) => {
      await consumerGenerator(tree, {
        directory: 'apps/my-consumer',
        bundler,
      });

      const project = readProjectConfiguration(tree, 'my-consumer');
      expect(project).toMatchSnapshot('project.json');
      expect(snapshotTree(tree, 'apps/my-consumer')).toMatchSnapshot(
        `${bundler} tree`
      );
    }
  );

  it('emits a mf.ts helper with the PROVIDERS list inlined (no separate JSON file)', async () => {
    await consumerGenerator(tree, {
      directory: 'apps/shell',
      bundler: 'vite',
    });

    expect(tree.exists('apps/shell/src/mf.ts')).toBe(true);
    expect(tree.exists('apps/shell/public/mf-remotes.json')).toBe(false);

    const mf = tree.read('apps/shell/src/mf.ts', 'utf-8') ?? '';
    expect(mf).toContain('const PROVIDERS:');
    // Vite providers emit ESM, so the consumer's registerRemotes MUST set
    // `type: 'module'`. Without it the runtime loads the script as a classic
    // tag and the browser throws #RUNTIME-001 (Cannot use import statement).
    expect(mf).toContain("({ ...remote, type: 'module' }))");

    const viteConfig = tree.read('apps/shell/vite.config.ts', 'utf-8');
    // No build-time `remotes:` property on the federation() call.
    expect(viteConfig).not.toMatch(/^\s+remotes\s*:/m);
  });

  // Without --providerNames, ship a placeholder `my-provider`
  // entry in PROVIDERS pointing at the per-bundler provider-default port
  // (vite 5101, rsbuild 3101, rspack 8101). No actual provider gets
  // generated. URLs point at remoteEntry.js (universally available at dev + prod).
  it.each<[SupportedBundler, number]>([
    ['vite', 5101],
    ['rsbuild', 3101],
    ['rspack', 8101],
  ])(
    'defaults the %s consumer PROVIDERS list to the matching provider-default port (%i) without generating a provider',
    async (bundler, expectedProviderPort) => {
      await consumerGenerator(tree, { directory: 'apps/shell', bundler });
      const mf = tree.read('apps/shell/src/mf.ts', 'utf-8') ?? '';
      expect(mf).toContain(`alias: 'my-provider'`);
      expect(mf).toContain(`name: 'my_provider'`);
      expect(mf).toContain(
        `entry: 'http://localhost:${expectedProviderPort}/remoteEntry.js'`
      );
      expect(tree.exists('apps/my-provider')).toBe(false);
    }
  );

  // --providerNames=p1,p2 generates a sibling provider per
  // entry and wires their assigned ports into the consumer's PROVIDERS list.
  it('generates one provider per --providerNames entry and wires the consumer PROVIDERS list', async () => {
    await consumerGenerator(tree, {
      directory: 'apps/shell',
      bundler: 'vite',
      providerNames: ['p1', 'p2'],
    });

    expect(tree.exists('apps/p1/vite.config.ts')).toBe(true);
    expect(tree.exists('apps/p2/vite.config.ts')).toBe(true);

    const mf = tree.read('apps/shell/src/mf.ts', 'utf-8') ?? '';
    expect(mf).toContain(`alias: 'p1'`);
    expect(mf).toContain(`entry: 'http://localhost:5101/remoteEntry.js'`);
    expect(mf).toContain(`alias: 'p2'`);
    expect(mf).toContain(`entry: 'http://localhost:5102/remoteEntry.js'`);

    // App.tsx imports + renders every provider in PROVIDERS, not just the first.
    const app = tree.read('apps/shell/src/App.tsx', 'utf-8') ?? '';
    expect(app).toContain(`const ProviderP1 = lazyProvider('p1', 'App');`);
    expect(app).toContain(`const ProviderP2 = lazyProvider('p2', 'App');`);
    expect(app).toContain(`<ProviderP1 />`);
    expect(app).toContain(`<ProviderP2 />`);
    // Each provider is wrapped in ProviderBoundary so one missing provider
    // can't unmount the whole tree (previous template used bare Suspense).
    expect(app).toContain('class ProviderBoundary');
    expect(app).toContain(`<ProviderBoundary name="p1">`);
    expect(app).toContain(`<ProviderBoundary name="p2">`);
  });

  // A provider's federation container name is derived from its project name
  // (names().fileName -> toFederationName), which strips chars invalid in a JS
  // identifier. The consumer must register that exact name, not a naive
  // `alias.replace(/-/g, '_')`: for a camelCase name like `myCart` the provider
  // emits `my_cart` while the naive transform yields `myCart`, so loadRemote
  // would resolve the URL but the runtime would look up a container that
  // doesn't exist.
  it('registers each provider under the federation container name the provider emits', async () => {
    await consumerGenerator(tree, {
      directory: 'apps/shell',
      bundler: 'vite',
      providerNames: ['myCart'],
    });
    const mf = tree.read('apps/shell/src/mf.ts', 'utf-8') ?? '';
    expect(mf).toContain(`alias: 'myCart'`);
    expect(mf).toContain(`name: 'my_cart'`);

    // The generated provider emits the same federation name we registered.
    const providerConfig =
      tree.read('apps/myCart/vite.config.ts', 'utf-8') ?? '';
    expect(providerConfig).toContain(`name: 'my_cart'`);
  });

  // The runtime needs `type: 'module'` for vite (ESM remoteEntry)
  // and NO type for rspack/rsbuild (UMD remoteEntry). Wrong combo => runtime
  // errors #RUNTIME-001 or #RUNTIME-002. The generator picks based on the
  // consumer's bundler (since --providerNames creates same-bundler siblings).
  it('emits type: "module" in registerRemotes only for vite', async () => {
    await consumerGenerator(tree, { directory: 'apps/cv', bundler: 'vite' });
    await consumerGenerator(tree, {
      directory: 'apps/cr',
      bundler: 'rsbuild',
    });
    await consumerGenerator(tree, { directory: 'apps/cp', bundler: 'rspack' });

    // Assert on the registerRemotes() call shape, not a bare `type: 'module'`
    // substring - the RUNTIME-002 comment in the UMD branch also mentions it.
    expect(tree.read('apps/cv/src/mf.ts', 'utf-8')).toContain(
      "({ ...remote, type: 'module' }))"
    );
    expect(tree.read('apps/cr/src/mf.ts', 'utf-8')).toContain(
      '({ ...remote }))'
    );
    expect(tree.read('apps/cr/src/mf.ts', 'utf-8')).not.toContain(
      "...remote, type: 'module'"
    );
    expect(tree.read('apps/cp/src/mf.ts', 'utf-8')).toContain(
      '({ ...remote }))'
    );
    expect(tree.read('apps/cp/src/mf.ts', 'utf-8')).not.toContain(
      "...remote, type: 'module'"
    );
  });

  // Each generated provider's `serve` target depends on the
  // consumer's `serve` so `nx serve p1` spins up the consumer too.
  it('wires provider.serve.dependsOn back at the consumer for each generated provider', async () => {
    await consumerGenerator(tree, {
      directory: 'apps/shell',
      bundler: 'vite',
      providerNames: ['p1', 'p2'],
    });
    const p1 = readProjectConfiguration(tree, 'p1');
    const p2 = readProjectConfiguration(tree, 'p2');
    expect(p1.targets?.serve?.dependsOn).toEqual(['shell:serve']);
    expect(p2.targets?.serve?.dependsOn).toEqual(['shell:serve']);
  });
});
