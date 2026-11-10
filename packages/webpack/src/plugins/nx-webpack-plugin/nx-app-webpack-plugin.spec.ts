import { NxAppWebpackPlugin } from './nx-app-webpack-plugin';
import type { Compiler } from 'webpack';
import webpack from 'webpack';
import { join } from 'path';

// apply() lazily loads these modules through CommonJS.
const basePath = require.resolve('./lib/apply-base-config');
const webPath = require.resolve('./lib/apply-web-config');
const base = require(basePath);
const web = require(webPath);

describe('NxAppWebpackPlugin SSR configuration', () => {
  afterEach(() => {
    require.cache[basePath].exports = base;
    require.cache[webPath].exports = web;
  });

  it.each(['node', 'async-node'])(
    'applies web rules for %s SSR bundles',
    (target) => {
      require.cache[basePath].exports = { applyBaseConfig: vi.fn() };
      const applyWeb = vi.fn();
      require.cache[webPath].exports = { applyWebConfig: applyWeb };
      const plugin = Object.create(NxAppWebpackPlugin.prototype);
      plugin.options = { target, ssr: true };
      const compiler = { options: { target, output: {} } } as Compiler;

      plugin.apply(compiler);

      expect(applyWeb).toHaveBeenCalledWith(plugin.options, compiler.options, {
        useNormalizedEntry: true,
      });
    }
  );

  it('does not add web rules to ordinary node applications', () => {
    require.cache[basePath].exports = { applyBaseConfig: vi.fn() };
    const applyWeb = vi.fn();
    require.cache[webPath].exports = { applyWebConfig: applyWeb };
    const plugin = Object.create(NxAppWebpackPlugin.prototype);
    plugin.options = { target: 'node' };

    plugin.apply({ options: { target: 'node', output: {} } } as Compiler);

    expect(applyWeb).not.toHaveBeenCalled();
  });

  it('passes the project context to downstream webpack plugins', async () => {
    const projectRoot = join(process.cwd(), 'apps', 'example');
    require.cache[basePath].exports = {
      applyBaseConfig: (_options, config) => {
        config.context = projectRoot;
      },
    };
    const plugin = Object.create(NxAppWebpackPlugin.prototype);
    plugin.options = { target: 'node' };
    let downstreamContext: string;
    const compiler = webpack({
      mode: 'none',
      target: 'node',
      plugins: [
        plugin,
        {
          apply(compiler) {
            downstreamContext = compiler.context;
          },
        },
      ],
    });

    expect(downstreamContext).toBe(projectRoot);
    expect(compiler.context).toBe(compiler.options.context);
    await new Promise<void>((resolve, reject) =>
      compiler.close((error) => (error ? reject(error) : resolve()))
    );
  });
});
