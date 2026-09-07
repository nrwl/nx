import { logger, readJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addPluginsToOxlintConfig } from './oxlint-config';

describe('addPluginsToOxlintConfig', () => {
  let tree: Tree;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    writeJson(tree, '.oxlintrc.json', { plugins: ['typescript'], rules: {} });
    // In `beforeEach`/`afterEach` rather than inline: a failing assertion would
    // skip an inline `mockRestore` and leave `logger.warn` mocked for the rest
    // of the file.
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  // `restoreAllMocks` rather than `warn.mockRestore()`: if `beforeEach` throws
  // before the spy is assigned, the latter adds a `TypeError` to every test and
  // buries the real cause.
  afterEach(() => jest.restoreAllMocks());

  it('should write the plugins to the project config', () => {
    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react', 'jsx-a11y']);

    expect(readJson(tree, 'apps/my-app/.oxlintrc.json')).toEqual({
      extends: ['../../.oxlintrc.json'],
      plugins: ['react', 'jsx-a11y'],
    });
  });

  it('should extend the root config, since a nested config replaces it', () => {
    addPluginsToOxlintConfig(tree, 'apps/nested/deep/my-app', ['react']);

    expect(
      readJson(tree, 'apps/nested/deep/my-app/.oxlintrc.json').extends
    ).toEqual(['../../../../.oxlintrc.json']);
  });

  // Oxlint resolves to the nearest config, so extending the workspace root here
  // would skip `libs/shared` entirely and drop everything it configures — with
  // both configs written by this generator, one run after the other.
  it('should extend the nearest config, not the workspace root', () => {
    writeJson(tree, 'libs/shared/.oxlintrc.json', {
      extends: ['../../.oxlintrc.json'],
      plugins: ['jest'],
    });

    addPluginsToOxlintConfig(tree, 'libs/shared/ui', ['react']);

    expect(readJson(tree, 'libs/shared/ui/.oxlintrc.json').extends).toEqual([
      '../../../libs/shared/.oxlintrc.json',
    ]);
  });

  // Walking past it to the root would generate an `extends` naming a config
  // that is not the one being replaced — the same silent drop, one type over.
  it('should refuse rather than skip a TypeScript ancestor config', () => {
    tree.write('libs/shared/oxlint.config.ts', 'export default {};');

    addPluginsToOxlintConfig(tree, 'libs/shared/ui', ['react']);

    expect(tree.exists('libs/shared/ui/.oxlintrc.json')).toBe(false);
    const message = warn.mock.calls[0][0];
    expect(message).toContain('only JSON Oxlint configs');
    // Naming it is the whole signal: adding the plugins to the root instead —
    // which "your Oxlint config" reads as — leaves them not running.
    expect(message).toContain('"libs/shared/oxlint.config.ts"');
  });

  it('should name the nearest config when warning about a missing extends', () => {
    writeJson(tree, 'libs/shared/.oxlintrc.json', { plugins: ['jest'] });
    writeJson(tree, 'libs/shared/ui/.oxlintrc.json', { plugins: ['vue'] });

    addPluginsToOxlintConfig(tree, 'libs/shared/ui', ['react']);

    // Each of the three mentions is pinned separately: any one of them can
    // revert to the workspace root on its own, and the other two keep a
    // whole-message assertion green while the text names two different configs.
    const message = warn.mock.calls[0][0];
    expect(message).toContain("so libs/shared/.oxlintrc.json's categories");
    expect(message).toContain('violations libs/shared/.oxlintrc.json would');
    // The suggested `extends` is the actionable one — a root-relative path here
    // reproduces the very skip this warning reports.
    expect(message).toContain(
      '"extends": ["../../../libs/shared/.oxlintrc.json"]'
    );
  });

  it('should leave the root config untouched', () => {
    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

    expect(readJson(tree, '.oxlintrc.json')).toEqual({
      plugins: ['typescript'],
      rules: {},
    });
  });

  // A nested config replaces the root, so the root's categories and rules stop
  // reaching a project whose config names no `extends`.
  it('should warn when updating a project config that does not extend the root', () => {
    writeJson(tree, 'apps/my-app/.oxlintrc.json', { plugins: ['vue'] });

    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

    expect(readJson(tree, 'apps/my-app/.oxlintrc.json').plugins).toEqual([
      'vue',
      'react',
    ]);
    const message = warn.mock.calls[0][0];
    expect(message).toContain('no "extends"');
    // Pin the claim, not just the prefix — the prefix survives a rewrite that
    // inverts what the message says the plugins do.
    expect(message).toContain("still run, but under Oxlint's defaults");
  });

  it('should stay quiet when the project config already extends the root', () => {
    writeJson(tree, 'apps/my-app/.oxlintrc.json', {
      extends: ['../../.oxlintrc.json'],
      plugins: ['vue'],
    });

    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

    expect(warn).not.toHaveBeenCalled();
  });

  it('should merge into an existing project config', () => {
    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);
    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react', 'react-perf']);

    expect(readJson(tree, 'apps/my-app/.oxlintrc.json')).toEqual({
      extends: ['../../.oxlintrc.json'],
      plugins: ['react', 'react-perf'],
    });
  });

  it('should keep each project independent', () => {
    addPluginsToOxlintConfig(tree, 'apps/react-app', ['react']);
    addPluginsToOxlintConfig(tree, 'apps/vue-app', ['vue']);

    expect(readJson(tree, 'apps/react-app/.oxlintrc.json').plugins).toEqual([
      'react',
    ]);
    expect(readJson(tree, 'apps/vue-app/.oxlintrc.json').plugins).toEqual([
      'vue',
    ]);
  });

  it('should add to the root config itself for a root project', () => {
    addPluginsToOxlintConfig(tree, '.', ['react']);

    expect(readJson(tree, '.oxlintrc.json')).toEqual({
      plugins: ['typescript', 'react'],
      rules: {},
    });
    // The root config is its own governing config, so the no-`extends` warning
    // would be telling it to extend itself.
    expect(warn).not.toHaveBeenCalled();
  });

  it('should no-op without plugins', () => {
    addPluginsToOxlintConfig(tree, 'apps/my-app', []);

    expect(tree.exists('apps/my-app/.oxlintrc.json')).toBe(false);
  });

  it('should warn rather than no-op silently under a TypeScript root', () => {
    tree.delete('.oxlintrc.json');
    tree.write('oxlint.config.ts', 'export default {};');

    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

    expect(tree.exists('apps/my-app/.oxlintrc.json')).toBe(false);
    // The branch that writes nothing at all — the warning is the only signal, so
    // it has to name the file here too, not just in the ancestor case.
    const message = warn.mock.calls[0][0];
    expect(message).toContain('only JSON Oxlint configs');
    expect(message).toContain('"oxlint.config.ts"');
  });

  // The governing config's format only matters when a project config has to be
  // created, because that is what needs an `extends` pointing at it.
  it('should still update a project config that already exists under a TypeScript root', () => {
    tree.delete('.oxlintrc.json');
    tree.write('oxlint.config.ts', 'export default {};');
    writeJson(tree, 'apps/my-app/.oxlintrc.json', { plugins: ['vue'] });

    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

    expect(readJson(tree, 'apps/my-app/.oxlintrc.json').plugins).toEqual([
      'vue',
      'react',
    ]);
    // Nothing can `extends` a TypeScript config, so there is no fix to suggest.
    expect(warn).not.toHaveBeenCalled();
  });

  it('should warn for a root project whose root config is TypeScript', () => {
    tree.delete('.oxlintrc.json');
    tree.write('oxlint.config.ts', 'export default {};');

    addPluginsToOxlintConfig(tree, '.', ['react']);

    // A root project has no config of its own to find, so the probe above is
    // short-circuited for it. Without that, the TypeScript root is picked up as
    // the project's own config and the guard below dereferences null.
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('only JSON Oxlint configs')
    );
  });

  // Two configs in one directory is a hard error in Oxlint, not an override, so
  // every filename Oxlint honours has to block the write — including the ones
  // this package cannot rewrite.
  it.each([
    ['.oxlintrc.jsonc', '{\n  // keep this\n  "plugins": ["vue"]\n}\n'],
    ['oxlint.config.ts', 'export default { plugins: ["vue"] };\n'],
    ['oxlint.config.mts', 'export default { plugins: ["vue"] };\n'],
  ])(
    'should not write a second config beside an existing %s',
    (file, contents) => {
      tree.write(`apps/my-app/${file}`, contents);

      addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

      expect(tree.exists('apps/my-app/.oxlintrc.json')).toBe(false);
      // Refusing silently would leave the plugins off with no signal at all.
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('react'));
    }
  );

  it('should keep comments in an existing .oxlintrc.jsonc', () => {
    tree.write(
      'apps/my-app/.oxlintrc.jsonc',
      '{\n  // keep this\n  "plugins": ["vue"]\n}\n'
    );

    addPluginsToOxlintConfig(tree, 'apps/my-app', ['react']);

    // `updateJson` parses comments away and re-serializes, which would silently
    // discard the one thing the .jsonc format exists for.
    expect(tree.read('apps/my-app/.oxlintrc.jsonc', 'utf-8')).toContain(
      '// keep this'
    );
  });

  it('should keep comments in a root .oxlintrc.jsonc for a root project', () => {
    tree.delete('.oxlintrc.json');
    tree.write(
      '.oxlintrc.jsonc',
      '{\n  // keep this\n  "plugins": ["vue"]\n}\n'
    );

    addPluginsToOxlintConfig(tree, '.', ['react']);

    // A root project rewrites the root config itself, so the `.json` refusal has
    // to hold for the root too — not just for a project subdirectory.
    expect(tree.read('.oxlintrc.jsonc', 'utf-8')).toContain('// keep this');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('strip its comments')
    );
  });
});
