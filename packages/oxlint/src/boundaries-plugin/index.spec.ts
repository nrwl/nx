import boundariesPlugin from './index.js';

/**
 * Checks the shape Oxlint expects of a JS plugin: the rule under its own key, a
 * schema, and a callable `create` — plus a `meta.name` that keeps the rule id
 * stable, which Oxlint does not require but which decides the namespace.
 *
 * Scope, so this isn't mistaken for more than it is: these run under jest, which
 * resolves `@nx/eslint-plugin/internal` through the `@nx/nx-source` condition to
 * TypeScript source, while Oxlint resolves it to the emitted `dist/internal.js`
 * and imports it across a CJS/ESM boundary. So the export *names* crossing that
 * boundary are not exercised here — `internal.spec.ts` in `@nx/eslint-plugin`
 * pins the emit shape they depend on.
 */
describe('@nx/oxlint/boundaries-plugin', () => {
  it('exposes the enforce-module-boundaries rule under the @nx namespace', () => {
    // Without this Oxlint falls back to the package name, and the rule would
    // register as `@nx/oxlint/enforce-module-boundaries` — not the id the docs
    // tell users to configure.
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
