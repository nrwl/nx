import { mockCjsModule } from '@nx/devkit/internal-testing-utils';
import { rspack } from '@rspack/core';
import { join } from 'path';
import { NxAppRspackPlugin } from './nx-app-rspack-plugin';

// The plugin `require`s these lazily, which `vi.mock` cannot reach.
mockCjsModule(import.meta.url, '../utils/plugins/normalize-options', {
  normalizeOptions: (options) => ({
    ...options,
    root: process.cwd(),
    projectRoot: 'apps/example',
  }),
});

mockCjsModule(import.meta.url, '../utils/apply-base-config', {
  applyBaseConfig: (options, config) => {
    config.context = join(options.root, options.projectRoot);
  },
});

describe('NxAppRspackPlugin', () => {
  it('passes the project context to downstream rspack plugins', async () => {
    let downstreamContext: string;
    const compiler = rspack({
      mode: 'none',
      target: 'node',
      plugins: [
        new NxAppRspackPlugin({ target: 'node' }),
        {
          apply(compiler) {
            downstreamContext = compiler.context;
          },
        },
      ],
    });

    expect(downstreamContext).toBe(join(process.cwd(), 'apps/example'));
    expect(compiler.context).toBe(compiler.options.context);
    await new Promise<void>((resolve, reject) =>
      compiler.close((error) => (error ? reject(error) : resolve()))
    );
  });
});
