import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { type Tree } from '@nx/devkit';
import migrateRsbuildConfigToV2, {
  dropRemoveMomentLocale,
  groupProxyEventHandlers,
  moveSourceAliasToResolve,
  renameProxyContext,
  renameSetupMiddlewares,
} from './migrate-rsbuild-config-to-v2';

describe('renameSetupMiddlewares (pure transform)', () => {
  it('renames preview.setupMiddlewares to server.setupMiddlewares', () => {
    const input = `
export default defineConfig({
  preview: {
    setupMiddlewares: [
      (middlewares) => middlewares,
    ],
  },
});
`;
    const out = renameSetupMiddlewares(input);
    expect(out).toContain('server: {');
    expect(out).toContain('setupMiddlewares');
    expect(out).not.toMatch(/\bpreview\s*:\s*\{[\s\S]*?setupMiddlewares/);
  });

  it('leaves preview blocks without setupMiddlewares alone', () => {
    const input = `export default { preview: { host: '0.0.0.0', port: 4173 } };`;
    expect(renameSetupMiddlewares(input)).toBe(input);
  });

  it('leaves multi-key preview blocks alone (would clobber host/port)', () => {
    const input = `
export default {
  preview: {
    host: '0.0.0.0',
    port: 4173,
    setupMiddlewares: [(m) => m],
  },
};
`;
    expect(renameSetupMiddlewares(input)).toBe(input);
  });

  it('handles quoted property keys', () => {
    const input = `export default { "preview": { setupMiddlewares: [] } };`;
    expect(renameSetupMiddlewares(input)).toContain('server');
    expect(renameSetupMiddlewares(input)).not.toContain('preview');
  });
});

describe('dropRemoveMomentLocale (pure transform)', () => {
  it('drops removeMomentLocale: true', () => {
    const input = `
export default {
  performance: {
    removeMomentLocale: true,
    chunkSplit: { strategy: 'split-by-experience' },
  },
};
`;
    const out = dropRemoveMomentLocale(input);
    expect(out).not.toContain('removeMomentLocale');
    expect(out).toContain('chunkSplit');
  });

  it('drops removeMomentLocale: false', () => {
    const input = `export default { performance: { removeMomentLocale: false } };`;
    expect(dropRemoveMomentLocale(input)).not.toContain('removeMomentLocale');
  });

  it('leaves source without removeMomentLocale alone', () => {
    const input = `export default { performance: { chunkSplit: { strategy: 'all-in-one' } } };`;
    expect(dropRemoveMomentLocale(input)).toBe(input);
  });
});

describe('moveSourceAliasToResolve (pure transform)', () => {
  it('renames source to resolve when alias is its only key', () => {
    const input = `export default { source: { alias: { '@': './src' } } };`;
    const out = moveSourceAliasToResolve(input);
    expect(out).toBe(
      `export default { resolve: { alias: { '@': './src' } } };`
    );
  });

  it('renames source to resolve when only alias + aliasStrategy present', () => {
    const input = `export default defineConfig({
  source: {
    alias: { '@': './src' },
    aliasStrategy: 'prefer-alias',
  },
});`;
    const out = moveSourceAliasToResolve(input);
    expect(out).toContain('resolve: {');
    expect(out).not.toMatch(/\bsource\s*:/);
    expect(out).toContain('aliasStrategy');
  });

  it('splices alias into an existing resolve block', () => {
    const input = `export default {
  source: { entry: { index: './src/main.ts' }, alias: { '@': './src' } },
  resolve: { extensions: ['.ts'] },
};`;
    const out = moveSourceAliasToResolve(input);
    // alias moved past the `resolve:` key; source kept its `entry` key
    expect(out.indexOf('alias')).toBeGreaterThan(out.indexOf('resolve'));
    expect(out).toMatch(/source\s*:\s*\{[^}]*entry/);
    // the source block no longer carries alias
    expect(out).not.toMatch(/source\s*:\s*\{[^{}]*alias/);
  });

  it('creates a resolve block when source has other keys and no resolve', () => {
    const input = `export default {
  source: { entry: { index: './src/main.ts' }, alias: { '@': './src' } },
};`;
    const out = moveSourceAliasToResolve(input);
    expect(out).toMatch(/resolve\s*:\s*\{[\s\S]*alias/);
    expect(out).toMatch(/source\s*:\s*\{[\s\S]*entry/);
    expect(out).not.toMatch(/source\s*:\s*\{[\s\S]*alias/);
  });

  it('leaves a config without source.alias untouched', () => {
    const input = `export default { source: { entry: { index: './src/main.ts' } } };`;
    expect(moveSourceAliasToResolve(input)).toBe(input);
  });

  it('does not touch an alias key outside a source parent', () => {
    const input = `export default { resolve: { alias: { '@': './src' } } };`;
    expect(moveSourceAliasToResolve(input)).toBe(input);
  });
});

describe('renameProxyContext (pure transform)', () => {
  it('renames context to pathFilter in an array-form proxy entry', () => {
    const input = `export default {
  server: {
    proxy: [{ context: '/api', target: 'https://example.com' }],
  },
};`;
    const out = renameProxyContext(input);
    expect(out).toContain("pathFilter: '/api'");
    expect(out).not.toContain('context');
  });

  it('leaves a context key outside a proxy entry alone', () => {
    const input = `export default { tools: { rspack: { context: '/x' } } };`;
    expect(renameProxyContext(input)).toBe(input);
  });

  it('leaves a config without proxy context untouched', () => {
    const input = `export default { server: { proxy: [{ target: 'x' }] } };`;
    expect(renameProxyContext(input)).toBe(input);
  });
});

describe('groupProxyEventHandlers (pure transform)', () => {
  it('groups on* handlers into an on object (object-map form)', () => {
    const input = `export default {
  server: {
    proxy: {
      '/api': {
        target: 'https://example.com',
        onError: () => {},
        onProxyReq: () => {},
      },
    },
  },
};`;
    const out = groupProxyEventHandlers(input);
    expect(out).toContain('on: {');
    expect(out).toContain('error: () => {}');
    expect(out).toContain('proxyReq: () => {}');
    expect(out).not.toContain('onError');
    expect(out).not.toContain('onProxyReq');
  });

  it('groups on* handlers in an array-form proxy entry', () => {
    const input = `export default {
  server: {
    proxy: [{ pathFilter: '/api', onOpen: () => {}, onClose: () => {} }],
  },
};`;
    const out = groupProxyEventHandlers(input);
    expect(out).toContain('on: {');
    expect(out).toContain('open: () => {}');
    expect(out).toContain('close: () => {}');
  });

  it('skips a proxy entry that already has an on object', () => {
    const input = `export default {
  server: { proxy: { '/api': { on: { error: () => {} } } } },
};`;
    expect(groupProxyEventHandlers(input)).toBe(input);
  });

  it('leaves on* keys outside a proxy entry alone', () => {
    const input = `export default { plugins: [{ onError: () => {} }] };`;
    expect(groupProxyEventHandlers(input)).toBe(input);
  });
});

describe('migrateRsbuildConfigToV2 (generator)', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('rewrites a workspace rsbuild.config.ts file', async () => {
    tree.write(
      'apps/demo/rsbuild.config.ts',
      `
export default {
  preview: {
    setupMiddlewares: [(m) => m],
  },
  performance: {
    removeMomentLocale: true,
  },
};
`
    );
    await migrateRsbuildConfigToV2(tree);
    const updated = tree.read('apps/demo/rsbuild.config.ts', 'utf-8') as string;
    expect(updated).toContain('server: {');
    expect(updated).not.toContain('removeMomentLocale');
  });

  it('handles .js, .mjs, .cjs configs', async () => {
    const js = `module.exports = { preview: { setupMiddlewares: [] } };\n`;
    tree.write('apps/a/rsbuild.config.js', js);
    tree.write('apps/b/rsbuild.config.mjs', js);
    tree.write('apps/c/rsbuild.config.cjs', js);
    await migrateRsbuildConfigToV2(tree);
    for (const f of [
      'apps/a/rsbuild.config.js',
      'apps/b/rsbuild.config.mjs',
      'apps/c/rsbuild.config.cjs',
    ]) {
      expect(tree.read(f, 'utf-8')).toContain('server: {');
    }
  });

  it('leaves files without targeted patterns alone', async () => {
    const before = `export default { source: { entry: { index: './src/main.ts' } } };\n`;
    tree.write('apps/demo/rsbuild.config.ts', before);
    await migrateRsbuildConfigToV2(tree);
    expect(tree.read('apps/demo/rsbuild.config.ts', 'utf-8')).toBe(before);
  });
});
