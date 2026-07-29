import boundariesPlugin from './index.js';

/**
 * The bridge resolves the rule at module-evaluation time out of an optional
 * peer dependency whose CJS/ESM shape it has to guess. If that shape ever
 * shifts, the failure surfaces inside Oxlint's `(await import(url)).default`,
 * where the error is opaque. These assertions turn that into a unit failure.
 */
describe('@nx/oxlint/boundaries-plugin', () => {
  it('exposes the enforce-module-boundaries rule under the @nx namespace', () => {
    expect(boundariesPlugin.meta.name).toEqual('@nx');
    expect(Object.keys(boundariesPlugin.rules)).toContain(
      'enforce-module-boundaries'
    );
  });

  it('carries the rule name in meta, which Oxlint requires', () => {
    const rule = boundariesPlugin.rules['enforce-module-boundaries'] as {
      meta?: { name?: string; schema?: unknown };
      create?: unknown;
    };

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
