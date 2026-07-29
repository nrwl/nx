import boundariesPlugin from './index.js';

/**
 * Checks the shape Oxlint requires of a JS plugin: a namespaced `meta.name`,
 * the rule under its own key, a schema, and a callable `create`.
 *
 * Scope, so this isn't mistaken for more than it is: jest transforms to CJS
 * (`module: { type: 'commonjs' }` in `jest.preset.js`), so these run through
 * SWC's interop while Oxlint loads the bridge through Node's ESM loader. The
 * two diverge on exactly the `export default` / `module.exports` shape the
 * bridge has to guess, so a change there can break Oxlint at runtime while
 * these stay green. Covering that needs the real loader.
 */
describe('@nx/oxlint/boundaries-plugin', () => {
  it('exposes the enforce-module-boundaries rule under the @nx namespace', () => {
    // Oxlint requires `meta.name` on the plugin — it throws without one.
    expect(boundariesPlugin.meta.name).toEqual('@nx');
    expect(Object.keys(boundariesPlugin.rules)).toContain(
      'enforce-module-boundaries'
    );
  });

  it('carries the rule name in meta so the rule is self-describing', () => {
    const rule = boundariesPlugin.rules['enforce-module-boundaries'] as {
      meta?: { name?: string; schema?: unknown };
      create?: unknown;
    };

    // Oxlint itself takes the name from the rules key above, not from here.
    expect(rule.meta?.name).toEqual('enforce-module-boundaries');
  });

  it('keeps a schema, without which Oxlint rejects the rule options', () => {
    const rule = boundariesPlugin.rules['enforce-module-boundaries'] as {
      meta?: { schema?: unknown };
    };

    expect(rule.meta?.schema).toBeDefined();
  });

  it('exposes a create function for Oxlint to call per file', () => {
    const rule = boundariesPlugin.rules['enforce-module-boundaries'] as {
      create?: unknown;
    };

    expect(typeof rule.create).toEqual('function');
  });
});
