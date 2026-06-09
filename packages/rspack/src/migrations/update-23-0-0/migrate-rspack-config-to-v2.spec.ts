import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { type Tree } from '@nx/devkit';
import migrateRspackConfigToV2, {
  rewriteExperimentsCss,
  rewriteLibraryTarget,
} from './migrate-rspack-config-to-v2';

describe('rewriteLibraryTarget (pure transform)', () => {
  it('rewrites a bare libraryTarget assignment to library.type', () => {
    const input = `
module.exports = {
  output: {
    libraryTarget: 'commonjs',
  },
};
`;
    expect(rewriteLibraryTarget(input)).toContain(
      `library: { type: 'commonjs' },`
    );
    expect(rewriteLibraryTarget(input)).not.toContain('libraryTarget');
  });

  it('handles double-quoted values', () => {
    const input = `module.exports = { output: { libraryTarget: "umd" } };`;
    expect(rewriteLibraryTarget(input)).toBe(
      `module.exports = { output: { library: { type: "umd" } } };`
    );
  });

  it('preserves the surrounding property when other keys are present', () => {
    const input = `module.exports = { output: { libraryTarget: 'umd', filename: 'x.js' } };`;
    expect(rewriteLibraryTarget(input)).toBe(
      `module.exports = { output: { library: { type: 'umd' }, filename: 'x.js' } };`
    );
  });

  it('leaves source without libraryTarget untouched', () => {
    const input = `module.exports = { output: { library: { type: 'commonjs' } } };`;
    expect(rewriteLibraryTarget(input)).toBe(input);
  });

  it('skips non-string libraryTarget values', () => {
    const input = `module.exports = { output: { libraryTarget: someVar } };`;
    expect(rewriteLibraryTarget(input)).toBe(input);
  });

  it('handles quoted property keys', () => {
    const input = `module.exports = { output: { 'libraryTarget': 'umd' } };`;
    expect(rewriteLibraryTarget(input)).toContain(`library: { type: 'umd' }`);
    expect(rewriteLibraryTarget(input)).not.toContain('libraryTarget');
  });

  it('does not touch libraryTarget outside an output: parent', () => {
    const input = `module.exports = { plugins: [{ libraryTarget: 'umd' }] };`;
    expect(rewriteLibraryTarget(input)).toBe(input);
  });

  it('handles spreads in the output object', () => {
    const input = `module.exports = { output: { ...base, libraryTarget: 'umd' } };`;
    expect(rewriteLibraryTarget(input)).toBe(
      `module.exports = { output: { ...base, library: { type: 'umd' } } };`
    );
  });
});

describe('rewriteExperimentsCss (pure transform)', () => {
  it('drops experiments.css: false silently', () => {
    const input = `
module.exports = {
  experiments: {
    css: false,
  },
};
`;
    const out = rewriteExperimentsCss(input);
    expect(out).not.toContain('css: false');
    expect(out).toContain('experiments: {');
  });

  it('leaves experiments.css: true alone (handled by AI-prompt migration)', () => {
    const input = `module.exports = { experiments: { css: true } };`;
    expect(rewriteExperimentsCss(input)).toBe(input);
  });

  it('leaves source without experiments.css alone', () => {
    const input = `module.exports = { experiments: { topLevelAwait: true } };`;
    expect(rewriteExperimentsCss(input)).toBe(input);
  });

  it('does not touch a css key outside an experiments parent', () => {
    const input = `
module.exports = {
  module: { rules: [{ test: /\\.css$/, use: [{ loader: 'css-loader', options: { css: true } }] }] },
};
`;
    expect(rewriteExperimentsCss(input)).toBe(input);
  });
});

describe('migrateRspackConfigToV2 (generator)', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('rewrites a workspace rspack.config.js file', async () => {
    tree.write(
      'apps/demo/rspack.config.js',
      `module.exports = {
  output: {
    libraryTarget: 'commonjs',
  },
};
`
    );
    await migrateRspackConfigToV2(tree);
    const updated = tree.read('apps/demo/rspack.config.js', 'utf-8') as string;
    expect(updated).toContain('library:');
    expect(updated).toContain("type: 'commonjs'");
    expect(updated).not.toContain('libraryTarget');
  });

  it('also handles .ts, .mjs, .cjs configs', async () => {
    const ts = `export default { output: { libraryTarget: 'umd' } };\n`;
    const mjs = `export default { output: { libraryTarget: 'module' } };\n`;
    const cjs = `module.exports = { output: { libraryTarget: 'commonjs2' } };\n`;
    tree.write('apps/a/rspack.config.ts', ts);
    tree.write('apps/b/rspack.config.mjs', mjs);
    tree.write('apps/c/rspack.config.cjs', cjs);
    await migrateRspackConfigToV2(tree);
    expect(tree.read('apps/a/rspack.config.ts', 'utf-8')).toContain(
      "library: { type: 'umd' }"
    );
    expect(tree.read('apps/b/rspack.config.mjs', 'utf-8')).toContain(
      "library: { type: 'module' }"
    );
    expect(tree.read('apps/c/rspack.config.cjs', 'utf-8')).toContain(
      "library: { type: 'commonjs2' }"
    );
  });

  it('leaves files that do not mention libraryTarget alone', async () => {
    const before = `module.exports = { output: { filename: 'x.js' } };\n`;
    tree.write('apps/demo/rspack.config.js', before);
    await migrateRspackConfigToV2(tree);
    expect(tree.read('apps/demo/rspack.config.js', 'utf-8')).toBe(before);
  });
});
