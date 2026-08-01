import { Tree, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import providerGenerator from './provider';
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

describe('@nx/react:provider', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it.each<SupportedBundler>(['vite', 'rsbuild', 'rspack'])(
    'generates a provider for the %s bundler',
    async (bundler) => {
      await providerGenerator(tree, {
        directory: 'apps/my-provider',
        bundler,
      });

      const project = readProjectConfiguration(tree, 'my-provider');
      expect(project).toMatchSnapshot('project.json');
      expect(snapshotTree(tree, 'apps/my-provider')).toMatchSnapshot(
        `${bundler} tree`
      );
    }
  );

  it('coerces hyphenated names into a federation identifier', async () => {
    await providerGenerator(tree, {
      directory: 'apps/product-catalog',
      bundler: 'vite',
    });
    const config = tree.read('apps/product-catalog/vite.config.ts', 'utf-8');
    expect(config).toContain(`name: 'product_catalog'`);
  });

  it('respects an explicit port override', async () => {
    await providerGenerator(tree, {
      directory: 'apps/shell',
      bundler: 'vite',
      port: 7777,
    });
    const config = tree.read('apps/shell/vite.config.ts', 'utf-8');
    expect(config).toContain('const PORT = 7777');
  });

  it('respects an explicit exposeName override', async () => {
    await providerGenerator(tree, {
      directory: 'apps/cart',
      bundler: 'vite',
      exposeName: 'Cart',
    });
    expect(tree.exists('apps/cart/src/Cart.tsx')).toBe(true);
    const config = tree.read('apps/cart/vite.config.ts', 'utf-8');
    expect(config).toContain(`'./Cart': './src/Cart.tsx'`);
  });

  // A kebab-case exposeName is normalized - the raw value stays
  // the MF expose key (consumers reference it) while the component + filename
  // use a PascalCase identifier so the emitted TS is valid.
  it('normalizes a kebab-case exposeName into a PascalCase component', async () => {
    await providerGenerator(tree, {
      directory: 'apps/cart',
      bundler: 'vite',
      exposeName: 'cart-widget',
    });
    // Component file + function use the PascalCase identifier.
    expect(tree.exists('apps/cart/src/CartWidget.tsx')).toBe(true);
    const component = tree.read('apps/cart/src/CartWidget.tsx', 'utf-8') ?? '';
    expect(component).toContain('export function CartWidget()');
    // Expose key keeps the raw value; file points at the component.
    const config = tree.read('apps/cart/vite.config.ts', 'utf-8') ?? '';
    expect(config).toContain(`'./cart-widget': './src/CartWidget.tsx'`);
    // bootstrap imports the component identifier.
    const bootstrap = tree.read('apps/cart/src/bootstrap.tsx', 'utf-8') ?? '';
    expect(bootstrap).toContain(`import { CartWidget } from './CartWidget'`);
  });

  // When --consumer is set, the provider's serve target depends
  // on the consumer's serve so `nx serve <provider>` brings the consumer
  // along (matches the deprecated host/remote UX).
  it('wires serve.dependsOn against the consumer when --consumer is set', async () => {
    await providerGenerator(tree, {
      directory: 'apps/p1',
      bundler: 'vite',
      consumer: 'my-consumer',
    });
    const project = readProjectConfiguration(tree, 'p1');
    expect(project.targets?.serve?.dependsOn).toEqual(['my-consumer:serve']);
  });

  it('leaves serve.dependsOn unset when --consumer is omitted', async () => {
    await providerGenerator(tree, {
      directory: 'apps/p1',
      bundler: 'vite',
    });
    const project = readProjectConfiguration(tree, 'p1');
    expect(project.targets?.serve?.dependsOn).toBeUndefined();
  });

  // Providers must serve cross-origin so a consumer on a
  // different port can fetch mf-manifest.json + chunks without a CORS error.
  it.each<[SupportedBundler, string, RegExp]>([
    ['vite', 'vite.config.ts', /cors:\s*true/],
    ['rsbuild', 'rsbuild.config.ts', /'Access-Control-Allow-Origin':\s*'\*'/],
    ['rspack', 'rspack.config.ts', /'Access-Control-Allow-Origin':\s*'\*'/],
  ])(
    'emits cross-origin headers for the %s provider',
    async (bundler, configFile, pattern) => {
      await providerGenerator(tree, {
        directory: 'apps/shop',
        bundler,
      });
      const config = tree.read(`apps/shop/${configFile}`, 'utf-8') ?? '';
      expect(config).toMatch(pattern);
    }
  );

  // Rsbuild providers need `dev.assetPrefix: true` so chunk
  // URLs point at the provider origin. Without it a consumer on a different
  // port asks its own origin for the federated chunks and gets HTML.
  it('configures the rsbuild provider with dev.assetPrefix so chunks load cross-origin', async () => {
    await providerGenerator(tree, {
      directory: 'apps/shop',
      bundler: 'rsbuild',
    });
    const config = tree.read('apps/shop/rsbuild.config.ts', 'utf-8') ?? '';
    expect(config).toMatch(/dev:\s*\{\s*assetPrefix:\s*true/);
    // Federation is wired through the official rsbuild plugin (which scopes
    // uniqueName from `name`), not the tools.rspack ModuleFederationPlugin hack.
    expect(config).toContain(
      "import { pluginModuleFederation } from '@module-federation/rsbuild-plugin'"
    );
    expect(config).toContain('pluginModuleFederation({');
  });

  // @rspack/cli loads rspack.config.ts as ESM (because the file
  // uses `import`), so bare `__dirname` is undefined. The config must derive
  // it from `import.meta.url`.
  it('derives __dirname via fileURLToPath in the rspack provider config (ESM-safe)', async () => {
    await providerGenerator(tree, {
      directory: 'apps/shop',
      bundler: 'rspack',
    });
    const config = tree.read('apps/shop/rspack.config.ts', 'utf-8') ?? '';
    expect(config).toContain("import { fileURLToPath } from 'node:url'");
    expect(config).toContain(
      'const __dirname = path.dirname(fileURLToPath(import.meta.url))'
    );
  });

  // Rspack targets must use `--mode=...` (Windows-safe) rather
  // than a `NODE_ENV=...` shell prefix.
  it('emits cross-platform rspack commands (no NODE_ENV prefix)', async () => {
    await providerGenerator(tree, {
      directory: 'apps/shop',
      bundler: 'rspack',
    });
    const project = readProjectConfiguration(tree, 'shop');
    expect(project.targets?.serve?.options?.command).toBe(
      'rspack serve --mode=development'
    );
    expect(project.targets?.build?.options?.command).toBe(
      'rspack build --mode=production'
    );
    const pkg = tree.read('apps/shop/package.json', 'utf-8');
    expect(pkg).not.toMatch(/NODE_ENV=/);
  });
});
