import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ensureViteConfigIsCorrect } from './vite-config-edit-utils';

describe('ensureViteConfigIsCorrect', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it.each([
    [
      'a @ts-expect-error on its own line',
      `export default defineConfig({
  // @ts-expect-error not a Vite option
  notAnOption: true,
});
`,
      `({\n  plugins: [react()],\n  // @ts-expect-error not a Vite option\n  notAnOption: true,`,
    ],
    [
      'a @ts-expect-error on the opening brace line',
      `export default defineConfig({ // @ts-expect-error not a Vite option
  notAnOption: true,
});
`,
      `({ // @ts-expect-error not a Vite option\n  plugins: [react()], notAnOption: true,`,
    ],
    [
      'an eslint-disable-line after a spread',
      `export default defineConfig({
  ...base, // eslint-disable-line no-undef
  root: '.',
});
`,
      `  ...base, // eslint-disable-line no-undef\n  plugins: [react()], root: '.',`,
    ],
    [
      'a @ts-expect-error above a one-line config',
      `// @ts-expect-error not a Vite option
export default defineConfig({ notAnOption: true, root: '.' });
`,
      `// @ts-expect-error not a Vite option\nexport default defineConfig({ plugins: [react()], notAnOption: true, root: '.' });`,
    ],
  ])('should keep %s on the lines it covers', (_, config, expected) => {
    tree.write(
      'apps/my-app/vite.config.ts',
      `import { defineConfig } from 'vite';\n\n${config}`
    );

    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      '',
      {},
      [],
      ['react()'],
      '',
      {},
      '',
      { build: true, test: true, serve: false }
    );

    expect(tree.read('apps/my-app/vite.config.ts', 'utf-8')).toContain(
      expected
    );
  });
});
